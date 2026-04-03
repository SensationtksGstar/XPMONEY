'use client'

import { TrendingUp, TrendingDown, PiggyBank } from 'lucide-react'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { useTransactions } from '@/hooks/useTransactions'
import { useMemo } from 'react'

interface Props { userId: string }

export function MonthlySummary({ userId }: Props) {
  const { transactions, loading } = useTransactions(userId)

  const summary = useMemo(() => {
    const now   = new Date()
    const month = now.getMonth()
    const year  = now.getFullYear()

    const thisMonth = transactions.filter(t => {
      const d = new Date(t.date)
      return d.getMonth() === month && d.getFullYear() === year
    })

    const income  = thisMonth.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expense = thisMonth.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const savings = income - expense
    const rate    = income > 0 ? (savings / income) * 100 : 0

    return { income, expense, savings, rate }
  }, [transactions])

  if (loading) {
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
