'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { DEMO_USER } from '@/lib/demo/mockData'

interface DemoContextValue {
  user: typeof DEMO_USER
  isDemo: true
}

const DemoContext = createContext<DemoContextValue>({
  user:   DEMO_USER,
  isDemo: true,
})

export function useDemoUser() {
  return useContext(DemoContext)
}

export function DemoProvider({ children }: { children: ReactNode }) {
  return (
    <DemoContext.Provider value={{ user: DEMO_USER, isDemo: true }}>
      {children}
    </DemoContext.Provider>
  )
}
