import { auth }              from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin }       from '@/lib/supabase'
import { resolveUser }               from '@/lib/resolveUser'
import { revertXP }                  from '@/lib/awardXP'
import { XP_REWARDS }                from '@/types'

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
  // best-effort: falhar o revert nunca falha o delete. Vai pelo MESMO
  // caminho do awardXP (RPC atómico award_xp com delta negativo, fallback
  // read-modify-write) — o nível passa a acompanhar o xp_total.
  if (deleted && deleted.length > 0) {
    const reverted = await revertXP(
      db, internalId, XP_REWARDS.TRANSACTION_REGISTERED, 'transaction_deleted',
    )
    if (!reverted) console.warn('[tx-delete] XP revert skipped/failed for', internalId)
  }

  return NextResponse.json({ success: true })
}
