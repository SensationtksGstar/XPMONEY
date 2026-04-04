import { useQuery } from '@tanstack/react-query'
import type { FinancialScore } from '@/types'

async function fetchScore(): Promise<FinancialScore | null> {
  const res = await fetch('/api/score')
  if (!res.ok) return null
  const { data } = await res.json()
  return data
}

export function useFinancialScore(userId?: string) {
  const query = useQuery({
    queryKey:            ['score', userId],
    queryFn:             fetchScore,
    staleTime:           2 * 60 * 1000,  // 2 minutos
    refetchInterval:     5 * 60 * 1000,  // recalcular a cada 5 minutos
    refetchOnWindowFocus: true,
  })

  return {
    score:   query.data ?? null,
    loading: query.isLoading,
    error:   query.error,
    refetch: query.refetch,
  }
}
