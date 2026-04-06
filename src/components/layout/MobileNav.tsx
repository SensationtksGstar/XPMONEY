'use client'

import Link            from 'next/link'
import { usePathname } from 'next/navigation'
import { useState }    from 'react'
import {
  LayoutDashboard, ArrowLeftRight, Zap,
  Flag, Trophy, Plus,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn }                      from '@/lib/utils'
import { TransactionForm }         from '@/components/transactions/TransactionForm'

const NAV_ITEMS = [
  { href: '/dashboard',    label: 'Início',     icon: LayoutDashboard },
  { href: '/transactions', label: 'Transações', icon: ArrowLeftRight },
  null, // FAB
  { href: '/missions',     label: 'Missões',    icon: Flag },
  { href: '/badges',       label: 'Conquistas', icon: Trophy },
]

export function MobileNav() {
  const pathname            = usePathname()
  const [showForm, setShowForm] = useState(false)

  return (
    <>
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0a0f1e]/95 backdrop-blur-xl border-t border-white/5"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-around px-1 pt-2 pb-2">
          {NAV_ITEMS.map((item, i) => {

            /* ── FAB central ── */
            if (item === null) {
              return (
                <motion.button
                  key="fab"
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowForm(true)}
                  className="relative -top-5 w-14 h-14 bg-green-500 hover:bg-green-400 rounded-full flex items-center justify-center shadow-lg transition-all"
                  style={{ boxShadow: '0 0 24px rgba(34,197,94,0.45)' }}
                >
                  <Plus className="w-6 h-6 text-black" strokeWidth={3} />
                </motion.button>
              )
            }

            const Icon     = item.icon
            const isActive = pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all min-w-0 active:scale-90 relative',
                  isActive ? 'text-green-400' : 'text-white/35 hover:text-white/70',
                )}
              >
                <Icon className={cn('w-5 h-5', isActive && 'drop-shadow-[0_0_8px_rgba(34,197,94,0.7)]')} />
                <span className="text-[10px] font-medium truncate">{item.label}</span>
                {/* active dot */}
                {isActive && (
                  <motion.span
                    layoutId="nav-dot"
                    className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-green-400 rounded-full"
                  />
                )}
              </Link>
            )
          })}
        </div>
      </nav>

      {showForm && <TransactionForm onClose={() => setShowForm(false)} />}
    </>
  )
}
