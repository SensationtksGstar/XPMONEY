import type { SupabaseClient } from '@supabase/supabase-js'
import { calculateFinancialScore } from '@/lib/gamification'
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

  // Fetch current-month transactions and active goals in parallel
  const [txResult, goalsResult] = await Promise.all([
    db
      .from('transactions')
      .select('amount, type, date')
      .eq('user_id', userId)
      .gte('date', start)
      .lte('date', end),
    db
      .from('goals')
      .select('current_amount, target_amount, status')
      .eq('user_id', userId)
      .eq('status', 'active'),
  ])

  const txs   = txResult.data   ?? []
  const goals = goalsResult.data ?? []

  const income  = txs
    .filter((t: { type: string }) => t.type === 'income')
    .reduce((s: number, t: { amount: number }) => s + t.amount, 0)
  const expense = txs
    .filter((t: { type: string }) => t.type === 'expense')
    .reduce((s: number, t: { amount: number }) => s + t.amount, 0)
  const savings = income - expense

  const daysWithTx        = new Set(txs.map((t: { date: string }) => t.date)).size
  const goalsWithProgress = (goals as { current_amount: number }[])
    .filter(g => g.current_amount > 0).length

  const result = calculateFinancialScore({
    income_month:                income,
    expense_month:               expense,
    savings_this_month:          savings,
    days_with_transactions:      daysWithTx,
    goals_with_progress:         goalsWithProgress,
    total_goals:                 goals.length,
    budget_overspent_categories: 0, // TODO: calculate with budgets
    total_categories_used:       new Set(
      txs.map((t: { type: string }) => t.type)
    ).size,
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

  return newScore as FinancialScore
}
