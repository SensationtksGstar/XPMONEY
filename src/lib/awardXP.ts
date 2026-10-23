import type { SupabaseClient } from '@supabase/supabase-js'
import { LEVELS } from '@/types'
import { toNumber } from '@/lib/safeNumber'
import { applyXPDelta, isRpcUnavailable } from '@/lib/xpLevel'

export interface AwardXPResult {
  xp_gained:    number
  xp_total:     number
  level:        number
  leveled_up:   boolean
  previous_level: number
}

/** Limiares `xp_required` por nível, na ordem de LEVELS (o SQL tem a mesma lista). */
const LEVEL_THRESHOLDS: readonly number[] = LEVELS.map(l => l.xp_required)

// ── Disponibilidade do RPC atómico ─────────────────────────────────────────
// Até o dono correr database/award_xp_rpc_2026_10.sql a função não existe e
// cada chamada devolveria PGRST202. Depois do 1.º miss saltamos o RPC durante
// RPC_RETRY_MS (poupa uma ida à BD por award) e voltamos a tentar — assim a
// instância passa sozinha para o caminho atómico pouco depois da migração,
// sem esperar por um cold start. O aviso sai uma vez por instância.
const RPC_RETRY_MS = 5 * 60 * 1000
let rpcSkipUntil   = 0
let rpcWarned      = false

type RpcOutcome =
  | { kind: 'ok'; result: AwardXPResult | null }
  | { kind: 'unavailable' }

/**
 * Chama `award_xp(p_user_id, p_amount, p_reason)`: numa só transação faz
 * lock da row xp_progress, soma o delta (clamp a 0), recalcula o nível,
 * insere no xp_history e devolve o estado novo. Devolve `unavailable` só
 * quando a função não pode ter corrido (nada escrito → fallback seguro).
 */
async function awardViaRpc(
  db:     SupabaseClient,
  userId: string,
  amount: number,
  reason: string,
): Promise<RpcOutcome> {
  if (Date.now() < rpcSkipUntil) return { kind: 'unavailable' }

  const { data, error } = await db.rpc('award_xp', {
    p_user_id: userId,
    p_amount:  amount,
    p_reason:  reason,
  })

  if (error) {
    if (isRpcUnavailable(error)) {
      rpcSkipUntil = Date.now() + RPC_RETRY_MS
      if (!rpcWarned) {
        rpcWarned = true
        console.warn(
          '[awardXP] RPC award_xp indisponível — a usar o caminho read-modify-write ' +
          '(correr database/award_xp_rpc_2026_10.sql):', error.code, error.message,
        )
      }
      return { kind: 'unavailable' }
    }
    // Erro DENTRO da função → rollback, nada escrito. Erro de rede → ambíguo:
    // não repetimos pelo outro caminho para não pagar a dobrar.
    console.warn('[awardXP] RPC award_xp failed:', error.code, error.message)
    return { kind: 'ok', result: null }
  }

  // RETURNS TABLE → array; 0 rows = o user não tem row em xp_progress.
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null | undefined
  if (!row) return { kind: 'ok', result: null }

  const level         = toNumber(row.new_level, 1)
  const previousLevel = toNumber(row.previous_level, level)
  return {
    kind: 'ok',
    result: {
      xp_gained:      toNumber(row.xp_gained, 0),
      xp_total:       toNumber(row.new_xp_total, 0),
      level,
      previous_level: previousLevel,
      leveled_up:     level > previousLevel,
    },
  }
}

/**
 * Caminho antigo (pré-migração): lê, soma e escreve. NÃO é atómico — dois
 * awards concorrentes podem perder um incremento. Só corre enquanto a função
 * SQL não existe. Devolve null antes de escrever quando não há row.
 */
async function awardViaReadModifyWrite(
  db:     SupabaseClient,
  userId: string,
  amount: number,
  reason: string,
): Promise<AwardXPResult | null> {
  const { data: xp, error: readErr } = await db
    .from('xp_progress')
    .select('xp_total, level')
    .eq('user_id', userId)
    .maybeSingle()

  if (readErr) {
    console.warn('[awardXP] xp_progress read failed:', readErr.message)
    return null
  }
  if (!xp) return null

  const next = applyXPDelta(toNumber(xp.xp_total, 0), xp.level ?? null, amount, LEVEL_THRESHOLDS)
  // Reversão sem nada para tirar (xp_total já a 0) → nada a escrever.
  if (next.xp_gained === 0) return next

  const now = new Date().toISOString()
  // Nas reversões não mexemos em last_activity_at (é o sinal de DAU/MAU do
  // /admin/metrics — apagar um movimento não é atividade). Igual ao SQL.
  const progressPatch: Record<string, unknown> = {
    xp_total:   next.xp_total,
    level:      next.level,
    updated_at: now,
  }
  if (amount > 0) progressPatch.last_activity_at = now

  // Run both writes in parallel — xp_history failure must not block xp_progress
  const [updateRes, historyRes] = await Promise.allSettled([
    db.from('xp_progress').update(progressPatch).eq('user_id', userId),
    db.from('xp_history').insert({
      user_id:   userId,
      amount:    next.xp_gained,
      reason,
      earned_at: now,
    }),
  ])

  // supabase-js resolve com { error } em vez de rejeitar — verificar os dois.
  let updateFailed  = false
  let historyFailed = false
  if (updateRes.status === 'rejected') {
    updateFailed = true
    console.warn('[awardXP] xp_progress update failed:', updateRes.reason)
  } else if (updateRes.value.error) {
    updateFailed = true
    console.warn('[awardXP] xp_progress update failed:', updateRes.value.error.message)
  }
  if (historyRes.status === 'rejected') {
    historyFailed = true
    console.warn('[awardXP] xp_history insert failed:', historyRes.reason)
  } else if (historyRes.value.error) {
    historyFailed = true
    console.warn('[awardXP] xp_history insert failed:', historyRes.value.error.message)
  }

  // As duas escritas falharam → não ficou nem o total nem o ledger: nada foi
  // pago. null deixa o chamador repetir (missions/complete.ts liberta o claim).
  // Se só uma falhou, o total ou o ledger já refletem o pagamento — devolver
  // null aqui levaria um retry a pagar a dobrar.
  if (updateFailed && historyFailed) return null

  return next
}

async function applyXP(
  db:     SupabaseClient,
  userId: string,
  amount: number,
  reason: string,
): Promise<AwardXPResult | null> {
  try {
    const viaRpc = await awardViaRpc(db, userId, amount, reason)
    if (viaRpc.kind === 'ok') return viaRpc.result
    return await awardViaReadModifyWrite(db, userId, amount, reason)
  } catch (err) {
    console.warn('[awardXP] unexpected error:', err)
    return null
  }
}

/**
 * Centralised XP-award helper.
 *
 * - Caminho principal (out. 2026): RPC `award_xp` — incremento ATÓMICO no
 *   Postgres (lock da row + xp_total = xp_total + amount + nível + ledger numa
 *   só transação). Awards concorrentes no mesmo pedido (transação + badge +
 *   bónus de evolução) ou entre pedidos (after() do check-in, GET de missões)
 *   já não perdem incrementos.
 * - Fallback enquanto a migração database/award_xp_rpc_2026_10.sql não corre:
 *   o read-modify-write antigo (com console.warn uma vez por instância).
 * - Never throws — returns `null` on any error (XP is best-effort by design).
 *   `null` significa "pagamento NÃO confirmado", não "nada foi pago":
 *     · sem row xp_progress, erro dentro da função SQL (rollback) ou, no
 *       fallback, leitura falhada / as duas escritas falhadas → nada escrito;
 *     · erro de rede/timeout no RPC depois de o Postgres ter feito commit →
 *       o XP e a row do xp_history PODEM ter ficado escritos.
 *   Um chamador que repete depois de null TEM de consultar primeiro o
 *   xp_history pela reason (como completeMission faz com
 *   `mission_completed:<id>`), senão pode pagar a dobrar.
 * - Detects level-ups and returns the previous level so callers can trigger
 *   celebration modals.
 *
 * @param db        Supabase admin client (server-side only)
 * @param userId    Internal Supabase user id (NOT Clerk id)
 * @param amount    XP to add (must be positive — negative values are ignored;
 *                  para tirar XP usa `revertXP`)
 * @param reason    Short tag for xp_history (e.g. `transaction_registered`)
 * @returns         AwardXPResult on success, `null` if user has no xp_progress row
 */
export async function awardXP(
  db:     SupabaseClient,
  userId: string,
  amount: number,
  reason: string,
): Promise<AwardXPResult | null> {
  const n = Number.isFinite(amount) ? Math.trunc(amount) : 0
  if (!userId || n <= 0) return null
  return applyXP(db, userId, n, reason)
}

/**
 * Retira XP pelo MESMO caminho do awardXP (RPC atómico, fallback RMW), com
 * clamp a 0: nunca tira mais do que o user tem, e o xp_history regista o
 * delta REAL (negativo). Usado pelo DELETE de transação (reversão dos 15 XP).
 * `xp_gained` vem negativo (ou 0 quando já não havia nada para tirar).
 *
 * @param amount  XP a retirar, em valor POSITIVO (ex.: 15)
 */
export async function revertXP(
  db:     SupabaseClient,
  userId: string,
  amount: number,
  reason: string,
): Promise<AwardXPResult | null> {
  const n = Number.isFinite(amount) ? Math.trunc(amount) : 0
  if (!userId || n <= 0) return null
  return applyXP(db, userId, -n, reason)
}
