'use client'

import { useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { ArrowRight, Check, Target, TrendingUp, PlusCircle } from 'lucide-react'
import { track } from '@/lib/posthog'
import { MascotCreature, type MascotGender } from '@/components/voltix/MascotCreature'
import { saveMascotGenderLocal } from '@/lib/mascotGender'
import { useT } from '@/lib/i18n/LocaleProvider'
import type { TranslationKey } from '@/lib/i18n/translations'

type Challenge = {
  id:      string
  icon:    string
  textKey: TranslationKey
}

const CHALLENGES: Challenge[] = [
  { id: 'overspend',  icon: '😬', textKey: 'onboarding.challenge_overspend' },
  { id: 'notrack',    icon: '🤷', textKey: 'onboarding.challenge_notrack' },
  { id: 'nosavings',  icon: '💸', textKey: 'onboarding.challenge_nosavings' },
  { id: 'debts',      icon: '📉', textKey: 'onboarding.challenge_debts' },
  { id: 'planning',   icon: '🗺️', textKey: 'onboarding.challenge_planning' },
]

const GOALS: { id: string; icon: string; textKey: TranslationKey }[] = [
  { id: 'emergency', icon: '🛡️', textKey: 'onboarding.goal_emergency' },
  { id: 'travel',    icon: '✈️', textKey: 'onboarding.goal_travel' },
  { id: 'house',     icon: '🏠', textKey: 'onboarding.goal_house' },
  { id: 'car',       icon: '🚗', textKey: 'onboarding.goal_car' },
  { id: 'invest',    icon: '📈', textKey: 'onboarding.goal_invest' },
  { id: 'debt',      icon: '⛓️', textKey: 'onboarding.goal_debt' },
  { id: 'other',     icon: '🎯', textKey: 'onboarding.goal_other' },
]

type Step = 1 | 2 | 3 | 4

export default function OnboardingPage() {
  const { user } = useUser()
  const t = useT()
  const [step, setStep]             = useState<Step>(1)
  const [mascot, setMascot]         = useState<MascotGender | ''>('')
  const [challenge, setChallenge]   = useState<string>('')
  const [goal, setGoal]             = useState<string>('')
  const [goalAmount, setGoalAmount] = useState<string>('')
  const [loading, setLoading]       = useState(false)
  const [errorMsg, setErrorMsg]     = useState<string | null>(null)

  const firstName = user?.firstName ?? t('onboarding.fallback_name')
  // Mascot name WITH its PT article ("O Voltix" / "A Penny"); EN drops the article.
  const mascotName = mascot === 'penny'
    ? t('onboarding.mascot_penny')
    : t('onboarding.mascot_voltix')

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
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12">

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
        <p className="text-white/30 text-xs text-center">{t('onboarding.step_progress', { step })}</p>
      </div>

      <div className="w-full max-w-md">

          {/* PASSO 1 — Escolha de mascote */}
          {step === 1 && (
            <div key="step1" className="animate-fade-in-up">
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-white mb-2">
                  {t('onboarding.s1_title', { name: firstName })}
                </h1>
                <p className="text-white/60">
                  {t('onboarding.s1_subtitle')}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Voltix */}
                <button
                  onClick={() => handleMascotSelect('voltix')}
                  className={`group flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all ${
                    mascot === 'voltix'
                      ? 'border-green-500 bg-green-500/10'
                      : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8'
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
                    <p className="text-xs text-white/50 mt-0.5">{t('onboarding.voltix_tagline')}</p>
                  </div>
                  {mascot === 'voltix' && (
                    <span className="text-xs text-green-400 font-semibold flex items-center gap-1">
                      <Check className="w-3 h-3" /> {t('onboarding.chosen_m')}
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
                    <p className="text-xs text-white/50 mt-0.5">{t('onboarding.penny_tagline')}</p>
                  </div>
                  {mascot === 'penny' && (
                    <span className="text-xs text-pink-300 font-semibold flex items-center gap-1">
                      <Check className="w-3 h-3" /> {t('onboarding.chosen_f')}
                    </span>
                  )}
                </button>
              </div>

              <p className="text-white/30 text-xs text-center mt-5">
                {t('onboarding.s1_switch_hint')}
              </p>
            </div>
          )}

          {/* PASSO 2 — Desafio */}
          {step === 2 && (
            <div key="step2" className="animate-fade-in-up">
              <div className="text-center mb-8">
                <div className="text-5xl mb-4">👋</div>
                <h1 className="text-2xl font-bold text-white mb-2">
                  {t('onboarding.s2_title')}
                </h1>
                <p className="text-white/60">
                  {t('onboarding.s2_subtitle', { mascot: mascotName })}
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
                    <span className="font-medium">{t(c.textKey)}</span>
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
                  {t('onboarding.s3_title')}
                </h1>
                <p className="text-white/60">
                  {t('onboarding.s3_subtitle', { mascot: mascotName })}
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
                    <span className="text-xs font-medium text-center leading-tight">{t(g.textKey)}</span>
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
                {t('onboarding.continue')}
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
                  {t('onboarding.s4_title')}
                </h1>
                <p className="text-white/60">
                  {t('onboarding.s4_subtitle')}
                </p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
                <label className="block text-sm text-white/60 mb-3 font-medium">
                  <Target className="w-4 h-4 inline mr-2" />
                  {t('onboarding.s4_amount_label')}
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
                <p className="text-xs text-white/30 mt-2">{t('onboarding.s4_amount_hint')}</p>
              </div>

              {/* Preview do que vai acontecer */}
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-3">
                  <PlusCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-400">{t('onboarding.s4_mission_title')}</p>
                    <p className="text-xs text-white/60 mt-0.5">
                      {t('onboarding.s4_mission_desc')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-yellow-400">{t('onboarding.s4_bonus_title')}</p>
                    <p className="text-xs text-white/60 mt-0.5">
                      {t('onboarding.s4_bonus_desc')}
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
                    {t('onboarding.s4_cta')}
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              {errorMsg && (
                <div className="mt-4 p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-red-200 text-sm break-words">
                  <p className="font-semibold mb-1">{t('onboarding.error_title')}</p>
                  <p className="font-mono text-xs leading-relaxed opacity-90">{errorMsg}</p>
                </div>
              )}
            </div>
          )}

      </div>
    </main>
  )
}
