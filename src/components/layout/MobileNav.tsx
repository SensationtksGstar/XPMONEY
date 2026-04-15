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

const PRIMARY_NAV = [
  { href: '/dashboard',    label: 'Início',    icon: LayoutDashboard },
  { href: '/transactions', label: 'Contas',    icon: ArrowLeftRight  },
  null, // FAB
  { href: '/goals',        label: 'Poupanças', icon: Target          },
  { href: '/cursos',       label: 'Academia',  icon: BookOpen        },
]

const MORE_ITEMS = [
  { href: '/missions',   label: 'Missões',    icon: Swords,      badge: null        },
  { href: '/voltix',     label: 'Voltix',     icon: Zap,         badge: null        },
  { href: '/badges',     label: 'Conquistas', icon: Trophy,      badge: null        },
  { href: '/perspetiva', label: 'Perspetiva', icon: LineChart,   badge: '👑 PRO'   },
  { href: '/simulador',  label: 'Simulador',  icon: TrendingUp,  badge: '👑 PRO'   },
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
        <div className="flex items-center justify-around px-1 pt-2 pb-2">
          {PRIMARY_NAV.map((item, i) => {

            /* ── FAB central ── */
            if (item === null) {
              return (
                <button
                  key="fab"
                  onClick={() => setShowForm(true)}
                  className="relative -top-5 w-14 h-14 bg-green-500 active:bg-green-400 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all"
                  style={{ boxShadow: '0 0 24px rgba(34,197,94,0.45)' }}
                >
                  <Plus className="w-6 h-6 text-black" strokeWidth={3} />
                </button>
              )
            }

            const Icon     = item.icon
            const isActive = pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-colors min-w-0 active:scale-90 relative',
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
              'flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-colors min-w-0 active:scale-90 relative',
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
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0d1221] border-t border-white/10 rounded-t-2xl animate-slide-up"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <h3 className="text-white font-semibold text-base">Mais páginas</h3>
              <button
                onClick={() => setShowMore(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20"
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
