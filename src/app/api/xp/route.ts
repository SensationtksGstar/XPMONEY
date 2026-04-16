import { auth }              from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin }       from '@/lib/supabase'
import { resolveUser }               from '@/lib/resolveUser'
import { awardXP }                   from '@/lib/awardXP'
import { calculateXPProgress }       from '@/lib/gamification'
import { z }                         from 'zod'
import { isDemoMode, demoResponse }  from '@/lib/demo/demoGuard'
import { DEMO_XP }                   from '@/lib/demo/mockData'

export async function GET() {
  if (isDemoMode()) return demoResponse(DEMO_XP)

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const db = createSupabaseAdmin()
  // maybeSingle — a brand-new user may not yet have an xp_progress row
  const { data } = await db
    .from('xp_progress')
    .select('*')
    .eq('user_id', internalId)
    .maybeSingle()

  if (!data) return NextResponse.json({ data: null, error: null })

  const progress = calculateXPProgress(data.xp_total)
  return NextResponse.json({ data: { ...data, ...progress }, error: null })
}

const AddXPSchema = z.object({
  amount: z.number().int().positive().max(100_000),
  reason: z.string().min(1).max(64),
})

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const parsed = AddXPSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const db = createSupabaseAdmin()

  // Delegate to the canonical awardXP helper — single source of truth for
  // xp_progress updates + xp_history insert + level-up detection.
  const result = await awardXP(db, internalId, parsed.data.amount, parsed.data.reason)

  if (!result) {
    return NextResponse.json({ error: 'User xp_progress row not found.' }, { status: 404 })
  }

  // calculateXPProgress already returns xp_total + level, so we spread it
  // directly — no need to restate fields that would get overwritten.
  const progress = calculateXPProgress(result.xp_total)

  return NextResponse.json({
    data:     progress,
    level_up: result.leveled_up,
    error:    null,
  })
}
