'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Check, Sparkles, Award } from 'lucide-react'
import { useT } from '@/lib/i18n/LocaleProvider'
import type { TranslationKey } from '@/lib/i18n/translations'

/**
 * LandingPricing — 2-tier (Free + Premium), with billing-period toggle.
 *
 * April 2026 rework: the older server-component version had monthly and
 * annual jammed into a single string, which blurred the savings signal.
 * Visitors saw "€4,99" and anchored there, missing that annual works out
 * to €3,33/mês — a 33% discount.
 *
 * New UX:
 *   - Monthly / Anual toggle at the top, anual selected by default
 *     because it is the option we want to convert toward.
 *   - When "Anual" is on, Premium shows €3,33/mês with €39,99/ano
 *     beneath it, a "POUPA 33%" chip and the NFT certificate bullet
 *     highlighted in rose so the eye doesn't miss it.
 *   - Each CTA passes `period=yearly|monthly` so billing page can pre-
 *     select the right plan.
 *
 * Client component because of the toggle state.
 */

type Period = 'monthly' | 'yearly'

const PREMIUM_FEATURE_KEYS: Array<{ key: TranslationKey; highlight?: boolean }> = [
  { key: 'pricing.premium_f1' },
  { key: 'pricing.premium_f2' },
  { key: 'pricing.premium_f3' },
  { key: 'pricing.premium_f4' },
  { key: 'pricing.premium_f5' },
  { key: 'pricing.premium_f6' },
  { key: 'pricing.premium_f7' },
  { key: 'pricing.premium_f8' },
  { key: 'pricing.premium_f9' },
  { key: 'pricing.premium_f10', highlight: true },
  { key: 'pricing.premium_f11' },
]

const FREE_FEATURE_KEYS: TranslationKey[] = [
  'pricing.free_f1',
  'pricing.free_f2',
  'pricing.free_f3',
  'pricing.free_f4',
  'pricing.free_f5',
  'pricing.free_f6',
]

export function LandingPricing() {
  const t = useT()
  const [period, setPeriod] = useState<Period>('yearly')

  const monthlyPrice = period === 'yearly'
    ? t('pricing.premium_month_price_y')
    : t('pricing.premium_month_price_m')
  const billedCopy   = period === 'yearly'
    ? t('pricing.premium_billed_y')
    : t('pricing.premium_billed_m')
  const ctaHref  = `/sign-up?plan=premium&period=${period}`
  const ctaLabel = period === 'yearly'
    ? t('pricing.premium_cta_y')
    : t('pricing.premium_cta_m')

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

      {/* Billing period toggle */}
      <div className="flex items-center justify-center mb-10">
        <div
          role="tablist"
          aria-label={t('pricing.toggle_aria')}
          className="inline-flex items-center gap-1 p-1 rounded-full bg-white/5 border border-white/10"
        >
          <button
            type="button"
            role="tab"
            aria-selected={period === 'monthly'}
            onClick={() => setPeriod('monthly')}
            className={`min-h-[40px] px-5 py-2 rounded-full text-sm font-semibold transition-all ${
              period === 'monthly'
                ? 'bg-white text-black shadow'
                : 'text-white/65 hover:text-white'
            }`}
          >
            {t('pricing.toggle_monthly')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={period === 'yearly'}
            onClick={() => setPeriod('yearly')}
            className={`relative min-h-[40px] px-5 py-2 rounded-full text-sm font-semibold transition-all ${
              period === 'yearly'
                ? 'bg-gradient-to-r from-purple-500 to-purple-400 text-white shadow-[0_6px_20px_-6px_rgba(168,85,247,0.6)]'
                : 'text-white/65 hover:text-white'
            }`}
          >
            {t('pricing.toggle_yearly')}
            <span className="ml-2 inline-flex items-center gap-0.5 bg-emerald-400 text-black text-[9px] font-black px-1.5 py-0.5 rounded-full tracking-wide">
              -33%
            </span>
          </button>
        </div>
      </div>

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

          <div className="flex items-baseline gap-1 mb-0.5">
            <span className="text-4xl font-bold text-white">{monthlyPrice}</span>
            <span className="text-sm text-white/50">{t('common.per_month')}</span>
          </div>
          <div className="text-sm text-white/55 mb-2">{billedCopy}</div>

          {period === 'yearly' && (
            <div className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2 py-0.5 self-start mb-5">
              <Sparkles className="w-2.5 h-2.5" />
              {t('pricing.premium_savings_chip')}
            </div>
          )}
          {period !== 'yearly' && <div className="mb-5" />}

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

          <Link
            href={ctaHref}
            className="block text-center font-bold py-3 rounded-xl text-sm transition-all bg-gradient-to-r from-purple-500 to-purple-400 hover:from-purple-400 hover:to-purple-300 text-white min-h-[48px] flex items-center justify-center shadow-[0_8px_30px_-8px_rgba(168,85,247,0.6)]"
          >
            {ctaLabel}
          </Link>

          <p className="text-center text-[10px] text-white/40 mt-3">
            {t('pricing.premium_footer')}
          </p>
        </div>
      </div>

      <p className="text-center text-xs text-white/40 mt-8">
        {t('pricing.footer_note')}
      </p>
    </section>
  )
}
