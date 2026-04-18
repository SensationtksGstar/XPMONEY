import { auth }                 from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin }  from '@/lib/supabase'
import { resolveUser }          from '@/lib/resolveUser'

/**
 * GET /api/debts/[id]/attacks
 *
 * Histórico de pagamentos (attacks) contra uma dívida específica.
 * Ordenado do mais recente para o mais antigo, limite 100.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: debtId } = await ctx.params
  if (!debtId) return NextResponse.json({ error: 'ID em falta' }, { status: 400 })

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ data: [], error: null })

  const db = createSupabaseAdmin()
  const { data, error } = await db
    .from('debt_attacks')
    .select('*')
    .eq('debt_id', debtId)
    .eq('user_id', internalId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    if (/relation .* does not exist/i.test(error.message)) {
      return NextResponse.json({ data: [], error: null, migration_needed: true })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ data: data ?? [], error: null })
}
