import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  /** Emoji or lucide icon element */
  icon:        ReactNode
  title:       string
  description?: string
  action?: {
    label:   string
    onClick: () => void
  }
  /** Optional secondary action (subtle link style) */
  secondary?: {
    label:   string
    onClick: () => void
  }
  tone?:      'default' | 'subtle'
  className?: string
}

/**
 * Reusable empty-state block with consistent spacing, typography and CTA.
 *
 * Use on any list that may have zero items — replaces the ad-hoc
 * "glass-card p-6 text-center" scattered across the codebase.
 */
export function EmptyState({
  icon, title, description, action, secondary, tone = 'default', className,
}: Props) {
  return (
    <div
      className={cn(
        'flex flex-col items-center text-center py-12 px-6',
        tone === 'default' && 'glass-card',
        className,
      )}
    >
      <div className="text-5xl mb-4" aria-hidden="true">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-white/80 mb-1.5">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-white/45 max-w-xs leading-relaxed">
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-5 bg-green-500 hover:bg-green-400 text-black font-bold px-5 py-2.5 rounded-xl transition-colors text-sm active:scale-95"
        >
          {action.label}
        </button>
      )}
      {secondary && (
        <button
          onClick={secondary.onClick}
          className="mt-3 text-xs text-white/50 hover:text-white/80 transition-colors"
        >
          {secondary.label}
        </button>
      )}
    </div>
  )
}
