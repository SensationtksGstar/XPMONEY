import { auth }              from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin }       from '@/lib/supabase'
import { resolveUser }               from '@/lib/resolveUser'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const db = createSupabaseAdmin()

  const { data: deleted, error } = await db
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', internalId) // garante que só apaga as suas próprias
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Reverter o XP do registo quando algo foi mesmo apagado — sem isto,
  // criar+apagar em loop era XP infinito (achado da auditoria). Revertemos
  // o valor BASE (15): num registo que calhou crítico o user fica com o
  // bónus, mas o farm deixa de ser rentável (esperança de lucro por ciclo
  // ≈ +2 XP com fricção de 2 requests — morto na prática). Clamp a 0 e
  // best-effort: falhar o revert nunca falha o delete.
  if (deleted && deleted.length > 0) {
    try {
      const { data: xp } = await db
        .from('xp_progress')
        .select('xp_total')
        .eq('user_id', internalId)
        .maybeSingle()
      if (xp) {
        const revert   = Math.min(15, xp.xp_total ?? 0)
        if (revert > 0) {
          const now = new Date().toISOString()
          await Promise.allSettled([
            db.from('xp_progress')
              .update({ xp_total: (xp.xp_total ?? 0) - revert, updated_at: now })
              .eq('user_id', internalId),
            db.from('xp_history').insert({
              user_id: internalId, amount: -revert,
              reason: 'transaction_deleted', earned_at: now,
            }),
          ])
        }
      }
    } catch (err) {
      console.warn('[tx-delete] XP revert failed:', err)
    }
  }

  return NextResponse.json({ success: true })
}
