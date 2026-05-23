/**
 * Mascot evolution rules — single source of truth.
 *
 * Evolution is driven by the user's financial score (0-100), not level.
 *
 * Tuning history:
 *   • Original (Feb 2026): 35/55/72/85/95 — first evo too late (2-3
 *     weeks), most users churned before seeing it.
 *   • April 2026: 20/48/68/85/95 — moved evo 2 to week-1, but the
 *     20 → 48 jump (+28) was the steepest in the whole curve. Bad
 *     pacing: easy first win, then immediate cliff that discouraged
 *     committed users.
 *   • May 2026 (current): 18/38/60/80/95. Two principles:
 *     1. First evo even easier (~3 days of light usage). The dopamine
 *        hit needs to land FAST or the user never feels the loop.
 *     2. Increasing absolute jumps (+20, +22, +20, +15) so each
 *        evolution costs noticeably more than the last in real-world
 *        effort. Final +15 looks small but those last 5-20 points of
 *        score are the HARDEST to gain (perfect category control +
 *        high savings rate + daily consistency + multiple goals
 *        completed).
 *
 *   XP bonuses scale with difficulty — first evo small punch, top
 *   evo a massive payoff so the long climb feels paid off.
 *
 * Evolution is strictly monotonic: the server never downgrades a pet,
 * even if the score drops. Hitting the threshold once is forever.
 */
import type { MascotGender } from '@/types'

export type EvoStage = 1 | 2 | 3 | 4 | 5 | 6

/** Minimum score required to unlock each evolution stage. */
export const EVO_SCORE_THRESHOLDS: Record<Exclude<EvoStage, 1>, number> = {
  2: 18,   // was 20 — first dopamine hit within ~3 days of light usage
  3: 38,   // was 48 — smoother +20 jump instead of the old +28 cliff
  4: 60,   // was 68 — +22 (slightly bigger jump, "committed user" tier)
  5: 80,   // was 85 — +20 (sustained discipline tier)
  6: 95,   // unchanged — top tier, last 15 pts are objectively hardest
}

/** One-shot XP bonus granted the first time the user reaches each stage.
 *
 * Curve doubles every two stages so the climb feels increasingly worth
 * it. Final stage at 3000 deliberately disproportionate — a single
 * milestone that bumps even a fully-levelled user noticeably. */
export const EVO_XP_BONUS: Record<Exclude<EvoStage, 1>, number> = {
  2: 300,   // first evo — small celebratory punch
  3: 500,
  4: 900,   // was 800 — wider gap to evo 3 reflects bigger commitment
  5: 1500,  // was 1200
  6: 3000,  // was 2500 — top-tier deserves a real reward
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
