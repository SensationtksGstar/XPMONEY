import { auth }                      from '@clerk/nextjs/server'
import { NextRequest, NextResponse }   from 'next/server'
import { createSupabaseAdmin }         from '@/lib/supabase'
import { resolveUser }                 from '@/lib/resolveUser'
import { isDemoMode, demoResponse }    from '@/lib/demo/demoGuard'
import { recalculateScore }            from '@/lib/recalculateScore'
import { awardXP }                     from '@/lib/awardXP'
import { setCachedCategoriesBulk }     from '@/lib/merchantCache'
import { z }                           from 'zod'

const RowSchema = z.object({
  account_id:           z.string(),
  category_id:          z.string(),
  date:                 z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description:          z.string(),
  /**
   * Optional original (unmodified) bank description. When supplied we use
   * it as the merchant-cache key — the user's edited description may have
   * stripped the merchant token. Falls back to `description` when omitted.
   */
  original_description: z.string().optional(),
  amount:               z.number().positive(),
  type:                 z.enum(['income', 'expense', 'transfer']),
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

  // Resolve category_id → category name once for the cache write below.
  // Cache stores the human-readable category name (e.g. "Alimentação"),
  // not the per-user UUID — that's what the merchant-cache contract
  // expects, and it's what the next user's import will receive.
  const categoryIds = Array.from(new Set(body.transactions.map(t => t.category_id)))
  const { data: cats } = await db
    .from('categories')
    .select('id, name')
    .in('id', categoryIds)
  const catNameById = new Map((cats ?? []).map(c => [c.id, c.name as string]))

  // XP award + score recalc — run in parallel, never block on errors
  await Promise.allSettled([
    awardXP(db, internalId, xpEarned, `statement_import_${inserted}_transactions`),
    recalculateScore(db, internalId),
    // Seed the global merchant cache with confirmed categorizations. This
    // is gated by privacy allowlist (src/lib/merchantCache.ts) so personal
    // transfers never leak into the shared table. Source 'user' starts at
    // confidence 0.7 because a human label is a strong signal.
    setCachedCategoriesBulk(
      body.transactions
        .map(t => {
          const category = catNameById.get(t.category_id)
          if (!category) return null
          return {
            originalDescription: t.original_description ?? t.description,
            category,
            source: 'user' as const,
          }
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
    ),
  ])

  return NextResponse.json({ data: { inserted, xp_gained: xpEarned } }, { status: 201 })
}
