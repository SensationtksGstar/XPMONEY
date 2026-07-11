import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Transaction, TransactionCreateInput } from '@/types'

async function fetchTransactions(): Promise<Transaction[]> {
  const res = await fetch('/api/transactions')
  if (!res.ok) throw new Error('Erro ao carregar transações')
  const { data } = await res.json()
  return data ?? []
}

/** Info de XP devolvida pelo servidor no create — inclui o "crítico"
 *  (recompensa variável, decidida server-side). */
export interface TransactionXPInfo { amount: number; critical: boolean }

async function postTransaction(
  input: TransactionCreateInput,
): Promise<{ data: Transaction; xp: TransactionXPInfo | null }> {
  const res = await fetch('/api/transactions', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(input),
  })
  if (!res.ok) throw new Error('Erro ao criar transação')
  const json = await res.json()
  return { data: json.data, xp: json.xp ?? null }
}

async function deleteTransactionById(id: string): Promise<void> {
  const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Erro ao eliminar transação')
}

export function useTransactions(_userId?: string) {
  const client = useQueryClient()

  const query = useQuery({
    queryKey:             ['transactions'],
    queryFn:              fetchTransactions,
    staleTime:            5 * 60 * 1000,   // 5 min
    refetchOnWindowFocus: false,
  })

  /**
   * Invalidação em cascata — qualquer mutação de transação tem de
   * actualizar também todas as vistas agregadas (summary, budget,
   * voltix mood, widgets do dashboard), senão o user vê números
   * stale após criar/eliminar. Centralizado aqui numa constante.
   */
  const invalidateAllTransactionViews = () => {
    client.invalidateQueries({ queryKey: ['transactions']    })
    client.invalidateQueries({ queryKey: ['score']           })
    client.invalidateQueries({ queryKey: ['xp']              })
    client.invalidateQueries({ queryKey: ['missions']        })
    client.invalidateQueries({ queryKey: ['summary']         })
    client.invalidateQueries({ queryKey: ['budget-status']   })
    client.invalidateQueries({ queryKey: ['budget-history']  })
    client.invalidateQueries({ queryKey: ['voltix']          })
    client.invalidateQueries({ queryKey: ['forecast']        })
    client.invalidateQueries({ queryKey: ['cashflow']        })
  }

  const mutation = useMutation({
    mutationFn: postTransaction,
    onSuccess:  invalidateAllTransactionViews,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteTransactionById,
    onSuccess:  invalidateAllTransactionViews,
  })

  return {
    transactions:      query.data ?? [],
    loading:           query.isLoading,
    error:             query.error,
    createTransaction: mutation.mutateAsync,
    isCreating:        mutation.isPending,
    deleteTransaction: deleteMutation.mutateAsync,
    isDeleting:        deleteMutation.isPending,
  }
}
