import { auth }                    from '@clerk/nextjs/server'
import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseClient }      from '@supabase/supabase-js'
import { createSupabaseAdmin }      from '@/lib/supabase'
import { resolveUser }              from '@/lib/resolveUser'
import { activeDaysSince }          from '@/lib/activeDays'
import { fetchAll }                 from '@/lib/fetchAll'
import { toNumber }                 from '@/lib/safeNumber'
import { isDemoMode, demoResponse } from '@/lib/demo/demoGuard'
import { guardUser }                from '@/lib/rateLimit'
import {
  isWrappedOpen, lisbonToday, wrappedYear, yearBounds,
  WRAPPED_SHORT_MIN_ACTIVE_DAYS,
  type WrappedResponse, type WrappedScore, type WrappedStats, type WrappedTopCategory,
} from '@/lib/wrapped'

/**
 * GET /api/wrapped[?preview=1] — o "O teu ano na XP Money" (Wrapped-lite).
 *
 * Aberto de 1 a 31 de dezembro (Europe/Lisbon). Fora da janela devolve
 * `{ open:false }` SEM ler a BD. `?preview=1` abre fora da janela só para o
 * ADMIN_CLERK_ID ou fora de produção (o dono testa antes de dezembro).
 *
 * Só dados SEM euros: dias ativos (ledger xp_history, nunca transactions.date),
 * maior sequência, evoluções, badges, missões e XP do ano, a categoria de
 * despesa com mais MOVIMENTOS (percentagem/contagem, nunca valores) e o score
 * (0-100) do início vs fim do ano. Uma só ronda de leituras em Promise.all;
 * cada leitura degrada para "sem dado" (warn) em vez de rebentar a página.
 */

const XP_MAX_ROWS = 20_000
const TX_MAX_ROWS = 20_000
// activeDaysSince lê no máximo 5000 rows do ledger (MAX_ROWS em
// src/lib/activeDays.ts) e não sinaliza o corte. Contamos as mesmas rows à
// parte: acima disto o número de dias pode estar subcontado.
const ACTIVE_ROWS_CAP = 5_000

type CountResult = { n: number; ok: boolean }

async function countRows(
  label: string,
  q: PromiseLike<{ count: number | null; error: { message?: string } | null }>,
): Promise<CountResult> {
  try {
    const { count, error } = await q
    if (error) {
      console.warn(`[wrapped] ${label} count failed:`, error.message ?? error)
      return { n: 0, ok: false }
    }
    return { n: count ?? 0, ok: true }
  } catch (err) {
    console.warn(`[wrapped] ${label} count threw:`, err)
    return { n: 0, ok: false }
  }
}

async function readLongestStreak(db: SupabaseClient, userId: string): Promise<{ longest: number; evo: number }> {
  const first = await db
    .from('voltix_states')
    .select('streak_days, evolution_level, longest_streak')
    .eq('user_id', userId)
    .maybeSingle()
  let row = first.data as { streak_days?: unknown; evolution_level?: unknown; longest_streak?: unknown } | null
  if (first.error) {
    // 42703 = coluna inexistente (streak_freeze_2026_07.sql por correr):
    // cai para a sequência atual, que é um mínimo honesto do recorde.
    if (first.error.code !== '42703') {
      console.warn('[wrapped] voltix_states failed:', first.error.message)
      return { longest: 0, evo: 1 }
    }
    const retry = await db
      .from('voltix_states')
      .select('streak_days, evolution_level')
      .eq('user_id', userId)
      .maybeSingle()
    if (retry.error) {
      console.warn('[wrapped] voltix_states fallback failed:', retry.error.message)
      return { longest: 0, evo: 1 }
    }
    row = retry.data as typeof row
  }
  const current = toNumber(row?.streak_days, 0)
  const longest = Math.max(current, toNumber(row?.longest_streak, 0))
  const evo     = Math.min(6, Math.max(1, Math.trunc(toNumber(row?.evolution_level, 1))))
  return { longest, evo }
}

async function readXpEarned(db: SupabaseClient, userId: string, startIso: string, endIso: string): Promise<{ xp: number; truncated: boolean }> {
  try {
    const { rows, truncated } = await fetchAll<{ amount: unknown }>((from, to) =>
      db.from('xp_history')
        .select('amount')
        .eq('user_id', userId)
        .gte('earned_at', startIso)
        .lt('earned_at', endIso)
        .order('earned_at', { ascending: false })
        .order('id')
        .range(from, to),
      { max: XP_MAX_ROWS },
    )
    if (truncated) console.warn('[wrapped] xp_history truncated at', XP_MAX_ROWS, 'rows for', userId)
    // revertXP regista deltas negativos (DELETE de transação) — a soma já os desconta.
    const xp = rows.reduce((s, r) => s + toNumber(r.amount, 0), 0)
    return { xp: Math.max(0, Math.round(xp)), truncated }
  } catch (err) {
    console.warn('[wrapped] xp sum failed:', err)
    return { xp: 0, truncated: false }
  }
}

type CatEmbed = { name?: string | null; icon?: string | null } | null

async function readTopCategory(
  db: SupabaseClient, userId: string, startDate: string, endDate: string,
): Promise<{ top: WrappedTopCategory | null; truncated: boolean }> {
  try {
    const { rows, truncated } = await fetchAll<{ category_id: string | null; categories: CatEmbed | CatEmbed[] }>((from, to) =>
      db.from('transactions')
        .select('category_id, categories(name, icon)')
        .eq('user_id', userId)
        .eq('type', 'expense')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })
        .order('id')
        .range(from, to),
      { max: TX_MAX_ROWS },
    )
    if (truncated) console.warn('[wrapped] expense rows truncated at', TX_MAX_ROWS, 'for', userId)
    if (rows.length === 0) return { top: null, truncated }

    const counts = new Map<string, { count: number; name: string; icon: string | null }>()
    for (const r of rows) {
      if (!r.category_id) continue
      const cat  = Array.isArray(r.categories) ? r.categories[0] : r.categories
      const prev = counts.get(r.category_id)
      if (prev) prev.count += 1
      else counts.set(r.category_id, { count: 1, name: cat?.name ?? '', icon: cat?.icon ?? null })
    }
    let best: { count: number; name: string; icon: string | null } | null = null
    for (const c of counts.values()) {
      if (!c.name) continue
      if (!best || c.count > best.count) best = c
    }
    if (!best) return { top: null, truncated }
    return {
      top: {
        name:  best.name,
        icon:  best.icon,
        count: best.count,
        share: Math.round((best.count / rows.length) * 100),
      },
      truncated,
    }
  } catch (err) {
    console.warn('[wrapped] top category failed:', err)
    return { top: null, truncated: false }
  }
}

async function readScoreArc(db: SupabaseClient, userId: string, startIso: string, endIso: string): Promise<WrappedScore | null> {
  const base = () => db
    .from('financial_scores')
    .select('id, score, calculated_at')
    .eq('user_id', userId)
    .gte('calculated_at', startIso)
    .lt('calculated_at', endIso)
  const [firstRes, lastRes] = await Promise.all([
    base().order('calculated_at', { ascending: true }).limit(1).maybeSingle(),
    base().order('calculated_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  if (firstRes.error || lastRes.error) {
    console.warn('[wrapped] score arc failed:', firstRes.error?.message ?? lastRes.error?.message)
    return null
  }
  const first = firstRes.data as { id: string; score: unknown; calculated_at: string } | null
  const last  = lastRes.data  as { id: string; score: unknown; calculated_at: string } | null
  // Um só score no ano não é um "antes e depois" — omite.
  if (!first || !last || first.id === last.id) return null
  const d = new Date(first.calculated_at)
  if (Number.isNaN(d.getTime())) return null
  const ld = lisbonToday(d)
  return {
    fromMonth: `${ld.year}-${String(ld.month).padStart(2, '0')}`,
    from:      Math.round(toNumber(first.score, 0)),
    to:        Math.round(toNumber(last.score, 0)),
  }
}

async function readGender(db: SupabaseClient, userId: string): Promise<'voltix' | 'penny' | null> {
  const { data, error } = await db.from('users').select('mascot_gender').eq('id', userId).maybeSingle()
  if (error) {
    console.warn('[wrapped] mascot_gender failed:', error.message)
    return null
  }
  const raw = (data as { mascot_gender?: unknown } | null)?.mascot_gender
  return raw === 'penny' || raw === 'voltix' ? raw : null
}

function demoStats(): WrappedStats {
  return {
    activeDays: 142, transactions: 611, longestStreak: 34, evolutions: 3,
    badges: 9, missions: 21, xp: 18_450,
    topCategory: { name: 'Alimentação', icon: '🛒', share: 31, count: 189 },
    score: { fromMonth: `${wrappedYear()}-01`, from: 22, to: 64 },
    mascotGender: null, evolutionLevel: 4, depth: 'full', truncated: false,
  }
}

export async function GET(req: NextRequest) {
  const now  = new Date()
  const year = wrappedYear(now)
  const wantsPreview = req.nextUrl.searchParams.get('preview') === '1'

  if (isDemoMode()) {
    const body: WrappedResponse = { open: true, preview: !isWrappedOpen(now), year, stats: demoStats() }
    return demoResponse(body)
  }

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 })

  const adminId      = process.env.ADMIN_CLERK_ID
  const canPreview   = process.env.NODE_ENV !== 'production' || (!!adminId && userId === adminId)
  const open         = isWrappedOpen(now)
  const preview      = !open && wantsPreview && canPreview

  if (!open && !preview) {
    const body: WrappedResponse = { open: false, preview: false, year }
    return NextResponse.json({ data: body, error: null })
  }

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ data: null, error: 'User not found' }, { status: 404 })

  // Dezembro faz ~14 leituras (paginadas) por GET: o React Query do cliente
  // cacheia, mas um curl em loop martelava o Supabase.
  const limited = await guardUser(internalId, 'wrapped', [
    { limit: 30, windowMs: 60 * 60 * 1000 },
  ], { data: null, error: 'Too many requests', code: 'rate_limit' })
  if (limited) return limited

  const db = createSupabaseAdmin()
  const { startIso, endIso, startDate, endDate } = yearBounds(year)

  const [
    activeDaysRaw, activeRows, loginDays, streak, evolutions, missions, badges, txCount, xp, top, score, gender,
  ] = await Promise.all([
    activeDaysSince(db, internalId, { since: startIso }),
    countRows('active rows', db.from('xp_history')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', internalId)
      .in('reason', ['daily_login', 'transaction_registered'])
      .gte('earned_at', startIso).lt('earned_at', endIso)),
    // daily_login é pago no máximo 1×/dia → piso honesto quando o ledger é
    // grande demais para o activeDaysSince o ler todo.
    countRows('login days', db.from('xp_history')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', internalId)
      .eq('reason', 'daily_login')
      .gte('earned_at', startIso).lt('earned_at', endIso)),
    readLongestStreak(db, internalId).catch(err => {
      console.warn('[wrapped] voltix_states threw:', err)
      return { longest: 0, evo: 1 }
    }),
    countRows('evolutions', db.from('xp_history')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', internalId)
      .like('reason', 'mascot_evolved_to_%')
      .gte('earned_at', startIso).lt('earned_at', endIso)),
    countRows('missions', db.from('xp_history')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', internalId)
      .like('reason', 'mission_completed:%')
      .gte('earned_at', startIso).lt('earned_at', endIso)),
    countRows('badges', db.from('user_badges')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', internalId)
      .gte('earned_at', startIso).lt('earned_at', endIso)),
    countRows('transactions', db.from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', internalId)
      .gte('date', startDate).lte('date', endDate)),
    readXpEarned(db, internalId, startIso, endIso),
    readTopCategory(db, internalId, startDate, endDate),
    readScoreArc(db, internalId, startIso, endIso).catch(err => {
      console.warn('[wrapped] score arc threw:', err)
      return null
    }),
    readGender(db, internalId).catch(err => {
      console.warn('[wrapped] gender threw:', err)
      return null
    }),
  ])

  const activeCapped = activeRows.ok && activeRows.n > ACTIVE_ROWS_CAP
  if (activeCapped) console.warn('[wrapped] active-days ledger above', ACTIVE_ROWS_CAP, 'rows for', internalId)
  const activeDays = activeCapped ? Math.max(activeDaysRaw, loginDays.n) : activeDaysRaw

  const stats: WrappedStats = {
    activeDays,
    transactions:   txCount.n,
    longestStreak:  streak.longest,
    evolutions:     evolutions.n,
    badges:         badges.n,
    missions:       missions.n,
    xp:             xp.xp,
    topCategory:    top.top,
    score,
    mascotGender:   gender,
    evolutionLevel: streak.evo,
    depth:          activeDays < WRAPPED_SHORT_MIN_ACTIVE_DAYS ? 'short' : 'full',
    truncated:      xp.truncated || top.truncated || activeCapped,
  }

  const body: WrappedResponse = { open: true, preview, year, stats }
  return NextResponse.json({ data: body, error: null })
}
