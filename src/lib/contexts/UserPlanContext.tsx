'use client'

import { createContext, useContext } from 'react'

type Plan = 'free' | 'premium'

interface UserPlanContextValue {
  plan: Plan
  isFree: boolean
  isPaid: boolean
}

export const UserPlanContext = createContext<UserPlanContextValue>({
  plan:   'free',
  isFree: true,
  isPaid: false,
})

export function UserPlanProvider({
  plan,
  children,
}: {
  plan: Plan
  children: React.ReactNode
}) {
  return (
    <UserPlanContext.Provider value={{ plan, isFree: plan === 'free', isPaid: plan !== 'free' }}>
      {children}
    </UserPlanContext.Provider>
  )
}

export function useUserPlan() {
  return useContext(UserPlanContext)
}
