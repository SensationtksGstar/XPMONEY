import { useQuery } from '@tanstack/react-query'
import type { FinancialScore } from '@/types'

async function fetchScore(): Promise<FinancialScore | null> {
  const res = await fetch('/api/score')
  if (!res.ok) return null
  const { data } = await res.json()
  return data
}

export function useFinancialScore(_userId?: string) {
  const query = useQuery({
    queryKey:             ['score'],
    queryFn:              fetchScore,
    staleTime:            10 * 60 * 1000,  // 10 min — score rarely changes
    refetchInterval:      10 * 60 * 1000,  // background refresh every 10 min
    refetchOnWindowFocus: false,
  })

  return {
    score:   query.data ?? null,
    loading: query.isLoading,
    error:   query.error,
    refetch: query.refetch,
  }
}
