import type { SupabaseClient } from '@supabase/supabase-js'
import { toNumber } from '@/lib/safeNumber'
import { completeMission } from '@/lib/missions/complete'

/**
 * Mission progress updater.
 *
 * Missions live in the `missions` table with a numeric `current_value` and a
 * `target_value`. This helper advances the `current_value` of any active
 * mission whose `type` matches `triggerType`.
 *
 * When the target is reached the mission STAYS 'active' with
 * `current_value = target` (clamped so the bar shows 100 % cleanly) and its id
 * is returned in `readyIds`. It does NOT flip to 'completed' here any more —
 * that was the October-2026 bug: the auto-complete set status='completed',
 * the /complete endpoint then refused it ('Already completed') and the XP was
 * never paid. The CALLER now pays via `completeReadyMissions()` (→
 * `completeMission`, idempotent claim + awardXP), AFTER its own parallel
 * batch, so two awardXP never race on the same xp_progress row.
 *
 * Mission `type` catalog (from `MISSION_TEMPLATES` in `src/lib/gamification.ts`):
 *   - `register_transactions`  — increment by 1 per transaction
 *   - `keep_daily_streak`      — set to streak_days
 *   - `improve_score`          — set to max(current, delta) when score rises
 *   - `categorize_all`         — set to 1 when 0 uncategorized tx remain
 *   - `reach_savings_goal`     — set to savings_rate_pct
 *   - `reduce_category_spend`  — not automated (compares months; skipped)
 *
 * All writes are best-effort — failures are logged but never thrown. Missions
 * are a gamification layer; they must never block the primary action.
 */

export type MissionTrigger =
  | { type: 'register_transactions' }               // +1 per call
  | { type: 'keep_daily_streak'; streak: number }   // set to current streak
  | { type: 'improve_score';     score: number }    // set to delta vs baseline
  | { type: 'categorize_all';    uncategorized: number } // set 1 when 0
  | { type: 'reach_savings_goal'; savingsRate: number }  // set to rate %

export async function updateMissionProgress(
  db:      SupabaseClient,
  userId:  string,
  trigger: MissionTrigger,
): Promise<string[]> {
  if (!userId) return []
  try {
    const { data: missions, error } = await db
      .from('missions')
      .select('id, current_value, target_value, status, type')
      .eq('user_id', userId)
      .eq('type',    trigger.type)
      .eq('status',  'active')

    if (error) {
      console.warn('[missions] fetch failed:', error.message)
      return []
    }
    if (!missions || missions.length === 0) return []

    // Run all updates in parallel. Several active missions can share a `type`
    // (e.g. two `keep_daily_streak` missions with targets 7 and 30).
    const results = await Promise.allSettled(
      missions.map(async (m): Promise<string | null> => {
        const current = toNumber(m.current_value, 0)
        const target  = toNumber(m.target_value,  1)

        // Already at target (ready, awaiting payout — e.g. a previous payout
        // attempt failed): no write, but hand it back so the caller retries
        // the idempotent payout.
        if (current >= target) return m.id as string

        let next = current
        switch (trigger.type) {
          case 'register_transactions':
            next = current + 1
            break
          case 'keep_daily_streak':
            next = Math.max(current, trigger.streak)
            break
          case 'improve_score':
            next = Math.max(current, trigger.score)
            break
          case 'categorize_all':
            next = trigger.uncategorized === 0 ? 1 : 0
            break
          case 'reach_savings_goal':
            next = Math.max(current, Math.round(trigger.savingsRate))
            break
        }

        // No change — skip the write entirely
        if (next === current) return null

        const completed = next >= target
        // Clamp so the bar shows 100 % cleanly and a ready mission stops
        // growing. Status stays 'active' — payment is the caller's job.
        const patch = { current_value: completed ? target : next }

        const { error: updateErr } = await db
          .from('missions')
          .update(patch)
          .eq('id', m.id)
          .eq('user_id', userId)
          .eq('status', 'active')

        if (updateErr) {
          console.warn(`[missions] update failed for ${m.type}/${m.id}:`, updateErr.message)
          return null
        }
        return completed ? (m.id as string) : null
      }),
    )

    const readyIds: string[] = []
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) readyIds.push(r.value)
      else if (r.status === 'rejected') console.warn('[missions] progress tick rejected:', r.reason)
    }
    return readyIds
  } catch (err) {
    console.warn('[missions] updateMissionProgress error:', err)
    return []
  }
}

export interface PaidMission {
  id:           string
  type:         string
  target_value: number
  xp:           number
}

/**
 * Pays every ready mission in SERIES (for…of + await) — awardXP is a
 * read-modify-write on xp_progress, so running payouts in parallel would let
 * one overwrite the other. Returns only the missions actually paid in this
 * call (so the client can celebrate them).
 */
export async function completeReadyMissions(
  db:     SupabaseClient,
  userId: string,
  ids:    string[],
): Promise<PaidMission[]> {
  const paid: PaidMission[] = []
  for (const id of Array.from(new Set(ids))) {
    try {
      const r = await completeMission(db, userId, id)
      if (r.status === 'paid' && r.mission) {
        paid.push({ id: r.mission.id, type: r.mission.type, target_value: r.mission.target_value, xp: r.xp })
      }
    } catch (err) {
      console.warn(`[missions] payout failed for ${id}:`, err)
    }
  }
  return paid
}
