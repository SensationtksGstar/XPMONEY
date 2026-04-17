import type { SupabaseClient } from '@supabase/supabase-js'
import { toNumber } from '@/lib/safeNumber'

/**
 * Mission progress updater.
 *
 * Missions live in the `missions` table with a numeric `current_value` and a
 * `target_value`. They were previously never incremented — users saw 0 % forever
 * and the feature looked broken. This helper advances the `current_value` of any
 * active mission whose `type` matches `triggerType`, and auto-completes it when
 * the target is reached. XP for completion is NOT awarded here — the existing
 * `/api/missions/[id]/complete` route handles that claim flow, so the user still
 * gets the satisfying "claim" interaction. This helper's job is only to keep the
 * progress bar honest.
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
): Promise<void> {
  if (!userId) return
  try {
    const { data: missions, error } = await db
      .from('missions')
      .select('id, current_value, target_value, status, type')
      .eq('user_id', userId)
      .eq('type',    trigger.type)
      .eq('status',  'active')

    if (error) {
      console.warn('[missions] fetch failed:', error.message)
      return
    }
    if (!missions || missions.length === 0) return

    const now = new Date().toISOString()

    // Run all updates in parallel. Several active missions can share a `type`
    // (e.g. two `keep_daily_streak` missions with targets 7 and 30).
    await Promise.allSettled(
      missions.map(async (m) => {
        const current = toNumber(m.current_value, 0)
        const target  = toNumber(m.target_value,  1)

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
        if (next === current) return

        const completed = next >= target
        const patch: Record<string, unknown> = { current_value: next }
        if (completed) {
          // Mark the mission ready-to-claim. The dedicated complete endpoint
          // awards XP when the user clicks through — we don't pay out here to
          // preserve the "tap to collect" satisfaction loop.
          patch.status       = 'completed'
          patch.completed_at = now
          patch.current_value = target // clamp so the bar shows 100 % cleanly
        }

        const { error: updateErr } = await db
          .from('missions')
          .update(patch)
          .eq('id', m.id)

        if (updateErr) {
          console.warn(`[missions] update failed for ${m.type}/${m.id}:`, updateErr.message)
        }
      }),
    )
  } catch (err) {
    console.warn('[missions] updateMissionProgress error:', err)
  }
}
