'use client'

import { useState }  from 'react'
import { Crown, Check, Zap, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { track } from '@/lib/posthog'

type BillingCycle = 'monthly' | 'yearly'
type Plan = 'free' | 'plus' | 'pro' | 'family'

const PLANS = [
  {
    id:       'free',
    name:     'Grátis',
    icon:     '🌱',
    monthly:  0,
    yearly:   0,
    color:    'border-white/10',
    highlight: false,
    features: [
      'Transações ilimitadas',
      'Score de saúde financeira',
      'XP, níveis e conquistas',
      'Voltix companheiro',
      '3 missões ativas',
      '10 categorias',
      'Histórico de 3 meses',
    ],
  },
  {
    id:       'plus',
    name:     'Plus',
    icon:     '⚡',
    monthly:  2.99,
    yearly:   24.99,
    color:    'border-green-500/40',
    highlight: true,
    features: [
      'Tudo do Grátis',
      'Missões ilimitadas',
      'Categorias ilimitadas',
      'Histórico completo',
      'Objetivos financeiros ilimitados',
      'Sem publicidade',
      '📷 Scanner de faturas com IA',
      '🎓 Academia — Curso Iniciante + Certificado',
    ],
  },
  {
    id:       'pro',
    name:     'Pro',
    icon:     '👑',
    monthly:  5.99,
    yearly:   49.99,
    color:    'border-purple-500/30',
    highlight: false,
    features: [
      'Tudo do Plus',
      '🎓 Academia completa — 3 cursos + certificados',
      '💰 Perspetiva de Riqueza',
      '📊 Simulador de Investimento',
      '🎨 Voltix skins exclusivos',
      '⭐ Badge Pro exclusivo',
      'Suporte prioritário',
    ],
  },
]

const PLAN_RANK: Record<Plan, number> = { free: 0, plus: 1, pro: 2, family: 3 }

interface Props {
  currentPlan: Plan
}

export default function BillingClient({ currentPlan }: Props) {
  const [cycle, setCycle]   = useState<BillingCycle>('yearly')
  const [loading, setLoading] = useState<string | null>(null)

  async function handleUpgrade(planId: string) {
    if (planId === 'free') return
    setLoading(planId)
    track.upgrade_clicked('billing_page', planId)
    try {
      const res = await fetch('/api/billing/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plan: planId, cycle }),
      })
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(null)
    }
  }

  const yearlySaving = Math.round((1 - (24.99 / (2.99 * 12))) * 100)

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-8">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/settings" className="text-white/40 hover:text-white transition-colors p-1 -ml-1">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">Escolhe o teu plano</h1>
          <p className="text-white/40 text-sm">Sem compromisso. Cancela quando quiseres.</p>
        </div>
      </div>

      {/* Plano atual badge */}
      {currentPlan !== 'free' && (
        <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
          <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
          <p className="text-sm text-green-400 font-medium">
            Estás no plano <strong>{PLANS.find(p => p.id === currentPlan)?.icon} {PLANS.find(p => p.id === currentPlan)?.name}</strong> — obrigado pelo apoio! 🎉
          </p>
        </div>
      )}

      {/* Toggle mensal / anual */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => setCycle('monthly')}
          className={cn('px-4 py-2 rounded-xl text-sm font-medium transition-all', cycle === 'monthly' ? 'bg-white/10 text-white' : 'text-white/40')}
        >
          Mensal
        </button>
        <button
          onClick={() => setCycle('yearly')}
          className={cn('relative px-4 py-2 rounded-xl text-sm font-medium transition-all', cycle === 'yearly' ? 'bg-white/10 text-white' : 'text-white/40')}
        >
          Anual
          <span className="absolute -top-2 -right-2 bg-green-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            -{yearlySaving}%
          </span>
        </button>
      </div>

      {/* Cards de planos */}
      <div className="space-y-3">
        {PLANS.map(plan => {
          const price      = cycle === 'yearly' && plan.yearly > 0
            ? (plan.yearly / 12).toFixed(2)
            : plan.monthly.toFixed(2)
          const isFree     = plan.id === 'free'
          const isCurrent  = plan.id === currentPlan
          const isLower    = PLAN_RANK[plan.id as Plan] < PLAN_RANK[currentPlan]
          const isLoading  = loading === plan.id

          return (
            <div
              key={plan.id}
              className={cn(
                'border rounded-2xl p-5 transition-all',
                isCurrent
                  ? plan.id === 'pro' ? 'border-purple-500/60 bg-purple-500/5' : 'border-green-500/60 bg-green-500/8'
                  : plan.color,
                !isCurrent && plan.highlight ? 'bg-green-500/5' : '',
                !isCurrent && !plan.highlight ? 'bg-white/3' : '',
              )}
            >
              {isCurrent && (
                <div className="flex justify-end mb-3">
                  <span className={cn('text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1',
                    plan.id === 'pro' ? 'bg-purple-500 text-white' : 'bg-green-500 text-black'
                  )}>
                    <Check className="w-3 h-3" /> PLANO ATUAL
                  </span>
                </div>
              )}
              {!isCurrent && plan.highlight && (
                <div className="flex justify-end mb-3">
                  <span className="bg-green-500 text-black text-xs font-bold px-3 py-1 rounded-full">
                    MAIS POPULAR
                  </span>
                </div>
              )}

              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">{plan.icon}</span>
                    <h2 className="text-lg font-bold text-white">{plan.name}</h2>
                  </div>
                  {isFree ? (
                    <p className="text-2xl font-bold text-white">Grátis</p>
                  ) : (
                    <div>
                      <p className="text-2xl font-bold text-white">
                        €{price}
                        <span className="text-sm text-white/40 font-normal">/mês</span>
                      </p>
                      {cycle === 'yearly' && (
                        <p className="text-xs text-white/40">€{plan.yearly}/ano · faturado anualmente</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Button logic */}
                {isCurrent ? (
                  <div className={cn('flex items-center gap-2 font-medium px-4 py-2.5 rounded-xl text-sm',
                    plan.id === 'pro'
                      ? 'bg-purple-500/20 border border-purple-500/40 text-purple-400'
                      : 'bg-green-500/20 border border-green-500/40 text-green-400'
                  )}>
                    <Check className="w-4 h-4" />
                    Ativo
                  </div>
                ) : !isFree && !isLower && (
                  <button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={!!loading}
                    className={cn(
                      'flex items-center gap-2 font-bold px-4 py-2.5 rounded-xl transition-all active:scale-95 text-sm',
                      plan.highlight
                        ? 'bg-green-500 hover:bg-green-400 text-black'
                        : 'bg-purple-500/20 border border-purple-500/40 text-purple-400 hover:bg-purple-500/30',
                      loading && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {isLoading ? (
                      <span className="animate-spin">⚡</span>
                    ) : (
                      <>
                        <Crown className="w-4 h-4" />
                        {plan.highlight ? 'Ativar Plus' : 'Ativar Pro'}
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Features */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {plan.features.map(f => (
                  <div key={f} className="flex items-center gap-2">
                    <Check className={cn('w-3.5 h-3.5 flex-shrink-0',
                      isCurrent && plan.id === 'pro' ? 'text-purple-400' :
                      isCurrent || plan.highlight ? 'text-green-400' :
                      plan.id === 'pro' ? 'text-purple-400' : 'text-white/30'
                    )} />
                    <span className="text-xs text-white/60">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Garantia */}
      <div className="flex items-center justify-center gap-2 text-white/30 text-xs">
        <Zap className="w-3.5 h-3.5" />
        Cancela a qualquer momento · Sem taxa de cancelamento · Reembolso em 7 dias
      </div>
    </div>
  )
}
