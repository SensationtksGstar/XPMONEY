'use client'

import Link            from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ArrowLeftRight, Crosshair, Zap, Target } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/dashboard',    label: 'Início',     icon: LayoutDashboard },
  { href: '/transactions', label: 'Transações', icon: ArrowLeftRight },
  { href: '/missions',     label: 'Missões',    icon: Crosshair },
  { href: '/voltix',       label: 'Voltix',     icon: Zap },
  { href: '/goals',        label: 'Objetivos',  icon: Target },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0a0f1e]/95 backdrop-blur-md border-t border-white/5 px-2 py-2">
      <div className="flex items-center justify-around">
        {NAV_ITEMS.map(item => {
          const Icon     = item.icon
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all min-w-0',
                isActive ? 'text-green-400' : 'text-white/40 hover:text-white/70',
              )}
            >
              <Icon className={cn('w-5 h-5', isActive && 'drop-shadow-[0_0_8px_rgba(34,197,94,0.6)]')} />
              <span className="text-[10px] font-medium truncate">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
