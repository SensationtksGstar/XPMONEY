import { auth }              from '@clerk/nextjs/server'
import { NextResponse }        from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { awardBadge }          from '@/lib/awardBadge'
import { calculateXPProgress } from '@/lib/gamification'

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate()
  )
}

function isYesterday(candidate: Date, today: Date): boolean {
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  return isSameDay(candidate, yesterday)
}

export async function POST() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return NextResponse.json({ already_checked: false, streak: 4, xp_earned: 20, badges_awarded: [] })
  }

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createSupabaseAdmin()

  // 1. Resolve internal user
  const { data: user } = await db
    .from('users')
    .select('id')
    .eq('clerk_id', userId)
    .single()

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // 2. Get voltix_state
  const { data: voltix } = await db
    .from('voltix_states')
    .select('streak_days, last_interaction')
    .eq('user_id', user.id)
    .single()

  const today = new Date()

  // 3. Check if already checked-in today
  if (voltix?.last_interaction) {
    const lastDate = new Date(voltix.last_interaction)
    if (isSameDay(lastDate, today)) {
      return NextResponse.json({
        already_checked: true,
        streak:          voltix.streak_days ?? 0,
      })
    }
  }

  // 4. Determine new streak
  let newStreak = 1
  if (voltix?.last_interaction) {
    const lastDate = new Date(voltix.last_interaction)
    if (isYesterday(lastDate, today)) {
      newStreak = (voltix.streak_days ?? 0) + 1
    }
    // older than yesterday → reset to 1 (already set above)
  }

  // 5. Update voltix_states
  await db
    .from('voltix_states')
    .update({ streak_days: newStreak, last_interaction: today.toISOString() })
    .eq('user_id', user.id)

  // 6. Award XP — best-effort
  const badgesAwarded: { code: string; name: string; icon: string }[] = []
  let xpEarned = 0

  try {
    const { data: xp } = await db
      .from('xp_progress')
      .select('xp_total, level')
      .eq('user_id', user.id)
      .single()

    if (xp) {
      // Base XP for daily login
      const baseXP = 20
      xpEarned    += baseXP

      // Streak milestone bonuses
      let bonusXP    = 0
      let bonusReason: string | null = null

      if (newStreak === 30) {
        bonusXP    = 500
        bonusReason = 'streak_30_days'
      } else if (newStreak === 7) {
        bonusXP    = 100
        bonusReason = 'streak_7_days'
      }

      const totalXPGain = baseXP + bonusXP
      xpEarned         += bonusXP

      const newTotal = (xp.xp_total ?? 0) + totalXPGain
      const progress = calculateXPProgress(newTotal)

      await db.from('xp_progress').update({
        xp_total:         newTotal,
        level:            progress.level,
        last_activity_at: today.toISOString(),
        updated_at:       today.toISOString(),
      }).eq('user_id', user.id)

      // Log base XP
      await db.from('xp_history').insert({
        user_id:   user.id,
        amount:    baseXP,
        reason:    'daily_login',
        earned_at: today.toISOString(),
      })

      // Log bonus XP separately if applicable
      if (bonusXP > 0 && bonusReason) {
        await db.from('xp_history').insert({
          user_id:   user.id,
          amount:    bonusXP,
          reason:    bonusReason,
          earned_at: today.toISOString(),
        })
      }
    }
  } catch { /* XP award is best-effort */ }

  // 7. Check and award streak badges
  try {
    if (newStreak >= 30) {
      const result = await awardBadge(db, user.id, 'month_streak')
      if (result.awarded && result.badge) {
        badgesAwarded.push({ code: result.badge.code, name: result.badge.name, icon: result.badge.icon })
      }
    }
    if (newStreak >= 7) {
      const result = await awardBadge(db, user.id, 'week_streak')
      if (result.awarded && result.badge) {
        badgesAwarded.push({ code: result.badge.code, name: result.badge.name, icon: result.badge.icon })
      }
    }
  } catch { /* badge award is best-effort */ }

  return NextResponse.json({
    already_checked: false,
    streak:          newStreak,
    xp_earned:       xpEarned,
    badges_awarded:  badgesAwarded,
  })
}
