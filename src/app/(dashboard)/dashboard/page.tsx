'use client'

import { useState } from 'react'
import { PlusCircle } from 'lucide-react'
import { useUser }   from '@clerk/nextjs'
import { FinancialScoreCard } from '@/components/dashboard/FinancialScoreCard'
import { XPProgressBar }      from '@/components/dashboard/XPProgressBar'
import { MonthlySummary }     from '@/components/dashboard/MonthlySummary'
import { RecentTransactions } from '@/components/dashboard/RecentTransactions'
import { VoltixWidget }       from '@/components/voltix/VoltixWidget'
import { MissionCard }        from '@/components/missions/MissionCard'
import { TransactionForm }    from '@/components/transactions/TransactionForm'
import { AdBanner }           from '@/components/ads/AdBanner'
import { formatMonth }        from '@/lib/utils'

export default function DashboardPage() {
  const { user }        = useUser()
  const [showForm, setShowForm] = useState(false)

  const firstName = user?.firstName ?? 'explorador'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

  return (
    <div className="space-y-4 pb-2">

      {/* Header mobile */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white/50 text-sm">{greeting},</p>
          <h1 className="text-xl font-bold text-white capitalize">{firstName} 👋</h1>
          <p className="text-white/30 text-xs mt-0.5">{formatMonth()}</p>
        </div>
        {/* Botão rápido no header — visível desktop */}
        <button
          onClick={() => setShowForm(true)}
          className="hidden sm:flex items-center gap-2 bg-green-500 hover:bg-green-400 text-black font-bold px-4 py-2.5 rounded-xl transition-all text-sm active:scale-95"
        >
          <PlusCircle className="w-4 h-4" />
          Adicionar
        </button>
      </div>

      {/* Voltix — destaque mobile no topo */}
      <div className="lg:hidden">
        <VoltixWidget userId={user?.id ?? ''} />
      </div>

      {/* Score + XP lado a lado mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <FinancialScoreCard userId={user?.id ?? ''} />
        <XPProgressBar     userId={user?.id ?? ''} />
        {/* Voltix só no desktop */}
        <div className="hidden lg:block">
          <VoltixWidget userId={user?.id ?? ''} />
        </div>
      </div>

      {/* Resumo mensal */}
      <MonthlySummary userId={user?.id ?? ''} />

      {/* ── AD 1: entre resumo e missões (alta visibilidade) ── */}
      <AdBanner variant="feed" />

      {/* Missões */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-white">Missões Ativas</h2>
          <a href="/missions" className="text-xs text-green-400 hover:text-green-300">Ver todas →</a>
        </div>
        <MissionCard userId={user?.id ?? ''} limit={3} />
      </div>

      {/* Transações recentes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-white">Transações Recentes</h2>
          <a href="/transactions" className="text-xs text-green-400 hover:text-green-300">Ver todas →</a>
        </div>
        <RecentTransactions userId={user?.id ?? ''} limit={5} />
      </div>

      {/* ── AD 2: no final do dashboard ── */}
      <AdBanner variant="banner" />

      {/* Modal */}
      {showForm && <TransactionForm onClose={() => setShowForm(false)} />}
    </div>
  )
}
