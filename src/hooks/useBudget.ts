import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Budget, BudgetStatus } from '@/lib/budget'

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

async function fetchBudgetStatus(): Promise<BudgetStatus | null> {
  const res = await fetch('/api/budget/status')
  if (!res.ok) return null
  const { data } = await res.json()
  return data ?? null
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
  return useQuery({
    queryKey:             ['budget-status'],
    queryFn:              fetchBudgetStatus,
    staleTime:            2 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
