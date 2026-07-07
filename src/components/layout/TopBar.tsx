'use client'

import { usePathname }       from 'next/navigation'
import { UserButton }        from '@clerk/nextjs'
import Link                  from 'next/link'
import { NotificationPanel } from '@/components/ui/NotificationPanel'
import { Logo }              from '@/components/ui/Logo'
import { useT }              from '@/lib/i18n/LocaleProvider'
import type { TranslationKey } from '@/lib/i18n/translations'

const PAGE_TITLE_KEYS: Record<string, TranslationKey> = {
  '/dashboard':    'topbar.title.dashboard',
  '/transactions': 'topbar.title.transactions',
  '/missions':     'topbar.title.missions',
  '/voltix':       'topbar.title.voltix',
  '/goals':        'topbar.title.goals',
  '/settings':     'topbar.title.settings',
  '/badges':       'topbar.title.badges',
  '/perspetiva':   'topbar.title.perspective',
  '/simulador':    'topbar.title.simulator',
  '/cursos':       'topbar.title.academy',
}

export function TopBar() {
  const pathname = usePathname()
  const t        = useT()
  const matchedKey = Object.entries(PAGE_TITLE_KEYS).find(([path]) =>
    pathname.startsWith(path)
  )?.[1]
  const title    = matchedKey ? t(matchedKey) : 'XP-Money'

  const isDashboard = pathname === '/dashboard'

  return (
    <header
      className="lg:hidden sticky top-0 z-30 border-b border-white/5 bg-surface-0/90 backdrop-blur-md"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="flex items-center justify-between px-4 py-3">

        {/* Logo ou título */}
        {isDashboard ? (
          <Link href="/dashboard" className="flex items-center gap-2">
            <Logo size={28} />
            <span className="font-bold text-white text-lg tracking-tight">XP-Money</span>
          </Link>
        ) : (
          <h1 className="font-bold text-white text-lg">{title}</h1>
        )}

        {/* Ações direita — chrome mínimo: sino + avatar. O idioma vive no
            LanguageSwitcher em /settings (padrão Apple: idioma é definição,
            não chrome); o upsell vive nos momentos contextuais (banner do
            dashboard para free, paywalls, billing), não como badge fixo. */}
        <div className="flex items-center gap-2">
          {/* Notificações — funcional */}
          <NotificationPanel />

          {/* Avatar */}
          <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: {
                /* popup card */
                userButtonPopoverCard:
                  'bg-surface-1 border border-white/10 shadow-2xl shadow-black/60 rounded-2xl !text-white',
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
