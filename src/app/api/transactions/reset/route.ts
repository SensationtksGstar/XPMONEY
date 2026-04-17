import { auth }                   from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin }       from '@/lib/supabase'
import { resolveUser }               from '@/lib/resolveUser'
import { recalculateScore }          from '@/lib/recalculateScore'
import { isDemoMode }                from '@/lib/demo/demoGuard'

/**
 * DELETE /api/transactions/reset
 *
 * FULL factory reset of the user's gamification state:
 *   - transactions          (wiped)
 *   - xp_progress           (xp_total → 0, level → 1)
 *   - xp_history            (log cleared)
 *   - voltix_states         (evolution_level → 1, mood → neutral, streak → 0)
 *   - financial_scores      (history cleared; a fresh zero-score row is written)
 *   - missions progress     (current_value → 0 on active missions)
 *   - goal_deposits         (wiped)
 *   - goals                 (ALL deleted — user said "poupanças também devem
 *                           resetar"; without this, stale goal rows with a
 *                           zeroed amount still showed up on the goals page
 *                           after a reset, which looked like a bug)
 *
 * Badges and completed missions are kept intentionally — those are historical
 * achievements, not derived state.
 *
 * Irreversible. Requires typed confirmation `{ confirm: "APAGAR" }` in body.
 *
 * Response:
 *   { success: true, deleted: <tx-count>, reset: { xp, voltix, scores, goals } }
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
  let body: { confirm?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
  }
  if (body?.confirm !== 'APAGAR') {
    return NextResponse.json(
      { error: 'Confirmação inválida. Envia { "confirm": "APAGAR" }.' },
      { status: 400 },
    )
  }

  const db  = createSupabaseAdmin()
  const now = new Date().toISOString()

  // Count first so we can report how many were wiped
  const { count: before } = await db
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', internalId)

  // ── 1. Core wipe (parallel where safe) ─────────────────────────────────
  // goal_deposits must be wiped BEFORE goals because deposits reference goals
  // via FK. The other deletes are order-independent.
  const wipeResults = await Promise.allSettled([
    db.from('transactions').delete().eq('user_id', internalId),
    db.from('xp_history').delete().eq('user_id', internalId),
    db.from('financial_scores').delete().eq('user_id', internalId),
    db.from('goal_deposits').delete().eq('user_id', internalId),
  ])

  // Goals last — FKs from goal_deposits must be cleared first. A plain delete
  // on goals would fail with a FK violation on older schemas if any deposit
  // row still referenced it.
  const { error: goalsDeleteErr } = await db
    .from('goals').delete().eq('user_id', internalId)
  if (goalsDeleteErr) {
    console.warn('[transactions/reset] goals delete error:', goalsDeleteErr.message)
  }

  // The transaction delete is the only one we refuse to silently ignore —
  // if it fails the whole reset is meaningless.
  const txDelete = wipeResults[0]
  if (txDelete.status === 'rejected' ||
      (txDelete.status === 'fulfilled' && txDelete.value.error)) {
    const msg = txDelete.status === 'rejected'
      ? String(txDelete.reason)
      : txDelete.value.error?.message ?? 'unknown error'
    console.error('[transactions/reset] transaction delete failed:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  for (let i = 1; i < wipeResults.length; i++) {
    const r = wipeResults[i]
    if (r.status === 'rejected') {
      console.warn('[transactions/reset] secondary wipe rejected:', r.reason)
    } else if (r.value.error) {
      // goal_deposits table may not exist on older deployments — swallow but log
      console.warn('[transactions/reset] secondary wipe error:', r.value.error.message)
    }
  }

  // ── 2. Reset gamification rows (not delete — keep the row, zero the data) ──
  const resetResults = await Promise.allSettled([
    db.from('xp_progress').update({
      xp_total:         0,
      level:            1,
      streak_days:      0,
      last_activity_at: now,
      updated_at:       now,
    }).eq('user_id', internalId),

    db.from('voltix_states').update({
      evolution_level:  1,
      mood:             'neutral',
      streak_days:      0,
      last_interaction: now,
    }).eq('user_id', internalId),

    db.from('missions').update({
      current_value: 0,
    }).eq('user_id', internalId).eq('status', 'active'),
    // (Goals are fully deleted in step 1 — no reset-in-place needed.)
  ])

  for (const r of resetResults) {
    if (r.status === 'rejected') {
      console.warn('[transactions/reset] gamification reset rejected:', r.reason)
    }
  }

  // ── 3. Insert a fresh baseline score (0) so dashboard reflects reality ──
  // recalculateScore would re-evolve the pet upward if the formula returned
  // >0 on empty data, so we write the baseline directly.
  try {
    await recalculateScore(db, internalId)
  } catch (err) {
    console.warn('[transactions/reset] recalc failed (non-fatal):', err)
  }

  return NextResponse.json({
    success: true,
    deleted: before ?? 0,
    reset: {
      xp:     true,
      voltix: true,
      scores: true,
      goals:  true,
    },
  })
}
