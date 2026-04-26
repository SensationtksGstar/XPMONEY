import { auth }                     from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { stripe }                    from '@/lib/stripe'
import { createSupabaseAdmin }       from '@/lib/supabase'

/**
 * POST /api/billing/portal
 *
 * Creates a Stripe Customer Portal session and returns the URL. The user
 * lands on Stripe's hosted portal where they can:
 *   - Cancel the subscription (immediate or at period end)
 *   - Update card details
 *   - Download invoices
 *   - Switch billing cycle (monthly ↔ yearly) if Portal is configured
 *     to allow it
 *
 * Requirements:
 *   - User must be signed in
 *   - User must have a `stripe_customer_id` recorded (set when their
 *     first checkout completed via the Stripe webhook)
 *   - The Customer Portal must be enabled in the Stripe Dashboard
 *     under Settings → Billing → Customer Portal. One-time setup.
 *
 * Why Portal and not a custom cancel UI:
 *   - Compliance: Stripe owns the payment relationship; we shouldn't
 *     be the source of truth for "what's my next charge / how do I
 *     cancel" — Stripe is.
 *   - Less code, fewer states to QA.
 *   - VAT-compliant invoice downloads come for free.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('placeholder')) {
    return NextResponse.json(
      { error: 'STRIPE_SECRET_KEY não configurada no servidor.' },
      { status: 500 },
    )
  }

  const db = createSupabaseAdmin()
  const { data: user } = await db
    .from('users')
    .select('id')
    .eq('clerk_id', userId)
    .maybeSingle()
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const { data: sub } = await db
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!sub?.stripe_customer_id) {
    return NextResponse.json(
      {
        error:
          'Não encontrámos uma subscrição activa. Se acabaste de pagar, ' +
          'aguarda alguns segundos e tenta novamente — ou contacta o suporte.',
      },
      { status: 404 },
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer:   sub.stripe_customer_id,
      return_url: `${appUrl}/settings/billing`,
    })
    return NextResponse.json({ url: session.url })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[billing/portal] Stripe error:', msg)

    // The most common failure here is "Stripe customer portal is not
    // configured" — surface it clearly so the operator knows where to
    // flip the switch in the Stripe Dashboard.
    const friendly = msg.includes('No configuration provided')
      ? 'O portal de gestão Stripe ainda não está configurado. ' +
        'Activa-o em https://dashboard.stripe.com/settings/billing/portal e tenta de novo.'
      : `Falha ao abrir portal Stripe: ${msg}`

    return NextResponse.json({ error: friendly }, { status: 500 })
  }
}
