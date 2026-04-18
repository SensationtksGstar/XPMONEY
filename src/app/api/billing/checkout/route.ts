import { auth, currentUser }      from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createCheckoutSession, STRIPE_PRICES } from '@/lib/stripe'
import { createSupabaseAdmin }       from '@/lib/supabase'

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
      ? (cycle === 'yearly' ? 'STRIPE_PREMIUM_YEARLY_PRICE_ID' : 'STRIPE_PREMIUM_MONTHLY_PRICE_ID')
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  try {
    const session = await createCheckoutSession({
      userId,
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
