import { auth }                   from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin }       from '@/lib/supabase'
import { z }                         from 'zod'
import { resolveUser }               from '@/lib/resolveUser'
import { awardXP }                   from '@/lib/awardXP'
import { toNumber }                  from '@/lib/safeNumber'

const DepositSchema = z.object({
  amount: z.number().refine(n => n !== 0, { message: 'Amount cannot be zero' }),
  note:   z.string().max(200).optional().default(''),
  date:   z.string().optional(),
})

// ── GET /api/goals/[id]/deposits ── list deposit history
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ data: [] })

  const db = createSupabaseAdmin()

  const { data, error } = await db
    .from('goal_deposits')
    .select('*')
    .eq('goal_id', id)
    .eq('user_id', internalId)
    .order('date', { ascending: true })
    .limit(100)

  // If table doesn't exist yet, return empty gracefully
  if (error) {
    if (error.code === '42P01' || error.message?.includes('goal_deposits')) {
      return NextResponse.json({ data: [] })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ data: data ?? [] })
}

// ── POST /api/goals/[id]/deposits ── register deposit or withdrawal
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body    = await req.json()
  const parsed  = DepositSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const db = createSupabaseAdmin()

  // Verify goal belongs to user
  const { data: goal } = await db
    .from('goals')
    .select('id, current_amount, target_amount, status')
    .eq('id', id)
    .eq('user_id', internalId)
    .single()
  if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })

  const today = new Date().toISOString().split('T')[0]

  // Insert deposit
  const { data: deposit, error: depositError } = await db
    .from('goal_deposits')
    .insert({
      goal_id: id,
      user_id: internalId,
      amount:  parsed.data.amount,
      note:    parsed.data.note,
      date:    parsed.data.date ?? today,
    })
    .select()
    .single()

  if (depositError) {
    // Table not created yet — fall back to updating goal amount directly
    if (depositError.code === '42P01' || depositError.message?.includes('goal_deposits')) {
      // Skip deposit record, just update goal amount
    } else {
      return NextResponse.json({ error: depositError.message }, { status: 500 })
    }
  }

  // Update goal current_amount (never below 0) — `numeric` columns come back
  // as strings from Postgres, so we normalise via toNumber to avoid NaN leaks.
  const currentAmount = toNumber(goal.current_amount, 0)
  const targetAmount  = toNumber(goal.target_amount,  0)
  const newAmount     = Math.max(0, currentAmount + parsed.data.amount)
  const isCompleted   = targetAmount > 0 && newAmount >= targetAmount
  const newStatus     = isCompleted ? 'completed' : 'active'

  const { data: updatedGoal, error: updateError } = await db
    .from('goals')
    .update({
      current_amount: newAmount,
      status:         newStatus,
      updated_at:     new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', internalId)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Award XP for savings deposit (best-effort, only for positive deposits).
  // Reward scales: 10 XP minimum, +1 XP per €10 deposited, capped at 50.
  let xpEarned = 0
  if (parsed.data.amount > 0) {
    xpEarned = Math.max(10, Math.min(50, Math.floor(parsed.data.amount / 10)))
    const bonus = isCompleted ? 200 : 0  // bonus when goal is hit
    const total = xpEarned + bonus
    await awardXP(db, internalId, total, isCompleted ? 'goal_completed' : 'savings_deposit')
    xpEarned = total
  }

  return NextResponse.json({
    data: { deposit: deposit ?? null, goal: updatedGoal },
    isCompleted,
    xp_earned: xpEarned,
  }, { status: 201 })
}
