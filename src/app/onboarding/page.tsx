'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Check, Target, TrendingUp, PlusCircle } from 'lucide-react'
import { track } from '@/lib/posthog'

type Challenge = {
  id:   string
  icon: string
  text: string
}

const CHALLENGES: Challenge[] = [
  { id: 'overspend',  icon: '😬', text: 'Gasto mais do que ganho' },
  { id: 'notrack',    icon: '🤷', text: 'Não sei onde vai o dinheiro' },
  { id: 'nosavings',  icon: '💸', text: 'Não consigo poupar' },
  { id: 'debts',      icon: '📉', text: 'Tenho dívidas para gerir' },
  { id: 'planning',   icon: '🗺️', text: 'Quero planear o futuro' },
]

const GOALS = [
  { id: 'emergency', icon: '🛡️', text: 'Fundo de emergência' },
  { id: 'travel',    icon: '✈️', text: 'Viagem de sonho' },
  { id: 'house',     icon: '🏠', text: 'Casa própria' },
  { id: 'car',       icon: '🚗', text: 'Carro novo' },
  { id: 'invest',    icon: '📈', text: 'Começar a investir' },
  { id: 'debt',      icon: '⛓️', text: 'Pagar dívidas' },
  { id: 'other',     icon: '🎯', text: 'Outro objetivo' },
]

type Step = 1 | 2 | 3

export default function OnboardingPage() {
  const router = useRouter()
  const { user } = useUser()
  const [step, setStep]             = useState<Step>(1)
  const [challenge, setChallenge]   = useState<string>('')
  const [goal, setGoal]             = useState<string>('')
  const [goalAmount, setGoalAmount] = useState<string>('')
  const [loading, setLoading]       = useState(false)

  const firstName = user?.firstName ?? 'explorador'

  function handleChallengeSelect(id: string) {
    setChallenge(id)
    track.onboarding_step(1, { challenge: id })
    setTimeout(() => setStep(2), 300)
  }

  function handleGoalSelect(id: string) {
    setGoal(id)
    track.onboarding_step(2, { goal: id })
  }

  async function handleComplete() {
    setLoading(true)
    try {
      track.onboarding_step(3, { goal_amount: goalAmount })

      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge, goal, goal_amount: Number(goalAmount) || 0 }),
      })

      if (!res.ok) throw new Error('Onboarding API failed')

      track.onboarding_completed(challenge)

      // Reload Clerk session to pick up publicMetadata changes (best-effort)
      await user?.reload()

      // Force full-page navigation — dashboard layout reads Supabase directly
      // so it will see onboarding_completed: true immediately.
      window.location.href = '/dashboard'
    } catch (err) {
      console.error('Erro no onboarding:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#060b14] flex flex-col items-center justify-center px-4 py-12">

      {/* Progress bar */}
      <div className="w-full max-w-md mb-8">
        <div className="flex items-center justify-between mb-3">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                step > s  ? 'bg-green-500 text-black' :
                step === s ? 'bg-green-500/20 border-2 border-green-500 text-green-400' :
                             'bg-white/5 border border-white/10 text-white/30'
              }`}>
                {step > s ? <Check className="w-4 h-4" /> : s}
              </div>
              {s < 3 && (
                <div className={`flex-1 h-0.5 w-24 transition-all ${step > s ? 'bg-green-500' : 'bg-white/10'}`} />
              )}
            </div>
          ))}
        </div>
        <p className="text-white/30 text-xs text-center">Passo {step} de 3</p>
      </div>

      <div className="w-full max-w-md">
        <AnimatePresence mode="wait">

          {/* PASSO 1 — Desafio */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="text-center mb-8">
                <div className="text-5xl mb-4">👋</div>
                <h1 className="text-2xl font-bold text-white mb-2">
                  Olá, {firstName}!
                </h1>
                <p className="text-white/60">
                  Qual é o teu maior desafio financeiro agora?
                </p>
              </div>

              <div className="space-y-3">
                {CHALLENGES.map(c => (
                  <button
                    key={c.id}
                    onClick={() => handleChallengeSelect(c.id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                      challenge === c.id
                        ? 'border-green-500 bg-green-500/10 text-white'
                        : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    <span className="text-2xl">{c.icon}</span>
                    <span className="font-medium">{c.text}</span>
                    {challenge === c.id && (
                      <Check className="w-4 h-4 text-green-400 ml-auto" />
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* PASSO 2 — Objetivo */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="text-center mb-8">
                <div className="text-5xl mb-4">🎯</div>
                <h1 className="text-2xl font-bold text-white mb-2">
                  Qual é o teu próximo objetivo?
                </h1>
                <p className="text-white/60">
                  O Voltix vai ajudar-te a chegar lá.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                {GOALS.map(g => (
                  <button
                    key={g.id}
                    onClick={() => handleGoalSelect(g.id)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                      goal === g.id
                        ? 'border-green-500 bg-green-500/10 text-white'
                        : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    <span className="text-3xl">{g.icon}</span>
                    <span className="text-xs font-medium text-center leading-tight">{g.text}</span>
                    {goal === g.id && (
                      <Check className="w-3.5 h-3.5 text-green-400" />
                    )}
                  </button>
                ))}
              </div>

              <button
                onClick={() => goal && setStep(3)}
                disabled={!goal}
                className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold py-4 rounded-xl transition-all"
              >
                Continuar
                <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
          )}

          {/* PASSO 3 — Primeira transação / missão */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="text-center mb-8">
                <div className="text-5xl mb-4 animate-bounce">⚡</div>
                <h1 className="text-2xl font-bold text-white mb-2">
                  Estás quase lá!
                </h1>
                <p className="text-white/60">
                  Define quanto queres poupar para começar a tua missão.
                </p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
                <label className="block text-sm text-white/60 mb-3 font-medium">
                  <Target className="w-4 h-4 inline mr-2" />
                  Quanto queres poupar este mês?
                </label>
                <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus-within:border-green-500/50 transition-colors">
                  <span className="text-white/40 font-medium">€</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="100"
                    value={goalAmount}
                    onChange={e => setGoalAmount(e.target.value)}
                    className="flex-1 bg-transparent text-white placeholder-white/30 outline-none text-xl font-bold"
                  />
                </div>
                <p className="text-xs text-white/30 mt-2">Podes alterar isto a qualquer momento.</p>
              </div>

              {/* Preview do que vai acontecer */}
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-3">
                  <PlusCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-400">Missão criada automaticamente</p>
                    <p className="text-xs text-white/60 mt-0.5">
                      "Regista 5 transações esta semana" — +150 XP
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-yellow-400">+100 XP de bónus</p>
                    <p className="text-xs text-white/60 mt-0.5">
                      Por completares o onboarding — bem-vindo ao XP Money!
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleComplete}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 disabled:opacity-40 text-black font-bold py-4 rounded-xl transition-all text-lg"
              >
                {loading ? (
                  <span className="animate-spin text-xl">⚡</span>
                ) : (
                  <>
                    Entrar no XP Money
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </main>
  )
}
