'use client'

import { useState }               from 'react'
import { TrendingDown, TrendingUp, PiggyBank } from 'lucide-react'
import { TransactionForm }         from '@/components/transactions/TransactionForm'
import type { TransactionType }    from '@/types'
import Link                        from 'next/link'

const ACTIONS = [
  {
    label: 'Despesa',
    icon:  TrendingDown,
    type:  'expense' as TransactionType,
    color: 'text-red-400',
    bg:    'bg-red-500/10 border-red-500/20 active:bg-red-500/20',
  },
  {
    label: 'Receita',
    icon:  TrendingUp,
    type:  'income' as TransactionType,
    color: 'text-green-400',
    bg:    'bg-green-500/10 border-green-500/20 active:bg-green-500/20',
  },
]

export function QuickActions() {
  const [formType, setFormType] = useState<TransactionType | null>(null)

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {ACTIONS.map(a => {
          const Icon = a.icon
          return (
            <button
              key={a.type}
              onClick={() => setFormType(a.type)}
              className={`flex flex-col items-center gap-1.5 py-3.5 px-2 rounded-2xl border transition-colors active:scale-95 ${a.bg}`}
            >
              <Icon className={`w-5 h-5 ${a.color}`} />
              <span className={`text-xs font-semibold ${a.color}`}>{a.label}</span>
            </button>
          )
        })}

        {/* Poupança shortcut */}
        <Link
          href="/goals"
          className="flex flex-col items-center gap-1.5 py-3.5 px-2 rounded-2xl border transition-colors active:scale-95 bg-blue-500/10 border-blue-500/20 active:bg-blue-500/20"
        >
          <PiggyBank className="w-5 h-5 text-blue-400" />
          <span className="text-xs font-semibold text-blue-400">Poupança</span>
        </Link>
      </div>

      {formType && (
        <TransactionForm
          initialType={formType}
          onClose={() => setFormType(null)}
        />
      )}
    </>
  )
}
