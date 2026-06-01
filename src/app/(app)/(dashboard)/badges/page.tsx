'use client'

import { useEffect } from 'react'
import Link            from 'next/link'
import { useQuery }    from '@tanstack/react-query'
import { Crown, Lock } from 'lucide-react'
import { cn }                from '@/lib/utils'
import { BADGE_DEFINITIONS } from '@/lib/gamification'
import { useT }              from '@/lib/i18n/LocaleProvider'
import { useUserPlan }       from '@/lib/contexts/UserPlanContext'
import type { UserBadge }    from '@/types'

/**
 * /badges — achievements wall.
 *
 * April 2026: split into TWO sections so premium-only badges visually
 * stand apart instead of getting buried in the rarity grid alongside
 * standard achievements (CLAUDE.md backlog item).
 *
 *   1. Standard achievements — earned by anyone, styled by rarity tier
 *      (common / rare / epic / legendary).
 *   2. Premium achievements — Crown overlay + amber-gold frame even
 *      when un-earned. Free users see a "Apenas Premium" lock chip
 *      and a soft upgrade CTA above the section. Premium users see
 *      them like any other achievement (gated by criteria, not plan).
 *
 * Both sections share the same overall progress bar at the top so the
 * "X of Y unlocked" stat reads consistently.
 */

async function fetchUserBadges(): Promise<UserBadge[]> {
  const res = await fetch('/api/badges')
  if (!res.ok) return []
  const { data } = await res.json()
  return data ?? []
}

const RARITY_STYLE: Record<string, string> = {
  common:    'border-slate-500/30 bg-slate-500/8',
  rare:      'border-blue-500/40  bg-blue-500/8',
  epic:      'border-purple-500/40 bg-purple-500/8',
  legendary: 'border-yellow-500/40 bg-yellow-500/8',
}

const RARITY_LABEL_KEY: Record<string, 'badges.rarity.common' | 'badges.rarity.rare' | 'badges.rarity.epic' | 'badges.rarity.legendary'> = {
  common:    'badges.rarity.common',
  rare:      'badges.rarity.rare',
  epic:      'badges.rarity.epic',
  legendary: 'badges.rarity.legendary',
}

const RARITY_TEXT: Record<string, string> = {
  common:    'text-slate-400',
  rare:      'text-blue-400',
  epic:      'text-purple-400',
  legendary: 'text-yellow-400',
}

// Premium frame overrides the rarity colour with an amber-gold tint so
// the eye separates them at a glance from the standard tier. Even when
// un-earned (locked), Premium badges keep a gold-amber tint instead of
// going fully grey, signalling "exists, requires upgrade" not "missing
// achievement criteria".
const PREMIUM_EARNED_STYLE  = 'border-amber-400/60 bg-gradient-to-br from-amber-500/15 to-amber-700/5 shadow-[0_0_24px_-12px_rgba(251,191,36,0.6)]'
const PREMIUM_LOCKED_STYLE  = 'border-amber-500/25 bg-amber-500/5'

export default function BadgesPage() {
  const t            = useT()
  const { isPaid }   = useUserPlan()
  const { data: earned = [], isLoading } = useQuery({
    queryKey: ['badges'],
    queryFn:  fetchUserBadges,
  })

  // Fire badge check on mount — best-effort, no UI impact
  useEffect(() => {
    fetch('/api/badges/check', { method: 'POST' }).catch(err => {
      console.warn('[badges] badge-check call failed:', err)
    })
  }, [])

  const earnedCodes = new Set(earned.map(b => b.badge?.code ?? ''))

  // Split definitions by tier. Order within each section preserves the
  // catalogue order from gamification.ts (curated narrative).
  const standardBadges = BADGE_DEFINITIONS.filter(b => !b.is_premium)
  const premiumBadges  = BADGE_DEFINITIONS.filter(b =>  b.is_premium)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">{t('badges.title')}</h1>
        <p className="text-white/40 text-sm mt-0.5">
          {t('badges.subtitle', { earned: earned.length, total: BADGE_DEFINITIONS.length })}
        </p>
      </div>

      {/* Progresso geral — counts BOTH sections so the stat is honest */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-white/50">{t('badges.progress')}</span>
          <span className="text-sm font-bold text-green-400">
            {earned.length}/{BADGE_DEFINITIONS.length}
          </span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-1000"
            style={{ width: `${(earned.length / BADGE_DEFINITIONS.length) * 100}%` }}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="aspect-square rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* ── Standard achievements ───────────────────────────────── */}
          <section className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-white/45">
              {t('badges.section_standard')}
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {standardBadges.map(badge => {
                const isEarned = earnedCodes.has(badge.code)
                return (
                  <div
                    key={badge.code}
                    className={cn(
                      'flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all text-center',
                      isEarned
                        ? RARITY_STYLE[badge.rarity]
                        : 'border-white/5 bg-white/3 opacity-40',
                    )}
                  >
                    <span className={cn('text-3xl', !isEarned && 'grayscale')}>{badge.icon}</span>
                    <div>
                      <p className={cn('text-[11px] font-bold leading-tight', isEarned ? 'text-white' : 'text-white/50')}>
                        {badge.name}
                      </p>
                      {isEarned && (
                        <span className={cn('text-[10px] font-medium', RARITY_TEXT[badge.rarity])}>
                          {t(RARITY_LABEL_KEY[badge.rarity])}
                        </span>
                      )}
                    </div>
                    {isEarned && (
                      <span className="text-[10px] text-yellow-400 font-bold">+{badge.xp_reward} XP</span>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* ── Premium achievements ────────────────────────────────── */}
          <section className="space-y-3">
            <header className="flex items-end justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-widest text-amber-300 flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5" />
                  {t('badges.section_premium')}
                </h2>
                <p className="text-[11px] text-white/40 mt-0.5">
                  {t('badges.section_premium_sub')}
                </p>
              </div>
              {!isPaid && (
                <Link
                  href="/settings/billing"
                  className="text-[11px] font-semibold text-amber-300 hover:text-amber-200 underline underline-offset-2 transition-colors"
                >
                  {t('badges.upgrade_cta')} →
                </Link>
              )}
            </header>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {premiumBadges.map(badge => {
                const isEarned = earnedCodes.has(badge.code)
                return (
                  <div
                    key={badge.code}
                    className={cn(
                      'relative flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all text-center',
                      isEarned ? PREMIUM_EARNED_STYLE : PREMIUM_LOCKED_STYLE,
                    )}
                    aria-label={t('badges.premium_aria')}
                  >
                    {/* Crown overlay top-right — present on every premium card,
                        earned or not. Differentiates from rarity-tier styling. */}
                    <span
                      aria-hidden
                      className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 border border-amber-200/40 flex items-center justify-center shadow-[0_2px_8px_rgba(251,191,36,0.4)]"
                    >
                      <Crown className="w-3 h-3 text-amber-950" />
                    </span>

                    <span className={cn('text-3xl', !isEarned && 'opacity-50')}>
                      {badge.icon}
                    </span>
                    <div>
                      <p className={cn(
                        'text-[11px] font-bold leading-tight',
                        isEarned ? 'text-white' : 'text-white/70',
                      )}>
                        {badge.name}
                      </p>
                      {/* Earned: rarity label as usual.
                          Free user not earned: "Apenas Premium" lock chip.
                          Premium user not earned: rarity label (criteria-locked, not plan-locked). */}
                      {isEarned ? (
                        <span className={cn('text-[10px] font-medium', RARITY_TEXT[badge.rarity])}>
                          {t(RARITY_LABEL_KEY[badge.rarity])}
                        </span>
                      ) : !isPaid ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-300/90">
                          <Lock className="w-2.5 h-2.5" />
                          {t('badges.premium_locked')}
                        </span>
                      ) : (
                        <span className={cn('text-[10px] font-medium', RARITY_TEXT[badge.rarity])}>
                          {t(RARITY_LABEL_KEY[badge.rarity])}
                        </span>
                      )}
                    </div>
                    {isEarned && (
                      <span className="text-[10px] text-amber-300 font-bold">+{badge.xp_reward} XP</span>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
