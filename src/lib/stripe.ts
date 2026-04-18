import Stripe from 'stripe'
import type { Plan } from '@/types'

// Use fallback key so build doesn't fail when STRIPE_SECRET_KEY is not yet configured.
// Actual Stripe calls will return 401 until a real key is set in env vars.
export const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder_not_configured',
  { apiVersion: '2025-02-24.acacia', typescript: true }
)

// Mapeamento de planos para price IDs do Stripe.
//
// Model colapsado para 2 tiers: `free` + `premium`. Mantemos as duas
// cadências (monthly/yearly) para a equação "poupa ~33% no anual".
//
// Legacy fallback: se ainda existirem envs STRIPE_PLUS_*/STRIPE_PRO_*
// (de contas antigas que não foram recriadas), aceitamo-las como alias
// do premium para não partir assinaturas em produção durante a migração.
export const STRIPE_PRICES: Record<string, string> = {
  premium_monthly:
    process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID
    ?? process.env.STRIPE_PRO_MONTHLY_PRICE_ID
    ?? process.env.STRIPE_PLUS_MONTHLY_PRICE_ID
    ?? '',
  premium_yearly:
    process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID
    ?? process.env.STRIPE_PRO_YEARLY_PRICE_ID
    ?? process.env.STRIPE_PLUS_YEARLY_PRICE_ID
    ?? '',
}

export function getPlanFromPriceId(priceId: string): Plan {
  if (
    priceId === STRIPE_PRICES.premium_monthly
    || priceId === STRIPE_PRICES.premium_yearly
  ) return 'premium'
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
  // Sem trial. Não enviar `trial_period_days: 0` — Stripe rejeita com
  // "The minimum number of trial period days is 1". Omitir o campo é
  // a forma correcta de dizer "pagamento imediato sem trial".
  return stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { userId },
    subscription_data: {
      metadata: { userId },
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
