'use client'

import { Flame }     from 'lucide-react'
import { useVoltix } from '@/hooks/useVoltix'
import { useUser }   from '@clerk/nextjs'
import { useT }      from '@/lib/i18n/LocaleProvider'

/**
 * StreakChip — a streak como chip discreto no header do dashboard.
 *
 * Substitui o StreakBanner full-width (Fase 4, dashboard diet): a streak
 * é um sinal, não uma secção. Os milestones grandes continuam a celebrar
 * via CelebrationModal no daily-checkin, e a mascote fala da streak ≥3
 * (mascotSpeak). A zero renderiza null — provocar o primeiro registo é
 * trabalho do FAB e da mascote, não de um banner.
 */
export function StreakChip() {
  const t                   = useT()
  const { user }            = useUser()
  const { voltix, loading } = useVoltix(user?.id ?? '')

  if (loading || !voltix) return null

  const streak = voltix.streak_days ?? 0
  if (streak < 1) return null

  const isLegend = streak >= 30

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-bold tabular-nums ${
        isLegend
          ? 'text-purple-300 bg-purple-500/10 border-purple-500/25'
          : 'text-orange-400 bg-orange-500/10 border-orange-500/20'
      }`}
      aria-label={t('streak.chip_aria', { n: streak })}
      title={t('streak.chip_aria', { n: streak })}
    >
      <Flame className="w-3 h-3" aria-hidden />
      {streak}
    </span>
  )
}
