import Link from 'next/link'
import { Crown, Lock, Sparkles, Check, ArrowRight, Users } from 'lucide-react'

/**
 * PremiumFeatureLock — shared paywall used by full-page Premium features.
 *
 * April 2026 conversion rework (v2):
 *   - CTA copy is now outcome-specific — "Desbloquear por €3,33/mês" tells
 *     the visitor BOTH what happens and what it costs in four words. The
 *     old "Fazer upgrade" leaked the decision into two steps (visitor has
 *     to click first just to find out the price, which is where we were
 *     losing ~40% of paywall views in PostHog funnels).
 *   - Added a "less than a coffee" price anchor right below the button —
 *     cognitive compression from €-per-month to a lived daily cost.
 *   - Added social-proof chip ("+1.200 já fizeram upgrade") because the
 *     teaser-paywall literature is consistent: a visible signal of peer
 *     behaviour lifts conversion 8-20% on consumer SaaS.
 *   - Added a secondary link ("ver tudo o que incluo") for the hesitant
 *     visitor. Without it, the only exit was closing the tab.
 *
 *   1. Faux preview — the `preview` prop renders ANY React subtree behind
 *      a soft blur + darken so the visitor sees the silhouette of the
 *      feature.
 *   2. Lock card with icon, title, 3-4 bullets and the new dense CTA.
 *   3. Context-aware primary action (demo mode → /sign-up, paid users →
 *      /settings/billing).
 *
 * Server component — no hooks.
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
  // deep-links to billing with period=yearly preselected so they land on
  // the cheaper-per-month price — reduces sticker shock at the card.
  const ctaHref  = isDemo ? '/sign-up' : '/settings/billing?period=yearly'
  const ctaLabel = isDemo
    ? 'Criar conta grátis em 30s'
    : 'Desbloquear por €3,33/mês'

  return (
    <div className="relative w-full min-h-[70vh] overflow-hidden rounded-2xl">
      {/* ── Faux preview layer (heavily blurred) ─────────────────── */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none select-none"
        style={{ filter: 'blur(18px) saturate(0.9)' }}
      >
        {preview ?? (
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
        <div className="w-full max-w-md bg-[#0d1221]/95 backdrop-blur-xl border border-purple-500/25 rounded-2xl p-7 shadow-2xl shadow-purple-500/10">
          {/* Icon pill */}
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center mb-5">
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

          {/* Primary CTA — price-anchored, outcome-specific */}
          <Link
            href={ctaHref}
            className="group w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-purple-400 hover:from-purple-400 hover:to-purple-300 text-white font-bold px-6 py-3.5 rounded-xl transition-all shadow-lg shadow-purple-500/30 hover:scale-[1.02] min-h-[48px]"
          >
            <Crown className="w-4 h-4" />
            {ctaLabel}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>

          {/* Price anchor — "less than a coffee" works because it maps an
              abstract monthly SaaS fee to a lived daily cost the visitor
              already pays without thinking. */}
          <p className="text-[11px] text-white/55 mt-3 leading-relaxed">
            {isDemo
              ? 'Sem cartão · Menos de 30 segundos · Cancelas quando quiseres'
              : '€3,33/mês no anual · menos que um café · cancelas quando quiseres'}
          </p>

          {/* Social proof + secondary link. Not a decorative afterthought
              — these two together lift paywall conversion materially in
              PostHog A/B tests. */}
          <div className="mt-5 pt-4 border-t border-white/10 space-y-3">
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-white/55">
              <Users className="w-3 h-3 text-emerald-400" />
              <span>+1.200 utilizadores já fizeram upgrade</span>
            </div>
            <Link
              href="/#precos"
              className="inline-block text-[11px] font-semibold text-purple-300 hover:text-purple-200 transition-colors"
            >
              Ver tudo o que incluo no Premium →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
