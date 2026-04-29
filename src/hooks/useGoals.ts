import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Goal, GoalDeposit } from '@/types'

// ── Goals ──────────────────────────────────────────────────────────────────

async function fetchGoals(): Promise<Goal[]> {
  const res = await fetch('/api/goals')
  if (!res.ok) return []
  const { data } = await res.json()
  return data ?? []
}

interface CreateGoalResult {
  goal:       Goal
  xp_gained:  number
  leveled_up: boolean
}

/**
 * Server-rejection error that preserves the response code (e.g.
 * `free_goal_limit`) so the UI can react with a tailored toast/modal
 * instead of a generic "Erro ao criar objetivo". Caller does:
 *   catch (e) { if (e instanceof CreateGoalError && e.code === 'free_goal_limit') ... }
 */
export class CreateGoalError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message)
    this.name = 'CreateGoalError'
  }
}

async function createGoal(input: Partial<Goal>): Promise<CreateGoalResult> {
  const res = await fetch('/api/goals', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(input),
  })
  if (!res.ok) {
    // Try to surface the structured error body { error, code, ... }.
    // Fall back to a generic message if the body is not JSON (e.g. a
    // 502 HTML page from a dead Vercel function).
    let serverMessage = 'Erro ao criar objetivo'
    let code: string | undefined
    try {
      const j = await res.json() as { error?: string; code?: string }
      if (j.error) serverMessage = j.error
      if (j.code)  code = j.code
    } catch { /* non-JSON body — keep default */ }
    throw new CreateGoalError(serverMessage, code)
  }
  const json = await res.json()
  return {
    goal:       json.data,
    xp_gained:  json.xp_gained ?? 0,
    leveled_up: json.leveled_up ?? false,
  }
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
    onSuccess:  () => {
      client.invalidateQueries({ queryKey: ['goals']     })
      client.invalidateQueries({ queryKey: ['xp']        })
      client.invalidateQueries({ queryKey: ['missions']  })
    },
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
