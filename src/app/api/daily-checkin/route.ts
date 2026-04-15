import { auth }              from '@clerk/nextjs/server'
import { NextResponse }        from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { resolveUser }         from '@/lib/resolveUser'
import { awardBadge }          from '@/lib/awardBadge'
import { calculateXPProgress } from '@/lib/gamification'

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate()
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

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const db   = createSupabaseAdmin()
  const today = new Date()

  const { data: voltix } = await db
    .from('voltix_states').select('streak_days, last_interaction').eq('user_id', internalId).single()

  if (voltix?.last_interaction) {
    const lastDate = new Date(voltix.last_interaction)
    if (isSameDay(lastDate, today)) {
      return NextResponse.json({ already_checked: true, streak: voltix.streak_days ?? 0 })
    }
  }

  let newStreak = 1
  if (voltix?.last_interaction) {
    const lastDate = new Date(voltix.last_interaction)
    if (isYesterday(lastDate, today)) newStreak = (voltix.streak_days ?? 0) + 1
  }

  await db.from('voltix_states')
    .update({ streak_days: newStreak, last_interaction: today.toISOString() })
    .eq('user_id', internalId)

  const badgesAwarded: { code: string; name: string; icon: string }[] = []
  let xpEarned = 0

  try {
    const { data: xp } = await db.from('xp_progress').select('xp_total, level').eq('user_id', internalId).single()
    if (xp) {
      const baseXP    = 20
      let bonusXP     = 0
      let bonusReason: string | null = null

      if (newStreak === 30)     { bonusXP = 500; bonusReason = 'streak_30_days' }
      else if (newStreak === 7) { bonusXP = 100; bonusReason = 'streak_7_days'  }

      xpEarned = baseXP + bonusXP
      const newTotal = (xp.xp_total ?? 0) + xpEarned
      const progress = calculateXPProgress(newTotal)

      const inserts = [
        db.from('xp_progress').update({
          xp_total: newTotal, level: progress.level,
          last_activity_at: today.toISOString(), updated_at: today.toISOString(),
        }).eq('user_id', internalId),
        db.from('xp_history').insert({ user_id: internalId, amount: baseXP, reason: 'daily_login', earned_at: today.toISOString() }),
      ]
      if (bonusXP > 0 && bonusReason) {
        inserts.push(db.from('xp_history').insert({ user_id: internalId, amount: bonusXP, reason: bonusReason, earned_at: today.toISOString() }) as any)
      }
      await Promise.all(inserts)
    }
  } catch { /* best-effort */ }

  try {
    const checks = []
    if (newStreak >= 7)  checks.push(awardBadge(db, internalId, 'week_streak'))
    if (newStreak >= 30) checks.push(awardBadge(db, internalId, 'month_streak'))
    const results = await Promise.all(checks)
    results.forEach(r => { if (r.awarded && r.badge) badgesAwarded.push({ code: r.badge.code, name: r.badge.name, icon: r.badge.icon }) })
  } catch { /* best-effort */ }

  return NextResponse.json({ already_checked: false, streak: newStreak, xp_earned: xpEarned, badges_awarded: badgesAwarded })
}
