'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Receipt, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useLocale } from '@/lib/i18n/LocaleProvider'
import { usePeriod } from '@/lib/contexts/PeriodContext'
import type { MonthlySummaryData } from '@/app/api/summary/route'

/**
 * BiggestExpenses — widget do dashboard que lista as 5 transações de despesa
 * mais caras do período seleccionado.
 *
 * Complementa o ExpenseBreakdown: o breakdown agrega por categoria e dilui
 * uma compra única grande (ex.: uma renda de €400 desaparece numa categoria
 * "Casa" de €600). Este widget responde à pergunta directa "qual foi o meu
 * maior gasto?".
 *
 * Reutiliza o MESMO queryKey ['summary', qs] do MonthlySummary /
 * ExpenseBreakdown — React Query dedupe → zero rede extra. A API já devolve
 * `top_expenses` no mesmo payload. O `qs` inclui o período global, por isso
 * sincroniza com o filtro de período como os outros widgets.
 */

async function fetchSummary(qs: string): Promise<MonthlySummaryData | null> {
  const res = await fetch(`/api/summary?${qs}`)
  if (!res.ok) return null
  const { data } = await res.json()
  return data
}

export function BiggestExpenses() {
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
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-2xl bg-white/10 flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-white/10 rounded w-2/3" />
              <div className="h-2.5 bg-white/5 rounded w-1/3" />
            </div>
            <div className="w-16 h-3 bg-white/10 rounded" />
          </div>
        ))}
      </div>
    )
  }

  const expenses = summary?.top_expenses ?? []

  // Empty state — mesmo tom do ExpenseBreakdown.
  if (!summary || expenses.length === 0) {
    return (
      <div className="glass-card p-5 flex flex-col items-center text-center gap-3">
        <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          <Receipt className="w-5 h-5 text-white/30" />
        </div>
        <div>
          <p className="font-semibold text-white text-sm">{t('biggest.empty_title')}</p>
          <p className="text-xs text-white/40 mt-0.5">{t('biggest.empty_subtitle')}</p>
        </div>
        <Link
          href="/transactions"
          className="text-xs font-bold text-green-400 hover:text-green-300 inline-flex items-center gap-1"
        >
          {t('biggest.see_all')}
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    )
  }

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4 text-amber-400" />
          <h3 className="font-semibold text-white text-sm">{t('biggest.title')}</h3>
        </div>
        <span className="text-xs text-white/40">{summary.period?.label ?? t('biggest.subtitle')}</span>
      </div>

      {/* key=qs re-runs the stagger when the period flips. */}
      <motion.div
        key={qs}
        className="space-y-1"
        initial="hidden"
        animate="visible"
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }}
      >
        {expenses.map(exp => (
          <motion.div
            key={exp.id}
            className="flex items-center gap-3 py-1.5"
            variants={{
              hidden:  { opacity: 0, x: -8 },
              visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' } },
            }}
          >
            {/* Ícone da categoria */}
            <div className="w-9 h-9 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
              <span aria-hidden className="text-base">{exp.icon ?? '📎'}</span>
            </div>

            {/* Descrição + categoria/data */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {exp.description || exp.category || t('biggest.no_category')}
              </p>
              <p className="text-[11px] text-white/40 truncate">
                {(exp.category ?? t('biggest.no_category'))} · {formatDate(exp.date, locale)}
              </p>
            </div>

            {/* Valor */}
            <span className="text-sm font-bold text-white tabular-nums flex-shrink-0">
              {formatCurrency(exp.amount, 'EUR', locale)}
            </span>
          </motion.div>
        ))}
      </motion.div>

      <Link
        href="/transactions"
        className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-white/60 hover:text-white transition-colors"
      >
        <span>{t('biggest.see_all')}</span>
        <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  )
}
