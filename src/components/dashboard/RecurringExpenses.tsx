'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Repeat, ArrowRight } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useLocale } from '@/lib/i18n/LocaleProvider'
import type { RecurringResponse } from '@/app/api/recurring/route'

/**
 * RecurringExpenses — surfaces likely recurring/fixed monthly costs detected
 * from the last 6 months of transactions (see /api/recurring). Renders ONLY
 * when something is detected, so users without enough history see nothing.
 *
 * The estimate answers a question no other widget does: "what's my committed
 * monthly outflow?" — the subscription/fixed-cost bleed people underestimate.
 */

async function fetchRecurring(): Promise<RecurringResponse | null> {
  const res = await fetch('/api/recurring')
  if (!res.ok) return null
  const { data } = await res.json()
  return data ?? null
}

export function RecurringExpenses() {
  const { t, locale } = useLocale()
  const { data, isLoading } = useQuery({
    queryKey:             ['recurring'],
    queryFn:              fetchRecurring,
    staleTime:            10 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  if (isLoading) {
    return <div className="h-40 bg-white/5 rounded-2xl animate-pulse" />
  }
  if (!data || data.items.length === 0) return null

  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Repeat className="w-4 h-4 text-amber-400" />
            <h3 className="font-semibold text-white text-sm">{t('recurring.title')}</h3>
          </div>
          <p className="text-[11px] text-white/45 mt-0.5">{t('recurring.subtitle')}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-white/40 uppercase tracking-wide">{t('recurring.estimate_label')}</p>
          <p className="text-base font-bold text-amber-300 tabular-nums">
            {formatCurrency(data.totalMonthly, 'EUR', locale)}{t('budget.income_unit')}
          </p>
        </div>
      </div>

      <div className="space-y-1">
        {data.items.map(item => (
          <div key={item.key} className="flex items-center gap-3 py-1.5">
            <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
              <span aria-hidden className="text-sm">{item.icon ?? '🔁'}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white capitalize truncate">{item.key}</p>
              <p className="text-[11px] text-white/40 truncate">
                {(item.category ?? t('biggest.no_category'))} · {t('recurring.in_months', { n: item.months })}
              </p>
            </div>
            <span className="text-sm font-bold text-white tabular-nums flex-shrink-0">
              {formatCurrency(item.monthlyAmount, 'EUR', locale)}{t('budget.income_unit')}
            </span>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-white/30 mt-3">{t('recurring.note')}</p>

      <Link
        href="/transactions"
        className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-white/60 hover:text-white transition-colors"
      >
        <span>{t('breakdown.see_all')}</span>
        <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  )
}
