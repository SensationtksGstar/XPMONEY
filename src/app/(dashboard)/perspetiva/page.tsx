import { auth }               from '@clerk/nextjs/server'
import { redirect }           from 'next/navigation'
import { createSupabaseAdmin } from '@/lib/supabase'
import { Crown }               from 'lucide-react'
import Link                    from 'next/link'
import PerspectivaClient       from './PerspectivaClient'

export const metadata = { title: 'Perspetiva de Riqueza' }

export default async function PerspectivaPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const db = createSupabaseAdmin()

  // Check plan
  const { data: profile } = await db
    .from('users')
    .select('plan, id')
    .eq('clerk_id', userId)
    .single()

  if (!profile) redirect('/dashboard')

  // Paywall for non-pro users
  if (profile.plan !== 'pro' && profile.plan !== 'family') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="text-6xl mb-4">👑</div>
        <h1 className="text-2xl font-bold text-white mb-2">Funcionalidade Pro</h1>
        <p className="text-white/50 max-w-md mb-6">
          A <strong className="text-white">Perspetiva de Riqueza</strong> está disponível exclusivamente no plano Pro.
          Compara o teu salário com celebridades e descobre o custo real das tuas despesas.
        </p>
        <Link
          href="/settings/billing"
          className="flex items-center gap-2 bg-purple-500 hover:bg-purple-400 text-white font-bold px-6 py-3 rounded-xl transition-all"
        >
          <Crown className="w-5 h-5" />
          Fazer upgrade para Pro
        </Link>
      </div>
    )
  }

  // Fetch average monthly income (last 3 months)
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

  const { data: incomeData } = await db
    .from('transactions')
    .select('amount, date')
    .eq('user_id', profile.id)
    .eq('type', 'income')
    .gte('date', threeMonthsAgo.toISOString().split('T')[0])
    .order('date', { ascending: false })

  const totalIncome3M = incomeData?.reduce((s, t) => s + t.amount, 0) ?? 0
  const monthlyIncome = totalIncome3M / 3

  // Fetch last 10 expenses
  const { data: recentExpenses } = await db
    .from('transactions')
    .select('id, description, amount, date, category:categories(name, icon, color)')
    .eq('user_id', profile.id)
    .eq('type', 'expense')
    .order('date', { ascending: false })
    .limit(12)

  return (
    <PerspectivaClient
      monthlyIncome={monthlyIncome}
      recentExpenses={(recentExpenses ?? []) as any[]}
    />
  )
}
