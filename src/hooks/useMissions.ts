import { useQuery } from '@tanstack/react-query'
import type { Mission } from '@/types'

async function fetchMissions(): Promise<Mission[]> {
  const res = await fetch('/api/missions')
  if (!res.ok) return []
  const { data } = await res.json()
  return data ?? []
}

export function useMissions(_userId?: string) {
  const query = useQuery({
    queryKey:             ['missions'],
    queryFn:              fetchMissions,
    staleTime:            10 * 60 * 1000,  // 10 min
    refetchOnWindowFocus: false,
  })

  return {
    missions: query.data ?? [],
    loading:  query.isLoading,
    error:    query.error,
    refetch:  query.refetch,
  }
}
