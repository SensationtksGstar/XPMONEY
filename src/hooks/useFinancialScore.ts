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
    queryKey:       ['score', userId],
    queryFn:        fetchScore,
    staleTime:      5 * 60 * 1000, // 5 minutos
    refetchInterval: 10 * 60 * 1000, // recalcular a cada 10 minutos
  })

  return {
    score:   query.data ?? null,
    loading: query.isLoading,
    error:   query.error,
    refetch: query.refetch,
  }
}
