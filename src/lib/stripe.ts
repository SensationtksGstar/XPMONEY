import Stripe from 'stripe'
import type { Plan } from '@/types'

// Use fallback key so build doesn't fail when STRIPE_SECRET_KEY is not yet configured.
// Actual Stripe calls will return 401 until a real key is set in env vars.
export const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder_not_configured',
  { apiVersion: '2025-02-24.acacia', typescript: true }
)

// Mapeamento de planos para price IDs do Stripe
export const STRIPE_PRICES: Record<string, string> = {
  plus_monthly:  process.env.STRIPE_PLUS_MONTHLY_PRICE_ID ?? '',
  plus_yearly:   process.env.STRIPE_PLUS_YEARLY_PRICE_ID ?? '',
  pro_monthly:   process.env.STRIPE_PRO_MONTHLY_PRICE_ID ?? '',
  pro_yearly:    process.env.STRIPE_PRO_YEARLY_PRICE_ID ?? '',
}

export function getPlanFromPriceId(priceId: string): Plan {
  if (priceId === STRIPE_PRICES.plus_monthly || priceId === STRIPE_PRICES.plus_yearly) return 'plus'
  if (priceId === STRIPE_PRICES.pro_monthly  || priceId === STRIPE_PRICES.pro_yearly)  return 'pro'
  return 'free'
}

// Criar checkout session para upgrade
export async function createCheckoutSession({
  userId,
  email,
  priceId,
  successUrl,
  cancelUrl,
}: {
  userId: string
  email: string
  priceId: string
  successUrl: string
  cancelUrl: string
}) {
  return stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { userId },
    subscription_data: {
      metadata: { userId },
      trial_period_days: 0,
    },
    allow_promotion_codes: true,
  })
}

// Criar portal de gestão de subscrição
export async function createBillingPortalSession({
  stripeCustomerId,
  returnUrl,
}: {
  stripeCustomerId: string
  returnUrl: string
}) {
  return stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  })
}
