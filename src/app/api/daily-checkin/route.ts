import { auth }              from '@clerk/nextjs/server'
import { NextResponse }        from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { resolveUser }         from '@/lib/resolveUser'
import { awardBadge }          from '@/lib/awardBadge'
import { awardXP }             from '@/lib/awardXP'
import { updateMissionProgress } from '@/lib/updateMissionProgress'
import { XP_REWARDS }          from '@/types'

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

/**
 * Daily check-in — awards `daily_login` XP at most once per calendar day.
 *
 * ## Why the double guard (xp_history + voltix_states)
 *
 * Previously we only checked `voltix_states.last_interaction`. Two failure modes
 * caused users to farm XP by just reopening the app:
 *
 * 1. **Missing row**: brand-new users without a `voltix_states` row. The original
 *    code ran `.update().eq(user_id, …)` which silently affects 0 rows when the
 *    row doesn't exist → `last_interaction` stays NULL → every re-entry passes
 *    the same-day check and awards XP again.
 * 2. **Race on re-entry**: dashboard and /voltix both POST here on mount. Two
 *    near-simultaneous requests could both pass the read-then-write check before
 *    either updated `last_interaction`.
 *
 * `xp_history` is our source-of-truth ledger. We first check whether a
 * `daily_login` row already exists with `earned_at >= start_of_today`. If yes —
 * return `already_checked` immediately, regardless of the voltix_states state.
 * This makes the endpoint idempotent per day.
 */
export async function POST() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return NextResponse.json({ already_checked: false, streak: 4, xp_earned: 20, badges_awarded: [] })
  }

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const db    = createSupabaseAdmin()
  const today = new Date()
  const todayStartISO = new Date(
    today.getFullYear(), today.getMonth(), today.getDate(),
  ).toISOString()

  // ── 1. Authoritative guard: already awarded daily_login today? ─────────
  // Read xp_history directly — it's the ledger we write to via awardXP(),
  // so if a row exists, we already paid out today and must not pay again.
  const { data: alreadyAwarded } = await db
    .from('xp_history')
    .select('id')
    .eq('user_id', internalId)
    .eq('reason',  'daily_login')
    .gte('earned_at', todayStartISO)
    .limit(1)
    .maybeSingle()

  // Fetch current voltix state (may be null for brand-new users)
  const { data: voltix } = await db
    .from('voltix_states')
    .select('streak_days, last_interaction')
    .eq('user_id', internalId)
    .maybeSingle()

  if (alreadyAwarded) {
    return NextResponse.json({
      already_checked: true,
      streak: voltix?.streak_days ?? 0,
    })
  }

  // ── 2. Compute new streak ──────────────────────────────────────────────
  let newStreak = 1
  if (voltix?.last_interaction) {
    const lastDate = new Date(voltix.last_interaction)
    if (isSameDay(lastDate, today))       newStreak = voltix.streak_days ?? 1
    else if (isYesterday(lastDate, today)) newStreak = (voltix.streak_days ?? 0) + 1
  }

  // ── 3. Persist state via UPSERT so a missing row is created, not ignored.
  // We key on user_id (unique per row). If the user already had a row, all
  // listed columns are overwritten. If not, a fresh row is inserted.
  const { error: voltixErr } = await db.from('voltix_states').upsert(
    {
      user_id:          internalId,
      streak_days:      newStreak,
      last_interaction: today.toISOString(),
      // Don't clobber an existing mood/evolution_level — only set defaults
      // when the row is brand-new. Supabase upsert overwrites every listed
      // column, so we intentionally omit those. Row insertion uses column
      // defaults (mood='neutral', evolution_level=1) from the schema.
    },
    { onConflict: 'user_id' },
  )
  if (voltixErr) {
    console.warn('[daily-checkin] voltix upsert failed:', voltixErr.message)
  }

  const badgesAwarded: { code: string; name: string; icon: string }[] = []
  let xpEarned = 0

  // ── 4. XP award — delegate to canonical awardXP helper ─────────────────
  // Values come from XP_REWARDS (src/types) so tuning lives in one place.
  // Previously the numbers were hardcoded here and drifted from the
  // constants file (base was 20 vs 25 constant; streak-7 was 100 vs 300).
  const baseXP = XP_REWARDS.DAILY_LOGIN
  let bonusXP  = 0
  let bonusReason: string | null = null
  if (newStreak === 30)     { bonusXP = XP_REWARDS.STREAK_30_DAYS; bonusReason = 'streak_30_days' }
  else if (newStreak === 7) { bonusXP = XP_REWARDS.STREAK_7_DAYS;  bonusReason = 'streak_7_days'  }

  const baseRes = await awardXP(db, internalId, baseXP, 'daily_login')
  if (baseRes) xpEarned += baseRes.xp_gained

  if (bonusXP > 0 && bonusReason) {
    const bonusRes = await awardXP(db, internalId, bonusXP, bonusReason)
    if (bonusRes) xpEarned += bonusRes.xp_gained
  }

  // Tick any active `keep_daily_streak` mission (there can be multiple — the
  // free tier seeds a 7-day one; the premium tier adds a 30-day variant).
  // Fire-and-forget — mission writes never block the response.
  updateMissionProgress(db, internalId, {
    type:   'keep_daily_streak',
    streak: newStreak,
  }).catch(err => console.warn('[daily-checkin] mission tick failed:', err))

  // ── 5. Streak badges — log on failure, don't block response ────────────
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
