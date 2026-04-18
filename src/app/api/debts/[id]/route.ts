import { auth }              from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin }       from '@/lib/supabase'
import { resolveUser }               from '@/lib/resolveUser'
import { z }                         from 'zod'

/**
 * /api/debts/[id] — PATCH e DELETE de uma dívida específica.
 *
 * PATCH aceita mudanças parciais (nome, categoria, taxas, estratégia,
 * status). O frontend usa isto para actualizar a prestação mínima,
 * trocar de estratégia, ou marcar manualmente como killed.
 *
 * DELETE remove a dívida e o histórico de ataques em cascade (FK com
 * ON DELETE CASCADE no schema).
 */

const PatchSchema = z.object({
  name:           z.string().min(1).max(80).optional(),
  category:       z.string().min(1).max(40).optional(),
  current_amount: z.number().nonnegative().max(10_000_000).optional(),
  interest_rate:  z.number().nonnegative().max(100).optional(),
  min_payment:    z.number().nonnegative().max(1_000_000).optional(),
  strategy:       z.enum(['avalanche', 'snowball']).optional(),
  status:         z.enum(['active', 'killed']).optional(),
})

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  if (!id) return NextResponse.json({ error: 'ID em falta' }, { status: 400 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const db = createSupabaseAdmin()

  const patch: Record<string, unknown> = { ...parsed.data }
  // Se o user marcar status='killed' sem ter zerado current_amount, força-o a 0
  // e regista killed_at. Igual na direcção inversa — se voltar para active,
  // limpa killed_at para não ficar inconsistente.
  if (parsed.data.status === 'killed') {
    patch.current_amount = 0
    patch.killed_at      = new Date().toISOString()
  } else if (parsed.data.status === 'active') {
    patch.killed_at = null
  }

  const { data, error } = await db
    .from('debts')
    .update(patch)
    .eq('id', id)
    .eq('user_id', internalId)  // defesa em profundidade: impede patch de outra pessoa
    .select()
    .maybeSingle()

  if (error) {
    console.warn('[debts PATCH] failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Dívida não encontrada' }, { status: 404 })
  }
  return NextResponse.json({ data, error: null })
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  if (!id) return NextResponse.json({ error: 'ID em falta' }, { status: 400 })

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const db = createSupabaseAdmin()
  const { error } = await db
    .from('debts')
    .delete()
    .eq('id', id)
    .eq('user_id', internalId)

  if (error) {
    console.warn('[debts DELETE] failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ error: null })
}
