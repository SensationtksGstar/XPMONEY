'use client'

import { useState } from 'react'
import { Trash2 }   from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTransactions }   from '@/hooks/useTransactions'
import { useToast }          from '@/components/ui/toaster'
import { CategoryIcon }      from '@/components/ui/CategoryIcon'
import {
  formatCurrency, formatDate, getTransactionColor,
  getTransactionSign, groupBy,
} from '@/lib/utils'

interface Props {
  search:     string
  typeFilter: string
}

export function TransactionList({ search, typeFilter }: Props) {
  const { transactions, loading, deleteTransaction } = useTransactions()
  const { toast }   = useToast()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmId,  setConfirmId]  = useState<string | null>(null)

  const filtered = transactions.filter(tx => {
    const matchesType   = typeFilter === 'all' || tx.type === typeFilter
    const matchesSearch = !search ||
      tx.description.toLowerCase().includes(search.toLowerCase()) ||
      tx.category?.name.toLowerCase().includes(search.toLowerCase())
    return matchesType && matchesSearch
  })

  const grouped     = groupBy(filtered, 'date')
  const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await deleteTransaction(id)
      toast('Transação eliminada', 'success')
    } catch {
      toast('Erro ao eliminar', 'error')
    } finally {
      setDeletingId(null)
      setConfirmId(null)
    }
  }

  /* ── Loading skeleton ─────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse">
            <div className="h-3 bg-white/8 rounded w-24 mb-3" />
            <div className="glass-card divide-y divide-white/5">
              {[1, 2, 3].map(j => (
                <div key={j} className="flex items-center gap-3 p-4">
                  <div className="w-10 h-10 rounded-2xl bg-white/8" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-white/8 rounded w-2/3" />
                    <div className="h-2.5 bg-white/5 rounded w-1/3" />
                  </div>
                  <div className="h-4 bg-white/8 rounded w-16" />
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

  /* ── List ─────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-6 pb-4">
      {sortedDates.map(date => (
        <div key={date}>
          {/* Date header */}
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">
              {formatDate(date)}
            </h3>
            <span className="text-xs text-white/20">
              {grouped[date].length} transaç{grouped[date].length === 1 ? 'ão' : 'ões'}
            </span>
          </div>

          <div className="glass-card overflow-hidden divide-y divide-white/5">
            {grouped[date].map(tx => (
              <div key={tx.id} className="relative overflow-hidden group">
                <motion.div
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.02] transition-colors"
                  animate={{ x: confirmId === tx.id ? -72 : 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                >
                  {/* ── Category icon ── */}
                  <CategoryIcon
                    categoryName={tx.category?.name}
                    categoryColor={tx.category?.color}
                    type={tx.type}
                    size="md"
                  />

                  {/* ── Description + category ── */}
                  <button
                    className="flex-1 min-w-0 text-left"
                    onPointerDown={() => { if (confirmId === tx.id) setConfirmId(null) }}
                  >
                    <p className="text-sm font-medium text-white truncate leading-snug">
                      {tx.description || tx.category?.name || 'Transação'}
                    </p>
                    <p className="text-xs text-white/35 mt-0.5">{tx.category?.name}</p>
                  </button>

                  {/* ── Amount + delete trigger ── */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className={`text-sm font-bold tabular-nums ${getTransactionColor(tx.type)}`}>
                      {getTransactionSign(tx.type)}{formatCurrency(tx.amount)}
                    </span>
                    <button
                      onClick={() => setConfirmId(confirmId === tx.id ? null : tx.id)}
                      className="p-1.5 text-white/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all active:scale-90"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>

                {/* ── Delete confirm panel ── */}
                <AnimatePresence>
                  {confirmId === tx.id && (
                    <motion.button
                      initial={{ opacity: 0, x: 72 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 72 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                      onClick={() => handleDelete(tx.id)}
                      disabled={deletingId === tx.id}
                      className="absolute right-0 top-0 bottom-0 w-[72px] bg-red-500 hover:bg-red-400 flex flex-col items-center justify-center gap-0.5 text-white transition-colors"
                    >
                      {deletingId === tx.id ? (
                        <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          <span className="text-[10px] font-semibold">Apagar</span>
                        </>
                      )}
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
