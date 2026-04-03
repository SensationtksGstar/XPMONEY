import { auth }       from '@clerk/nextjs/server'
import { MissionCard } from '@/components/missions/MissionCard'
import { Lock }        from 'lucide-react'

export const metadata = { title: 'Missões' }

export default async function MissionsPage() {
  const { userId } = await auth()
  if (!userId) return null

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold text-white">Missões</h1>
        <p className="text-white/50 text-sm mt-0.5">Completa missões, ganha XP, sobe de nível</p>
      </div>

      {/* Missões ativas */}
      <div>
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3">Ativas</h2>
        <MissionCard userId={userId} limit={10} />
      </div>

      {/* Premium upsell */}
      <div className="border border-dashed border-white/10 rounded-xl p-6 text-center">
        <Lock className="w-8 h-8 text-white/20 mx-auto mb-3" />
        <p className="text-white/50 text-sm mb-4">
          Missões premium desbloqueadas com o plano Plus.
          <br />Desafios maiores, recompensas maiores.
        </p>
        <a
          href="/settings/billing"
          className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-500/20 transition-colors"
        >
          Ver planos
        </a>
      </div>
    </div>
  )
}
