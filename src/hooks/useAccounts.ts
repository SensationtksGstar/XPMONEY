import { useQuery } from '@tanstack/react-query'
import type { Account } from '@/types'

async function fetchAccounts(): Promise<Account[]> {
  const res = await fetch('/api/accounts')
  if (!res.ok) throw new Error('Erro ao carregar contas')
  const { data } = await res.json()
  return data ?? []
}

export function useAccounts() {
  const query = useQuery({
    queryKey: ['accounts'],
    queryFn:  fetchAccounts,
  })

  const accounts = query.data ?? []
  const defaultAccount = accounts.find(a => a.is_default) ?? accounts[0] ?? null

  return {
    accounts,
    loading:        query.isLoading,
    defaultAccount,
  }
}
