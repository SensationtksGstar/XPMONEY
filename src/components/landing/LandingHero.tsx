import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Sparkles, Zap, Shield } from 'lucide-react'
import { getServerT }   from '@/lib/i18n/server'

/**
 * LandingHero — above-the-fold, v3.
 *
 * Rebuilt in April 2026 after the visual was flagged as "weak and unprofessional".
 * The new brief from the founder:
 *   - make the mascot the hero (people fall in love with Voltix/Penny first)
 *   - (annual-discount callout REMOVED in Oct/2026: yearly pricing lives in Pricing)
 *   - hint at NFT certificates without leading with crypto
 *   - keep the device card so it still reads as a real product, not a mood board
 *
 * Layout:
 *   LEFT  — copy + dual CTA + honest trust row (no ratings / user counts)
 *   RIGHT — device card framed by the NEW cleaner mascot art (stage 4),
 *           with an "evolve-to-6" rail under it and a floating +XP chip.
 *
 * Mobile: both grid columns are `min-w-0` and the grid is `grid-cols-1` —
 * keep it so (the hero overflowed <430px and clipped the CTA before).
 *
 * Everything above-the-fold is server-rendered. No hooks, no effects.
 * `priority` is set on the mascot image because it *is* the LCP on
 * desktop — pre-loading it keeps CLS at zero and LCP under 2s.
 */
export async function LandingHero() {
  const t = await getServerT()

  // Six evolution stages used in the rail under the device card. We render
  // all of them so visitors instantly grok "my pet grows". The current
  // stage (4) is highlighted; the rest sit at reduced opacity with a
  // grayscale filter so the progression reads as an aspirational arc.
  const EVO_RAIL = [1, 2, 3, 4, 5, 6] as const
  const CURRENT_EVO = 4

  const missions = [
    { label: t('landing.hero.card_m1'), pct: 80,  color: 'bg-green-400'   },
    { label: t('landing.hero.card_m2'), pct: 55,  color: 'bg-yellow-400'  },
    { label: t('landing.hero.card_m3'), pct: 100, color: 'bg-emerald-400' },
  ]

  return (
    <section className="relative pt-28 pb-16 md:pb-24 px-6 overflow-hidden">
      {/* Cinematic backdrop — hero art (Voltix egg cracking in a neon data
          stream) layered behind the content at reduced opacity and with a
          cool overlay so the text stays legible. This is the piece that
          gives the landing its "real game" feel without drowning the UI. */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0 bg-center bg-cover opacity-[0.28]"
          style={{ backgroundImage: 'url(/herobot.webp)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-surface-0 via-surface-0/60 to-surface-0" />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at center, transparent 40%, #0b0d10 85%)',
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      {/* grid-cols-1 + min-w-0 on the columns: without them the implicit auto track
          grows to the widest min-content (truncate/long words) and the hero
          overflows below ~430px, clipping the primary CTA. */}
      <div className="relative max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-16 items-center">
        {/* ── Copy side ─────────────────────────────────────────────── */}
        <div className="min-w-0 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/30 text-green-300 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <Sparkles className="w-3 h-3" />
            {t('landing.hero.badge')}
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-[4rem] font-bold leading-[1.02] tracking-tight mb-6">
            {t('landing.hero.title_l1_a')}{' '}
            <span className="text-green-400">
              {t('landing.hero.title_l1_emph')}
            </span>
            {t('landing.hero.title_l1_b')}<br />
            <span className="text-white/95">{t('landing.hero.title_l2_a')} </span>
            <span className="text-amber-400">
              {t('landing.hero.title_l2_emph')}
            </span>
            {t('landing.hero.title_l2_b')}
          </h1>

          <p className="text-lg text-white/70 max-w-xl mx-auto lg:mx-0 mb-7 leading-relaxed">
            {t('landing.hero.sub_a')} <strong className="text-white">{t('landing.hero.sub_evo')}</strong>
            {t('landing.hero.sub_b')}{' '}
            <strong className="text-white">{t('landing.hero.sub_cert')}</strong>{' '}
            {t('landing.hero.sub_c')}
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-3 mb-5">
            <Link
              href="/sign-up"
              className="group inline-flex items-center gap-2 bg-green-500 hover:bg-green-400 text-black font-bold px-7 py-3.5 rounded-xl text-base transition-all shadow-[0_10px_28px_-8px_rgba(0,0,0,0.6)] hover:scale-[1.02] active:scale-95"
            >
              {t('landing.hero.cta_primary')}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="#precos"
              className="inline-flex items-center gap-2 text-white/85 hover:text-white px-6 py-3.5 rounded-xl border border-white/15 hover:border-purple-400/50 hover:bg-purple-500/5 transition-all text-base font-semibold"
            >
              <Zap className="w-4 h-4 text-purple-300" />
              {t('landing.hero.cta_secondary')}
            </Link>
          </div>

          {/* Inline trust row */}
          <div className="flex items-center justify-center lg:justify-start gap-4 text-xs text-white/45 flex-wrap">
            {/* Verifiable facts only — no ratings or user counts (Omnibus). */}
            <span className="flex items-center gap-1">{t('landing.hero.trust_reviews')}</span>
            <span className="hidden sm:inline text-white/20">·</span>
            <span className="flex items-center gap-1">{t('landing.hero.trust_country')}</span>
            <span className="hidden sm:inline text-white/20">·</span>
            <span className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-emerald-400" />
              {t('landing.hero.trust_gdpr')}
            </span>
          </div>

          <p className="text-[11px] text-white/35 mt-3 lg:text-left text-center">
            {t('landing.hero.no_card')}
          </p>
        </div>

        {/* ── Visual side ───────────────────────────────────────────── */}
        <div className="relative min-w-0 flex flex-col items-center justify-center">

          {/* Main mascot — the "imagem de abertura" hero render (Voltix warrior
              holding the app). Shown as the plain image: NO glow, NO drop shadow
              (the user found those effects worsened it). Just the clean photo. */}
          <div className="relative z-20 -mb-10 pointer-events-none flex justify-center">
            <Image
              src="/mascot/hero-v2.webp"
              alt={t('landing.hero.voltix_alt')}
              width={420}
              height={420}
              priority
              className="w-[240px] sm:w-[300px] md:w-[360px] h-auto animate-mascot-float"
            />
          </div>

          {/* Device card */}
          <div className="relative w-full max-w-md z-10">
            <div className="relative bg-surface-1 border border-hairline rounded-3xl p-6 pt-10 shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
              {/* Top stats row */}
              <div className="grid grid-cols-3 gap-2 mb-5">
                <div className="bg-white/5 border border-white/5 rounded-xl p-3 text-center">
                  <p className="text-[11px] uppercase tracking-wider text-white/40">{t('landing.hero.card_score')}</p>
                  <p className="text-xl font-bold text-yellow-300 mt-0.5">74<span className="text-xs text-white/40">/100</span></p>
                </div>
                <div className="bg-white/5 border border-white/5 rounded-xl p-3 text-center">
                  <p className="text-[11px] uppercase tracking-wider text-white/40">{t('landing.hero.card_level')}</p>
                  <p className="text-xl font-bold text-green-400 mt-0.5">7</p>
                </div>
                <div className="bg-white/5 border border-white/5 rounded-xl p-3 text-center">
                  <p className="text-[11px] uppercase tracking-wider text-white/40">{t('landing.hero.card_streak')}</p>
                  <p className="text-xl font-bold text-orange-400 mt-0.5">{t('landing.hero.card_streak_val')}</p>
                </div>
              </div>

              {/* Mascot dialogue */}
              <div className="relative bg-gradient-to-b from-emerald-500/10 to-transparent rounded-2xl p-4 mb-4 border border-emerald-500/15">
                <p className="text-[11px] uppercase tracking-wider text-green-300 font-bold mb-1">{t('landing.hero.card_says')}</p>
                <p className="text-[13px] text-white/90 leading-snug">
                  {t('landing.hero.card_dialogue')}
                </p>
              </div>

              {/* XP bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between text-[11px] text-white/50 mb-1.5">
                  <span>{t('landing.hero.card_xp_label')}</span>
                  <span>{t('landing.hero.card_xp_val')}</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full w-[78%] bg-gradient-to-r from-green-400 to-emerald-300 rounded-full" />
                </div>
              </div>

              {/* Mini missions */}
              <div className="space-y-1.5">
                {missions.map(m => (
                  <div key={m.label} className="flex items-center gap-3 text-xs">
                    <div className="flex-1 min-w-0 truncate text-white/70">{m.label}</div>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
                        <div className={`h-full ${m.color} rounded-full`} style={{ width: `${m.pct}%` }} />
                      </div>
                      <span className="w-8 text-right text-[11px] font-bold text-white/60">{m.pct}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Floating XP gain chip */}
            <div className="absolute -top-4 -right-3 bg-yellow-400 text-black text-[11px] font-bold px-3 py-1.5 rounded-full shadow-xl rotate-6 z-30">
              +250 XP
            </div>
          </div>

          {/* Evolution rail */}
          <div className="relative z-10 w-full max-w-md mt-5 px-2">
            <p className="text-center text-[11px] uppercase tracking-[0.22em] text-white/40 mb-2">
              {t('landing.hero.evo_rail_label')}
            </p>
            <div className="flex items-end justify-between gap-2">
              {EVO_RAIL.map(n => {
                const isCurrent = n === CURRENT_EVO
                return (
                  <div key={n} className="flex flex-col items-center gap-1 flex-1">
                    <div
                      className={`relative w-full aspect-square rounded-lg flex items-center justify-center ${
                        isCurrent
                          ? 'bg-gradient-to-b from-emerald-500/25 to-transparent border border-emerald-400/40'
                          : 'bg-white/5 border border-white/10'
                      }`}
                    >
                      <Image
                        src={`/mascot/voltix/${n}.webp?v=9`}
                        alt={t('landing.hero.evo_alt', { n })}
                        width={80}
                        height={80}
                        className={`w-10 h-10 sm:w-12 sm:h-12 object-contain ${
                          isCurrent ? '' : 'opacity-45 grayscale'
                        }`}
                      />
                      {isCurrent && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-surface-0" />
                      )}
                    </div>
                    <span className={`text-[11px] font-bold ${
                      isCurrent ? 'text-emerald-300' : 'text-white/35'
                    }`}>
                      {n}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
