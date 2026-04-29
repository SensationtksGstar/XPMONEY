import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import type { Budget, BudgetStatus, OverridesMap, BudgetBucket } from '@/lib/budget'

const OVERRIDES_KEY        = 'xpmoney:budget_overrides'
// React Query queryKey used as the single source of truth for budget
// overrides across every component that reads them. Critical: every
// `useBudgetOverrides()` consumer must subscribe to this exact key so
// they re-render in lockstep when one mutates the value (see bug fix
// rationale on the hook below).
const OVERRIDES_QUERY_KEY  = ['budget-overrides'] as const

/**
 * Hooks do Orçamento Pessoal.
 *
 * useBudget()       — config do user (GET + mutation PUT).
 * useBudgetStatus() — estado do mês corrente (sempre derivado do backend).
 */

async function fetchBudget(): Promise<Budget | null> {
  const res = await fetch('/api/budget')
  if (!res.ok) return null
  const { data } = await res.json()
  return data ?? null
}

async function fetchBudgetStatus(overrides: OverridesMap): Promise<BudgetStatus | null> {
  const qs = Object.keys(overrides).length > 0
    ? `?overrides=${encodeURIComponent(JSON.stringify(overrides))}`
    : ''
  const res = await fetch(`/api/budget/status${qs}`)
  if (!res.ok) return null
  const { data } = await res.json()
  return data ?? null
}

/** Lê overrides do localStorage com defensiva — corrupt JSON → {} */
function readOverrides(): OverridesMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(OVERRIDES_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const out: OverridesMap = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (v === 'needs' || v === 'wants' || v === 'savings') {
        out[k] = v
      }
    }
    return out
  } catch {
    return {}
  }
}

async function saveBudget(input: {
  monthly_income: number
  pct_needs:      number
  pct_wants:      number
  pct_savings:    number
}): Promise<Budget> {
  const res = await fetch('/api/budget', {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(input),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? 'Erro ao guardar orçamento')
  return json.data
}

export function useBudget() {
  const client = useQueryClient()

  const query = useQuery({
    queryKey:             ['budget'],
    queryFn:              fetchBudget,
    staleTime:            5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const save = useMutation({
    mutationFn: saveBudget,
    onSuccess:  () => {
      client.invalidateQueries({ queryKey: ['budget'] })
      client.invalidateQueries({ queryKey: ['budget-status'] })
    },
  })

  return {
    budget:      query.data ?? null,
    loading:     query.isLoading,
    save:        save.mutateAsync,
    isSaving:    save.isPending,
  }
}

export function useBudgetStatus() {
  const { overrides } = useBudgetOverrides()
  return useQuery({
    // queryKey inclui overrides → mudar uma categoria invalida cache sem
    // precisar de fazer manual refetch
    queryKey:             ['budget-status', overrides],
    queryFn:              () => fetchBudgetStatus(overrides),
    staleTime:            2 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

/**
 * Hook para gerir recategorizações manuais de categorias em buckets.
 *
 * Persiste em localStorage (per-device) — deliberadamente simples, não
 * vai ao DB, porque é preferência personal do user e não precisa de
 * sincronização cross-device. Se for importante para o user, pode ser
 * migrado para o DB mais tarde sem partir nada.
 *
 * ── State-sharing fix (April 2026) ──────────────────────────────────
 * Before: each call to this hook had its own `useState`. Two consumers
 * (useBudgetStatus internally + CategoryOverrides directly) ran with
 * INDEPENDENT copies of `overrides`. Clicking Need/Want/Save inside
 * CategoryOverrides updated localStorage and that component's local
 * state, but useBudgetStatus's snapshot was still `{}` from its own
 * mount → the re-fetch URL didn't carry the new override → the bucket
 * pill in the UI never moved. User-reported: "se mudar nao muda nada".
 *
 * Now: a single React Query entry (`budget-overrides`) is the source
 * of truth. The `queryFn` reads from localStorage once at mount;
 * `setOverride`/`clearAll` mutate via `setQueryData`, which both
 * persists to localStorage AND triggers a re-render in every consumer
 * subscribing to that key — including the one inside useBudgetStatus,
 * whose own `queryKey` includes `overrides` and so re-fetches.
 */
export function useBudgetOverrides() {
  const client = useQueryClient()

  const { data: overrides = {} } = useQuery<OverridesMap>({
    queryKey:             OVERRIDES_QUERY_KEY,
    queryFn:              readOverrides,
    staleTime:            Infinity,   // localStorage IS the source of truth here
    refetchOnWindowFocus: false,
    refetchOnMount:       false,
    // Important: structural sharing keeps the same object reference
    // when contents are equal, so consumers don't see "fake" updates.
    structuralSharing:    true,
  })

  const setOverride = useCallback((category: string, bucket: BudgetBucket | null) => {
    let nextSnapshot: OverridesMap = {}
    client.setQueryData<OverridesMap>(OVERRIDES_QUERY_KEY, (prev = {}) => {
      const next: OverridesMap = { ...prev }
      if (bucket === null) {
        delete next[category]
      } else {
        next[category] = bucket
      }
      try {
        if (Object.keys(next).length === 0) {
          localStorage.removeItem(OVERRIDES_KEY)
        } else {
          localStorage.setItem(OVERRIDES_KEY, JSON.stringify(next))
        }
      } catch { /* storage quota / privacy mode — não crítico */ }
      nextSnapshot = next
      return next
    })
    // Force-refetch the budget-status query whose queryKey embeds the
    // overrides object. setQueryData on OVERRIDES_QUERY_KEY already
    // triggers a re-render of useBudgetStatus's hook (it reads
    // `overrides` from the cache → new ref → new queryKey), but we
    // call invalidateQueries explicitly as a belt-and-braces guard
    // against any cached responses with the old override shape.
    void nextSnapshot
    client.invalidateQueries({ queryKey: ['budget-status'] })
  }, [client])

  const clearAll = useCallback(() => {
    client.setQueryData<OverridesMap>(OVERRIDES_QUERY_KEY, {})
    try { localStorage.removeItem(OVERRIDES_KEY) } catch { /* noop */ }
    client.invalidateQueries({ queryKey: ['budget-status'] })
  }, [client])

  return { overrides, setOverride, clearAll }
}
