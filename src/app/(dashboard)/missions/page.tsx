'use client'

import { useState }        from 'react'

import { Lock, Zap, Crown, CheckCircle2 } from 'lucide-react'
import { useMissions }     from '@/hooks/useMissions'
import { useQueryClient }  from '@tanstack/react-query'
import { CelebrationModal } from '@/components/ui/CelebrationModal'
import { formatPercent }   from '@/lib/utils'
import Link                from 'next/link'
import { cn }              from '@/lib/utils'
import { useT }            from '@/lib/i18n/LocaleProvider'

export default function MissionsPage() {
  const { missions, loading } = useMissions()
  const client  = useQueryClient()
  const t       = useT()
  const [completing, setCompleting] = useState<string | null>(null)
  const [celebration, setCelebration] = useState<{
    title: string; subtitle: string; xp: number
  } | null>(null)

  const active    = missions.filter(m => m.status === 'active')
  const completed = missions.filter(m => m.status === 'completed')

  async function handleComplete(missionId: string, xpReward: number, title: string) {
    setCompleting(missionId)
    try {
      const res = await fetch(`/api/missions/${missionId}/complete`, { method: 'POST' })
      if (!res.ok) throw new Error()
      client.invalidateQueries({ queryKey: ['missions'] })
      client.invalidateQueries({ queryKey: ['xp'] })
      // Show celebration instead of plain toast
      setCelebration({
        title:    t('missions.completed_toast_title', { title }),
        subtitle: t('missions.completed_toast_sub'),
        xp:       xpReward,
      })
    } catch {
      /* silent */
    } finally {
      setCompleting(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('missions.title')}</h1>
          <p className="text-white/50 text-sm mt-0.5">{t('missions.subtitle')}</p>
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
        <h1 className="text-2xl font-bold text-white">{t('missions.title')}</h1>
        <p className="text-white/50 text-sm mt-0.5">{t('missions.subtitle')}</p>
      </div>

      {/* Ativas */}
      {active.length > 0 ? (
        <div>
          <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
            {t('missions.active_section', { count: active.length })}
          </h2>
          <div className="space-y-3">
            {active.map(mission => {
              const pct = Math.min(100, mission.target_value > 0
                ? (mission.current_value / mission.target_value) * 100 : 0)
              const canComplete = pct >= 100 && mission.status === 'active'

              return (
                <div
                  key={mission.id}
                  className={cn(
                    'glass-card p-4 transition-all animate-fade-in-up',
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
                        {canComplete && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded-full flex-shrink-0 animate-pulse">
                            {t('missions.ready')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white/40 leading-relaxed">{mission.description}</p>
                    </div>
                    <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                      <Zap className="w-3 h-3 text-yellow-400" />
                      <span className="text-xs font-bold text-yellow-400">+{mission.xp_reward}</span>
                    </div>
                  </div>

                  <div className="relative h-2 bg-white/10 rounded-full overflow-hidden mb-1.5">
                    <div
                      className={cn(
                        'absolute left-0 top-0 h-full rounded-full transition-all duration-700',
                        canComplete ? 'bg-green-400' : mission.is_premium ? 'bg-purple-500' : 'bg-green-500'
                      )}
                      style={{ width: `${pct}%` }}
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
                        className="flex items-center gap-1.5 bg-green-500 hover:bg-green-400 text-black text-xs font-bold px-4 py-2 rounded-xl transition-all disabled:opacity-60 active:scale-95"
                      >
                        {completing === mission.id ? (
                          <div className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3" />
                        )}
                        {t('missions.complete_cta')}
                      </button>
                    ) : (
                      <span className="text-xs text-white/40">{formatPercent(pct, 0)}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        /* Empty state */
        <div className="glass-card p-10 text-center">
          <div className="text-5xl mb-4">🎯</div>
          <p className="text-white font-bold text-lg mb-1">{t('missions.empty_title')}</p>
          <p className="text-white/40 text-sm mb-4">{t('missions.empty_desc')}</p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-medium px-4 py-2 rounded-xl hover:bg-green-500/20 transition-colors"
          >
            {t('missions.empty_back')}
          </Link>
        </div>
      )}

      {/* Concluídas */}
      {completed.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
            {t('missions.done_section', { count: completed.length })}
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
          {t('missions.upsell_desc_a')}<br />
          {t('missions.upsell_desc_b')}
        </p>
        <Link
          href="/settings/billing"
          className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-500/20 transition-colors"
        >
          {t('missions.upsell_cta')}
        </Link>
      </div>

      {/* Celebration modal */}
      {celebration && (
        <CelebrationModal
          open
          onClose={() => setCelebration(null)}
          icon="🎯"
          title={celebration.title}
          subtitle={celebration.subtitle}
          xp={celebration.xp}
        />
      )}
    </div>
  )
}
