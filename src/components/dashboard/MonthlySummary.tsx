'use client'

import { TrendingUp, TrendingDown, PiggyBank, Info, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from '@/lib/i18n/LocaleProvider'
import { usePeriod } from '@/lib/contexts/PeriodContext'
import type { MonthlySummaryData } from '@/app/api/summary/route'

async function fetchSummary(qs: string): Promise<MonthlySummaryData | null> {
  const res = await fetch(`/api/summary?${qs}`)
  if (!res.ok) return null
  const { data } = await res.json()
  return data
}

/**
 * Delta badge shown next to each KPI when there's a prior-period total
 * to compare against. Colours follow the financial-health convention:
 *   • income up   → green   (good)
 *   • expense up  → red     (bad)
 *   • savings up  → emerald (good)
 *   • inverse signs apply for "down".
 * The clamp at ±999 % on the server protects against 0 → X divisions.
 */
function DeltaBadge({ pct, kind }: { pct: number; kind: 'income' | 'expense' | 'savings' }) {
  if (pct === 0) return null
  const up = pct > 0
  const positive = kind === 'expense' ? !up : up
  const Icon = up ? ArrowUpRight : ArrowDownRight
  const colour = positive
    ? 'text-emerald-300 bg-emerald-500/12 border-emerald-500/25'
    : 'text-rose-300   bg-rose-500/12   border-rose-500/25'
  const label = `${up ? '+' : ''}${pct.toFixed(0)}%`
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md border text-[10px] font-bold ${colour}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  )
}

/**
 * Card animation — stagger children so they slide in sequentially on
 * mount, then settle. Reduced-motion users get the same end-state
 * instantly (framer-motion handles this automatically).
 */
const cardVariants = {
  hidden:  { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.2, 0.9, 0.3, 1] } },
}
const containerVariants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.08 } },
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function MonthlySummary({ userId: _userId }: { userId?: string }) {
  const { t, locale } = useLocale()
  const { queryString, key } = usePeriod()
  const qs = queryString()
  const { data: summary, isLoading } = useQuery({
    // Period in the key → React Query auto-refetches when the user
    // changes the global filter. No manual invalidation needed.
    queryKey:  ['summary', qs],
    queryFn:   () => fetchSummary(qs),
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading || !summary) {
    return (
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="glass-card p-5 animate-pulse">
            <div className="h-3 bg-white/10 rounded w-1/2 mb-3" />
            <div className="h-7 bg-white/10 rounded w-2/3" />
          </div>
        ))}
      </div>
    )
  }

  // Label shown under each amount — the resolved period from the server
  // (e.g. "Últimos 3 meses", "Março 2026"). Fall back to the legacy
  // "Este mês" if for some reason the server didn't send a period.
  const periodLabel = summary.period?.label || t('summary.this_month')
  const cmp = summary.compareToPrev

  return (
    <div className="space-y-3">
      {summary.fallbackUsed && (
        <div className="flex items-start gap-2 bg-blue-500/10 border border-blue-500/25 rounded-xl px-4 py-2.5">
          <Info className="w-4 h-4 text-blue-300 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-200 leading-relaxed">
            {t('summary.fallback', {
              shown:   periodLabel,
              current: t('summary.this_month'),
            })}
          </p>
        </div>
      )}

      <motion.div
        // Key re-renders the wrapper when the period changes, retriggering
        // the stagger animation. Subtle but signals "fresh data" to the eye.
        key={qs}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        <motion.div variants={cardVariants} className="glass-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-sm text-white/50">{t('summary.revenues')}</span>
            {cmp && <DeltaBadge pct={cmp.incomePct} kind="income" />}
          </div>
          <div className="text-2xl font-bold text-green-400">{formatCurrency(summary.income, 'EUR', locale)}</div>
          <div className="text-xs text-white/30 mt-1 capitalize">{periodLabel}</div>
          {cmp && (
            <div className="text-[11px] text-white/40 mt-0.5 tabular-nums">
              período anterior: {formatCurrency(cmp.income, 'EUR', locale)}
            </div>
          )}
        </motion.div>

        <motion.div variants={cardVariants} className="glass-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-red-400" />
            <span className="text-sm text-white/50">{t('summary.expenses')}</span>
            {cmp && <DeltaBadge pct={cmp.expensePct} kind="expense" />}
          </div>
          <div className="text-2xl font-bold text-red-400">{formatCurrency(summary.expense, 'EUR', locale)}</div>
          <div className="text-xs text-white/30 mt-1 capitalize">{periodLabel}</div>
          {cmp && (
            <div className="text-[11px] text-white/40 mt-0.5 tabular-nums">
              período anterior: {formatCurrency(cmp.expense, 'EUR', locale)}
            </div>
          )}
        </motion.div>

        <motion.div variants={cardVariants} className="glass-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <PiggyBank className="w-4 h-4 text-yellow-400" />
            <span className="text-sm text-white/50">{t('summary.savings')}</span>
            {cmp && <DeltaBadge pct={cmp.savingsPct} kind="savings" />}
          </div>
          <div className={`text-2xl font-bold ${summary.savings >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>
            {formatCurrency(summary.savings, 'EUR', locale)}
          </div>
          <div className="text-xs text-white/30 mt-1">
            {t('summary.rate', { value: formatPercent(summary.rate) })}
          </div>
          {cmp && (
            <div className="text-[11px] text-white/40 mt-0.5 tabular-nums">
              período anterior: {formatCurrency(cmp.savings, 'EUR', locale)}
            </div>
          )}
        </motion.div>
      </motion.div>
      {/* Period key referenced to silence lint when not used elsewhere */}
      <span className="sr-only">period:{key}</span>
    </div>
  )
}
