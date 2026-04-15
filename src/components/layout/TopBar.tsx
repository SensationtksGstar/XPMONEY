'use client'

import { usePathname }       from 'next/navigation'
import { UserButton }        from '@clerk/nextjs'
import { Crown }             from 'lucide-react'
import Link                  from 'next/link'
import { NotificationPanel } from '@/components/ui/NotificationPanel'
import { Logo }              from '@/components/ui/Logo'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':    'Dashboard',
  '/transactions': 'Transações',
  '/missions':     'Missões',
  '/voltix':       'Voltix',
  '/goals':        'Poupanças',
  '/settings':     'Definições',
  '/badges':       'Conquistas',
  '/perspetiva':   'Perspetiva',
  '/simulador':    'Simulador',
  '/cursos':       'Academia',
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
          <Link href="/dashboard" className="flex items-center gap-2">
            <Logo size={28} />
            <span className="font-bold text-white text-lg tracking-tight">XP Money</span>
          </Link>
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
          <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: {
                /* popup card */
                userButtonPopoverCard:
                  'bg-[#111827] border border-white/10 shadow-2xl shadow-black/60 rounded-2xl !text-white',
                /* header inside popup */
                userButtonPopoverActionButton:
                  'hover:bg-white/10 rounded-xl text-white',
                userButtonPopoverActionButtonText: 'text-white/90 font-medium',
                userButtonPopoverActionButtonIcon: 'text-white/60',
                /* footer */
                userButtonPopoverFooter: 'hidden',
                /* name + email */
                userPreviewMainIdentifier: 'text-white font-semibold',
                userPreviewSecondaryIdentifier: 'text-white/50',
                /* avatar trigger */
                avatarBox: 'ring-2 ring-white/20 hover:ring-green-400/60 transition-all',
              },
            }}
          />
        </div>
      </div>
    </header>
  )
}
