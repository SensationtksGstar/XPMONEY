'use client'

import { useState, useEffect, useRef } from 'react'
import dynamic                         from 'next/dynamic'
import { PlusCircle, Crown }           from 'lucide-react'
import { useUser }                     from '@clerk/nextjs'
import { useUserPlan }                 from '@/lib/contexts/UserPlanContext'
import { QuickActions }                from '@/components/dashboard/QuickActions'
import { ProToolsShowcase }            from '@/components/dashboard/ProToolsShowcase'
import { StreakBanner }                from '@/components/dashboard/StreakBanner'
import { TransactionForm }             from '@/components/transactions/TransactionForm'
import { CelebrationModal }            from '@/components/ui/CelebrationModal'
import { formatMonth }                 from '@/lib/utils'
import Link                            from 'next/link'

// ── Dynamic imports — only load when needed (reduces mobile JS) ──────────────
const FinancialScoreCard = dynamic(
  () => import('@/components/dashboard/FinancialScoreCard').then(m => ({ default: m.FinancialScoreCard })),
  { ssr: false, loading: () => <div className="h-36 bg-white/5 rounded-2xl animate-pulse" /> },
)
const XPProgressBar = dynamic(
  () => import('@/components/dashboard/XPProgressBar').then(m => ({ default: m.XPProgressBar })),
  { ssr: false, loading: () => <div className="h-36 bg-white/5 rounded-2xl animate-pulse" /> },
)
const VoltixWidget = dynamic(
  () => import('@/components/voltix/VoltixWidget').then(m => ({ default: m.VoltixWidget })),
  { ssr: false, loading: () => <div className="h-36 bg-white/5 rounded-2xl animate-pulse" /> },
)
const MonthlySummary = dynamic(
  () => import('@/components/dashboard/MonthlySummary').then(m => ({ default: m.MonthlySummary })),
  { ssr: false, loading: () => <div className="h-24 bg-white/5 rounded-2xl animate-pulse" /> },
)
const ExpenseBreakdown = dynamic(
  () => import('@/components/dashboard/ExpenseBreakdown').then(m => ({ default: m.ExpenseBreakdown })),
  { ssr: false, loading: () => <div className="h-56 bg-white/5 rounded-2xl animate-pulse" /> },
)
const RecentTransactions = dynamic(
  () => import('@/components/dashboard/RecentTransactions').then(m => ({ default: m.RecentTransactions })),
  { ssr: false, loading: () => <div className="h-40 bg-white/5 rounded-2xl animate-pulse" /> },
)
const MissionCard = dynamic(
  () => import('@/components/missions/MissionCard').then(m => ({ default: m.MissionCard })),
  { ssr: false, loading: () => <div className="h-24 bg-white/5 rounded-2xl animate-pulse" /> },
)
const AdBanner = dynamic(
  () => import('@/components/ads/AdBanner').then(m => ({ default: m.AdBanner })),
  { ssr: false },
)

export default function DashboardPage() {
  const { user }        = useUser()
  const { plan, isFree } = useUserPlan()
  const [showForm, setShowForm]         = useState(false)
  const [celebration, setCelebration]   = useState<{
    icon: string; title: string; subtitle: string; xp?: number
  } | null>(null)
  const checkinDone = useRef(false)
  const welcomeDone = useRef(false)

  const firstName = user?.firstName ?? 'explorador'
  // Greeting: tried a time-based "Bom dia/tarde/noite" previously, but the
  // client/server TZ mismatch (Vercel runs UTC; hydration re-runs in the user's
  // TZ) caused the wrong greeting to flash on load. "Olá" is TZ-agnostic and
  // works for every user at every hour — also easier to i18n later.
  const greeting  = 'Olá'

  /* ── first-login welcome (once per user per device) ── */
  useEffect(() => {
    if (welcomeDone.current || !user?.id) return
    welcomeDone.current = true

    if (typeof window === 'undefined') return
    const key = `xpm_welcomed_${user.id}`
    if (localStorage.getItem(key)) return

    const controller = new AbortController()

    fetch('/api/xp', { signal: controller.signal })
      .then(r => r.ok ? r.json() : null)
      .then(res => {
        const xpTotal = res?.data?.xp_total ?? 0
        const level   = res?.data?.level ?? 1
        const isBrandNew = xpTotal === 0 && level === 1

        // Delay so daily-checkin celebration (if any) shows first
        setTimeout(() => {
          setCelebration(
            isBrandNew
              ? {
                  icon:     '⚡',
                  title:    `Bem-vindo, ${firstName}!`,
                  subtitle: 'Começa a registar as tuas finanças e ganha XP. O Voltix está pronto!',
                  xp:       0,
                }
              : {
                  icon:     '👋',
                  title:    `Bem-vindo de volta, ${firstName}!`,
                  subtitle: `Nível ${level} · ${xpTotal} XP. Continua a construir a tua jornada financeira.`,
                  xp:       xpTotal,
                },
          )
        }, 1500)

        localStorage.setItem(key, String(Date.now()))
      })
      .catch(err => {
        if (err?.name !== 'AbortError') console.warn('[welcome] failed:', err)
      })

    return () => controller.abort()
  }, [user?.id, firstName])

  /* ── daily check-in ── */
  useEffect(() => {
    if (checkinDone.current || !user) return
    checkinDone.current = true

    const controller = new AbortController()

    fetch('/api/daily-checkin', { method: 'POST', signal: controller.signal })
      .then(r => r.ok ? r.json() : null)
      .then(res => {
        if (!res || res.already_checked) return

        const streak = res.streak ?? 0
        if (streak === 7) {
          setCelebration({ icon: '🔥', title: '7 dias seguidos!', subtitle: 'Semana perfeita! Tens um streak incrível.', xp: res.xp_earned })
        } else if (streak === 30) {
          setCelebration({ icon: '👑', title: '30 dias imparável!', subtitle: 'Lenda absoluta. O Voltix nunca esteve tão poderoso.', xp: res.xp_earned })
        }

        res.badges_awarded?.forEach((b: { name: string; icon: string }) => {
          setTimeout(() => {
            setCelebration({ icon: b.icon, title: 'Badge desbloqueado!', subtitle: b.name })
          }, 800)
        })
      })
      .catch(err => {
        // AbortError is expected on unmount; other errors are logged but non-blocking
        if (err?.name !== 'AbortError') {
          console.warn('[daily-checkin] failed:', err)
        }
      })

    return () => controller.abort()
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
          className="hidden sm:flex items-center gap-2 bg-green-500 hover:bg-green-400 text-black font-bold px-4 py-2.5 rounded-xl transition-colors text-sm active:scale-95"
        >
          <PlusCircle className="w-4 h-4" />
          Adicionar
        </button>
      </div>

      {/* Streak */}
      <StreakBanner />

      {/* Quick actions */}
      <QuickActions />

      {/* Pro tools showcase — always visible, locked items link to billing */}
      <ProToolsShowcase />

      {/* Upgrade banner for free users */}
      {isFree && (
        <Link href="/settings/billing"
          className="flex items-center gap-3 bg-gradient-to-r from-purple-500/15 to-green-500/10 border border-purple-500/25 rounded-2xl px-4 py-3 hover:border-purple-500/40 transition-colors"
        >
          <Crown className="w-5 h-5 text-purple-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">Desbloqueia funcionalidades Pro</p>
            <p className="text-xs text-white/50">Perspetiva · Simulador · Academia · Sem anúncios</p>
          </div>
          <span className="text-xs font-bold text-purple-400 bg-purple-500/20 px-2.5 py-1 rounded-lg flex-shrink-0">
            Ver planos
          </span>
        </Link>
      )}

      {/* Hero Pet + Score/XP side-by-side + breakdown de despesas.
          Layout (April 2026 redesign):
          • Desktop: esquerda 2/3 (Pet hero + ExpenseBreakdown empilhados)
            / direita 1/3 (Score + XP empilhados). Aproveita o espaço
            vertical que antes ficava vazio debaixo do mascote quando
            a coluna Score+XP era mais alta.
          • Mobile: tudo empilhado: Pet, Score, XP, depois ExpenseBreakdown. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 flex flex-col gap-3">
          <VoltixWidget userId={user?.id ?? ''} variant="hero" />
          <ExpenseBreakdown />
        </div>
        <div className="flex flex-col gap-3">
          <FinancialScoreCard userId={user?.id ?? ''} />
          <XPProgressBar     userId={user?.id ?? ''} />
        </div>
      </div>

      {/* Resumo mensal */}
      <MonthlySummary userId={user?.id ?? ''} />

      {/* AD */}
      <AdBanner variant="feed" />

      {/* Missões */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-white">Missões Ativas</h2>
          <Link href="/missions" className="text-xs text-green-400 hover:text-green-300">Ver todas →</Link>
        </div>
        <MissionCard userId={user?.id ?? ''} limit={3} />
      </div>

      {/* Transações recentes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-white">Transações Recentes</h2>
          <Link href="/transactions" className="text-xs text-green-400 hover:text-green-300">Ver todas →</Link>
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
