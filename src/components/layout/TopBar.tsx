'use client'

import { usePathname }       from 'next/navigation'
import { useUser }           from '@clerk/nextjs'
import { UserButton }        from '@clerk/nextjs'
import { Crown }             from 'lucide-react'
import Link                  from 'next/link'
import { NotificationPanel } from '@/components/ui/NotificationPanel'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':    'Dashboard',
  '/transactions': 'Transações',
  '/missions':     'Missões',
  '/voltix':       'Voltix',
  '/goals':        'Objetivos',
  '/settings':     'Definições',
  '/badges':       'Conquistas',
  '/perspetiva':   'Perspetiva',
  '/simulador':    'Simulador',
}

export function TopBar() {
  const pathname = usePathname()
  const title    = Object.entries(PAGE_TITLES).find(([path]) =>
    pathname.startsWith(path)
  )?.[1] ?? 'XP Money'

  const isDashboard = pathname === '/dashboard'

  return (
    <header
      className="lg:hidden sticky top-0 z-30 border-b border-white/5 bg-[#060b14]/90 backdrop-blur-md"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="flex items-center justify-between px-4 py-3">

        {/* Logo ou título */}
        {isDashboard ? (
          <div className="flex items-center gap-2">
            <span className="text-xl">⚡</span>
            <span className="font-bold text-white text-lg">XP Money</span>
          </div>
        ) : (
          <h1 className="font-bold text-white text-lg">{title}</h1>
        )}

        {/* Ações direita */}
        <div className="flex items-center gap-2">
          {/* Badge upgrade */}
          <Link
            href="/settings/billing"
            className="hidden xs:flex items-center gap-1 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-semibold px-2.5 py-1.5 rounded-full hover:bg-green-500/20 transition-colors"
          >
            <Crown className="w-3 h-3" />
            Plus
          </Link>

          {/* Notificações — funcional */}
          <NotificationPanel />

          {/* Avatar */}
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>
    </header>
  )
}
