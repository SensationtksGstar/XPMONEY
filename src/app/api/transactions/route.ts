import { auth }              from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin }       from '@/lib/supabase'
import { resolveUser }               from '@/lib/resolveUser'
import { awardBadge }                from '@/lib/awardBadge'
import { awardXP }                   from '@/lib/awardXP'
import { parseBoundedInt }           from '@/lib/safeNumber'
import { z }                         from 'zod'
import { recalculateScore }          from '@/lib/recalculateScore'
import { updateMissionProgress }     from '@/lib/updateMissionProgress'
import { isDemoMode, demoResponse }  from '@/lib/demo/demoGuard'
import { DEMO_TRANSACTIONS }         from '@/lib/demo/mockData'
import { XP_REWARDS }                from '@/types'

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

  // FK ownership check — don't trust client-supplied UUIDs.
  // Without this, a malicious client could POST a transaction referencing
  // another user's account_id or a non-default category_id belonging to
  // someone else. Even if the insert sets user_id correctly, the cross-
  // reference pollutes any view that joins by FK without re-applying the
  // user_id filter — and it leaks UUID existence via success/fail status.
  const accountId  = (parsed.data as { account_id?: string | null }).account_id
  const categoryId = (parsed.data as { category_id?: string | null }).category_id

  if (accountId) {
    const { data: acc } = await db
      .from('accounts')
      .select('id')
      .eq('id', accountId)
      .eq('user_id', internalId)
      .maybeSingle()
    if (!acc) return NextResponse.json({ error: 'Invalid account' }, { status: 400 })
  }
  if (categoryId) {
    // A category is OK if it's the caller's OR a default seeded category
    // (is_default=true + user_id null) that every user can use.
    const { data: cat } = await db
      .from('categories')
      .select('id, is_default, user_id')
      .eq('id', categoryId)
      .maybeSingle()
    const ownsCategory =
      !!cat && (cat.is_default === true || cat.user_id === internalId)
    if (!ownsCategory) return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }

  const { data, error } = await db
    .from('transactions')
    .insert({ ...parsed.data, user_id: internalId })
    .select('*, category:categories(id,name,icon,color,transaction_type,is_default)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // All secondary effects run in parallel — none block the response
  await Promise.allSettled([
    awardXP(db, internalId, XP_REWARDS.TRANSACTION_REGISTERED, 'transaction_registered'),
    awardBadge(db, internalId, 'first_transaction'),
    recalculateScore(db, internalId),
    // Bump the "log N transactions" mission. Other mission types depend on
    // daily-checkin (streaks) and score recalc (score delta) so they tick
    // from their own call sites.
    updateMissionProgress(db, internalId, { type: 'register_transactions' }),
  ])

  return NextResponse.json({ data, error: null }, { status: 201 })
}
