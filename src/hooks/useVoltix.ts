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
  // staleTime + refetchOnWindowFocus TUNED FOR EVOLUTION CINEMATIC
  // =====================================================================
  // The MascotEvolutionWatcher fires when `voltix.evolution_level` rises
  // past the device-local `xpmoney:mascot_last_evo` value. For the
  // cinematic to play reliably on mobile, React Query must SEE the new
  // server value.
  //
  // The prior config (staleTime: 10 min, refetchOnWindowFocus: false)
  // broke mobile specifically: a user logs a transaction that triggers
  // score → evolution, backgrounds the app (common on phones), and when
  // they come back the stale 10-min cache serves the OLD evo. The
  // cinematic never fires. User reported: "no mobile não apareceu o
  // vídeo da evolução".
  //
  // Short staleTime + refetch-on-focus means:
  //   1. Every foreground-return triggers a fetch → evolutions caught.
  //   2. 30 s is long enough to dedupe rapid re-renders inside a session.
  //   3. No background polling — still battery-friendly on mobile.
  const query = useQuery({
    queryKey:             ['voltix'],
    queryFn:              fetchVoltix,
    staleTime:            30 * 1000,   // was 10 min — see note above
    refetchOnWindowFocus: true,        // was false — catches "came back to tab"
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
