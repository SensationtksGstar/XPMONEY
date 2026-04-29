import Link from 'next/link'
import { Check, Sparkles, Award } from 'lucide-react'
import { getServerT } from '@/lib/i18n/server'
import type { TranslationKey } from '@/lib/i18n/translations'
import { PricingPeriodToggle } from './PricingPeriodToggle'

/**
 * LandingPricing — 2-tier (Free + Premium), with billing-period toggle.
 *
 * April 2026 mobile-perf rework: previously a single `'use client'` 200-line
 * component; the whole pricing card markup + features + toggle state shipped
 * to the client even though only the period switch needed JS. Now:
 *
 *   - This file is an async SERVER component. Renders the section header,
 *     the entire free card (totally static), and the entire premium card
 *     including BOTH yearly + monthly variants of the price/billed/CTA
 *     blocks. Variants are toggled via Tailwind's `group-data-[period=…]/p`
 *     descendant variants — pure CSS, no JS.
 *   - `PricingPeriodToggle` is a small client island that wraps the
 *     children and sets `data-period` on its root. ~50 lines of JS total
 *     instead of the entire pricing section.
 *
 * Net effect: same UX, structurally identical SSR output, ~6-8 KB less
 * client JS on the landing.
 *
 * Pricing UX intent (kept):
 *   - Anual selected by default — what we want to convert toward
 *   - Monthly equivalent (€3,33/mês) shown for anual to flatten the
 *     "€39,99 sounds like a lot" anchoring objection
 *   - "POUPA 33%" chip + NFT certificate bullet highlighted in rose
 *     when anual is active so the eye doesn't miss it
 *   - CTA carries `period=yearly|monthly` so the billing page pre-selects
 */

const PREMIUM_FEATURE_KEYS: Array<{ key: TranslationKey; highlight?: boolean }> = [
  { key: 'pricing.premium_f1' },
  { key: 'pricing.premium_f2' },
  { key: 'pricing.premium_f3' },
  { key: 'pricing.premium_f4' },
  { key: 'pricing.premium_f5' },
  { key: 'pricing.premium_f6' },
  { key: 'pricing.premium_f12' },     // Mata-Dívidas ilimitado · placed near other power-tools
  { key: 'pricing.premium_f7' },
  { key: 'pricing.premium_f8' },
  { key: 'pricing.premium_f9' },
  { key: 'pricing.premium_f10', highlight: true },
  { key: 'pricing.premium_f11' },
]

const FREE_FEATURE_KEYS: TranslationKey[] = [
  'pricing.free_f1',
  'pricing.free_f2',
  'pricing.free_f7',                  // Orçamento 50/30/20 — high-value free hook, surface early
  'pricing.free_f3',
  'pricing.free_f4',
  'pricing.free_f5',
  'pricing.free_f8',                  // Mata-Dívidas (1 dívida) — teaser into Premium
  'pricing.free_f6',
]

export async function LandingPricing() {
  const t = await getServerT()

  return (
    <section id="precos" className="px-6 py-24 max-w-5xl mx-auto">
      <div className="text-center mb-10">
        <p className="text-purple-400 font-semibold text-sm uppercase tracking-widest mb-2">{t('pricing.eyebrow')}</p>
        <h2 className="text-4xl md:text-5xl font-bold leading-[1.1]">
          {t('pricing.title_a')}{' '}
          <span className="bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
            {t('pricing.title_price')}
          </span>
          {t('pricing.title_b')}
        </h2>
        <p className="text-white/55 text-lg mt-4 max-w-xl mx-auto">
          {t('pricing.subtitle')}
        </p>
      </div>

      {/* Period toggle — the only client-side JS in this section. The
          `group/p` it sets up is read by the descendants below via
          `group-data-[period=yearly]/p:` and `group-data-[period=monthly]/p:`
          variants, so the price/CTA flip without re-rendering. */}
      <PricingPeriodToggle
        ariaLabel={t('pricing.toggle_aria')}
        monthlyLabel={t('pricing.toggle_monthly')}
        yearlyLabel={t('pricing.toggle_yearly')}
      >
        <div className="grid md:grid-cols-2 gap-5 max-w-3xl mx-auto">

          {/* ── FREE ─────────────────────────────────────────────────── */}
          <div className="relative rounded-2xl p-6 flex flex-col border border-white/10 bg-white/[0.03]">
            <div className="text-xs font-bold uppercase tracking-widest mb-3 text-white/50">
              {t('pricing.free_title')}
            </div>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-4xl font-bold text-white">€0</span>
            </div>
            <div className="text-sm text-white/50 mb-6">{t('pricing.free_duration')}</div>

            <ul className="space-y-2.5 text-sm text-white/70 mb-6 flex-1">
              {FREE_FEATURE_KEYS.map(key => (
                <li key={key} className="flex items-start gap-2">
                  <Check className="w-4 h-4 flex-shrink-0 mt-0.5 text-white/60" />
                  <span>{t(key)}</span>
                </li>
              ))}
            </ul>

            <p className="text-[10px] text-white/35 mb-3 italic">
              {t('pricing.free_ads')}
            </p>

            <Link
              href="/sign-up"
              className="block text-center font-bold py-3 rounded-xl text-sm transition-all border border-white/20 hover:border-white/40 text-white hover:bg-white/5 min-h-[48px] flex items-center justify-center"
            >
              {t('pricing.free_cta')}
            </Link>
          </div>

          {/* ── PREMIUM ──────────────────────────────────────────────── */}
          <div className="relative rounded-2xl p-6 flex flex-col border-2 border-purple-500/50 bg-gradient-to-b from-purple-500/10 to-transparent shadow-[0_12px_40px_-15px_rgba(168,85,247,0.5)]">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              {t('pricing.premium_badge')}
            </span>

            <div className="text-xs font-bold uppercase tracking-widest mb-3 text-purple-300">
              {t('pricing.premium_title')}
            </div>

            {/* Price block — both variants rendered in SSR HTML; CSS hides
                the inactive one based on the wrapper's data-period. The
                yearly variant is shown when group has data-period=yearly,
                hidden when monthly, and vice versa. */}
            <div className="flex items-baseline gap-1 mb-0.5">
              <span className="text-4xl font-bold text-white group-data-[period=monthly]/p:hidden">
                {t('pricing.premium_month_price_y')}
              </span>
              <span className="text-4xl font-bold text-white group-data-[period=yearly]/p:hidden">
                {t('pricing.premium_month_price_m')}
              </span>
              <span className="text-sm text-white/50">{t('common.per_month')}</span>
            </div>
            <div className="text-sm text-white/55 mb-2">
              <span className="group-data-[period=monthly]/p:hidden">{t('pricing.premium_billed_y')}</span>
              <span className="group-data-[period=yearly]/p:hidden">{t('pricing.premium_billed_m')}</span>
            </div>

            {/* "POUPA 33%" chip — only when yearly is active. The empty
                spacer keeps the layout height stable across both periods. */}
            <div className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2 py-0.5 self-start mb-5 group-data-[period=monthly]/p:invisible">
              <Sparkles className="w-2.5 h-2.5" />
              {t('pricing.premium_savings_chip')}
            </div>

            <ul className="space-y-2.5 text-sm text-white/75 mb-6 flex-1">
              {PREMIUM_FEATURE_KEYS.map(f => (
                <li key={f.key} className="flex items-start gap-2">
                  {f.highlight ? (
                    <Award className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-300" />
                  ) : (
                    <Check className="w-4 h-4 flex-shrink-0 mt-0.5 text-purple-400" />
                  )}
                  <span className={f.highlight ? 'text-rose-200 font-semibold' : ''}>
                    {t(f.key)}
                  </span>
                </li>
              ))}
            </ul>

            {/* CTA — render two anchors (yearly + monthly) and hide one
                via CSS. Anchors are dirt-cheap; saves shipping the
                period-aware href + label as JS state. */}
            <Link
              href="/sign-up?plan=premium&period=yearly"
              className="block text-center font-bold py-3 rounded-xl text-sm transition-all bg-gradient-to-r from-purple-500 to-purple-400 hover:from-purple-400 hover:to-purple-300 text-white min-h-[48px] flex items-center justify-center shadow-[0_8px_30px_-8px_rgba(168,85,247,0.6)] group-data-[period=monthly]/p:hidden"
            >
              {t('pricing.premium_cta_y')}
            </Link>
            <Link
              href="/sign-up?plan=premium&period=monthly"
              className="block text-center font-bold py-3 rounded-xl text-sm transition-all bg-gradient-to-r from-purple-500 to-purple-400 hover:from-purple-400 hover:to-purple-300 text-white min-h-[48px] flex items-center justify-center shadow-[0_8px_30px_-8px_rgba(168,85,247,0.6)] group-data-[period=yearly]/p:hidden"
            >
              {t('pricing.premium_cta_m')}
            </Link>

            <p className="text-center text-[10px] text-white/40 mt-3">
              {t('pricing.premium_footer')}
            </p>
          </div>
        </div>
      </PricingPeriodToggle>

      <p className="text-center text-xs text-white/40 mt-8">
        {t('pricing.footer_note')}
      </p>
    </section>
  )
}
