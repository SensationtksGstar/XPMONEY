import { useQuery } from '@tanstack/react-query'
import type { XPProgress } from '@/types'

async function fetchXP(): Promise<XPProgress | null> {
  const res = await fetch('/api/xp')
  if (!res.ok) return null
  const { data } = await res.json()
  return data
}

// NOTA: o antigo `addXP` (POST /api/xp com amount arbitrário) foi removido
// junto com o endpoint — nenhum componente o consumia e era um exploit de
// XP ilimitado. XP é atribuído exclusivamente server-side via awardXP().
export function useXP(_userId?: string) {
  const query = useQuery({
    queryKey:             ['xp'],
    queryFn:              fetchXP,
    staleTime:            10 * 60 * 1000,  // 10 min
    refetchOnWindowFocus: false,
  })

  return {
    xp:      query.data ?? null,
    loading: query.isLoading,
  }
}
