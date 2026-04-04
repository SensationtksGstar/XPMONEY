import { auth }              from '@clerk/nextjs/server'
import { NextResponse }        from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { awardBadge }          from '@/lib/awardBadge'

export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createSupabaseAdmin()

  // Resolve internal user
  const { data: user } = await db
    .from('users')
    .select('id')
    .eq('clerk_id', userId)
    .single()

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const newlyAwarded: { code: string; name: string; icon: string; xp_reward: number }[] = []

  // Helper to conditionally award a badge and collect the result
  async function tryAward(condition: boolean, badgeCode: string) {
    if (!condition) return
    const result = await awardBadge(db, user.id, badgeCode)
    if (result.awarded && result.badge) {
      newlyAwarded.push({
        code:       result.badge.code,
        name:       result.badge.name,
        icon:       result.badge.icon,
        xp_reward:  result.badge.xp_reward,
      })
    }
  }

  // 1. first_transaction: user has at least one transaction
  const { count: txCount } = await db
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  await tryAward((txCount ?? 0) > 0, 'first_transaction')

  // 2 & 3 & 4. score badges: latest financial_score
  const { data: latestScore } = await db
    .from('financial_scores')
    .select('score')
    .eq('user_id', user.id)
    .order('calculated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const score = latestScore?.score ?? 0

  await tryAward(score >= 50, 'score_50')
  await tryAward(score >= 75, 'score_75')
  await tryAward(score >= 90, 'score_90')

  // 5. goal_reached: any goal where current_amount >= target_amount
  // Supabase doesn't support column-to-column comparisons in .filter(), so fetch and check in JS
  const { data: goals } = await db
    .from('goals')
    .select('id, current_amount, target_amount')
    .eq('user_id', user.id)

  const hasCompletedGoal = (goals ?? []).some(
    (g) => (g.current_amount ?? 0) >= (g.target_amount ?? Infinity),
  )

  await tryAward(hasCompletedGoal, 'goal_reached')

  return NextResponse.json({
    badges_awarded: newlyAwarded,
    count:          newlyAwarded.length,
  })
}
