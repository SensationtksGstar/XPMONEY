import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import type { Budget, BudgetStatus, OverridesMap, BudgetBucket } from '@/lib/budget'

const OVERRIDES_KEY = 'xpmoney:budget_overrides'

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
 */
export function useBudgetOverrides() {
  const client = useQueryClient()
  const [overrides, setState] = useState<OverridesMap>({})

  // Hydrate do localStorage após mount — SSR-safe
  useEffect(() => {
    setState(readOverrides())
  }, [])

  const setOverride = useCallback((category: string, bucket: BudgetBucket | null) => {
    setState(prev => {
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
      // Invalida o cache do status para a barra recalcular imediatamente
      client.invalidateQueries({ queryKey: ['budget-status'] })
      return next
    })
  }, [client])

  const clearAll = useCallback(() => {
    setState({})
    try { localStorage.removeItem(OVERRIDES_KEY) } catch { /* noop */ }
    client.invalidateQueries({ queryKey: ['budget-status'] })
  }, [client])

  return { overrides, setOverride, clearAll }
}
