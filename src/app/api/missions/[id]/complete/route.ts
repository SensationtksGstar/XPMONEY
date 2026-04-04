import { auth }              from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin }       from '@/lib/supabase'
import { calculateXPProgress }       from '@/lib/gamification'
import { recalculateScore }          from '@/lib/recalculateScore'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const db = createSupabaseAdmin()

  const { data: user } = await db
    .from('users').select('id').eq('clerk_id', userId).single()
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Buscar missão e verificar se pertence ao user
  const { data: mission } = await db
    .from('missions')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!mission) return NextResponse.json({ error: 'Mission not found' }, { status: 404 })
  if (mission.status === 'completed') {
    return NextResponse.json({ error: 'Already completed' }, { status: 400 })
  }

  // Marcar como concluída
  await db.from('missions')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', id)

  // Dar XP
  const { data: xp } = await db
    .from('xp_progress').select('xp_total, level').eq('user_id', user.id).single()

  const newTotal = (xp?.xp_total ?? 0) + mission.xp_reward
  const progress = calculateXPProgress(newTotal)

  await db.from('xp_progress').update({
    xp_total:         newTotal,
    level:            progress.level,
    last_activity_at: new Date().toISOString(),
    updated_at:       new Date().toISOString(),
  }).eq('user_id', user.id)

  await db.from('xp_history').insert({
    user_id:   user.id,
    amount:    mission.xp_reward,
    reason:    `mission_completed:${id}`,
    earned_at: new Date().toISOString(),
  })

  const leveledUp = progress.level > (xp?.level ?? 1)

  // Recalculate financial score after mission completion — best-effort
  try {
    await recalculateScore(db, user.id)
  } catch { /* never block the response */ }

  return NextResponse.json({
    success:   true,
    xp_earned: mission.xp_reward,
    level_up:  leveledUp,
    new_level: progress.level,
  })
}
