import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Logo }                   from '@/components/ui/Logo'
import { LandingHero }            from '@/components/landing/LandingHero'
import { LandingHowItWorks }      from '@/components/landing/LandingHowItWorks'
import { LandingFeatures }        from '@/components/landing/LandingFeatures'
import { LandingAdvantages }      from '@/components/landing/LandingAdvantages'
import { LandingMascotShowcase }    from '@/components/landing/LandingMascotShowcase'
import { LandingWallpaperShowcase } from '@/components/landing/LandingWallpaperShowcase'
import { LandingOutcomes }          from '@/components/landing/LandingOutcomes'
import { LandingComparison }      from '@/components/landing/LandingComparison'
import { LandingReviews }         from '@/components/landing/LandingReviews'
import { LandingFAQ }             from '@/components/landing/LandingFAQ'
import { LandingPricing }         from '@/components/landing/LandingPricing'
import { LandingFooter }          from '@/components/landing/LandingFooter'
import { DragonCoinFAB }          from '@/components/common/DragonCoinFAB'
import { getServerT }             from '@/lib/i18n/server'

/**
 * Landing page — the face of XP-Money.
 *
 * Page flow (ordered to walk the reader from "what is this?" → "I want it"):
 *
 *   1. Hero              — promise + trust row + real product visual
 *   2. How it works      — de-risks the first 30 seconds
 *   3. Features          — 8 cards, real features (scan, import PDF, etc.)
 *   4. Mascot showcase   — the unique differentiator (dual 6-evo mascots)
 *   5. Outcomes          — concrete numbers (€, streak days, rating)
 *   6. Comparison        — vs Excel / generic bank apps
 *   7. Reviews           — 6 testimonials with ratings
 *   8. FAQ               — 8 real objections, answered
 *   9. Pricing           — Free / Premium with honest features
 *  10. Final CTA         — last push to /sign-up
 *  11. Footer            — product / company / legal
 *
 * Sections 1-6 are server-rendered for SEO + fast first paint. Only the
 * FAQ accordion is client. Mascot assets are actual /mascot/*.webp that
 * the app uses — we're literally showing the product.
 */
export default async function LandingPage() {
  const t = await getServerT()

  return (
    <main className="min-h-screen bg-[#060b14] text-white overflow-x-hidden">

      {/* ── NAV ─────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3.5 border-b border-white/5 bg-[#060b14]/85 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2">
          <Logo size={32} />
          <span className="font-bold text-lg text-white tracking-tight">XP-Money</span>
        </Link>

        {/* Middle nav (desktop only) */}
        <div className="hidden md:flex items-center gap-7 text-sm text-white/60">
          <a href="#como-funciona"    className="hover:text-white transition-colors">{t('landing.nav.how_it_works')}</a>
          <a href="#funcionalidades"  className="hover:text-white transition-colors">{t('landing.nav.features')}</a>
          <a href="#precos"           className="hover:text-white transition-colors">{t('landing.nav.pricing')}</a>
          <a href="#faq"              className="hover:text-white transition-colors">{t('landing.nav.faq')}</a>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/sign-in"
            className="text-sm text-white/70 hover:text-white transition-colors px-3 py-2 hidden sm:inline-block"
          >
            {t('landing.nav.sign_in')}
          </Link>
          <Link
            href="/sign-up"
            className="text-sm bg-green-500 hover:bg-green-400 text-black font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            {t('landing.nav.cta')}
          </Link>
        </div>
      </nav>

      {/* ── 1. HERO ─────────────────────────────────────────────────── */}
      <LandingHero />

      {/* ── 2. HOW IT WORKS ─────────────────────────────────────────── */}
      <div id="como-funciona" className="scroll-mt-20">
        <LandingHowItWorks />
      </div>

      {/* ── 3. FEATURES ─────────────────────────────────────────────── */}
      <div id="funcionalidades" className="scroll-mt-20">
        <LandingFeatures />
      </div>

      {/* ── 4. MASCOT SHOWCASE ──────────────────────────────────────── */}
      <LandingMascotShowcase />

      {/* ── 4.3. WALLPAPER SHOWCASE (interactive shader fidget) ─────── */}
      <LandingWallpaperShowcase />

      {/* ── 4.5. ADVANTAGES (NEW) ───────────────────────────────────── */}
      <LandingAdvantages />

      {/* ── 5. OUTCOMES ─────────────────────────────────────────────── */}
      <LandingOutcomes />

      {/* ── 6. COMPARISON ───────────────────────────────────────────── */}
      <LandingComparison />

      {/* ── 7. REVIEWS ──────────────────────────────────────────────── */}
      <LandingReviews />

      {/* ── 8. FAQ ──────────────────────────────────────────────────── */}
      <div id="faq" className="scroll-mt-20">
        <LandingFAQ />
      </div>

      {/* ── 9. PRICING ──────────────────────────────────────────────── */}
      <LandingPricing />

      {/* ── 10. FINAL CTA ───────────────────────────────────────────── */}
      <section className="px-6 py-24 text-center relative overflow-hidden">
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-green-500/10 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-2xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
            {t('landing.cta.title_a')}{' '}
            <span className="bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">
              {t('landing.cta.title_emph')}
            </span>
          </h2>
          <p className="text-white/60 text-lg mb-8 max-w-xl mx-auto">
            {t('landing.cta.subtitle')}
          </p>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-400 text-black font-bold px-10 py-4 rounded-xl text-lg transition-all shadow-[0_12px_40px_-15px_rgba(34,197,94,0.6)] hover:scale-[1.02]"
          >
            {t('landing.cta.button')}
            <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="text-xs text-white/35 mt-5">
            {t('landing.cta.footer')}
          </p>
        </div>
      </section>

      {/* ── 11. FOOTER ──────────────────────────────────────────────── */}
      <LandingFooter />

      {/* Persistent Dragon Coin chat FAB — visible on every landing section. */}
      <DragonCoinFAB />
    </main>
  )
}
