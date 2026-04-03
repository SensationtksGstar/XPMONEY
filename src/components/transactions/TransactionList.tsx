'use client'

import { useTransactions }  from '@/hooks/useTransactions'
import { formatCurrency, formatDate, getTransactionColor, getTransactionSign, groupBy } from '@/lib/utils'

interface Props {
  search:     string
  typeFilter: string
}

export function TransactionList({ search, typeFilter }: Props) {
  const { transactions, loading } = useTransactions()

  const filtered = transactions.filter(tx => {
    const matchesType = typeFilter === 'all' || tx.type === typeFilter
    const matchesSearch = !search ||
      tx.description.toLowerCase().includes(search.toLowerCase()) ||
      tx.category?.name.toLowerCase().includes(search.toLowerCase())
    return matchesType && matchesSearch
  })

  const grouped = groupBy(filtered, 'date')
  const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse">
            <div className="h-3 bg-white/10 rounded w-24 mb-3" />
            <div className="glass-card divide-y divide-white/5">
              {[1, 2, 3].map(j => (
                <div key={j} className="flex items-center gap-3 p-4">
                  <div className="w-9 h-9 rounded-full bg-white/10" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-white/10 rounded w-2/3" />
                    <div className="h-2.5 bg-white/10 rounded w-1/3" />
                  </div>
                  <div className="h-4 bg-white/10 rounded w-16" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div className="glass-card p-12 text-center">
        <p className="text-3xl mb-3">🔍</p>
        <p className="text-white/40">Nenhuma transação encontrada.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {sortedDates.map(date => (
        <div key={date}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">
              {formatDate(date)}
            </h3>
            <span className="text-xs text-white/30">
              {grouped[date].length} transaç{grouped[date].length === 1 ? 'ão' : 'ões'}
            </span>
          </div>
          <div className="glass-card overflow-hidden divide-y divide-white/5">
            {grouped[date].map(tx => (
              <div key={tx.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-white/3 transition-colors group">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0"
                  style={{ backgroundColor: `${tx.category?.color ?? '#94a3b8'}15` }}
                >
                  {tx.category?.icon ?? '📦'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {tx.description || tx.category?.name || 'Transação'}
                  </p>
                  <p className="text-xs text-white/40">{tx.category?.name}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`text-sm font-bold tabular-nums ${getTransactionColor(tx.type)}`}>
                    {getTransactionSign(tx.type)}{formatCurrency(tx.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
