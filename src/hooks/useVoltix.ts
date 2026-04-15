import { useQuery } from '@tanstack/react-query'
import type { VoltixState } from '@/types'

async function fetchVoltix(): Promise<VoltixState | null> {
  const res = await fetch('/api/voltix')
  if (!res.ok) return null
  const { data } = await res.json()
  return data
}

export function useVoltix(_userId?: string) {
  const query = useQuery({
    queryKey:             ['voltix'],
    queryFn:              fetchVoltix,
    staleTime:            10 * 60 * 1000,  // 10 min
    refetchOnWindowFocus: false,
  })

  return {
    voltix:  query.data ?? null,
    loading: query.isLoading,
  }
}
