'use client'

import Link            from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton }  from '@clerk/nextjs'
import {
  LayoutDashboard, ArrowLeftRight, Crosshair,
  Zap, Target, Settings, Crown, Trophy,
  Star, TrendingUp, BookOpen, Sword,
} from 'lucide-react'
import { cn }   from '@/lib/utils'
import { Logo } from '@/components/ui/Logo'

const NAV_ITEMS = [
  { href: '/dashboard',    label: 'Dashboard',   icon: LayoutDashboard, pro: false },
  { href: '/transactions', label: 'Transações',  icon: ArrowLeftRight,  pro: false },
  { href: '/missions',     label: 'Missões',     icon: Crosshair,       pro: false },
  { href: '/goals',        label: 'Poupanças',   icon: Target,          pro: false },
  { href: '/dividas',      label: 'Mata-Dívidas', icon: Sword,          pro: true  },
  { href: '/badges',       label: 'Conquistas',  icon: Trophy,          pro: false },
  { href: '/perspetiva',   label: 'Perspetiva',  icon: Star,            pro: true  },
  { href: '/simulador',    label: 'Simulador',   icon: TrendingUp,      pro: true  },
  { href: '/cursos',       label: 'Academia',    icon: BookOpen,        pro: true  },
  { href: '/voltix',       label: 'Pet',         icon: Zap,             pro: false },
  { href: '/settings',     label: 'Definições',  icon: Settings,        pro: false },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-full w-64 bg-white/3 border-r border-white/5 z-40">
      {/* Logo */}
      <Link href="/dashboard" className="flex items-center gap-3 px-6 py-5 border-b border-white/5 hover:bg-white/3 transition-colors">
        <Logo size={32} />
        <span className="font-bold text-lg text-white tracking-tight">XP-Money</span>
      </Link>

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

      {/* Pro/upgrade CTA */}
      <div className="px-3 py-3">
        <Link
          href="/settings/billing"
          className="flex items-center gap-3 px-3 py-3 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 hover:border-purple-500/40 transition-all"
        >
          <Crown className="w-4 h-4 text-purple-400" />
          <div>
            <div className="text-xs font-semibold text-purple-400">Ver Premium</div>
            <div className="text-xs text-white/40">Academia · Perspetiva · Scan</div>
          </div>
        </Link>
      </div>

      {/* User */}
      <div className="flex items-center gap-3 px-6 py-4 border-t border-white/5">
        <UserButton
          afterSignOutUrl="/"
          appearance={{
            elements: {
              userButtonPopoverCard:
                'bg-[#111827] border border-white/10 shadow-2xl shadow-black/60 rounded-2xl !text-white',
              userButtonPopoverActionButton:
                'hover:bg-white/10 rounded-xl text-white',
              userButtonPopoverActionButtonText: 'text-white/90 font-medium',
              userButtonPopoverActionButtonIcon: 'text-white/60',
              userButtonPopoverFooter: 'hidden',
              userPreviewMainIdentifier: 'text-white font-semibold',
              userPreviewSecondaryIdentifier: 'text-white/50',
              avatarBox: 'ring-2 ring-white/20 hover:ring-green-400/60 transition-all',
            },
          }}
        />
        <div className="flex-1 min-w-0">
          <div className="text-xs text-white/40 truncate">Conta</div>
        </div>
      </div>
    </aside>
  )
}
