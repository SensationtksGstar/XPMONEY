import { auth }               from '@clerk/nextjs/server'
import { redirect }           from 'next/navigation'
import { createSupabaseAdmin } from '@/lib/supabase'
import { PremiumFeatureLock } from '@/components/common/PremiumFeatureLock'
import { getServerT }          from '@/lib/i18n/server'
import { isDemoMode }          from '@/lib/demo/demoGuard'
import { fetchPlanRow }        from '@/lib/plan'
import { toNumber }            from '@/lib/safeNumber'
import SimuladorClient         from './SimuladorClient'

// Safe helper — refuses to enable on production unless ALLOW_DEMO_IN_PROD
// is also set. Never read NEXT_PUBLIC_DEMO_MODE directly for auth bypasses.
const DEMO_MODE = isDemoMode()

export const metadata = { title: 'Simulador de Investimento' }

// Force dynamic — plan check must always be fresh (no stale cache)
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SimuladorPage() {
  const { userId } = DEMO_MODE ? { userId: null } : await auth()
  if (!DEMO_MODE && !userId) redirect('/sign-in')

  const db = createSupabaseAdmin()

  // Direct DB query — never cached — ensures paywall sees authoritative plan.
  // fetchPlanRow resolves the EFFECTIVE plan (isPremiumActive respects the
  // Annual Pass premium_until expiry; legacy plus/pro/family still count).
  // Skipped in demo mode (no Clerk session, so nothing to look up; demo
  // visitors are always treated as free-plan to trigger the teaser lock).
  const profile = DEMO_MODE
    ? { id: null as string | null, isPremium: false }
    : await fetchPlanRow(db, 'clerk_id', userId as string)

  if (!profile) redirect('/dashboard')

  // Paywall: simulador só para Premium
  if (!profile.isPremium) {
    const t = await getServerT()
    return (
      <PremiumFeatureLock
        icon="sparkles"
        title={t('simulator.lock.title')}
        description={t('simulator.lock.desc')}
        bullets={[
          t('simulator.lock.b1'),
          t('simulator.lock.b2'),
          t('simulator.lock.b3'),
          t('simulator.lock.b4'),
        ]}
        preview={<FauxChartPreview />}
      />
    )
  }

  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
  const dateStr = threeMonthsAgo.toISOString().split('T')[0]

  const { data: txData } = await db
    .from('transactions')
    .select('amount, type')
    .eq('user_id', profile.id!)
    .gte('date', dateStr)

  // toNumber: Supabase numeric columns come back as strings — a bare `+`
  // here would concatenate instead of summing.
  const totalIncome   = txData?.filter(t => t.type === 'income').reduce((s, t) => s + toNumber(t.amount), 0)   ?? 0
  const totalExpenses = txData?.filter(t => t.type === 'expense').reduce((s, t) => s + toNumber(t.amount), 0)  ?? 0
  const avgMonthlySavings = Math.max(0, (totalIncome - totalExpenses) / 3)

  return <SimuladorClient suggestedMonthly={Math.round(avgMonthlySavings)} />
}

/**
 * FauxChartPreview — stylised SVG that reads as a growth chart when blurred.
 * Used only as backdrop for the PremiumFeatureLock; no interaction, no data.
 */
function FauxChartPreview() {
  return (
    <div className="w-full h-full p-8">
      <div className="w-full h-full rounded-2xl bg-gradient-to-br from-purple-500/15 via-emerald-500/10 to-transparent p-8 flex flex-col gap-6">
        {/* KPIs row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { v: '€ 42.8k', l: 'Aos 10 anos' },
            { v: '€ 128k',  l: 'Aos 20 anos' },
            { v: '€ 312k',  l: 'Aos 30 anos' },
          ].map((k, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="text-2xl font-bold text-white">{k.v}</div>
              <div className="text-xs text-white/50 mt-1">{k.l}</div>
            </div>
          ))}
        </div>
        {/* Fake growth curve */}
        <svg viewBox="0 0 400 180" className="w-full flex-1">
          <defs>
            <linearGradient id="sim-curve" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%"   stopColor="#a78bfa" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0,160 C80,150 140,120 200,90 C260,60 320,35 400,15 L400,180 L0,180 Z" fill="url(#sim-curve)" />
          <path d="M0,160 C80,150 140,120 200,90 C260,60 320,35 400,15" stroke="#a78bfa" strokeWidth="3" fill="none" />
        </svg>
      </div>
    </div>
  )
}
