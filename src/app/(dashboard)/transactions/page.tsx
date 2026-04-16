'use client'

import { useState } from 'react'
import { Search, FileText } from 'lucide-react'
import { TransactionForm }     from '@/components/transactions/TransactionForm'
import { TransactionList }     from '@/components/transactions/TransactionList'
import { StatementImporter }   from '@/components/transactions/StatementImporter'
import { cn } from '@/lib/utils'
import dynamic from 'next/dynamic'

const AdBanner = dynamic(
  () => import('@/components/ads/AdBanner').then(m => ({ default: m.AdBanner })),
  { ssr: false },
)

const FILTERS = [
  { value: 'all',     label: 'Todas' },
  { value: 'expense', label: 'Despesas' },
  { value: 'income',  label: 'Receitas' },
]

export default function TransactionsPage() {
  const [showForm,      setShowForm]     = useState(false)
  const [showImporter,  setShowImporter] = useState(false)
  const [search,        setSearch]       = useState('')
  const [typeFilter,    setTypeFilter]   = useState('all')
  const [showSearch,    setShowSearch]   = useState(false)

  return (
    <div className="animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Transações</h1>
          <p className="text-white/50 text-sm mt-0.5">Regista e gere os teus movimentos</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSearch(s => !s)}
            aria-label={showSearch ? 'Fechar pesquisa' : 'Pesquisar transações'}
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
          {/* Import statement button */}
          <button
            onClick={() => setShowImporter(true)}
            aria-label="Importar extrato bancário"
            className="flex items-center gap-1.5 min-h-[44px] bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/25 text-blue-400 px-3 py-2.5 rounded-xl transition-all text-sm font-medium active:scale-95"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Importar Extrato</span>
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="hidden sm:flex items-center gap-2 min-h-[44px] bg-green-500 hover:bg-green-400 text-black font-bold px-4 py-2.5 rounded-xl transition-all text-sm active:scale-95"
          >
            + Nova
          </button>
        </div>
      </div>

      {/* Search */}
      {showSearch && (
        <div className="mb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="search"
              placeholder="Pesquisar..."
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
