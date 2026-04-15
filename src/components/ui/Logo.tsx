import { cn } from '@/lib/utils'

interface Props {
  /** Size in pixels. Defaults to 28. */
  size?:      number
  /** Show the "XP Money" wordmark next to the icon. */
  showText?:  boolean
  /** Extra classes on the wordmark text. */
  textClass?: string
  /** Extra classes on the outer wrapper. */
  className?: string
}

/**
 * XP Money logo — a rounded "coin" with emerald top half, dark bottom with
 * circuit grid, and a gold lightning bolt in the centre. Ties visually to the
 * Voltix mascot (electric/XP energy) and stays legible down to 16px.
 */
export function Logo({ size = 28, showText = false, textClass, className }: Props) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="XP Money"
        className="flex-shrink-0 drop-shadow-[0_2px_8px_rgba(74,222,128,0.25)]"
      >
        <defs>
          <linearGradient id="xpm-logo-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"   stopColor="#4ade80" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="xpm-logo-top" x1="0.5" y1="0" x2="0.5" y2="1">
            <stop offset="0%"   stopColor="#34d399" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="xpm-logo-bolt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#fde68a" />
            <stop offset="50%"  stopColor="#facc15" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>

        {/* Coin body */}
        <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#xpm-logo-ring)" />
        <rect x="5" y="5" width="54" height="54" rx="13" fill="#060b14" />

        {/* Emerald top half */}
        <path d="M 18 5 H 46 A 13 13 0 0 1 59 18 V 31 H 5 V 18 A 13 13 0 0 1 18 5 Z"
          fill="url(#xpm-logo-top)" />

        {/* Divider */}
        <rect x="5" y="30" width="54" height="1.5" fill="#060b14" />

        {/* Circuit accents on bottom half */}
        <g opacity="0.35" stroke="#22c55e" strokeWidth="0.6" fill="none">
          <line x1="10" y1="42" x2="22" y2="42" />
          <line x1="42" y1="42" x2="54" y2="42" />
          <circle cx="11"  cy="42" r="0.8" fill="#22c55e" />
          <circle cx="53"  cy="42" r="0.8" fill="#22c55e" />
        </g>

        {/* Central capsule */}
        <rect x="22" y="20" width="20" height="24" rx="5"
          fill="#060b14" stroke="url(#xpm-logo-ring)" strokeWidth="0.8" />

        {/* Lightning bolt */}
        <path d="M 36 22 L 26 34 L 32 34 L 29 42 L 40 30 L 33 30 L 37 22 Z"
          fill="url(#xpm-logo-bolt)" />
      </svg>

      {showText && (
        <span className={cn('font-bold text-white tracking-tight', textClass)}>
          XP Money
        </span>
      )}
    </span>
  )
}
