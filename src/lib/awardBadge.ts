import { awardXP } from '@/lib/awardXP'
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

    // 4. XP do badge pelo awardXP (incremento atómico via RPC award_xp +
    //    ledger xp_history). Era um read-modify-write inline que corria no
    //    mesmo Promise.allSettled que o awardXP da transação e apagava o
    //    incremento um do outro.
    if (badge.xp_reward > 0) {
      await awardXP(db, userId, badge.xp_reward, `badge_${badge.code}`)
    }

    return { awarded: true, badge }
  } catch (err) {
    // Never throw — return a safe fallback
    console.warn('[awardBadge] failed:', err)
    return { awarded: false, badge: null }
  }
}
