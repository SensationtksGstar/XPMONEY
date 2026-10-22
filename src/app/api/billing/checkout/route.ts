import { auth, currentUser }      from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createCheckoutSession, createPassCheckoutSession, STRIPE_PRICES } from '@/lib/stripe'
import { createSupabaseAdmin }       from '@/lib/supabase'
import { isSubscriptionPremium, SUB_SNAPSHOT_COLS, type SubscriptionSnapshot } from '@/lib/plan'
import { getServerT }                from '@/lib/i18n/server'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { plan?: string; cycle?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }
  const { plan, cycle } = body
  if (!plan || !cycle) {
    return NextResponse.json({ error: 'Plano e ciclo são obrigatórios' }, { status: 400 })
  }

  const priceKey = `${plan}_${cycle}` // ex: premium_monthly
  const priceId  = STRIPE_PRICES[priceKey]

  // Diagnóstico explícito — antes devolvia só "Plano inválido" e o client
  // engolia o erro sem mostrar nada. Agora listamos o que está em falta.
  if (!priceId) {
    const expectedEnv = plan === 'premium'
      ? (cycle === 'pass'   ? 'STRIPE_PREMIUM_PASS_PRICE_ID'
       : cycle === 'yearly' ? 'STRIPE_PREMIUM_YEARLY_PRICE_ID'
       :                      'STRIPE_PREMIUM_MONTHLY_PRICE_ID')
      : '(plano desconhecido)'
    console.warn('[billing/checkout] missing price id for', priceKey, '— expected env:', expectedEnv)
    return NextResponse.json(
      { error: `Stripe price em falta (${priceKey}). Define a variável ${expectedEnv} no Vercel e re-deploy.` },
      { status: 500 },
    )
  }

  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('placeholder')) {
    return NextResponse.json(
      { error: 'STRIPE_SECRET_KEY não configurada no servidor. Contacta o suporte.' },
      { status: 500 },
    )
  }

  const user = await currentUser()
  const email = user?.emailAddresses[0]?.emailAddress ?? ''

  // maybeSingle() para não rebentar com PGRST116 em users sem row em users
  // (onboarding falhou, por exemplo)
  const db = createSupabaseAdmin()
  const { data: dbUser, error: dbErr } = await db
    .from('users').select('id').eq('clerk_id', userId).maybeSingle()

  if (dbErr) {
    console.warn('[billing/checkout] supabase lookup failed:', dbErr)
    return NextResponse.json(
      { error: `Falha ao localizar utilizador: ${dbErr.message}` },
      { status: 500 },
    )
  }
  if (!dbUser) {
    return NextResponse.json(
      { error: 'A tua conta ainda não está totalmente inicializada. Completa o onboarding primeiro.' },
      { status: 404 },
    )
  }

  // Guarda de checkout duplicado (sec-9): quem já tem uma subscrição viva não
  // abre um 2.º checkout de SUBSCRIÇÃO — o BillingClient só escondia os botões
  // no cliente (dois separadores / duplo clique bastavam), o Stripe criava um
  // Customer novo e o upsert onConflict user_id do webhook sobrescrevia o id da
  // 1.ª subscrição → dupla cobrança com uma subscrição órfã fora do Portal.
  // Mudar de ciclo, renovar (cancel_at_period_end) ou cancelar = Portal.
  // O Passe Anual continua permitido: é one-time e empilha premium_until.
  if (cycle !== 'pass') {
    const subRes = await db
      .from('subscriptions')
      .select(SUB_SNAPSHOT_COLS)
      .eq('user_id', dbUser.id)
      .maybeSingle()
    if (subRes.error) {
      // Tabela ausente (42P01/PGRST205) ou falha de leitura: não bloqueamos a
      // venda (comportamento anterior), mas fica registado.
      console.warn('[billing/checkout] subscription probe failed (continuing):', subRes.error)
    } else if (isSubscriptionPremium(subRes.data as SubscriptionSnapshot | null)) {
      const t = await getServerT()
      return NextResponse.json(
        { error: t('billing.err_already_subscribed'), code: 'already_subscribed' },
        { status: 409 },
      )
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  try {
    // Passe anual one-time (Multibanco/MB WAY/cartão) vs subscrição recorrente.
    // O passe volta para /settings/billing?pass=pending porque o Multibanco só
    // confirma 24-72h depois — a página avisa que o Premium ativa quando pagar.
    const session = cycle === 'pass'
      ? await createPassCheckoutSession({
          userId,
          internalUserId: dbUser.id,
          email,
          priceId,
          successUrl: `${appUrl}/settings/billing?pass=pending`,
          cancelUrl:  `${appUrl}/settings/billing`,
        })
      : await createCheckoutSession({
          userId,
          internalUserId: dbUser.id,
          email,
          priceId,
          successUrl: `${appUrl}/dashboard?upgraded=true`,
          cancelUrl:  `${appUrl}/settings/billing`,
        })

    if (!session.url) {
      return NextResponse.json(
        { error: 'Stripe devolveu sessão sem URL de checkout.' },
        { status: 500 },
      )
    }

    return NextResponse.json({ url: session.url })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[billing/checkout] Stripe error:', msg)
    return NextResponse.json(
      { error: `Falha ao criar sessão Stripe: ${msg}` },
      { status: 500 },
    )
  }
}
