import { Suspense }         from 'react'
import { auth }              from '@clerk/nextjs/server'
import { redirect }          from 'next/navigation'
import { createSupabaseAdmin } from '@/lib/supabase'
import { Sidebar }          from '@/components/layout/Sidebar'
import { TopBar }           from '@/components/layout/TopBar'
import { MobileNav }        from '@/components/layout/MobileNav'
import { UserPlanProvider } from '@/lib/contexts/UserPlanContext'
import { MascotEvolutionWatcher } from '@/components/voltix/MascotEvolutionWatcher'
// FAB lazy-loaded behind a tiny client wrapper — Next.js 15 forbids
// `dynamic({ssr:false})` in server components, and this layout is one.
// Same ~25 KB gzipped saving as before, just routed through the wrapper.
import { DragonCoinFABLazy } from '@/components/common/DragonCoinFABLazy'

// Force dynamic — plan must always be authoritative, never cached
export const dynamic = 'force-dynamic'
export const revalidate = 0

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

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

    // Direct DB query — never cached — prevents stale plan from blocking premium access
    const db = createSupabaseAdmin()
    const { data: user } = await db
      .from('users')
      .select('id, plan, onboarding_completed')
      .eq('clerk_id', userId)
      .single()

    if (!user || !user.onboarding_completed) {
      redirect('/onboarding')
    }

    // Legacy tiers (plus/pro/family) mapeiam para 'premium' no novo modelo.
    const raw = user.plan ?? 'free'
    plan = raw === 'free' ? 'free' : 'premium'
  }

  return (
    <UserPlanProvider plan={plan}>
      <div className="min-h-screen dashboard-bg flex overflow-x-hidden">
        {/* Sidebar desktop */}
        <Sidebar />

        {/* Conteúdo principal */}
        <div className="flex-1 flex flex-col min-h-screen lg:ml-64 min-w-0">
          <TopBar />
          <main className="flex-1 px-4 md:px-6 py-6 pb-24 lg:pb-6 max-w-7xl mx-auto w-full min-w-0 overflow-x-hidden">
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
    </UserPlanProvider>
  )
}
