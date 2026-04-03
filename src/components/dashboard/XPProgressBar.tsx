'use client'

import { useXP } from '@/hooks/useXP'
import { getLevelFromXP, getNextLevel, getXPPercentage, calculateXPProgress, formatXP } from '@/lib/gamification'
import { Zap } from 'lucide-react'

interface Props { userId: string }

export function XPProgressBar({ userId }: Props) {
  const { xp, loading } = useXP(userId)

  if (loading) {
    return (
      <div className="glass-card p-5 animate-pulse">
        <div className="h-4 bg-white/10 rounded w-1/3 mb-4" />
        <div className="h-3 bg-white/10 rounded-full" />
      </div>
    )
  }

  const totalXP    = xp?.xp_total ?? 0
  const progress   = calculateXPProgress(totalXP)
  const level      = getLevelFromXP(totalXP)
  const nextLevel  = getNextLevel(level.number)
  const percentage = getXPPercentage(progress)

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-semibold text-white/60">Nível {level.number}</span>
        </div>
        <span className="text-sm font-bold text-yellow-400">{level.icon} {level.name}</span>
      </div>

      {/* Barra XP */}
      <div className="relative h-3 bg-white/10 rounded-full overflow-hidden mb-2">
        <div
          className="absolute left-0 top-0 h-full bg-gradient-to-r from-yellow-500 to-orange-400 rounded-full xp-bar-fill"
          style={{ width: `${percentage}%` }}
        />
        <div
          className="absolute left-0 top-0 h-full bg-white/20 rounded-full"
          style={{ width: `${percentage}%`, filter: 'blur(4px)' }}
        />
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-white/40">{formatXP(progress.xp_in_current_level)}</span>
        <span className="text-white/40">
          {nextLevel
            ? `${formatXP(progress.xp_to_next_level)} para nível ${nextLevel.number}`
            : 'Nível máximo!'
          }
        </span>
      </div>

      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
        <span className="text-xs text-white/40">XP Total</span>
        <span className="text-sm font-bold text-yellow-400">{formatXP(totalXP)}</span>
      </div>
    </div>
  )
}
