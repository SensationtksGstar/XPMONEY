import { auth }              from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin }       from '@/lib/supabase'
import { resolveUser }               from '@/lib/resolveUser'
import { z }                         from 'zod'
import { isDemoMode, demoResponse }  from '@/lib/demo/demoGuard'
import { DEMO_GOALS }                from '@/lib/demo/mockData'

const GoalSchema = z.object({
  name:          z.string().min(1),
  icon:          z.string().default('🎯'),
  target_amount: z.number().positive(),
  deadline:      z.string().nullable().optional(),
})

export async function GET() {
  if (isDemoMode()) return demoResponse(DEMO_GOALS)

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ data: [], error: null })

  const db = createSupabaseAdmin()
  const { data, error } = await db
    .from('goals').select('*').eq('user_id', internalId).order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [], error: null })
}

export async function POST(req: NextRequest) {
  if (isDemoMode()) return demoResponse(DEMO_GOALS[0], 201)

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await req.json()
  const parsed = GoalSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const db = createSupabaseAdmin()
  const { data, error } = await db
    .from('goals').insert({ ...parsed.data, user_id: internalId }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, error: null }, { status: 201 })
}
