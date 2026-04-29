import Link from 'next/link'
import dynamic from 'next/dynamic'
import { ArrowRight } from 'lucide-react'
import { Logo }                   from '@/components/ui/Logo'
import { LandingHero }            from '@/components/landing/LandingHero'
import { LandingHowItWorks }      from '@/components/landing/LandingHowItWorks'
import { LandingFeatures }        from '@/components/landing/LandingFeatures'
import { LandingAdvantages }      from '@/components/landing/LandingAdvantages'
import { LandingMascotShowcase }    from '@/components/landing/LandingMascotShowcase'
import { LandingOutcomes }          from '@/components/landing/LandingOutcomes'
import { LandingComparison }      from '@/components/landing/LandingComparison'
import { LandingReviews }         from '@/components/landing/LandingReviews'
import { LandingFAQ }             from '@/components/landing/LandingFAQ'
import { LandingPricing }         from '@/components/landing/LandingPricing'
import { LandingFooter }          from '@/components/landing/LandingFooter'
import { LanguageToggle }         from '@/components/common/LanguageToggle'
import { InstallAppButton }       from '@/components/common/InstallAppButton'
import { NewsletterSignup }       from '@/components/common/NewsletterSignup'
import { JsonLd }                 from '@/components/seo/JsonLd'
import { softwareApplication, faqPage, premiumProduct } from '@/lib/seo/jsonLd'
import { getServerT, getServerLocale } from '@/lib/i18n/server'

// Below-the-fold widgets — lazy-loaded so the initial JS payload on
// mobile doesn't carry their chunks. The FAB sits bottom-right and
// holds an entire chat client; rolling it into the critical path was
// the single biggest contributor to the 6 s mobile load reported in
// the April 2026 audit (HAR analysis: 1.3 MB JS total). Mounted with
// `ssr: false` because it has no SEO value — it's chrome.
const DragonCoinFAB = dynamic(
  () => import('@/components/common/DragonCoinFAB').then(m => ({ default: m.DragonCoinFAB })),
  { ssr: false },
)

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
  const t      = await getServerT()
  const locale = await getServerLocale()

  // FAQ rich-snippet — extract the same 8 Q&As the LandingFAQ section
  // renders client-side, but here as plain strings for schema.org. Keep
  // these in sync with src/components/landing/LandingFAQ.tsx (same keys).
  // If the FAQ list grows, append to this array — Google penalises FAQ
  // schemas that don't match the visible page content.
  const faqs = [1, 2, 3, 4, 5, 6, 7, 8].map(i => ({
    q: t(`landing.faq.q${i}` as `landing.faq.q1`),
    a: t(`landing.faq.a${i}` as `landing.faq.a1`),
  }))

  return (
    <main className="min-h-screen text-white overflow-x-hidden">
      {/* Page-specific JSON-LD. Site-wide Organization + WebSite live in
          the root layout. SoftwareApplication + FAQPage + Product unlock
          rich snippets specifically for the landing in the SERP. */}
      <JsonLd schema={softwareApplication(locale)} />
      <JsonLd schema={faqPage(faqs)} />
      <JsonLd schema={premiumProduct(locale)} />

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

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Install app — only renders when PWAInstallPrompt has detected
              a real install path (Chromium with BIP, or iOS Safari).
              Self-hiding on desktop Firefox / already-standalone / etc. */}
          <InstallAppButton />
          {/* Language toggle — EN visitors flip here without hunting through
              the app. Persists via cookie + localStorage, reloads instantly. */}
          <LanguageToggle className="mr-0.5 sm:mr-1" />
          {/* Sign-in ALWAYS visible — mobile users with existing accounts
              had no way back in before (was `hidden sm:inline-block`).
              Compact padding on mobile to keep the row balanced. */}
          <Link
            href="/sign-in"
            className="text-xs sm:text-sm text-white/70 hover:text-white transition-colors px-2 sm:px-3 py-1.5 sm:py-2"
          >
            {t('landing.nav.sign_in')}
          </Link>
          {/* "Começar grátis" — mobile got a fatter rectangle than needed.
              Tighter padding + smaller radius on mobile so the button no
              longer dominates the nav strip. */}
          <Link
            href="/sign-up"
            className="text-xs sm:text-sm bg-green-500 hover:bg-green-400 text-black font-semibold px-3 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg transition-colors"
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

      {/* ── 9.5. NEWSLETTER ─────────────────────────────────────────── */}
      <section className="px-6 py-16 max-w-2xl mx-auto">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-8">
          <NewsletterSignup source="landing" variant="default" />
        </div>
      </section>

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
