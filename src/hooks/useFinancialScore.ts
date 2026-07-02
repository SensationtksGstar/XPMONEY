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
    // No refetchInterval: the score only changes through mutations that
    // already invalidate ['score'] (see useTransactions) — polling was pure
    // redundancy: 6 wasted requests/hour per open tab + mobile radio wakes.
    refetchOnWindowFocus: false,
  })

  return {
    score:   query.data ?? null,
    loading: query.isLoading,
    error:   query.error,
    refetch: query.refetch,
  }
}
