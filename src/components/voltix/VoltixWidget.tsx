'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Sparkles, MessageCircle } from 'lucide-react'
import { useVoltix } from '@/hooks/useVoltix'
import { useFinancialScore } from '@/hooks/useFinancialScore'
import { useSpendForecast } from '@/hooks/useSpendForecast'
import { approxEur } from '@/lib/spendForecast'
import { MOOD_PALETTE } from './mascotMeta'
import {
  MascotCreature,
  getMascotEvoName,
  getMascotEvoDescription,
  type MascotGender,
} from './MascotCreature'
import { cn } from '@/lib/utils'
import { useLocale } from '@/lib/i18n/LocaleProvider'
import type { TranslationKey } from '@/lib/i18n/translations'
import { mascotLine } from '@/lib/mascotSpeak'
import type { VoltixMood } from '@/types'

/**
 * VoltixWidget — cartão do Pet no dashboard.
 *
 * Julho 2026 (passo Tamagotchi): o mascote agora FALA no dashboard — balão
 * de fala com linhas contextuais (choco do ovo, streak, humor) vindas do
 * cérebro partilhado `mascotSpeak.ts`, e tocar no mascote muda a frase
 * (a mesma interação que o /voltix já tinha, agora onde o utilizador vive).
 * O cartão deixou de ser um <Link> gigante: o toque pertence ao bicho, a
 * navegação pertence ao CTA "Ver detalhes".
 *
 * Variantes:
 *   - `hero` (default no dashboard desktop) — horizontal, mascote grande à
 *     esquerda, balão + texto + CTA à direita.
 *   - `compact` — vertical, tudo centrado, usado em contextos estreitos.
 *
 * O score vem de useFinancialScore() — a queryKey ['score'] já está em cache
 * no dashboard, portanto isto não custa nenhum request extra.
 */

const MOOD_LABEL_KEYS: Record<VoltixMood, TranslationKey> = {
  sad:         'voltix.mood.sad',
  neutral:     'voltix.mood.neutral',
  happy:       'voltix.mood.happy',
  excited:     'voltix.mood.excited',
  celebrating: 'voltix.mood.celebrating',
}

interface Props {
  userId:  string
  /** `hero` para layout horizontal protagonista; `compact` para vertical. */
  variant?: 'hero' | 'compact'
  /** @deprecated Usa `variant="hero"`. Mantido para compatibilidade. */
  expanded?: boolean
}

/** Balão de fala do mascote — pop suave a cada frase nova (remount por key). */
function SpeechBubble({
  text, tail, className,
}: { text: string; tail: 'left' | 'top'; className?: string }) {
  return (
    <div
      className={cn(
        'relative bg-[#151a22]/95 border border-white/10 rounded-2xl px-3.5 py-2.5',
        'text-[13px] leading-snug text-white/85 shadow-[0_1px_2px_rgba(0,0,0,0.4)]',
        'animate-bubble-pop',
        className,
      )}
      aria-live="polite"
    >
      {/* Cauda — losango com as mesmas cores para fundir com a borda. */}
      {tail === 'left' ? (
        <span
          aria-hidden
          className="hidden sm:block absolute -left-[5px] top-5 w-2.5 h-2.5 rotate-45 bg-[#151a22] border-l border-b border-white/10"
        />
      ) : null}
      <span
        aria-hidden
        className={cn(
          'absolute -top-[5px] left-7 w-2.5 h-2.5 rotate-45 bg-[#151a22] border-l border-t border-white/10',
          tail === 'left' && 'sm:hidden',
        )}
      />
      {text}
    </div>
  )
}

export function VoltixWidget({ userId, variant, expanded }: Props) {
  // Fallback: se o caller ainda passa `expanded`, trata como `hero`.
  const mode = variant ?? (expanded ? 'hero' : 'compact')
  const { voltix, loading } = useVoltix(userId)
  const { score } = useFinancialScore(userId)
  const { forecast } = useSpendForecast()   // premium-only fetch (enabled: isPaid)
  const { t, locale } = useLocale()

  const [tapCount, setTapCount] = useState(0)
  const [tapped, setTapped]     = useState(false)

  // Forecast delta for the pet's voice — meaningful (≥€10) deltas only.
  // Each line matches its OWN reference so the copy is never a lie:
  //   over  → vs the configured BUDGET (copy says "orçamento")
  //   under → vs the user's own BASELINE spend (copy says "costume")
  // (Using budget income for "under" told a €1.8k-forecast user with a
  // €1.5k habit they were "€200 below their usual" — factually wrong.)
  const forecastDelta = useMemo(() => {
    if (!forecast || forecast.status !== 'ok') return null
    const F = forecast.total.forecast
    if (forecast.budget && F - forecast.budget.monthlyIncome >= 10) {
      return { label: approxEur(F - forecast.budget.monthlyIncome, locale), over: true }
    }
    const base = forecast.total.baseline
    if (base != null && base - F >= 10) {
      return { label: approxEur(base - F, locale), over: false }
    }
    return null
  }, [forecast, locale])

  if (loading) {
    return (
      <div className={cn(
        'glass-card animate-pulse',
        mode === 'hero'
          ? 'p-6 flex flex-col sm:flex-row items-center gap-6 min-h-[220px]'
          : 'p-5 flex flex-col items-center gap-4',
      )}>
        <div className={cn(
          'rounded-full bg-white/10 flex-shrink-0',
          mode === 'hero' ? 'w-40 h-40 sm:w-48 sm:h-48' : 'w-20 h-20',
        )} />
        <div className={cn('flex-1 space-y-3', mode === 'hero' ? 'w-full' : 'w-3/4')}>
          <div className="h-5 bg-white/10 rounded w-1/2" />
          <div className="h-3 bg-white/10 rounded w-3/4" />
          <div className="h-3 bg-white/10 rounded w-2/3" />
        </div>
      </div>
    )
  }

  const mood    = (voltix?.mood ?? 'neutral') as VoltixMood
  const evo     = voltix?.evolution_level ?? 1
  const streak  = voltix?.streak_days ?? 0
  const gender  = (voltix?.mascot_gender ?? 'voltix') as MascotGender
  const palette = MOOD_PALETTE[mood]
  const name    = getMascotEvoName(gender, evo)
  const evoDesc = getMascotEvoDescription(gender, evo)

  const { line } = mascotLine({
    mood, evo, streak,
    score: score?.score ?? null,
    tapCount,
    forecastDelta,
  })
  const speech = t(line.key, line.params)

  function handleTap() {
    setTapped(true)
    setTapCount(c => c + 1)
    setTimeout(() => setTapped(false), 260)
  }

  function onTapKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleTap()
    }
  }

  // ── HERO ──────────────────────────────────────────────────────────────
  if (mode === 'hero') {
    return (
      <div
        className="glass-card p-6 overflow-hidden relative"
        style={{ borderColor: `${palette.body}40` }}
      >
        {/* Faixa de cor da mood no topo */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-1 opacity-70"
          style={{ background: `linear-gradient(90deg, transparent, ${palette.body}, transparent)` }}
        />

        {/* Aura radial de fundo — presença do mascote sem saturar. */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 w-[420px] h-[420px] -translate-x-1/3 -translate-y-1/4 rounded-full blur-3xl opacity-40"
          style={{ backgroundColor: palette.body }}
        />

        <div className="relative flex flex-col sm:flex-row items-center gap-5 sm:gap-6">
          {/* Mascote — grande, vivo, TOCÁVEL (muda a frase, como um Tamagotchi) */}
          <button
            type="button"
            onClick={handleTap}
            onKeyDown={onTapKey}
            aria-label={t('voltix.tap_hint')}
            className={cn(
              'flex-shrink-0 w-40 h-40 sm:w-48 sm:h-48 lg:w-52 lg:h-52 cursor-pointer',
              'transition-transform duration-200 active:scale-95 focus-visible:outline-none',
              'focus-visible:ring-2 focus-visible:ring-white/30 rounded-full',
              tapped && 'scale-95',
            )}
          >
            <MascotCreature
              gender={gender}
              evo={evo}
              mood={mood}
              className="w-full h-full"
            />
          </button>

          {/* Balão + Info + CTA */}
          <div className="flex-1 min-w-0 text-center sm:text-left">
            <SpeechBubble
              key={`${line.key}-${tapCount}`}
              text={speech}
              tail="left"
              className="mb-3 mx-auto sm:mx-0 max-w-md"
            />
            <p className="flex items-center justify-center sm:justify-start gap-1 text-[11px] text-white/25 mb-3">
              <MessageCircle className="w-3 h-3" aria-hidden /> {t('voltix.tap_hint')}
            </p>

            <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap mb-1">
              <h2 className="text-2xl font-bold text-white">{name}</h2>
              <span
                className="text-[11px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider"
                style={{
                  color:           palette.body,
                  borderColor:    `${palette.body}55`,
                  backgroundColor: `${palette.body}15`,
                }}
              >
                EVO {evo}
              </span>
            </div>

            <p
              className="text-sm font-semibold mb-3"
              style={{ color: palette.accent }}
            >
              {t(MOOD_LABEL_KEYS[mood])} · {evoDesc.split('.')[0]}
            </p>

            <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
              {streak > 0 && (
                <div className="flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/25 px-3 py-1.5 rounded-full">
                  <span aria-hidden className="text-sm">🔥</span>
                  <span className="text-xs text-orange-400 font-semibold">
                    {t('mascot.streak_chip', { days: streak })}
                  </span>
                </div>
              )}

              <Link
                href="/voltix"
                className="group inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors hover:bg-white/10"
                style={{
                  color:            palette.body,
                  borderColor:     `${palette.body}40`,
                  backgroundColor: `${palette.body}10`,
                }}
              >
                <Sparkles className="w-3.5 h-3.5" />
                {t('mascot.see_details')}
                <span
                  aria-hidden
                  className="transition-transform group-hover:translate-x-0.5"
                >
                  →
                </span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── COMPACT ───────────────────────────────────────────────────────────
  return (
    <div
      className="glass-card p-5 flex flex-col items-center text-center overflow-hidden relative"
      style={{ borderColor: `${palette.body}28` }}
    >
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-1 opacity-60"
        style={{ background: `linear-gradient(90deg, transparent, ${palette.body}, transparent)` }}
      />

      <button
        type="button"
        onClick={handleTap}
        onKeyDown={onTapKey}
        aria-label={t('voltix.tap_hint')}
        className={cn(
          'w-24 h-24 mb-3 cursor-pointer transition-transform duration-200 active:scale-95',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 rounded-full',
          tapped && 'scale-95',
        )}
      >
        <MascotCreature
          gender={gender}
          evo={evo}
          mood={mood}
          className="w-full h-full"
        />
      </button>

      <SpeechBubble
        key={`${line.key}-${tapCount}`}
        text={speech}
        tail="top"
        className="mb-3 max-w-[240px]"
      />

      <div className="flex items-center gap-2 mb-1">
        <span className="text-base font-bold text-white">{name}</span>
        <span
          className="text-[11px] font-bold px-2 py-0.5 rounded-full border"
          style={{
            color:           palette.body,
            borderColor:    `${palette.body}40`,
            backgroundColor: `${palette.body}15`,
          }}
        >
          EVO {evo}
        </span>
      </div>

      <p className="text-xs font-semibold" style={{ color: palette.accent }}>
        {t(MOOD_LABEL_KEYS[mood])}
      </p>

      {streak > 0 && (
        <div className="mt-3 flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 px-3 py-1.5 rounded-full">
          <span aria-hidden className="text-sm">🔥</span>
          <span className="text-xs text-orange-400 font-medium">
            {t('mascot.streak_chip', { days: streak })}
          </span>
        </div>
      )}
    </div>
  )
}
