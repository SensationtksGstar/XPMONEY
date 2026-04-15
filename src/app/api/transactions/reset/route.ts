import { auth }                   from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin }       from '@/lib/supabase'
import { resolveUser }               from '@/lib/resolveUser'
import { recalculateScore }          from '@/lib/recalculateScore'
import { isDemoMode }                from '@/lib/demo/demoGuard'

/**
 * DELETE /api/transactions/reset
 *
 * Wipes every transaction for the authenticated user and recalculates the
 * financial score. Irreversible.
 *
 * Body (optional):
 *   { confirm: "APAGAR" }   – extra typed confirmation (defensive)
 */
export async function DELETE(req: NextRequest) {
  if (isDemoMode()) {
    return NextResponse.json(
      { error: 'Não é possível apagar em modo de demonstração.' },
      { status: 403 },
    )
  }

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Defensive: require typed confirmation in the body
  try {
    const body = await req.json().catch(() => ({} as { confirm?: string }))
    if (body?.confirm !== 'APAGAR') {
      return NextResponse.json(
        { error: 'Confirmação inválida. Envia { "confirm": "APAGAR" }.' },
        { status: 400 },
      )
    }
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const db = createSupabaseAdmin()

  // Count first so we can report how many were wiped
  const { count: before } = await db
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', internalId)

  const { error } = await db
    .from('transactions')
    .delete()
    .eq('user_id', internalId)

  if (error) {
    console.error('[transactions/reset] delete failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Rebuild the financial score from the (now empty) transaction set so the
  // dashboard reflects reality on next refetch. Non-blocking failure — if the
  // score recompute errors we still succeeded the delete.
  try {
    await recalculateScore(db, internalId)
  } catch (err) {
    console.warn('[transactions/reset] recalc failed (non-fatal):', err)
  }

  return NextResponse.json({
    success: true,
    deleted: before ?? 0,
  })
}
