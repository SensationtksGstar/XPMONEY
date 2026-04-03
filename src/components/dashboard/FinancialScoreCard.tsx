'use client'

import { useFinancialScore } from '@/hooks/useFinancialScore'
import { getScoreLevel, SCORE_LABELS } from '@/types'
import { cn } from '@/lib/utils'

const SCORE_COLORS: Record<string, string> = {
  critical: '#ef4444',
  low:      '#f97316',
  medium:   '#eab308',
  good:     '#22c55e',
  elite:    '#8b5cf6',
}

interface Props { userId: string }

export function FinancialScoreCard({ userId }: Props) {
  const { score, loading } = useFinancialScore(userId)

  if (loading) {
    return (
      <div className="glass-card p-6 animate-pulse">
        <div className="h-4 bg-white/10 rounded w-1/2 mb-6" />
        <div className="w-32 h-32 rounded-full bg-white/10 mx-auto" />
      </div>
    )
  }

  const value    = score?.score ?? 0
  const level    = getScoreLevel(value)
  const color    = SCORE_COLORS[level]
  const label    = SCORE_LABELS[level]
  const radius   = 45
  const circ     = 2 * Math.PI * radius
  const offset   = circ - (value / 100) * circ

  return (
    <div className="glass-card p-6 flex flex-col items-center">
      <div className="flex items-center justify-between w-full mb-4">
        <h2 className="text-sm font-semibold text-white/60">Score Financeiro</h2>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ color, backgroundColor: `${color}20`, border: `1px solid ${color}40` }}
        >
          {label}
        </span>
      </div>

      {/* Score ring */}
      <div className="relative w-36 h-36 my-2">
        <svg className="score-ring w-full h-full" viewBox="0 0 100 100">
          {/* Track */}
          <circle
            cx="50" cy="50" r={radius}
            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8"
          />
          {/* Fill */}
          <circle
            className="score-ring-fill"
            cx="50" cy="50" r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{
              filter: `drop-shadow(0 0 6px ${color}60)`,
              transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)',
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold text-white">{value}</span>
          <span className="text-xs text-white/40">de 100</span>
        </div>
      </div>

      {/* Breakdown */}
      {score?.breakdown && (
        <div className="w-full mt-4 space-y-2">
          {[
            { label: 'Poupança',        value: score.breakdown.savings_rate },
            { label: 'Controlo',        value: score.breakdown.expense_control },
            { label: 'Consistência',    value: score.breakdown.consistency },
            { label: 'Objetivos',       value: score.breakdown.goals_progress },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-2">
              <span className="text-xs text-white/40 w-24">{item.label}</span>
              <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{ width: `${(item.value / 25) * 100}%`, backgroundColor: color }}
                />
              </div>
              <span className="text-xs text-white/60 w-6 text-right">{item.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Trend */}
      {score?.trend && (
        <div className={cn('mt-3 text-xs font-medium', {
          'text-green-400': score.trend === 'up',
          'text-red-400':   score.trend === 'down',
          'text-white/40':  score.trend === 'stable',
        })}>
          {score.trend === 'up'     && '↑ A subir'}
          {score.trend === 'down'   && '↓ A descer'}
          {score.trend === 'stable' && '→ Estável'}
        </div>
      )}
    </div>
  )
}
