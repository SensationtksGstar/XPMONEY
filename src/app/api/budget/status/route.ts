import { auth }              from '@clerk/nextjs/server'
import { NextResponse }       from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { resolveUser }         from '@/lib/resolveUser'
import { toNumber }            from '@/lib/safeNumber'
import { buildBudgetStatus, type Budget } from '@/lib/budget'

/**
 * GET /api/budget/status — estado do orçamento no mês corrente.
 *
 * Retorna a estrutura pronta para renderizar: limites, gasto e % por bucket
 * (needs/wants/savings), top categorias por bucket, e totais.
 *
 * Devolve null em `data` se:
 *   - user não tem budget configurado ainda
 *   - tabela budgets não existe (migração em falta — silent)
 *
 * Nunca devolve 500 para o cliente por falta de config — a página decide
 * mostrar o fluxo de setup se receber null.
 */

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export async function GET() {
  const now   = new Date()
  const month = monthKey(now)

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ data: null, error: null })

  const db = createSupabaseAdmin()

  // 1. Budget config do user
  const { data: budget, error: budgetErr } = await db
    .from('budgets')
    .select('*')
    .eq('user_id', internalId)
    .maybeSingle()

  if (budgetErr) {
    if (/relation .* does not exist/i.test(budgetErr.message)) {
      return NextResponse.json({ data: null, error: null, migration_needed: true })
    }
    return NextResponse.json({ error: budgetErr.message }, { status: 500 })
  }
  if (!budget) return NextResponse.json({ data: null, error: null })

  // 2. Transações de despesa do mês corrente
  const startOfMonth = `${month}-01`
  const startOfNext  = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    .toISOString().split('T')[0]

  const { data: txRaw, error: txErr } = await db
    .from('transactions')
    .select('amount, category:category_id(name, icon)')
    .eq('user_id', internalId)
    .eq('type', 'expense')
    .gte('date', startOfMonth)
    .lt('date', startOfNext)

  if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 })

  // Normaliza shape do join (PostgREST pode devolver array mesmo em 1-1)
  type RawRow = {
    amount: unknown
    category: { name: string | null; icon: string | null }
      | Array<{ name: string | null; icon: string | null }>
      | null
  }
  const tx = ((txRaw ?? []) as unknown as RawRow[]).map(r => ({
    amount: toNumber(r.amount),
    category: Array.isArray(r.category)
      ? (r.category[0] ?? null)
      : r.category,
  }))

  // 3. Build status e devolve
  const b: Budget = {
    id:             budget.id,
    user_id:        budget.user_id,
    monthly_income: toNumber(budget.monthly_income),
    pct_needs:      toNumber(budget.pct_needs),
    pct_wants:      toNumber(budget.pct_wants),
    pct_savings:    toNumber(budget.pct_savings),
  }

  return NextResponse.json({
    data: buildBudgetStatus(b, tx, month),
    error: null,
  })
}
