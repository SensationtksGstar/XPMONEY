'use client'

import { useState } from 'react'
import { X, Zap }  from 'lucide-react'
import { motion }  from 'framer-motion'
import { useTransactions } from '@/hooks/useTransactions'
import { DEFAULT_CATEGORIES } from '@/types'
import { track } from '@/lib/posthog'
import type { TransactionType } from '@/types'

interface Props { onClose: () => void }

export function TransactionForm({ onClose }: Props) {
  const { createTransaction } = useTransactions()
  const [type, setType]       = useState<TransactionType>('expense')
  const [amount, setAmount]   = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate]       = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [xpGained, setXpGained] = useState<number | null>(null)

  const categories = DEFAULT_CATEGORIES.filter(
    c => c.transaction_type === type || c.transaction_type === 'both'
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || !category) return

    setLoading(true)
    try {
      await createTransaction({
        amount:      parseFloat(amount),
        type,
        category_id: category,
        description,
        date,
        account_id:  'default',
      })

      track.transaction_created(type, category, parseFloat(amount))
      setXpGained(10)

      setTimeout(() => {
        onClose()
      }, 1200)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="w-full max-w-md bg-[#0f1623] border border-white/10 rounded-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h2 className="font-bold text-white">Nova transação</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Tipo */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-xl">
            {(['expense', 'income'] as TransactionType[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => { setType(t); setCategory('') }}
                className={`py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  type === t
                    ? t === 'expense'
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                      : 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                {t === 'expense' ? '− Despesa' : '+ Receita'}
              </button>
            ))}
          </div>

          {/* Valor */}
          <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus-within:border-green-500/50 transition-colors">
            <label className="text-xs text-white/40 block mb-1">Valor</label>
            <div className="flex items-center gap-2">
              <span className="text-white/40 font-medium text-lg">€</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0,00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="flex-1 bg-transparent text-white text-2xl font-bold placeholder-white/20 outline-none"
                required
                autoFocus
              />
            </div>
          </div>

          {/* Categoria */}
          <div>
            <label className="text-xs text-white/40 block mb-2">Categoria</label>
            <div className="grid grid-cols-4 gap-2">
              {categories.slice(0, 8).map(cat => (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => setCategory(cat.name)}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs transition-all ${
                    category === cat.name
                      ? 'border-green-500/50 bg-green-500/10 text-white'
                      : 'border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white'
                  }`}
                >
                  <span className="text-xl">{cat.icon}</span>
                  <span className="truncate w-full text-center">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Descrição */}
          <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus-within:border-white/20 transition-colors">
            <label className="text-xs text-white/40 block mb-1">Descrição (opcional)</label>
            <input
              type="text"
              placeholder="Ex: Almoço com amigos"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-transparent text-white placeholder-white/30 outline-none text-sm"
            />
          </div>

          {/* Data */}
          <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus-within:border-white/20 transition-colors">
            <label className="text-xs text-white/40 block mb-1">Data</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-transparent text-white outline-none text-sm"
            />
          </div>

          {/* XP feedback */}
          {xpGained && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center justify-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl py-3"
            >
              <Zap className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-400 font-bold text-sm">+{xpGained} XP ganhos!</span>
            </motion.div>
          )}

          <button
            type="submit"
            disabled={loading || !amount || !category}
            className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold py-4 rounded-xl transition-all text-sm"
          >
            {loading ? 'A guardar...' : 'Guardar transação'}
          </button>
        </form>
      </motion.div>
    </div>
  )
}
