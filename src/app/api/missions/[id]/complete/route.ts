import { auth }              from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin }       from '@/lib/supabase'
import { recalculateScore }          from '@/lib/recalculateScore'
import { resolveUser }               from '@/lib/resolveUser'
import { guardUser }                 from '@/lib/rateLimit'
import { completeMission }           from '@/lib/missions/complete'
import { completeReadyMissions }     from '@/lib/updateMissionProgress'

/**
 * Claim manual de uma missão (caminho "tap to collect" / legacy).
 *
 * Outubro 2026: delega em completeMission() — exige progresso no alvo,
 * reclama com update condicional e paga via awardXP com o reason
 * `mission_completed:<id>` (idempotente). Antes pagava QUALQUER missão
 * 'active' a 0 % (farm por curl) e recusava as auto-concluídas (quem jogava
 * honestamente nunca recebia o XP).
 *
 * Missões legacy já 'completed' devolvem {already:true} — o pagamento delas
 * é exclusivo do backfill SQL (não há claim atómico possível em código).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const limited = await guardUser(internalId, 'mission-complete', [
    { limit: 20, windowMs: 60 * 60 * 1000 },
  ], { error: 'Too many requests', code: 'rate_limited' })
  if (limited) return limited

  const db = createSupabaseAdmin()

  const r = await completeMission(db, internalId, id)

  if (r.status === 'not_found') {
    return NextResponse.json({ error: 'Mission not found' }, { status: 404 })
  }
  if (r.status === 'not_ready') {
    return NextResponse.json({ error: 'Mission not ready', code: 'mission_not_ready' }, { status: 409 })
  }
  if (r.status === 'error') {
    return NextResponse.json({ error: 'Mission payout failed', code: 'mission_payout_failed' }, { status: 500 })
  }
  if (r.status === 'already') {
    return NextResponse.json({ already: true, xp: 0 })
  }

  // Recalculate financial score after mission completion — best-effort.
  // Missões que este recálculo leve ao alvo são pagas a seguir, em série.
  try {
    const readyIds: string[] = []
    await recalculateScore(db, internalId, { readyMissionIds: readyIds })
    if (readyIds.length > 0) await completeReadyMissions(db, internalId, readyIds)
  } catch (err) {
    console.warn('[missions/complete] score recalc failed:', err)
  }

  return NextResponse.json({ xp: r.xp })
}
