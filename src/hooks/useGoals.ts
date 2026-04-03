import { useQuery } from '@tanstack/react-query'
import type { Goal } from '@/types'

async function fetchGoals(): Promise<Goal[]> {
  const res = await fetch('/api/goals')
  if (!res.ok) return []
  const { data } = await res.json()
  return data ?? []
}

export function useGoals(userId?: string) {
  const query = useQuery({
    queryKey: ['goals', userId],
    queryFn:  fetchGoals,
  })

  return {
    goals:   query.data ?? [],
    loading: query.isLoading,
  }
}
