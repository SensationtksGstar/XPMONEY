'use client'

import { usePathname }         from 'next/navigation'
import { useEffect, useState } from 'react'
import { UserButton }          from '@clerk/nextjs'
import Link                    from 'next/link'
import { NotificationPanel }   from '@/components/ui/NotificationPanel'
import { Logo }                from '@/components/ui/Logo'
import { cn }                  from '@/lib/utils'
import { useT }                from '@/lib/i18n/LocaleProvider'
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
  // Reutilizam as chaves de nav — o título do ecrã DEVE dizer o mesmo que
  // o item de menu que lá levou (antes caíam no fallback "XP-Money").
  '/contas':       'nav.networth',
  '/orcamento':    'nav.budget',
  '/dividas':      'nav.debt_killer',
}

export function TopBar() {
  const pathname = usePathname()
  const t        = useT()
  const matchedKey = Object.entries(PAGE_TITLE_KEYS).find(([path]) =>
    pathname.startsWith(path)
  )?.[1]
  const title    = matchedKey ? t(matchedKey) : 'XP-Money'

  const isDashboard = pathname === '/dashboard'

  // Padrão iOS "large title": em repouso a barra mostra a MARCA; o título
  // da página só entra (crossfade) quando o h1 grande da própria página já
  // saiu do viewport. Antes, a barra mostrava o mesmo texto que o h1 40px
  // abaixo — em mobile lia-se como uma aba duplicada/sobreposta (bug
  // reportado pelo dono em /transactions, mas existia em todas as páginas).
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 72)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const showTitle = !isDashboard && scrolled

  return (
    <header
      className="lg:hidden sticky top-0 z-30 border-b border-white/5 bg-surface-0/90 backdrop-blur-md"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="flex items-center justify-between px-4 py-3">

        {/* Marca ⇄ título — empilhados em absoluto para o crossfade não
            mexer no layout. É um <span>, não <h1>: o h1 é o da página
            (dois h1 com o mesmo texto era também um problema de a11y). */}
        <div className="relative flex-1 min-w-0 h-8 mr-2">
          <Link
            href="/dashboard"
            tabIndex={showTitle ? -1 : 0}
            aria-hidden={showTitle}
            className={cn(
              'absolute inset-y-0 left-0 flex items-center gap-2 transition-opacity duration-200',
              showTitle ? 'opacity-0 pointer-events-none' : 'opacity-100',
            )}
          >
            <Logo size={28} />
            <span className="font-bold text-white text-lg tracking-tight">XP-Money</span>
          </Link>
          <span
            aria-hidden={!showTitle}
            className={cn(
              'absolute inset-y-0 left-0 right-0 flex items-center font-bold text-white text-lg truncate transition-opacity duration-200',
              showTitle ? 'opacity-100' : 'opacity-0 pointer-events-none',
            )}
          >
            {title}
          </span>
        </div>

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
