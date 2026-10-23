/**
 * Matemática pura do XP (out. 2026) — sem IO e SEM imports de runtime, para
 * correr em `node --experimental-strip-types scripts/check-xp.mjs`.
 *
 * É o espelho TS do que a função SQL `award_xp` faz numa só transação
 * (database/award_xp_rpc_2026_10.sql): somar o delta com clamp a 0 (o CHECK
 * xp_total >= 0 da tabela) e recalcular o nível pelos mesmos limiares de
 * `LEVELS` (src/types/index.ts). O awardXP usa-a no caminho de fallback
 * (função SQL ainda não criada) e o check-xp.mjs garante que os limiares do
 * SQL, do TS e este algoritmo nunca divergem.
 *
 * ⚠️ Só `import type` aqui — um import de runtime com alias `@/…` parte o
 * script de verificação.
 */

/** Teto do INTEGER do Postgres — o xp_total nunca pode passar daqui. */
export const XP_TOTAL_MAX = 2_147_483_647

/**
 * Nível para um XP total, dados os limiares `xp_required` por ordem
 * crescente (nível 1 = índice 0). Mesmo resultado que `getLevelFromXP`
 * (gamification.ts) e que `xp_level_for` no SQL: o nível é o número de
 * limiares ≤ XP (os níveis são contíguos 1..N), com piso 1.
 */
export function levelForXP(totalXP: number, thresholds: readonly number[]): number {
  const xp = Number.isFinite(totalXP) ? totalXP : 0
  let level = 0
  for (const req of thresholds) {
    if (xp >= req) level += 1
    else break
  }
  return Math.max(1, level)
}

export interface XPDeltaResult {
  /** Delta REAL aplicado (pode ser menor em módulo que o pedido por causa do clamp). */
  xp_gained:      number
  xp_total:       number
  level:          number
  previous_level: number
  leveled_up:     boolean
}

/**
 * Aplica um delta (positivo = ganho, negativo = reversão) a um estado de XP.
 * Clamp a [0, XP_TOTAL_MAX]; nível recalculado a partir do total novo.
 * `previousLevel` é o nível guardado na row (null → derivado do total antigo).
 */
export function applyXPDelta(
  oldTotal:      number,
  previousLevel: number | null | undefined,
  amount:        number,
  thresholds:    readonly number[],
): XPDeltaResult {
  const base     = Number.isFinite(oldTotal) && oldTotal > 0 ? Math.floor(oldTotal) : 0
  const delta    = Number.isFinite(amount) ? Math.trunc(amount) : 0
  const newTotal = Math.min(XP_TOTAL_MAX, Math.max(0, base + delta))
  const prev     = typeof previousLevel === 'number' && Number.isFinite(previousLevel) && previousLevel >= 1
    ? previousLevel
    : levelForXP(base, thresholds)
  const level    = levelForXP(newTotal, thresholds)
  return {
    xp_gained:      newTotal - base,
    xp_total:       newTotal,
    level,
    previous_level: prev,
    leveled_up:     level > prev,
  }
}

/**
 * Erros do `db.rpc('award_xp', …)` que significam "a função não está
 * utilizável" e em que NADA foi escrito — aqui é seguro cair para o caminho
 * antigo (read-modify-write):
 *   - PGRST202: o PostgREST não encontra a função (migração por correr, ou
 *     cache de schema ainda por recarregar);
 *   - 42883: undefined_function no Postgres;
 *   - 42501: insufficient_privilege (GRANT em falta) — a função nem correu.
 * Qualquer outro erro NÃO cai para o fallback: um erro dentro da função faz
 * rollback (nada escrito, devolvemos null), e um erro de rede é ambíguo —
 * repetir pelo outro caminho podia pagar a dobrar.
 */
export function isRpcUnavailable(err: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!err) return false
  const code = err.code ?? ''
  if (code === 'PGRST202' || code === '42883' || code === '42501') return true
  // Algumas versões do PostgREST não preenchem `code` neste caso.
  const msg = (err.message ?? '').toLowerCase()
  return msg.includes('could not find the function') && msg.includes('award_xp')
}
