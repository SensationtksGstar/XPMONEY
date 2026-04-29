'use client'

import { useState } from 'react'

/**
 * PricingPeriodToggle — minimal client island for LandingPricing.
 *
 * Why this exists separately: LandingPricing was the second-largest client
 * component on the landing (~9 KB gzipped), but only the toggle and the
 * dependent text need interactivity. Splitting the toggle into a tiny
 * island keeps the rest of the pricing section server-rendered (header
 * copy, free card, full premium feature list) so first-paint HTML is
 * complete and the JS that actually has to ship is the bare 30 lines
 * for the period switch.
 *
 * State propagation: the wrapper sets `data-period` on its root. Server-
 * rendered descendants use Tailwind's `group-data-[period=yearly]/p:…`
 * variants to flip styles/visibility without re-rendering. No context
 * needed, no React tree updates beyond this component itself.
 *
 * Children are server components passed in by `LandingPricing`. The
 * Next.js App Router resolves them at the parent boundary, so they
 * never become client components themselves. Labels are pre-localised
 * by the parent (the toggle has no access to `useT`'s server flavour).
 */
type Period = 'monthly' | 'yearly'

interface Props {
  children: React.ReactNode
  /** Aria label for the toggle's tablist. */
  ariaLabel: string
  /** "Mensal" / "Monthly" — pre-localised by the server parent. */
  monthlyLabel: string
  /** "Anual" / "Yearly". */
  yearlyLabel:  string
}

export function PricingPeriodToggle({
  children, ariaLabel, monthlyLabel, yearlyLabel,
}: Props) {
  const [period, setPeriod] = useState<Period>('yearly')

  return (
    // The `group/p` named scope lets descendants target this wrapper's
    // data-period via `group-data-[period=...]/p:` Tailwind variants.
    // Naming the group ("p") avoids collisions with any other Tailwind
    // groups that may exist in nested cards.
    <div className="group/p" data-period={period}>
      <div className="flex items-center justify-center mb-10">
        <div
          role="tablist"
          aria-label={ariaLabel}
          className="inline-flex items-center gap-1 p-1 rounded-full bg-white/5 border border-white/10"
        >
          <button
            type="button"
            role="tab"
            aria-selected={period === 'monthly'}
            onClick={() => setPeriod('monthly')}
            className={`min-h-[40px] px-5 py-2 rounded-full text-sm font-semibold transition-all touch-manipulation ${
              period === 'monthly'
                ? 'bg-white text-black shadow'
                : 'text-white/65 hover:text-white'
            }`}
          >
            {monthlyLabel}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={period === 'yearly'}
            onClick={() => setPeriod('yearly')}
            className={`relative min-h-[40px] px-5 py-2 rounded-full text-sm font-semibold transition-all touch-manipulation ${
              period === 'yearly'
                ? 'bg-gradient-to-r from-purple-500 to-purple-400 text-white shadow-[0_6px_20px_-6px_rgba(168,85,247,0.6)]'
                : 'text-white/65 hover:text-white'
            }`}
          >
            {yearlyLabel}
            <span className="ml-2 inline-flex items-center gap-0.5 bg-emerald-400 text-black text-[9px] font-black px-1.5 py-0.5 rounded-full tracking-wide">
              -33%
            </span>
          </button>
        </div>
      </div>

      {children}
    </div>
  )
}
