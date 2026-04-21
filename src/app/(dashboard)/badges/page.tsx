'use client'

import { useEffect } from 'react'
import { useQuery }  from '@tanstack/react-query'
import { cn }        from '@/lib/utils'
import { BADGE_DEFINITIONS } from '@/lib/gamification'
import { useT }        from '@/lib/i18n/LocaleProvider'
import type { UserBadge } from '@/types'

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

export default function BadgesPage() {
  const t = useT()
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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">{t('badges.title')}</h1>
        <p className="text-white/40 text-sm mt-0.5">
          {t('badges.subtitle', { earned: earned.length, total: BADGE_DEFINITIONS.length })}
        </p>
      </div>

      {/* Progresso geral */}
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

      {/* Grid de badges */}
      {isLoading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="aspect-square rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {BADGE_DEFINITIONS.map(badge => {
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
      )}
    </div>
  )
}
