import { auth }            from '@clerk/nextjs/server'
import { redirect }         from 'next/navigation'
import { createSupabaseAdmin } from '@/lib/supabase'
import { Sidebar }          from '@/components/layout/Sidebar'
import { TopBar }           from '@/components/layout/TopBar'
import { MobileNav }        from '@/components/layout/MobileNav'
import { UserPlanProvider } from '@/lib/contexts/UserPlanContext'

// Force dynamic — plan must always be authoritative, never cached
export const dynamic = 'force-dynamic'
export const revalidate = 0

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let plan: 'free' | 'plus' | 'pro' | 'family' = 'pro'

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

    plan = (user.plan ?? 'free') as 'free' | 'plus' | 'pro' | 'family'
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
      </div>
    </UserPlanProvider>
  )
}
