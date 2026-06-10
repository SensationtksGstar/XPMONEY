import { auth }            from '@clerk/nextjs/server'
import { getUserProfile }  from '@/lib/userCache'
import BillingClient       from './BillingClient'

export const metadata = { title: 'Subscrição' }

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ pass?: string }>
}) {
  const { userId } = await auth()
  if (!userId) return null

  const passPending = (await searchParams).pass === 'pending'
  const profile = await getUserProfile(userId)
  // isPremium = subscrição OU passe anual ativo (cobre legacy plus/pro/family).
  const currentPlan: 'free' | 'premium' = profile?.isPremium ? 'premium' : 'free'
  // Data de expiração do passe (se for utilizador de passe, não subscrição) —
  // mostrada no BillingClient em vez do botão "Gerir subscrição".
  const premiumUntil = profile?.premiumUntil ?? null

  return <BillingClient currentPlan={currentPlan} premiumUntil={premiumUntil} passPending={passPending} />
}
