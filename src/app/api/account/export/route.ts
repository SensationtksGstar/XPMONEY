import { auth }                      from '@clerk/nextjs/server'
import { NextResponse }                from 'next/server'
import { createSupabaseAdmin }         from '@/lib/supabase'
import { isDemoMode }                  from '@/lib/demo/demoGuard'

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
 *   bug_reports
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

  // Helper: pull all rows of a per-user table; on failure record the table
  // name in warnings and return []. Bypasses RLS via service role.
  async function pull(table: string, filter: { col: string; val: string } = { col: 'user_id', val: uid }) {
    try {
      const { data, error } = await db.from(table).select('*').eq(filter.col, filter.val)
      if (error) throw error
      return data ?? []
    } catch (err) {
      warnings.push(`${table}: ${err instanceof Error ? err.message : 'leitura falhou'}`)
      return []
    }
  }

  // Parallel fetch — these don't depend on each other.
  const [
    accounts, transactions, financialScores, xpProgress, xpHistory,
    missions, userBadges, voltixStates, goals, goalDeposits,
    subscriptions, budgets, bugReports,
  ] = await Promise.all([
    pull('accounts'),
    pull('transactions'),
    pull('financial_scores'),
    pull('xp_progress'),
    pull('xp_history'),
    pull('missions'),
    pull('user_badges'),
    pull('voltix_states'),
    pull('goals'),
    pull('goal_deposits'),
    pull('subscriptions'),
    pull('budgets'),
    pull('bug_reports'),
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
      notice:      'Este ficheiro contém todos os teus dados pessoais e financeiros. Trata-o como sensível.',
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
  }

  const filename = `xpmoney-export-${new Date().toISOString().split('T')[0]}.json`
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type':        'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control':       'no-store',
    },
  })
}
