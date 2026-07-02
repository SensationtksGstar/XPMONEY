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

  // All five condition reads depend only on the user id — batch them.
  // This helper runs inline on mutation endpoints that return `newBadges`
  // to the client (course complete, goal deposit, debt attack), so its
  // latency is user-visible: serial it was ~7-10 round-trips, batched it
  // is 2. The debts/xp_history queries may hit tables that don't exist in
  // older installs — supabase-js reports that via `error`, not a throw, so
  // the batch never rejects; those conditions just resolve to "no".
  const [txRes, scoreRes, goalsRes, debtsRes, coursesRes] = await Promise.all([
    db
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', internalUserId),
    db
      .from('financial_scores')
      .select('score')
      .eq('user_id', internalUserId)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from('goals')
      .select('current_amount, target_amount')
      .eq('user_id', internalUserId),
    db
      .from('debts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', internalUserId)
      .eq('status', 'killed'),
    db
      .from('xp_history')
      .select('reason')
      .eq('user_id', internalUserId)
      .like('reason', 'course_completed_%'),
  ])

  if (debtsRes.error)   console.warn('[checkAllBadges] debt check skipped:', debtsRes.error.message)
  if (coursesRes.error) console.warn('[checkAllBadges] course-master check skipped:', coursesRes.error.message)

  const score = scoreRes.data?.score ?? 0

  const normalisedGoals = (goalsRes.data ?? []).map(g => ({
    current: toNumber(g.current_amount),
    target:  toNumber(g.target_amount),
  }))
  const anyCompleted = normalisedGoals.some(g => g.current >= g.target && g.target > 0)
  const totalSaved   = normalisedGoals.reduce((s, g) => s + g.current, 0)

  const distinctCourses = new Set((coursesRes.data ?? []).map(r => r.reason))

  // Each award is idempotent and targets a distinct badge code — safe to
  // run concurrently (pushes into `awarded` are single-threaded in JS).
  await Promise.all([
    tryAward((txRes.count ?? 0) > 0,                       'first_transaction'),
    tryAward(score >= 50,                                  'score_50'),
    tryAward(score >= 75,                                  'score_75'),
    tryAward(score >= 90,                                  'score_90'),
    tryAward(anyCompleted,                                 'goal_reached'),
    tryAward(totalSaved >= GOLD_SAVER_THRESHOLD,           'gold_saver'),
    tryAward(!debtsRes.error && (debtsRes.count ?? 0) > 0, 'debt_killed'),
    tryAward(!coursesRes.error && distinctCourses.size >= COURSES.length, 'academy_master'),
  ])

  return awarded
}
