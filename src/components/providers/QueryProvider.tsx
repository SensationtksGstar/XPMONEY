'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime:            5 * 60 * 1000,  // 5 min global default
        gcTime:               15 * 60 * 1000, // 15 min — keep cache warm between routes
        refetchOnWindowFocus: false,
        retry:                1,              // 1 retry only (default 3 wastes time)
      },
    },
  }))

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
