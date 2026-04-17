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
 * XP Money logo — v3 "Digivice" edition.
 *
 * An emerald handheld-device silhouette (Digimon Digivice-inspired): chassis
 * with side buttons, a dark inner screen showing the signature lightning
 * bolt, plus a subtle Bitcoin orange accent in the top-right corner of the
 * screen to nod at crypto-aware finance without dominating the brand.
 *
 * Stays legible down to ~16px because the bolt + chassis silhouette remain
 * the dominant shapes.
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
        className="flex-shrink-0 drop-shadow-[0_2px_8px_rgba(16,185,129,0.3)]"
      >
        <defs>
          <linearGradient id="xpm-logo-chassis" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"   stopColor="#10b981" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>
          <linearGradient id="xpm-logo-bolt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#6ee7b7" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>

        {/* Chassis */}
        <rect x="4" y="4" width="56" height="56" rx="12" fill="url(#xpm-logo-chassis)" />
        {/* Depth ring */}
        <rect x="4" y="4" width="56" height="56" rx="12"
          fill="none" stroke="#064e3b" strokeWidth="0.6" strokeOpacity="0.7" />

        {/* Antenna dot */}
        <circle cx="32" cy="8" r="1.2" fill="#d1fae5" opacity="0.6" />

        {/* Side buttons */}
        <rect x="5"  y="26" width="2" height="5" rx="1" fill="#064e3b" />
        <rect x="5"  y="33" width="2" height="5" rx="1" fill="#064e3b" />
        <rect x="57" y="29" width="2" height="7" rx="1" fill="#064e3b" />

        {/* Screen */}
        <rect x="12" y="14" width="40" height="34" rx="5" fill="#0a1220" />
        <rect x="12" y="14" width="40" height="34" rx="5"
          fill="none" stroke="#10b981" strokeOpacity="0.35" strokeWidth="0.7" />

        {/* Subtle BTC orange accent in top-right of screen */}
        <circle cx="46" cy="20" r="2" fill="#f7931a" opacity="0.55" />
        <text x="46" y="22" fontSize="3" fontWeight="900" textAnchor="middle"
          fontFamily="Arial Black, sans-serif" fill="#0a1220" opacity="0.8">₿</text>

        {/* Lightning bolt */}
        <path d="M 37 18 L 21 34 L 28.5 34 L 26 45 L 42 29 L 34.5 29 L 37 18 Z"
          fill="url(#xpm-logo-bolt)" />
        {/* Bolt highlight */}
        <path d="M 37 18 L 34.5 29 L 28.5 34 Z"
          fill="#d1fae5" opacity="0.3" />
      </svg>

      {showText && (
        <span className={cn('font-bold text-white tracking-tight', textClass)}>
          XP Money
        </span>
      )}
    </span>
  )
}
