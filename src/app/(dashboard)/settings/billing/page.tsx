import { auth }              from '@clerk/nextjs/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import BillingClient           from './BillingClient'

export const metadata = { title: 'Subscrição' }

export default async function BillingPage() {
  const { userId } = await auth()
  if (!userId) return null

  const db = createSupabaseAdmin()
  const { data: profile } = await db
    .from('users')
    .select('plan')
    .eq('clerk_id', userId)
    .single()

  const currentPlan = (profile?.plan ?? 'free') as 'free' | 'plus' | 'pro' | 'family'

  return <BillingClient currentPlan={currentPlan} />
}
