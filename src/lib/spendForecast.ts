import { categoryToBucket, type Budget, type BudgetBucket, type OverridesMap } from '@/lib/budget'
import { normalizeDescription } from '@/lib/normalizeDescription'

/**
 * spendForecast — deterministic end-of-month spend forecast (Premium).
 *
 * Pure math, zero IO: the API route fetches rows and calls
 * `buildSpendForecast`; this file is unit-testable in isolation.
 *
 * Method (designed July 2026 by the UX+data specialist panel):
 *   - Baseline B: recency-weighted (0.8^i) average of the last ≤6 usable
 *     full months (usable = ≥3 expense tx), winsorized to [0.5·med, 2·med]
 *     when K ≥ 3 so one outlier month can't hijack the average.
 *   - Pace P: current spend divided by the user's OWN day-of-month spend
 *     profile φ(d) (learned from history) instead of naive linear d/D —
 *     this is the salary-day fix: someone who pays rent on day 1 is not
 *     "on pace to spend 30× rent".
 *   - Blend: F_raw = α·P + (1−α)·B with α = clamp(d/D, 0.10, 0.90) — early
 *     in the month trust history, late in the month trust reality.
 *   - Recurring floor: deterministic recurring detection (same category +
 *     normalized description in ≥2 of the last 3 usable months, stable
 *     amount) adds not-yet-paid recurring charges: F = max(F_raw, S+R, S).
 *   - Confidence from history depth + stability (CV) + month progress,
 *     mapped to low/medium/high; the range is remainder-only (what's
 *     already spent is certain).
 *
 * Semantics: GROSS spend. `transactions.amount` is CHECK (> 0) and refunds
 * enter as `income`, so summing `type='expense'` matches /api/summary and
 * /api/budget/status. Transfers are excluded at the query level.
 *
 * All output numbers are exact — display rounding (~€5, no cents) is the
 * widget's job, so the API stays language- and presentation-neutral.
 */

export const FORECAST_PARAMS = {
  maxHistoryMonths: 6,
  minUsableTxPerMonth: 3,
  decay: 0.8,
  winsor: [0.5, 2.0] as const,
  alphaClamp: [0.10, 0.90] as const,
  phiFloorFactor: 0.6,
  phiMin: 0.04,
  recurring: { minHits: 2, lookback: 3, amountCvMax: 0.25, matchTolerance: 0.30, graceDays: 3 },
  confidence: { wDepth: 0.45, wStability: 0.35, wProgress: 0.20, high: 0.65, medium: 0.40 },
  sigmaMin: 0.08,
  sigmaNoHistory: 0.35,
  topN: 8,
  minCategoryForecast: 5,
} as const

// ── Types ────────────────────────────────────────────────────────────────────

export interface TxRow {
  /** YYYY-MM-DD */
  date:         string
  amount:       number
  categoryId:   string | null
  categoryName: string | null
  categoryIcon: string | null
  description:  string
}

export type ConfidenceLevel = 'low' | 'medium' | 'high'

export interface InsufficientHistory {
  status: 'insufficient_history'
  daysObserved:     number
  txThisMonth:      number
  usableFullMonths: number
  /** YYYY-MM-DD — 1st of next month, when the first full month completes. */
  activatesOn: string
  required: { minFullMonths: 1 } | { minDays: 5; minTxThisMonth: 5 }
}

export interface SpendForecast {
  status: 'ok'
  month:        string   // YYYY-MM
  daysElapsed:  number
  daysInMonth:  number
  spentSoFar:   number   // S
  total: {
    forecast: number
    low:      number
    high:     number
    confidence: ConfidenceLevel
    baseline: number | null   // B (null when K = 0)
    pace:     number
    blendAlpha: number
    usableMonths: number
    recurringPending: Array<{
      description: string; categoryName: string | null; amount: number; expectedDay: number
    }>
  }
  categories: Array<{
    categoryId: string | null
    name:       string | null
    icon:       string | null
    spentSoFar: number
    forecast:   number
    confidence: ConfidenceLevel
    bucket:     BudgetBucket | null
  }>
  budget: null | {
    monthlyIncome: number
    buckets: Array<{
      bucket:      BudgetBucket
      limit:       number
      spentSoFar:  number
      forecast:    number
      forecastPct: number
      severity:    'on_track' | 'risk' | 'over'
      breachDate:  string | null   // YYYY-MM-DD
      alreadyOver: boolean
    }>
  }
}

export type SpendForecastResult = SpendForecast | InsufficientHistory

// ── Display helper (client-side) ─────────────────────────────────────────────

/**
 * Forecast display formatter: nearest €5, no cents, `~` prefix — false
 * precision is visual dishonesty. The single source of the `~` so i18n keys
 * never carry it.
 */
export function approxEur(v: number, locale: string): string {
  const rounded = Math.round(v / 5) * 5
  const intl = locale === 'en' ? 'en-US' : 'pt-PT'
  return '~' + new Intl.NumberFormat(intl, {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(rounded)
}

// ── Small helpers ────────────────────────────────────────────────────────────

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
}

function popStd(xs: number[]): number {
  if (xs.length < 2) return 0
  const m = mean(xs)
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length)
}

function daysIn(year: number, monthIdx0: number): number {
  return new Date(year, monthIdx0 + 1, 0).getDate()
}

function monthKeyOf(year: number, monthIdx0: number): string {
  return `${year}-${String(monthIdx0 + 1).padStart(2, '0')}`
}

// ── Month aggregation ────────────────────────────────────────────────────────

interface MonthAgg {
  month:    string
  total:    number
  txCount:  number
  daysInMonth: number
  /** cumByDay[d] = spend through day d (1-indexed; index 0 unused). */
  cumByDay: number[]
  /** per-category totals for the month */
  byCategory: Map<string, number>
}

interface CatMeta { name: string | null; icon: string | null }

function catKey(categoryId: string | null): string {
  return categoryId ?? '∅'
}

function aggregateMonths(rows: TxRow[]): {
  byMonth: Map<string, MonthAgg>
  catMeta: Map<string, CatMeta>
} {
  const byMonth = new Map<string, MonthAgg>()
  const catMeta = new Map<string, CatMeta>()

  for (const r of rows) {
    const month = r.date.slice(0, 7)
    const day   = Number(r.date.slice(8, 10)) || 1
    let agg = byMonth.get(month)
    if (!agg) {
      const y = Number(month.slice(0, 4))
      const m = Number(month.slice(5, 7)) - 1
      const dim = daysIn(y, m)
      agg = {
        month, total: 0, txCount: 0, daysInMonth: dim,
        cumByDay: new Array(dim + 1).fill(0),
        byCategory: new Map(),
      }
      byMonth.set(month, agg)
    }
    agg.total   += r.amount
    agg.txCount += 1
    const d = Math.min(day, agg.daysInMonth)
    agg.cumByDay[d] += r.amount
    const ck = catKey(r.categoryId)
    agg.byCategory.set(ck, (agg.byCategory.get(ck) ?? 0) + r.amount)
    if (!catMeta.has(ck)) catMeta.set(ck, { name: r.categoryName, icon: r.categoryIcon })
  }

  // Turn per-day sums into cumulative sums.
  for (const agg of byMonth.values()) {
    for (let d = 1; d <= agg.daysInMonth; d++) {
      agg.cumByDay[d] += agg.cumByDay[d - 1]
    }
  }

  return { byMonth, catMeta }
}

// ── Recurring detection ──────────────────────────────────────────────────────

interface RecurringItem {
  key:          string
  description:  string
  categoryId:   string | null
  categoryName: string | null
  amount:       number   // median monthly amount M
  expectedDay:  number   // median first-seen day d̄
}

function detectRecurring(
  rows: TxRow[],
  usableMonths: string[],   // most-recent-first
): RecurringItem[] {
  const P = FORECAST_PARAMS.recurring
  const lookback = usableMonths.slice(0, Math.min(usableMonths.length, P.lookback))
  if (lookback.length < P.minHits) return []
  const lookSet = new Set(lookback)

  // key → month → { amount, firstDay }
  const byKey = new Map<string, Map<string, { amount: number; firstDay: number }>>()
  const meta  = new Map<string, { description: string; categoryId: string | null; categoryName: string | null }>()

  for (const r of rows) {
    const month = r.date.slice(0, 7)
    if (!lookSet.has(month)) continue
    const key = `${catKey(r.categoryId)}|${normalizeDescription(r.description || '')}`
    if (!byKey.has(key)) byKey.set(key, new Map())
    const months = byKey.get(key)!
    const day = Number(r.date.slice(8, 10)) || 1
    const cur = months.get(month)
    if (cur) {
      cur.amount += r.amount
      cur.firstDay = Math.min(cur.firstDay, day)
    } else {
      months.set(month, { amount: r.amount, firstDay: day })
      if (!meta.has(key)) meta.set(key, {
        description: r.description, categoryId: r.categoryId, categoryName: r.categoryName,
      })
    }
  }

  const out: RecurringItem[] = []
  for (const [key, months] of byKey) {
    // Blank normalized descriptions ("", after stripping refs/amounts) would
    // collapse a whole category into one pseudo-recurring aggregate — skip.
    if (key.endsWith('|')) continue
    if (months.size < P.minHits) continue
    const amounts = [...months.values()].map(v => v.amount)
    const m = mean(amounts)
    if (m <= 0) continue
    const cv = popStd(amounts) / m
    if (cv > P.amountCvMax) continue
    const days = [...months.values()].map(v => v.firstDay)
    const info = meta.get(key)!
    out.push({
      key,
      description:  info.description,
      categoryId:   info.categoryId,
      categoryName: info.categoryName,
      amount:       median(amounts),
      expectedDay:  Math.round(median(days)),
    })
  }
  return out
}

// ── Main entry ───────────────────────────────────────────────────────────────

export function buildSpendForecast(
  rows: TxRow[],
  budget: Budget | null,
  overrides: OverridesMap,
  now: Date,
): SpendForecastResult {
  const P = FORECAST_PARAMS
  const y = now.getFullYear()
  const m = now.getMonth()
  const D = daysIn(y, m)
  const d = Math.min(now.getDate(), D)
  const p = d / D
  const currentKey = monthKeyOf(y, m)

  const { byMonth, catMeta } = aggregateMonths(rows)
  const current = byMonth.get(currentKey)
  const S = current?.total ?? 0
  const txThisMonth = current?.txCount ?? 0

  // History = the ≤6 full months before the current one, most-recent-first.
  const historyKeys: string[] = []
  for (let i = 1; i <= P.maxHistoryMonths; i++) {
    const dt = new Date(y, m - i, 1)
    historyKeys.push(monthKeyOf(dt.getFullYear(), dt.getMonth()))
  }
  const usable = historyKeys
    .map(k => byMonth.get(k))
    .filter((a): a is MonthAgg => !!a && a.txCount >= P.minUsableTxPerMonth)
  const K = usable.length

  // ── Minimum-history gate ──
  if (!(K >= 1 || (d >= 5 && txThisMonth >= 5))) {
    // activatesOn must reflect the NEAREST unlock path, not always next
    // month: with 5+ tx already logged and only the 5-day minimum missing,
    // the forecast opens on day 5 of THIS month.
    const next = new Date(y, m + 1, 1)
    const nextMonthFirst = `${monthKeyOf(next.getFullYear(), next.getMonth())}-01`
    const unlocksThisMonth = txThisMonth >= 5 && d < 5
    return {
      status: 'insufficient_history',
      daysObserved: d,
      txThisMonth,
      usableFullMonths: K,
      activatesOn: unlocksThisMonth ? `${currentKey}-05` : nextMonthFirst,
      required: unlocksThisMonth || d >= 5
        ? { minDays: 5, minTxThisMonth: 5 }
        : { minFullMonths: 1 },
    }
  }

  // ── Baseline B (winsorized when K ≥ 3) ──
  const totalsRaw = usable.map(a => a.total)
  let totals = totalsRaw
  if (K >= 3) {
    const med = median(totalsRaw)
    totals = totalsRaw.map(t => clamp(t, P.winsor[0] * med, P.winsor[1] * med))
  }
  const weights = usable.map((_, i) => Math.pow(P.decay, i))
  const wSum = weights.reduce((a, b) => a + b, 0)
  const B = K >= 1 ? totals.reduce((s, t, i) => s + t * weights[i], 0) / wSum : null

  // ── Day-of-month spend profile φ ──
  // φ(x) = weighted avg of each usable month's cumulative share through day x.
  const profileMonths = usable.filter(a => a.total > 0)
  const phi = (x: number): number => {
    if (profileMonths.length === 0) return x / D
    let num = 0, den = 0
    for (let i = 0; i < usable.length; i++) {
      const a = usable[i]
      if (a.total <= 0) continue
      const w = weights[i]
      num += w * (a.cumByDay[Math.min(x, a.daysInMonth)] / a.total)
      den += w
    }
    return den > 0 ? num / den : x / D
  }
  const phiClamped = (x: number): number =>
    Math.min(1, Math.max(phi(x), P.phiFloorFactor * (x / D), P.phiMin))
  const phiD = K >= 1 ? phiClamped(d) : Math.max(p, P.phiMin)

  // ── Pace + blend ──
  const Pace = S > 0 ? S / phiD : (B ?? 0)
  const alpha = K >= 1 ? clamp(p, P.alphaClamp[0], P.alphaClamp[1]) : 1
  const Fraw = alpha * Pace + (1 - alpha) * (B ?? Pace)

  // ── Recurring floor ──
  const usableKeys = usable.map(a => a.month)
  const recurring = detectRecurring(rows, usableKeys)
  const currentByKey = new Map<string, number>()
  if (current) {
    for (const r of rows) {
      if (r.date.slice(0, 7) !== currentKey) continue
      const key = `${catKey(r.categoryId)}|${normalizeDescription(r.description || '')}`
      currentByKey.set(key, (currentByKey.get(key) ?? 0) + r.amount)
    }
  }
  // Pending = the REMAINING amount of each recurring item: max(0, M − paid
  // so far this month on the same key). A two-sided "seen" tolerance would
  // double-count over- or partially-paid items (the payment is already
  // inside S, yet the full median would re-enter via the floor).
  const pending = recurring
    .map(item => ({
      ...item,
      remaining: Math.max(0, item.amount - (currentByKey.get(item.key) ?? 0)),
    }))
    .filter(item =>
      item.remaining > 0 &&
      // >graceDays overdue → assume cancelled.
      item.expectedDay >= d - P.recurring.graceDays,
    )
  const R = pending.reduce((s, it) => s + it.remaining, 0)

  const F = Math.max(Fraw, S + R, S)

  // ── Confidence + range ──
  const CVeff = K >= 2 ? popStd(totals) / (mean(totals) || 1) : 0.35
  const conf =
    P.confidence.wDepth * (Math.min(K, 6) / 6) +
    P.confidence.wStability * (1 - Math.min(CVeff, 1)) +
    P.confidence.wProgress * p
  const confidence: ConfidenceLevel =
    conf >= P.confidence.high && K >= 3 ? 'high'
    : conf >= P.confidence.medium && K >= 1 ? 'medium'
    : 'low'

  const sigma = K === 0 ? P.sigmaNoHistory : Math.max(P.sigmaMin, CVeff)
  const low  = Math.max(S, S + (F - S) * (1 - sigma))
  const high = S + (F - S) * (1 + sigma)

  // ── Per-category forecasts ──
  interface CatWork {
    id: string; spent: number; forecast: number; Kc: number; conf: ConfidenceLevel
  }
  const allCatIds = new Set<string>()
  for (const a of usable) for (const k of a.byCategory.keys()) allCatIds.add(k)
  if (current) for (const k of current.byCategory.keys()) allCatIds.add(k)

  const catWork: CatWork[] = []
  for (const id of allCatIds) {
    const Sc = current?.byCategory.get(id) ?? 0
    // Zero-INCLUSIVE history: a month where the category is absent is a real
    // €0 data point. Filtering absences out made a quarterly €300 insurance
    // look like €300/month (its "average" ignored the two €0 months) —
    // sporadic expenses must dilute toward their true expected monthly value.
    const histAll = usable.map((a, i) => ({ t: a.byCategory.get(id) ?? 0, w: weights[i] }))
    const nonZero = histAll.filter(h => h.t > 0)
    const Kc = nonZero.length   // appearances — drives confidence/branching

    let Fc: number
    if (Kc >= 1) {
      // Winsorize only the non-zero entries (clamping €0 months up to
      // 0.5·median would re-inflate exactly what zero-inclusion fixes).
      let entries = histAll
      if (Kc >= 3) {
        const med = median(nonZero.map(h => h.t))
        entries = histAll.map(h =>
          h.t > 0 ? { ...h, t: clamp(h.t, P.winsor[0] * med, P.winsor[1] * med) } : h,
        )
      }
      const wSumC = entries.reduce((s, h) => s + h.w, 0)
      const Bc = entries.reduce((s, h) => s + h.t * h.w, 0) / wSumC
      Fc = alpha * (Sc / phiD) + (1 - alpha) * Bc
    } else {
      // Brand-new category (Kc=0): pure pace Sc/phiD exploded a day-1 €50
      // one-off into ~€1000. Treat it as mostly a one-off early in the
      // month, converging to pace as the month proves otherwise.
      Fc = Sc + alpha * (Sc / phiD - Sc)
    }

    const Rc = pending
      .filter(it => catKey(it.categoryId) === id)
      .reduce((s, it) => s + it.remaining, 0)
    Fc = Math.max(Fc, Sc + Rc, Sc)

    const cvC = Kc >= 2 ? popStd(nonZero.map(h => h.t)) / (mean(nonZero.map(h => h.t)) || 1) : 0.35
    const confC =
      P.confidence.wDepth * (Math.min(Kc, 6) / 6) +
      P.confidence.wStability * (1 - Math.min(cvC, 1)) +
      P.confidence.wProgress * p
    const order: ConfidenceLevel[] = ['low', 'medium', 'high']
    let levelC: ConfidenceLevel =
      confC >= P.confidence.high && Kc >= 3 ? 'high'
      : confC >= P.confidence.medium && Kc >= 1 ? 'medium'
      : 'low'
    // Cap at the global confidence.
    if (order.indexOf(levelC) > order.indexOf(confidence)) levelC = confidence

    catWork.push({ id, spent: Sc, forecast: Fc, Kc, conf: levelC })
  }

  // Reconciliation: category sum should roughly match the total.
  const sumFc = catWork.reduce((s, c) => s + c.forecast, 0)
  if (sumFc > 0) {
    const sr = clamp(F / sumFc, 0.75, 1.25)
    for (const c of catWork) c.forecast = Math.max(c.spent, sr * c.forecast)
  }

  // ── Budget buckets ──
  let budgetOut: SpendForecast['budget'] = null
  const bucketOf = (id: string): BudgetBucket => {
    const nm = id === '∅' ? null : (catMeta.get(id)?.name ?? null)
    return categoryToBucket(nm, overrides)
  }
  const riskyBuckets = new Set<BudgetBucket>()

  if (budget) {
    const income = Number(budget.monthly_income) || 0
    const limits: Record<BudgetBucket, number> = {
      needs:   (income * Number(budget.pct_needs))   / 100,
      wants:   (income * Number(budget.pct_wants))   / 100,
      savings: (income * Number(budget.pct_savings)) / 100,
    }
    const fb: Record<BudgetBucket, number> = { needs: 0, wants: 0, savings: 0 }
    const sb: Record<BudgetBucket, number> = { needs: 0, wants: 0, savings: 0 }
    for (const c of catWork) {
      const b = bucketOf(c.id)
      fb[b] += c.forecast
      sb[b] += c.spent
    }

    const buckets = (['needs', 'wants', 'savings'] as const).map(bucket => {
      const limit = limits[bucket]
      const FB = fb[bucket]
      const SB = sb[bucket]
      const severity: 'on_track' | 'risk' | 'over' =
        limit > 0 && FB > limit ? 'over'
        : limit > 0 && FB > 0.85 * limit ? 'risk'
        : 'on_track'
      if (severity !== 'on_track') riskyBuckets.add(bucket)

      let breachDate: string | null = null
      let alreadyOver = false
      if (severity === 'over') {
        if (SB >= limit) {
          alreadyOver = true
          breachDate = `${currentKey}-${String(d).padStart(2, '0')}`
        } else {
          const phiDNow = phiD
          for (let x = d + 1; x <= D; x++) {
            const share = phiDNow >= 0.99
              ? (x - d) / Math.max(1, D - d)                       // linear fallback
              : (phiClamped(x) - phiDNow) / (1 - phiDNow)
            const projected = SB + (FB - SB) * Math.min(1, Math.max(0, share))
            if (projected >= limit) {
              breachDate = `${currentKey}-${String(x).padStart(2, '0')}`
              break
            }
          }
          // φ profiles from longer history months can top out below 1 for
          // this month's length, leaving the scan short of the limit even
          // though FB > limit by definition of 'over' — the breach then
          // lands on the last day rather than reporting "never".
          if (!breachDate) {
            breachDate = `${currentKey}-${String(D).padStart(2, '0')}`
          }
        }
      }

      return {
        bucket,
        limit,
        spentSoFar:  SB,
        forecast:    FB,
        forecastPct: limit > 0 ? (FB / limit) * 100 : 0,
        severity,
        breachDate,
        alreadyOver,
      }
    })

    budgetOut = { monthlyIncome: income, buckets }
  }

  // ── Category list (top-N, but never drop categories feeding a risky bucket) ──
  const categories = catWork
    .sort((a, b) => b.forecast - a.forecast)
    .filter((c, idx) =>
      (idx < P.topN && c.forecast >= P.minCategoryForecast) ||
      (budgetOut != null && riskyBuckets.has(bucketOf(c.id))),
    )
    .slice(0, P.topN + 4)
    .map(c => ({
      categoryId: c.id === '∅' ? null : c.id,
      name: c.id === '∅' ? null : (catMeta.get(c.id)?.name ?? null),
      icon: c.id === '∅' ? null : (catMeta.get(c.id)?.icon ?? null),
      spentSoFar: c.spent,
      forecast:   c.forecast,
      confidence: c.conf,
      bucket: budgetOut ? bucketOf(c.id) : null,
    }))

  return {
    status: 'ok',
    month: currentKey,
    daysElapsed: d,
    daysInMonth: D,
    spentSoFar: S,
    total: {
      forecast: F,
      low,
      high,
      confidence,
      baseline: B,
      pace: Pace,
      blendAlpha: alpha,
      usableMonths: K,
      recurringPending: pending.map(it => ({
        description: it.description,
        categoryName: it.categoryName,
        amount: it.remaining,   // what's still expected, not the raw median
        expectedDay: it.expectedDay,
      })),
    },
    categories,
    budget: budgetOut,
  }
}
