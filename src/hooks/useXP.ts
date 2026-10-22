import { useQuery } from '@tanstack/react-query'
import type { XPProgress } from '@/types'

async function fetchXP({ signal }: { signal?: AbortSignal }): Promise<XPProgress | null> {
  const res = await fetch('/api/xp', { signal })
  if (!res.ok) return null
  const { data } = await res.json()
  return data
}

/**
 * Fonte ÚNICA da query ['xp'] (key + queryFn + staleTime). Quem precisar do
 * XP fora do hook (ex.: `queryClient.fetchQuery` no welcome do dashboard) usa
 * isto — uma cópia do queryFn podia divergir na forma e envenenar a cache
 * partilhada com o XPProgressBar. O `signal` do React Query cancela o pedido
 * quando já ninguém o observa.
 */
export const xpQueryOptions = {
  queryKey:  ['xp'] as const,
  queryFn:   fetchXP,
  staleTime: 10 * 60 * 1000,  // 10 min
}

// NOTA: o antigo `addXP` (POST /api/xp com amount arbitrário) foi removido
// junto com o endpoint — nenhum componente o consumia e era um exploit de
// XP ilimitado. XP é atribuído exclusivamente server-side via awardXP().
export function useXP(_userId?: string) {
  const query = useQuery({
    ...xpQueryOptions,
    refetchOnWindowFocus: false,
  })

  return {
    xp:      query.data ?? null,
    loading: query.isLoading,
  }
}
