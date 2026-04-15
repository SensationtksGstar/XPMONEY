import { auth }                      from '@clerk/nextjs/server'
import { NextRequest, NextResponse }   from 'next/server'
import { createSupabaseAdmin }         from '@/lib/supabase'
import { resolveUser }                 from '@/lib/resolveUser'
import { isDemoMode, demoResponse }    from '@/lib/demo/demoGuard'
import { recalculateScore }            from '@/lib/recalculateScore'
import { awardXP }                     from '@/lib/awardXP'
import { z }                           from 'zod'

const RowSchema = z.object({
  account_id:  z.string(),
  category_id: z.string(),
  date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string(),
  amount:      z.number().positive(),
  type:        z.enum(['income', 'expense']),
})

const BodySchema = z.object({
  transactions: z.array(RowSchema).min(1).max(500),
})

export async function POST(req: NextRequest) {
  // ── Demo mode ──
  if (isDemoMode()) {
    return demoResponse({ inserted: 0, xp_gained: 0, message: 'Demo: transações não são guardadas em modo demonstração.' })
  }

  // ── Auth ──
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // ── Parse & validate body ──
  let body: z.infer<typeof BodySchema>
  try {
    const raw = await req.json()
    body = BodySchema.parse(raw)
  } catch (e) {
    return NextResponse.json({ error: 'Dados inválidos.', details: e }, { status: 400 })
  }

  const db = createSupabaseAdmin()

  // ── Bulk insert ──
  const rows = body.transactions.map(t => ({
    user_id:     internalId,
    account_id:  t.account_id,
    category_id: t.category_id,
    date:        t.date,
    description: t.description,
    amount:      t.amount,
    type:        t.type,
  }))

  const { error: insertError } = await db
    .from('transactions')
    .insert(rows)

  if (insertError) {
    console.error('[import-statement/confirm] insert error', insertError)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  const inserted = rows.length
  const xpEarned = inserted * 5 // 5 XP per imported transaction (bulk discount vs manual)

  // XP award + score recalc — run in parallel, never block on errors
  await Promise.allSettled([
    awardXP(db, internalId, xpEarned, `statement_import_${inserted}_transactions`),
    recalculateScore(db, internalId),
  ])

  return NextResponse.json({ data: { inserted, xp_gained: xpEarned } }, { status: 201 })
}
