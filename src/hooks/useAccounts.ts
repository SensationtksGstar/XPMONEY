import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Account } from '@/types'

async function fetchAccounts(): Promise<Account[]> {
  const res = await fetch('/api/accounts')
  if (!res.ok) throw new Error('Erro ao carregar contas')
  const { data } = await res.json()
  return data ?? []
}

export type NewAccount = Pick<Account, 'name' | 'type'> &
  Partial<Pick<Account, 'balance' | 'currency' | 'color' | 'icon'>>

export type AccountPatch = Partial<Pick<Account, 'name' | 'type' | 'balance' | 'color' | 'icon'>>

async function createAccount(input: NewAccount): Promise<Account> {
  const res = await fetch('/api/accounts', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(input),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error ?? 'create_failed')
  return json.data
}

async function updateAccount({ id, patch }: { id: string; patch: AccountPatch }): Promise<Account> {
  const res = await fetch(`/api/accounts/${id}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(patch),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error ?? 'update_failed')
  return json.data
}

async function deleteAccount(id: string): Promise<void> {
  const res = await fetch(`/api/accounts/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    // Surface the specific 409 so the UI can explain it cleanly.
    throw new Error(json?.code ?? json?.error ?? 'delete_failed')
  }
}

export function useAccounts() {
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: ['accounts'],
    queryFn:  fetchAccounts,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['accounts'] })

  const createMut = useMutation({ mutationFn: createAccount, onSuccess: invalidate })
  const updateMut = useMutation({ mutationFn: updateAccount, onSuccess: invalidate })
  const deleteMut = useMutation({ mutationFn: deleteAccount, onSuccess: invalidate })

  const accounts = query.data ?? []
  const defaultAccount = accounts.find(a => a.is_default) ?? accounts[0] ?? null

  return {
    accounts,
    loading:        query.isLoading,
    defaultAccount,
    createAccount:  createMut.mutateAsync,
    updateAccount:  updateMut.mutateAsync,
    deleteAccount:  deleteMut.mutateAsync,
    isMutating:     createMut.isPending || updateMut.isPending || deleteMut.isPending,
  }
}
