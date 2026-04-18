'use client'

import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { useVoltix } from '@/hooks/useVoltix'
import { MOOD_PALETTE } from './VoltixCreature'
import {
  MascotCreature,
  getMascotEvoName,
  getMascotEvoDescription,
  type MascotGender,
} from './MascotCreature'
import { cn } from '@/lib/utils'
import type { VoltixMood } from '@/types'

/**
 * VoltixWidget — cartão do Pet no dashboard.
 *
 * Variantes (April 2026):
 *   - `hero` (default no dashboard desktop) — horizontal, mascote grande à
 *     esquerda, texto + CTA à direita. Pensado para ser o protagonista do
 *     topo do dashboard, dando destaque ao que é a parte mais diferenciadora
 *     do produto.
 *   - `compact` — vertical, tudo centrado, usado em contextos estreitos
 *     (sidebars, mobile, widgets pequenos).
 *
 * O tamanho do mascote vem do container via `w-full h-full` — o widget
 * decide. Tamanhos aproximados:
 *   hero:    mascote 208×208 (desktop) / 160×160 (mobile)
 *   compact: mascote 96×96
 */

const MOOD_LABELS: Record<VoltixMood, string> = {
  sad:         'Triste',
  neutral:     'Neutro',
  happy:       'Contente',
  excited:     'Animado',
  celebrating: 'Lendário!',
}

const MOOD_MESSAGES: Record<VoltixMood, string> = {
  sad:         'As finanças estão difíceis. Vamos virar isso juntos?',
  neutral:     'Tudo estável. Regista mais movimentos para subir!',
  happy:       'Estás no bom caminho. Continua assim! 📈',
  excited:     'Score a subir! Quase no elite. Vai lá! 💪',
  celebrating: 'LENDÁRIO! Top 1% dos utilizadores. Incrível! 🏆',
}

interface Props {
  userId:  string
  /** `hero` para layout horizontal protagonista; `compact` para vertical. */
  variant?: 'hero' | 'compact'
  /** @deprecated Usa `variant="hero"`. Mantido para compatibilidade. */
  expanded?: boolean
}

export function VoltixWidget({ userId, variant, expanded }: Props) {
  // Fallback: se o caller ainda passa `expanded`, trata como `hero`.
  const mode = variant ?? (expanded ? 'hero' : 'compact')
  const { voltix, loading } = useVoltix(userId)

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

  // ── HERO ──────────────────────────────────────────────────────────────
  if (mode === 'hero') {
    return (
      <Link
        href="/voltix"
        aria-label="Ver detalhes do teu mascote"
        className="group block glass-card p-6 overflow-hidden relative transition-all hover:scale-[1.005]"
        style={{ borderColor: `${palette.body}40` }}
      >
        {/* Faixa de cor da mood no topo */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-1 opacity-70"
          style={{ background: `linear-gradient(90deg, transparent, ${palette.body}, transparent)` }}
        />

        {/* Aura radial de fundo — reforça a presença do mascote como herói
            da secção sem saturar. Posicionada atrás do mascote e
            transbordando suavemente para o lado do texto. */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 w-[420px] h-[420px] -translate-x-1/3 -translate-y-1/4 rounded-full blur-3xl opacity-40"
          style={{ backgroundColor: palette.body }}
        />

        <div className="relative flex flex-col sm:flex-row items-center gap-5 sm:gap-6">
          {/* Mascote — grande, respira, é o foco */}
          <div className="flex-shrink-0 w-40 h-40 sm:w-48 sm:h-48 lg:w-52 lg:h-52">
            <MascotCreature
              gender={gender}
              evo={evo}
              mood={mood}
              className="w-full h-full"
            />
          </div>

          {/* Info + CTA */}
          <div className="flex-1 min-w-0 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap mb-1">
              <h2 className="text-2xl font-black text-white">{name}</h2>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider"
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
              className="text-sm font-semibold mb-2"
              style={{ color: palette.accent }}
            >
              {MOOD_LABELS[mood]} · {evoDesc.split('.')[0]}
            </p>

            <p className="text-sm text-white/70 leading-relaxed max-w-md mx-auto sm:mx-0 mb-3">
              {MOOD_MESSAGES[mood]}
            </p>

            <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
              {streak > 0 && (
                <div className="flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/25 px-3 py-1.5 rounded-full">
                  <span aria-hidden className="text-sm">🔥</span>
                  <span className="text-xs text-orange-400 font-semibold">
                    {streak} dias
                  </span>
                </div>
              )}

              <span
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors group-hover:bg-white/10"
                style={{
                  color:            palette.body,
                  borderColor:     `${palette.body}40`,
                  backgroundColor: `${palette.body}10`,
                }}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Ver detalhes
                <span
                  aria-hidden
                  className="transition-transform group-hover:translate-x-0.5"
                >
                  →
                </span>
              </span>
            </div>
          </div>
        </div>
      </Link>
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

      <MascotCreature
        gender={gender}
        evo={evo}
        mood={mood}
        className="w-24 h-24 mb-2"
      />

      <div className="flex items-center gap-2 mb-1">
        <span className="text-base font-bold text-white">{name}</span>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
          style={{
            color:           palette.body,
            borderColor:    `${palette.body}40`,
            backgroundColor: `${palette.body}15`,
          }}
        >
          EVO {evo}
        </span>
      </div>

      <p className="text-xs font-semibold mb-2" style={{ color: palette.accent }}>
        {MOOD_LABELS[mood]}
      </p>

      <p className="text-xs text-white/55 leading-relaxed px-2">
        {MOOD_MESSAGES[mood]}
      </p>

      {streak > 0 && (
        <div className="mt-3 flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 px-3 py-1.5 rounded-full">
          <span aria-hidden className="text-sm">🔥</span>
          <span className="text-xs text-orange-400 font-medium">
            {streak} dias seguidos
          </span>
        </div>
      )}
    </div>
  )
}
