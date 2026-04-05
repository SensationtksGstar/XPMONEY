'use client'

import { Zap } from 'lucide-react'

export function DemoBanner() {
  return (
    <div className="fixed top-0 left-0 right-0 z-[200] bg-yellow-500/90 backdrop-blur-sm text-black text-xs font-bold text-center py-1.5 flex items-center justify-center gap-2">
      <Zap className="w-3 h-3" />
      MODO DEMO — dados simulados. Para usar com dados reais, configura as tuas chaves em .env.local
    </div>
  )
}
