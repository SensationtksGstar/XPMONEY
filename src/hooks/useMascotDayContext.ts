import { useQuery } from '@tanstack/react-query'
import type { Mission } from '@/types'
import { useTransactions } from '@/hooks/useTransactions'
import { fetchMissions }   from '@/hooks/useMissions'
import { deriveDayAwareness, type DayAwareness } from '@/lib/mascotSpeak'

/**
 * O que a mascote sabe sobre "hoje": há quantos dias foi alimentada (último
 * registo), se já comeu hoje e se há uma missão pronta a resgatar.
 *
 * Zero endpoints novos: lê as queries React Query que o resto da app já usa.
 * ['transactions'] é observada normalmente (o dashboard já a pede).
 * ['missions'] é lida SÓ da cache (`enabled: false`): GET /api/missions tem
 * efeitos de escrita (expira, paga, re-semeia) e não deve disparar em cada
 * visita/foco ao dashboard em paralelo com o daily-checkin (awardXP
 * read-modify-write). Sem cache (ainda não se abriu /missions nesta sessão)
 * o estado é "desconhecido" e a mascote não fala de missões.
 */
export function useMascotDayContext(): DayAwareness {
  const { transactions, loading: txLoading } = useTransactions()
  const missionsQuery = useQuery<Mission[]>({
    queryKey: ['missions'],
    queryFn:  fetchMissions,
    enabled:  false,
  })

  return deriveDayAwareness(
    txLoading ? null : transactions,
    missionsQuery.data ?? null,
  )
}
