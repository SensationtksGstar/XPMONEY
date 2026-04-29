'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, Legend, ReferenceLine,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { BudgetHistoryResponse } from '@/app/api/budget/history/route'

/**
 * BudgetHistory — chart de barras empilhadas com 6 meses de despesas
 * agrupadas por bucket (needs/wants/savings).
 *
 * Mostra:
 *   - Cada mês como uma barra dividida em 3 camadas de cor
 *   - Linha de referência horizontal no valor do rendimento mensal
 *     (se o topo da barra passar da linha → gastou mais do que ganhou)
 *   - Tendência textual comparando este mês ao mês passado
 *
 * O chart usa recharts — já é uma dep existente, não inflar bundle.
 */

async function fetchHistory(): Promise<BudgetHistoryResponse | null> {
  const res = await fetch('/api/budget/history?months=6')
  if (!res.ok) return null
  const { data } = await res.json()
  return data ?? null
}

const COLORS = {
  needs:   '#3b82f6',  // blue-500
  wants:   '#f59e0b',  // amber-500
  savings: '#10b981',  // emerald-500
}

export function BudgetHistory() {
  const { data, isLoading } = useQuery({
    queryKey:  ['budget-history', 6],
    queryFn:   fetchHistory,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const trend = useMemo(() => {
    if (!data || data.points.length < 2) return null
    const curr = data.points[data.points.length - 1]
    const prev = data.points[data.points.length - 2]
    if (prev.total === 0) return null
    const diff = curr.total - prev.total
    const pct  = (diff / prev.total) * 100
    return { diff, pct, curr, prev }
  }, [data])

  if (isLoading) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 animate-pulse">
        <div className="h-4 bg-white/10 rounded w-1/3 mb-4" />
        <div className="h-48 bg-white/5 rounded" />
      </div>
    )
  }

  if (!data || data.points.every(p => p.total === 0)) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
        <h3 className="font-semibold text-white text-sm mb-1">Histórico — 6 meses</h3>
        <p className="text-xs text-white/45 max-w-xs mx-auto">
          Assim que registares despesas durante alguns meses, vês aqui a evolução
          visual entre necessidades, desejos e poupança.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="min-w-0">
          <h3 className="font-semibold text-white text-sm">Histórico · últimos 6 meses</h3>
          <p className="text-[11px] text-white/45 mt-0.5">
            Barras empilhadas por bucket · linha tracejada = rendimento mensal
          </p>
        </div>
        {trend && (
          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border whitespace-nowrap ${
            Math.abs(trend.pct) < 3
              ? 'bg-white/5 border-white/15 text-white/60'
              : trend.diff > 0
              ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
              : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
          }`}>
            {Math.abs(trend.pct) < 3
              ? <Minus className="w-3 h-3" />
              : trend.diff > 0
              ? <TrendingUp className="w-3 h-3" />
              : <TrendingDown className="w-3 h-3" />}
            {trend.diff > 0 ? '+' : ''}{trend.pct.toFixed(0)}% vs mês anterior
          </span>
        )}
      </div>

      {/* Income caption moved out of the chart (April 2026 mobile fix).
          Before: ReferenceLine label `Rendimento €X` rendered
          `insideTopRight` of the chart and overlapped the rightmost bar
          on viewports below ~480 px. Now the value lives in this
          dedicated caption row — cleaner on every screen, and the
          dashed line still visually anchors the threshold inside the
          chart itself. */}
      {data.income > 0 && (
        <div className="flex items-center gap-2 mb-3 text-[11px] text-white/55">
          <span aria-hidden className="inline-block w-6 h-px border-t border-dashed border-white/45" />
          <span>Rendimento mensal: <strong className="text-white/80 tabular-nums">{formatCurrency(data.income)}</strong></span>
        </div>
      )}

      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.points} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
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
                background:   '#0a0f1e',
                border:       '1px solid rgba(255,255,255,0.15)',
                borderRadius: 12,
                fontSize:     12,
                color:        '#fff',
              }}
              itemStyle={{ color: '#fff' }}
              formatter={(value: number, name: string) => {
                const label =
                  name === 'needs'   ? 'Necessidades' :
                  name === 'wants'   ? 'Desejos'      :
                  name === 'savings' ? 'Poupança'     : name
                return [formatCurrency(value), label]
              }}
              labelFormatter={label => `Mês: ${label}`}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              formatter={(v: string) =>
                v === 'needs'   ? <span className="text-white/70">Necessidades</span> :
                v === 'wants'   ? <span className="text-white/70">Desejos</span>      :
                v === 'savings' ? <span className="text-white/70">Poupança</span>     :
                v
              }
            />
            {/* Dashed reference line stays — it's the visual anchor for
                the income threshold. The numeric value moved to the
                caption above so labels can't crash into the bars on
                mobile. */}
            {data.income > 0 && (
              <ReferenceLine
                y={data.income}
                stroke="rgba(255,255,255,0.35)"
                strokeDasharray="4 4"
              />
            )}
            <Bar dataKey="needs"   stackId="a" fill={COLORS.needs}   radius={[0, 0, 0, 0]} />
            <Bar dataKey="wants"   stackId="a" fill={COLORS.wants}   radius={[0, 0, 0, 0]} />
            <Bar dataKey="savings" stackId="a" fill={COLORS.savings} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
