'use client'

import Link            from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton }  from '@clerk/nextjs'
import {
  LayoutDashboard, ArrowLeftRight, Crosshair,
  Zap, Target, Settings, Crown, Trophy,
  Star, TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/dashboard',    label: 'Dashboard',  icon: LayoutDashboard, pro: false },
  { href: '/transactions', label: 'Transações', icon: ArrowLeftRight,  pro: false },
  { href: '/missions',     label: 'Missões',    icon: Crosshair,       pro: false },
  { href: '/voltix',       label: 'Voltix',     icon: Zap,             pro: false },
  { href: '/goals',        label: 'Objetivos',  icon: Target,          pro: false },
  { href: '/badges',       label: 'Conquistas', icon: Trophy,          pro: false },
  { href: '/perspetiva',   label: 'Perspetiva', icon: Star,            pro: true  },
  { href: '/simulador',    label: 'Simulador',  icon: TrendingUp,      pro: true  },
  { href: '/settings',     label: 'Definições', icon: Settings,        pro: false },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-full w-64 bg-white/3 border-r border-white/5 z-40">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/5">
        <span className="text-2xl">⚡</span>
        <span className="font-bold text-lg text-white">XP Money</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(item => {
          const Icon     = item.icon
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                isActive
                  ? item.pro
                    ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20'
                    : 'bg-green-500/15 text-green-400 border border-green-500/20'
                  : 'text-white/60 hover:text-white hover:bg-white/5',
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.pro && (
                <span className="text-[9px] font-bold bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-full">PRO</span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Pro features CTA */}
      <div className="px-3 py-3">
        <Link
          href="/perspetiva"
          className="flex items-center gap-3 px-3 py-3 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 hover:border-purple-500/40 transition-all"
        >
          <Star className="w-4 h-4 text-purple-400" />
          <div>
            <div className="text-xs font-semibold text-purple-400">Features Pro</div>
            <div className="text-xs text-white/40">Perspetiva · Simulador</div>
          </div>
        </Link>
      </div>

      {/* User */}
      <div className="flex items-center gap-3 px-6 py-4 border-t border-white/5">
        <UserButton afterSignOutUrl="/" />
        <div className="flex-1 min-w-0">
          <div className="text-xs text-white/40 truncate">Conta</div>
        </div>
      </div>
    </aside>
  )
}
