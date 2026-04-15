'use client'

import { useState } from 'react'
import { Trash2 }   from 'lucide-react'

import { useTransactions }   from '@/hooks/useTransactions'
import { useToast }          from '@/components/ui/toaster'
import { CategoryIcon }      from '@/components/ui/CategoryIcon'
import { EmptyState }        from '@/components/ui/EmptyState'
import { ConfirmDialog }     from '@/components/ui/ConfirmDialog'
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
    const hasFilters = !!search || typeFilter !== 'all'
    return (
      <EmptyState
        icon={hasFilters ? '🔍' : '💸'}
        title={hasFilters ? 'Nenhuma transação encontrada' : 'Ainda sem transações'}
        description={hasFilters
          ? 'Tenta ajustar a pesquisa ou alterar os filtros para ver mais resultados.'
          : 'Regista a primeira transação para começares a ganhar XP e a construir o teu histórico financeiro.'
        }
      />
    )
  }

  const targetTx = confirmId ? filtered.find(t => t.id === confirmId) : null

  /* ── List ─────────────────────────────────────────────────────────── */
  return (
    <>
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
                <div key={tx.id} className="relative group">
                  <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.02] transition-colors">
                    {/* ── Category icon ── */}
                    <CategoryIcon
                      categoryName={tx.category?.name}
                      categoryColor={tx.category?.color}
                      type={tx.type}
                      size="md"
                    />

                    {/* ── Description + category ── */}
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-medium text-white truncate leading-snug">
                        {tx.description || tx.category?.name || 'Transação'}
                      </p>
                      <p className="text-xs text-white/35 mt-0.5">{tx.category?.name}</p>
                    </div>

                    {/* ── Amount + delete trigger ── */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className={`text-sm font-bold tabular-nums ${getTransactionColor(tx.type)}`}>
                        {getTransactionSign(tx.type)}{formatCurrency(tx.amount)}
                      </span>
                      {/* Touch target ≥44px. Visible on mobile; fades in on desktop hover. */}
                      <button
                        onClick={() => setConfirmId(tx.id)}
                        className="w-11 h-11 -mr-2 flex items-center justify-center text-white/30 hover:text-red-400 opacity-60 sm:opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all active:scale-90 rounded-xl hover:bg-red-500/10"
                        aria-label={`Eliminar transação ${tx.description || tx.category?.name || ''}`.trim()}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Proper confirmation dialog — replaces the ambiguous swipe panel */}
      <ConfirmDialog
        open={!!confirmId}
        title="Eliminar transação?"
        description={
          targetTx
            ? `"${targetTx.description || targetTx.category?.name || 'Transação'}" · ${formatCurrency(targetTx.amount)}. Esta ação não pode ser desfeita.`
            : 'Esta ação não pode ser desfeita.'
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        tone="danger"
        loading={!!deletingId}
        onConfirm={() => confirmId && handleDelete(confirmId)}
        onClose={() => { if (!deletingId) setConfirmId(null) }}
      />
    </>
  )
}
