'use client'

/**
 * Global period filter for the dashboard.
 *
 * Pre-May 2026: the only filter was the per-widget `MonthSelector` inside
 * `MonthlySummary`. User complaint: "a app não permite filtrar o período
 * de análise no dashboard". Now there's a top-of-page selector that
 * cascades through every widget that aggregates transactions, so the
 * same range (Este mês / Mês anterior / Últimos 3 meses / 6 meses / 12
 * meses / Ano até hoje / Personalizado / Tudo) drives MonthlySummary,
 * ExpenseBreakdown, ComparisonCard and any future analytics card.
 *
 * Storage: localStorage so the user's choice survives a refresh but stays
 * per-device (no DB pollution, no cross-device confusion).
 *
 * Why context instead of React Query: the period value is consumed by
 * many widgets BEFORE they make their queries, and Query keys are
 * derived from it. Using a context lets the queries invalidate
 * automatically when the period flips.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

/** All supported period shorthands. Keep in sync with resolvePeriod() in
 *  src/app/api/summary/route.ts — adding one here requires adding it
 *  there to actually take effect. */
export type PeriodKey =
  | 'this-month'
  | 'last-month'
  | 'last-3m'
  | 'last-6m'
  | 'last-12m'
  | 'ytd'
  | 'all'
  | 'custom'

export interface CustomRange { from: string; to: string }

export interface PeriodValue {
  key:    PeriodKey
  /** Only used when key === 'custom'. */
  custom: CustomRange | null
}

interface Ctx extends PeriodValue {
  setPeriod: (k: PeriodKey, custom?: CustomRange | null) => void
  /** Returns the URL query string the dashboard widgets append to
   *  /api/summary, /api/transactions etc. Shape: "period=last-3m" OR
   *  "from=YYYY-MM-DD&to=YYYY-MM-DD". Never starts with '?'. */
  queryString: () => string
}

const PeriodCtx = createContext<Ctx | null>(null)
const STORAGE_KEY = 'xpmoney:period-v1'
const DEFAULT_PERIOD: PeriodValue = { key: 'this-month', custom: null }

/** Resolve stored JSON, validating shape so a corrupted value doesn't crash. */
function readStoredPeriod(): PeriodValue {
  if (typeof window === 'undefined') return DEFAULT_PERIOD
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_PERIOD
    const parsed = JSON.parse(raw) as Partial<PeriodValue>
    const validKeys: PeriodKey[] = ['this-month', 'last-month', 'last-3m', 'last-6m', 'last-12m', 'ytd', 'all', 'custom']
    if (!parsed.key || !validKeys.includes(parsed.key as PeriodKey)) return DEFAULT_PERIOD
    if (parsed.key === 'custom') {
      const c = parsed.custom
      if (!c || !/^\d{4}-\d{2}-\d{2}$/.test(c.from ?? '') || !/^\d{4}-\d{2}-\d{2}$/.test(c.to ?? '')) {
        return DEFAULT_PERIOD
      }
      return { key: 'custom', custom: c }
    }
    return { key: parsed.key as PeriodKey, custom: null }
  } catch {
    return DEFAULT_PERIOD
  }
}

export function PeriodProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PeriodValue>(DEFAULT_PERIOD)

  // Hydrate from localStorage after mount so SSR matches the safe default.
  useEffect(() => { setState(readStoredPeriod()) }, [])

  const setPeriod = (k: PeriodKey, custom: CustomRange | null = null) => {
    const next: PeriodValue = k === 'custom' ? { key: 'custom', custom } : { key: k, custom: null }
    setState(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* quota */ }
  }

  const queryString = (): string => {
    if (state.key === 'custom' && state.custom) {
      return `from=${encodeURIComponent(state.custom.from)}&to=${encodeURIComponent(state.custom.to)}`
    }
    return `period=${state.key}`
  }

  return (
    <PeriodCtx.Provider value={{ ...state, setPeriod, queryString }}>
      {children}
    </PeriodCtx.Provider>
  )
}

export function usePeriod(): Ctx {
  const ctx = useContext(PeriodCtx)
  if (!ctx) {
    // Defensive default — render OUTSIDE PeriodProvider shouldn't crash;
    // widgets just behave as if filter were "this month".
    return {
      key:    'this-month',
      custom: null,
      setPeriod:   () => { /* no-op */ },
      queryString: () => 'period=this-month',
    }
  }
  return ctx
}

/** Human label per key — UI uses this for the dropdown button text. */
export const PERIOD_LABELS: Record<PeriodKey, string> = {
  'this-month':  'Este mês',
  'last-month':  'Mês anterior',
  'last-3m':     'Últimos 3 meses',
  'last-6m':     'Últimos 6 meses',
  'last-12m':    'Últimos 12 meses',
  'ytd':         'Ano até hoje',
  'all':         'Tudo',
  'custom':      'Personalizado',
}
