import { auth, currentUser }      from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createCheckoutSession, STRIPE_PRICES } from '@/lib/stripe'
import { createSupabaseAdmin }       from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { plan, cycle } = await req.json()
  const priceKey = `${plan}_${cycle}` // ex: plus_monthly
  const priceId  = STRIPE_PRICES[priceKey]

  if (!priceId) {
    return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })
  }

  const user = await currentUser()
  const email = user?.emailAddresses[0]?.emailAddress ?? ''

  const db = createSupabaseAdmin()
  const { data: dbUser } = await db
    .from('users').select('id').eq('clerk_id', userId).single()

  if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const session = await createCheckoutSession({
    userId,
    email,
    priceId,
    successUrl: `${appUrl}/dashboard?upgraded=true`,
    cancelUrl:  `${appUrl}/settings/billing`,
  })

  return NextResponse.json({ url: session.url })
}
