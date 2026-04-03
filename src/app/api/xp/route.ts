import { auth }              from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin }       from '@/lib/supabase'
import { calculateXPProgress }       from '@/lib/gamification'
import { z }                         from 'zod'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createSupabaseAdmin()
  const { data: user } = await db
    .from('users').select('id').eq('clerk_id', userId).single()
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { data } = await db
    .from('xp_progress')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!data) return NextResponse.json({ data: null, error: null })

  const progress = calculateXPProgress(data.xp_total)
  return NextResponse.json({
    data: { ...data, ...progress },
    error: null,
  })
}

const AddXPSchema = z.object({
  amount: z.number().int().positive(),
  reason: z.string(),
})

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await req.json()
  const parsed = AddXPSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const db = createSupabaseAdmin()
  const { data: user } = await db
    .from('users').select('id').eq('clerk_id', userId).single()
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Atualizar XP
  const { data: current } = await db
    .from('xp_progress').select('*').eq('user_id', user.id).single()

  const newTotal = (current?.xp_total ?? 0) + parsed.data.amount
  const progress = calculateXPProgress(newTotal)

  const { data: updated, error } = await db
    .from('xp_progress')
    .upsert({
      user_id:           user.id,
      xp_total:          newTotal,
      level:             progress.level,
      last_activity_at:  new Date().toISOString(),
      updated_at:        new Date().toISOString(),
    })
    .select()
    .single()

  // Log XP
  await db.from('xp_history').insert({
    user_id:  user.id,
    amount:   parsed.data.amount,
    reason:   parsed.data.reason,
    earned_at: new Date().toISOString(),
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const leveledUp = progress.level > (current?.level ?? 1)
  return NextResponse.json({
    data:      { ...updated, ...progress },
    level_up:  leveledUp,
    error:     null,
  })
}
