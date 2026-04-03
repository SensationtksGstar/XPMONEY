import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Transaction, TransactionCreateInput } from '@/types'

async function fetchTransactions(): Promise<Transaction[]> {
  const res = await fetch('/api/transactions')
  if (!res.ok) throw new Error('Erro ao carregar transações')
  const { data } = await res.json()
  return data ?? []
}

async function postTransaction(input: TransactionCreateInput): Promise<Transaction> {
  const res = await fetch('/api/transactions', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(input),
  })
  if (!res.ok) throw new Error('Erro ao criar transação')
  const { data } = await res.json()
  return data
}

export function useTransactions(userId?: string) {
  const client = useQueryClient()

  const query = useQuery({
    queryKey: ['transactions', userId],
    queryFn:  fetchTransactions,
    enabled:  true,
  })

  const mutation = useMutation({
    mutationFn: postTransaction,
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['transactions'] })
      client.invalidateQueries({ queryKey: ['score'] })
      client.invalidateQueries({ queryKey: ['xp'] })
      client.invalidateQueries({ queryKey: ['missions'] })
    },
  })

  return {
    transactions:      query.data ?? [],
    loading:           query.isLoading,
    error:             query.error,
    createTransaction: mutation.mutateAsync,
    isCreating:        mutation.isPending,
  }
}
