'use client'

import { useEffect, useRef, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { ArrowLeft, ArrowRight, Check, PlusCircle, Zap } from 'lucide-react'
import { track } from '@/lib/posthog'
import { MascotCreature, type MascotGender } from '@/components/voltix/MascotCreature'
import { saveMascotGenderLocal } from '@/lib/mascotGender'
import { parseAmountLocale } from '@/lib/safeNumber'
import { Spinner } from '@/components/ui/Spinner'
import { useT } from '@/lib/i18n/LocaleProvider'
import type { TranslationKey } from '@/lib/i18n/translations'

/**
 * Onboarding — 6 ecrãs, ~45-60s (julho 2026, redesign Apple-calm).
 *
 * Filosofia: uma pergunta por ecrã, a MASCOTE é a entrevistadora (balão de
 * fala, não emojis gigantes), voltar sempre possível, skip explícito nas
 * perguntas pessoais, cada resposta é 1 toque e auto-avança.
 *
 * O onboarding é a única janela em que o utilizador responde a perguntas
 * de borla — os ecrãs 2/3/6 (motivação, fase de vida, como nos encontrou)
 * alimentam `users.onboarding_profile` (jsonb, agregável) para o dono
 * conhecer quem chega. Skip grava null: "não quis responder" também é dado.
 */

type Option = { id: string; icon: string; textKey: TranslationKey }

// "O que te trouxe cá?" — substitui o antigo "desafio" (era a mesma
// pergunta pela negativa). Ids novos; a rota mantém compat com os antigos.
const MOTIVATIONS: Option[] = [
  { id: 'debts',     icon: '⛓️', textKey: 'onboarding.motivation_debts' },
  { id: 'save_goal', icon: '🎯', textKey: 'onboarding.motivation_save_goal' },
  { id: 'track',     icon: '🔍', textKey: 'onboarding.motivation_track' },
  { id: 'invest',    icon: '📈', textKey: 'onboarding.motivation_invest' },
  { id: 'curious',   icon: '👀', textKey: 'onboarding.motivation_curious' },
]

// Proxy de faixa etária sem perguntar idade — menos invasivo, mais acionável.
const LIFE_STAGES: Option[] = [
  { id: 'student',     icon: '🎓', textKey: 'onboarding.stage_student' },
  { id: 'first_job',   icon: '💼', textKey: 'onboarding.stage_first_job' },
  { id: 'independent', icon: '🔑', textKey: 'onboarding.stage_independent' },
  { id: 'family',      icon: '👨‍👩‍👧', textKey: 'onboarding.stage_family' },
  { id: 'pre_retire',  icon: '🌅', textKey: 'onboarding.stage_pre_retirement' },
]

const GOALS: Option[] = [
  { id: 'emergency', icon: '🛡️', textKey: 'onboarding.goal_emergency' },
  { id: 'travel',    icon: '✈️', textKey: 'onboarding.goal_travel' },
  { id: 'house',     icon: '🏠', textKey: 'onboarding.goal_house' },
  { id: 'car',       icon: '🚗', textKey: 'onboarding.goal_car' },
  { id: 'invest',    icon: '📈', textKey: 'onboarding.goal_invest' },
  { id: 'debt',      icon: '⛓️', textKey: 'onboarding.goal_debt' },
  { id: 'other',     icon: '🎯', textKey: 'onboarding.goal_other' },
]

// Atribuição de aquisição — substitui o PostHog (consent-gated e sem key em
// prod) como fonte primária de "onde vale a pena estar".
const SOURCES: Option[] = [
  { id: 'social', icon: '📱', textKey: 'onboarding.source_social' },
  { id: 'search', icon: '🔎', textKey: 'onboarding.source_search' },
  { id: 'friend', icon: '🗣️', textKey: 'onboarding.source_friend' },
  { id: 'blog',   icon: '📰', textKey: 'onboarding.source_blog' },
  { id: 'other',  icon: '✨', textKey: 'onboarding.source_other' },
]

type Step = 1 | 2 | 3 | 4 | 5 | 6
const TOTAL_STEPS = 6

/** Balão de fala local (a mascote pergunta) — versão estática e mínima do
 *  padrão SpeechBubble do VoltixWidget; aqui não há rotação de frases. */
function AskBubble({ text }: { text: string }) {
  return (
    <div className="relative flex-1 bg-surface-2 border border-white/10 rounded-2xl px-4 py-3 text-[15px] font-semibold leading-snug text-white shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
      <span
        aria-hidden
        className="absolute -left-[5px] top-5 w-2.5 h-2.5 rotate-45 bg-surface-2 border-l border-b border-white/10"
      />
      {text}
    </div>
  )
}

/** Cabeçalho-entrevista dos passos ≥2: o ovo escolhido + a pergunta. */
function MascotAsks({
  gender, question, subtitle,
}: { gender: MascotGender; question: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <div className="flex items-start gap-3">
        <div className="w-16 h-16 flex-shrink-0" aria-hidden>
          <MascotCreature gender={gender} evo={1} mood="happy" className="w-full h-full" />
        </div>
        <AskBubble text={question} />
      </div>
      {subtitle && (
        <p className="text-sm text-white/50 mt-3 ml-[76px]">{subtitle}</p>
      )}
    </div>
  )
}

export default function OnboardingPage() {
  const { user } = useUser()
  const t = useT()
  const [step, setStep]                       = useState<Step>(1)
  const [mascot, setMascot]                   = useState<MascotGender | ''>('')
  const [motivation, setMotivation]           = useState<string>('')
  const [lifeStage, setLifeStage]             = useState<string | null>(null)
  const [goal, setGoal]                       = useState<string>('')
  const [goalAmount, setGoalAmount]           = useState<string>('')
  const [amountError, setAmountError]         = useState<string | null>(null)
  const [discoverySource, setDiscoverySource] = useState<string | null>(null)
  const [loading, setLoading]                 = useState(false)
  const [errorMsg, setErrorMsg]               = useState<string | null>(null)

  const firstName  = user?.firstName ?? t('onboarding.fallback_name')
  const askGender  = (mascot || 'voltix') as MascotGender

  // Timers de auto-avanço limpos no unmount (não deixar setState órfão).
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => { timers.current.forEach(clearTimeout) }, [])
  function advanceAfter(next: Step, ms = 300) {
    timers.current.push(setTimeout(() => setStep(next), ms))
  }

  function handleMascotSelect(g: MascotGender) {
    setMascot(g)
    saveMascotGenderLocal(g)
    track.onboarding_step(1, { mascot: g })
    advanceAfter(2, 350)
  }

  function handleMotivationSelect(id: string) {
    setMotivation(id)
    track.onboarding_step(2, { motivation: id })
    advanceAfter(3)
  }

  function handleStageSelect(id: string) {
    setLifeStage(id)
    track.onboarding_step(3, { life_stage: id })
    advanceAfter(4)
  }

  function handleStageSkip() {
    setLifeStage(null)
    track.onboarding_step(3, { life_stage: 'skipped' })
    setStep(4)
  }

  function handleGoalSelect(id: string) {
    setGoal(id)
    track.onboarding_step(4, { goal: id })
    advanceAfter(5)
  }

  /** Passo 5: validação no handler, nunca botão disabled (regra mobile). */
  function handleAmountContinue() {
    const raw = goalAmount.trim()
    if (raw) {
      const n = parseAmountLocale(raw)
      if (!Number.isFinite(n) || n < 0) {
        setAmountError(t('onboarding.amount_error'))
        return
      }
    }
    setAmountError(null)
    track.onboarding_step(5, { goal_amount: raw })
    setStep(6)
  }

  function handleAmountSkip() {
    setGoalAmount('')
    setAmountError(null)
    track.onboarding_step(5, { goal_amount: 'skipped' })
    setStep(6)
  }

  async function handleComplete() {
    if (loading) return
    setLoading(true)
    setErrorMsg(null)
    try {
      const amountNum = goalAmount.trim() ? parseAmountLocale(goalAmount) : 0

      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mascot_gender:    mascot || 'voltix',
          // `challenge` legado espelha a motivação — mantém compat com tudo
          // o que já lê publicMetadata.challenge no Clerk.
          challenge:        motivation,
          motivation:       motivation || null,
          life_stage:       lifeStage,
          goal,
          goal_amount:      Number.isFinite(amountNum) && amountNum > 0 ? amountNum : 0,
          discovery_source: discoverySource,
        }),
      })

      if (!res.ok) {
        let detail = `HTTP ${res.status}`
        try {
          const body = await res.json()
          detail += ` — ${JSON.stringify(body).slice(0, 400)}`
        } catch {
          try { detail += ` — ${(await res.text()).slice(0, 400)}` } catch {}
        }
        throw new Error(detail)
      }

      track.onboarding_completed(motivation)

      // Reload Clerk session to pick up publicMetadata changes (best-effort)
      await user?.reload()

      // Force full-page navigation — dashboard layout reads Supabase directly
      // so it will see onboarding_completed: true immediately.
      window.location.href = '/dashboard'
    } catch (err) {
      console.warn('[onboarding] complete failed:', err)
      setErrorMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  /** Linha de opção partilhada (lista vertical, 1 toque). */
  function OptionRow({
    opt, selected, onSelect,
  }: { opt: Option; selected: boolean; onSelect: (id: string) => void }) {
    return (
      <button
        onClick={() => onSelect(opt.id)}
        aria-pressed={selected}
        className={`w-full flex items-center gap-4 min-h-[56px] px-4 rounded-2xl border transition-all text-left active:scale-[0.99] ${
          selected
            ? 'border-green-500/60 bg-green-500/10 text-white'
            : 'border-white/10 bg-surface-1 text-white/75 hover:border-white/20 hover:text-white'
        }`}
      >
        <span className="text-2xl" aria-hidden>{opt.icon}</span>
        <span className="font-medium text-sm">{t(opt.textKey)}</span>
        {selected && <Check className="w-4 h-4 text-green-400 ml-auto flex-shrink-0" />}
      </button>
    )
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-10">

      <div className="w-full max-w-md">

        {/* Progresso — barra segmentada subtil (não círculos numerados). */}
        <div className="mb-8">
          <div className="flex gap-1.5 mb-2" aria-hidden>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                  i < step ? 'bg-green-500' : 'bg-white/10'
                }`}
              />
            ))}
          </div>
          <div className="flex items-center justify-between min-h-[28px]">
            <p className="text-xs text-white/50">
              {t('onboarding.step_progress', { step, total: TOTAL_STEPS })}
            </p>
            {step > 1 && (
              <button
                onClick={() => setStep((step - 1) as Step)}
                className="flex items-center gap-1 min-h-[44px] px-2 -mr-2 text-xs font-medium text-white/50 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                {t('onboarding.back')}
              </button>
            )}
          </div>
        </div>

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
              {(['voltix', 'penny'] as MascotGender[]).map(g => {
                const selected = mascot === g
                return (
                  <button
                    key={g}
                    onClick={() => handleMascotSelect(g)}
                    aria-pressed={selected}
                    className={`flex flex-col items-center gap-3 p-5 rounded-2xl border transition-all active:scale-[0.98] ${
                      selected
                        ? 'border-green-500/60 bg-green-500/10'
                        : 'border-white/10 bg-surface-1 hover:border-white/20'
                    }`}
                  >
                    <div className="w-28 h-28 flex items-center justify-center">
                      {/* evo={1} — o dia um é um ovo: o utilizador conhece o
                          companheiro na primeira forma e vê-o evoluir com o
                          score real (narrativa egg-first aprovada). */}
                      <MascotCreature gender={g} evo={1} mood="happy" className="w-full h-full" />
                    </div>
                    <div className="text-center">
                      <p className="text-white font-bold">{g === 'voltix' ? 'Voltix' : 'Penny'}</p>
                      <p className="text-xs text-white/50 mt-0.5">
                        {t(g === 'voltix' ? 'onboarding.voltix_tagline' : 'onboarding.penny_tagline')}
                      </p>
                    </div>
                    {selected && (
                      <span className="text-xs text-green-400 font-semibold flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        {t(g === 'voltix' ? 'onboarding.chosen_m' : 'onboarding.chosen_f')}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            <p className="text-white/40 text-xs text-center mt-5">
              {t('onboarding.s1_switch_hint')}
            </p>
          </div>
        )}

        {/* PASSO 2 — O que te trouxe cá? (motivação) */}
        {step === 2 && (
          <div key="step2" className="animate-fade-in-up">
            <MascotAsks
              gender={askGender}
              question={t('onboarding.s_motivation_title')}
              subtitle={t('onboarding.s_motivation_subtitle')}
            />
            <div className="space-y-3">
              {MOTIVATIONS.map(o => (
                <OptionRow key={o.id} opt={o} selected={motivation === o.id} onSelect={handleMotivationSelect} />
              ))}
            </div>
          </div>
        )}

        {/* PASSO 3 — Fase de vida (opcional, saltável) */}
        {step === 3 && (
          <div key="step3" className="animate-fade-in-up">
            <MascotAsks
              gender={askGender}
              question={t('onboarding.s_stage_title')}
              subtitle={t('onboarding.s_stage_subtitle')}
            />
            <div className="space-y-3">
              {LIFE_STAGES.map(o => (
                <OptionRow key={o.id} opt={o} selected={lifeStage === o.id} onSelect={handleStageSelect} />
              ))}
            </div>
            <button
              onClick={handleStageSkip}
              className="w-full min-h-[44px] mt-4 text-sm font-medium text-white/50 hover:text-white transition-colors"
            >
              {t('onboarding.skip')}
            </button>
          </div>
        )}

        {/* PASSO 4 — Objetivo (auto-avança, sem botão disabled) */}
        {step === 4 && (
          <div key="step4" className="animate-fade-in-up">
            <MascotAsks
              gender={askGender}
              question={t('onboarding.s3_title')}
              subtitle={t('onboarding.s3_subtitle', { mascot: mascot === 'penny' ? t('onboarding.mascot_penny') : t('onboarding.mascot_voltix') })}
            />
            <div className="grid grid-cols-2 gap-3">
              {GOALS.map(g => {
                const selected = goal === g.id
                return (
                  <button
                    key={g.id}
                    onClick={() => handleGoalSelect(g.id)}
                    aria-pressed={selected}
                    className={`flex flex-col items-center gap-2 min-h-[92px] p-4 rounded-2xl border transition-all active:scale-[0.98] ${
                      selected
                        ? 'border-green-500/60 bg-green-500/10 text-white'
                        : 'border-white/10 bg-surface-1 text-white/75 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    <span className="text-3xl" aria-hidden>{g.icon}</span>
                    <span className="text-xs font-medium text-center leading-tight">{t(g.textKey)}</span>
                    {selected && <Check className="w-3.5 h-3.5 text-green-400" />}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* PASSO 5 — Montante (saltável, parse PT/EN) */}
        {step === 5 && (
          <div key="step5" className="animate-fade-in-up">
            <MascotAsks
              gender={askGender}
              question={t('onboarding.s4_amount_label')}
              subtitle={t('onboarding.s4_amount_hint')}
            />

            <div className="bg-surface-1 border border-white/10 rounded-2xl p-6 mb-6">
              <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus-within:border-green-500/50 transition-colors">
                <span className="text-white/40 font-medium" aria-hidden>€</span>
                <input
                  // type="text" + inputMode="decimal": o teclado numérico abre
                  // E aceita vírgula decimal PT — type="number" rejeita "1,5"
                  // em silêncio (Number("1,5") → NaN → objetivo nunca criado).
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9.,]*"
                  placeholder="100"
                  value={goalAmount}
                  onChange={e => { setGoalAmount(e.target.value.replace(/[^\d.,]/g, '')); setAmountError(null) }}
                  aria-label={t('onboarding.s4_amount_label')}
                  className="flex-1 min-w-0 bg-transparent text-white placeholder-white/30 outline-none text-xl font-bold tabular-nums"
                  autoFocus
                />
              </div>
              {amountError && (
                <p className="text-xs text-red-400 mt-2" role="alert">{amountError}</p>
              )}
            </div>

            <button
              onClick={handleAmountContinue}
              className="w-full flex items-center justify-center gap-2 min-h-[52px] bg-green-500 hover:bg-green-400 text-black font-bold rounded-2xl transition-all active:scale-[0.98]"
            >
              {t('onboarding.continue')}
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={handleAmountSkip}
              className="w-full min-h-[44px] mt-2 text-sm font-medium text-white/50 hover:text-white transition-colors"
            >
              {t('onboarding.amount_skip')}
            </button>
          </div>
        )}

        {/* PASSO 6 — Como nos encontraste? + entrada (CTA sempre ativo) */}
        {step === 6 && (
          <div key="step6" className="animate-fade-in-up">
            <MascotAsks
              gender={askGender}
              question={t('onboarding.s_source_title')}
              subtitle={t('onboarding.s_source_subtitle')}
            />
            <div className="space-y-3 mb-6">
              {SOURCES.map(o => (
                <OptionRow
                  key={o.id}
                  opt={o}
                  selected={discoverySource === o.id}
                  onSelect={id => setDiscoverySource(cur => (cur === id ? null : id))}
                />
              ))}
            </div>

            {/* O que acontece a seguir — um cartão calmo, não dois berrantes */}
            <div className="bg-surface-1 border border-white/10 rounded-2xl p-4 mb-6 space-y-3">
              <div className="flex items-center gap-3">
                <PlusCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">{t('onboarding.s4_mission_title')}</p>
                  <p className="text-xs text-white/50 mt-0.5">{t('onboarding.s4_mission_desc')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Zap className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">{t('onboarding.s4_bonus_title')}</p>
                  <p className="text-xs text-white/50 mt-0.5">{t('onboarding.s4_bonus_desc')}</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleComplete}
              className="w-full flex items-center justify-center gap-2 min-h-[52px] bg-green-500 hover:bg-green-400 text-black font-bold rounded-2xl transition-all text-base active:scale-[0.98]"
            >
              {loading ? (
                <Spinner size="md" tone="dark" />
              ) : (
                <>
                  {t('onboarding.s4_cta')}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            {errorMsg && (
              <div className="mt-4 p-4 rounded-2xl border border-red-500/30 bg-red-500/10 text-sm">
                <p className="text-red-200 font-medium">{t('onboarding.error_friendly')}</p>
                <details className="mt-2">
                  <summary className="text-xs text-red-300/70 cursor-pointer">{t('onboarding.error_details')}</summary>
                  <p className="font-mono text-[11px] leading-relaxed text-red-200/80 mt-1 break-words">{errorMsg}</p>
                </details>
              </div>
            )}
          </div>
        )}

      </div>
    </main>
  )
}
