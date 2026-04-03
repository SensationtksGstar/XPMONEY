import { useQuery } from '@tanstack/react-query'
import type { VoltixState } from '@/types'

async function fetchVoltix(): Promise<VoltixState | null> {
  const res = await fetch('/api/voltix')
  if (!res.ok) return null
  const { data } = await res.json()
  return data
}

export function useVoltix(userId?: string) {
  const query = useQuery({
    queryKey: ['voltix', userId],
    queryFn:  fetchVoltix,
    staleTime: 2 * 60 * 1000,
  })

  return {
    voltix:  query.data ?? null,
    loading: query.isLoading,
  }
}
