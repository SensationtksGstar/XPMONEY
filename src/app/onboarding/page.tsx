'use client'

import { useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { ArrowRight, Check, Target, TrendingUp, PlusCircle } from 'lucide-react'
import { track } from '@/lib/posthog'
import { MascotCreature, type MascotGender } from '@/components/voltix/MascotCreature'
import { saveMascotGenderLocal } from '@/lib/mascotGender'

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

type Step = 1 | 2 | 3 | 4

export default function OnboardingPage() {
  const { user } = useUser()
  const [step, setStep]             = useState<Step>(1)
  const [mascot, setMascot]         = useState<MascotGender | ''>('')
  const [challenge, setChallenge]   = useState<string>('')
  const [goal, setGoal]             = useState<string>('')
  const [goalAmount, setGoalAmount] = useState<string>('')
  const [loading, setLoading]       = useState(false)
  const [errorMsg, setErrorMsg]     = useState<string | null>(null)

  const firstName = user?.firstName ?? 'explorador'

  function handleMascotSelect(g: MascotGender) {
    setMascot(g)
    saveMascotGenderLocal(g)
    track.onboarding_step(1, { mascot: g })
    setTimeout(() => setStep(2), 350)
  }

  function handleChallengeSelect(id: string) {
    setChallenge(id)
    track.onboarding_step(2, { challenge: id })
    setTimeout(() => setStep(3), 300)
  }

  function handleGoalSelect(id: string) {
    setGoal(id)
    track.onboarding_step(3, { goal: id })
  }

  async function handleComplete() {
    setLoading(true)
    setErrorMsg(null)
    try {
      track.onboarding_step(4, { goal_amount: goalAmount })

      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mascot_gender: mascot || 'voltix',
          challenge,
          goal,
          goal_amount: Number(goalAmount) || 0,
        }),
      })

      if (!res.ok) {
        // Surface the real server error to the UI so the user (and any log
        // watcher) can see exactly what failed instead of a silent no-op.
        let detail = `HTTP ${res.status}`
        try {
          const body = await res.json()
          detail += ` — ${JSON.stringify(body).slice(0, 400)}`
        } catch {
          try { detail += ` — ${(await res.text()).slice(0, 400)}` } catch {}
        }
        throw new Error(detail)
      }

      track.onboarding_completed(challenge)

      // Reload Clerk session to pick up publicMetadata changes (best-effort)
      await user?.reload()

      // Force full-page navigation — dashboard layout reads Supabase directly
      // so it will see onboarding_completed: true immediately.
      window.location.href = '/dashboard'
    } catch (err) {
      console.error('Erro no onboarding:', err)
      setErrorMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#060b14] flex flex-col items-center justify-center px-4 py-12">

      {/* Progress bar */}
      <div className="w-full max-w-md mb-8">
        <div className="flex items-center justify-between mb-3">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                step > s  ? 'bg-green-500 text-black' :
                step === s ? 'bg-green-500/20 border-2 border-green-500 text-green-400' :
                             'bg-white/5 border border-white/10 text-white/30'
              }`}>
                {step > s ? <Check className="w-4 h-4" /> : s}
              </div>
              {s < 4 && (
                <div className={`flex-1 h-0.5 w-16 transition-all ${step > s ? 'bg-green-500' : 'bg-white/10'}`} />
              )}
            </div>
          ))}
        </div>
        <p className="text-white/30 text-xs text-center">Passo {step} de 4</p>
      </div>

      <div className="w-full max-w-md">

          {/* PASSO 1 — Escolha de mascote */}
          {step === 1 && (
            <div key="step1" className="animate-fade-in-up">
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-white mb-2">
                  Olá, {firstName}! Escolhe o teu companheiro
                </h1>
                <p className="text-white/60">
                  Vai crescer e evoluir contigo à medida que dominas as tuas finanças.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Voltix */}
                <button
                  onClick={() => handleMascotSelect('voltix')}
                  className={`group flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all ${
                    mascot === 'voltix'
                      ? 'border-green-500 bg-green-500/10'
                      : 'border-white/10 bg-white/5 hover:border-green-500/40 hover:bg-green-500/5'
                  }`}
                >
                  <div className="w-28 h-28 flex items-center justify-center">
                    {/*
                      evo={1} — onboarding is literally the start of the
                      journey, so the user should meet their mascot as an EGG
                      (first evolution stage), not a mid-stage form. Evolves
                      as they accumulate score.
                    */}
                    <MascotCreature
                      gender="voltix"
                      evo={1}
                      mood="happy"
                      className="w-full h-full"
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-white font-bold">Voltix</p>
                    <p className="text-xs text-white/50 mt-0.5">Ovo de dragão-trovão</p>
                  </div>
                  {mascot === 'voltix' && (
                    <span className="text-xs text-green-400 font-semibold flex items-center gap-1">
                      <Check className="w-3 h-3" /> Escolhido
                    </span>
                  )}
                </button>

                {/* Penny */}
                <button
                  onClick={() => handleMascotSelect('penny')}
                  className={`group flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all ${
                    mascot === 'penny'
                      ? 'border-pink-400 bg-pink-400/10'
                      : 'border-white/10 bg-white/5 hover:border-pink-400/40 hover:bg-pink-400/5'
                  }`}
                >
                  <div className="w-28 h-28 flex items-center justify-center">
                    <MascotCreature
                      gender="penny"
                      evo={1}
                      mood="happy"
                      className="w-full h-full"
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-white font-bold">Penny</p>
                    <p className="text-xs text-white/50 mt-0.5">Ovo de gata-anjo</p>
                  </div>
                  {mascot === 'penny' && (
                    <span className="text-xs text-pink-300 font-semibold flex items-center gap-1">
                      <Check className="w-3 h-3" /> Escolhida
                    </span>
                  )}
                </button>
              </div>

              <p className="text-white/30 text-xs text-center mt-5">
                Podes trocar mais tarde nas definições.
              </p>
            </div>
          )}

          {/* PASSO 2 — Desafio */}
          {step === 2 && (
            <div key="step2" className="animate-fade-in-up">
              <div className="text-center mb-8">
                <div className="text-5xl mb-4">👋</div>
                <h1 className="text-2xl font-bold text-white mb-2">
                  Qual é o teu maior desafio?
                </h1>
                <p className="text-white/60">
                  {mascot === 'penny' ? 'A Penny' : 'O Voltix'} vai ajudar-te a ultrapassá-lo.
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
            </div>
          )}

          {/* PASSO 3 — Objetivo */}
          {step === 3 && (
            <div key="step3" className="animate-fade-in-up">
              <div className="text-center mb-8">
                <div className="text-5xl mb-4">🎯</div>
                <h1 className="text-2xl font-bold text-white mb-2">
                  Qual é o teu próximo objetivo?
                </h1>
                <p className="text-white/60">
                  {mascot === 'penny' ? 'A Penny' : 'O Voltix'} vai ajudar-te a chegar lá.
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
                onClick={() => goal && setStep(4)}
                disabled={!goal}
                className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold py-4 rounded-xl transition-all"
              >
                Continuar
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* PASSO 4 — Primeira transação / missão */}
          {step === 4 && (
            <div key="step4" className="animate-fade-in-up">
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
                      &quot;Regista 5 transações esta semana&quot; — +150 XP
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
                      Por completares o onboarding — bem-vindo ao XP-Money!
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
                    Entrar no XP-Money
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              {errorMsg && (
                <div className="mt-4 p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-red-200 text-sm break-words">
                  <p className="font-semibold mb-1">Não foi possível concluir o onboarding:</p>
                  <p className="font-mono text-xs leading-relaxed opacity-90">{errorMsg}</p>
                </div>
              )}
            </div>
          )}

      </div>
    </main>
  )
}
