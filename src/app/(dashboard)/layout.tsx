import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createSupabaseAdmin } from '@/lib/supabase'
import { Sidebar }  from '@/components/layout/Sidebar'
import { TopBar }   from '@/components/layout/TopBar'
import { MobileNav } from '@/components/layout/MobileNav'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  // Check onboarding status directly in Supabase (bypasses JWT caching)
  const db = createSupabaseAdmin()
  const { data: user } = await db
    .from('users')
    .select('onboarding_completed')
    .eq('clerk_id', userId)
    .single()

  if (!user || !user.onboarding_completed) {
    redirect('/onboarding')
  }

  return (
    <div className="min-h-screen dashboard-bg flex">
      {/* Sidebar desktop */}
      <Sidebar />

      {/* Conteúdo principal */}
      <div className="flex-1 flex flex-col min-h-screen lg:ml-64">
        <TopBar />
        <main className="flex-1 px-4 md:px-6 py-6 pb-24 lg:pb-6 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>

      {/* Nav mobile (bottom) */}
      <MobileNav />
    </div>
  )
}
