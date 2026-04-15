'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Spinner } from './Spinner'

interface Props {
  open:          boolean
  title:         string
  description?:  string
  confirmLabel?: string
  cancelLabel?:  string
  tone?:         'danger' | 'warning' | 'info'
  loading?:      boolean
  onConfirm:     () => void
  onClose:       () => void
}

const TONE_STYLES = {
  danger: {
    button: 'bg-red-500 hover:bg-red-400 text-white',
    ring:   'ring-red-500/20',
    icon:   'text-red-400',
  },
  warning: {
    button: 'bg-orange-500 hover:bg-orange-400 text-black',
    ring:   'ring-orange-500/20',
    icon:   'text-orange-400',
  },
  info: {
    button: 'bg-green-500 hover:bg-green-400 text-black',
    ring:   'ring-green-500/20',
    icon:   'text-green-400',
  },
}

/**
 * Accessible confirmation dialog for destructive/irreversible actions.
 * Traps ESC to dismiss. Renders nothing when `open=false`.
 */
export function ConfirmDialog({
  open, title, description,
  confirmLabel = 'Confirmar', cancelLabel = 'Cancelar',
  tone = 'danger', loading = false,
  onConfirm, onClose,
}: Props) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, loading, onClose])

  if (!open) return null

  const style = TONE_STYLES[tone]

  return (
    <div
      className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm flex items-end sm:items-center sm:justify-center sm:p-4 animate-fade-in"
      onClick={loading ? undefined : onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby={description ? 'confirm-desc' : undefined}
    >
      <div
        className="w-full sm:max-w-sm bg-[#0d1424] border border-white/10 rounded-t-3xl sm:rounded-2xl overflow-hidden animate-slide-up sm:animate-fade-in-up"
        onClick={e => e.stopPropagation()}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        <div className="px-6 pt-5 pb-6 text-center">
          <div className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-4 ring-4 ${style.ring}`}>
            <AlertTriangle className={`w-6 h-6 ${style.icon}`} aria-hidden="true" />
          </div>

          <h2 id="confirm-title" className="text-lg font-bold text-white mb-1.5">
            {title}
          </h2>
          {description && (
            <p id="confirm-desc" className="text-sm text-white/55 leading-relaxed">
              {description}
            </p>
          )}

          <div className="flex gap-2 mt-6">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-3 bg-white/5 hover:bg-white/10 disabled:opacity-40 text-white/70 font-semibold rounded-xl transition-colors text-sm min-h-[44px]"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`flex-1 py-3 font-bold rounded-xl transition-colors text-sm min-h-[44px] disabled:opacity-60 active:scale-[0.98] flex items-center justify-center gap-2 ${style.button}`}
              autoFocus
            >
              {loading && <Spinner size="sm" tone={tone === 'warning' || tone === 'info' ? 'dark' : 'light'} />}
              {loading ? 'A processar...' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
