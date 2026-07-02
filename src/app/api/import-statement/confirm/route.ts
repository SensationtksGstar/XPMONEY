import { auth }                      from '@clerk/nextjs/server'
import { NextRequest, NextResponse }   from 'next/server'
import { createSupabaseAdmin }         from '@/lib/supabase'
import { resolveUser }                 from '@/lib/resolveUser'
import { isDemoMode, demoResponse }    from '@/lib/demo/demoGuard'
import { recalculateScore }            from '@/lib/recalculateScore'
import { awardXP }                     from '@/lib/awardXP'
import { setCachedCategoriesBulk }     from '@/lib/merchantCache'
import { fetchPlanRow }                from '@/lib/plan'
import { guardUser }                   from '@/lib/rateLimit'
import { getServerLocale }             from '@/lib/i18n/server'
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

  const locale = await getServerLocale()

  // ── Parse & validate body ──
  let body: z.infer<typeof BodySchema>
  try {
    const raw = await req.json()
    body = BodySchema.parse(raw)
  } catch (e) {
    return NextResponse.json({ error: 'Dados inválidos.', details: e }, { status: 400 })
  }

  const db = createSupabaseAdmin()

  // ── Plan gate — same as the parse route (/api/import-statement). This
  // endpoint was reachable directly by any authenticated free user, who
  // could bulk-insert 500 rows/call and farm 5 XP each without ever going
  // through the premium-gated parser (June 2026 security audit).
  const planRow = await fetchPlanRow(db, 'id', internalId)
  if (!(planRow?.isPremium ?? false)) {
    return NextResponse.json(
      {
        error: locale === 'en'
          ? 'Statement import is available only on the Premium plan.'
          : 'Importação de extratos disponível apenas no plano Premium.',
        code: 'plan_required',
      },
      { status: 403 },
    )
  }

  // ── Rate limit — generous vs the parser's 2/h+5/d (one parse produces one
  // confirm), but bounds the XP-farm/insert-spam worst case.
  const limited = await guardUser(internalId, 'import-confirm', [
    { limit: 10, windowMs: 60 * 60 * 1000 },      // 10/hour
    { limit: 30, windowMs: 24 * 60 * 60 * 1000 }, // 30/day
  ], {
    error: locale === 'en'
      ? 'You hit the import-confirmation limit. Try again later.'
      : 'Atingiste o limite de confirmações de importação. Tenta novamente mais tarde.',
    code: 'rate_limit',
  })
  if (limited) return limited

  // ── FK ownership check — don't trust client-supplied UUIDs (mirrors
  // /api/transactions POST). Without this, rows could reference another
  // user's account_id/category_id, polluting FK joins and leaking UUID
  // existence. Fetching the category names here also serves the merchant-
  // cache write below, so this costs no extra round-trip.
  const accountIds  = Array.from(new Set(body.transactions.map(t => t.account_id)))
  const categoryIds = Array.from(new Set(body.transactions.map(t => t.category_id)))

  const [accRes, catRes] = await Promise.all([
    db.from('accounts')
      .select('id')
      .in('id', accountIds)
      .eq('user_id', internalId),
    db.from('categories')
      .select('id, name, is_default, user_id')
      .in('id', categoryIds),
  ])

  const ownedAccounts = new Set((accRes.data ?? []).map(a => a.id as string))
  if (accountIds.some(id => !ownedAccounts.has(id))) {
    return NextResponse.json({ error: 'Invalid account' }, { status: 400 })
  }

  // A category is OK if it's the caller's OR a default seeded category
  // (is_default=true) that every user can use.
  const catNameById = new Map<string, string>()
  for (const c of catRes.data ?? []) {
    if (c.is_default === true || c.user_id === internalId) {
      catNameById.set(c.id as string, c.name as string)
    }
  }
  if (categoryIds.some(id => !catNameById.has(id))) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }

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

  // catNameById (category_id → human-readable name) was built during the
  // ownership check above — the merchant cache stores the category NAME
  // (e.g. "Alimentação"), not the per-user UUID.

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
