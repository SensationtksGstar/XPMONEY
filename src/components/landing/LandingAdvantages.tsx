import Image from 'next/image'
import {
  ScanLine, FileText, Zap, Trophy, Target, Award,
  BarChart3, Crown, Bot, Shield, BookOpen, Sparkles,
} from 'lucide-react'
import { getServerT } from '@/lib/i18n/server'

/**
 * LandingAdvantages — master feature grid surfaced after the mascot showcase.
 *
 * Purpose: answer the implicit question "but what do I actually get?" in a
 * single scroll. The page already has a LandingFeatures section, but that
 * one is organised as 8 generic tiles. This section is different on purpose:
 *
 *   - Top strip: 4 "everyone gets this" pillars. Builds trust that the free
 *     tier isn't a crippled teaser.
 *   - Grid: 9 Premium-tagged advantages including the NFT certificate,
 *     which was previously buried in a single FAQ answer. Each card has a
 *     concrete line about WHY it matters, not just what it is.
 *   - Closing banner: evolution chart strip + a soft reminder that the
 *     €39,99/ano works out to €3,33/mês (the same callout used in hero).
 *
 * Server component — no interactivity beyond the underlying anchors.
 */

type Card = {
  icon: React.ComponentType<{ className?: string }>
  title: string
  body: string
  tag?: 'FREE' | 'PREMIUM'
  accent: 'green' | 'purple' | 'yellow' | 'emerald' | 'rose'
}

const ACCENT_CLASSES: Record<Card['accent'], { border: string; bg: string; icon: string; tag: string }> = {
  green:   { border: 'border-green-500/25',   bg: 'bg-green-500/5',   icon: 'text-green-300',   tag: 'bg-green-500/10 text-green-300 border-green-500/30' },
  purple:  { border: 'border-purple-500/25',  bg: 'bg-purple-500/5',  icon: 'text-purple-300',  tag: 'bg-purple-500/15 text-purple-200 border-purple-500/40' },
  yellow:  { border: 'border-yellow-500/25',  bg: 'bg-yellow-500/5',  icon: 'text-yellow-300',  tag: 'bg-yellow-500/10 text-yellow-200 border-yellow-500/30' },
  emerald: { border: 'border-emerald-500/25', bg: 'bg-emerald-500/5', icon: 'text-emerald-300', tag: 'bg-emerald-500/10 text-emerald-200 border-emerald-500/30' },
  rose:    { border: 'border-rose-500/30',    bg: 'bg-rose-500/5',    icon: 'text-rose-300',    tag: 'bg-rose-500/15 text-rose-200 border-rose-500/40' },
}

export async function LandingAdvantages() {
  const t = await getServerT()

  // Shared feature set. `tag` = which plan unlocks. Card order is a story:
  // start with the AI pillars (scan + import), move to gamification
  // (mascot/missions), then the heavier Premium-only analytics, end on the
  // NFT certificate which is the "why this is different" kicker.
  const CARDS: Card[] = [
    {
      icon: ScanLine,
      title: t('landing.adv.c1_title'),
      body: t('landing.adv.c1_body'),
      tag: 'PREMIUM',
      accent: 'purple',
    },
    {
      icon: FileText,
      title: t('landing.adv.c2_title'),
      body: t('landing.adv.c2_body'),
      tag: 'PREMIUM',
      accent: 'purple',
    },
    {
      icon: Trophy,
      title: t('landing.adv.c3_title'),
      body: t('landing.adv.c3_body'),
      tag: 'FREE',
      accent: 'yellow',
    },
    {
      icon: Target,
      title: t('landing.adv.c4_title'),
      body: t('landing.adv.c4_body'),
      tag: 'FREE',
      accent: 'emerald',
    },
    {
      icon: BarChart3,
      title: t('landing.adv.c5_title'),
      body: t('landing.adv.c5_body'),
      tag: 'PREMIUM',
      accent: 'purple',
    },
    {
      icon: Sparkles,
      title: t('landing.adv.c6_title'),
      body: t('landing.adv.c6_body'),
      tag: 'PREMIUM',
      accent: 'purple',
    },
    {
      icon: FileText,
      title: t('landing.adv.c7_title'),
      body: t('landing.adv.c7_body'),
      tag: 'PREMIUM',
      accent: 'purple',
    },
    {
      icon: BookOpen,
      title: t('landing.adv.c8_title'),
      body: t('landing.adv.c8_body'),
      tag: 'PREMIUM',
      accent: 'purple',
    },
    {
      icon: Award,
      title: t('landing.adv.c9_title'),
      body: t('landing.adv.c9_body'),
      tag: 'PREMIUM',
      accent: 'rose',
    },
  ]

  const FREE_PILLARS = [
    { icon: Zap,    label: t('landing.adv.pillar1') },
    { icon: Crown,  label: t('landing.adv.pillar2') },
    { icon: Shield, label: t('landing.adv.pillar3') },
    { icon: Bot,    label: t('landing.adv.pillar4') },
  ]

  return (
    <section className="relative px-6 py-24 overflow-hidden">
      {/* Ambient glow */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-[320px] h-[320px] bg-emerald-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-emerald-400 font-semibold text-sm uppercase tracking-widest mb-2">
            {t('landing.adv.eyebrow')}
          </p>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 leading-[1.1]">
            {t('landing.adv.title_a')}{' '}
            <span className="bg-gradient-to-r from-emerald-400 to-green-300 bg-clip-text text-transparent">
              {t('landing.adv.title_emph')}
            </span>
            {t('landing.adv.title_b')}
          </h2>
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            {t('landing.adv.subtitle')}
          </p>
        </div>

        {/* Free pillars */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-12">
          {FREE_PILLARS.map(p => {
            const Icon = p.icon
            return (
              <div
                key={p.label}
                className="flex items-center gap-3 bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3"
              >
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-emerald-300" />
                </div>
                <div className="text-sm font-semibold text-white/90 leading-tight">
                  {p.label}
                </div>
              </div>
            )
          })}
        </div>

        {/* Main advantages grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-14">
          {CARDS.map(card => {
            const Icon   = card.icon
            const accent = ACCENT_CLASSES[card.accent]
            return (
              <div
                key={card.title}
                className={`relative rounded-2xl p-5 border ${accent.border} ${accent.bg} backdrop-blur-sm transition-all hover:border-white/25 hover:bg-white/[0.05]`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${accent.icon}`} />
                  </div>
                  {card.tag && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${accent.tag}`}>
                      {card.tag === 'PREMIUM' ? t('landing.adv.tag_premium') : t('landing.adv.tag_free')}
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-white mb-1.5 leading-snug">{card.title}</h3>
                <p className="text-[13px] text-white/60 leading-relaxed">{card.body}</p>
              </div>
            )
          })}
        </div>

        {/* Evolution chart banner — uses the real line-up art so visitors
            can SEE the 6 stages side-by-side. Toggles between Voltix and
            Penny by rendering both stacked on mobile / side-by-side on
            wide screens. Soft overlay + caption keeps it readable. */}
        <div className="relative rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent p-6 overflow-hidden mb-12">
          <div className="text-center mb-4">
            <p className="text-[11px] uppercase tracking-[0.24em] text-emerald-300 font-bold mb-1">
              {t('landing.adv.evo_eyebrow')}
            </p>
            <h3 className="text-xl md:text-2xl font-bold text-white">
              {t('landing.adv.evo_title_a')}{' '}
              <span className="text-emerald-300">{t('landing.adv.evo_title_egg')}</span>{' '}
              {t('landing.adv.evo_title_sep')}{' '}
              <span className="text-yellow-300">{t('landing.adv.evo_title_leg')}</span>
            </h3>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="relative rounded-2xl bg-[#060b14]/50 border border-white/5 overflow-hidden">
              {/* Label posicionado no canto superior direito sobre o sprite —
                  a evolução 1 (ovo) está no canto esquerdo, pelo que colocar
                  o label aí cria sobreposição de cores. Mantemos um backdrop
                  com blur + solid fill para legibilidade mesmo que a última
                  evolução tenha tons fortes. */}
              <div className="absolute top-3 right-3 z-10 text-[10px] font-bold text-green-300 bg-[#060b14]/80 backdrop-blur-sm border border-green-500/40 px-2.5 py-1 rounded-full shadow-lg shadow-black/40">
                VOLTIX ⚡
              </div>
              <Image
                src="/mascot/evolucoes-voltix.webp"
                alt={t('landing.adv.evo_voltix_alt')}
                width={1920}
                height={600}
                sizes="(max-width: 768px) 100vw, 50vw"
                className="w-full h-auto object-contain"
              />
            </div>
            <div className="relative rounded-2xl bg-[#060b14]/50 border border-white/5 overflow-hidden">
              <div className="absolute top-3 right-3 z-10 text-[10px] font-bold text-pink-300 bg-[#060b14]/80 backdrop-blur-sm border border-pink-500/40 px-2.5 py-1 rounded-full shadow-lg shadow-black/40">
                PENNY ✨
              </div>
              <Image
                src="/mascot/evolucoes-penny.webp"
                alt={t('landing.adv.evo_penny_alt')}
                width={1920}
                height={600}
                sizes="(max-width: 768px) 100vw, 50vw"
                className="w-full h-auto object-contain"
              />
            </div>
          </div>

          <p className="text-center text-[11px] text-white/45 mt-4">
            {t('landing.adv.evo_caption_a')} <strong className="text-emerald-300">{t('landing.adv.evo_caption_em')}</strong> {t('landing.adv.evo_caption_b')}
          </p>
        </div>

        {/* Mid-section annual savings callout — repeats the hero CTA here
            so users who land mid-scroll also get the pricing nudge. */}
        <div className="relative rounded-2xl border-2 border-purple-500/40 bg-gradient-to-br from-purple-500/15 via-purple-500/5 to-transparent p-6 md:p-8 overflow-hidden">
          <div className="absolute -top-10 -right-10 w-60 h-60 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-1.5 bg-purple-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full mb-3">
                <Sparkles className="w-3 h-3" />
                {t('landing.adv.annual_chip')}
              </div>
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-2 leading-tight">
                {t('landing.adv.annual_title_a')}{' '}
                <span className="bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
                  {t('landing.adv.annual_title_em')}
                </span>
              </h3>
              <p className="text-white/65 text-sm max-w-md">
                {t('landing.adv.annual_desc_a')}
                <strong className="text-white"> {t('landing.adv.annual_desc_em')}</strong> {t('landing.adv.annual_desc_b')}
              </p>
            </div>
            <a
              href="/sign-up?plan=premium&period=yearly"
              className="group self-start md:self-auto inline-flex items-center gap-2 bg-purple-500 hover:bg-purple-400 text-white font-bold px-6 py-3.5 rounded-xl text-sm transition-all shadow-[0_10px_36px_-8px_rgba(168,85,247,0.6)] hover:scale-[1.02] whitespace-nowrap"
            >
              {t('landing.adv.annual_cta')}
              <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path d="M7.05 4.05a1 1 0 011.414 0l5.243 5.243a1 1 0 010 1.414l-5.243 5.243a1 1 0 11-1.414-1.414L11.586 10 7.05 5.464a1 1 0 010-1.414z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
