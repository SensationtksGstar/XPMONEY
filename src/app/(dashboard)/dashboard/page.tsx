import { auth } from '@clerk/nextjs/server'
import { FinancialScoreCard }  from '@/components/dashboard/FinancialScoreCard'
import { XPProgressBar }       from '@/components/dashboard/XPProgressBar'
import { MonthlySummary }      from '@/components/dashboard/MonthlySummary'
import { RecentTransactions }  from '@/components/dashboard/RecentTransactions'
import { VoltixWidget }        from '@/components/voltix/VoltixWidget'
import { MissionCard }         from '@/components/missions/MissionCard'
import { formatMonth }         from '@/lib/utils'

export const metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const { userId } = await auth()
  if (!userId) return null

  return (
    <div className="space-y-6 animate-fade-in-up">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-white/50 text-sm mt-0.5">{formatMonth()}</p>
        </div>
      </div>

      {/* Row 1: Score + XP + Voltix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <FinancialScoreCard userId={userId} />
        <div className="space-y-4">
          <XPProgressBar userId={userId} />
        </div>
        <VoltixWidget userId={userId} />
      </div>

      {/* Row 2: Resumo mensal */}
      <MonthlySummary userId={userId} />

      {/* Row 3: Missões + Transações recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white mb-3">Missões Ativas</h2>
          <MissionCard userId={userId} limit={3} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white mb-3">Transações Recentes</h2>
          <RecentTransactions userId={userId} limit={5} />
        </div>
      </div>
    </div>
  )
}
