import { ImageResponse } from 'next/og'

export const alt = 'XP Money — Controla as tuas finanças como um RPG'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/**
 * OG image — minimalist composition to match the v2 logo:
 *   - deep charcoal background with a single emerald glow
 *   - large rounded-square token with negative-space bolt
 *   - wordmark right side, tight tracking, single accent
 */
export default function OpengraphImage() {
  // Bolt polygon as % of 380×380 token
  const bolt = [
    [57.8, 22.7],
    [33.6, 53.1],
    [45.3, 53.1],
    [42.2, 77.3],
    [66.4, 46.9],
    [54.7, 46.9],
    [57.8, 22.7],
  ]
    .map(([x, y]) => `${x}% ${y}%`)
    .join(', ')

  return new ImageResponse(
    (
      <div
        style={{
          width:      '100%',
          height:     '100%',
          display:    'flex',
          alignItems: 'center',
          background: 'radial-gradient(circle at 30% 45%, #0a2a1f 0%, #050807 70%)',
          position:   'relative',
          padding:    '80px',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Token */}
        <div
          style={{
            width:         '380px',
            height:        '380px',
            borderRadius:  '92px',
            background:    'linear-gradient(135deg, #10b981 0%, #047857 100%)',
            position:      'relative',
            flexShrink:    0,
            boxShadow:     '0 40px 120px -30px rgba(16, 185, 129, 0.55)',
            display:       'flex',
          }}
        >
          {/* Bolt cutout */}
          <div
            style={{
              position:  'absolute',
              inset:     0,
              background:'#050807',
              clipPath:  `polygon(${bolt})`,
            }}
          />
          {/* Hairline rim */}
          <div
            style={{
              position:     'absolute',
              inset:        0,
              borderRadius: '92px',
              border:       '2px solid rgba(255,255,255,0.08)',
            }}
          />
        </div>

        {/* Wordmark */}
        <div
          style={{
            marginLeft: '72px',
            display:    'flex',
            flexDirection:'column',
          }}
        >
          <div
            style={{
              fontSize:    128,
              fontWeight:  900,
              color:       '#ffffff',
              lineHeight:  1,
              letterSpacing:'-4px',
            }}
          >
            XP Money
          </div>
          <div
            style={{
              marginTop:  22,
              fontSize:   34,
              color:      '#34d399',
              fontWeight: 500,
              letterSpacing: '-0.5px',
            }}
          >
            Controla as tuas finanças como um RPG.
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
