'use client'

import { useVoltix } from '@/hooks/useVoltix'
import { cn }        from '@/lib/utils'
import type { VoltixMood } from '@/types'

const MOOD_CONFIG: Record<VoltixMood, {
  emoji:    string
  label:    string
  message:  string
  bgColor:  string
  textColor: string
}> = {
  sad:         { emoji: '😢', label: 'Triste',      bgColor: 'bg-red-500/10',    textColor: 'text-red-400',    message: 'As finanças estão difíceis. Vamos virar isso juntos?' },
  neutral:     { emoji: '😐', label: 'Neutro',      bgColor: 'bg-slate-500/10',  textColor: 'text-slate-400',  message: 'Tudo estável. Que tal registares mais alguns movimentos?' },
  happy:       { emoji: '😊', label: 'Contente',    bgColor: 'bg-green-500/10',  textColor: 'text-green-400',  message: 'Estás no bom caminho! Continua assim.' },
  excited:     { emoji: '🤩', label: 'Animado',     bgColor: 'bg-yellow-500/10', textColor: 'text-yellow-400', message: 'Incrível! O teu score está a subir. Estás quase no elite!' },
  celebrating: { emoji: '🎉', label: 'A celebrar!', bgColor: 'bg-purple-500/10', textColor: 'text-purple-400', message: 'Score Elite! Estás no top 1% dos utilizadores. Lendário!' },
}

interface Props {
  userId:   string
  expanded?: boolean
}

export function VoltixWidget({ userId, expanded = false }: Props) {
  const { voltix, loading } = useVoltix(userId)

  if (loading) {
    return (
      <div className={cn('glass-card p-6 animate-pulse', expanded && 'py-12')}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-24 h-24 rounded-full bg-white/10" />
          <div className="h-4 bg-white/10 rounded w-1/2" />
          <div className="h-3 bg-white/10 rounded w-3/4" />
        </div>
      </div>
    )
  }

  const mood   = voltix?.mood ?? 'neutral'
  const config = MOOD_CONFIG[mood]
  const evo    = voltix?.evolution_level ?? 1
  const streak = voltix?.streak_days ?? 0

  return (
    <div className={cn('glass-card p-6 flex flex-col items-center text-center', config.bgColor)}>
      <div className={cn(
        'transition-all duration-300',
        expanded ? 'text-8xl mb-6' : 'text-6xl mb-3',
        'animate-voltix-bounce'
      )}>
        {config.emoji}
      </div>

      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg font-bold text-white">Voltix</span>
        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border', config.textColor,
          config.bgColor, `border-current/30`
        )}>
          Evo {evo}
        </span>
      </div>

      <p className={cn('text-sm font-medium mb-3', config.textColor)}>
        {config.label}
      </p>

      <p className="text-xs text-white/60 leading-relaxed px-2">
        {config.message}
      </p>

      {streak > 0 && (
        <div className="mt-4 flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 px-3 py-1.5 rounded-full">
          <span className="text-sm">🔥</span>
          <span className="text-xs text-orange-400 font-medium">{streak} dias seguidos</span>
        </div>
      )}

      {expanded && (
        <div className="mt-6 w-full grid grid-cols-3 gap-3 text-center">
          {['😢', '😐', '😊', '🤩', '🎉'].map((e, i) => (
            <div key={i} className={cn(
              'p-2 rounded-lg text-2xl',
              i + 1 === evo ? 'bg-white/10 ring-2 ring-green-500/50' : 'opacity-30'
            )}>
              {e}
            </div>
          )).slice(0, 5)}
          <div className="col-span-3 text-xs text-white/30 mt-1">
            Evolução {evo}/5 — sobe com o teu score
          </div>
        </div>
      )}
    </div>
  )
}
