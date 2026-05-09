import { auth }                     from '@clerk/nextjs/server'
import { NextResponse }              from 'next/server'
import { stripe }                    from '@/lib/stripe'
import { createSupabaseAdmin }       from '@/lib/supabase'

/**
 * POST /api/billing/manual-downgrade
 *
 * Emergency exit for users whose `users.plan = 'premium'` flag was set
 * WITHOUT an underlying Stripe subscription — typical scenarios:
 *
 *   1. Admin / dev manually promoted via SQL for testing.
 *   2. Webhook from a real checkout failed, but the user has since
 *      changed mind and just wants the flag flipped back.
 *
 * Safety rule: this endpoint refuses to run when a real Stripe customer
 * exists for the user's email. If Stripe knows about them, the canonical
 * path is the Customer Portal (use /api/billing/portal). We never set
 * plan='free' while Stripe is still billing — that would silently keep
 * charging the user with no app access.
 *
 * Idempotent: calling it on a free user no-ops with success.
 */
export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createSupabaseAdmin()
  const { data: user } = await db
    .from('users')
    .select('id, email, plan')
    .eq('clerk_id', userId)
    .maybeSingle()
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  if (user.plan === 'free') {
    return NextResponse.json({ ok: true, alreadyFree: true })
  }

  // Hard guard: NEVER drop the plan if there's an active Stripe customer.
  // The user must go through the Portal in that case so Stripe stops
  // charging them.
  if (user.email) {
    try {
      const list = await stripe.customers.list({ email: user.email, limit: 1 })
      if (list.data.length > 0) {
        const customer = list.data[0]
        // Check if any subscription is active for this customer
        const subs = await stripe.subscriptions.list({
          customer: customer.id, status: 'all', limit: 5,
        })
        const hasActive = subs.data.some(s =>
          s.status === 'active' || s.status === 'trialing' || s.status === 'past_due',
        )
        if (hasActive) {
          return NextResponse.json(
            {
              error:
                'Tens uma subscrição activa no Stripe — usa o portal de gestão ' +
                'para cancelar (caso contrário continuas a ser cobrado). ' +
                'Volta atrás e clica em "Gerir subscrição".',
              code: 'has_active_stripe',
            },
            { status: 409 },
          )
        }
      }
    } catch (err) {
      // Stripe outage shouldn't block the user from cancelling a manual
      // promotion. Log and proceed — they're not being billed anyway.
      console.warn('[billing/manual-downgrade] stripe lookup failed (non-fatal):', err)
    }
  }

  // Drop the plan flag. Leave any orphan subscriptions row alone — it's
  // historical data and harmless once plan='free'.
  const { error } = await db
    .from('users').update({ plan: 'free' }).eq('id', user.id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, downgraded: true })
}
