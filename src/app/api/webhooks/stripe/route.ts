import { NextRequest, NextResponse } from 'next/server'
import { stripe, getPlanFromPriceId } from '@/lib/stripe'
import { createSupabaseAdmin }         from '@/lib/supabase'
import Stripe                          from 'stripe'

export async function POST(req: NextRequest) {
  const body      = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const db = createSupabaseAdmin()

  switch (event.type) {

    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.CheckoutSession
      const userId  = session.metadata?.userId
      if (!userId) break

      const { data: user } = await db
        .from('users').select('id').eq('clerk_id', userId).single()
      if (!user) break

      const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
      const priceId      = subscription.items.data[0]?.price.id
      const plan         = getPlanFromPriceId(priceId)

      await db.from('subscriptions').upsert({
        user_id:                user.id,
        stripe_customer_id:     session.customer as string,
        stripe_subscription_id: subscription.id,
        plan,
        status:                 subscription.status,
        current_period_end:     new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end:   subscription.cancel_at_period_end,
        updated_at:             new Date().toISOString(),
      })

      await db.from('users').update({ plan }).eq('id', user.id)
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const { data: sub } = await db
        .from('subscriptions')
        .select('user_id')
        .eq('stripe_subscription_id', subscription.id)
        .single()
      if (!sub) break

      const priceId = subscription.items.data[0]?.price.id
      const plan    = getPlanFromPriceId(priceId)

      await db.from('subscriptions').update({
        plan,
        status:               subscription.status,
        current_period_end:   new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end,
        updated_at:           new Date().toISOString(),
      }).eq('stripe_subscription_id', subscription.id)

      await db.from('users').update({ plan }).eq('id', sub.user_id)
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const { data: sub } = await db
        .from('subscriptions')
        .select('user_id')
        .eq('stripe_subscription_id', subscription.id)
        .single()
      if (!sub) break

      await db.from('subscriptions').update({
        plan:       'free',
        status:     'canceled',
        updated_at: new Date().toISOString(),
      }).eq('stripe_subscription_id', subscription.id)

      await db.from('users').update({ plan: 'free' }).eq('id', sub.user_id)
      break
    }

    default:
      // Eventos não tratados — ignorar silenciosamente
      break
  }

  return NextResponse.json({ received: true })
}
