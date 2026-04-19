import { auth }                      from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin }       from '@/lib/supabase'
import { resolveUser }               from '@/lib/resolveUser'
import { validatePercentages }       from '@/lib/budget'
import { z }                         from 'zod'

/**
 * /api/budget — orçamento pessoal 50/30/20 (um por user).
 *
 * GET  → devolve a config actual ou null se o user ainda não configurou.
 * PUT  → upsert da config (rendimento + percentagens). Valida que as
 *        percentagens somam 100 (tolerância 0.5).
 *
 * Gracefully degrades se a tabela budgets ainda não existir no DB
 * (retorna { data: null, migration_needed: true } em vez de 500).
 */

const BudgetSchema = z.object({
  monthly_income: z.number().nonnegative().max(10_000_000),
  pct_needs:      z.number().min(0).max(100),
  pct_wants:      z.number().min(0).max(100),
  pct_savings:    z.number().min(0).max(100),
})

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ data: null, error: null })

  const db = createSupabaseAdmin()
  const { data, error } = await db
    .from('budgets')
    .select('*')
    .eq('user_id', internalId)
    .maybeSingle()

  if (error) {
    if (/relation .* does not exist/i.test(error.message)) {
      return NextResponse.json({ data: null, error: null, migration_needed: true })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ data, error: null })
}

export async function PUT(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }
  const parsed = BudgetSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { monthly_income, pct_needs, pct_wants, pct_savings } = parsed.data

  if (!validatePercentages(pct_needs, pct_wants, pct_savings)) {
    return NextResponse.json(
      { error: 'As percentagens têm de somar 100% (±0.5).' },
      { status: 400 },
    )
  }

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const db = createSupabaseAdmin()
  // Upsert por user_id (única constraint) — evita dois rows para o mesmo user.
  const { data, error } = await db
    .from('budgets')
    .upsert(
      { user_id: internalId, monthly_income, pct_needs, pct_wants, pct_savings },
      { onConflict: 'user_id' },
    )
    .select()
    .maybeSingle()

  if (error) {
    if (/relation .* does not exist/i.test(error.message)) {
      return NextResponse.json(
        { error: 'Tabela budgets não existe. Corre database/budget.sql no SQL editor do Supabase.' },
        { status: 503 },
      )
    }
    console.warn('[budget PUT] failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ data, error: null })
}
