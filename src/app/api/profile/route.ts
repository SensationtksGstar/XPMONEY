import { auth }                    from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin }       from '@/lib/supabase'
import { z }                         from 'zod'

const UpdateProfileSchema = z.object({
  name:        z.string().min(1).max(100).optional(),
  challenge:   z.string().optional(),
  goal:        z.string().optional(),
  currency:    z.string().length(3).optional(),
})

export async function GET(_req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createSupabaseAdmin()
  const { data, error } = await db
    .from('users')
    .select('id, name, email, avatar_url, plan, challenge, goal, currency, created_at')
    .eq('clerk_id', userId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, error: null })
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await req.json()
  const parsed = UpdateProfileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const db = createSupabaseAdmin()

  const updates: Record<string, string> = { updated_at: new Date().toISOString() }
  if (parsed.data.name)      updates.name      = parsed.data.name
  if (parsed.data.challenge) updates.challenge = parsed.data.challenge
  if (parsed.data.goal)      updates.goal      = parsed.data.goal
  if (parsed.data.currency)  updates.currency  = parsed.data.currency

  const { data, error } = await db
    .from('users')
    .update(updates)
    .eq('clerk_id', userId)
    .select('id, name, email, avatar_url, plan, challenge, goal, currency')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, error: null })
}
