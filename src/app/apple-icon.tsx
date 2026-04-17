import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

/**
 * Apple touch icon — matches the v3 "Digivice" logo design.
 *
 * Implementation note: Satori (used by next/og) doesn't render SVG <mask> or
 * arbitrary <path>s reliably, so we rebuild the logo with nested divs + a
 * clip-path polygon for the bolt. At 180×180 the screen + bolt + BTC accent
 * stay readable on the iOS home screen.
 */
export default function AppleIcon() {
  // Bolt geometry, as % of the screen panel (not the whole canvas). Tuned to
  // mirror the bolt in /public/logo.svg after the screen panel inset.
  const bolt = [
    [62.5, 11.8],  // top
    [22.5, 58.8],  // down-left
    [41.3, 58.8],  // kick right
    [35.0, 85.3],  // bottom point
    [75.0, 38.2],  // up-right
    [56.3, 38.2],  // kick left
    [62.5, 11.8],  // close
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
          borderRadius: '34px',
          position: 'relative',
        }}
      >
        {/* Antenna dot (top-centre chassis) */}
        <div
          style={{
            position: 'absolute',
            top: '8px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: '#d1fae5',
            opacity: 0.55,
          }}
        />

        {/* Side buttons */}
        <div style={{ position: 'absolute', left: '4px', top: '70px',  width: '4px', height: '14px', borderRadius: '2px', background: '#064e3b', opacity: 0.85 }} />
        <div style={{ position: 'absolute', left: '4px', top: '92px',  width: '4px', height: '14px', borderRadius: '2px', background: '#064e3b', opacity: 0.85 }} />
        <div style={{ position: 'absolute', right: '4px', top: '80px', width: '4px', height: '20px', borderRadius: '2px', background: '#064e3b', opacity: 0.85 }} />

        {/* Screen panel */}
        <div
          style={{
            position: 'absolute',
            top: '40px',
            left: '22px',
            width: '136px',
            height: '102px',
            borderRadius: '16px',
            background: 'linear-gradient(180deg, #0a1220 0%, #050a14 100%)',
            display: 'flex',
            border: '1px solid rgba(16,185,129,0.35)',
          }}
        >
          {/* Bolt cutout (inside screen) */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(180deg, #6ee7b7 0%, #10b981 100%)',
              clipPath: `polygon(${bolt})`,
            }}
          />
          {/* Subtle BTC orange accent (top-right of screen) */}
          <div
            style={{
              position: 'absolute',
              top: '10px',
              right: '12px',
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              background: '#f7931a',
              opacity: 0.55,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              fontWeight: 900,
              color: '#0a1220',
              fontFamily: 'sans-serif',
            }}
          >
            ₿
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
