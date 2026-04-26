'use client'

import { useState }  from 'react'
import { Crown, Check, Zap, ArrowLeft, Settings as SettingsIcon } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { track } from '@/lib/posthog'
import { useT } from '@/lib/i18n/LocaleProvider'
import type { TranslationKey } from '@/lib/i18n/translations'

type BillingCycle = 'monthly' | 'yearly'
type Plan = 'free' | 'premium'

/**
 * Pricing source of truth — keep in sync with `LandingPricing.tsx`.
 *
 * Modelo 2-tier (Abril 2026):
 *   - **Free**  — generoso para atrair entrada (inclui 2 objetivos, Academia inicial,
 *                 anúncios discretos).
 *   - **Premium** — €4,99/mês · €39,99/ano (~33% desconto no anual) — tudo incluído,
 *                   sem distinção de features.
 *
 * Houve uma versão anterior com 3 tiers (Grátis/Plus/Pro). `PLAN_RANK` em
 * `src/lib/stripe.ts` e vários guards têm aliases legacy para que assinaturas
 * antigas continuem a funcionar até serem migradas (ver SQL migration).
 */
const PLANS: {
  id: 'free' | 'premium'
  nameKey: TranslationKey
  icon: string
  monthly: number
  yearly: number
  color: string
  highlight: boolean
  featureKeys: TranslationKey[]
}[] = [
  {
    id:       'free',
    nameKey:  'billing.plan_free',
    icon:     '🌱',
    monthly:  0,
    yearly:   0,
    color:    'border-white/10',
    highlight: false,
    featureKeys: [
      'billing.free_f1',
      'billing.free_f2',
      'billing.free_f3',
      'billing.free_f4',
      'billing.free_f5',
      'billing.free_f6',
      'billing.free_f7',
      'billing.free_f8',
    ],
  },
  {
    id:       'premium',
    nameKey:  'billing.plan_premium',
    icon:     '👑',
    monthly:  4.99,
    yearly:   39.99,
    color:    'border-purple-500/40',
    highlight: true,
    featureKeys: [
      'billing.premium_f1',
      'billing.premium_f2',
      'billing.premium_f3',
      'billing.premium_f4',
      'billing.premium_f5',
      'billing.premium_f6',
      'billing.premium_f7',
      'billing.premium_f8',
      'billing.premium_f9',
      'billing.premium_f10',
      'billing.premium_f11',
    ],
  },
]

const PLAN_RANK: Record<string, number> = {
  free:    0,
  premium: 1,
  // legacy aliases — quem tinha plus/pro/family já era "pago" = premium
  plus:    1,
  pro:     1,
  family:  1,
}

interface Props {
  currentPlan: Plan
}

export default function BillingClient({ currentPlan }: Props) {
  const t = useT()
  const [cycle, setCycle]     = useState<BillingCycle>('yearly')
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError]     = useState<string | null>(null)

  // Open Stripe Customer Portal — Stripe-hosted UI for cancel / update
  // card / view invoices. Setting `loading='portal'` so the badge button
  // shows a spinner; same setError() flow as checkout for consistency.
  async function handleManageSubscription() {
    setError(null)
    setLoading('portal')
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      let payload: { url?: string; error?: string } = {}
      try { payload = await res.json() } catch { /* non-JSON */ }

      if (!res.ok || !payload.url) {
        setError(payload.error ?? `HTTP ${res.status}`)
        return
      }
      window.location.href = payload.url
    } catch (err) {
      console.warn('[billing] portal failed:', err)
      setError(err instanceof Error ? err.message : 'Falha ao abrir portal.')
    } finally {
      setLoading(null)
    }
  }

  async function handleUpgrade(planId: string) {
    if (planId === 'free') return
    setError(null)
    setLoading(planId)
    track.upgrade_clicked('billing_page', planId)

    try {
      const res = await fetch('/api/billing/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plan: planId, cycle }),
      })

      // Antes engolíamos o erro com catch silencioso → o botão parava de
      // spinnar e nada acontecia. Agora lemos sempre o body e mostramos
      // o detalhe ao user (e no console) para o próximo utilizador saber
      // o que aconteceu em vez de clicar em vão.
      let payload: { url?: string; error?: string } = {}
      try { payload = await res.json() } catch { /* non-JSON response */ }

      if (!res.ok) {
        const msg = payload.error ?? t('billing.err_http', { status: res.status })
        console.warn('[billing] checkout failed:', msg)
        setError(msg)
        return
      }

      if (!payload.url) {
        setError(t('billing.err_no_url'))
        return
      }

      window.location.href = payload.url
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('billing.err_offline')
      console.warn('[billing] network error:', e)
      setError(t('billing.err_network', { msg }))
    } finally {
      setLoading(null)
    }
  }

  // Monthly × 12 = 59,88 → 39,99 == poupança de ~33%
  const yearlySaving = Math.round((1 - (39.99 / (4.99 * 12))) * 100)

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-8">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/settings" className="text-white/40 hover:text-white transition-colors p-1 -ml-1" aria-label={t('billing.back_aria')}>
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">{t('billing.choose_plan')}</h1>
          <p className="text-white/40 text-sm">{t('billing.no_commitment')}</p>
        </div>
      </div>

      {/* Plano atual badge — Premium users get a "Gerir subscrição" button
          that opens the Stripe Customer Portal (cancel, update card,
          download invoices). The Portal is the canonical place to cancel,
          fixing the bug where the chatbot pointed users here but no
          control existed. */}
      {currentPlan !== 'free' && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-purple-500/10 border border-purple-500/20 rounded-xl px-4 py-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Check className="w-5 h-5 text-purple-400 flex-shrink-0" />
            <p className="text-sm text-purple-300 font-medium" dangerouslySetInnerHTML={{ __html: t('billing.current_premium') }} />
          </div>
          <button
            type="button"
            onClick={handleManageSubscription}
            disabled={loading === 'portal'}
            className={cn(
              'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all min-h-[40px] flex-shrink-0',
              'bg-purple-500 hover:bg-purple-400 text-white',
              'disabled:opacity-60 disabled:cursor-wait',
            )}
          >
            {loading === 'portal' ? (
              <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
              <SettingsIcon className="w-3.5 h-3.5" />
            )}
            {t('billing.manage_subscription')}
          </button>
        </div>
      )}

      {/* Erro de checkout — visível. Antes o erro era silenciado em
          console.error e o user clicava em "Ativar Premium" e nada
          acontecia. Agora mostramos a causa real (Stripe price em
          falta, supabase user não encontrado, etc.) */}
      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3"
        >
          <span aria-hidden className="text-xl leading-none">⚠️</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-300">{t('billing.error_title')}</p>
            <p className="text-xs text-red-200/80 mt-0.5 break-words">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label={t('billing.close_warn_aria')}
            className="text-red-300/60 hover:text-red-200 transition-colors flex-shrink-0 min-h-[28px] min-w-[28px]"
          >
            ✕
          </button>
        </div>
      )}

      {/* Toggle mensal / anual */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => setCycle('monthly')}
          className={cn('px-4 py-2 rounded-xl text-sm font-medium transition-all', cycle === 'monthly' ? 'bg-white/10 text-white' : 'text-white/40')}
        >
          {t('billing.cycle_monthly')}
        </button>
        <button
          onClick={() => setCycle('yearly')}
          className={cn('relative px-4 py-2 rounded-xl text-sm font-medium transition-all', cycle === 'yearly' ? 'bg-white/10 text-white' : 'text-white/40')}
        >
          {t('billing.cycle_yearly')}
          <span className="absolute -top-2 -right-2 bg-purple-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
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
          const currentRank = PLAN_RANK[currentPlan] ?? 0
          const planRank    = PLAN_RANK[plan.id]     ?? 0
          const isCurrent   = planRank === currentRank
          const isLower     = planRank < currentRank
          const isLoading   = loading === plan.id

          return (
            <div
              key={plan.id}
              className={cn(
                'border rounded-2xl p-5 transition-all',
                isCurrent
                  ? plan.highlight
                    ? 'border-purple-500/60 bg-purple-500/5'
                    : 'border-green-500/60 bg-green-500/8'
                  : plan.color,
                !isCurrent && plan.highlight ? 'bg-purple-500/5' : '',
                !isCurrent && !plan.highlight ? 'bg-white/3' : '',
              )}
            >
              {isCurrent && (
                <div className="flex justify-end mb-3">
                  <span className={cn('text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1',
                    plan.highlight ? 'bg-purple-500 text-white' : 'bg-green-500 text-black'
                  )}>
                    <Check className="w-3 h-3" /> {t('billing.current_badge')}
                  </span>
                </div>
              )}
              {!isCurrent && plan.highlight && (
                <div className="flex justify-end mb-3">
                  <span className="bg-purple-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                    {t('billing.recommended')}
                  </span>
                </div>
              )}

              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">{plan.icon}</span>
                    <h2 className="text-lg font-bold text-white">{t(plan.nameKey)}</h2>
                  </div>
                  {isFree ? (
                    <p className="text-2xl font-bold text-white">{t('billing.plan_free')}</p>
                  ) : (
                    <div>
                      <p className="text-2xl font-bold text-white">
                        €{price}
                        <span className="text-sm text-white/40 font-normal">{t('billing.monthly_price')}</span>
                      </p>
                      {cycle === 'yearly' && (
                        <p className="text-xs text-white/40">{t('billing.billed_yearly', { yearly: plan.yearly })}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Button logic */}
                {isCurrent ? (
                  <div className={cn('flex items-center gap-2 font-medium px-4 py-2.5 rounded-xl text-sm',
                    plan.highlight
                      ? 'bg-purple-500/20 border border-purple-500/40 text-purple-300'
                      : 'bg-green-500/20 border border-green-500/40 text-green-400'
                  )}>
                    <Check className="w-4 h-4" />
                    {t('billing.active')}
                  </div>
                ) : !isFree && !isLower && (
                  <button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={!!loading}
                    className={cn(
                      'flex items-center gap-2 font-bold px-4 py-2.5 rounded-xl transition-all active:scale-95 text-sm',
                      'bg-purple-500 hover:bg-purple-400 text-white',
                      loading && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {isLoading ? (
                      <span className="animate-spin">⚡</span>
                    ) : (
                      <>
                        <Crown className="w-4 h-4" />
                        {t('billing.activate_premium')}
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Features */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {plan.featureKeys.map(fk => (
                  <div key={fk} className="flex items-center gap-2">
                    <Check className={cn('w-3.5 h-3.5 flex-shrink-0',
                      isCurrent && plan.highlight ? 'text-purple-300' :
                      isCurrent || plan.highlight ? 'text-purple-400' :
                      'text-white/30'
                    )} />
                    <span className="text-xs text-white/60">{t(fk)}</span>
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
        {t('billing.guarantee')}
      </div>
    </div>
  )
}
