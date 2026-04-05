'use client'

import Link from 'next/link'
import { useTransactions } from '@/hooks/useTransactions'
import { formatCurrency, formatDate, getTransactionColor, getTransactionSign } from '@/lib/utils'
import { ArrowRight } from 'lucide-react'
import { CategoryIcon } from '@/components/ui/CategoryIcon'

interface Props {
  userId: string
  limit?: number
}

export function RecentTransactions({ userId, limit = 5 }: Props) {
  const { transactions, loading } = useTransactions(userId)
  const recent = transactions.slice(0, limit)

  if (loading) {
    return (
      <div className="glass-card divide-y divide-white/5 animate-pulse">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center gap-3 p-4">
            <div className="w-10 h-10 rounded-2xl bg-white/8" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-white/8 rounded w-2/3" />
              <div className="h-2.5 bg-white/5 rounded w-1/3" />
            </div>
            <div className="h-4 bg-white/8 rounded w-16" />
          </div>
        ))}
      </div>
    )
  }

  if (recent.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="text-white/40 text-sm">Sem transações ainda.</p>
        <Link href="/transactions" className="text-green-400 text-sm font-medium mt-2 inline-block hover:text-green-300">
          Adicionar primeira transação →
        </Link>
      </div>
    )
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="divide-y divide-white/5">
        {recent.map(tx => (
          <div key={tx.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/3 transition-colors">

            <CategoryIcon
              categoryName={tx.category?.name}
              categoryColor={tx.category?.color}
              type={tx.type}
              size="md"
            />

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {tx.description || tx.category?.name || 'Transação'}
              </p>
              <p className="text-xs text-white/35 mt-0.5">{formatDate(tx.date)}</p>
            </div>

            <span className={`text-sm font-bold tabular-nums ${getTransactionColor(tx.type)}`}>
              {getTransactionSign(tx.type)}{formatCurrency(tx.amount)}
            </span>
          </div>
        ))}
      </div>
      <div className="px-4 py-3 border-t border-white/5">
        <Link href="/transactions" className="flex items-center justify-center gap-1 text-xs text-white/40 hover:text-white transition-colors">
          Ver todas as transações
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  )
}
