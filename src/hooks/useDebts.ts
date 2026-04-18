import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Debt, DebtAttack, DebtStrategy } from '@/lib/killDebt'

/**
 * Hooks para Kill Debt.
 *
 * useDebts()       — lista todas as dívidas + mutações create/update/delete
 * useDebtAttack()  — mutation para registar pagamento (ataque)
 * useDebtAttacks() — histórico de ataques de uma dívida específica
 *
 * queryKey não inclui userId (CLAUDE.md: filtrar server-side via RLS).
 */

async function fetchDebts(): Promise<Debt[]> {
  const res = await fetch('/api/debts')
  if (!res.ok) return []
  const { data } = await res.json()
  return data ?? []
}

async function createDebt(input: Partial<Debt>): Promise<Debt> {
  const res = await fetch('/api/debts', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(input),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? 'Erro ao criar dívida')
  return json.data
}

async function updateDebt({ id, ...patch }: Partial<Debt> & { id: string }): Promise<Debt> {
  const res = await fetch(`/api/debts/${id}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(patch),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? 'Erro ao atualizar dívida')
  return json.data
}

async function deleteDebt(id: string): Promise<void> {
  const res = await fetch(`/api/debts/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Erro ao eliminar dívida')
}

export function useDebts() {
  const client = useQueryClient()

  const query = useQuery({
    queryKey:             ['debts'],
    queryFn:              fetchDebts,
    staleTime:            5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const createMutation = useMutation({
    mutationFn: createDebt,
    onSuccess:  () => client.invalidateQueries({ queryKey: ['debts'] }),
  })

  const updateMutation = useMutation({
    mutationFn: updateDebt,
    onSuccess:  () => client.invalidateQueries({ queryKey: ['debts'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteDebt,
    onSuccess:  () => client.invalidateQueries({ queryKey: ['debts'] }),
  })

  return {
    debts:       query.data ?? [],
    loading:     query.isLoading,
    createDebt:  createMutation.mutateAsync,
    isCreating:  createMutation.isPending,
    updateDebt:  updateMutation.mutateAsync,
    deleteDebt:  deleteMutation.mutateAsync,
  }
}

// ── Attack ────────────────────────────────────────────────────────────

interface AttackInput {
  debtId: string
  amount: number
  note?:  string | null
}

interface AttackResult {
  attack:      DebtAttack | null
  new_balance: number
  killed:      boolean
  xp_earned:   number
  xp_result:   { leveled_up: boolean; level: number } | null
}

async function attackDebt({ debtId, amount, note }: AttackInput): Promise<AttackResult> {
  const res = await fetch(`/api/debts/${debtId}/attack`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ amount, note }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? 'Erro ao registar pagamento')
  return json.data
}

export function useDebtAttack() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: attackDebt,
    onSuccess:  () => {
      client.invalidateQueries({ queryKey: ['debts']    })
      client.invalidateQueries({ queryKey: ['debt-attacks'] })
      client.invalidateQueries({ queryKey: ['xp']       })
    },
  })
}

// Re-export for callers that want the types alongside the hooks
export type { Debt, DebtStrategy }
