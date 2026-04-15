'use client'

import { TrendingUp, TrendingDown, PiggyBank } from 'lucide-react'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import type { MonthlySummaryData } from '@/app/api/summary/route'

async function fetchSummary(): Promise<MonthlySummaryData | null> {
  const res = await fetch('/api/summary')
  if (!res.ok) return null
  const { data } = await res.json()
  return data
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

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-4 h-4 text-green-400" />
          <span className="text-sm text-white/50">Receitas</span>
        </div>
        <div className="text-2xl font-bold text-green-400">{formatCurrency(summary.income)}</div>
        <div className="text-xs text-white/30 mt-1">Este mês</div>
      </div>

      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-2">
          <TrendingDown className="w-4 h-4 text-red-400" />
          <span className="text-sm text-white/50">Despesas</span>
        </div>
        <div className="text-2xl font-bold text-red-400">{formatCurrency(summary.expense)}</div>
        <div className="text-xs text-white/30 mt-1">Este mês</div>
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
  )
}
