import { auth }              from '@clerk/nextjs/server'
import { NextResponse }        from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { resolveUser }         from '@/lib/resolveUser'
import { awardBadge }          from '@/lib/awardBadge'
import { awardXP }             from '@/lib/awardXP'

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

  // maybeSingle: a brand-new user may not yet have a voltix_states row
  const { data: voltix } = await db
    .from('voltix_states')
    .select('streak_days, last_interaction')
    .eq('user_id', internalId)
    .maybeSingle()

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

  const { error: voltixErr } = await db.from('voltix_states')
    .update({ streak_days: newStreak, last_interaction: today.toISOString() })
    .eq('user_id', internalId)
  if (voltixErr) {
    console.warn('[daily-checkin] voltix update failed:', voltixErr.message)
  }

  const badgesAwarded: { code: string; name: string; icon: string }[] = []
  let xpEarned = 0

  // ── XP award — delegate to canonical awardXP helper ─────────────────────
  const baseXP = 20
  let bonusXP  = 0
  let bonusReason: string | null = null
  if (newStreak === 30)     { bonusXP = 500; bonusReason = 'streak_30_days' }
  else if (newStreak === 7) { bonusXP = 100; bonusReason = 'streak_7_days'  }

  const baseRes = await awardXP(db, internalId, baseXP, 'daily_login')
  if (baseRes) xpEarned += baseRes.xp_gained

  if (bonusXP > 0 && bonusReason) {
    const bonusRes = await awardXP(db, internalId, bonusXP, bonusReason)
    if (bonusRes) xpEarned += bonusRes.xp_gained
  }

  // ── Streak badges — log on failure, don't block response ────────────────
  try {
    const checks: Promise<Awaited<ReturnType<typeof awardBadge>>>[] = []
    if (newStreak >= 7)  checks.push(awardBadge(db, internalId, 'week_streak'))
    if (newStreak >= 30) checks.push(awardBadge(db, internalId, 'month_streak'))
    const results = await Promise.all(checks)
    results.forEach(r => {
      if (r.awarded && r.badge) {
        badgesAwarded.push({ code: r.badge.code, name: r.badge.name, icon: r.badge.icon })
      }
    })
  } catch (err) {
    console.warn('[daily-checkin] badge check failed:', err)
  }

  return NextResponse.json({
    already_checked: false,
    streak:          newStreak,
    xp_earned:       xpEarned,
    badges_awarded:  badgesAwarded,
  })
}
