import { auth }               from '@clerk/nextjs/server'
import { redirect }           from 'next/navigation'
import { createSupabaseAdmin } from '@/lib/supabase'
import { Crown }               from 'lucide-react'
import Link                    from 'next/link'
import SimuladorClient         from './SimuladorClient'

export const metadata = { title: 'Simulador de Investimento' }

// Force dynamic — plan check must always be fresh (no stale cache)
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SimuladorPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const db = createSupabaseAdmin()

  // Direct DB query — never cached — ensures paywall sees authoritative plan
  const { data: profile } = await db
    .from('users')
    .select('id, plan')
    .eq('clerk_id', userId)
    .single()

  if (!profile) redirect('/dashboard')

  // Paywall for non-pro users
  if (profile.plan !== 'pro' && profile.plan !== 'family') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="text-6xl mb-4">📈</div>
        <h1 className="text-2xl font-bold text-white mb-2">Funcionalidade Pro</h1>
        <p className="text-white/50 max-w-md mb-6">
          O <strong className="text-white">Simulador de Investimento</strong> está disponível exclusivamente no plano Pro.
          Simula o crescimento dos teus investimentos no S&P 500 e outros índices.
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

  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
  const dateStr = threeMonthsAgo.toISOString().split('T')[0]

  const { data: txData } = await db
    .from('transactions')
    .select('amount, type')
    .eq('user_id', profile.id)
    .gte('date', dateStr)

  const totalIncome   = txData?.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)   ?? 0
  const totalExpenses = txData?.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)  ?? 0
  const avgMonthlySavings = Math.max(0, (totalIncome - totalExpenses) / 3)

  return <SimuladorClient suggestedMonthly={Math.round(avgMonthlySavings)} />
}
