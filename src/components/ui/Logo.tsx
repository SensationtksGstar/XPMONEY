import { cn } from '@/lib/utils'

interface Props {
  /** Size in pixels. Defaults to 28. */
  size?:      number
  /** Show the "XP-Money" wordmark next to the icon. */
  showText?:  boolean
  /** Extra classes on the wordmark text. */
  textClass?: string
  /** Extra classes on the outer wrapper. */
  className?: string
}

/**
 * XP-Money logo — v5 brand refresh (June 2026).
 *
 * The hand-coded "3D Digivice" SVG (v4) was retired with the visual-identity
 * update. The new mark is a professionally-designed raster (the green "XP"
 * power-bolt tile in `public/logo-icon.webp`), so we render it as an
 * `<img>` rather than reconstructing it as inline SVG — a detailed gradient/
 * bevel raster can't be faithfully traced to clean vectors, and the source
 * art is the single source of truth across every platform (favicon, app icon,
 * social card all derive from the same kit in `public/brand/`).
 *
 * `showText` still appends the "XP-Money" wordmark next to the mark.
 */
export function Logo({ size = 28, showText = false, textClass, className }: Props) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-icon.webp"
        width={size}
        height={size}
        alt="XP-Money"
        className="flex-shrink-0 drop-shadow-[0_3px_10px_rgba(16,185,129,0.35)]"
        style={{ width: size, height: size }}
      />

      {showText && (
        <span className={cn('font-bold text-white tracking-tight', textClass)}>
          XP-Money
        </span>
      )}
    </span>
  )
}
