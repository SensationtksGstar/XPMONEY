'use client'

import { useState, useEffect } from 'react'
import { X, Zap, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTransactions } from '@/hooks/useTransactions'
import { useAccounts }     from '@/hooks/useAccounts'
import { useCategories }   from '@/hooks/useCategories'
import { track }           from '@/lib/posthog'
import { cn }              from '@/lib/utils'
import type { Category, TransactionType } from '@/types'

interface Props {
  onClose:       () => void
  initialType?:  TransactionType
}

export function TransactionForm({ onClose, initialType = 'expense' }: Props) {
  const { createTransaction }               = useTransactions()
  const { defaultAccount }                  = useAccounts()
  const { byType }                          = useCategories()
  const [type, setType]                 = useState<TransactionType>(initialType)
  const [amount, setAmount]             = useState('')
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [description, setDescription]   = useState('')
  const [date, setDate]                 = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading]           = useState(false)
  const [xpGained, setXpGained]         = useState<number | null>(null)
  const [step, setStep]                 = useState<1 | 2>(1)

  // Fechar com Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const categories = byType(type)

  function handleCategorySelect(cat: Category) {
    setSelectedCategory(cat)
    // mobile: avança automaticamente para step 2
    if (window.innerWidth < 640) setStep(2)
  }

  function handleTypeChange(t: TransactionType) {
    setType(t)
    setSelectedCategory(null) // reset category when type changes
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || !selectedCategory) return
    setLoading(true)
    try {
      await createTransaction({
        amount:      parseFloat(amount),
        type,
        category_id: selectedCategory.id,   // ✅ use UUID, not name
        description,
        date,
        account_id:  defaultAccount?.id ?? '',
      })
      track.transaction_created(type, selectedCategory.name, parseFloat(amount))
      setXpGained(10)
      setTimeout(onClose, 1000)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {/* ── Backdrop + centering container ── */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm
                   flex items-end sm:items-center sm:justify-center sm:p-4"
      >
        {/* ── Sheet / Modal ── */}
        <motion.div
          key="sheet"
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="w-full sm:max-w-md bg-[#0f1623] border border-white/10 overflow-hidden
                     rounded-t-3xl sm:rounded-2xl"
          style={{ maxHeight: '92dvh' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Handle bar (mobile) */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="w-10 h-1 bg-white/20 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
            <div className="flex items-center gap-3">
              {step === 2 && (
                <button
                  onClick={() => setStep(1)}
                  className="sm:hidden text-white/40 hover:text-white transition-colors"
                >
                  <ChevronDown className="w-5 h-5 rotate-90" />
                </button>
              )}
              <h2 className="font-bold text-white text-lg">Nova transação</h2>
            </div>
            <button onClick={onClose} className="text-white/40 hover:text-white transition-colors p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="overflow-y-auto" style={{ maxHeight: 'calc(92dvh - 80px)' }}>
            <div className="p-5 space-y-4">

              {/* STEP 1: Tipo + Categoria */}
              <div className={cn(step === 2 && 'hidden sm:block')}>

                {/* Tipo */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-2xl mb-4">
                  {(['expense', 'income'] as TransactionType[]).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleTypeChange(t)}
                      className={cn(
                        'py-3 rounded-xl text-sm font-bold transition-all active:scale-95',
                        type === t
                          ? t === 'expense'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : 'text-white/50',
                      )}
                    >
                      {t === 'expense' ? '− Despesa' : '+ Receita'}
                    </button>
                  ))}
                </div>

                {/* Categorias — grid 4 colunas */}
                <p className="text-xs text-white/40 mb-3 font-medium uppercase tracking-wider">Categoria</p>
                <div className="grid grid-cols-4 gap-2">
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleCategorySelect(cat)}
                      className={cn(
                        'flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all active:scale-95',
                        selectedCategory?.id === cat.id
                          ? 'border-green-500/60 bg-green-500/15 text-white'
                          : 'border-white/8 bg-white/4 text-white/60 hover:border-white/20 hover:text-white',
                      )}
                    >
                      <span className="text-2xl leading-none">{cat.icon}</span>
                      <span className="text-[10px] font-medium text-center leading-tight truncate w-full">
                        {cat.name}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Próximo (mobile) */}
                {selectedCategory && (
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="sm:hidden w-full mt-4 bg-green-500 hover:bg-green-400 text-black font-bold py-4 rounded-2xl transition-all active:scale-95"
                  >
                    Continuar →
                  </button>
                )}
              </div>

              {/* STEP 2: Valor + detalhes */}
              <div className={cn(step === 1 && 'hidden sm:block')}>

                {/* Categoria selecionada (resumo mobile) */}
                {selectedCategory && (
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="sm:hidden w-full flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 mb-4 text-left"
                  >
                    <span className="text-2xl">{selectedCategory.icon}</span>
                    <div className="flex-1">
                      <p className="text-xs text-white/40">Categoria</p>
                      <p className="text-sm font-semibold text-white">{selectedCategory.name}</p>
                    </div>
                    <ChevronDown className="w-4 h-4 text-white/30 -rotate-90" />
                  </button>
                )}

                {/* Valor */}
                <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus-within:border-green-500/50 transition-colors mb-4">
                  <p className="text-xs text-white/40 mb-2">Valor</p>
                  <div className="flex items-center gap-2">
                    <span className="text-white/40 font-bold text-2xl">€</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0.01"
                      step="0.01"
                      placeholder="0,00"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      className="flex-1 bg-transparent text-white text-4xl font-bold placeholder-white/15 outline-none"
                      required
                      autoFocus={step === 2}
                    />
                  </div>
                </div>

                {/* Descrição */}
                <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-3 focus-within:border-white/20 transition-colors mb-4">
                  <p className="text-xs text-white/40 mb-1">Descrição <span className="text-white/20">(opcional)</span></p>
                  <input
                    type="text"
                    placeholder="Ex: Almoço, Netflix, Gasolina..."
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="w-full bg-transparent text-white placeholder-white/25 outline-none text-sm py-1"
                  />
                </div>

                {/* Data */}
                <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-3 focus-within:border-white/20 transition-colors mb-4">
                  <p className="text-xs text-white/40 mb-1">Data</p>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full bg-transparent text-white outline-none text-sm py-1"
                  />
                </div>

                {/* XP feedback */}
                {xpGained && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center justify-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl py-3 mb-4"
                  >
                    <Zap className="w-4 h-4 text-yellow-400" />
                    <span className="text-yellow-400 font-bold">+{xpGained} XP ganhos!</span>
                  </motion.div>
                )}

                {/* No account warning */}
                {!defaultAccount && (
                  <p className="text-xs text-yellow-400/80 text-center mb-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-2">
                    Nenhuma conta configurada. Completa o onboarding.
                  </p>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading || !amount || !selectedCategory || !defaultAccount}
                  className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold py-4 rounded-2xl transition-all text-base active:scale-95"
                >
                  {loading ? '⚡ A guardar...' : 'Guardar transação'}
                </button>
              </div>

            </div>
            {/* Safe area bottom (iPhone) */}
            <div style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} />
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
