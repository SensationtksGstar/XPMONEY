import { Suspense }         from 'react'
import { auth }              from '@clerk/nextjs/server'
import { redirect }          from 'next/navigation'
import { createSupabaseAdmin } from '@/lib/supabase'
import { fetchPlanRow }       from '@/lib/plan'
import { Sidebar }          from '@/components/layout/Sidebar'
import { TopBar }           from '@/components/layout/TopBar'
import { MobileNav }        from '@/components/layout/MobileNav'
import { UserPlanProvider } from '@/lib/contexts/UserPlanContext'
import { isDemoMode }       from '@/lib/demo/demoGuard'
import { PeriodProvider }   from '@/lib/contexts/PeriodContext'
import { MascotEvolutionWatcher } from '@/components/voltix/MascotEvolutionWatcher'
// FAB lazy-loaded behind a tiny client wrapper — Next.js 15 forbids
// `dynamic({ssr:false})` in server components, and this layout is one.
// Same ~25 KB gzipped saving as before, just routed through the wrapper.
import { DragonCoinFABLazy } from '@/components/common/DragonCoinFABLazy'

// Force dynamic — plan must always be authoritative, never cached
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Safe helper — refuses to enable on production unless ALLOW_DEMO_IN_PROD
// is also set. Never read NEXT_PUBLIC_DEMO_MODE directly for auth bypasses.
const DEMO_MODE = isDemoMode()

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Demo mode serves a Free-plan experience on purpose — visitors should
  // get a taste of the free tier and see lockpalm on Premium features
  // so the landing funnel makes sense. A "logged-in demo" that had full
  // Premium access was confusing: visitors downloaded everything they'd
  // otherwise pay for, with no nudge to convert.
  let plan: 'free' | 'premium' = 'free'

  if (!DEMO_MODE) {
    const { userId } = await auth()
    if (!userId) redirect('/sign-in')

    // Direct DB query — never cached — prevents stale plan from blocking premium access.
    // fetchPlanRow resolves the effective plan (subscription OR unexpired Annual
    // Pass) and degrades gracefully if premium_until isn't migrated yet.
    const db   = createSupabaseAdmin()
    const user = await fetchPlanRow(db, 'clerk_id', userId)

    if (!user || !user.onboarding_completed) {
      redirect('/onboarding')
    }

    // isPremium covers subscription premium, an active one-time pass, and the
    // legacy plus/pro/family aliases (all non-'free' → premium).
    plan = user.isPremium ? 'premium' : 'free'
  }

  return (
    <UserPlanProvider plan={plan}>
      <PeriodProvider>
      <div className="min-h-screen dashboard-bg flex overflow-x-hidden">
        {/* Sidebar desktop */}
        <Sidebar />

        {/* Conteúdo principal */}
        <div className="flex-1 flex flex-col min-h-screen lg:ml-64 min-w-0">
          <TopBar />
          {/* px-* alone wasn't enough on landscape iPhone with the notch
              on the side — content drifted under the safe-area inset and
              read as "off-centre" to one user. Adding safe-area-inset-*
              to the side padding centers correctly on every device
              orientation. The calc keeps the existing px-4/md:px-6 as a
              floor so non-notched devices look the same as before. */}
          <main
            className="flex-1 py-6 pb-24 lg:pb-6 max-w-7xl mx-auto w-full min-w-0 overflow-x-hidden"
            style={{
              paddingLeft:  'max(env(safe-area-inset-left), 1rem)',
              paddingRight: 'max(env(safe-area-inset-right), 1rem)',
            }}
          >
            {children}
          </main>
        </div>

        {/* Nav mobile (bottom) */}
        <MobileNav />

        {/* Global: fires Digimon-style cinematic when the mascot evolves.
            Wrapped in Suspense because it reads searchParams (dev preview). */}
        <Suspense fallback={null}>
          <MascotEvolutionWatcher />
        </Suspense>

        {/* Persistent Dragon Coin chat FAB — available across the dashboard. */}
        <DragonCoinFABLazy />
      </div>
      </PeriodProvider>
    </UserPlanProvider>
  )
}
