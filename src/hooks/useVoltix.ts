import { useQuery } from '@tanstack/react-query'
import type { VoltixState } from '@/types'
import { resolveMascotGender } from '@/lib/mascotGender'

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

  // Merge DB value with localStorage fallback so the user's mascot choice
  // works even before the `mascot_gender` column migration has been applied.
  const voltix = query.data
    ? { ...query.data, mascot_gender: resolveMascotGender(query.data.mascot_gender) }
    : null

  return {
    voltix,
    loading: query.isLoading,
  }
}
