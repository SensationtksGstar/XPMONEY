'use client'

import { useState, useEffect } from 'react'
import { X, Zap, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTransactions } from '@/hooks/useTransactions'
import { DEFAULT_CATEGORIES } from '@/types'
import { track }              from '@/lib/posthog'
import { cn }                 from '@/lib/utils'
import type { TransactionType } from '@/types'

interface Props {
  onClose:       () => void
  initialType?:  TransactionType
}

export function TransactionForm({ onClose, initialType = 'expense' }: Props) {
  const { createTransaction } = useTransactions()
  const [type, setType]             = useState<TransactionType>(initialType)
  const [amount, setAmount]         = useState('')
  const [category, setCategory]     = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate]             = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading]       = useState(false)
  const [xpGained, setXpGained]     = useState<number | null>(null)
  const [step, setStep]             = useState<1 | 2>(1) // mobile: 2 steps

  // Fechar com swipe-down ou Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const categories = DEFAULT_CATEGORIES.filter(
    c => c.transaction_type === type || c.transaction_type === 'both'
  )

  function handleCategorySelect(name: string) {
    setCategory(name)
    // mobile: avança automaticamente para step 2
    if (window.innerWidth < 640) setStep(2)
  }

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
      setTimeout(onClose, 1000)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
      />

      {/* Bottom sheet (mobile) / modal (desktop) */}
      <motion.div
        key="sheet"
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className={cn(
          'fixed z-50 bg-[#0f1623] border border-white/10 overflow-hidden',
          // Mobile: bottom sheet full width, arredondado em cima
          'bottom-0 left-0 right-0 rounded-t-3xl',
          // Desktop: modal centrado
          'sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2',
          'sm:w-full sm:max-w-md sm:rounded-2xl',
        )}
        style={{ maxHeight: '92dvh' }}
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

            {/* STEP 1: Tipo + Categoria (ou tudo no desktop) */}
            <div className={cn(step === 2 && 'hidden sm:block')}>

              {/* Tipo */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-2xl mb-4">
                {(['expense', 'income'] as TransactionType[]).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { setType(t); setCategory('') }}
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
                    key={cat.name}
                    type="button"
                    onClick={() => handleCategorySelect(cat.name)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all active:scale-95',
                      category === cat.name
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
              {category && (
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
              {category && (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="sm:hidden w-full flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 mb-4 text-left"
                >
                  <span className="text-2xl">
                    {categories.find(c => c.name === category)?.icon}
                  </span>
                  <div className="flex-1">
                    <p className="text-xs text-white/40">Categoria</p>
                    <p className="text-sm font-semibold text-white">{category}</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-white/30 -rotate-90" />
                </button>
              )}

              {/* Valor — input grande, teclado numérico mobile */}
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

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || !amount || !category}
                className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold py-4 rounded-2xl transition-all text-base active:scale-95"
              >
                {loading ? '⚡ A guardar...' : 'Guardar transação'}
              </button>
            </div>

          </div>
          {/* Safe area bottom (iPhone) */}
          <div className="pb-safe-area" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} />
        </form>
      </motion.div>
    </AnimatePresence>
  )
}
