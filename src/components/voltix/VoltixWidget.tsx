'use client'

import { useVoltix } from '@/hooks/useVoltix'
import { VoltixCreature, EVO_NAMES, MOOD_PALETTE } from './VoltixCreature'
import { cn } from '@/lib/utils'
import type { VoltixMood } from '@/types'

const MOOD_LABELS: Record<VoltixMood, string> = {
  sad:         'Triste',
  neutral:     'Neutro',
  happy:       'Contente',
  excited:     'Animado',
  celebrating: 'Lendário!',
}

const MOOD_MESSAGES: Record<VoltixMood, string> = {
  sad:         'As finanças estão difíceis. Vamos virar isso juntos?',
  neutral:     'Tudo estável. Regista mais movimentos para subir!',
  happy:       'Estás no bom caminho. Continua assim! 📈',
  excited:     'Score a subir! Quase no elite. Vai lá! 💪',
  celebrating: 'LENDÁRIO! Top 1% dos utilizadores. Incrível! 🏆',
}

interface Props {
  userId: string
  expanded?: boolean
}

export function VoltixWidget({ userId, expanded = false }: Props) {
  const { voltix, loading } = useVoltix(userId)

  if (loading) {
    return (
      <div className={cn('glass-card p-5 animate-pulse', expanded && 'py-10')}>
        <div className="flex flex-col items-center gap-4">
          <div className={cn('rounded-full bg-white/10', expanded ? 'w-32 h-32' : 'w-20 h-20')} />
          <div className="h-4 bg-white/10 rounded w-1/2" />
          <div className="h-3 bg-white/10 rounded w-3/4" />
        </div>
      </div>
    )
  }

  const mood    = (voltix?.mood ?? 'neutral') as VoltixMood
  const evo     = voltix?.evolution_level ?? 1
  const streak  = voltix?.streak_days ?? 0
  const palette = MOOD_PALETTE[mood]

  return (
    <div
      className="glass-card p-5 flex flex-col items-center text-center overflow-hidden relative"
      style={{ borderColor: `${palette.body}28` }}
    >
      {/* Subtle gradient top */}
      <div
        className="absolute inset-x-0 top-0 h-1 rounded-t-xl opacity-60"
        style={{ background: `linear-gradient(90deg, transparent, ${palette.body}, transparent)` }}
      />

      {/* Creature */}
      <VoltixCreature
        evo={evo}
        mood={mood}
        className={cn(expanded ? 'w-44 h-44' : 'w-24 h-24', 'mb-2')}
      />

      {/* Name + evo badge */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base font-bold text-white">
          {EVO_NAMES[evo] ?? 'Voltix'}
        </span>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
          style={{ color: palette.body, borderColor: `${palette.body}40`, backgroundColor: `${palette.body}15` }}
        >
          EVO {evo}
        </span>
      </div>

      {/* Mood label */}
      <p className="text-xs font-semibold mb-2" style={{ color: palette.accent }}>
        {MOOD_LABELS[mood]}
      </p>

      {/* Message */}
      <p className="text-xs text-white/55 leading-relaxed px-2">
        {MOOD_MESSAGES[mood]}
      </p>

      {/* Streak pill */}
      {streak > 0 && (
        <div className="mt-3 flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 px-3 py-1.5 rounded-full">
          <span className="text-sm">🔥</span>
          <span className="text-xs text-orange-400 font-medium">{streak} dias seguidos</span>
        </div>
      )}
    </div>
  )
}
