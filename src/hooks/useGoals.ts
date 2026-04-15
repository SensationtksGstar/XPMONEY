import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Goal, GoalDeposit } from '@/types'

// ── Goals ──────────────────────────────────────────────────────────────────

async function fetchGoals(): Promise<Goal[]> {
  const res = await fetch('/api/goals')
  if (!res.ok) return []
  const { data } = await res.json()
  return data ?? []
}

async function createGoal(input: Partial<Goal>): Promise<Goal> {
  const res = await fetch('/api/goals', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(input),
  })
  if (!res.ok) throw new Error('Erro ao criar objetivo')
  const { data } = await res.json()
  return data
}

async function updateGoal({ id, ...patch }: Partial<Goal> & { id: string }): Promise<Goal> {
  const res = await fetch(`/api/goals/${id}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(patch),
  })
  if (!res.ok) throw new Error('Erro ao atualizar objetivo')
  const { data } = await res.json()
  return data
}

async function deleteGoal(id: string): Promise<void> {
  const res = await fetch(`/api/goals/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Erro ao eliminar objetivo')
}

export function useGoals(_userId?: string) {
  const client = useQueryClient()

  const query = useQuery({
    queryKey:             ['goals'],
    queryFn:              fetchGoals,
    staleTime:            10 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const createMutation = useMutation({
    mutationFn: createGoal,
    onSuccess:  () => client.invalidateQueries({ queryKey: ['goals'] }),
  })

  const updateMutation = useMutation({
    mutationFn: updateGoal,
    onSuccess:  () => client.invalidateQueries({ queryKey: ['goals'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteGoal,
    onSuccess:  () => client.invalidateQueries({ queryKey: ['goals'] }),
  })

  return {
    goals:      query.data ?? [],
    loading:    query.isLoading,
    createGoal: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateGoal: updateMutation.mutateAsync,
    deleteGoal: deleteMutation.mutateAsync,
  }
}

// ── Goal Deposits ───────────────────────────────────────────────────────────

async function fetchDeposits(goalId: string): Promise<GoalDeposit[]> {
  const res = await fetch(`/api/goals/${goalId}/deposits`)
  if (!res.ok) return []
  const { data } = await res.json()
  return data ?? []
}

interface AddDepositInput {
  goalId:  string
  amount:  number
  note?:   string
  date?:   string
}

async function addDeposit({ goalId, ...body }: AddDepositInput) {
  const res = await fetch(`/api/goals/${goalId}/deposits`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
  if (!res.ok) throw new Error('Erro ao registar depósito')
  return res.json()
}

export function useGoalDeposits(goalId: string, enabled = true) {
  return useQuery({
    queryKey: ['goal-deposits', goalId],
    queryFn:  () => fetchDeposits(goalId),
    enabled:  !!goalId && enabled,
  })
}

export function useAddDeposit() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: addDeposit,
    onSuccess:  (_data, vars) => {
      client.invalidateQueries({ queryKey: ['goals'] })
      client.invalidateQueries({ queryKey: ['goal-deposits', vars.goalId] })
    },
  })
}
