import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width:         '100%',
          height:        '100%',
          display:       'flex',
          alignItems:    'center',
          justifyContent:'center',
          background:    'linear-gradient(135deg, #4ade80 0%, #059669 100%)',
          borderRadius:  '38px',
          position:      'relative',
        }}
      >
        {/* Dark core */}
        <div
          style={{
            position:      'absolute',
            inset:         '10px',
            borderRadius:  '30px',
            background:    '#060b14',
            display:       'flex',
            alignItems:    'center',
            justifyContent:'center',
          }}
        >
          {/* Emerald top half */}
          <div
            style={{
              position:     'absolute',
              top:          0,
              left:         0,
              right:        0,
              height:       '50%',
              background:   'linear-gradient(180deg, #34d399 0%, #059669 100%)',
              borderTopLeftRadius:  '30px',
              borderTopRightRadius: '30px',
            }}
          />
          {/* Divider */}
          <div
            style={{
              position:   'absolute',
              top:        '50%',
              left:       0,
              right:      0,
              height:     '4px',
              background: '#060b14',
            }}
          />
          {/* Lightning bolt */}
          <div
            style={{
              fontSize:   128,
              lineHeight: 1,
              fontWeight: 900,
              color:      '#facc15',
              zIndex:     10,
              transform:  'translateY(4px)',
              textShadow: '0 0 20px rgba(250, 204, 21, 0.6)',
            }}
          >
            ⚡
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
