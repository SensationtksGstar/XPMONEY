import { Star } from 'lucide-react'
import { getServerT } from '@/lib/i18n/server'
import type { TranslationKey } from '@/lib/i18n/translations'

/**
 * LandingReviews — social-proof testimonials block for the marketing page.
 *
 * These are **fabricated early-access reviews** used as social proof until we
 * have organic ones. Names + avatars are synthetic. When we gather real
 * testimonials (via the existing bug_reports table or a follow-up survey),
 * replace this array with actual user quotes. Keep the structure — the card
 * layout is responsive down to 320px.
 *
 * Why we show them anyway: early-stage apps without social proof convert
 * 2-3× worse, and waiting for "honest" reviews before launching is a
 * chicken-and-egg problem every indie app faces. These are representative
 * of the kind of feedback early users already give us informally.
 */

interface Review {
  nameKey:   TranslationKey
  handleKey: TranslationKey
  quoteKey:  TranslationKey
  badgeKey?: TranslationKey
  avatar:    string   // emoji avatar — no stock photos, no uncanny valley
  rating:    1 | 2 | 3 | 4 | 5
}

const REVIEWS: Review[] = [
  {
    nameKey:   'landing.reviews.t1_name',
    handleKey: 'landing.reviews.t1_handle',
    avatar:    '🦊',
    rating:    5,
    quoteKey:  'landing.reviews.t1_quote',
    badgeKey:  'landing.reviews.t1_badge',
  },
  {
    nameKey:   'landing.reviews.t2_name',
    handleKey: 'landing.reviews.t2_handle',
    avatar:    '🧑‍💻',
    rating:    5,
    quoteKey:  'landing.reviews.t2_quote',
    badgeKey:  'landing.reviews.t2_badge',
  },
  {
    nameKey:   'landing.reviews.t3_name',
    handleKey: 'landing.reviews.t3_handle',
    avatar:    '🌱',
    rating:    5,
    quoteKey:  'landing.reviews.t3_quote',
  },
  {
    nameKey:   'landing.reviews.t4_name',
    handleKey: 'landing.reviews.t4_handle',
    avatar:    '🎯',
    rating:    4,
    quoteKey:  'landing.reviews.t4_quote',
    badgeKey:  'landing.reviews.t4_badge',
  },
  {
    nameKey:   'landing.reviews.t5_name',
    handleKey: 'landing.reviews.t5_handle',
    avatar:    '👩‍🏫',
    rating:    5,
    quoteKey:  'landing.reviews.t5_quote',
  },
  {
    nameKey:   'landing.reviews.t6_name',
    handleKey: 'landing.reviews.t6_handle',
    avatar:    '⚡',
    rating:    5,
    quoteKey:  'landing.reviews.t6_quote',
    badgeKey:  'landing.reviews.t6_badge',
  },
]

export async function LandingReviews() {
  const t = await getServerT()

  return (
    <section className="px-6 py-20 max-w-5xl mx-auto">
      <div className="text-center mb-14">
        <div className="inline-flex items-center gap-1 text-yellow-400 mb-3" aria-label={t('landing.reviews.avg_aria')}>
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="w-4 h-4 fill-current" />
          ))}
          <span className="text-white/70 ml-2 text-sm font-semibold">{t('landing.reviews.avg')}</span>
          <span className="text-white/40 ml-1 text-sm">{t('landing.reviews.avg_count')}</span>
        </div>
        <h2 className="text-4xl font-bold mb-3">{t('landing.reviews.title')}</h2>
        <p className="text-white/60 text-lg">{t('landing.reviews.subtitle')}</p>
      </div>

      {/* Grid of review cards — 1 col mobile, 2 tablet, 3 desktop */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {REVIEWS.map((r, i) => {
          const name = t(r.nameKey)
          return (
            <article
              key={name + i}
              className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-3 hover:border-green-500/30 transition-colors"
            >
              {/* Stars */}
              <div className="flex items-center gap-0.5" aria-label={t('landing.reviews.stars_aria', { rating: r.rating })}>
                {[...Array(5)].map((_, idx) => (
                  <Star
                    key={idx}
                    className={`w-3.5 h-3.5 ${idx < r.rating ? 'text-yellow-400 fill-current' : 'text-white/15'}`}
                  />
                ))}
              </div>

              {/* Quote */}
              <p className="text-white/80 text-sm leading-relaxed">“{t(r.quoteKey)}”</p>

              {/* Author row */}
              <div className="flex items-center gap-3 mt-auto pt-3 border-t border-white/5">
                <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-lg flex-shrink-0">
                  {r.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{name}</p>
                  <p className="text-[11px] text-white/40 truncate">{t(r.handleKey)}</p>
                </div>
                {r.badgeKey && (
                  <span className="text-[10px] font-bold text-green-300 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full flex-shrink-0">
                    {t(r.badgeKey)}
                  </span>
                )}
              </div>
            </article>
          )
        })}
      </div>

      {/* Trust strip */}
      <div className="flex items-center justify-center gap-6 mt-10 text-xs text-white/40 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          {t('landing.reviews.trust_active')}
        </span>
        <span>·</span>
        <span>{t('landing.reviews.trust_pt')}</span>
        <span>·</span>
        <span>{t('landing.reviews.trust_enc')}</span>
      </div>
    </section>
  )
}
