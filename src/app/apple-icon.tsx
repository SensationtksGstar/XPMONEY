import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

/**
 * Apple touch icon — mirrors /public/logo.svg at 180×180.
 *
 * Implementation note: ImageResponse (Satori) doesn't render SVG <mask>
 * elements reliably, so we reproduce the negative-space bolt using two
 * absolute-positioned layers:
 *
 *   1. The emerald rounded-square token (background).
 *   2. A bolt shape via `clip-path: polygon(...)` drawn in the same color as
 *      the page background (transparent won't work in PNG — use #000 so
 *      iOS shows a crisp black bolt on emerald, which matches the wordmark
 *      feel at home-screen size).
 */
export default function AppleIcon() {
  // Bolt polygon, expressed as % of the 180×180 canvas. Matches the
  // geometry in /public/logo.svg (viewBox 512, bolt points 296→172→232→216→340→280→296).
  const bolt = [
    [57.8, 22.7],  // start top
    [33.6, 53.1],  // down-left
    [45.3, 53.1],  // kick right
    [42.2, 77.3],  // bottom point
    [66.4, 46.9],  // up-right
    [54.7, 46.9],  // kick left
    [57.8, 22.7],  // close
  ]
    .map(([x, y]) => `${x}% ${y}%`)
    .join(', ')

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
          borderRadius: '40px',
          position: 'relative',
        }}
      >
        {/* Bolt carved out — solid near-black to read as a cutout on Apple home screen */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: '#06100a',
            clipPath: `polygon(${bolt})`,
          }}
        />
      </div>
    ),
    { ...size },
  )
}
