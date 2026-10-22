import { auth }            from '@clerk/nextjs/server'
import { getUserProfile }  from '@/lib/userCache'
import { isPremiumActive } from '@/lib/plan'
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
  // mostrada no BillingClient em vez do botão "Gerir subscrição". Só quando o
  // passe ainda corre E não há subscrição viva: quem tem um passe EXPIRADO e
  // subscreveu (ou subscrição + passe) precisa do botão do Portal, não de uma
  // data passada. (`?? isPremiumActive` cobre entradas do unstable_cache
  // gravadas antes destes campos existirem — TTL 5 min pós-deploy.)
  const passActive = profile?.passActive
    ?? (!!profile?.premiumUntil && isPremiumActive(profile.plan, profile.premiumUntil))
  const premiumUntil = passActive && !profile?.hasActiveSubscription
    ? (profile?.premiumUntil ?? null)
    : null

  return <BillingClient currentPlan={currentPlan} premiumUntil={premiumUntil} passPending={passPending} />
}
