'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import dynamic                         from 'next/dynamic'
import { PlusCircle, ChevronDown, BarChart3 } from 'lucide-react'
import { useUser }                     from '@clerk/nextjs'
import { useQueryClient }              from '@tanstack/react-query'
import { useVoltix }                   from '@/hooks/useVoltix'
import { xpQueryOptions }              from '@/hooks/useXP'
import { useToast }                    from '@/components/ui/toaster'
import { EVO_NAMES, PENNY_EVO_NAMES }  from '@/components/voltix/mascotMeta'
import type { MascotGender }           from '@/types'
import { resolveMascotGender }         from '@/lib/mascotGender'
import { StreakChip }                  from '@/components/dashboard/StreakChip'
import { PushNudgeCard }               from '@/components/dashboard/PushNudgeCard'
import { WrappedNudgeCard }            from '@/components/dashboard/WrappedNudgeCard'
import { TransactionForm }             from '@/components/transactions/TransactionForm'
import { CelebrationModal }            from '@/components/ui/CelebrationModal'
import { formatMonth }                 from '@/lib/utils'
import { useT }                        from '@/lib/i18n/LocaleProvider'
import { useMoment }                   from '@/lib/momentQueue'
import Link                            from 'next/link'

interface Celebration {
  id:        number
  icon:      string
  title:     string
  subtitle:  string
  xp?:       number
  /** Marcos de streak 7/30/60/100 — o CelebrationModal valida contra o conjunto fechado de /p/streak. */
  shareStreak?: number
}

type WelcomePlan =
  | { kind: 'new' }
  | { kind: 'back'; level: number; xp: number }

// ── Dynamic imports — only load when needed (reduces mobile JS) ──────────────
// O glance (tudo acima do expander "Análise detalhada") NÃO importa
// framer-motion (~36 kB gz): PeriodFilter e MonthlySummary animam com CSS
// (out. 2026). A lib só carrega com a cinemática de evolução e com os widgets
// do expander. Não reintroduzir `framer-motion` num componente do glance.
// Conta com < 24 h só conta como "nova" abaixo deste XP (o hatch do dia 1 já
// paga 300 + 1.ª receita 15 + meta 100). Protege contra createdAt falso após
// a migração do Clerk.
const NEW_ACCOUNT_MAX_XP = 1000

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
  // Fila de celebrações (streak/freeze/badge): FIFO, uma de cada vez. Antes
  // cada setCelebration substituía a anterior (e usava setTimeout para
  // "ordenar"). O modal só abre quando a fila de momentos dá o lugar
  // (cinematic > celebração > boas-vindas > pedidos).
  const [celebrations, setCelebrations] = useState<Celebration[]>([])
  const celebrationSeq = useRef(0)
  const pushCelebration = useCallback((c: Omit<Celebration, 'id'>) => {
    celebrationSeq.current += 1
    const id = celebrationSeq.current
    setCelebrations(q => [...q, { ...c, id }])
  }, [])
  const closeCelebration = useCallback(() => setCelebrations(q => q.slice(1)), [])
  const celebrationSlot = useMoment('celebration', celebrations.length > 0)

  // Boas-vindas: decididas uma vez (nova vs. de volta), mostradas pela fila.
  const [welcomePlan, setWelcomePlan]   = useState<WelcomePlan | null>(null)
  const [welcomeReady, setWelcomeReady] = useState(false)
  const welcomeSlot = useMoment('welcome', welcomePlan !== null && welcomeReady)
  const closeWelcome = useCallback(() => { setWelcomePlan(null); setWelcomeReady(false) }, [])
  const checkinDone  = useRef(false)
  const welcomeDone  = useRef(false)
  // `?welcome=1` (vindo do onboarding) lido UMA vez no mount, antes de o
  // Clerk carregar; o URL é limpo logo a seguir.
  const welcomeParam   = useRef(false)
  // Já foram mostradas neste mount (evita repetir se o storage falhar e o
  // efeito voltar a correr).
  const welcomeShown   = useRef(false)
  const welcomeChecked = useRef(false)
  const queryClient = useQueryClient()
  const { toast }   = useToast()

  // Nome real da mascote (género + forma atual) para o ecrã de boas-vindas.
  // Resolvido no RENDER do modal (não congelado ao agendar): se o hatch do
  // dia 1 tocar primeiro, as boas-vindas já mostram a forma nova.
  const { voltix } = useVoltix()
  // Sem dados ainda (GET /api/voltix em voo): cai para o localStorage, para
  // quem escolheu a Penny não ver o nome do Voltix no welcome.
  const mascotGender: MascotGender = voltix?.mascot_gender ?? resolveMascotGender(null)
  const mascotNames = mascotGender === 'penny' ? PENNY_EVO_NAMES : EVO_NAMES
  const mascotName  = mascotNames[voltix?.evolution_level ?? 1] ?? mascotNames[1]
  const voltixLoaded = voltix !== null

  // Primitivo nas deps: o Clerk reconstrói o objeto User (e o Date createdAt)
  // em atualizações de sessão, o que re-corria o efeito das boas-vindas.
  const createdMs = user?.createdAt ? new Date(user.createdAt).getTime() : NaN

  const firstName = user?.firstName ?? t('dashboard.greeting_default')
  // Greeting: tried a time-based "Bom dia/tarde/noite" previously, but the
  // client/server TZ mismatch (Vercel runs UTC; hydration re-runs in the user's
  // TZ) caused the wrong greeting to flash on load. "Olá" is TZ-agnostic and
  // works for every user at every hour — also easier to i18n later.
  const greeting  = t('common.hello')

  /* ── deep link ?welcome=1 (vem do onboarding) ──
     Lido uma vez no mount (não espera pelo Clerk) e limpo do URL. O ref
     guarda o valor: o StrictMode de dev corre o efeito duas vezes e a 2.ª
     leitura já podia não ver o parâmetro. */
  useEffect(() => {
    if (welcomeChecked.current) return
    welcomeChecked.current = true
    try {
      const params = new URLSearchParams(window.location.search)
      if (params.get('welcome') === '1') {
        welcomeParam.current = true
        // history.replaceState (integrado com o router do Next ≥14.1) limpa
        // o URL sem o round-trip RSC de um router.replace — o layout é
        // force-dynamic (auth + BD) e não há motivo para o repetir.
        window.history.replaceState(null, '', window.location.pathname)
      }
    } catch (err) {
      console.warn('[welcome] could not read ?welcome param:', err)
    }
  }, [])

  /* ── boas-vindas (uma vez por utilizador e dispositivo) ──
     "Novo" decide-se de forma fiável: veio do onboarding (?welcome=1) — o
     sinal principal — OU a conta Clerk tem < 24 h E quase nenhum XP. A
     heurística antiga (xp_total === 0) falhava sempre — a 1.ª receita do
     onboarding já dá XP — e mostrava "de volta" a quem acabou de chegar.
     O createdAt sozinho não chega: na migração para o Clerk de produção todos
     os utilizadores existentes passam a ter createdAt = data da migração, e
     veriam o "Bem-vindo" de 1.ª vez; o limiar de XP separa-os dos novos. */
  useEffect(() => {
    if (welcomeDone.current || welcomeShown.current || !user?.id) return
    welcomeDone.current = true

    const key = `xpm_welcomed_${user.id}`
    try {
      if (localStorage.getItem(key)) return
    } catch (err) {
      console.warn('[welcome] localStorage unavailable:', err)
    }

    const accountNew = Number.isFinite(createdMs) && Date.now() - createdMs < 24 * 60 * 60 * 1000

    if (welcomeParam.current) {
      setWelcomePlan({ kind: 'new' })
      return
    }

    let cancelled = false

    // Mesmas opções que o useXP (XPProgressBar), importadas do hook: o React
    // Query reaproveita o pedido em voo ou a cache em vez de um 2.º GET
    // /api/xp cru, e o fetch leva o `signal` da query.
    queryClient.fetchQuery(xpQueryOptions)
      .then(xp => {
        if (cancelled) return
        const xpTotal = xp?.xp_total ?? 0
        if (accountNew && xpTotal < NEW_ACCOUNT_MAX_XP) {
          setWelcomePlan({ kind: 'new' })
        } else {
          setWelcomePlan({ kind: 'back', level: xp?.level ?? 1, xp: xpTotal })
        }
      })
      .catch(err => {
        console.warn('[welcome] failed:', err)
        // Conta com < 24 h e sem dados de XP: tratar como nova é o erro mais barato.
        if (!cancelled && accountNew) setWelcomePlan({ kind: 'new' })
      })

    return () => {
      cancelled = true
      // StrictMode (dev): sem repor a guarda o 2.º efeito saía cedo e o
      // fetch cancelado nunca era repetido.
      welcomeDone.current = false
    }
  }, [user?.id, createdMs, queryClient])

  // Dá tempo às outras fontes (daily-checkin, cinematic do hatch que depende
  // do GET /api/voltix) de entrarem na fila antes das boas-vindas pedirem o
  // lugar; sem voltix, não esperamos mais de 4 s.
  useEffect(() => {
    if (!welcomePlan || welcomeReady) return
    const id = window.setTimeout(() => setWelcomeReady(true), voltixLoaded ? 1500 : 4000)
    return () => window.clearTimeout(id)
  }, [welcomePlan, welcomeReady, voltixLoaded])

  // Só marca "já vimos as boas-vindas" quando o modal chega mesmo ao ecrã
  // (se o user sair antes, volta a ter direito a elas).
  useEffect(() => {
    if (welcomeSlot !== 'granted' || !user?.id) return
    welcomeShown.current = true
    try {
      localStorage.setItem(`xpm_welcomed_${user.id}`, String(Date.now()))
    } catch (err) {
      console.warn('[welcome] could not persist welcomed flag:', err)
    }
  }, [welcomeSlot, user?.id])

  /* ── daily check-in ── */
  useEffect(() => {
    // Corre no mount: a rota autentica por cookie, não precisa de esperar
    // pelo clerk-js (useUser) — isso atrasava o check-in vários segundos.
    if (checkinDone.current) return
    checkinDone.current = true

    const controller = new AbortController()

    fetch('/api/daily-checkin', { method: 'POST', signal: controller.signal })
      .then(r => r.ok ? r.json() : null)
      .then(res => {
        if (!res || res.already_checked) return

        // O GET /api/voltix, /api/xp e /api/missions correram em paralelo
        // com este POST e trouxeram os valores de ontem: refresca-os.
        void queryClient.invalidateQueries({ queryKey: ['voltix'] })
        void queryClient.invalidateQueries({ queryKey: ['xp'] })
        void queryClient.invalidateQueries({ queryKey: ['missions'] })

        const streak = res.streak ?? 0
        if (res.freeze_earned) toast(t('streak.freeze_earned'), 'info')
        // As celebrações entram numa FIFO (uma de cada vez, sem se
        // substituírem) e só abrem quando a fila de momentos o permite.
        if (streak === 7) {
          pushCelebration({ icon: '🔥', title: t('dashboard.streak_7_title'), subtitle: t('dashboard.streak_7_sub'), xp: res.xp_earned, shareStreak: streak })
        } else if (streak === 30) {
          pushCelebration({ icon: '👑', title: t('dashboard.streak_30_title'), subtitle: t('dashboard.streak_30_sub'), xp: res.xp_earned, shareStreak: streak })
        } else if (streak === 60) {
          pushCelebration({ icon: '💎', title: t('dashboard.streak_60_title'), subtitle: t('dashboard.streak_60_sub'), xp: res.xp_earned, shareStreak: streak })
        } else if (streak === 100) {
          pushCelebration({ icon: '🌟', title: t('dashboard.streak_100_title'), subtitle: t('dashboard.streak_100_sub'), xp: res.xp_earned, shareStreak: streak })
        }

        // Streak salvo por um freeze — momento raro que merece ser visto
        // (é assim que o user aprende que a proteção existe).
        if (res.freeze_used) {
          pushCelebration({
            icon:     '❄️',
            title:    t('dashboard.freeze_used_title'),
            subtitle: t('dashboard.freeze_used_sub', { n: streak }),
          })
        }

        res.badges_awarded?.forEach((b: { name: string; icon: string }) => {
          pushCelebration({ icon: b.icon, title: t('dashboard.badge_unlocked'), subtitle: b.name })
        })
      })
      .catch(err => {
        // AbortError is expected on unmount; other errors are logged but non-blocking
        if (err?.name !== 'AbortError') {
          console.warn('[daily-checkin] failed:', err)
        }
      })

    return () => {
      controller.abort()
      // StrictMode (dev) monta → limpa → remonta: sem repor a guarda, o fetch
      // abortado nunca seria repetido e o cliente não veria a resposta.
      // O servidor é idempotente (already_checked), por isso repetir é seguro.
      checkinDone.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

      {/* Wrapped-lite ("O teu ano") — convite transitório de 1 a 15/12,
          mesma categoria do PushNudgeCard (fila de momentos, dispensável,
          some depois de abrir /wrapped). */}
      <WrappedNudgeCard />

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
      {/* Só um destes monta de cada vez: a fila de momentos concede UM lugar
          (cinematic > celebração > boas-vindas > pedidos). */}
      {celebrationSlot === 'granted' && celebrations[0] && (
        <CelebrationModal
          key={celebrations[0].id}
          open
          onClose={closeCelebration}
          icon={celebrations[0].icon}
          title={celebrations[0].title}
          subtitle={celebrations[0].subtitle}
          xp={celebrations[0].xp}
          shareStreak={celebrations[0].shareStreak}
        />
      )}
      {welcomeSlot === 'granted' && welcomePlan && (
        <CelebrationModal
          open
          onClose={closeWelcome}
          icon={welcomePlan.kind === 'new' ? '⚡' : '👋'}
          title={
            welcomePlan.kind === 'new'
              ? t('dashboard.welcome_new', { name: firstName })
              : t('dashboard.welcome_back', { name: firstName })
          }
          subtitle={
            welcomePlan.kind === 'new'
              ? t('dashboard.welcome_new_sub', { mascot: mascotName })
              : t('dashboard.welcome_back_sub', { level: welcomePlan.level, xp: welcomePlan.xp })
          }
          xp={welcomePlan.kind === 'new' ? 0 : welcomePlan.xp}
        />
      )}
    </div>
  )
}
