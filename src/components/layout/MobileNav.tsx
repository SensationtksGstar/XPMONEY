'use client'

import Link            from 'next/link'
import { usePathname } from 'next/navigation'
import { useState }    from 'react'
import { LayoutDashboard, ArrowLeftRight, Zap, Target, Settings2, Plus, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn }          from '@/lib/utils'
import { TransactionForm } from '@/components/transactions/TransactionForm'

const NAV_ITEMS = [
  { href: '/dashboard',    label: 'Início',     icon: LayoutDashboard },
  { href: '/transactions', label: 'Transações', icon: ArrowLeftRight },
  null, // FAB placeholder
  { href: '/voltix',       label: 'Voltix',     icon: Zap },
  { href: '/settings',     label: 'Definições', icon: Settings2 },
]

export function MobileNav() {
  const pathname   = usePathname()
  const [showForm, setShowForm] = useState(false)

  return (
    <>
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0a0f1e]/95 backdrop-blur-xl border-t border-white/5"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-around px-2 pt-2 pb-2">
          {NAV_ITEMS.map((item, i) => {
            // FAB central
            if (item === null) {
              return (
                <button
                  key="fab"
                  onClick={() => setShowForm(true)}
                  className="relative -top-5 w-14 h-14 bg-green-500 hover:bg-green-400 active:scale-95 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30 transition-all"
                  style={{ boxShadow: '0 0 24px rgba(34,197,94,0.4)' }}
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
                  'flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all min-w-0 active:scale-90',
                  isActive ? 'text-green-400' : 'text-white/35 hover:text-white/70',
                )}
              >
                <Icon className={cn(
                  'w-5 h-5',
                  isActive && 'drop-shadow-[0_0_8px_rgba(34,197,94,0.7)]'
                )} />
                <span className="text-[10px] font-medium truncate">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Bottom sheet de nova transação */}
      {showForm && <TransactionForm onClose={() => setShowForm(false)} />}
    </>
  )
}
