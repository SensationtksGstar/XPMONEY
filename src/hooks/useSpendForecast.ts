'use client'

import { useQuery } from '@tanstack/react-query'
import { useUserPlan } from '@/lib/contexts/UserPlanContext'
import { useBudgetOverrides } from '@/hooks/useBudget'
import type { OverridesMap } from '@/lib/budget'
import type { SpendForecastResult } from '@/lib/spendForecast'

/**
 * useSpendForecast — client hook for the Premium spend forecast.
 *
 * - `enabled: isPaid` — free users NEVER hit /api/forecast (the widget shows
 *   them the velocity branch + teaser instead; the server gate is the
 *   backstop, not the primary UX).
 * - Overrides ride along exactly like /api/budget/status so the forecast's
 *   bucket mapping always matches what the user configured on /orcamento —
 *   and because the key embeds them, a recategorisation invalidates both
 *   caches together.
 * - queryKey has NO userId (project rule) — RLS scopes server-side.
 */

async function fetchForecast(overrides: OverridesMap): Promise<SpendForecastResult | null> {
  const qs = Object.keys(overrides).length > 0
    ? `?overrides=${encodeURIComponent(JSON.stringify(overrides))}`
    : ''
  const res = await fetch(`/api/forecast${qs}`)
  if (!res.ok) {
    // 403 plan_required etc — surface as null; the widget's plan branch
    // means a paid user should never see this, but a mid-session downgrade
    // must not crash the card.
    console.warn('[useSpendForecast] fetch failed:', res.status)
    return null
  }
  const { data } = await res.json()
  return data ?? null
}

export function useSpendForecast() {
  const { isPaid } = useUserPlan()
  const { overrides } = useBudgetOverrides()

  const query = useQuery({
    queryKey:             ['forecast', overrides],
    queryFn:              () => fetchForecast(overrides),
    staleTime:            5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled:              isPaid,
  })

  return {
    forecast: query.data ?? null,
    loading:  isPaid && query.isLoading,
    error:    query.error,
  }
}
