import { auth }            from '@clerk/nextjs/server'
import { getUserProfile }  from '@/lib/userCache'
import BillingClient       from './BillingClient'

export const metadata = { title: 'Subscrição' }

export default async function BillingPage() {
  const { userId } = await auth()
  if (!userId) return null

  const profile = await getUserProfile(userId)
  const currentPlan = (profile?.plan ?? 'free') as 'free' | 'plus' | 'pro' | 'family'

  return <BillingClient currentPlan={currentPlan} />
}
