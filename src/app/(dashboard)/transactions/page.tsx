'use client'

import { useState } from 'react'
import { PlusCircle, Filter, Search } from 'lucide-react'
import { TransactionForm } from '@/components/transactions/TransactionForm'
import { TransactionList } from '@/components/transactions/TransactionList'

export default function TransactionsPage() {
  const [showForm, setShowForm]   = useState(false)
  const [search, setSearch]       = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Transações</h1>
          <p className="text-white/50 text-sm mt-0.5">Regista e gere os teus movimentos</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-green-500 hover:bg-green-400 text-black font-bold px-4 py-2.5 rounded-xl transition-all text-sm"
        >
          <PlusCircle className="w-4 h-4" />
          Nova transação
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            placeholder="Pesquisar transações..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 outline-none focus:border-green-500/50 text-sm"
          />
        </div>
        <div className="flex gap-2">
          {[
            { value: 'all',     label: 'Todas' },
            { value: 'income',  label: 'Receitas' },
            { value: 'expense', label: 'Despesas' },
          ].map(f => (
            <button
              key={f.value}
              onClick={() => setTypeFilter(f.value)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                typeFilter === f.value
                  ? 'bg-green-500/20 border border-green-500/40 text-green-400'
                  : 'bg-white/5 border border-white/10 text-white/60 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <TransactionList search={search} typeFilter={typeFilter} />

      {/* Modal de nova transação */}
      {showForm && (
        <TransactionForm onClose={() => setShowForm(false)} />
      )}
    </div>
  )
}
