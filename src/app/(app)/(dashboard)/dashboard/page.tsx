'use client'

import { useState, useEffect, useRef } from 'react'
import dynamic                         from 'next/dynamic'
import { PlusCircle, ChevronDown, BarChart3 } from 'lucide-react'
import { useUser }                     from '@clerk/nextjs'
import { StreakChip }                  from '@/components/dashboard/StreakChip'
import { PushNudgeCard }               from '@/components/dashboard/PushNudgeCard'
import { TransactionForm }             from '@/components/transactions/TransactionForm'
import { CelebrationModal }            from '@/components/ui/CelebrationModal'
import { formatMonth }                 from '@/lib/utils'
import { useT }                        from '@/lib/i18n/LocaleProvider'
import Link                            from 'next/link'

// ── Dynamic imports — only load when needed (reduces mobile JS) ──────────────
// PeriodFilter pulls framer-motion (~35 KB gz); it was the ONLY statically-
// reachable framer-motion import on the route, single-handedly defeating the
// careful dynamic-importing of every other motion consumer below.
const PeriodFilter = dynamic(
  () => import('@/components/dashboard/PeriodFilter').then(m => ({ default: m.PeriodFilter })),
  { ssr: false, loading: () => <div className="h-10 bg-white/5 rounded-xl animate-pulse" /> },
)
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
  // h-full: o placeholder acompanha a altura da coluna Score+XP no grid herói
  // (h-36 fixo reproduzia o "buraco" durante o carregamento do chunk).
  { ssr: false, loading: () => <div className="h-full min-h-[220px] bg-white/5 rounded-2xl animate-pulse" /> },
)
const MonthlySummary = dynamic(
  () => import('@/components/dashboard/MonthlySummary').then(m => ({ default: m.MonthlySummary })),
  { ssr: false, loading: () => <div className="h-24 bg-white/5 rounded-2xl animate-pulse" /> },
)
const ExpenseBreakdown = dynamic(
  () => import('@/components/dashboard/ExpenseBreakdown').then(m => ({ default: m.ExpenseBreakdown })),
  { ssr: false, loading: () => <div className="h-56 bg-white/5 rounded-2xl animate-pulse" /> },
)
const BiggestExpenses = dynamic(
  () => import('@/components/dashboard/BiggestExpenses').then(m => ({ default: m.BiggestExpenses })),
  { ssr: false, loading: () => <div className="h-56 bg-white/5 rounded-2xl animate-pulse" /> },
)
const CashFlowChart = dynamic(
  () => import('@/components/dashboard/CashFlowChart').then(m => ({ default: m.CashFlowChart })),
  { ssr: false, loading: () => <div className="h-72 bg-white/5 rounded-2xl animate-pulse" /> },
)
const SpendForecast = dynamic(
  () => import('@/components/dashboard/SpendForecast').then(m => ({ default: m.SpendForecast })),
  { ssr: false, loading: () => <div className="h-36 bg-white/5 rounded-2xl animate-pulse" /> },
)
const RecurringExpenses = dynamic(
  () => import('@/components/dashboard/RecurringExpenses').then(m => ({ default: m.RecurringExpenses })),
  { ssr: false, loading: () => null },
)
const RecentTransactions = dynamic(
  () => import('@/components/dashboard/RecentTransactions').then(m => ({ default: m.RecentTransactions })),
  { ssr: false, loading: () => <div className="h-40 bg-white/5 rounded-2xl animate-pulse" /> },
)
const AdBanner = dynamic(
  () => import('@/components/ads/AdBanner').then(m => ({ default: m.AdBanner })),
  { ssr: false },
)

export default function DashboardPage() {
  const { user }        = useUser()
  const t = useT()
  const [showForm, setShowForm]         = useState(false)
  // Análises colapsadas por defeito (dashboard diet): os chunks recharts
  // dos widgets lá dentro só carregam quando o user expande.
  const [showInsights, setShowInsights] = useState(false)
  const [celebration, setCelebration]   = useState<{
    icon: string; title: string; subtitle: string; xp?: number
  } | null>(null)
  const checkinDone = useRef(false)
  const welcomeDone = useRef(false)

  const firstName = user?.firstName ?? t('dashboard.greeting_default')
  // Greeting: tried a time-based "Bom dia/tarde/noite" previously, but the
  // client/server TZ mismatch (Vercel runs UTC; hydration re-runs in the user's
  // TZ) caused the wrong greeting to flash on load. "Olá" is TZ-agnostic and
  // works for every user at every hour — also easier to i18n later.
  const greeting  = t('common.hello')

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
                  title:    t('dashboard.welcome_new', { name: firstName }),
                  subtitle: t('dashboard.welcome_new_sub'),
                  xp:       0,
                }
              : {
                  icon:     '👋',
                  title:    t('dashboard.welcome_back', { name: firstName }),
                  subtitle: t('dashboard.welcome_back_sub', { level, xp: xpTotal }),
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
          setCelebration({ icon: '🔥', title: t('dashboard.streak_7_title'), subtitle: t('dashboard.streak_7_sub'), xp: res.xp_earned })
        } else if (streak === 30) {
          setCelebration({ icon: '👑', title: t('dashboard.streak_30_title'), subtitle: t('dashboard.streak_30_sub'), xp: res.xp_earned })
        } else if (streak === 60) {
          setCelebration({ icon: '💎', title: t('dashboard.streak_60_title'), subtitle: t('dashboard.streak_60_sub'), xp: res.xp_earned })
        } else if (streak === 100) {
          setCelebration({ icon: '🌟', title: t('dashboard.streak_100_title'), subtitle: t('dashboard.streak_100_sub'), xp: res.xp_earned })
        }

        // Streak salvo por um freeze — momento raro que merece ser visto
        // (é assim que o user aprende que a proteção existe). Ligeiro
        // atraso para não colidir com uma celebração de marco.
        if (res.freeze_used) {
          setTimeout(() => {
            setCelebration({
              icon:     '❄️',
              title:    t('dashboard.freeze_used_title'),
              subtitle: t('dashboard.freeze_used_sub', { n: streak }),
            })
          }, 600)
        }

        res.badges_awarded?.forEach((b: { name: string; icon: string }) => {
          setTimeout(() => {
            setCelebration({ icon: b.icon, title: t('dashboard.badge_unlocked'), subtitle: b.name })
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Streak como chip discreto, não banner full-width (Fase 4). */}
          <StreakChip />
          {/* Um só add por viewport: <lg usa o FAB da MobileNav; este botão
              existe apenas em desktop, onde a MobileNav (e o FAB) não montam. */}
          <button
            onClick={() => setShowForm(true)}
            className="hidden lg:flex items-center gap-2 bg-green-500 hover:bg-green-400 text-black font-bold px-4 py-2.5 rounded-xl transition-colors text-sm active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            {t('dashboard.add')}
          </button>
        </div>
      </div>

      {/* O herói do glance: mascote (a alma do produto) + score + XP.
          Desktop: Pet 2/3 | Score+XP 1/3. Mobile: empilhado. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Wrapper simples (sem flex morto): a célula grid estica por defeito
            e o h-full do VoltixWidget hero resolve direto contra ela. */}
        <div className="lg:col-span-2">
          <VoltixWidget userId={user?.id ?? ''} variant="hero" />
        </div>
        <div className="flex flex-col gap-3">
          <FinancialScoreCard userId={user?.id ?? ''} />
          <XPProgressBar     userId={user?.id ?? ''} />
        </div>
      </div>

      {/* Opt-in de push contextual — prompt transitório (não é secção do
          feed): só aparece com streak ≥ 2, permissão nunca pedida e sem
          dispensa nos últimos 14 dias. */}
      <PushNudgeCard />

      {/* Resumo do período — o PeriodFilter vive junto do resumo que
          controla (alimenta também a ExpenseBreakdown na análise). */}
      <PeriodFilter />
      <MonthlySummary userId={user?.id ?? ''} />

      {/* Previsão de fim-de-mês (premium; free vê velocity + teaser calmo).
          Auto-suficiente: useSpendForecast tem o próprio cache ['forecast']. */}
      <SpendForecast />

      {/* Transações recentes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-white">{t('dashboard.recent_transactions')}</h2>
          <Link href="/transactions" className="text-xs text-green-400 hover:text-green-300">{t('dashboard.see_all')}</Link>
        </div>
        <RecentTransactions userId={user?.id ?? ''} limit={5} />
      </div>

      {/* Análise detalhada — colapsada por defeito (dashboard diet, Fase 4).
          Os 4 widgets analíticos vivem aqui; como são dynamic() e só montam
          quando expandido, os chunks recharts saem do critical path. */}
      <div>
        <button
          type="button"
          onClick={() => setShowInsights(v => !v)}
          aria-expanded={showInsights}
          className="w-full flex items-center justify-between gap-3 min-h-[48px] px-4 bg-white/5 border border-white/10 rounded-2xl text-sm font-semibold text-white/85 hover:border-white/20 active:bg-white/10 transition-colors"
        >
          <span className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-white/45" />
            {t('dashboard.insights_title')}
          </span>
          <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${showInsights ? 'rotate-180' : ''}`} />
        </button>
        {showInsights && (
          <div className="space-y-4 mt-4 animate-fade-in-up">
            <ExpenseBreakdown />
            <CashFlowChart />
            <BiggestExpenses />
            <RecurringExpenses />
          </div>
        )}
      </div>

      {/* O ÚNICO anúncio do dashboard — no fundo, depois do conteúdo
          (era: 2 ads + teaser pro + banner upgrade espalhados pelo feed). */}
      <AdBanner variant="feed" />

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
