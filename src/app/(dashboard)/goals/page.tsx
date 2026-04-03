'use client'

import { useState } from 'react'
import { PlusCircle, Target, TrendingUp } from 'lucide-react'
import { useGoals } from '@/hooks/useGoals'
import { formatCurrency, formatPercent } from '@/lib/utils'

export default function GoalsPage() {
  const { goals, loading } = useGoals()
  const [showForm, setShowForm] = useState(false)

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Objetivos</h1>
          <p className="text-white/50 text-sm mt-0.5">Define metas, acompanha o progresso</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-green-500 hover:bg-green-400 text-black font-bold px-4 py-2.5 rounded-xl transition-all text-sm"
        >
          <PlusCircle className="w-4 h-4" />
          Novo objetivo
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : goals.length === 0 ? (
        <div className="text-center py-16">
          <Target className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white/60 mb-2">Sem objetivos ainda</h3>
          <p className="text-white/40 text-sm mb-6">
            Define o teu primeiro objetivo e o Voltix ajuda-te a chegar lá.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-medium px-6 py-3 rounded-xl hover:bg-green-500/20 transition-colors"
          >
            Criar primeiro objetivo
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {goals.map(goal => {
            const progress = goal.target_amount > 0
              ? Math.min(100, (goal.current_amount / goal.target_amount) * 100)
              : 0
            return (
              <div key={goal.id} className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-white/20 transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{goal.icon}</span>
                    <div>
                      <h3 className="font-semibold text-white">{goal.name}</h3>
                      <p className="text-xs text-white/40">
                        {goal.deadline ? `Prazo: ${goal.deadline}` : 'Sem prazo definido'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-green-400 font-bold">{formatCurrency(goal.current_amount)}</div>
                    <div className="text-white/40 text-xs">de {formatCurrency(goal.target_amount)}</div>
                  </div>
                </div>
                <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="absolute left-0 top-0 h-full bg-green-500 rounded-full transition-all duration-1000"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="text-xs text-white/40">
                    <TrendingUp className="w-3 h-3 inline mr-1" />
                    {formatPercent(progress)} concluído
                  </div>
                  <div className="text-xs text-white/40">
                    Falta {formatCurrency(goal.target_amount - goal.current_amount)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
