import type { SupabaseClient } from '@supabase/supabase-js'
import { calculateFinancialScore } from '@/lib/gamification'
import { toNumber } from '@/lib/safeNumber'
import { awardXP } from '@/lib/awardXP'
import { evoFromScore, evoBonusBetween, type EvoStage } from '@/lib/mascotEvolution'
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
 * @returns      The newly persisted FinancialScore row, or null on failure
 */
export async function recalculateScore(
  db: SupabaseClient,
  userId: string,
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

  const [txResult, goalsResult] = await Promise.all([
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

  // Fetch previous score to determine trend
  const { data: prev } = await db
    .from('financial_scores')
    .select('score')
    .eq('user_id', userId)
    .order('calculated_at', { ascending: false })
    .limit(1)
    .single()

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

  return newScore as FinancialScore
}

/**
 * Compare the new score against stored `voltix_states.evolution_level`. If
 * the score unlocks a higher stage, bump the stored stage and award the
 * cumulative XP bonus for each stage gained. Idempotent: called on every
 * score recalculation, but only writes when there's an actual jump up.
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
    .single()

  if (!vx) return

  const currentEvo = Math.max(1, Math.min(6, vx.evolution_level ?? 1)) as EvoStage
  const targetEvo  = evoFromScore(score)

  if (targetEvo <= currentEvo) return

  // Bump evolution_level in voltix_states
  const { error: updateErr } = await db
    .from('voltix_states')
    .update({
      evolution_level:  targetEvo,
      last_interaction: new Date().toISOString(),
    })
    .eq('user_id', userId)

  if (updateErr) {
    console.warn('[maybeEvolveMascot] voltix_states update failed:', updateErr.message)
    return
  }

  // Award cumulative XP bonus (multiple stages gained = all bonuses sum)
  const bonus = evoBonusBetween(currentEvo, targetEvo)
  if (bonus > 0) {
    await awardXP(db, userId, bonus, `mascot_evolved_to_${targetEvo}`)
  }
}
