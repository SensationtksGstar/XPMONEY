'use client'

import Link            from 'next/link'
import { usePathname } from 'next/navigation'
import { useState }    from 'react'
import {
  LayoutDashboard, ArrowLeftRight,
  Target, BookOpen, Plus, MoreHorizontal,
  Crosshair, Sword, Trophy, Zap, LineChart, TrendingUp,
  Settings, X, PiggyBank, Wallet, ChevronRight,
} from 'lucide-react'
import { cn }              from '@/lib/utils'
import { TransactionForm } from '@/components/transactions/TransactionForm'
import { useT }            from '@/lib/i18n/LocaleProvider'
import type { TranslationKey } from '@/lib/i18n/translations'

// 5-cell primary nav with the FAB at cell 3 → literally 50% of the width.
// Any 6-cell layout puts the FAB's cell at ~42% which visually reads as
// off-center (which is what the user flagged). Academia (cursos) is promoted
// into the More sheet so the 5-cell grid holds: 2 links | FAB | 1 link | Mais.
interface PrimaryItem {
  href:     string
  labelKey: TranslationKey
  icon:     typeof LayoutDashboard
}

const PRIMARY_NAV: (PrimaryItem | null)[] = [
  { href: '/dashboard',    labelKey: 'nav.home',              icon: LayoutDashboard },
  { href: '/transactions', labelKey: 'nav.transactions_short', icon: ArrowLeftRight  },
  null, // FAB (centered)
  { href: '/goals',        labelKey: 'nav.goals',             icon: Target          },
]

interface MoreItem {
  href:     string
  labelKey: TranslationKey
  icon:     typeof LayoutDashboard
  badge:    TranslationKey | null
}

interface MoreGroup {
  titleKey: TranslationKey
  items:    MoreItem[]
}

// Grouped by the user's mental model (Apple-Settings pattern): labelled
// sections of tappable rows read instantly; the old flat 3×3 wall of
// equal icons did not. Icons match the desktop Sidebar so the same
// feature carries the same glyph on every breakpoint.
const MORE_GROUPS: MoreGroup[] = [
  {
    titleKey: 'nav.group_money',
    items: [
      { href: '/contas',    labelKey: 'nav.networth',    icon: Wallet,    badge: null                },
      { href: '/orcamento', labelKey: 'nav.budget',      icon: PiggyBank, badge: null                },
      { href: '/dividas',   labelKey: 'nav.debt_killer', icon: Sword,     badge: 'nav.badge_premium' },
    ],
  },
  {
    titleKey: 'nav.group_progress',
    items: [
      { href: '/missions', labelKey: 'nav.missions', icon: Crosshair, badge: null },
      { href: '/badges',   labelKey: 'nav.badges',   icon: Trophy,    badge: null },
      { href: '/voltix',   labelKey: 'nav.pet',      icon: Zap,       badge: null },
      { href: '/cursos',   labelKey: 'nav.academy',  icon: BookOpen,  badge: null },
    ],
  },
  {
    titleKey: 'nav.group_tools',
    items: [
      { href: '/perspetiva', labelKey: 'nav.perspective', icon: LineChart,  badge: 'nav.badge_premium' },
      { href: '/simulador',  labelKey: 'nav.simulator',   icon: TrendingUp, badge: 'nav.badge_premium' },
    ],
  },
  {
    titleKey: 'nav.group_account',
    items: [
      { href: '/settings', labelKey: 'nav.settings', icon: Settings, badge: null },
    ],
  },
]

export function MobileNav() {
  const pathname                = usePathname()
  const t                       = useT()
  const [showForm, setShowForm] = useState(false)
  const [showMore, setShowMore] = useState(false)

  // Is the current page one of the "more" pages?
  const moreActive = MORE_GROUPS.some(g => g.items.some(item => pathname.startsWith(item.href)))

  return (
    <>
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface-0/95 backdrop-blur-xl border-t border-white/5"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/*
          5 equal cells via grid: [Início][Contas][FAB][Poupanças][Mais].
          Cell 3 is the centre column (40-60 %), so the FAB lands on the 50 %
          mark pixel-perfect on every device width. The old `flex justify-
          around` gave uneven spacing because label widths differed and the
          FAB wasn't guaranteed to be the central element.
        */}
        <div className="grid grid-cols-5 items-center px-1 pt-2 pb-2">
          {PRIMARY_NAV.map((item) => {

            /* ── FAB central ── */
            if (item === null) {
              return (
                <div key="fab" className="flex justify-center">
                  <button
                    onClick={() => setShowForm(true)}
                    aria-label={t('nav.add_tx_aria')}
                    className="relative -top-5 w-14 h-14 bg-green-500 active:bg-green-400 rounded-full flex items-center justify-center shadow-[0_8px_20px_rgba(0,0,0,0.55)] active:scale-95 transition-all"
                  >
                    <Plus className="w-6 h-6 text-black" strokeWidth={3} />
                  </button>
                </div>
              )
            }

            const Icon     = item.icon
            const isActive = pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-1 px-1 py-1.5 rounded-xl transition-colors min-w-0 active:scale-90 relative',
                  isActive ? 'text-green-400' : 'text-white/35',
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[11px] font-medium truncate">{t(item.labelKey)}</span>
                {isActive && (
                  <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-green-400 rounded-full" />
                )}
              </Link>
            )
          })}

          {/* ── Mais button ── */}
          <button
            onClick={() => setShowMore(true)}
            className={cn(
              'flex flex-col items-center gap-1 px-1 py-1.5 rounded-xl transition-colors min-w-0 active:scale-90 relative',
              moreActive ? 'text-green-400' : 'text-white/35',
            )}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[11px] font-medium">{t('nav.more')}</span>
            {moreActive && (
              <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-green-400 rounded-full" />
            )}
          </button>
        </div>
      </nav>

      {/* ── More bottom sheet ── */}
      {showMore && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden fixed inset-0 z-50 bg-black/60 animate-fade-in"
            onClick={() => setShowMore(false)}
          />
          {/* Sheet */}
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-more-title"
            className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-1 border-t border-white/10 rounded-t-2xl animate-slide-up"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <h3 id="mobile-more-title" className="text-white font-semibold text-base">{t('nav.more_title')}</h3>
              <button
                onClick={() => setShowMore(false)}
                aria-label={t('nav.close_menu')}
                className="w-11 h-11 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20"
              >
                <X className="w-4 h-4 text-white/70" />
              </button>
            </div>

            {/* Grouped rows, not an icon wall. Scrolls inside itself so the
                sheet never grows past the viewport on small phones (SE). */}
            <div className="px-4 pb-2 space-y-4 max-h-[72vh] overflow-y-auto overscroll-contain">
              {MORE_GROUPS.map(group => (
                <div key={group.titleKey}>
                  <p className="px-1 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/40">
                    {t(group.titleKey)}
                  </p>
                  <div className="bg-white/5 border border-white/8 rounded-2xl overflow-hidden divide-y divide-white/5">
                    {group.items.map(item => {
                      const Icon     = item.icon
                      const isActive = pathname.startsWith(item.href)
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setShowMore(false)}
                          className={cn(
                            'flex items-center gap-3 px-4 min-h-[48px] transition-colors active:bg-white/10',
                            isActive ? 'text-green-400' : 'text-white/85',
                          )}
                        >
                          <Icon className={cn('w-5 h-5 flex-shrink-0', isActive ? 'text-green-400' : 'text-white/45')} />
                          <span className="flex-1 text-sm font-medium">{t(item.labelKey)}</span>
                          {item.badge && (
                            <span className="text-[11px] font-bold text-purple-300 bg-purple-500/15 border border-purple-500/25 px-1.5 py-0.5 rounded-full">
                              {t(item.badge)}
                            </span>
                          )}
                          <ChevronRight className="w-4 h-4 text-white/25 flex-shrink-0" />
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {showForm && <TransactionForm onClose={() => setShowForm(false)} />}
    </>
  )
}
