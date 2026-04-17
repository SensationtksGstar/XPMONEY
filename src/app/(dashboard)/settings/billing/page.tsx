import { auth }            from '@clerk/nextjs/server'
import { getUserProfile }  from '@/lib/userCache'
import BillingClient       from './BillingClient'

export const metadata = { title: 'Subscrição' }

export default async function BillingPage() {
  const { userId } = await auth()
  if (!userId) return null

  const profile = await getUserProfile(userId)
  // Normaliza legacy plus/pro/family -> premium no novo modelo 2-tier.
  const raw = profile?.plan ?? 'free'
  const currentPlan: 'free' | 'premium' = raw === 'free' ? 'free' : 'premium'

  return <BillingClient currentPlan={currentPlan} />
}
