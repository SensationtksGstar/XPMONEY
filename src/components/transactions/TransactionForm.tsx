'use client'

import { useState, useEffect, useId, useMemo, useRef } from 'react'
import { X, Zap, ChevronDown, ScanLine, Crown, Lock, Plus } from 'lucide-react'
import { useQueryClient }     from '@tanstack/react-query'
import { useTransactions }    from '@/hooks/useTransactions'
import { useAccounts }        from '@/hooks/useAccounts'
import { useCategories }      from '@/hooks/useCategories'
import { useUserPlan }        from '@/lib/contexts/UserPlanContext'
import { track }              from '@/lib/posthog'
import { cn }                 from '@/lib/utils'
import { toNumber }           from '@/lib/safeNumber'
import { ReceiptScanner }     from './ReceiptScanner'
import { XP_REWARDS }         from '@/types'
import type { Category, TransactionType } from '@/types'
import type { ReceiptScanResult }         from '@/app/api/scan-receipt/route'
import Link                   from 'next/link'
import { useT }               from '@/lib/i18n/LocaleProvider'

interface Props {
  onClose:       () => void
  initialType?:  TransactionType
}

/**
 * Accepts both PT ("1.234,56") and EN ("1,234.56") decimal conventions,
 * plus the plain "12.34" / "12,34" short forms. Returns NaN on failure.
 */
function parseAmountLocale(raw: string): number {
  const trimmed = raw.trim().replace(/\s+/g, '')
  if (!trimmed) return NaN
  // If both separators appear, the rightmost one is the decimal separator.
  const lastDot   = trimmed.lastIndexOf('.')
  const lastComma = trimmed.lastIndexOf(',')
  let normalised: string
  if (lastDot === -1 && lastComma === -1) {
    normalised = trimmed
  } else if (lastComma > lastDot) {
    // PT: comma is decimal, dots are thousands
    normalised = trimmed.replace(/\./g, '').replace(',', '.')
  } else {
    // EN: dot is decimal, commas are thousands
    normalised = trimmed.replace(/,/g, '')
  }
  return Number(normalised)
}

/** ISO date (YYYY-MM-DD) for today / N days ago — same UTC convention the
 *  form always used for its default date. */
function isoDaysAgo(days = 0): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().split('T')[0]
}

// Quick-pick palette for the inline category creator. Colors are persisted
// per-category DATA (not chrome), so a free range is fine — the green entry
// is the system accent so a "money"-ish category can match the brand.
const NEWCAT_EMOJIS = ['🛒', '🍽️', '☕', '🐾', '🎮', '💼', '🎓', '💊', '🚌', '🎁', '🏋️', '✈️']
const NEWCAT_COLORS = ['#f97316', '#eab308', '#27c26b', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#94a3b8']

/** Haptic tick nos momentos de decisão (Android Chrome; iOS ignora em
 *  silêncio). O padrão dos neo-bancos: feedback físico em seleção/sucesso. */
function buzz(ms: number) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try { navigator.vibrate(ms) } catch { /* unsupported — ignore */ }
  }
}

/** Grupo "repetir com um toque" derivado do histórico do próprio user. */
interface RepeatSuggestion {
  key:         string
  description: string
  category:    Category
  amount:      number
  count:       number
  lastDate:    string
}

/** Valor numérico → string de input em convenção PT (vírgula decimal). */
function amountToInput(n: number): string {
  return n > 0 ? String(n).replace('.', ',') : ''
}

export function TransactionForm({ onClose, initialType = 'expense' }: Props) {
  const { transactions, createTransaction } = useTransactions()
  const { defaultAccount }                 = useAccounts()
  const { byType }                         = useCategories()
  const { isFree }                         = useUserPlan()
  const queryClient                        = useQueryClient()
  const titleId                            = useId()
  const t                                  = useT()

  const [type,              setType]             = useState<TransactionType>(initialType)
  const [amount,            setAmount]           = useState('')
  const [amountFocus,       setAmountFocus]      = useState(false)
  const [selectedCategory,  setSelectedCategory] = useState<Category | null>(null)
  const [description,       setDescription]      = useState('')
  const [descFocus,         setDescFocus]        = useState(false)
  const [date,              setDate]             = useState(isoDaysAgo(0))
  const [showDatePicker,    setShowDatePicker]   = useState(false)
  const [loading,           setLoading]          = useState(false)
  const [formError,         setFormError]        = useState<string | null>(null)
  const [xpGained,          setXpGained]         = useState<number | null>(null)
  const [step,              setStep]             = useState<1 | 2>(1)
  const [showScanner,       setShowScanner]      = useState(false)
  const [showUpgradeTip,    setShowUpgradeTip]   = useState(false)

  const amountRef  = useRef<HTMLInputElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Foco real ao ENTRAR no passo 2 (mobile) — o antigo autoFocus={step===2}
  // avaliava no mount (step=1, elemento sempre montado) e nunca focava, por
  // isso o teclado do OS não abria sozinho. Efeito dispara na transição.
  useEffect(() => {
    if (step === 2) amountRef.current?.focus()
  }, [step])

  // O timer de auto-fecho do sucesso não pode sobreviver ao unmount.
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current) }, [])

  // Inline category creator ("pouco personalizável" fix — July 2026)
  const [showNewCat,  setShowNewCat]  = useState(false)
  const [newCatName,  setNewCatName]  = useState('')
  const [newCatIcon,  setNewCatIcon]  = useState(NEWCAT_EMOJIS[0])
  const [newCatColor, setNewCatColor] = useState(NEWCAT_COLORS[4])
  const [newCatBusy,  setNewCatBusy]  = useState(false)
  const [newCatError, setNewCatError] = useState<string | null>(null)

  const todayISO     = isoDaysAgo(0)
  const yesterdayISO = isoDaysAgo(1)

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Personal ordering: the user's most-used categories come first (counted
  // from the shared ['transactions'] cache — zero extra network). Sort is
  // stable, so unused categories keep the API order (defaults, A-Z).
  const usageByName = useMemo(() => {
    const m = new Map<string, number>()
    for (const tx of transactions) {
      const name = tx.category?.name
      if (name) m.set(name, (m.get(name) ?? 0) + 1)
    }
    return m
  }, [transactions])

  const categories = useMemo(
    () => [...byType(type)].sort(
      (a, b) => (usageByName.get(b.name) ?? 0) - (usageByName.get(a.name) ?? 0)
    ),
    // byType is recreated per render but derives only from the query cache;
    // type + usage + the underlying list length cover real invalidations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [type, usageByName, byType(type).length]
  )

  // "Repetir com um toque" (padrão Monzo/Revolut): agrupa o histórico por
  // descrição+categoria, ordena por frequência e recência, top 4 do tipo
  // ativo. O cache vem ordenado por data desc, por isso o primeiro grupo
  // visto guarda o valor/casing mais RECENTES dessa despesa recorrente.
  const suggestions = useMemo<RepeatSuggestion[]>(() => {
    const groups = new Map<string, RepeatSuggestion>()
    for (const tx of transactions.slice(0, 400)) {
      if (tx.type !== type || !tx.category) continue
      const desc = (tx.description ?? '').trim()
      if (!desc) continue
      const key = `${desc.toLowerCase()}|${tx.category.id}`
      const existing = groups.get(key)
      if (existing) existing.count++
      else groups.set(key, {
        key,
        description: desc,
        category:    tx.category,
        amount:      toNumber(tx.amount, 0),
        count:       1,
        lastDate:    tx.date,
      })
    }
    return [...groups.values()]
      .sort((a, b) => b.count - a.count || (a.lastDate < b.lastDate ? 1 : -1))
      .slice(0, 4)
  }, [transactions, type])

  // Autocomplete de descrição (padrão YNAB): históricos distintos que
  // contêm o que está escrito, excluindo o match exato. Máx. 4.
  const descSuggestions = useMemo<string[]>(() => {
    const q = description.trim().toLowerCase()
    if (q.length < 2) return []
    const seen = new Set<string>()
    const out: string[] = []
    for (const tx of transactions) {
      const d = (tx.description ?? '').trim()
      if (!d) continue
      const dl = d.toLowerCase()
      if (dl === q || !dl.includes(q) || seen.has(dl)) continue
      seen.add(dl)
      out.push(d)
      if (out.length >= 4) break
    }
    return out
  }, [description, transactions])

  function handleCategorySelect(cat: Category) {
    setSelectedCategory(cat)
    setFormError(null)
    buzz(12)
    if (window.innerWidth < 640) setStep(2)
  }

  /** Chip "frequente": pré-preenche TUDO e salta para o valor. */
  function applySuggestion(s: RepeatSuggestion) {
    setSelectedCategory(s.category)
    setDescription(s.description)
    setAmount(amountToInput(s.amount))
    setFormError(null)
    buzz(12)
    if (window.innerWidth < 640) setStep(2)
  }

  function handleTypeChange(next: TransactionType) {
    setType(next)
    setSelectedCategory(null)
    setShowNewCat(false)
  }

  // ── Inline category creation ─────────────────────────────────────────────
  async function handleCreateCategory() {
    const name = newCatName.trim()
    if (!name) { setNewCatError(t('txform.newcat_name_ph')); return }
    setNewCatBusy(true)
    setNewCatError(null)
    try {
      const res  = await fetch('/api/categories', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, icon: newCatIcon, color: newCatColor, transaction_type: type }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setNewCatError(json?.error ?? t('txform.newcat_err'))
        return
      }
      await queryClient.invalidateQueries({ queryKey: ['categories'] })
      setShowNewCat(false)
      setNewCatName('')
      if (json?.data) handleCategorySelect(json.data as Category)
    } catch (err) {
      console.warn('[txform] create category failed:', err)
      setNewCatError(t('txform.newcat_err'))
    } finally {
      setNewCatBusy(false)
    }
  }

  // ── Apply AI receipt scan result ─────────────────────────────────────────
  function handleScanResult(data: ReceiptScanResult) {
    setShowScanner(false)

    if (data.amount !== null)  setAmount(String(data.amount))
    if (data.date) {
      setDate(data.date)
      if (data.date !== todayISO && data.date !== yesterdayISO) setShowDatePicker(true)
    }
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
    // Enter durante o painel de sucesso re-submeteria a mesma transação.
    if (xpGained !== null || loading) return
    // Inline validation — never a disabled dead-end button (repo rule:
    // a disabled tap on mobile gives zero feedback and reads as "broken").
    if (!selectedCategory) {
      setFormError(t('txform.err_category'))
      if (window.innerWidth < 640) setStep(1)
      return
    }
    const parsedAmount = parseAmountLocale(amount)
    if (!amount || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFormError(t('txform.err_amount'))
      return
    }
    setFormError(null)
    setLoading(true)
    try {
      await createTransaction({
        amount:      parsedAmount,
        type,
        category_id: selectedCategory.id,
        description,
        date,
        account_id:  defaultAccount?.id ?? '',
      })
      track.transaction_created(type, selectedCategory.name, parsedAmount)
      // O valor REAL do servidor (XP_REWARDS.TRANSACTION_REGISTERED) — o
      // banner mostrava 10 hardcoded enquanto o backend dava 15.
      setXpGained(XP_REWARDS.TRANSACTION_REGISTERED)
      buzz(20)
      // Auto-fecho com margem para o user optar por "Adicionar outra".
      closeTimer.current = setTimeout(onClose, 2400)
    } catch (err) {
      console.warn('[txform] save failed:', err)
      setFormError(t('txform.err_save'))
    } finally {
      setLoading(false)
    }
  }

  /** Sessão de registo em lote (padrão YNAB): mantém tipo/categoria/data,
   *  limpa valor+descrição e volta a focar o valor. */
  function handleAddAnother() {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setXpGained(null)
    setAmount('')
    setDescription('')
    setFormError(null)
    amountRef.current?.focus()
  }

  const isExpense = type === 'expense'

  return (
    <>
      <div
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm animate-fade-in
                   overflow-y-auto
                   flex items-end sm:items-start sm:justify-center sm:py-8 sm:px-4"
      >
        <div
          className="w-full sm:max-w-md bg-surface-1 border border-white/10 overflow-hidden
                     rounded-t-3xl sm:rounded-2xl animate-slide-up shadow-[0_-8px_40px_rgba(0,0,0,0.5)] sm:shadow-2xl
                     flex flex-col max-h-[92dvh] sm:max-h-none sm:my-auto"
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
                  className="sm:hidden w-8 h-8 -ml-1 flex items-center justify-center rounded-full text-white/40 hover:text-white active:bg-white/10 transition-colors"
                >
                  <ChevronDown className="w-5 h-5 rotate-90" />
                </button>
              )}
              {showScanner && (
                <button
                  onClick={() => setShowScanner(false)}
                  className="w-8 h-8 -ml-1 flex items-center justify-center rounded-full text-white/40 hover:text-white active:bg-white/10 transition-colors"
                >
                  <ChevronDown className="w-5 h-5 rotate-90" />
                </button>
              )}
              <h2 id={titleId} className="font-bold text-white text-lg">
                {showScanner ? t('txform.title_scan') : t('txform.title_new')}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {/* Scan button — gated */}
              {!showScanner && (
                <button
                  onClick={() => {
                    if (isFree) { setShowUpgradeTip(v => !v); return }
                    setShowScanner(true)
                  }}
                  title={t('txform.scan_title')}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all',
                    isFree
                      ? 'bg-purple-500/15 border border-purple-500/25 text-purple-400'
                      : 'bg-purple-500/20 border border-purple-500/35 text-purple-300 hover:bg-purple-500/30',
                  )}
                >
                  {isFree ? <Lock className="w-3 h-3" /> : <ScanLine className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{t('txform.scan_label')}</span>
                  {isFree && <Crown className="w-3 h-3" />}
                </button>
              )}
              <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full text-white/40 hover:text-white active:bg-white/10 transition-colors">
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
                  {t('txform.scan_upgrade_msg')} <strong className="text-purple-300">{t('txform.scan_upgrade_plan')}</strong>
                </p>
                <Link
                  href="/settings/billing"
                  onClick={onClose}
                  className="text-[11px] font-bold text-black bg-purple-400 px-2.5 py-1 rounded-lg flex-shrink-0"
                >
                  {t('txform.scan_upgrade_cta')}
                </Link>
              </div>
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto">

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
                    {/* Segmented type control — semantic tints (red = out,
                        green = in), neutral resting track. */}
                    <div className="grid grid-cols-2 gap-1 p-1 bg-surface-2/70 border border-white/[0.06] rounded-2xl mb-5">
                      {(['expense', 'income'] as TransactionType[]).map(opt => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => handleTypeChange(opt)}
                          aria-pressed={type === opt}
                          className={cn(
                            'min-h-[44px] rounded-xl text-sm font-bold transition-all active:scale-[0.98]',
                            type === opt
                              ? opt === 'expense'
                                ? 'bg-red-500/15 text-red-300 border border-red-500/30 shadow-[0_1px_2px_rgba(0,0,0,0.4)]'
                                : 'bg-green-500/15 text-green-300 border border-green-500/30 shadow-[0_1px_2px_rgba(0,0,0,0.4)]'
                              : 'text-white/45 border border-transparent hover:text-white/70',
                          )}
                        >
                          {opt === 'expense' ? t('txform.type_expense') : t('txform.type_income')}
                        </button>
                      ))}
                    </div>

                    {/* Frequentes — repetir uma despesa habitual com UM toque. Deriva do
                        histórico do próprio user; some quando não há histórico. */}
                    {suggestions.length > 0 && !showNewCat && (
                      <div className="mb-5">
                        <p className="text-[11px] text-white/40 mb-2 font-semibold uppercase tracking-wider">{t('txform.suggestions_label')}</p>
                        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
                          {suggestions.map(s => (
                            <button
                              key={s.key}
                              type="button"
                              onClick={() => applySuggestion(s)}
                              aria-label={t('txform.suggestion_aria', { desc: s.description })}
                              className="flex items-center gap-2 flex-shrink-0 min-h-[44px] pl-1.5 pr-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:border-white/25 active:scale-95 transition-all"
                            >
                              <span
                                className="w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0"
                                style={{ backgroundColor: `${s.category.color}1f` }}
                                aria-hidden
                              >
                                {s.category.icon}
                              </span>
                              <span className="text-sm text-white/85 font-medium max-w-[110px] truncate">{s.description}</span>
                              {s.amount > 0 && (
                                <span className="text-xs text-white/45 tabular-nums flex-shrink-0">{amountToInput(s.amount)} €</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <p className="text-[11px] text-white/40 mb-3 font-semibold uppercase tracking-wider">{t('txform.category_label')}</p>

                    {/* Category tiles — each carries its OWN persisted colour
                        (data-colour, not chrome), most-used first. */}
                    <div className="grid grid-cols-4 gap-2">
                      {categories.map(cat => {
                        const selected = selectedCategory?.id === cat.id
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => handleCategorySelect(cat)}
                            aria-pressed={selected}
                            className={cn(
                              'flex flex-col items-center gap-1.5 p-2.5 pt-3 rounded-2xl border transition-all active:scale-95 min-h-[76px]',
                              selected
                                ? 'border-green-500/70 bg-green-500/15 text-white'
                                : 'text-white/70 hover:text-white hover:border-white/25',
                            )}
                            style={selected ? undefined : {
                              backgroundColor: `${cat.color}14`,
                              borderColor:     `${cat.color}30`,
                            }}
                          >
                            <span className="text-2xl leading-none drop-shadow-[0_2px_3px_rgba(0,0,0,0.35)]">{cat.icon}</span>
                            <span className="text-[11px] font-medium text-center leading-tight truncate w-full">
                              {cat.name}
                            </span>
                          </button>
                        )
                      })}

                      {/* + Nova categoria — a personalização a um toque */}
                      <button
                        type="button"
                        onClick={() => { setShowNewCat(v => !v); setNewCatError(null) }}
                        aria-expanded={showNewCat}
                        className={cn(
                          'flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-2xl border border-dashed transition-all active:scale-95 min-h-[76px]',
                          showNewCat
                            ? 'border-green-500/60 bg-green-500/10 text-green-300'
                            : 'border-white/20 bg-white/[0.03] text-white/45 hover:text-white/80 hover:border-white/35',
                        )}
                      >
                        <Plus className="w-5 h-5" />
                        <span className="text-[11px] font-medium">{t('txform.newcat_tile')}</span>
                      </button>
                    </div>

                    {/* Inline category creator */}
                    {showNewCat && (
                      <div className="mt-3 bg-surface-2/60 border border-white/10 rounded-2xl p-4 space-y-3 animate-fade-in">
                        <p className="text-xs font-semibold text-white/70">{t('txform.newcat_title')}</p>
                        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 focus-within:border-green-500/50 transition-colors">
                          <span className="text-xl leading-none" aria-hidden>{newCatIcon}</span>
                          <input
                            type="text"
                            maxLength={40}
                            value={newCatName}
                            onChange={e => setNewCatName(e.target.value)}
                            placeholder={t('txform.newcat_name_ph')}
                            className="flex-1 min-w-0 bg-transparent text-white text-sm placeholder-white/25 outline-none"
                            autoFocus
                          />
                        </div>
                        {/* Botões de 44px (piso A11y) com o visual mais
                            pequeno lá dentro — a área de toque cresce, o
                            desenho mantém-se compacto. */}
                        <div className="flex flex-wrap gap-1">
                          {NEWCAT_EMOJIS.map(em => (
                            <button
                              key={em}
                              type="button"
                              onClick={() => setNewCatIcon(em)}
                              aria-label={t('txform.newcat_icon_aria', { icon: em })}
                              className={cn(
                                'w-11 h-11 flex items-center justify-center rounded-lg text-lg transition-all active:scale-90',
                                newCatIcon === em ? 'bg-white/15 ring-1 ring-green-400/60' : 'bg-white/[0.04] hover:bg-white/10',
                              )}
                            >
                              {em}
                            </button>
                          ))}
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                          {NEWCAT_COLORS.map(cl => (
                            <button
                              key={cl}
                              type="button"
                              onClick={() => setNewCatColor(cl)}
                              aria-label={t('txform.newcat_color_aria', { color: cl })}
                              className="w-11 h-11 flex items-center justify-center rounded-lg transition-all active:scale-90"
                            >
                              <span
                                className={cn(
                                  'w-7 h-7 rounded-full',
                                  newCatColor === cl ? 'ring-2 ring-white/80 ring-offset-2 ring-offset-surface-2' : 'opacity-80',
                                )}
                                style={{ backgroundColor: cl }}
                                aria-hidden
                              />
                            </button>
                          ))}
                        </div>
                        {newCatError && (
                          <p className="text-xs text-red-400">{newCatError}</p>
                        )}
                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setShowNewCat(false)}
                            className="flex-1 min-h-[44px] bg-white/5 border border-white/10 text-white/70 hover:text-white text-sm font-semibold rounded-xl transition-colors"
                          >
                            {t('txform.newcat_cancel')}
                          </button>
                          <button
                            type="button"
                            onClick={handleCreateCategory}
                            disabled={newCatBusy}
                            className="flex-1 min-h-[44px] bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black text-sm font-bold rounded-xl transition-all active:scale-[0.98]"
                          >
                            {newCatBusy ? '…' : t('txform.newcat_create')}
                          </button>
                        </div>
                      </div>
                    )}

                    {formError && step === 1 && (
                      <p className="mt-3 text-xs text-red-400 text-center" role="alert">{formError}</p>
                    )}

                    {selectedCategory && !showNewCat && (
                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        className="sm:hidden w-full mt-4 min-h-[52px] bg-green-500 hover:bg-green-400 text-black font-bold rounded-2xl transition-all active:scale-[0.98]"
                      >
                        {t('txform.continue')}
                      </button>
                    )}
                  </div>

                  {/* STEP 2: Amount + details */}
                  <div className={cn(step === 1 && 'hidden sm:block')}>

                    {selectedCategory && (
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="sm:hidden w-full flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 mb-5 text-left active:bg-white/10 transition-colors"
                      >
                        <span
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                          style={{ backgroundColor: `${selectedCategory.color}1f` }}
                          aria-hidden
                        >
                          {selectedCategory.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-white/40">{t('txform.category_label')}</p>
                          <p className="text-sm font-semibold text-white truncate">{selectedCategory.name}</p>
                        </div>
                        <ChevronDown className="w-4 h-4 text-white/30 -rotate-90 flex-shrink-0" />
                      </button>
                    )}

                    {/* Amount — o herói do formulário. Sem caixa: número
                        gigante centrado, sinal semântico, hairline por baixo
                        que acende a verde com o foco. */}
                    <div className="text-center mb-6 pt-1">
                      <p className="text-[11px] uppercase tracking-wider text-white/35 mb-3">{t('txform.amount_label')}</p>
                      <div
                        className={cn(
                          'inline-flex items-baseline justify-center gap-1.5 border-b-2 pb-1.5 px-3 transition-colors max-w-full',
                          amountFocus ? 'border-green-500/60' : 'border-white/10',
                        )}
                      >
                        <span
                          className={cn('text-2xl font-semibold select-none', isExpense ? 'text-red-400/80' : 'text-green-400/90')}
                          aria-hidden
                        >
                          {isExpense ? '−' : '+'}
                        </span>
                        <input
                          // type="text" + inputMode="decimal" so browsers show a
                          // numeric keyboard AND accept both "," and "." — native
                          // type="number" rejects commas in pt-PT locale.
                          ref={amountRef}
                          type="text"
                          inputMode="decimal"
                          pattern="[0-9.,]*"
                          placeholder={t('txform.amount_placeholder')}
                          value={amount}
                          onChange={e => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
                          onFocus={() => setAmountFocus(true)}
                          onBlur={() => setAmountFocus(false)}
                          aria-label={t('txform.amount_aria')}
                          style={{ width: `${Math.min(9, Math.max(4, amount.length + 1))}ch` }}
                          className="bg-transparent text-white text-5xl font-bold tabular-nums text-center placeholder-white/15 outline-none"
                        />
                        <span className="text-2xl font-semibold text-white/40 select-none" aria-hidden>€</span>
                      </div>
                    </div>

                    {/* Date — chips rápidos; o picker nativo só aparece
                        quando é preciso outra data. */}
                    <div className="mb-4">
                      <p className="text-[11px] text-white/40 mb-2 font-semibold uppercase tracking-wider">{t('txform.date_label')}</p>
                      <div className="flex flex-wrap gap-2">
                        {([
                          { iso: todayISO,     label: t('txform.date_today') },
                          { iso: yesterdayISO, label: t('txform.date_yesterday') },
                        ] as const).map(opt => {
                          const active = !showDatePicker && date === opt.iso
                          return (
                            <button
                              key={opt.iso}
                              type="button"
                              onClick={() => { setDate(opt.iso); setShowDatePicker(false) }}
                              aria-pressed={active}
                              className={cn(
                                'min-h-[40px] px-4 rounded-full text-sm font-medium border transition-all active:scale-95',
                                active
                                  ? 'bg-green-500/15 border-green-500/40 text-green-300'
                                  : 'bg-white/5 border-white/10 text-white/60 hover:text-white',
                              )}
                            >
                              {opt.label}
                            </button>
                          )
                        })}
                        <button
                          type="button"
                          onClick={() => setShowDatePicker(v => !v)}
                          aria-pressed={showDatePicker}
                          className={cn(
                            'min-h-[40px] px-4 rounded-full text-sm font-medium border transition-all active:scale-95',
                            showDatePicker
                              ? 'bg-green-500/15 border-green-500/40 text-green-300'
                              : 'bg-white/5 border-white/10 text-white/60 hover:text-white',
                          )}
                        >
                          {t('txform.date_other')}
                        </button>
                      </div>
                      {showDatePicker && (
                        <input
                          type="date"
                          value={date}
                          onChange={e => setDate(e.target.value)}
                          className="mt-2 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-green-500/50 transition-colors animate-fade-in"
                        />
                      )}
                    </div>

                    {/* Description — com autocomplete do histórico (padrão
                        YNAB): escrever "caf" sugere "Café" etc. mousedown
                        antes do blur para o clique ganhar ao fecho. */}
                    <div className="relative mb-4">
                      <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 focus-within:border-white/25 transition-colors">
                        <p className="text-[11px] text-white/40 mb-1 font-semibold uppercase tracking-wider">
                          {t('txform.description_label')} <span className="normal-case font-normal text-white/25">{t('txform.description_optional')}</span>
                        </p>
                        <input
                          type="text"
                          placeholder={t('txform.description_placeholder')}
                          value={description}
                          onChange={e => setDescription(e.target.value)}
                          onFocus={() => setDescFocus(true)}
                          onBlur={() => setDescFocus(false)}
                          autoComplete="off"
                          className="w-full bg-transparent text-white placeholder-white/25 outline-none text-sm py-1"
                        />
                      </div>
                      {descFocus && descSuggestions.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 z-10 bg-surface-2 border border-white/10 rounded-xl overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.5)] animate-fade-in">
                          {descSuggestions.map(d => (
                            <button
                              key={d}
                              type="button"
                              onMouseDown={e => { e.preventDefault(); setDescription(d) }}
                              className="w-full text-left px-4 min-h-[44px] text-sm text-white/80 hover:bg-white/5 active:bg-white/10 transition-colors"
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {formError && step === 2 && (
                      <p className="mb-3 text-xs text-red-400 text-center" role="alert">{formError}</p>
                    )}

                    {!defaultAccount && (
                      <p className="text-xs text-yellow-400/80 text-center mb-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-2">
                        {t('txform.no_account')}
                      </p>
                    )}

                    {/* Sucesso: XP real + escolha explícita — fecha sozinho
                        em 2,4s, ou "Adicionar outra" mantém a sessão de
                        registo (tipo/categoria/data ficam, valor limpa). */}
                    {xpGained ? (
                      <div className="space-y-3 animate-fade-in-up">
                        <div className="flex items-center justify-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl py-3" role="status">
                          <Zap className="w-4 h-4 text-yellow-400" />
                          <span className="text-yellow-400 font-bold">{t('txform.xp_gained', { xp: xpGained })}</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 min-h-[48px] bg-white/5 border border-white/10 text-white/70 hover:text-white text-sm font-semibold rounded-2xl transition-colors"
                          >
                            {t('txform.close')}
                          </button>
                          <button
                            type="button"
                            onClick={handleAddAnother}
                            className="flex-1 min-h-[48px] bg-green-500 hover:bg-green-400 text-black text-sm font-bold rounded-2xl transition-all active:scale-[0.98]"
                          >
                            {t('txform.add_another')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="submit"
                        disabled={loading || !defaultAccount}
                        className="w-full min-h-[52px] bg-green-500 hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold rounded-2xl transition-all text-base active:scale-[0.98]"
                      >
                        {loading ? t('txform.saving') : t('txform.save')}
                      </button>
                    )}
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
