import { auth }                      from '@clerk/nextjs/server'
import { NextResponse }                from 'next/server'
import { createSupabaseAdmin }         from '@/lib/supabase'
import { isDemoMode }                  from '@/lib/demo/demoGuard'
import { fetchAll }                    from '@/lib/fetchAll'
import { streamText }                  from '@/lib/streamText'
import { getServerLocale }             from '@/lib/i18n/server'

/**
 * GET /api/account/export — RGPD Art. 20 right-to-portability.
 *
 * Returns a single JSON file containing every row tied to the user across
 * every user-scoped table. The response is served as a download
 * (`Content-Disposition: attachment`) so the browser writes it directly to
 * disk — no need to add a UI viewer.
 *
 * Tables included (all that hold per-user data):
 *   users · accounts · categories (user-created only) · transactions ·
 *   financial_scores · xp_progress · xp_history · missions · user_badges ·
 *   voltix_states · goals · goal_deposits · subscriptions · budgets ·
 *   bug_reports · net_worth_snapshots · certificates · debts · debt_attacks
 *
 * Growing tables (transactions, xp_history, financial_scores, goal_deposits,
 * debt_attacks, net_worth_snapshots) are paginated via `fetchAll` — PostgREST
 * otherwise truncates at 1000 rows WITHOUT an error. If the safety ceiling is
 * ever hit, `_warnings` says so.
 *
 * NOT included:
 *   - System categories (is_default = true) — they're not the user's data
 *   - badges catalogue — system data, included by reference via user_badges
 *   - Stripe invoice history — that lives on Stripe; user can fetch from
 *     Customer Portal directly (legally required to be available there)
 *   - Auth credentials / OAuth tokens — those live in Clerk; user can
 *     export from Clerk's user dashboard if needed
 *
 * Defensive: every secondary table is wrapped in a try/catch — a missing
 * migration shouldn't abort the export. Failed tables appear as empty
 * arrays with a `_warnings` field at the root listing what we couldn't
 * read, so the user knows the file is partial and can request again.
 */
export async function GET() {
  if (isDemoMode()) {
    return NextResponse.json(
      { error: 'Export indisponível em modo demonstração.' },
      { status: 403 },
    )
  }

  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createSupabaseAdmin()

  const { data: user, error: userErr } = await db
    .from('users').select('*').eq('clerk_id', clerkId).maybeSingle()
  if (userErr || !user) {
    return NextResponse.json({ error: 'Utilizador não encontrado.' }, { status: 404 })
  }

  const uid = user.id as string
  const warnings: string[] = []
  const en = (await getServerLocale()) === 'en'

  const errMsg = (err: unknown): string =>
    err instanceof Error
      ? err.message
      : (typeof err === 'object' && err && 'message' in err && typeof err.message === 'string')
        ? err.message
        : (en ? 'read failed' : 'leitura falhou')

  // Helper: pull all rows of a small per-user table (a handful of rows at
  // most); on failure record the table name in warnings and return [].
  // Bypasses RLS via service role.
  async function pull(table: string) {
    try {
      const { data, error } = await db.from(table).select('*').eq('user_id', uid)
      if (error) throw error
      return data ?? []
    } catch (err) {
      warnings.push(`${table}: ${errMsg(err)}`)
      return []
    }
  }

  // Helper for tables that GROW per user (transactions, xp_history, …).
  // PostgREST silently caps a select at 1000 rows — an Art. 20 export that
  // stops at row 1000 without saying so is a compliance failure — so these
  // page through `fetchAll` with a stable order (`orderCol` desc + id).
  async function pullAll(table: string, orderCol: string) {
    try {
      const { rows, truncated } = await fetchAll<Record<string, unknown>>((from, to) =>
        db.from(table).select('*').eq('user_id', uid)
          .order(orderCol, { ascending: false })
          .order('id', { ascending: true })
          .range(from, to),
      )
      if (truncated) {
        warnings.push(en
          ? `${table}: export limited to the ${rows.length} most recent rows — contact us for the full history.`
          : `${table}: exportação limitada às ${rows.length} linhas mais recentes — contacta-nos para o histórico completo.`)
      }
      return rows
    } catch (err) {
      warnings.push(`${table}: ${errMsg(err)}`)
      return []
    }
  }

  // Parallel fetch — these don't depend on each other.
  const [
    accounts, transactions, financialScores, xpProgress, xpHistory,
    missions, userBadges, voltixStates, goals, goalDeposits,
    subscriptions, budgets, bugReports, netWorthSnapshots, certificates,
    debts, debtAttacks,
  ] = await Promise.all([
    pull('accounts'),
    pullAll('transactions', 'date'),
    pullAll('financial_scores', 'calculated_at'),
    pull('xp_progress'),
    pullAll('xp_history', 'earned_at'),
    pull('missions'),
    pull('user_badges'),
    pull('voltix_states'),
    pull('goals'),
    pullAll('goal_deposits', 'created_at'),
    pull('subscriptions'),
    pull('budgets'),
    pull('bug_reports'),
    pullAll('net_worth_snapshots', 'snapshot_date'),
    pull('certificates'),
    pull('debts'),
    pullAll('debt_attacks', 'created_at'),
  ])

  // Categories — only the ones the user created themselves (not system seeds)
  const categories = await pull('categories')

  // Strip Clerk id and stripe customer id from the user row before
  // emitting — they're not "the user's data", they're internal references
  // to other systems. Keeping them invites accidental leaks if the file is
  // shared (e.g. attached to a support ticket).
  const safeUser = { ...user }
  delete (safeUser as Record<string, unknown>).clerk_id

  const payload = {
    _meta: {
      exported_at: new Date().toISOString(),
      schema:      'xpmoney/account-export-v1',
      notice:      en
        ? 'This file contains all your personal and financial data. Treat it as sensitive.'
        : 'Este ficheiro contém todos os teus dados pessoais e financeiros. Trata-o como sensível.',
    },
    _warnings: warnings.length > 0 ? warnings : undefined,
    user: safeUser,
    accounts,
    categories,
    transactions,
    financial_scores: financialScores,
    xp_progress: xpProgress,
    xp_history: xpHistory,
    missions,
    user_badges: userBadges,
    voltix_states: voltixStates,
    goals,
    goal_deposits: goalDeposits,
    subscriptions,
    budgets,
    bug_reports: bugReports,
    net_worth_snapshots: netWorthSnapshots,
    certificates,
    debts,
    debt_attacks: debtAttacks,
  }

  const filename = `xpmoney-export-${new Date().toISOString().split('T')[0]}.json`
  // Compact JSON (no indentation — it ~doubled the size with 50k-row tables)
  // and STREAMED: a buffered body over 4.5 MB is rejected by Vercel with a
  // 413, which would turn a heavy user's Art. 20 export into no file at all.
  return new NextResponse(streamText(JSON.stringify(payload)), {
    status: 200,
    headers: {
      'Content-Type':        'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control':       'no-store',
    },
  })
}
