'use client'

import { useMissions } from '@/hooks/useMissions'
import { formatPercent } from '@/lib/utils'
import { Zap, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/ui/EmptyState'
import { useRouter } from 'next/navigation'

interface Props {
  userId: string
  limit?: number
}

export function MissionCard({ userId, limit = 3 }: Props) {
  const { missions, loading } = useMissions(userId)
  const router = useRouter()
  const active = missions.filter(m => m.status === 'active').slice(0, limit)

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="glass-card p-4 animate-pulse">
            <div className="h-3 bg-white/10 rounded w-2/3 mb-3" />
            <div className="h-2 bg-white/10 rounded-full" />
          </div>
        ))}
      </div>
    )
  }

  if (active.length === 0) {
    return (
      <EmptyState
        icon="🎯"
        title="Sem missões ativas"
        description="As missões renovam-se periodicamente. Continua a registar transações para desbloquear novas."
        secondary={{
          label: 'Ver todas →',
          onClick: () => router.push('/missions'),
        }}
      />
    )
  }

  return (
    <div className="space-y-3">
      {active.map(mission => {
        const pct = Math.min(100, mission.target_value > 0
          ? (mission.current_value / mission.target_value) * 100
          : 0)

        return (
          <div
            key={mission.id}
            className={cn(
              'glass-card p-4 transition-all hover:border-white/20',
              mission.is_premium && 'border-purple-500/20'
            )}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  {mission.is_premium && (
                    <Lock className="w-3 h-3 text-purple-400 flex-shrink-0" />
                  )}
                  <h3 className="text-sm font-semibold text-white truncate">{mission.title}</h3>
                </div>
                <p className="text-xs text-white/40 leading-relaxed">{mission.description}</p>
              </div>
              <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                <Zap className="w-3 h-3 text-yellow-400" />
                <span className="text-xs font-bold text-yellow-400">+{mission.xp_reward}</span>
              </div>
            </div>

            {/* Barra de progresso */}
            <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className={cn(
                  'absolute left-0 top-0 h-full rounded-full transition-all duration-700',
                  mission.is_premium ? 'bg-purple-500' : 'bg-green-500'
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-xs text-white/40">
                {mission.current_value}/{mission.target_value}
              </span>
              <span className="text-xs text-white/40">{formatPercent(pct, 0)}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
