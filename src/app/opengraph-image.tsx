import { ImageResponse } from 'next/og'

export const alt = 'XP Money — Controla as tuas finanças como um RPG'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width:      '100%',
          height:     '100%',
          display:    'flex',
          alignItems: 'center',
          background: 'radial-gradient(circle at 30% 40%, #0b1f3a 0%, #060b14 60%)',
          position:   'relative',
          padding:    '80px',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Decorative grid */}
        <div
          style={{
            position:        'absolute',
            inset:           0,
            backgroundImage: 'linear-gradient(rgba(34,197,94,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(34,197,94,0.08) 1px, transparent 1px)',
            backgroundSize:  '60px 60px',
          }}
        />

        {/* Logo — big rounded coin */}
        <div
          style={{
            width:         '380px',
            height:        '380px',
            borderRadius:  '92px',
            background:    'linear-gradient(135deg, #4ade80 0%, #059669 100%)',
            display:       'flex',
            alignItems:    'center',
            justifyContent:'center',
            position:      'relative',
            flexShrink:    0,
            boxShadow:     '0 30px 80px -20px rgba(74, 222, 128, 0.6)',
          }}
        >
          <div
            style={{
              position:     'absolute',
              inset:        '18px',
              borderRadius: '74px',
              background:   '#060b14',
              overflow:     'hidden',
              display:      'flex',
              alignItems:   'center',
              justifyContent:'center',
            }}
          >
            {/* Emerald top */}
            <div
              style={{
                position:   'absolute',
                top:        0,
                left:       0,
                right:      0,
                height:     '50%',
                background: 'linear-gradient(180deg, #34d399 0%, #059669 100%)',
              }}
            />
            {/* Divider */}
            <div
              style={{
                position:   'absolute',
                top:        '50%',
                left:       0,
                right:      0,
                height:     '6px',
                background: '#060b14',
              }}
            />
            {/* Bolt */}
            <div
              style={{
                fontSize:   280,
                color:      '#facc15',
                zIndex:     10,
                transform:  'translateY(8px)',
                textShadow: '0 0 40px rgba(250, 204, 21, 0.8)',
              }}
            >
              ⚡
            </div>
          </div>
        </div>

        {/* Text side */}
        <div
          style={{
            marginLeft: '70px',
            display:    'flex',
            flexDirection:'column',
          }}
        >
          <div
            style={{
              fontSize:    112,
              fontWeight:  900,
              color:       '#ffffff',
              lineHeight:  1,
              letterSpacing:'-3px',
            }}
          >
            XP Money
          </div>
          <div
            style={{
              marginTop:  18,
              fontSize:   34,
              color:      '#4ade80',
              fontWeight: 600,
            }}
          >
            Controla as tuas finanças como um RPG
          </div>
          <div
            style={{
              marginTop:  36,
              display:    'flex',
              gap:        16,
            }}
          >
            {['XP', 'Missões', 'Voltix', 'Conquistas'].map(tag => (
              <div
                key={tag}
                style={{
                  padding:      '10px 20px',
                  background:   'rgba(34,197,94,0.15)',
                  border:       '1.5px solid rgba(74,222,128,0.4)',
                  borderRadius: '999px',
                  color:        '#a7f3d0',
                  fontSize:     22,
                  fontWeight:   600,
                }}
              >
                {tag}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
