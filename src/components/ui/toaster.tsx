'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle, AlertCircle, Info, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastType = 'success' | 'error' | 'info' | 'xp'

interface Toast {
  id:      string
  type:    ToastType
  message: string
  xp?:     number
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType, xp?: number) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

const ICONS: Record<ToastType, ReactNode> = {
  success: <CheckCircle className="w-4 h-4 text-green-400" />,
  error:   <AlertCircle className="w-4 h-4 text-red-400" />,
  info:    <Info className="w-4 h-4 text-blue-400" />,
  xp:      <Zap className="w-4 h-4 text-yellow-400" />,
}

const STYLES: Record<ToastType, string> = {
  success: 'border-green-500/30 bg-green-500/10',
  error:   'border-red-500/30   bg-red-500/10',
  info:    'border-blue-500/30  bg-blue-500/10',
  xp:      'border-yellow-500/30 bg-yellow-500/10',
}

export function Toaster({ children }: { children?: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, type: ToastType = 'success', xp?: number) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, type, message, xp }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3500)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Toast container — respeita safe area e bottom nav */}
      <div
        className="fixed z-[100] flex flex-col gap-2 pointer-events-none"
        style={{
          bottom: 'calc(env(safe-area-inset-bottom) + 80px)',
          left:   '1rem',
          right:  '1rem',
        }}
      >
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0,  scale: 1    }}
              exit={{    opacity: 0, y: -10, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className={cn(
                'pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl border backdrop-blur-md shadow-xl',
                STYLES[t.type],
              )}
            >
              {ICONS[t.type]}
              <span className="text-sm font-medium text-white flex-1">{t.message}</span>
              {t.xp && (
                <span className="text-xs font-bold text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full">
                  +{t.xp} XP
                </span>
              )}
              <button
                onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
                className="text-white/30 hover:text-white transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
