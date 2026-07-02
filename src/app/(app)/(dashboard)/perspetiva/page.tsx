import { auth }               from '@clerk/nextjs/server'
import { redirect }           from 'next/navigation'
import { createSupabaseAdmin } from '@/lib/supabase'
import { fetchPlanRow }        from '@/lib/plan'
import { PremiumFeatureLock } from '@/components/common/PremiumFeatureLock'
import { getServerT }          from '@/lib/i18n/server'
import type { TranslationKey } from '@/lib/i18n/translations'
import { isDemoMode }          from '@/lib/demo/demoGuard'
import PerspectivaClient       from './PerspectivaClient'

// Safe helper — refuses to enable on production unless ALLOW_DEMO_IN_PROD
// is also set. Never read NEXT_PUBLIC_DEMO_MODE directly for auth bypasses.
const DEMO_MODE = isDemoMode()

export const metadata = { title: 'Perspetiva de Riqueza' }

// Force dynamic — plan check must always be fresh (no stale cache)
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function PerspectivaPage() {
  const { userId } = DEMO_MODE ? { userId: null } : await auth()
  if (!DEMO_MODE && !userId) redirect('/sign-in')

  const t  = await getServerT()
  const db = createSupabaseAdmin()

  // Direct DB query — never cached — ensures paywall sees authoritative plan.
  // Demo visitors are always treated as free-plan so they hit the teaser.
  const profile = DEMO_MODE
    ? { id: null as string | null, isPremium: false }
    : await fetchPlanRow(db, 'clerk_id', userId as string)

  if (!profile) redirect('/dashboard')

  // Paywall: Perspetiva só para Premium — subscrição OU passe anual ativo
  // (isPremiumActive cobre também os antigos plus/pro/family).
  if (!profile.isPremium) {
    return (
      <PremiumFeatureLock
        icon="crown"
        title={t('perspective.lock.title')}
        description={t('perspective.lock.desc')}
        bullets={[
          t('perspective.lock.b1'),
          t('perspective.lock.b2'),
          t('perspective.lock.b3'),
          t('perspective.lock.b4'),
        ]}
        preview={<FauxPerspectivaPreview t={t} />}
      />
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

/**
 * FauxPerspectivaPreview — silhouetted leaderboard + stat card used as the
 * blurred backdrop for the PremiumFeatureLock. Deliberately data-less.
 */
function FauxPerspectivaPreview({ t }: { t: (k: TranslationKey) => string }) {
  const rows = [
    { name: 'Cristiano Ronaldo',     v: '€ 200M' },
    { name: 'Elon Musk',             v: '€ 2.4B' },
    { name: t('perspective.faux.you'), v: '€ 28k'  },
    { name: t('perspective.faux.eu'),  v: '€ 31k'  },
  ]
  return (
    <div className="w-full h-full p-8">
      <div className="w-full h-full rounded-2xl bg-gradient-to-br from-yellow-500/10 via-purple-500/10 to-transparent p-8 flex flex-col gap-6">
        {/* Hero KPI */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="text-xs text-white/40 uppercase tracking-wider mb-1">{t('perspective.faux.hours')}</div>
          <div className="text-4xl font-bold text-white">{t('perspective.faux.iphone')}</div>
          <div className="text-sm text-white/50 mt-2">{t('perspective.faux.sub')}</div>
        </div>
        {/* Leaderboard */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex-1">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
              <span className="text-sm text-white/70">{r.name}</span>
              <span className="text-sm font-bold text-yellow-300 tabular-nums">{r.v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
