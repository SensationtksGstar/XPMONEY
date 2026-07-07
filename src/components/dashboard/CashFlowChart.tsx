'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
} from 'recharts'
import { ArrowDownLeft, ArrowUpRight, Wallet } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useLocale } from '@/lib/i18n/LocaleProvider'
import type { CashFlowResponse } from '@/app/api/cashflow/route'

/**
 * CashFlowChart — barras agrupadas (receita vs despesa) por mês nos últimos
 * 6 meses, com o net agregado do período em destaque no topo.
 *
 * Distinto do ExpenseBreakdown (categorias do período corrente) e do
 * BiggestExpenses (transações individuais): este responde a "estou a poupar
 * ou a queimar dinheiro ao longo do tempo?". É a única leitura de TENDÊNCIA
 * temporal no dashboard.
 *
 * Não usa o PeriodFilter — a janela é fixa em 6 meses por design (a sua razão
 * de existir é a tendência multi-mês, não o período seleccionado). recharts
 * já é dep existente; o widget é dynamic-imported na page para não inflar o
 * critical path mobile.
 */

async function fetchCashFlow(months: number): Promise<CashFlowResponse | null> {
  const res = await fetch(`/api/cashflow?months=${months}`)
  if (!res.ok) return null
  const { data } = await res.json()
  return data ?? null
}

const COLORS = {
  income:  '#27c26b',  // emerald-500
  expense: '#f43f5e',  // rose-500
}

export function CashFlowChart() {
  const { t, locale } = useLocale()
  const { data, isLoading } = useQuery({
    queryKey:             ['cashflow', 6],
    queryFn:              () => fetchCashFlow(6),
    staleTime:            5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  // Locale-aware short month label, computed client-side so the API stays
  // language-neutral. "jan"/"abr" (PT) vs "Jan"/"Apr" (EN).
  const points = useMemo(() => {
    if (!data) return []
    const intl = locale === 'en' ? 'en-US' : 'pt-PT'
    return data.points.map(p => {
      const [y, m] = p.month.split('-').map(Number)
      const label = new Date(y, m - 1, 1).toLocaleDateString(intl, { month: 'short' })
        .replace('.', '')
      return { ...p, label: label.charAt(0).toUpperCase() + label.slice(1) }
    })
  }, [data, locale])

  const totals = useMemo(() => {
    if (!data) return { income: 0, expense: 0, net: 0 }
    const income  = data.points.reduce((s, p) => s + p.income, 0)
    const expense = data.points.reduce((s, p) => s + p.expense, 0)
    return { income, expense, net: income - expense }
  }, [data])

  if (isLoading) {
    return (
      <div className="glass-card p-5 animate-pulse">
        <div className="h-4 bg-white/10 rounded w-1/3 mb-4" />
        <div className="h-48 bg-white/5 rounded" />
      </div>
    )
  }

  // Empty — nenhum movimento em 6 meses.
  if (!data || points.every(p => p.income === 0 && p.expense === 0)) {
    return (
      <div className="glass-card p-5 flex flex-col items-center text-center gap-3">
        <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          <Wallet className="w-5 h-5 text-white/30" />
        </div>
        <div>
          <p className="font-semibold text-white text-sm">{t('cashflow.empty_title')}</p>
          <p className="text-xs text-white/40 mt-0.5">{t('cashflow.empty_subtitle')}</p>
        </div>
      </div>
    )
  }

  const netPositive = totals.net >= 0

  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-400" />
            <h3 className="font-semibold text-white text-sm">{t('cashflow.title')}</h3>
          </div>
          <p className="text-[11px] text-white/45 mt-0.5">{t('cashflow.subtitle')}</p>
        </div>
        {/* Net agregado do período — verde se poupou, rosa se queimou */}
        <div className="text-right">
          <p className="text-[11px] text-white/40 uppercase tracking-wide">{t('cashflow.net_label')}</p>
          <p className={`text-base font-bold tabular-nums ${netPositive ? 'text-emerald-300' : 'text-rose-300'}`}>
            {netPositive ? '+' : ''}{formatCurrency(totals.net, 'EUR', locale)}
          </p>
        </div>
      </div>

      {/* Resumo entrou / saiu */}
      <div className="flex items-center gap-4 mb-3 text-[11px]">
        <span className="inline-flex items-center gap-1 text-white/55">
          <ArrowUpRight className="w-3 h-3 text-emerald-400" />
          {t('cashflow.in')}: <strong className="text-white/80 tabular-nums">{formatCurrency(totals.income, 'EUR', locale)}</strong>
        </span>
        <span className="inline-flex items-center gap-1 text-white/55">
          <ArrowDownLeft className="w-3 h-3 text-rose-400" />
          {t('cashflow.out')}: <strong className="text-white/80 tabular-nums">{formatCurrency(totals.expense, 'EUR', locale)}</strong>
        </span>
      </div>

      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
              tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`}
              width={48}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              contentStyle={{
                background:   '#13161b',
                border:       '1px solid rgba(255,255,255,0.15)',
                borderRadius: 12,
                fontSize:     12,
                color:        '#fff',
              }}
              itemStyle={{ color: '#fff' }}
              formatter={(value: number, name: string) => {
                const label = name === 'income' ? t('cashflow.in') : t('cashflow.out')
                return [formatCurrency(value, 'EUR', locale), label]
              }}
              labelFormatter={label => String(label)}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              formatter={(v: string) =>
                v === 'income'
                  ? <span className="text-white/70">{t('cashflow.in')}</span>
                  : <span className="text-white/70">{t('cashflow.out')}</span>
              }
            />
            <Bar dataKey="income"  fill={COLORS.income}  radius={[4, 4, 0, 0]} />
            <Bar dataKey="expense" fill={COLORS.expense} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
