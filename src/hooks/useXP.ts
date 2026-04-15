import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { XPProgress } from '@/types'

async function fetchXP(): Promise<XPProgress | null> {
  const res = await fetch('/api/xp')
  if (!res.ok) return null
  const { data } = await res.json()
  return data
}

async function addXP(payload: { amount: number; reason: string }) {
  const res = await fetch('/api/xp', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('Erro ao adicionar XP')
  return res.json()
}

export function useXP(_userId?: string) {
  const client = useQueryClient()

  const query = useQuery({
    queryKey:             ['xp'],
    queryFn:              fetchXP,
    staleTime:            10 * 60 * 1000,  // 10 min
    refetchOnWindowFocus: false,
  })

  const mutation = useMutation({
    mutationFn: addXP,
    onSuccess:  () => client.invalidateQueries({ queryKey: ['xp'] }),
  })

  return {
    xp:      query.data ?? null,
    loading: query.isLoading,
    addXP:   mutation.mutateAsync,
  }
}
