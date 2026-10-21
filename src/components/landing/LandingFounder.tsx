import Link from 'next/link'
import { getServerT } from '@/lib/i18n/server'

/**
 * LandingFounder — "Quem está por trás". Takes the slot the fabricated
 * reviews block used to occupy (removed Oct/2026: invented testimonials,
 * AI-generated portraits and "1.200+ users" are a blacklisted commercial
 * practice under DL 57/2008 as amended by DL 109-G/2021 — Omnibus).
 *
 * RULE: never reintroduce user counts, ratings or testimonials that are not
 * real and verifiable. Real testimonials need written consent and the
 * person's authorised name.
 *
 * PENDING OWNER DECISION (D2): the block ships WITHOUT a name and WITHOUT a
 * photo. When the owner supplies them:
 *   - NAME  → prepend it to the body copy (`landing.founder.body`, e.g.
 *             "Sou o <nome> e construo o XP-Money sozinho, em Portugal…")
 *             or render it as a caption under the title.
 *   - PHOTO → add a real photo (plain <Image>, rounded-full, 56-72px) in the
 *             flex row ABOVE the eyebrow. Never an AI portrait.
 *
 * Server component. Surface = surface-1 + hairline, no glow.
 */
export async function LandingFounder() {
  const t = await getServerT()

  return (
    <section className="px-6 py-20 max-w-3xl mx-auto">
      <div className="bg-surface-1 border border-hairline rounded-2xl p-6 sm:p-10 text-center shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/45 mb-3">
          {t('landing.founder.eyebrow')}
        </p>
        <h2 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">
          {t('landing.founder.title')}
        </h2>
        <p className="text-white/65 text-base sm:text-lg leading-relaxed max-w-xl mx-auto mb-6">
          {t('landing.founder.body')}
        </p>
        <Link
          href="/contacto"
          className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-xl bg-surface-2 border border-hairline hover:bg-surface-3 text-white font-semibold text-sm transition-colors touch-manipulation"
        >
          {t('landing.founder.cta')}
        </Link>
      </div>
    </section>
  )
}
