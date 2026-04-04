import { useQuery } from '@tanstack/react-query'
import type { Category, TransactionType } from '@/types'

async function fetchCategories(): Promise<Category[]> {
  const res = await fetch('/api/categories')
  if (!res.ok) throw new Error('Erro ao carregar categorias')
  const { data } = await res.json()
  return data ?? []
}

export function useCategories() {
  const query = useQuery({
    queryKey: ['categories'],
    queryFn:  fetchCategories,
  })

  const categories = query.data ?? []

  function byType(type: TransactionType): Category[] {
    return categories.filter(
      c => c.transaction_type === type || c.transaction_type === 'both'
    )
  }

  return {
    categories,
    loading: query.isLoading,
    byType,
  }
}
