import { cn } from '@/lib/utils'

interface Props {
  size?:      'xs' | 'sm' | 'md' | 'lg'
  tone?:      'light' | 'dark' | 'brand'
  className?: string
  /** Accessible label for screen readers. Default: "A carregar" */
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
  size = 'sm', tone = 'light', className, label = 'A carregar',
}: Props) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        'inline-block rounded-full animate-spin',
        SIZE_MAP[size],
        TONE_MAP[tone],
        className,
      )}
    />
  )
}
