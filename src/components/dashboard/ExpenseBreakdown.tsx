'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { TrendingDown, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { formatCurrency, formatMonth } from '@/lib/utils'
import { useLocale } from '@/lib/i18n/LocaleProvider'
import { usePeriod } from '@/lib/contexts/PeriodContext'
import type { MonthlySummaryData } from '@/app/api/summary/route'

/**
 * ExpenseBreakdown — widget do dashboard que mostra as top 6 categorias de
 * despesa do período seleccionado em barras horizontais.
 *
 * Reutiliza o mesmo queryKey ['summary', qs] do MonthlySummary para evitar
 * double-fetch — a API já inclui `top_categories` no mesmo payload. O
 * `qs` (query string) inclui o período global, por isso ambos os widgets
 * actualizam em sincronia quando o user troca o filtro.
 */

async function fetchSummary(qs: string): Promise<MonthlySummaryData | null> {
  const res = await fetch(`/api/summary?${qs}`)
  if (!res.ok) return null
  const { data } = await res.json()
  return data
}

// Paleta cíclica — cada categoria pinta sempre com a mesma cor dentro do mês
const BAR_COLORS = [
  'from-red-500 to-orange-400',
  'from-blue-500 to-cyan-400',
  'from-purple-500 to-pink-400',
  'from-yellow-500 to-amber-400',
  'from-emerald-500 to-green-400',
  'from-violet-500 to-indigo-400',
] as const

export function ExpenseBreakdown() {
  const { t, locale } = useLocale()
  const { queryString } = usePeriod()
  const qs = queryString()
  const { data: summary, isLoading } = useQuery({
    queryKey:             ['summary', qs],
    queryFn:              () => fetchSummary(qs),
    staleTime:            5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  if (isLoading) {
    return (
      <div className="glass-card p-5 animate-pulse">
        <div className="h-4 bg-white/10 rounded w-2/5 mb-4" />
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex items-center gap-3 mb-3">
            <div className="w-6 h-6 rounded-full bg-white/10 flex-shrink-0" />
            <div className="flex-1 h-3 bg-white/10 rounded" />
            <div className="w-12 h-3 bg-white/10 rounded" />
          </div>
        ))}
      </div>
    )
  }

  const cats = summary?.top_categories ?? []

  // Empty state — faz sentido sugerir ao user registar transações
  if (!summary || cats.length === 0 || summary.expense === 0) {
    return (
      <div className="glass-card p-5 flex flex-col items-center text-center gap-3">
        <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          <TrendingDown className="w-5 h-5 text-white/30" />
        </div>
        <div>
          <p className="font-semibold text-white text-sm">{t('breakdown.empty_title')}</p>
          <p className="text-xs text-white/40 mt-0.5">
            {t('breakdown.empty_subtitle')}
          </p>
        </div>
        <Link
          href="/transactions"
          className="text-xs font-bold text-green-400 hover:text-green-300 inline-flex items-center gap-1"
        >
          {t('breakdown.empty_cta')}
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    )
  }

  const amount = formatCurrency(summary.expense, 'EUR', locale)
  // Period label comes from the server-resolved window (e.g. "Últimos 3
  // meses"). Falls back to the legacy single-month text when the API
  // hasn't been redeployed yet.
  const totalLabel = summary.period?.label
    ? `${amount} · ${summary.period.label}`
    : (summary.month === summary.currentMonth
        ? t('breakdown.amount_this_month', { amount })
        : t('breakdown.amount_in_month', {
            amount,
            month: formatMonth(
              new Date(Number(summary.month.split('-')[0]), Number(summary.month.split('-')[1]) - 1, 1),
              locale,
            ),
          }))

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-red-400" />
          <h3 className="font-semibold text-white text-sm">{t('breakdown.title')}</h3>
        </div>
        <span className="text-xs text-white/40 capitalize">
          {totalLabel}
        </span>
      </div>

      {/* key=qs re-runs the stagger when period flips. Bar widths animate
          from 0 → pct so the user sees them "grow" — much more legible
          than a snap on data refresh. */}
      <motion.div
        key={qs}
        className="space-y-2.5"
        initial="hidden"
        animate="visible"
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }}
      >
        {cats.map((cat, i) => (
          <motion.div
            key={cat.name}
            className="flex items-center gap-3"
            variants={{
              hidden:  { opacity: 0, x: -8 },
              visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' } },
            }}
          >
            {/* Ícone + nome */}
            <div className="flex items-center gap-2 flex-shrink-0 w-32 sm:w-36">
              <span aria-hidden className="text-base">
                {cat.icon ?? '📎'}
              </span>
              <span className="text-sm text-white/85 truncate">{cat.name}</span>
            </div>

            {/* Barra proporcional — grow-from-zero */}
            <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full bg-gradient-to-r ${BAR_COLORS[i % BAR_COLORS.length]}`}
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(4, cat.pct)}%` }}
                transition={{ duration: 0.6, ease: [0.2, 0.9, 0.3, 1], delay: 0.05 * i }}
                title={t('breakdown.bar_title', { pct: cat.pct.toFixed(1) })}
              />
            </div>

            {/* Valor */}
            <div className="flex-shrink-0 w-20 text-right">
              <p className="text-sm font-bold text-white tabular-nums">
                {formatCurrency(cat.total, 'EUR', locale)}
              </p>
              <p className="text-[10px] text-white/40 tabular-nums">
                {cat.pct.toFixed(0)}%
              </p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <Link
        href="/transactions"
        className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-white/60 hover:text-white transition-colors"
      >
        <span>{t('breakdown.see_all')}</span>
        <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  )
}
