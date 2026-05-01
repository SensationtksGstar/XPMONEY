'use client'

import { useState, useEffect } from 'react'
import { Search, FileText, Sparkles, X } from 'lucide-react'
import { TransactionForm }     from '@/components/transactions/TransactionForm'
import { TransactionList }     from '@/components/transactions/TransactionList'
import { StatementImporter }   from '@/components/transactions/StatementImporter'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/LocaleProvider'
import dynamic from 'next/dynamic'

const AdBanner = dynamic(
  () => import('@/components/ads/AdBanner').then(m => ({ default: m.AdBanner })),
  { ssr: false },
)

const IMPORT_HINT_KEY = 'xpmoney:import_hint_seen'

export default function TransactionsPage() {
  const t = useT()
  const FILTERS = [
    { value: 'all',     label: t('transactions.filter.all') },
    { value: 'expense', label: t('transactions.filter.expense') },
    { value: 'income',  label: t('transactions.filter.income') },
  ]
  const [showForm,      setShowForm]     = useState(false)
  const [showImporter,  setShowImporter] = useState(false)
  const [search,        setSearch]       = useState('')
  const [typeFilter,    setTypeFilter]   = useState('all')
  const [showSearch,    setShowSearch]   = useState(false)
  const [showHint,      setShowHint]     = useState(false)

  // Promote the import feature — show a dismissable banner the first time a
  // user lands on this page. Killed for good after they dismiss or use it.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!localStorage.getItem(IMPORT_HINT_KEY)) setShowHint(true)
  }, [])

  const dismissHint = () => {
    setShowHint(false)
    try { localStorage.setItem(IMPORT_HINT_KEY, '1') } catch { /* quota — ignore */ }
  }

  const openImporter = () => {
    setShowImporter(true)
    dismissHint()
  }

  return (
    <div className="animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('transactions.title')}</h1>
          <p className="text-white/50 text-sm mt-0.5">{t('transactions.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSearch(s => !s)}
            aria-label={showSearch ? t('transactions.search_close_aria') : t('transactions.search_open_aria')}
            aria-pressed={showSearch}
            className={cn(
              'w-11 h-11 flex items-center justify-center rounded-xl border transition-all',
              showSearch
                ? 'bg-green-500/10 border-green-500/30 text-green-400'
                : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
            )}
          >
            <Search className="w-4 h-4" />
          </button>
          {/* Import statement button — gradient + sparkle to make the feature
              discoverable. Mobile: square 44x44 icon to match the search
              button next to it (was 38x44 with px-3 → looked off-axis). */}
          <button
            onClick={openImporter}
            aria-label={t('transactions.import_aria')}
            className={cn(
              'relative flex items-center justify-center gap-1.5 rounded-xl',
              'w-11 h-11 sm:w-auto sm:h-auto sm:min-h-[44px] sm:px-3 sm:py-2.5',
              'bg-gradient-to-r from-blue-500/15 to-purple-500/15 hover:from-blue-500/25 hover:to-purple-500/25',
              'border border-blue-500/30 text-blue-300 text-sm font-semibold',
              'transition-all active:scale-95',
              showHint && 'ring-2 ring-blue-400/50 ring-offset-2 ring-offset-[#0a0d14]',
            )}
          >
            <Sparkles className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-blue-300" />
            <span className="hidden sm:inline">{t('transactions.import_cta')}</span>
            <span className="hidden sm:inline-block text-[10px] bg-blue-500/20 border border-blue-500/30 text-blue-300 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide">{t('transactions.import_ai_tag')}</span>
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="hidden sm:flex items-center gap-2 min-h-[44px] bg-green-500 hover:bg-green-400 text-black font-bold px-4 py-2.5 rounded-xl transition-all text-sm active:scale-95"
          >
            {t('transactions.new_cta')}
          </button>
        </div>
      </div>

      {/* Import feature hint banner — dismissable, shown once */}
      {showHint && (
        <div
          role="region"
          aria-label={t('transactions.hint_region_aria')}
          className="relative mb-4 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-blue-500/10 border border-blue-500/25 rounded-2xl p-4 animate-fade-in-up"
        >
          <button
            onClick={dismissHint}
            aria-label={t('transactions.hint_close_aria')}
            className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-start gap-3 pr-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/25 to-purple-500/25 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-blue-300" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-white font-bold text-sm">{t('transactions.hint_title')}</p>
                <span className="text-[10px] bg-blue-500/20 border border-blue-500/30 text-blue-300 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide">{t('transactions.hint_plus_tag')}</span>
              </div>
              <p className="text-white/60 text-xs mt-1 leading-relaxed">
                {t('transactions.hint_body')}
              </p>
              <button
                onClick={openImporter}
                className="mt-3 inline-flex items-center gap-1.5 bg-blue-500 hover:bg-blue-400 text-white text-xs font-bold px-3 py-2 rounded-lg transition-all active:scale-95 min-h-[36px]"
              >
                <FileText className="w-3.5 h-3.5" />
                {t('transactions.hint_try')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      {showSearch && (
        <div className="mb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="search"
              placeholder={t('transactions.search_placeholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
              className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 outline-none focus:border-green-500/50 text-sm"
            />
          </div>
        </div>
      )}

      {/* Filtros rápidos */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setTypeFilter(f.value)}
            className={cn(
              'flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all border',
              typeFilter === f.value
                ? 'bg-green-500/15 border-green-500/40 text-green-400'
                : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* AD — free users only */}
      <AdBanner variant="feed" />

      {/* Lista */}
      <TransactionList search={search} typeFilter={typeFilter} />

      {showForm     && <TransactionForm    onClose={() => setShowForm(false)} />}
      {showImporter && <StatementImporter onClose={() => setShowImporter(false)} />}
    </div>
  )
}
