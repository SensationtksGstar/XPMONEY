'use client'

import Link           from 'next/link'
import { LineChart, TrendingUp, BookOpen, Lock, Crown } from 'lucide-react'
import { useUserPlan } from '@/lib/contexts/UserPlanContext'

const PLAN_RANK: Record<string, number> = {
  free:    0,
  premium: 1,
  // legacy
  plus:    1,
  pro:     1,
  family:  1,
}

interface Tool {
  href:     string
  label:    string
  desc:     string
  icon:     typeof LineChart
  emoji:    string
  gradient: string
}

// Com o modelo 2-tier, todas as Premium tools requerem o mesmo plano —
// removemos o `minPlan` granular para evitar copy inconsistente.
const TOOLS: Tool[] = [
  {
    href:     '/perspetiva',
    label:    'Perspetiva',
    desc:     'Custo real em horas de trabalho',
    icon:     LineChart,
    emoji:    '👁️',
    gradient: 'from-purple-600 to-indigo-500',
  },
  {
    href:     '/simulador',
    label:    'Simulador',
    desc:     'Projeta os teus investimentos',
    icon:     TrendingUp,
    emoji:    '📈',
    gradient: 'from-blue-600 to-cyan-500',
  },
  {
    href:     '/cursos',
    label:    'Academia',
    desc:     'Cursos com certificado oficial',
    icon:     BookOpen,
    emoji:    '🎓',
    gradient: 'from-emerald-600 to-green-500',
  },
]

export function ProToolsShowcase() {
  const { plan } = useUserPlan()
  const userRank = PLAN_RANK[plan] ?? 0
  const premiumRequired = 1

  return (
    <section aria-label="Ferramentas Premium">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-white flex items-center gap-1.5">
          <Crown className="w-4 h-4 text-purple-400" />
          Ferramentas Premium
        </h2>
        <Link href="/settings/billing" className="text-xs text-purple-300 hover:text-purple-200">
          Ver plano →
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {TOOLS.map(tool => {
          const Icon     = tool.icon
          const locked   = userRank < premiumRequired

          const href = locked ? '/settings/billing' : tool.href

          return (
            <Link
              key={tool.href}
              href={href}
              className={`relative flex flex-col items-center justify-center gap-1.5 py-4 px-2 rounded-2xl border transition-all active:scale-95 ${
                locked
                  ? 'bg-white/3 border-white/8 hover:border-purple-500/25'
                  : 'bg-white/5 border-white/10 hover:border-white/20'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tool.gradient} flex items-center justify-center text-lg shadow-lg ${locked ? 'opacity-60' : ''}`}>
                {tool.emoji}
              </div>
              <div className="text-center">
                <div className={`text-xs font-bold ${locked ? 'text-white/60' : 'text-white'}`}>
                  {tool.label}
                </div>
                <div className="text-[10px] text-white/40 leading-tight mt-0.5 line-clamp-2 hidden sm:block">
                  {tool.desc}
                </div>
              </div>

              {locked && (
                <span className="absolute top-1.5 right-1.5 inline-flex items-center gap-0.5 bg-purple-500/25 text-purple-200 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-purple-500/30">
                  <Lock className="w-2 h-2" />
                  PREMIUM
                </span>
              )}
              <Icon className="hidden" aria-hidden />
            </Link>
          )
        })}
      </div>
    </section>
  )
}
