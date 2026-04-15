'use client'

import { Flame, Zap } from 'lucide-react'
import { useVoltix } from '@/hooks/useVoltix'
import { useUser }   from '@clerk/nextjs'
import Link          from 'next/link'

const STREAK_MESSAGES: Record<number, string> = {
  0:  'Regista hoje e começa a tua sequência! 🚀',
  1:  'Primeiro dia! Volta amanhã para manter o streak.',
  3:  '3 dias seguidos! Estás a criar o hábito.',
  7:  'Uma semana perfeita! 🏆 +100 XP de bónus.',
  14: 'Duas semanas imparáveis!',
  30: '30 dias! Lenda absoluta. 👑',
}

function getMessage(streak: number): string {
  const keys = Object.keys(STREAK_MESSAGES).map(Number).sort((a, b) => b - a)
  for (const k of keys) {
    if (streak >= k) return STREAK_MESSAGES[k]
  }
  return 'Mantém o streak para ganhar XP bónus!'
}

export function StreakBanner() {
  const { user }            = useUser()
  const { voltix, loading } = useVoltix(user?.id ?? '')

  if (loading || !voltix) return null

  const streak = voltix.streak_days ?? 0

  if (streak === 0) {
    return (
      <Link href="/transactions">
        <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 cursor-pointer hover:border-white/20 transition-all active:scale-[0.99] animate-fade-in-up">
          <div className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center flex-shrink-0">
            <Flame className="w-5 h-5 text-white/30" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">Começa o teu streak hoje</p>
            <p className="text-xs text-white/40">Regista uma transação e ganha +20 XP</p>
          </div>
          <span className="text-xs text-green-400 font-bold flex-shrink-0">Registar →</span>
        </div>
      </Link>
    )
  }

  /* milestone colours */
  const isLegend = streak >= 30
  const isEpic   = streak >= 7
  const bgColor  = isLegend ? 'bg-purple-500/10 border-purple-500/25'
                 : isEpic   ? 'bg-orange-500/10 border-orange-500/25'
                 :             'bg-orange-500/8  border-orange-500/15'
  const textColor = isLegend ? 'text-purple-300' : 'text-orange-400'
  const iconColor = isLegend ? 'text-purple-400' : 'text-orange-400'

  return (
    <div className={`flex items-center gap-3 border rounded-2xl px-4 py-3 animate-fade-in-up ${bgColor}`}>
      {/* flame icon */}
      <div className="flex-shrink-0">
        <Flame className={`w-6 h-6 ${iconColor}`} />
      </div>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold ${textColor}`}>
          {isLegend ? '👑' : '🔥'} {streak} {streak === 1 ? 'dia' : 'dias'} consecutivos!
        </p>
        <p className="text-xs text-white/40 truncate">{getMessage(streak)}</p>
      </div>

      {/* XP bonus indicator at milestone */}
      {(streak === 7 || streak === 30) && (
        <div className="flex items-center gap-1 bg-yellow-500/10 border border-yellow-500/20 px-2.5 py-1 rounded-full flex-shrink-0">
          <Zap className="w-3 h-3 text-yellow-400" />
          <span className="text-xs font-bold text-yellow-400">
            +{streak === 7 ? 100 : 500} XP
          </span>
        </div>
      )}
    </div>
  )
}
