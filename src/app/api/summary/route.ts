import { auth }                      from '@clerk/nextjs/server'
import { NextRequest, NextResponse }   from 'next/server'
import { createSupabaseAdmin }         from '@/lib/supabase'
import { resolveUser }                 from '@/lib/resolveUser'
import { toNumber }                    from '@/lib/safeNumber'
import { isDemoMode, demoResponse }    from '@/lib/demo/demoGuard'

export interface MonthlySummaryData {
  income:       number
  expense:      number
  savings:      number
  rate:         number   // savings / income * 100
  month:        string   // YYYY-MM — mês REALMENTE apresentado (legacy field; "range" mode emits 'range')
  currentMonth: string   // YYYY-MM — mês real do calendário (hoje)
  /**
   * Period actually resolved. Useful when the client sends `period=last-3m`
   * shorthand and wants to know the concrete from/to it landed on.
   */
  period: {
    from:  string   // YYYY-MM-DD (inclusive)
    to:    string   // YYYY-MM-DD (exclusive)
    label: string   // human-friendly e.g. "Últimos 3 meses", "Março 2026"
  }
  /**
   * Income / expense / savings for the SAME-DURATION window IMMEDIATELY
   * BEFORE `period`. Used by the dashboard "vs período anterior" delta.
   * null when there's no prior data to compare against.
   */
  compareToPrev: null | {
    income:    number
    expense:   number
    savings:   number
    incomePct:  number  // (this - prev) / prev * 100; clamped to ±999
    expensePct: number
    savingsPct: number
  }
  /**
   * true quando o user pediu o mês corrente mas ele estava vazio e caímos
   * automaticamente para o último mês com dados. UI mostra banner
   * "A mostrar Março — Abril ainda não tem movimentos registados".
   */
  fallbackUsed: boolean
  /**
   * Top 6 categorias de despesa ordenadas por valor descendente.
   * Adicionado para o widget ExpenseBreakdown no dashboard.
   */
  top_categories: Array<{
    name:   string
    icon:   string | null
    total:  number
    pct:    number  // % do total de despesas
  }>
  /**
   * Top 5 despesas INDIVIDUAIS (transação a transação) por valor descendente.
   * Complementa o top_categories: o breakdown por categoria dilui uma compra
   * única grande (ex.: €400 numa categoria de €600), este campo expõe-a.
   * Alimenta o widget BiggestExpenses no dashboard.
   */
  top_expenses: Array<{
    id:          string
    description: string | null
    icon:        string | null
    category:    string | null
    date:        string   // YYYY-MM-DD
    amount:      number
  }>
}

// Helper — builds "YYYY-MM" for the given Date in local time
function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

/**
 * Calcula os limites ISO ("YYYY-MM-01" … "YYYY-MM+1-01") para um YYYY-MM.
 */
function monthBoundaries(ym: string): { start: string; end: string } {
  const [y, m] = ym.split('-').map(Number)
  const start = `${ym}-01`
  const end   = new Date(y, m, 1).toISOString().split('T')[0]
  return { start, end }
}

/**
 * Resolves the URL query params into a concrete period window. Priority:
 *   1. ?from=YYYY-MM-DD&to=YYYY-MM-DD   (explicit custom range)
 *   2. ?period=<shortcut>                (this-month, last-month, last-3m,
 *                                         last-6m, last-12m, ytd, all)
 *   3. ?month=YYYY-MM | all              (legacy — existing month picker)
 *   4. default: current month            (falls back to "last month with
 *                                         data" if current is empty — see
 *                                         caller for that branch)
 *
 * Returns null when the input is "all" (no bounded window — caller skips
 * range queries and compareToPrev).
 */
type PeriodResolution =
  | { kind: 'all';   from: null; to: null; label: string }
  | { kind: 'range'; from: string; to: string; label: string }

function resolvePeriod(req: NextRequest, now: Date): PeriodResolution {
  const sp = new URL(req.url).searchParams
  const from = sp.get('from')
  const to   = sp.get('to')
  const period = sp.get('period')
  const month  = sp.get('month')

  // 1. Explicit custom range
  if (from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return { kind: 'range', from, to, label: `${from} → ${to}` }
  }

  // 2. Shortcut
  if (period) {
    const today = isoDate(now)
    const days = (n: number) => isoDate(new Date(now.getTime() - n * 86_400_000))
    if (period === 'all')        return { kind: 'all',   from: null, to: null, label: 'Tudo' }
    if (period === 'this-month') {
      const { start, end } = monthBoundaries(monthKey(now))
      return { kind: 'range', from: start, to: end, label: 'Este mês' }
    }
    if (period === 'last-month') {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const { start, end } = monthBoundaries(monthKey(prev))
      return { kind: 'range', from: start, to: end, label: 'Mês anterior' }
    }
    if (period === 'last-3m')  return { kind: 'range', from: days(90),  to: today, label: 'Últimos 3 meses' }
    if (period === 'last-6m')  return { kind: 'range', from: days(180), to: today, label: 'Últimos 6 meses' }
    if (period === 'last-12m') return { kind: 'range', from: days(365), to: today, label: 'Últimos 12 meses' }
    if (period === 'ytd') {
      return { kind: 'range', from: `${now.getFullYear()}-01-01`, to: today, label: 'Ano até hoje' }
    }
    // Unrecognised period → fall through to default below.
  }

  // 3. Legacy ?month=
  if (month === 'all') return { kind: 'all', from: null, to: null, label: 'Tudo' }
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const { start, end } = monthBoundaries(month)
    return { kind: 'range', from: start, to: end, label: month }
  }

  // 4. Default: current month (caller handles empty-month fallback)
  const { start, end } = monthBoundaries(monthKey(now))
  return { kind: 'range', from: start, to: end, label: 'Este mês' }
}

export async function GET(req: NextRequest) {
  // Dates MUST be computed per-request. When they were module-scoped, a
  // serverless cold-start that happened on April 30 would keep returning
  // April data until the function was redeployed or cycled.
  const now          = new Date()
  const currentMonth = monthKey(now)
  const resolved     = resolvePeriod(req, now)

  if (isDemoMode()) {
    const DEMO_SUMMARY: MonthlySummaryData = {
      income:       1850,
      expense:      947.99,
      savings:      902.01,
      rate:         48.8,
      month:        currentMonth,
      currentMonth,
      period: {
        from:  resolved.kind === 'range' ? resolved.from : '',
        to:    resolved.kind === 'range' ? resolved.to   : '',
        label: resolved.label,
      },
      compareToPrev: {
        income:     1700,
        expense:    920,
        savings:    780,
        incomePct:  +8.8,
        expensePct: +3.0,
        savingsPct: +15.6,
      },
      fallbackUsed: false,
      top_categories: [
        { name: 'Alimentação',  icon: '🍽️', total: 345.40, pct: 36.4 },
        { name: 'Transportes',  icon: '🚗', total: 182.50, pct: 19.3 },
        { name: 'Lazer',        icon: '🎉', total: 156.20, pct: 16.5 },
        { name: 'Casa',         icon: '🏠', total: 140.00, pct: 14.8 },
        { name: 'Saúde',        icon: '💊', total:  85.90, pct:  9.1 },
        { name: 'Outros',       icon: '📎', total:  37.99, pct:  4.0 },
      ],
      top_expenses: [
        { id: 'demo-1', description: 'Renda',         icon: '🏠', category: 'Casa',        date: `${currentMonth}-03`, amount: 120.00 },
        { id: 'demo-2', description: 'Supermercado',  icon: '🍽️', category: 'Alimentação', date: `${currentMonth}-12`, amount:  98.40 },
        { id: 'demo-3', description: 'Gasolina',      icon: '🚗', category: 'Transportes', date: `${currentMonth}-08`, amount:  72.50 },
        { id: 'demo-4', description: 'Jantar fora',   icon: '🎉', category: 'Lazer',       date: `${currentMonth}-19`, amount:  64.20 },
        { id: 'demo-5', description: 'Farmácia',      icon: '💊', category: 'Saúde',       date: `${currentMonth}-22`, amount:  45.90 },
      ],
    }
    return demoResponse(DEMO_SUMMARY)
  }

  // ── Auth ──
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const db = createSupabaseAdmin()

  /**
   * Empty-current-month fallback (kept from v1):
   *   - Only applies when the caller did NOT specify a window (no `from`/
   *     `to`/`period`/`month`) AND the default window (current month) is
   *     empty AND there are older transactions. We then SHIFT the window
   *     to the user's most-recent month so the dashboard doesn't read
   *     "0 €" mid-month before they've imported.
   *   - Suppressed when the user explicitly asks for a window — that
   *     intent must be respected even if empty.
   */
  let window: { from: string | null; to: string | null; label: string } =
    resolved.kind === 'all'
      ? { from: null, to: null, label: resolved.label }
      : { from: resolved.from, to: resolved.to, label: resolved.label }

  const sp = new URL(req.url).searchParams
  const callerExplicit =
    sp.has('from') || sp.has('to') || sp.has('period') || sp.has('month')
  let fallbackUsed = false

  if (!callerExplicit && window.from && window.to) {
    const { count } = await db
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', internalId)
      .gte('date', window.from)
      .lt('date',  window.to)

    if ((count ?? 0) === 0) {
      const { data: latest } = await db
        .from('transactions')
        .select('date')
        .eq('user_id', internalId)
        .order('date', { ascending: false })
        .limit(1)

      if (latest && latest.length > 0) {
        const latestMonth = (latest[0].date as string).slice(0, 7)
        if (latestMonth !== currentMonth) {
          const { start, end } = monthBoundaries(latestMonth)
          window = { from: start, to: end, label: latestMonth }
          fallbackUsed = true
        }
      }
    }
  }

  const isAll = window.from == null

  // Build query — for "all", no date filter. Otherwise filter on the
  // resolved window.
  let queryBuilder = db
    .from('transactions')
    .select('id, description, date, amount, type, category:category_id(name, icon)')
    .eq('user_id', internalId)

  if (!isAll) {
    queryBuilder = queryBuilder.gte('date', window.from!).lt('date', window.to!)
  }

  const { data, error } = await queryBuilder

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Supabase returns numeric columns as strings — always wrap in toNumber().
  // Como o join de `category:category_id(...)` é tipado como array pelo
  // PostgREST JS client mesmo sendo 1-to-1, precisamos de normalizar.
  type RawRow = {
    id:          string
    description: string | null
    date:        string
    amount: unknown
    type:   'income' | 'expense'
    category: { name: string | null; icon: string | null } | Array<{ name: string | null; icon: string | null }> | null
  }
  type Row = {
    id:          string
    description: string | null
    date:        string
    amount: unknown
    type:   'income' | 'expense'
    category: { name: string | null; icon: string | null } | null
  }
  const rows: Row[] = ((data ?? []) as unknown as RawRow[]).map(r => ({
    id:          r.id,
    description: r.description,
    date:        r.date,
    amount: r.amount,
    type:   r.type,
    category: Array.isArray(r.category) ? (r.category[0] ?? null) : r.category,
  }))
  const income  = rows
    .filter(r => r.type === 'income')
    .reduce((s, r) => s + toNumber(r.amount), 0)
  const expense = rows
    .filter(r => r.type === 'expense')
    .reduce((s, r) => s + toNumber(r.amount), 0)
  const savings = income - expense
  const rate    = income > 0 ? (savings / income) * 100 : 0

  // Breakdown por categoria — só despesas
  const byCategory = new Map<string, { icon: string | null; total: number }>()
  for (const r of rows) {
    if (r.type !== 'expense') continue
    const name = r.category?.name ?? 'Sem categoria'
    const icon = r.category?.icon ?? null
    const existing = byCategory.get(name)
    const amount = toNumber(r.amount)
    if (existing) {
      existing.total += amount
    } else {
      byCategory.set(name, { icon, total: amount })
    }
  }
  const top_categories = Array.from(byCategory.entries())
    .map(([name, v]) => ({
      name,
      icon:  v.icon,
      total: v.total,
      pct:   expense > 0 ? (v.total / expense) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)

  // Top 5 despesas individuais por valor — expõe a compra única grande que
  // o breakdown por categoria dilui. Reutiliza as mesmas `rows` já carregadas.
  const top_expenses = rows
    .filter(r => r.type === 'expense')
    .map(r => ({
      id:          r.id,
      description: r.description,
      icon:        r.category?.icon ?? null,
      category:    r.category?.name ?? null,
      date:        r.date,
      amount:      toNumber(r.amount),
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)

  // ── Compare-to-prev: same-duration window immediately before this one.
  // Only computed for bounded ranges (not for "all"). Cheap: one extra
  // sum query for the prior window, totals only (no category breakdown).
  let compareToPrev: MonthlySummaryData['compareToPrev'] = null
  if (!isAll && window.from && window.to) {
    const fromMs = Date.parse(window.from)
    const toMs   = Date.parse(window.to)
    const durMs  = toMs - fromMs
    if (Number.isFinite(durMs) && durMs > 0) {
      const prevFrom = isoDate(new Date(fromMs - durMs))
      const prevTo   = window.from   // exclusive end = start of current
      const { data: prevRows } = await db
        .from('transactions')
        .select('amount, type')
        .eq('user_id', internalId)
        .gte('date', prevFrom)
        .lt('date',  prevTo)
      const pl = (prevRows ?? []) as Array<{ amount: unknown; type: 'income' | 'expense' }>
      const pIn  = pl.filter(r => r.type === 'income').reduce((s, r) => s + toNumber(r.amount), 0)
      const pEx  = pl.filter(r => r.type === 'expense').reduce((s, r) => s + toNumber(r.amount), 0)
      const pSav = pIn - pEx
      // Clamp the % delta to ±999 so a 0→X spike doesn't blow the UI.
      const pct = (curr: number, prev: number): number => {
        if (prev === 0) return curr === 0 ? 0 : 999
        const v = ((curr - prev) / Math.abs(prev)) * 100
        return Math.max(-999, Math.min(999, Math.round(v * 10) / 10))
      }
      // Only emit the comparison when we actually have prior data — a
      // first-month user has prev = 0 across the board, and the +999 %
      // delta would be both wrong and depressing.
      if (pl.length > 0) {
        compareToPrev = {
          income:     pIn,
          expense:    pEx,
          savings:    pSav,
          incomePct:  pct(income,  pIn),
          expensePct: pct(expense, pEx),
          savingsPct: pct(savings, pSav),
        }
      }
    }
  }

  const summary: MonthlySummaryData = {
    income,
    expense,
    savings,
    rate,
    month: isAll ? 'all' : (window.from?.slice(0, 7) ?? 'all'),
    currentMonth,
    period: {
      from:  window.from ?? '',
      to:    window.to   ?? '',
      label: window.label,
    },
    compareToPrev,
    fallbackUsed: !isAll && fallbackUsed,
    top_categories,
    top_expenses,
  }
  return NextResponse.json({ data: summary })
}
