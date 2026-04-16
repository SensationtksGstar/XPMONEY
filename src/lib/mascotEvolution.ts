/**
 * Mascot evolution rules — single source of truth.
 *
 * Evolution is driven by the user's financial score (0-100), not level.
 * Thresholds are intentionally spaced so progression stays meaningful:
 * accessible early gains (Evo 2 at 35 pts — "out of red"), hard elite
 * tier (Evo 6 at 95 pts — top 1% of users).
 *
 * Evolution is strictly monotonic: the server never downgrades a pet, even
 * if the score drops. Hitting the threshold once is forever.
 */
import type { MascotGender } from '@/types'

export type EvoStage = 1 | 2 | 3 | 4 | 5 | 6

/** Minimum score required to unlock each evolution stage. */
export const EVO_SCORE_THRESHOLDS: Record<Exclude<EvoStage, 1>, number> = {
  2: 35,
  3: 55,
  4: 72,
  5: 85,
  6: 95,
}

/** One-shot XP bonus granted the first time the user reaches each stage. */
export const EVO_XP_BONUS: Record<Exclude<EvoStage, 1>, number> = {
  2: 200,
  3: 400,
  4: 700,
  5: 1000,
  6: 2000,
}

/** Maximum evo the score `s` unlocks (independent of current stored stage). */
export function evoFromScore(score: number): EvoStage {
  const s = Number.isFinite(score) ? score : 0
  if (s >= EVO_SCORE_THRESHOLDS[6]) return 6
  if (s >= EVO_SCORE_THRESHOLDS[5]) return 5
  if (s >= EVO_SCORE_THRESHOLDS[4]) return 4
  if (s >= EVO_SCORE_THRESHOLDS[3]) return 3
  if (s >= EVO_SCORE_THRESHOLDS[2]) return 2
  return 1
}

/** Human-readable requirement string used by the Evolution line UI. */
export function evoRequirementLabel(stage: EvoStage): string {
  if (stage === 1) return 'Estado inicial'
  return `Score ≥ ${EVO_SCORE_THRESHOLDS[stage]}`
}

/** Cumulative XP bonus awarded when stepping from `from` → `to` (inclusive of each stage gained). */
export function evoBonusBetween(from: EvoStage, to: EvoStage): number {
  if (to <= from) return 0
  let total = 0
  for (let s = from + 1; s <= to; s++) {
    total += EVO_XP_BONUS[s as Exclude<EvoStage, 1>] ?? 0
  }
  return total
}

/**
 * Progress toward the next evolution — useful for the "X pontos para próxima forma"
 * UI hint. Returns null once the user is fully evolved.
 */
export function nextEvoProgress(
  score: number,
  currentEvo: EvoStage,
): { nextEvo: EvoStage; needed: number; remaining: number } | null {
  if (currentEvo >= 6) return null
  const nextEvo = (currentEvo + 1) as Exclude<EvoStage, 1>
  const needed = EVO_SCORE_THRESHOLDS[nextEvo]
  return { nextEvo, needed, remaining: Math.max(0, needed - score) }
}

/** Display names keyed by gender + stage, for cinematic / toast copy. */
export const EVO_DISPLAY_NAMES: Record<MascotGender, Record<EvoStage, string>> = {
  voltix: {
    1: 'Voltini',
    2: 'Voltito',
    3: 'Voltix',
    4: 'Voltaryon',
    5: 'Magnavoltix',
    6: 'Imperivoltix',
  },
  penny: {
    1: 'Pennini',
    2: 'Pennito',
    3: 'Penny',
    4: 'Pennyara',
    5: 'Pennael',
    6: 'Seraphenny',
  },
}
