'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { TrendingDown, ArrowRight } from 'lucide-react'
import { formatCurrency, formatMonth } from '@/lib/utils'
import { useLocale } from '@/lib/i18n/LocaleProvider'
import type { MonthlySummaryData } from '@/app/api/summary/route'

/**
 * ExpenseBreakdown — widget do dashboard que mostra as top 6 categorias de
 * despesa do mês corrente em barras horizontais.
 *
 * Reutiliza o mesmo queryKey ['summary'] do MonthlySummary para evitar
 * double-fetch — a API já inclui `top_categories` no mesmo payload.
 */

async function fetchSummary(): Promise<MonthlySummaryData | null> {
  const res = await fetch('/api/summary')
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
  const { data: summary, isLoading } = useQuery({
    queryKey:             ['summary'],
    queryFn:              fetchSummary,
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
  const totalLabel = summary.month === summary.currentMonth
    ? t('breakdown.amount_this_month', { amount })
    : t('breakdown.amount_in_month', {
        amount,
        month: formatMonth(
          new Date(Number(summary.month.split('-')[0]), Number(summary.month.split('-')[1]) - 1, 1),
          locale,
        ),
      })

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

      <div className="space-y-2.5">
        {cats.map((cat, i) => (
          <div key={cat.name} className="flex items-center gap-3">
            {/* Ícone + nome */}
            <div className="flex items-center gap-2 flex-shrink-0 w-32 sm:w-36">
              <span aria-hidden className="text-base">
                {cat.icon ?? '📎'}
              </span>
              <span className="text-sm text-white/85 truncate">{cat.name}</span>
            </div>

            {/* Barra proporcional */}
            <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${BAR_COLORS[i % BAR_COLORS.length]}`}
                style={{ width: `${Math.max(4, cat.pct)}%` }}
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
          </div>
        ))}
      </div>

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
