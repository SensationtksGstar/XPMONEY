'use client'

import { TrendingUp, TrendingDown, PiggyBank, Info } from 'lucide-react'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import type { MonthlySummaryData } from '@/app/api/summary/route'

async function fetchSummary(): Promise<MonthlySummaryData | null> {
  const res = await fetch('/api/summary')
  if (!res.ok) return null
  const { data } = await res.json()
  return data
}

/** YYYY-MM → "Março 2026" */
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
function formatMonthYM(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return `${MONTH_NAMES[m - 1] ?? ''} ${y}`
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function MonthlySummary({ userId: _userId }: { userId?: string }) {
  const { data: summary, isLoading } = useQuery({
    queryKey:  ['summary'],
    queryFn:   fetchSummary,
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

  // Label contextual: "Este mês", "Março 2026", etc.
  // Quando há fallback, explicamos ao user porque está a ver o mês passado.
  const monthLabel = summary.month === summary.currentMonth
    ? 'Este mês'
    : formatMonthYM(summary.month)

  return (
    <div className="space-y-3">
      {/* Banner quando o sistema caiu para um mês passado porque o
          corrente ainda está sem movimentos. Antes o user importava um
          extrato de Março em Abril e o dashboard ficava a 0€ silenciosamente. */}
      {summary.fallbackUsed && (
        <div className="flex items-start gap-2 bg-blue-500/10 border border-blue-500/25 rounded-xl px-4 py-2.5">
          <Info className="w-4 h-4 text-blue-300 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-200 leading-relaxed">
            A mostrar <strong>{formatMonthYM(summary.month)}</strong> — {formatMonthYM(summary.currentMonth)} ainda não tem movimentos registados.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-sm text-white/50">Receitas</span>
          </div>
          <div className="text-2xl font-bold text-green-400">{formatCurrency(summary.income)}</div>
          <div className="text-xs text-white/30 mt-1">{monthLabel}</div>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-red-400" />
            <span className="text-sm text-white/50">Despesas</span>
          </div>
          <div className="text-2xl font-bold text-red-400">{formatCurrency(summary.expense)}</div>
          <div className="text-xs text-white/30 mt-1">{monthLabel}</div>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <PiggyBank className="w-4 h-4 text-yellow-400" />
            <span className="text-sm text-white/50">Poupança</span>
          </div>
          <div className={`text-2xl font-bold ${summary.savings >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>
            {formatCurrency(summary.savings)}
          </div>
          <div className="text-xs text-white/30 mt-1">
            Taxa: {formatPercent(summary.rate)}
          </div>
        </div>
      </div>
    </div>
  )
}
