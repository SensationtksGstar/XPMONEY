'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PlusCircle, Target, TrendingUp, Trash2, X, Check } from 'lucide-react'
import { useGoals }   from '@/hooks/useGoals'
import { useToast }   from '@/components/ui/toaster'
import { formatCurrency, formatPercent } from '@/lib/utils'

const GOAL_ICONS = ['🏠', '🚗', '✈️', '📱', '💻', '🎓', '💍', '🏖️', '💰', '🎯', '🛡️', '🏋️']

export default function GoalsPage() {
  const { goals, loading, createGoal, isCreating, deleteGoal } = useGoals()
  const { toast } = useToast()
  const [showForm, setShowForm]   = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Form state
  const [name,          setName]          = useState('')
  const [icon,          setIcon]          = useState('🎯')
  const [targetAmount,  setTargetAmount]  = useState('')
  const [deadline,      setDeadline]      = useState('')

  function resetForm() {
    setName(''); setIcon('🎯'); setTargetAmount(''); setDeadline('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !targetAmount) return
    try {
      await createGoal({
        name,
        icon,
        target_amount: parseFloat(targetAmount),
        deadline:      deadline || null,
      })
      toast('Objetivo criado! 🎯', 'success')
      setShowForm(false)
      resetForm()
    } catch {
      toast('Erro ao criar objetivo', 'error')
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await deleteGoal(id)
      toast('Objetivo eliminado', 'success')
    } catch {
      toast('Erro ao eliminar', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in-up pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Objetivos</h1>
          <p className="text-white/50 text-sm mt-0.5">Define metas, acompanha o progresso</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-green-500 hover:bg-green-400 text-black font-bold px-4 py-2.5 rounded-xl transition-all text-sm active:scale-95"
        >
          <PlusCircle className="w-4 h-4" />
          <span className="hidden sm:inline">Novo objetivo</span>
          <span className="sm:hidden">Novo</span>
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : goals.length === 0 ? (
        <div className="text-center py-16">
          <Target className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white/60 mb-2">Sem objetivos ainda</h3>
          <p className="text-white/40 text-sm mb-6 px-4">
            Define o teu primeiro objetivo e o Voltix ajuda-te a chegar lá.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-medium px-6 py-3 rounded-xl hover:bg-green-500/20 transition-colors"
          >
            Criar primeiro objetivo
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {goals.map(goal => {
            const progress = goal.target_amount > 0
              ? Math.min(100, (goal.current_amount / goal.target_amount) * 100)
              : 0
            const isComplete = progress >= 100

            return (
              <motion.div
                key={goal.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`bg-white/5 border rounded-xl p-5 transition-all ${
                  isComplete ? 'border-green-500/30' : 'border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{goal.icon}</span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-semibold text-white">{goal.name}</h3>
                        {isComplete && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-full">
                            <Check className="w-2.5 h-2.5" /> Completo
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white/40">
                        {goal.deadline ? `Prazo: ${goal.deadline}` : 'Sem prazo'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="text-right">
                      <div className="text-green-400 font-bold tabular-nums">{formatCurrency(goal.current_amount)}</div>
                      <div className="text-white/40 text-xs">de {formatCurrency(goal.target_amount)}</div>
                    </div>
                    <button
                      onClick={() => handleDelete(goal.id)}
                      disabled={deletingId === goal.id}
                      className="p-1.5 text-white/20 hover:text-red-400 transition-colors mt-0.5"
                    >
                      {deletingId === goal.id
                        ? <div className="w-3.5 h-3.5 border border-white/30 border-t-white rounded-full animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />
                      }
                    </button>
                  </div>
                </div>

                <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className={`absolute left-0 top-0 h-full rounded-full ${
                      isComplete ? 'bg-green-400' : 'bg-green-500'
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="text-xs text-white/40">
                    <TrendingUp className="w-3 h-3 inline mr-1" />
                    {formatPercent(progress)} concluído
                  </div>
                  {!isComplete && (
                    <div className="text-xs text-white/40">
                      Falta {formatCurrency(goal.target_amount - goal.current_amount)}
                    </div>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Bottom sheet — criar objetivo */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowForm(false); resetForm() }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-[#0d1424] border-t border-white/10 rounded-t-3xl sm:rounded-2xl sm:max-w-md sm:mx-auto sm:bottom-8 sm:left-1/2 sm:-translate-x-1/2"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1 sm:hidden">
                <div className="w-10 h-1 bg-white/20 rounded-full" />
              </div>

              <div className="px-5 pt-4 pb-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-bold text-white">Novo Objetivo</h2>
                  <button
                    onClick={() => { setShowForm(false); resetForm() }}
                    className="p-2 text-white/40 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Ícone */}
                  <div>
                    <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Ícone</label>
                    <div className="grid grid-cols-6 gap-2 mt-2">
                      {GOAL_ICONS.map(e => (
                        <button
                          key={e}
                          type="button"
                          onClick={() => setIcon(e)}
                          className={`h-10 rounded-xl text-xl transition-all ${
                            icon === e
                              ? 'bg-green-500/20 border border-green-500/50 scale-110'
                              : 'bg-white/5 border border-white/10 hover:bg-white/10'
                          }`}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Nome */}
                  <div>
                    <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Nome</label>
                    <input
                      type="text"
                      placeholder="Ex: Fundo de emergência"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="mt-1.5 w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 outline-none focus:border-green-500/50 text-sm"
                    />
                  </div>

                  {/* Valor alvo */}
                  <div>
                    <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Valor Alvo (€)</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={targetAmount}
                      onChange={e => setTargetAmount(e.target.value)}
                      className="mt-1.5 w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 outline-none focus:border-green-500/50 text-sm"
                    />
                  </div>

                  {/* Prazo */}
                  <div>
                    <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Prazo (opcional)</label>
                    <input
                      type="date"
                      value={deadline}
                      onChange={e => setDeadline(e.target.value)}
                      className="mt-1.5 w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white/70 outline-none focus:border-green-500/50 text-sm"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isCreating || !name || !targetAmount}
                    className="w-full py-3.5 bg-green-500 hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold rounded-xl transition-all active:scale-[0.98] text-sm"
                  >
                    {isCreating ? 'A criar...' : `Criar Objetivo ${icon}`}
                  </button>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
