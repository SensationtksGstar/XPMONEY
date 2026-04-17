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
    // Missions tick from server side-effects (transactions, daily-checkin,
    // score recalc). A short stale window keeps the progress bars live without
    // hammering the API on every tab change.
    staleTime:            30 * 1000,   // 30 s
    refetchOnWindowFocus: true,
  })

  return {
    missions: query.data ?? [],
    loading:  query.isLoading,
    error:    query.error,
    refetch:  query.refetch,
  }
}
