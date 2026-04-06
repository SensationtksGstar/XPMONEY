'use client'

import { useState } from 'react'
import { motion }   from 'framer-motion'
import { TrendingDown, TrendingUp, Target } from 'lucide-react'
import { TransactionForm } from '@/components/transactions/TransactionForm'
import type { TransactionType } from '@/types'
import Link from 'next/link'

const ACTIONS = [
  {
    label:   'Despesa',
    icon:    TrendingDown,
    type:    'expense' as TransactionType,
    color:   'text-red-400',
    bg:      'bg-red-500/10 border-red-500/20 hover:border-red-500/40',
    active:  'bg-red-500/20 border-red-500/40',
  },
  {
    label:   'Receita',
    icon:    TrendingUp,
    type:    'income' as TransactionType,
    color:   'text-green-400',
    bg:      'bg-green-500/10 border-green-500/20 hover:border-green-500/40',
    active:  'bg-green-500/20 border-green-500/40',
  },
]

export function QuickActions() {
  const [formType, setFormType] = useState<TransactionType | null>(null)

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {ACTIONS.map((a, i) => {
          const Icon = a.icon
          return (
            <motion.button
              key={a.type}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setFormType(a.type)}
              className={`flex flex-col items-center gap-1.5 py-3.5 px-2 rounded-2xl border transition-all ${a.bg}`}
            >
              <Icon className={`w-5 h-5 ${a.color}`} />
              <span className={`text-xs font-semibold ${a.color}`}>{a.label}</span>
            </motion.button>
          )
        })}

        {/* Goals shortcut */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Link
            href="/goals"
            className="flex flex-col items-center gap-1.5 py-3.5 px-2 rounded-2xl border transition-all bg-blue-500/10 border-blue-500/20 hover:border-blue-500/40 w-full"
          >
            <Target className="w-5 h-5 text-blue-400" />
            <span className="text-xs font-semibold text-blue-400">Objetivo</span>
          </Link>
        </motion.div>
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
