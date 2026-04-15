import { auth }                    from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin }       from '@/lib/supabase'
import { resolveUser }               from '@/lib/resolveUser'
import { z }                         from 'zod'
import { isDemoMode, demoResponse }  from '@/lib/demo/demoGuard'
import { DEMO_ACCOUNT }              from '@/lib/demo/mockData'

const CreateAccountSchema = z.object({
  name:     z.string().min(1),
  type:     z.enum(['checking', 'savings', 'wallet', 'investment', 'credit']),
  balance:  z.number().default(0),
  currency: z.string().default('EUR'),
  color:    z.string().default('#22c55e'),
  icon:     z.string().default('🏦'),
})

export async function GET(_req: NextRequest) {
  if (isDemoMode()) return demoResponse([DEMO_ACCOUNT])

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const db = createSupabaseAdmin()
  const { data, error } = await db
    .from('accounts').select('*').eq('user_id', internalId)
    .order('is_default', { ascending: false }).order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, error: null })
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await req.json()
  const parsed = CreateAccountSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const db = createSupabaseAdmin()
  const { data, error } = await db
    .from('accounts').insert({ ...parsed.data, user_id: internalId, is_default: false })
    .select('*').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, error: null }, { status: 201 })
}
