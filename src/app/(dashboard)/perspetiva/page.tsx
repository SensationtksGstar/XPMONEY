import { auth }               from '@clerk/nextjs/server'
import { redirect }           from 'next/navigation'
import { createSupabaseAdmin } from '@/lib/supabase'
import { Crown }               from 'lucide-react'
import Link                    from 'next/link'
import PerspectivaClient       from './PerspectivaClient'

export const metadata = { title: 'Perspetiva de Riqueza' }

// Force dynamic — plan check must always be fresh (no stale cache)
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function PerspectivaPage() {
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

  // Fetch salary category IDs (Salário + Freelance)
  const { data: salaryCats } = await db
    .from('categories')
    .select('id, name')
    .in('name', ['Salário', 'Freelance'])
    .eq('is_default', true)

  const salaryIds = (salaryCats ?? []).map(c => c.id)

  // Fetch all salary transactions and recent expenses in parallel
  const [salaryRes, expenseRes] = await Promise.all([
    salaryIds.length > 0
      ? db
          .from('transactions')
          .select('amount, date')
          .eq('user_id', profile.id)
          .eq('type', 'income')
          .in('category_id', salaryIds)
          .order('date', { ascending: false })
          .limit(24)
      : Promise.resolve({ data: [] }),
    db
      .from('transactions')
      .select('id, description, amount, date, category:categories(name, icon, color)')
      .eq('user_id', profile.id)
      .eq('type', 'expense')
      .order('date', { ascending: false })
      .limit(12),
  ])

  const salaryTxs = salaryRes.data ?? []
  const monthSet = new Set(salaryTxs.map(t => t.date.slice(0, 7)))
  const totalSalary   = salaryTxs.reduce((s, t) => s + Number(t.amount), 0)
  const salaryMonths  = monthSet.size || 1
  const monthlyIncome = totalSalary / salaryMonths

  return (
    <PerspectivaClient
      monthlyIncome={monthlyIncome}
      salaryMonths={salaryMonths}
      salaryTotal={totalSalary}
      recentExpenses={(expenseRes.data ?? []) as any[]}
    />
  )
}
