'use client'

import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/LocaleProvider'

interface Props {
  size?:      'xs' | 'sm' | 'md' | 'lg'
  tone?:      'light' | 'dark' | 'brand'
  className?: string
  /** Accessible label for screen readers. Default: translated "Loading". */
  label?:     string
}

const SIZE_MAP = {
  xs: 'w-3 h-3 border',
  sm: 'w-4 h-4 border-2',
  md: 'w-5 h-5 border-2',
  lg: 'w-6 h-6 border-[3px]',
}

const TONE_MAP = {
  light: 'border-white/25 border-t-white',
  dark:  'border-black/20 border-t-black',
  brand: 'border-green-500/30 border-t-green-500',
}

/**
 * Universal spinner.
 * Used inside submit buttons, loading overlays, and progress indicators.
 */
export function Spinner({
  size = 'sm', tone = 'light', className, label,
}: Props) {
  const t = useT()
  return (
    <span
      role="status"
      aria-label={label ?? t('spinner.loading')}
      className={cn(
        'inline-block rounded-full animate-spin',
        SIZE_MAP[size],
        TONE_MAP[tone],
        className,
      )}
    />
  )
}
