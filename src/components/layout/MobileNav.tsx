'use client'

import Link            from 'next/link'
import { usePathname } from 'next/navigation'
import { useState }    from 'react'
import {
  LayoutDashboard, ArrowLeftRight,
  Target, BookOpen, Plus, MoreHorizontal,
  Swords, Trophy, Zap, LineChart, TrendingUp,
  Settings, X,
} from 'lucide-react'
import { cn }              from '@/lib/utils'
import { TransactionForm } from '@/components/transactions/TransactionForm'

// 5-cell primary nav with the FAB at cell 3 → literally 50% of the width.
// Any 6-cell layout puts the FAB's cell at ~42% which visually reads as
// off-center (which is what the user flagged). Academia (cursos) is promoted
// into the More sheet so the 5-cell grid holds: 2 links | FAB | 1 link | Mais.
const PRIMARY_NAV = [
  { href: '/dashboard',    label: 'Início',    icon: LayoutDashboard },
  { href: '/transactions', label: 'Contas',    icon: ArrowLeftRight  },
  null, // FAB (centered)
  { href: '/goals',        label: 'Poupanças', icon: Target          },
]

const MORE_ITEMS = [
  { href: '/cursos',     label: 'Academia',   icon: BookOpen,    badge: null        },
  { href: '/missions',   label: 'Missões',    icon: Swords,      badge: null        },
  { href: '/voltix',     label: 'Pet',        icon: Zap,         badge: null        },
  { href: '/badges',     label: 'Conquistas', icon: Trophy,      badge: null        },
  { href: '/perspetiva', label: 'Perspetiva', icon: LineChart,   badge: '👑 PREMIUM' },
  { href: '/simulador',  label: 'Simulador',  icon: TrendingUp,  badge: '👑 PREMIUM' },
  { href: '/settings',   label: 'Definições', icon: Settings,    badge: null        },
]

export function MobileNav() {
  const pathname                = usePathname()
  const [showForm, setShowForm] = useState(false)
  const [showMore, setShowMore] = useState(false)

  // Is the current page one of the "more" pages?
  const moreActive = MORE_ITEMS.some(item => pathname.startsWith(item.href))

  return (
    <>
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0a0f1e]/95 backdrop-blur-xl border-t border-white/5"
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
                    aria-label="Adicionar transação"
                    className="relative -top-5 w-14 h-14 bg-green-500 active:bg-green-400 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all"
                    style={{ boxShadow: '0 0 24px rgba(34,197,94,0.45)' }}
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
                <Icon className={cn('w-5 h-5', isActive && 'drop-shadow-[0_0_8px_rgba(34,197,94,0.6)]')} />
                <span className="text-[10px] font-medium truncate">{item.label}</span>
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
            <MoreHorizontal className={cn('w-5 h-5', moreActive && 'drop-shadow-[0_0_8px_rgba(34,197,94,0.6)]')} />
            <span className="text-[10px] font-medium">Mais</span>
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
            className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0d1221] border-t border-white/10 rounded-t-2xl animate-slide-up"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <h3 id="mobile-more-title" className="text-white font-semibold text-base">Mais páginas</h3>
              <button
                onClick={() => setShowMore(false)}
                aria-label="Fechar menu"
                className="w-11 h-11 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20"
              >
                <X className="w-4 h-4 text-white/70" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 px-4 pb-2">
              {MORE_ITEMS.map(item => {
                const Icon     = item.icon
                const isActive = pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setShowMore(false)}
                    className={cn(
                      'flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all active:scale-95',
                      isActive
                        ? 'bg-green-500/10 border-green-500/30 text-green-400'
                        : 'bg-white/5 border-white/8 text-white/60',
                    )}
                  >
                    <Icon className="w-6 h-6" />
                    <span className="text-xs font-medium text-center leading-tight">{item.label}</span>
                    {item.badge && (
                      <span className="text-[9px] font-bold text-yellow-400/80 bg-yellow-400/10 px-1.5 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        </>
      )}

      {showForm && <TransactionForm onClose={() => setShowForm(false)} />}
    </>
  )
}
