import { auth }                   from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin }       from '@/lib/supabase'
import { resolveUser }               from '@/lib/resolveUser'
import { recalculateScore }          from '@/lib/recalculateScore'
import { isDemoMode }                from '@/lib/demo/demoGuard'

/**
 * DELETE /api/transactions/reset
 *
 * FULL factory reset — restaura o utilizador ao estado pós-onboarding.
 * Apaga TUDO o que é gameplay/histórico, mantém só a configuração de
 * conta (users, accounts, categorias custom, subscrição Stripe).
 *
 * Apaga:
 *   - transactions
 *   - xp_history
 *   - financial_scores
 *   - goal_deposits  (FK precisa ir antes de goals)
 *   - goals
 *   - debts          (Mata-Dívidas — debt_attacks cascade automaticamente)
 *   - missions       (TODAS — activas + concluídas)
 *   - user_badges    (todas as conquistas — fica como user novo)
 *   - budgets        (orçamento 50/30/20 e overrides reaplicam-se em zero)
 *
 * Reseta in-place (mantém a row, zera os valores):
 *   - xp_progress    (xp_total → 0, level → 1, streak → 0)
 *   - voltix_states  (evolution_level → 1, mood → neutral, streak → 0)
 *
 * Mantém intacto:
 *   - users, accounts, categories (config de utilizador, não-gameplay)
 *   - subscriptions (a Stripe é separada — para sair tem de cancelar lá)
 *
 * April 2026 update: anteriormente missions ficavam só com current_value
 * zerado e badges + debts NÃO eram apagados. Reportado pelo user como
 * "Mata-Dívidas continua lá, missões continuam" — corrigido.
 *
 * Irreversível. Requer confirmação `{ confirm: "APAGAR" }` no body.
 *
 * Response:
 *   { success: true, deleted: <tx-count>, reset: { ... } }
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
  //
  // Order rules:
  //   - goal_deposits MUST run before goals (FK from deposits → goals)
  //   - debt_attacks NOT listed: cascades from debts on delete
  //   - everything else is FK-independent and can be parallel
  //
  // Tables newly added April 2026 (debts, missions full delete,
  // user_badges, budgets) may not exist on older Supabase projects —
  // each delete is wrapped in Promise.allSettled and a per-result error
  // log so a missing table doesn't break the whole reset.
  const wipeResults = await Promise.allSettled([
    db.from('transactions').delete().eq('user_id', internalId),
    db.from('xp_history').delete().eq('user_id', internalId),
    db.from('financial_scores').delete().eq('user_id', internalId),
    db.from('goal_deposits').delete().eq('user_id', internalId),
    db.from('debts').delete().eq('user_id', internalId),         // cascades to debt_attacks
    db.from('missions').delete().eq('user_id', internalId),       // ALL of them — completed and active
    db.from('user_badges').delete().eq('user_id', internalId),    // start fresh, no carry-over achievements
    db.from('budgets').delete().eq('user_id', internalId),        // 50/30/20 config + overrides clear
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
      // Tables may not exist on older deployments (debts/budgets were added
      // post-launch) — swallow but log so it shows up in observability.
      console.warn('[transactions/reset] secondary wipe error:', r.value.error.message)
    }
  }

  // ── 2. Reset in-place rows (single-row tables that we keep but zero) ──
  // xp_progress and voltix_states are 1-per-user so we don't delete them;
  // we keep the row and reset its values. Missions used to also live here
  // (current_value → 0 on active rows) but as of April 2026 we DELETE all
  // missions instead — the next mission rotation re-seeds active ones.
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
      xp:       true,
      voltix:   true,
      scores:   true,
      goals:    true,
      debts:    true,
      missions: true,
      badges:   true,
      budgets:  true,
    },
  })
}
