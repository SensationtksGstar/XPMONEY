import type { SupabaseClient } from '@supabase/supabase-js'
import { awardBadge } from './awardBadge'
import { toNumber }   from './safeNumber'
import { GOLD_SAVER_THRESHOLD } from './gamification'
import { COURSES }    from './courses'

export interface AwardedBadge {
  code:      string
  name:      string
  icon:      string
  xp_reward: number
}

/**
 * Full badge-recheck pass for a user. Idempotent — `awardBadge()` is a
 * no-op if the badge already exists, so it is safe to call this from any
 * mutation endpoint that might unlock something.
 *
 * Why extract this from /api/badges/check into a plain helper:
 *   - The HTTP route stays as a client-refresh button (user opens the
 *     Conquistas page → rechecks everything).
 *   - Mutation endpoints (new debt attack, course complete, goal deposit)
 *     can call this directly, skipping an internal HTTP round-trip and
 *     the auth overhead that would require.
 *
 * Badges checked:
 *   first_transaction  — at least one transaction exists
 *   score_50/75/90     — latest financial_scores row ≥ threshold
 *   goal_reached       — any goal with current_amount ≥ target_amount
 *   debt_killed   (premium) — any debt with status='killed'
 *   academy_master(premium) — distinct `course_completed_*` xp_history rows
 *                             count equals total COURSES.length
 *   gold_saver    (premium) — SUM(goals.current_amount) ≥ GOLD_SAVER_THRESHOLD
 *                             (counts savings still held in the goal, not
 *                             transferred out — it's a "liquid stash"
 *                             measure, not lifetime-deposited).
 */
export async function checkAllBadges(
  db:             SupabaseClient,
  internalUserId: string,
): Promise<AwardedBadge[]> {
  const awarded: AwardedBadge[] = []

  const tryAward = async (condition: boolean, code: string) => {
    if (!condition) return
    const res = await awardBadge(db, internalUserId, code)
    if (res.awarded && res.badge) {
      awarded.push({
        code:      res.badge.code,
        name:      res.badge.name,
        icon:      res.badge.icon,
        xp_reward: res.badge.xp_reward,
      })
    }
  }

  // 1. first_transaction
  const { count: txCount } = await db
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', internalUserId)
  await tryAward((txCount ?? 0) > 0, 'first_transaction')

  // 2. score thresholds
  const { data: latestScore } = await db
    .from('financial_scores')
    .select('score')
    .eq('user_id', internalUserId)
    .order('calculated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const score = latestScore?.score ?? 0
  await tryAward(score >= 50, 'score_50')
  await tryAward(score >= 75, 'score_75')
  await tryAward(score >= 90, 'score_90')

  // 3. goal_reached (any goal completed)
  const { data: goals } = await db
    .from('goals')
    .select('current_amount, target_amount')
    .eq('user_id', internalUserId)
  const normalisedGoals = (goals ?? []).map(g => ({
    current: toNumber(g.current_amount),
    target:  toNumber(g.target_amount),
  }))
  const anyCompleted = normalisedGoals.some(g => g.current >= g.target && g.target > 0)
  await tryAward(anyCompleted, 'goal_reached')

  // 4. gold_saver — total current_amount across all goals
  const totalSaved = normalisedGoals.reduce((s, g) => s + g.current, 0)
  await tryAward(totalSaved >= GOLD_SAVER_THRESHOLD, 'gold_saver')

  // 5. debt_killed — any killed debt
  // The `debts` table may not exist in older installs (Mata-Dívidas is a
  // newer feature). Swallow the "relation does not exist" error quietly
  // so the rest of the badge check keeps running.
  try {
    const { count: killedCount } = await db
      .from('debts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', internalUserId)
      .eq('status', 'killed')
    await tryAward((killedCount ?? 0) > 0, 'debt_killed')
  } catch (err) {
    console.warn('[checkAllBadges] debt check skipped:', err)
  }

  // 6. academy_master — distinct course_completed rows == COURSES.length
  try {
    const { data: xpRows } = await db
      .from('xp_history')
      .select('reason')
      .eq('user_id', internalUserId)
      .like('reason', 'course_completed_%')
    const distinctCourses = new Set((xpRows ?? []).map(r => r.reason))
    await tryAward(distinctCourses.size >= COURSES.length, 'academy_master')
  } catch (err) {
    console.warn('[checkAllBadges] course-master check skipped:', err)
  }

  return awarded
}
