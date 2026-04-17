import Link from 'next/link'
import { Crown, Lock, Sparkles, Check } from 'lucide-react'

/**
 * PremiumFeatureLock — shared paywall used by full-page Premium features.
 *
 * Replaces the ad-hoc "6xl emoji + one sentence + Upgrade button" we had
 * on Simulador, Perspetiva and the PDF report. That was a hard stop that
 * failed the one rule of teaser paywalls: it didn't show the user what
 * they were missing. This component fixes that with three layers:
 *
 *   1. A faux preview — the `preview` prop renders ANY React subtree
 *      behind a soft blur + darken so the visitor sees the silhouette of
 *      the feature (a chart curve, a KPI grid, a report page). The visual
 *      does the selling without revealing the data.
 *   2. A centred lock card with the icon, title, description and 3-4
 *      concrete bullets highlighting what Premium unlocks.
 *   3. A context-aware CTA. In demo mode (NEXT_PUBLIC_DEMO_MODE=true) the
 *      primary action is "Criar conta grátis" → /sign-up, because demo
 *      users can't actually subscribe. For signed-in free users the CTA
 *      is "Fazer upgrade" → /settings/billing.
 *
 * Server component — all inputs are serializable. No hooks.
 */

interface Props {
  /** Title above the feature description. */
  title: string
  /** One-sentence description of what the feature does. */
  description: string
  /** 3-4 concrete bullets — short noun phrases. */
  bullets: string[]
  /**
   * Optional faux preview — render ANY content (real widget, fake chart,
   * whatever) and it will be shown heavily blurred behind the lock card.
   * If omitted, a generic gradient backdrop is used.
   */
  preview?: React.ReactNode
  /** Lucide icon to show in the lock card. Defaults to Crown. */
  icon?: 'crown' | 'sparkles' | 'lock'
}

const ICONS = {
  crown:    Crown,
  sparkles: Sparkles,
  lock:     Lock,
} as const

export function PremiumFeatureLock({
  title,
  description,
  bullets,
  preview,
  icon = 'crown',
}: Props) {
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'
  const Icon   = ICONS[icon]

  // Demo visitors can't actually upgrade (no Stripe, no Clerk session),
  // so the CTA points them at the real signup. Inside a real session, it
  // deep-links to billing so they see the pricing cards immediately.
  const ctaHref  = isDemo ? '/sign-up' : '/settings/billing'
  const ctaLabel = isDemo ? 'Criar conta grátis' : 'Fazer upgrade para Premium'

  return (
    <div className="relative w-full min-h-[70vh] overflow-hidden rounded-2xl">
      {/* ── Faux preview layer (heavily blurred) ─────────────────── */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none select-none"
        style={{ filter: 'blur(18px) saturate(0.9)' }}
      >
        {preview ?? (
          // Generic gradient backdrop if no preview was provided.
          <div className="w-full h-full bg-gradient-to-br from-purple-500/20 via-emerald-500/10 to-transparent" />
        )}
      </div>

      {/* Darkening + vignette so the lock card reads on top */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-[#060b14]/60 via-[#060b14]/75 to-[#060b14]/95"
      />

      {/* ── Lock card ───────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-[70vh] px-4 py-12 text-center">
        <div className="w-full max-w-md bg-[#0d1221]/90 backdrop-blur-xl border border-purple-500/25 rounded-2xl p-7 shadow-2xl shadow-purple-500/10">
          {/* Icon pill */}
          <div className="mx-auto w-14 h-14 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center mb-5">
            <Icon className="w-6 h-6 text-purple-300" />
          </div>

          {/* Premium badge */}
          <div className="inline-flex items-center gap-1.5 bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[10px] font-bold px-2.5 py-1 rounded-full mb-3">
            <Lock className="w-2.5 h-2.5" />
            PREMIUM
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">{title}</h1>
          <p className="text-white/60 text-sm leading-relaxed mb-5">
            {description}
          </p>

          {/* Bullets */}
          <ul className="text-left space-y-2 mb-6">
            {bullets.map(b => (
              <li key={b} className="flex items-start gap-2 text-sm text-white/75">
                <Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                <span>{b}</span>
              </li>
            ))}
          </ul>

          {/* CTA */}
          <Link
            href={ctaHref}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-purple-400 hover:from-purple-400 hover:to-purple-300 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-purple-500/30"
          >
            <Crown className="w-4 h-4" />
            {ctaLabel}
          </Link>

          <p className="text-[11px] text-white/40 mt-3">
            {isDemo
              ? 'Sem cartão · Menos de 30 segundos · Cancelas quando quiseres'
              : '€4,99/mês · €39,99/ano (poupas ~33%)'}
          </p>
        </div>
      </div>
    </div>
  )
}
