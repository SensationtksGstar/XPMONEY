import { auth }              from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin }       from '@/lib/supabase'
import { awardBadge }                from '@/lib/awardBadge'
import { z }                         from 'zod'
import { recalculateScore }          from '@/lib/recalculateScore'

const CreateSchema = z.object({
  account_id:  z.string(),
  amount:      z.number().positive(),
  type:        z.enum(['income', 'expense', 'transfer']),
  category_id: z.string(),
  description: z.string().default(''),
  date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit  = parseInt(searchParams.get('limit')  ?? '50')
  const offset = parseInt(searchParams.get('offset') ?? '0')
  const type   = searchParams.get('type')

  const db = createSupabaseAdmin()

  // Resolver user interno
  const { data: user } = await db
    .from('users')
    .select('id')
    .eq('clerk_id', userId)
    .single()

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  let query = db
    .from('transactions')
    .select('*, category:categories(id,name,icon,color,transaction_type,is_default)')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (type && type !== 'all') {
    query = query.eq('type', type)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, error: null })
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await req.json()
  const parsed = CreateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const db = createSupabaseAdmin()

  const { data: user } = await db
    .from('users')
    .select('id')
    .eq('clerk_id', userId)
    .single()

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { data, error } = await db
    .from('transactions')
    .insert({ ...parsed.data, user_id: user.id })
    .select('*, category:categories(id,name,icon,color,transaction_type,is_default)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Dar XP pela transação (+10 XP) — best-effort
  try {
    const { data: xp } = await db
      .from('xp_progress').select('xp_total, level').eq('user_id', user.id).single()
    if (xp) {
      const { calculateXPProgress } = await import('@/lib/gamification')
      const newTotal  = (xp.xp_total ?? 0) + 10
      const progress  = calculateXPProgress(newTotal)
      await db.from('xp_progress').update({
        xp_total:         newTotal,
        level:            progress.level,
        last_activity_at: new Date().toISOString(),
        updated_at:       new Date().toISOString(),
      }).eq('user_id', user.id)
      await db.from('xp_history').insert({
        user_id:   user.id,
        amount:    10,
        reason:    'transaction_registered',
        earned_at: new Date().toISOString(),
      })
    }
  } catch { /* não bloquear se falhar */ }

  // Award first_transaction badge — best-effort
  try {
    await awardBadge(db, user.id, 'first_transaction')
  } catch { /* never block the response */ }

  // Recalculate financial score after transaction — best-effort
  try {
    await recalculateScore(db, user.id)
  } catch { /* never block the response */ }

  return NextResponse.json({ data, error: null }, { status: 201 })
}
