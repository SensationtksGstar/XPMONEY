import type { SupabaseClient } from '@supabase/supabase-js'
import { calculateFinancialScore } from '@/lib/gamification'
import { toNumber } from '@/lib/safeNumber'
import { awardXP } from '@/lib/awardXP'
import { updateMissionProgress } from '@/lib/updateMissionProgress'
import { activeDaysSince } from '@/lib/activeDays'
import {
  evoFromScore, evoBonusBetween,
  EVO_MIN_ACTIVE_DAYS, EVO_COOLDOWN_MS,
  type EvoStage,
} from '@/lib/mascotEvolution'
import type { FinancialScore } from '@/types'

/**
 * Recalculates the financial score for a given internal user id and persists
 * it to the financial_scores table.
 *
 * Uses an upsert-style insert (always inserts a new row with the current
 * timestamp) so the GET /api/score endpoint — which orders by calculated_at
 * descending — always returns the freshest value.
 *
 * @param db     - A Supabase admin client (server-side only)
 * @param userId - The internal (Supabase) user id, NOT the Clerk user id
 * @param opts.readyMissionIds - OUT array. Missions that this recalc pushed
 *   to their target (improve_score / categorize_all / reach_savings_goal) are
 *   appended here. recalculateScore NEVER pays mission XP itself: several
 *   callers run it inside a Promise.allSettled next to another awardXP, and
 *   two concurrent awardXP on xp_progress lose an update. The caller pays via
 *   completeReadyMissions() AFTER its batch. Callers that don't pass the array
 *   leave the missions "ready" (active, current=target) — they get paid by the
 *   next tick, the /missions claim button or the GET /api/missions expiry pass.
 * @returns      The newly persisted FinancialScore row, or null on failure
 */
export async function recalculateScore(
  db: SupabaseClient,
  userId: string,
  opts?: { readyMissionIds?: string[] },
): Promise<FinancialScore | null> {
  const now   = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split('T')[0]
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split('T')[0]

  // Fetch current-month transactions (with category) and active goals in parallel
  interface TxRow { amount: number | string; type: string; date: string; category_id: string | null }
  interface GoalRow { current_amount: number | string; target_amount: number | string; status: string }

  // The previous-score lookup depends only on userId — batching it here
  // instead of after calculateFinancialScore saves a round-trip on every
  // score recalc (which runs on every transaction create, the hottest write).
  const [txResult, goalsResult, prevResult] = await Promise.all([
    db
      .from('transactions')
      .select('amount, type, date, category_id')
      .eq('user_id', userId)
      .gte('date', start)
      .lte('date', end),
    db
      .from('goals')
      .select('current_amount, target_amount, status')
      .eq('user_id', userId)
      .eq('status', 'active'),
    db
      .from('financial_scores')
      .select('score')
      .eq('user_id', userId)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const txs   = (txResult.data   ?? []) as TxRow[]
  const goals = (goalsResult.data ?? []) as GoalRow[]

  const income  = txs
    .filter(t => t.type === 'income')
    .reduce((s, t) => s + toNumber(t.amount), 0)
  const expense = txs
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + toNumber(t.amount), 0)
  const savings = income - expense

  const daysWithTx        = new Set(txs.map(t => t.date)).size
  const goalsWithProgress = goals.filter(g => toNumber(g.current_amount) > 0).length

  // Build per-category expense map (key = category_id) for concentration analysis.
  const expenseByCategory: Record<string, number> = {}
  for (const t of txs) {
    if (t.type !== 'expense' || !t.category_id) continue
    expenseByCategory[t.category_id] =
      (expenseByCategory[t.category_id] ?? 0) + toNumber(t.amount)
  }

  const result = calculateFinancialScore({
    income_month:           income,
    expense_month:          expense,
    savings_this_month:     savings,
    days_with_transactions: daysWithTx,
    goals_with_progress:    goalsWithProgress,
    total_goals:            goals.length,
    expense_by_category:    expenseByCategory,
  })

  // Previous score (fetched in the batch above) determines the trend
  const prev = prevResult.data

  const trend = !prev
    ? 'stable'
    : result.score > prev.score
      ? 'up'
      : result.score < prev.score
        ? 'down'
        : 'stable'

  const { data: newScore, error } = await db
    .from('financial_scores')
    .insert({
      user_id:       userId,
      score:         result.score,
      breakdown:     result.breakdown,
      trend,
      calculated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.error('[recalculateScore] failed to persist score:', error.message)
    return null
  }

  // ── Mascot evolution side-effect ─────────────────────────────────────────
  // Evolution is monotonic: only UP, never down. Run after score insert so
  // the evo check always sees the freshest score. Failure here must not
  // block the score response — best-effort, logged but swallowed.
  try {
    await maybeEvolveMascot(db, userId, result.score)
  } catch (err) {
    console.warn('[recalculateScore] mascot evolution check failed:', err)
  }

  // ── Mission progress side-effects (all best-effort) ──────────────────────
  // Compute inputs once, fire the three mission triggers in parallel.
  const scoreDelta = prev ? Math.max(0, result.score - toNumber(prev.score, 0)) : 0
  const uncategorized = txs.filter(t => !t.category_id).length
  const savingsRate = income > 0 ? Math.max(0, (savings / income) * 100) : 0
  const missionTicks = await Promise.allSettled([
    // Only tick `improve_score` when the score actually went UP vs the previous
    // snapshot — otherwise a user could idle their way to completion.
    scoreDelta > 0
      ? updateMissionProgress(db, userId, { type: 'improve_score', score: scoreDelta })
      : Promise.resolve([] as string[]),
    updateMissionProgress(db, userId, { type: 'categorize_all', uncategorized }),
    updateMissionProgress(db, userId, { type: 'reach_savings_goal', savingsRate }),
  ])
  if (opts?.readyMissionIds) {
    for (const r of missionTicks) {
      if (r.status === 'fulfilled') opts.readyMissionIds.push(...r.value)
    }
  }

  return newScore as FinancialScore
}

/**
 * Compare the new score against stored `voltix_states.evolution_level` and
 * evolve when justified. Idempotent: called on every score recalculation.
 *
 * Pacing (julho 2026 — o dono reportou uma conta de teste a saltar do ovo
 * para a 3ª forma com UM registo; uma receita única satura poupança+controlo
 * = ~51 pts ≥ threshold 38):
 *   1. UM nível por evento — nunca saltar formas (cada evolução é um momento
 *      com direito a cinematic; o alvo é min(desbloqueado, atual+1)).
 *   2. Cooldown de 20 h entre evoluções, lido do xp_history (reason
 *      `mascot_evolved_to_%` — sem DDL novo). O hatch 1→2 é isento: a
 *      primeira dopamina deve aterrar no próprio dia 1.
 *   3. Evidência mínima de uso (EVO_MIN_ACTIVE_DAYS): dias distintos REAIS
 *      de atividade, lidos do ledger xp_history (daily_login +
 *      transaction_registered, dia em Europe/Lisbon) via activeDaysSince().
 *      NUNCA transactions.date — essa data vem do extrato/cliente e um
 *      import de 3 meses saltava o requisito num só dia (outubro 2026).
 * O score continua a ser condição necessária e o requisito exibido na UI;
 * quando já chega mas o ritmo trava, o mascotSpeak diz "sinto a próxima
 * forma a chegar" em vez de prometer pontos.
 */
async function maybeEvolveMascot(
  db: SupabaseClient,
  userId: string,
  score: number,
): Promise<void> {
  const { data: vx } = await db
    .from('voltix_states')
    .select('evolution_level')
    .eq('user_id', userId)
    .maybeSingle()

  if (!vx) return

  const currentEvo = Math.max(1, Math.min(6, vx.evolution_level ?? 1)) as EvoStage
  const unlocked   = evoFromScore(score)

  if (unlocked <= currentEvo) return

  // 1. Um nível por vez — o bónus abaixo passa a ser sempre o de UM passo.
  const targetEvo = Math.min(unlocked, currentEvo + 1) as EvoStage

  // 2. Cooldown entre evoluções (hatch isento — não há evolução anterior
  //    que justifique travar o primeiro momento).
  //    A coluna do xp_history é `earned_at` (schema.sql) — até outubro 2026
  //    isto lia `created_at`, o PostgREST devolvia 42703, o erro era
  //    descartado e o cooldown NUNCA atuava. Erro agora = fail closed.
  if (currentEvo > 1) {
    const { data: lastEvo, error: lastEvoErr } = await db
      .from('xp_history')
      .select('earned_at')
      .eq('user_id', userId)
      .like('reason', 'mascot_evolved_to_%')
      .order('earned_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (lastEvoErr) {
      console.warn('[maybeEvolveMascot] cooldown probe failed:', lastEvoErr.message)
      return
    }
    if (lastEvo?.earned_at &&
        Date.now() - new Date(lastEvo.earned_at).getTime() < EVO_COOLDOWN_MS) {
      return
    }
  }

  // 3. Evidência de uso real para a forma alvo (targetEvo ≥ 2 aqui — é
  //    currentEvo+1 com currentEvo ≥ 1; o cast só encolhe o tipo).
  //    O hatch 1→2 continua isento: EVO_MIN_ACTIVE_DAYS[2] = 0 (e o
  //    cooldown acima só corre com currentEvo > 1).
  const minDays = EVO_MIN_ACTIVE_DAYS[targetEvo as Exclude<EvoStage, 1>]
  if (minDays > 0 &&
      (await activeDaysSince(db, userId, { stopAt: minDays })) < minDays) return

  // Bump evolution_level in voltix_states. NÃO escreve last_interaction:
  // esse campo é o relógio do streak e só o daily-checkin o pode mexer
  // (uma evolução num dia novo antes do check-in fazia-o cair no ramo
  // "mesmo dia" e o streak não subia).
  const { error: updateErr } = await db
    .from('voltix_states')
    .update({ evolution_level: targetEvo })
    .eq('user_id', userId)

  if (updateErr) {
    console.warn('[maybeEvolveMascot] voltix_states update failed:', updateErr.message)
    return
  }

  // XP bonus do passo dado (com o pacing de +1, é sempre um único estágio)
  const bonus = evoBonusBetween(currentEvo, targetEvo)
  if (bonus > 0) {
    await awardXP(db, userId, bonus, `mascot_evolved_to_${targetEvo}`)
  }
}
