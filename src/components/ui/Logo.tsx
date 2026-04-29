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
 * XP-Money logo — v4 "3D Digivice" (April 2026).
 *
 * v3 was flat gradients; v4 adds bevel highlight, ambient occlusion under
 * the screen, glossy diagonal sheen, and a specular streak on the bolt.
 * Light direction is consistently top-left across every layer so the logo
 * reads as a polished moulded device, not a sticker.
 *
 * Renders inline (not as an `<img src>`) so the gradients stay crisp at
 * any size and the SVG can inherit colour from the surrounding text.
 *
 * Stays legible down to ~16 px — the bolt + chassis silhouette remain
 * the dominant shapes; the bevel and sheen layers drop below detection
 * threshold but don't break the glyph.
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
        aria-label="XP-Money"
        className="flex-shrink-0 drop-shadow-[0_3px_10px_rgba(16,185,129,0.35)]"
      >
        <defs>
          {/* Body face — vertical gradient for "lit-from-above" base. */}
          <linearGradient id="lg-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#34d399" />
            <stop offset="48%"  stopColor="#10b981" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>
          {/* Top bevel — bright sliver along the lit edge. */}
          <linearGradient id="lg-bevel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#a7f3d0" stopOpacity="0.95" />
            <stop offset="40%"  stopColor="#a7f3d0" stopOpacity="0" />
          </linearGradient>
          {/* Bottom shade — curved-away edge. */}
          <linearGradient id="lg-shade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="60%"  stopColor="#022c22" stopOpacity="0" />
            <stop offset="100%" stopColor="#022c22" stopOpacity="0.55" />
          </linearGradient>
          {/* Diagonal gloss sheen. */}
          <linearGradient id="lg-sheen" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.32" />
            <stop offset="55%"  stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          {/* Screen — radial bloom centred on the upper-left. */}
          <radialGradient id="lg-screen" cx="35%" cy="32%" r="80%">
            <stop offset="0%"   stopColor="#1e293b" />
            <stop offset="60%"  stopColor="#0a1220" />
            <stop offset="100%" stopColor="#02060d" />
          </radialGradient>
          {/* Bolt body. */}
          <linearGradient id="lg-bolt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#d9f99d" />
            <stop offset="35%"  stopColor="#86efac" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
          {/* Bolt specular streak. */}
          <linearGradient id="lg-glint" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="50%"  stopColor="#ffffff" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Outer dark base — slightly oversized so the body sits ON it. */}
        <rect x="3.5" y="3.5" width="57" height="57" rx="13" fill="#064e3b" />
        {/* Body face. */}
        <rect x="4" y="4" width="56" height="56" rx="12" fill="url(#lg-body)" />
        {/* Top bevel highlight. */}
        <rect x="4" y="4" width="56" height="56" rx="12" fill="url(#lg-bevel)" opacity="0.9" />
        {/* Bottom shade. */}
        <rect x="4" y="4" width="56" height="56" rx="12" fill="url(#lg-shade)" />
        {/* Diagonal sheen. */}
        <rect x="4" y="4" width="56" height="56" rx="12" fill="url(#lg-sheen)" />
        {/* Crisp inner edge stroke. */}
        <rect x="4.5" y="4.5" width="55" height="55" rx="11.5"
              fill="none" stroke="#022c22" strokeOpacity="0.7" strokeWidth="1" />

        {/* Antenna bump. */}
        <circle cx="32" cy="6.5" r="1.2" fill="#022c22" />
        <circle cx="32" cy="6.5" r="0.9" fill="#86efac" opacity="0.9" />

        {/* Side buttons. */}
        <rect x="4" y="25" width="2.5" height="6" rx="1" fill="#022c22" />
        <rect x="4" y="25" width="0.6" height="6" rx="0.3" fill="#a7f3d0" opacity="0.45" />
        <rect x="4" y="32" width="2.5" height="6" rx="1" fill="#022c22" />
        <rect x="4" y="32" width="0.6" height="6" rx="0.3" fill="#a7f3d0" opacity="0.45" />
        <rect x="57.5" y="28" width="2.5" height="8" rx="1" fill="#022c22" />

        {/* Screen — recessed (ambient occlusion ring + face + inner shadow). */}
        <rect x="11" y="13" width="42" height="36" rx="6" fill="#022c22" opacity="0.7" />
        <rect x="12" y="14" width="40" height="34" rx="5" fill="url(#lg-screen)" />
        <rect x="12" y="14" width="40" height="3" rx="5" fill="#000000" opacity="0.45" />
        <rect x="12" y="14" width="40" height="34" rx="5"
              fill="none" stroke="#10b981" strokeOpacity="0.55" strokeWidth="0.6" />

        {/* BTC accent (live LED feel). */}
        <circle cx="46" cy="20" r="2.4" fill="#f7931a" opacity="0.25" />
        <circle cx="46" cy="20" r="1.6" fill="#f7931a" />
        <circle cx="45.5" cy="19.5" r="0.6" fill="#fef3c7" opacity="0.95" />

        {/* Lightning bolt — drop shadow + body + edge stroke + specular streak. */}
        <path d="M 38 18 L 22 34 L 29.5 34 L 27 45 L 43 29 L 35.5 29 L 38 18 Z"
              fill="#000000" opacity="0.55" transform="translate(0.6, 0.8)" />
        <path d="M 37 18 L 21 34 L 28.5 34 L 26 45 L 42 29 L 34.5 29 L 37 18 Z"
              fill="url(#lg-bolt)" />
        <path d="M 37 18 L 21 34 L 28.5 34 L 26 45 L 42 29 L 34.5 29 L 37 18 Z"
              fill="none" stroke="#064e3b" strokeOpacity="0.7" strokeWidth="0.6" />
        <path d="M 37 18 L 32 27 L 27 31 L 21 34 Z" fill="url(#lg-glint)" />
        <circle cx="36.5" cy="18.5" r="0.9" fill="#ffffff" opacity="0.95" />
      </svg>

      {showText && (
        <span className={cn('font-bold text-white tracking-tight', textClass)}>
          XP-Money
        </span>
      )}
    </span>
  )
}
