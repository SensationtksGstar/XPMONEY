'use client'

import { useState, useEffect } from 'react'
import { X, Zap, ChevronDown, ScanLine, Crown, Lock } from 'lucide-react'
import { useTransactions }    from '@/hooks/useTransactions'
import { useAccounts }        from '@/hooks/useAccounts'
import { useCategories }      from '@/hooks/useCategories'
import { useUserPlan }        from '@/lib/contexts/UserPlanContext'
import { track }              from '@/lib/posthog'
import { cn }                 from '@/lib/utils'
import { ReceiptScanner }     from './ReceiptScanner'
import type { Category, TransactionType } from '@/types'
import type { ReceiptScanResult }         from '@/app/api/scan-receipt/route'
import Link                   from 'next/link'

interface Props {
  onClose:       () => void
  initialType?:  TransactionType
}

export function TransactionForm({ onClose, initialType = 'expense' }: Props) {
  const { createTransaction }              = useTransactions()
  const { defaultAccount }                 = useAccounts()
  const { byType }                         = useCategories()
  const { isFree }                         = useUserPlan()

  const [type,              setType]             = useState<TransactionType>(initialType)
  const [amount,            setAmount]           = useState('')
  const [selectedCategory,  setSelectedCategory] = useState<Category | null>(null)
  const [description,       setDescription]      = useState('')
  const [date,              setDate]             = useState(new Date().toISOString().split('T')[0])
  const [loading,           setLoading]          = useState(false)
  const [xpGained,          setXpGained]         = useState<number | null>(null)
  const [step,              setStep]             = useState<1 | 2>(1)
  const [showScanner,       setShowScanner]      = useState(false)
  const [showUpgradeTip,    setShowUpgradeTip]   = useState(false)

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const categories = byType(type)

  function handleCategorySelect(cat: Category) {
    setSelectedCategory(cat)
    if (window.innerWidth < 640) setStep(2)
  }

  function handleTypeChange(t: TransactionType) {
    setType(t)
    setSelectedCategory(null)
  }

  // ── Apply AI receipt scan result ─────────────────────────────────────────
  function handleScanResult(data: ReceiptScanResult) {
    setShowScanner(false)

    if (data.amount !== null)  setAmount(String(data.amount))
    if (data.date)             setDate(data.date)
    if (data.description)      setDescription(data.description)
    else if (data.merchant)    setDescription(data.merchant)

    // Try to match category_hint to existing categories
    if (data.category_hint) {
      const allCats = byType('expense').concat(byType('income')).concat(byType('both' as TransactionType))
      const match   = allCats.find(c =>
        c.name.toLowerCase().includes(data.category_hint!.toLowerCase()) ||
        data.category_hint!.toLowerCase().includes(c.name.toLowerCase())
      )
      if (match) {
        setSelectedCategory(match)
        setType(match.transaction_type === 'income' ? 'income' : 'expense')
      }
    }

    // On mobile, jump to step 2 if we have key data
    if (data.amount !== null && window.innerWidth < 640) setStep(2)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || !selectedCategory) return
    setLoading(true)
    try {
      await createTransaction({
        amount:      parseFloat(amount),
        type,
        category_id: selectedCategory.id,
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
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm animate-fade-in
                   flex items-end sm:items-center sm:justify-center sm:p-4"
      >
        <div
          className="w-full sm:max-w-md bg-[#0f1623] border border-white/10 overflow-hidden
                     rounded-t-3xl sm:rounded-2xl animate-slide-up"
          style={{ maxHeight: '92dvh' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Handle bar */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="w-10 h-1 bg-white/20 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
            <div className="flex items-center gap-3">
              {step === 2 && !showScanner && (
                <button
                  onClick={() => setStep(1)}
                  className="sm:hidden text-white/40 hover:text-white transition-colors"
                >
                  <ChevronDown className="w-5 h-5 rotate-90" />
                </button>
              )}
              {showScanner && (
                <button
                  onClick={() => setShowScanner(false)}
                  className="text-white/40 hover:text-white transition-colors"
                >
                  <ChevronDown className="w-5 h-5 rotate-90" />
                </button>
              )}
              <h2 className="font-bold text-white text-lg">
                {showScanner ? 'Digitalizar Fatura' : 'Nova transação'}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {/* Scan button — gated */}
              {!showScanner && (
                <button
                  onClick={() => {
                    if (isFree) { setShowUpgradeTip(t => !t); return }
                    setShowScanner(true)
                  }}
                  title="Digitalizar fatura com IA"
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all',
                    isFree
                      ? 'bg-purple-500/15 border border-purple-500/25 text-purple-400'
                      : 'bg-purple-500/20 border border-purple-500/35 text-purple-300 hover:bg-purple-500/30',
                  )}
                >
                  {isFree ? <Lock className="w-3 h-3" /> : <ScanLine className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">Scan IA</span>
                  {isFree && <Crown className="w-3 h-3" />}
                </button>
              )}
              <button onClick={onClose} className="text-white/40 hover:text-white transition-colors p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Upgrade tip for free users */}
            {showUpgradeTip && (
              <div className="overflow-hidden border-b border-white/5 animate-fade-in">
                <div className="px-5 py-3 bg-purple-500/10 flex items-center gap-3">
                  <Crown className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  <p className="text-xs text-white/70 flex-1">
                    Scanner de faturas disponível a partir do <strong className="text-purple-300">plano Plus</strong>
                  </p>
                  <Link
                    href="/settings/billing"
                    onClick={onClose}
                    className="text-[10px] font-bold text-black bg-purple-400 px-2.5 py-1 rounded-lg flex-shrink-0"
                  >
                    Upgrade
                  </Link>
                </div>
              </div>
            )}

          <div className="overflow-y-auto" style={{ maxHeight: 'calc(92dvh - 80px)' }}>

            {/* ── SCANNER VIEW ── */}
            {showScanner ? (
              <div className="p-5">
                <ReceiptScanner
                  onResult={handleScanResult}
                  onClose={() => setShowScanner(false)}
                />
              </div>
            ) : (
              /* ── FORM VIEW ── */
              <form onSubmit={handleSubmit}>
                <div className="p-5 space-y-4">

                  {/* STEP 1: Type + Category */}
                  <div className={cn(step === 2 && 'hidden sm:block')}>
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

                  {/* STEP 2: Amount + details */}
                  <div className={cn(step === 1 && 'hidden sm:block')}>

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

                    {/* Amount */}
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

                    {/* Description */}
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

                    {/* Date */}
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
                      <div className="flex items-center justify-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl py-3 mb-4 animate-fade-in-up">
                        <Zap className="w-4 h-4 text-yellow-400" />
                        <span className="text-yellow-400 font-bold">+{xpGained} XP ganhos!</span>
                      </div>
                    )}

                    {!defaultAccount && (
                      <p className="text-xs text-yellow-400/80 text-center mb-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-2">
                        Nenhuma conta configurada. Completa o onboarding.
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={loading || !amount || !selectedCategory || !defaultAccount}
                      className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold py-4 rounded-2xl transition-all text-base active:scale-95"
                    >
                      {loading ? '⚡ A guardar...' : 'Guardar transação'}
                    </button>
                  </div>

                </div>
                <div style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} />
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
