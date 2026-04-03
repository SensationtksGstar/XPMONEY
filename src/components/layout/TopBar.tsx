'use client'

import { usePathname }  from 'next/navigation'
import { UserButton }   from '@clerk/nextjs'
import { Bell }         from 'lucide-react'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':    'Dashboard',
  '/transactions': 'Transações',
  '/missions':     'Missões',
  '/voltix':       'Voltix',
  '/goals':        'Objetivos',
  '/settings':     'Definições',
}

export function TopBar() {
  const pathname = usePathname()
  const title    = Object.entries(PAGE_TITLES).find(([path]) =>
    pathname.startsWith(path)
  )?.[1] ?? ''

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 md:px-6 py-4 bg-[#060b14]/80 backdrop-blur-md border-b border-white/5 lg:hidden">
      <div className="flex items-center gap-2">
        <span className="text-xl">⚡</span>
        <span className="font-bold text-white">{title || 'XP Money'}</span>
      </div>
      <div className="flex items-center gap-3">
        <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white transition-colors relative">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-green-500 rounded-full" />
        </button>
        <UserButton afterSignOutUrl="/" />
      </div>
    </header>
  )
}
