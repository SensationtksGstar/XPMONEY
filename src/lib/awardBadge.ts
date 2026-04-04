import { calculateXPProgress } from '@/lib/gamification'
import type { SupabaseClient } from '@supabase/supabase-js'

interface AwardBadgeResult {
  awarded: boolean
  badge: {
    id:         string
    code:       string
    name:       string
    icon:       string
    xp_reward:  number
    rarity:     string
  } | null
}

/**
 * Idempotent badge award helper.
 * Checks if the user already has the badge; if not, inserts it, adds XP, and logs to xp_history.
 * Never throws — always returns a result.
 */
export async function awardBadge(
  db:        SupabaseClient,
  userId:    string,
  badgeCode: string,
): Promise<AwardBadgeResult> {
  try {
    // 1. Check if user already has this badge
    const { data: existing } = await db
      .from('user_badges')
      .select('id, badge:badges(id, code, name, icon, xp_reward, rarity)')
      .eq('user_id', userId)
      .eq('badges.code', badgeCode)
      .not('badge', 'is', null)
      .maybeSingle()

    if (existing) {
      // Badge already earned — idempotent, return false
      const badge = Array.isArray(existing.badge) ? existing.badge[0] : existing.badge
      return { awarded: false, badge: badge ?? null }
    }

    // 2. Find the badge by code
    const { data: badge, error: badgeError } = await db
      .from('badges')
      .select('id, code, name, icon, xp_reward, rarity')
      .eq('code', badgeCode)
      .single()

    if (badgeError || !badge) {
      return { awarded: false, badge: null }
    }

    // 3. Insert into user_badges
    const { error: insertError } = await db
      .from('user_badges')
      .insert({ user_id: userId, badge_id: badge.id, earned_at: new Date().toISOString() })

    if (insertError) {
      // Could be a duplicate (race condition) — treat as already awarded
      return { awarded: false, badge }
    }

    // 4. Increment XP in xp_progress
    const { data: xp } = await db
      .from('xp_progress')
      .select('xp_total, level')
      .eq('user_id', userId)
      .single()

    if (xp && badge.xp_reward > 0) {
      const newTotal = (xp.xp_total ?? 0) + badge.xp_reward
      const progress = calculateXPProgress(newTotal)
      await db.from('xp_progress').update({
        xp_total:         newTotal,
        level:            progress.level,
        last_activity_at: new Date().toISOString(),
        updated_at:       new Date().toISOString(),
      }).eq('user_id', userId)

      // 5. Log to xp_history
      await db.from('xp_history').insert({
        user_id:   userId,
        amount:    badge.xp_reward,
        reason:    `badge_${badge.code}`,
        earned_at: new Date().toISOString(),
      })
    }

    return { awarded: true, badge }
  } catch {
    // Never throw — return a safe fallback
    return { awarded: false, badge: null }
  }
}
