import { auth }              from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin }       from '@/lib/supabase'
import { resolveUser }               from '@/lib/resolveUser'
import { parseBoundedInt }           from '@/lib/safeNumber'
import { z }                         from 'zod'
import { createTransaction }         from '@/lib/createTransaction'
import { isDemoMode, demoResponse }  from '@/lib/demo/demoGuard'
import { DEMO_TRANSACTIONS }         from '@/lib/demo/mockData'

const CreateSchema = z.object({
  account_id:  z.string(),
  amount:      z.number().positive(),
  type:        z.enum(['income', 'expense', 'transfer']),
  category_id: z.string(),
  description: z.string().default(''),
  date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export async function GET(req: NextRequest) {
  if (isDemoMode()) return demoResponse(DEMO_TRANSACTIONS)

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const limit  = parseBoundedInt(searchParams.get('limit'),  { default: 50, min: 1, max: 200 })
  const offset = parseBoundedInt(searchParams.get('offset'), { default: 0,  min: 0, max: 10_000 })
  const type   = searchParams.get('type')

  const db = createSupabaseAdmin()

  let query = db
    .from('transactions')
    .select('*, category:categories(id,name,icon,color,transaction_type,is_default)')
    .eq('user_id', internalId)
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
  if (isDemoMode()) return demoResponse(DEMO_TRANSACTIONS[0], 201)

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const db = createSupabaseAdmin()

  // Posse do account/category + insert + cadeia de gamificação AWAITED vivem
  // em createTransaction() (partilhada com o onboarding). Contrato da
  // resposta inalterado: { data, xp, missions_completed, error }.
  const result = await createTransaction(db, internalId, parsed.data)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(
    { data: result.data, xp: result.xp, missions_completed: result.missions_completed, error: null },
    { status: 201 },
  )
}
