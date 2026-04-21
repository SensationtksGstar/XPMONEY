/**
 * Mascot evolution rules — single source of truth.
 *
 * Evolution is driven by the user's financial score (0-100), not level.
 *
 * Tuning history (April 2026):
 *   The original 2:35 threshold took a realistic fresh user 2-3 weeks of
 *   daily logging to hit, which means the "wow, my pet evolved" moment —
 *   the core retention pull of the gamification loop — landed AFTER most
 *   churn had happened. Lowered to 2:20 so the first evolution is a
 *   week-1 (sometimes day-1) payoff: a user who logs 3-4 transactions,
 *   sets one savings goal with any deposit, and has income > expenses
 *   can reliably trip it. Everything from Evo 3 onwards stays tuned to
 *   reward genuine financial improvement.
 *
 *   Evo 2 XP bonus also bumped from 200 → 350 so the first celebration
 *   has more punch. Late-game bonuses untouched.
 *
 * Evolution is strictly monotonic: the server never downgrades a pet,
 * even if the score drops. Hitting the threshold once is forever.
 */
import type { MascotGender } from '@/types'

export type EvoStage = 1 | 2 | 3 | 4 | 5 | 6

/** Minimum score required to unlock each evolution stage. */
export const EVO_SCORE_THRESHOLDS: Record<Exclude<EvoStage, 1>, number> = {
  2: 20,   // was 35 — "first evolution" is now a week-1 reward
  3: 48,   // was 55 — smoother climb after the first win
  4: 68,   // was 72 — small smoothing, still "committed user" tier
  5: 85,   // unchanged — aspirational
  6: 95,   // unchanged — top 1%
}

/** One-shot XP bonus granted the first time the user reaches each stage. */
export const EVO_XP_BONUS: Record<Exclude<EvoStage, 1>, number> = {
  2: 350,   // was 200 — bigger first-evolution celebration
  3: 500,   // was 400
  4: 800,   // was 700
  5: 1200,  // was 1000
  6: 2500,  // was 2000 — peak reward scaled up with the rest
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
