'use client'

import { useState, useEffect, useRef } from 'react'
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
import { StreakBanner }       from '@/components/dashboard/StreakBanner'
import { QuickActions }       from '@/components/dashboard/QuickActions'
import { CelebrationModal }   from '@/components/ui/CelebrationModal'
import { formatMonth }        from '@/lib/utils'

export default function DashboardPage() {
  const { user }        = useUser()
  const [showForm, setShowForm]         = useState(false)
  const [celebration, setCelebration]   = useState<{
    icon: string; title: string; subtitle: string; xp?: number
  } | null>(null)
  const checkinDone = useRef(false)

  const firstName = user?.firstName ?? 'explorador'
  const hour      = new Date().getHours()
  const greeting  = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

  /* ── daily check-in (awards XP + streak, shows celebration) ── */
  useEffect(() => {
    if (checkinDone.current || !user) return
    checkinDone.current = true

    fetch('/api/daily-checkin', { method: 'POST' })
      .then(r => r.ok ? r.json() : null)
      .then(res => {
        if (!res || res.already_checked) return

        // Milestone streak celebrations
        const streak = res.streak ?? 0
        if (streak === 7) {
          setCelebration({
            icon: '🔥',
            title: '7 dias seguidos!',
            subtitle: 'Semana perfeita! Tens um streak incrível.',
            xp: res.xp_earned,
          })
        } else if (streak === 30) {
          setCelebration({
            icon: '👑',
            title: '30 dias imparável!',
            subtitle: 'Lenda absoluta. O Voltix nunca esteve tão poderoso.',
            xp: res.xp_earned,
          })
        }

        // Badge celebrations
        res.badges_awarded?.forEach((b: { name: string; icon: string }) => {
          setTimeout(() => {
            setCelebration({
              icon:     b.icon,
              title:    'Badge desbloqueado!',
              subtitle: b.name,
            })
          }, 800)
        })
      })
      .catch(() => {})
  }, [user])

  return (
    <div className="space-y-4 pb-2">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white/50 text-sm">{greeting},</p>
          <h1 className="text-xl font-bold text-white capitalize">{firstName} 👋</h1>
          <p className="text-white/30 text-xs mt-0.5">{formatMonth()}</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="hidden sm:flex items-center gap-2 bg-green-500 hover:bg-green-400 text-black font-bold px-4 py-2.5 rounded-xl transition-all text-sm active:scale-95"
        >
          <PlusCircle className="w-4 h-4" />
          Adicionar
        </button>
      </div>

      {/* ── Streak banner — daily retention hook ── */}
      <StreakBanner />

      {/* ── Quick actions row — mobile primary CTA ── */}
      <QuickActions />

      {/* Voltix mobile */}
      <div className="lg:hidden">
        <VoltixWidget userId={user?.id ?? ''} />
      </div>

      {/* Score + XP + Voltix desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <FinancialScoreCard userId={user?.id ?? ''} />
        <XPProgressBar     userId={user?.id ?? ''} />
        <div className="hidden lg:block">
          <VoltixWidget userId={user?.id ?? ''} />
        </div>
      </div>

      {/* Resumo mensal */}
      <MonthlySummary userId={user?.id ?? ''} />

      {/* AD 1 */}
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

      {/* AD 2 */}
      <AdBanner variant="banner" />

      {/* Modals */}
      {showForm && <TransactionForm onClose={() => setShowForm(false)} />}

      {celebration && (
        <CelebrationModal
          open
          onClose={() => setCelebration(null)}
          icon={celebration.icon}
          title={celebration.title}
          subtitle={celebration.subtitle}
          xp={celebration.xp}
        />
      )}
    </div>
  )
}
