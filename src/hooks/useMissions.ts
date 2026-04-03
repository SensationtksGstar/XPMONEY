import { useQuery } from '@tanstack/react-query'
import type { Mission } from '@/types'

async function fetchMissions(): Promise<Mission[]> {
  const res = await fetch('/api/missions')
  if (!res.ok) return []
  const { data } = await res.json()
  return data ?? []
}

export function useMissions(userId?: string) {
  const query = useQuery({
    queryKey: ['missions', userId],
    queryFn:  fetchMissions,
  })

  return {
    missions: query.data ?? [],
    loading:  query.isLoading,
    error:    query.error,
    refetch:  query.refetch,
  }
}
