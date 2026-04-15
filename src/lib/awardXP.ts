import type { SupabaseClient } from '@supabase/supabase-js'
import { calculateXPProgress, getLevelFromXP } from '@/lib/gamification'

export interface AwardXPResult {
  xp_gained:    number
  xp_total:     number
  level:        number
  leveled_up:   boolean
  previous_level: number
}

/**
 * Centralised XP-award helper.
 *
 * - Reads current xp_progress row, adds `amount`, recalculates level.
 * - Updates xp_progress and inserts an xp_history row atomically (parallel).
 * - Never throws — returns `null` on any error (XP is best-effort by design).
 * - Detects level-ups and returns the previous level so callers can trigger
 *   celebration modals.
 *
 * @param db        Supabase admin client (server-side only)
 * @param userId    Internal Supabase user id (NOT Clerk id)
 * @param amount    XP to add (must be positive — negative values are ignored)
 * @param reason    Short tag for xp_history (e.g. `transaction_registered`)
 * @returns         AwardXPResult on success, `null` if user has no xp_progress row
 */
export async function awardXP(
  db:     SupabaseClient,
  userId: string,
  amount: number,
  reason: string,
): Promise<AwardXPResult | null> {
  if (!userId || amount <= 0 || !Number.isFinite(amount)) return null

  try {
    const { data: xp } = await db
      .from('xp_progress')
      .select('xp_total, level')
      .eq('user_id', userId)
      .single()

    if (!xp) return null

    const previousLevel = xp.level ?? getLevelFromXP(xp.xp_total ?? 0).number
    const newTotal      = (xp.xp_total ?? 0) + amount
    const progress      = calculateXPProgress(newTotal)
    const leveledUp     = progress.level > previousLevel
    const now           = new Date().toISOString()

    // Run both writes in parallel — xp_history failure must not block xp_progress
    const [updateRes, historyRes] = await Promise.allSettled([
      db.from('xp_progress').update({
        xp_total:         newTotal,
        level:            progress.level,
        last_activity_at: now,
        updated_at:       now,
      }).eq('user_id', userId),
      db.from('xp_history').insert({
        user_id:   userId,
        amount,
        reason,
        earned_at: now,
      }),
    ])

    // Log silent failures so they surface in server logs but don't break the flow
    if (updateRes.status === 'rejected') {
      console.warn('[awardXP] xp_progress update failed:', updateRes.reason)
    }
    if (historyRes.status === 'rejected') {
      console.warn('[awardXP] xp_history insert failed:', historyRes.reason)
    }

    return {
      xp_gained:      amount,
      xp_total:       newTotal,
      level:          progress.level,
      previous_level: previousLevel,
      leveled_up:     leveledUp,
    }
  } catch (err) {
    console.warn('[awardXP] unexpected error:', err)
    return null
  }
}
