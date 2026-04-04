'use client'

import { useState }        from 'react'
import { motion }          from 'framer-motion'
import { Lock, Zap, Crown, CheckCircle2 } from 'lucide-react'
import { useMissions }     from '@/hooks/useMissions'
import { useQueryClient }  from '@tanstack/react-query'
import { useToast }        from '@/components/ui/toaster'
import { formatPercent }   from '@/lib/utils'
import Link                from 'next/link'
import { cn }              from '@/lib/utils'

export default function MissionsPage() {
  const { missions, loading } = useMissions()
  const client  = useQueryClient()
  const { toast } = useToast()
  const [completing, setCompleting] = useState<string | null>(null)

  const active    = missions.filter(m => m.status === 'active')
  const completed = missions.filter(m => m.status === 'completed')

  async function handleComplete(missionId: string, xpReward: number, title: string) {
    setCompleting(missionId)
    try {
      const res = await fetch(`/api/missions/${missionId}/complete`, { method: 'POST' })
      if (!res.ok) throw new Error()
      client.invalidateQueries({ queryKey: ['missions'] })
      client.invalidateQueries({ queryKey: ['xp'] })
      toast(`"${title}" concluída!`, 'xp', xpReward)
    } catch {
      toast('Erro ao completar missão', 'error')
    } finally {
      setCompleting(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-bold text-white">Missões</h1>
          <p className="text-white/50 text-sm mt-0.5">Completa missões, ganha XP, sobe de nível</p>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-card p-4 animate-pulse h-24" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in-up pb-24">
      <div>
        <h1 className="text-2xl font-bold text-white">Missões</h1>
        <p className="text-white/50 text-sm mt-0.5">Completa missões, ganha XP, sobe de nível</p>
      </div>

      {/* Ativas */}
      {active.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
            Ativas ({active.length})
          </h2>
          <div className="space-y-3">
            {active.map(mission => {
              const pct = Math.min(100, mission.target_value > 0
                ? (mission.current_value / mission.target_value) * 100 : 0)
              const canComplete = pct >= 100 && mission.status === 'active'

              return (
                <motion.div
                  key={mission.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    'glass-card p-4 transition-all',
                    mission.is_premium && 'border-purple-500/20',
                    canComplete && 'border-green-500/30 bg-green-500/5',
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

                  <div className="relative h-2 bg-white/10 rounded-full overflow-hidden mb-1.5">
                    <motion.div
                      className={cn(
                        'absolute left-0 top-0 h-full rounded-full',
                        canComplete ? 'bg-green-400' : mission.is_premium ? 'bg-purple-500' : 'bg-green-500'
                      )}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/40">
                      {mission.current_value}/{mission.target_value}
                    </span>
                    {canComplete ? (
                      <button
                        onClick={() => handleComplete(mission.id, mission.xp_reward, mission.title)}
                        disabled={completing === mission.id}
                        className="flex items-center gap-1.5 bg-green-500 hover:bg-green-400 text-black text-xs font-bold px-3 py-1.5 rounded-lg transition-all active:scale-95 disabled:opacity-60"
                      >
                        {completing === mission.id ? (
                          <div className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3" />
                        )}
                        Completar
                      </button>
                    ) : (
                      <span className="text-xs text-white/40">{formatPercent(pct, 0)}</span>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      )}

      {active.length === 0 && (
        <div className="glass-card p-8 text-center">
          <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
          <p className="text-white font-medium mb-1">Todas concluídas!</p>
          <p className="text-white/40 text-sm">Novas missões em breve.</p>
        </div>
      )}

      {/* Concluídas */}
      {completed.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
            Concluídas ({completed.length})
          </h2>
          <div className="space-y-2">
            {completed.map(mission => (
              <div
                key={mission.id}
                className="flex items-center gap-3 px-4 py-3 bg-white/3 border border-white/5 rounded-xl opacity-60"
              >
                <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                <span className="text-sm text-white/60 flex-1">{mission.title}</span>
                <div className="flex items-center gap-1">
                  <Zap className="w-3 h-3 text-yellow-400/60" />
                  <span className="text-xs text-yellow-400/60 font-bold">+{mission.xp_reward}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Premium upsell */}
      <div className="border border-dashed border-white/10 rounded-xl p-5 text-center">
        <Crown className="w-7 h-7 text-yellow-400/60 mx-auto mb-2" />
        <p className="text-white/50 text-sm mb-3">
          Missões premium com recompensas maiores.<br />
          Disponíveis com o plano Plus.
        </p>
        <Link
          href="/settings/billing"
          className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-500/20 transition-colors"
        >
          Ver planos
        </Link>
      </div>
    </div>
  )
}
