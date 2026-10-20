import type { SupabaseClient } from '@supabase/supabase-js'
import { toNumber } from '@/lib/safeNumber'
import { awardXP }  from '@/lib/awardXP'

/**
 * Pagamento ÚNICO e idempotente do XP de uma missão (outubro 2026).
 *
 * Antes havia dois bugs que se anulavam ao contrário do que devia:
 *   - updateMissionProgress punha status='completed' ao atingir o alvo e o
 *     /complete recusava 'Already completed' → quem jogava honestamente
 *     nunca recebia o XP;
 *   - o /complete pagava QUALQUER missão 'active' sem verificar progresso
 *     (nem condição de status no update) → farm de ~650 XP/ciclo por curl.
 *
 * Agora há um só caminho de pagamento, chamado pelo POST /api/transactions,
 * pelo daily-checkin, pelo GET /api/missions (expiração) e pelo /complete:
 *   1. progresso tem de estar no alvo (current_value >= target_value);
 *   2. missões 'active' são reclamadas com um update CONDICIONAL
 *      (.eq('status','active')) — só quem muda a row paga, por isso dois
 *      pedidos concorrentes nunca pagam duas vezes;
 *   3. a probe ao ledger (`mission_completed:<id>` no xp_history) corre
 *      depois do claim, como segunda guarda;
 *   4. se o pagamento falhar antes de escrever, o claim é libertado
 *      (volta a 'active') para o próximo tick tentar de novo.
 * Missões legacy que ficaram 'completed' sem pagamento (o bug antigo) NÃO
 * são pagas aqui — só pelo backfill SQL (atómico). Ver o comentário no
 * corpo da função.
 * O XP passa sempre por awardXP (regra do repo — nunca read-modify-write
 * inline do xp_progress).
 */

export type CompleteMissionStatus = 'paid' | 'already' | 'not_ready' | 'not_found' | 'error'

export interface CompleteMissionResult {
  status:  CompleteMissionStatus
  xp:      number
  mission?: { id: string; type: string; target_value: number }
}

export function missionXpReason(missionId: string): string {
  return `mission_completed:${missionId}`
}

export async function completeMission(
  db:        SupabaseClient,
  userId:    string,
  missionId: string,
): Promise<CompleteMissionResult> {
  if (!userId || !missionId) return { status: 'not_found', xp: 0 }

  const { data: mission, error } = await db
    .from('missions')
    .select('id, status, current_value, target_value, xp_reward, expires_at, type')
    .eq('id', missionId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.warn('[completeMission] fetch failed:', error.message)
    return { status: 'error', xp: 0 }
  }
  if (!mission) return { status: 'not_found', xp: 0 }

  const target  = toNumber(mission.target_value, 1)
  const current = toNumber(mission.current_value, 0)
  const info    = { id: mission.id as string, type: mission.type as string, target_value: target }

  // 'expired'/'locked' nunca pagam (o farm antigo também aceitava 'expired').
  if (mission.status !== 'active' && mission.status !== 'completed') {
    return { status: 'not_ready', xp: 0, mission: info }
  }
  if (current < target) return { status: 'not_ready', xp: 0, mission: info }

  // Legacy 'completed' (o bug antigo deixou-as concluídas sem pagamento) NÃO
  // são pagas por código: não há transição de status atómica que as
  // reclame, e uma probe ao ledger seguida de awardXP é check-then-act —
  // N pedidos concorrentes passavam todos na probe e pagavam N vezes. O
  // pagamento delas é só o backfill SQL (database/backfill_missions_xp_2026_10.sql),
  // que é um único INSERT … WHERE NOT EXISTS atómico.
  if (mission.status === 'completed') return { status: 'already', xp: 0, mission: info }

  const reward = Math.max(0, Math.round(toNumber(mission.xp_reward, 0)))
  const reason = missionXpReason(mission.id as string)

  // Claim atómico: só o pedido que efetivamente muda a row segue para o
  // pagamento. Se 0 rows, outro pedido concorrente ganhou o claim e é ele
  // que paga — devolvemos 'already' sem tocar no ledger.
  const { data: claimed, error: claimErr } = await db
    .from('missions')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', missionId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .select('id')
  if (claimErr) {
    console.warn('[completeMission] claim failed:', claimErr.message)
    return { status: 'error', xp: 0, mission: info }
  }
  if (!claimed || claimed.length === 0) return { status: 'already', xp: 0, mission: info }

  // Guarda do ledger — cobre um pagamento anterior que tenha escrito o
  // xp_history e depois sido revertido (ver releaseClaim). limit(1) porque o
  // race antigo do /complete pode ter deixado rows duplicadas (maybeSingle
  // rebentaria com >1).
  const { data: paidRow, error: paidErr } = await db
    .from('xp_history')
    .select('id')
    .eq('user_id', userId)
    .eq('reason', reason)
    .limit(1)
    .maybeSingle()
  if (paidErr) {
    // Fail closed: sem confirmar o ledger, não pagamos (evita duplo
    // pagamento) — mas libertamos o claim para o próximo tick tentar.
    console.warn('[completeMission] ledger probe failed:', paidErr.message)
    await releaseClaim(db, userId, missionId)
    return { status: 'error', xp: 0, mission: info }
  }
  if (paidRow) return { status: 'already', xp: 0, mission: info }

  if (reward <= 0) return { status: 'paid', xp: 0, mission: info }

  const res = await awardXP(db, userId, reward, reason)
  if (!res) {
    // awardXP só devolve null ANTES de escrever (sem row xp_progress ou
    // exceção na leitura) → nada foi pago. Libertamos o claim: a missão
    // volta a 'active' no alvo e o próximo tick (updateMissionProgress
    // devolve-a em readyIds, o GET das vencidas, ou o botão de resgate)
    // tenta de novo. Sem isto ficaria 'completed' por pagar para sempre.
    console.warn(`[completeMission] awardXP returned null for ${missionId}`)
    await releaseClaim(db, userId, missionId)
    return { status: 'error', xp: 0, mission: info }
  }
  return { status: 'paid', xp: res.xp_gained, mission: info }
}

/**
 * Desfaz o claim de um pagamento que falhou ANTES de pagar: 'completed' →
 * 'active'. Só este pedido pode ter feito o claim (o update condicional é
 * exclusivo) e nenhum outro caminho de código toca em missões 'completed',
 * por isso reverter não abre nenhum duplo pagamento — o próximo claim volta
 * a ser exclusivo e a probe ao ledger continua a correr antes do awardXP.
 */
async function releaseClaim(db: SupabaseClient, userId: string, missionId: string): Promise<void> {
  const { error } = await db
    .from('missions')
    .update({ status: 'active', completed_at: null })
    .eq('id', missionId)
    .eq('user_id', userId)
    .eq('status', 'completed')
  if (error) console.warn(`[completeMission] release claim failed for ${missionId}:`, error.message)
}
