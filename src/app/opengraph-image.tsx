import { ImageResponse } from 'next/og'

export const alt = 'XP Money — Controla as tuas finanças como um RPG'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/**
 * OG image — v3 "Digivice" edition: emerald handheld chassis + dark screen
 * showing the signature bolt, with a subtle Bitcoin orange accent. Rendered
 * via Satori (no <mask>), so we use nested divs + clip-path for the bolt.
 */
export default function OpengraphImage() {
  // Bolt polygon as % of the inner 260×200 screen panel
  const bolt = [
    [62.5, 11.8],
    [22.5, 58.8],
    [41.3, 58.8],
    [35.0, 85.3],
    [75.0, 38.2],
    [56.3, 38.2],
    [62.5, 11.8],
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
        {/* ── Digivice chassis ── */}
        <div
          style={{
            width:         '380px',
            height:        '380px',
            borderRadius:  '80px',
            background:    'linear-gradient(135deg, #10b981 0%, #047857 100%)',
            position:      'relative',
            flexShrink:    0,
            boxShadow:     '0 40px 120px -30px rgba(16, 185, 129, 0.55)',
            display:       'flex',
          }}
        >
          {/* Antenna dot */}
          <div
            style={{
              position: 'absolute',
              top: '22px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: '#d1fae5',
              opacity: 0.55,
            }}
          />
          {/* Side buttons */}
          <div style={{ position: 'absolute', left: '10px',  top: '160px', width: '10px', height: '30px', borderRadius: '5px', background: '#064e3b', opacity: 0.85 }} />
          <div style={{ position: 'absolute', left: '10px',  top: '200px', width: '10px', height: '30px', borderRadius: '5px', background: '#064e3b', opacity: 0.85 }} />
          <div style={{ position: 'absolute', right: '10px', top: '175px', width: '10px', height: '45px', borderRadius: '5px', background: '#064e3b', opacity: 0.85 }} />

          {/* Screen */}
          <div
            style={{
              position:     'absolute',
              top:          '80px',
              left:         '60px',
              width:        '260px',
              height:       '220px',
              borderRadius: '32px',
              background:   'linear-gradient(180deg, #0a1220 0%, #050a14 100%)',
              border:       '2px solid rgba(16,185,129,0.35)',
              display:      'flex',
            }}
          >
            {/* Bolt */}
            <div
              style={{
                position:   'absolute',
                inset:      0,
                background: 'linear-gradient(180deg, #6ee7b7 0%, #10b981 100%)',
                clipPath:   `polygon(${bolt})`,
              }}
            />
            {/* BTC accent */}
            <div
              style={{
                position:       'absolute',
                top:            '20px',
                right:          '24px',
                width:          '32px',
                height:         '32px',
                borderRadius:   '50%',
                background:     '#f7931a',
                opacity:        0.6,
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                fontSize:       22,
                fontWeight:     900,
                color:          '#0a1220',
              }}
            >
              ₿
            </div>
          </div>
        </div>

        {/* Wordmark */}
        <div
          style={{
            marginLeft:    '72px',
            display:       'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              fontSize:      128,
              fontWeight:    900,
              color:         '#ffffff',
              lineHeight:    1,
              letterSpacing: '-4px',
            }}
          >
            XP Money
          </div>
          <div
            style={{
              marginTop:     22,
              fontSize:      34,
              color:         '#34d399',
              fontWeight:    500,
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
