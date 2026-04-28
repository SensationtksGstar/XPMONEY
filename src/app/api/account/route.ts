import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin }  from '@/lib/supabase'
import { stripe }               from '@/lib/stripe'
import { isDemoMode }           from '@/lib/demo/demoGuard'

/**
 * DELETE /api/account — RGPD Art. 17 right-to-erasure.
 *
 * Wipes EVERYTHING tied to the user, in this order:
 *
 *   1. Stripe — cancel any active subscription IMMEDIATELY (`prorate: false`)
 *      and detach the customer record. We do NOT delete the Stripe customer
 *      object: that breaks invoice history Stripe is legally required to
 *      retain. Cancellation + clearing our reference is enough — the user
 *      no longer exists on our end.
 *   2. Supabase — delete the row from `users`. ON DELETE CASCADE on every
 *      child table (transactions, xp_history, financial_scores, missions,
 *      goals, voltix_states, accounts, categories, subscriptions, budgets,
 *      goal_deposits, push subs, bug_reports → SET NULL) does the rest.
 *   3. Clerk — delete the auth user. After this they can re-register from
 *      scratch with the same email; we treat them as new.
 *
 * Order matters: if Clerk deletion fails, we want the data already gone so
 * the user doesn't get a half-erased zombie account. If Supabase fails AFTER
 * Stripe cancellation, we still report failure but the subscription is gone
 * (preferable to keeping a paid sub on a "broken" account).
 *
 * Confirmation: requires `{ confirm: "APAGAR-CONTA" }` in the body — stronger
 * than the transaction-reset confirm because this is irreversible at every
 * layer.
 */
export async function DELETE(req: NextRequest) {
  if (isDemoMode()) {
    return NextResponse.json(
      { error: 'Não é possível apagar conta em modo demonstração.' },
      { status: 403 },
    )
  }

  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { confirm?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
  }
  if (body?.confirm !== 'APAGAR-CONTA') {
    return NextResponse.json(
      { error: 'Confirmação inválida. Envia { "confirm": "APAGAR-CONTA" }.' },
      { status: 400 },
    )
  }

  const db = createSupabaseAdmin()

  // Look up the Supabase row + any Stripe customer id BEFORE we delete the
  // user, otherwise we lose the link.
  const { data: user, error: lookupErr } = await db
    .from('users').select('id').eq('clerk_id', clerkId).maybeSingle()
  if (lookupErr) {
    console.warn('[account/delete] user lookup failed:', lookupErr)
    return NextResponse.json({ error: 'Falha a localizar utilizador.' }, { status: 500 })
  }

  let stripeCustomerId: string | null = null
  let stripeSubscriptionId: string | null = null
  if (user?.id) {
    const { data: sub } = await db
      .from('subscriptions')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('user_id', user.id)
      .maybeSingle()
    stripeCustomerId     = sub?.stripe_customer_id     ?? null
    stripeSubscriptionId = sub?.stripe_subscription_id ?? null
  }

  // ── 1. Stripe: cancel subscription ──────────────────────────────────────
  // `cancel` (not `update cancel_at_period_end`) — user asked to leave NOW.
  // No proration credit is issued (legal: terms accepted no-refund policy).
  if (stripeSubscriptionId) {
    try {
      await stripe.subscriptions.cancel(stripeSubscriptionId, {
        prorate: false,
      })
    } catch (err) {
      // Already-canceled / not-found subs throw — that's fine, idempotent.
      const msg = err instanceof Error ? err.message : String(err)
      if (!/no such subscription|already.*cancel/i.test(msg)) {
        console.warn('[account/delete] Stripe cancel failed (non-fatal):', msg)
      }
    }
  }

  // ── 2. Supabase: delete user → cascade wipes everything ─────────────────
  if (user?.id) {
    // Sweep referrals first. `users.referred_by` has no ON DELETE clause in
    // the schema → defaults to NO ACTION, which would block this delete if
    // anyone signed up via this user's referral code. Null them out so the
    // referees survive (their referral attribution is anonymised, not their
    // account).
    const { error: refErr } = await db
      .from('users').update({ referred_by: null }).eq('referred_by', user.id)
    if (refErr) {
      console.warn('[account/delete] referral cleanup failed (non-fatal):', refErr)
    }

    const { error: delErr } = await db
      .from('users').delete().eq('id', user.id)
    if (delErr) {
      console.error('[account/delete] users delete failed:', delErr)
      return NextResponse.json(
        { error: `Falha a apagar dados: ${delErr.message}` },
        { status: 500 },
      )
    }
  }

  // ── 3. Clerk: delete auth user ──────────────────────────────────────────
  // Doing this last: even if it fails (Clerk outage), the user's data is
  // already gone from our DB. They can contact support to clean up the
  // dangling auth record manually.
  try {
    const clerk = await clerkClient()
    await clerk.users.deleteUser(clerkId)
  } catch (err) {
    console.warn('[account/delete] Clerk delete failed (data already wiped):', err)
    return NextResponse.json({
      success: true,
      partial: true,
      warning: 'Dados apagados, mas a sessão de autenticação ficou pendente. Faz logout manualmente. Contacta o suporte se persistir.',
      stripeCustomerId,
    })
  }

  return NextResponse.json({
    success: true,
    stripeCustomerId,  // returned so the client can link to Stripe portal if user wants invoice history
  })
}
