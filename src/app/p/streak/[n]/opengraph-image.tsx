import { ImageResponse } from 'next/og'
import { notFound } from 'next/navigation'
import { STREAK_SHARE_DAYS, parseStreakDays } from '../../_lib/share'

/**
 * OG 1200×630 da partilha de um marco de sequência. Gerada no build
 * (conjunto fechado de dias). Apple-calm: fundo #0b0d10, número grande a
 * branco, verde #27c26b só na marca e no CTA, sem glow. Copy em PT.
 */

export const alt         = 'XP-Money'
export const size        = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Conjunto fechado, como a página: fora dele → 404 (nunca "7 dias" falso).
export const dynamicParams = false

export function generateStaticParams() {
  return STREAK_SHARE_DAYS.map(n => ({ n: String(n) }))
}

export default async function Image({ params }: { params: Promise<{ n: string }> }) {
  const { n: raw } = await params
  const n          = parseStreakDays(raw)
  if (n === null) notFound()

  return new ImageResponse(
    (
      <div
        style={{
          width:          '100%',
          height:         '100%',
          display:        'flex',
          flexDirection:  'column',
          justifyContent: 'space-between',
          background:     '#0b0d10',
          padding:        '64px 80px',
          color:          '#ffffff',
          fontFamily:     'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ width: 16, height: 16, borderRadius: 8, background: '#27c26b', marginRight: 16 }} />
          <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: -0.5 }}>XP-Money</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', fontSize: 220, fontWeight: 700, letterSpacing: -8, lineHeight: 0.9 }}>
            {String(n)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 36, paddingBottom: 18 }}>
            <div style={{ display: 'flex', fontSize: 56, fontWeight: 700, letterSpacing: -1 }}>dias seguidos</div>
            <div style={{ display: 'flex', fontSize: 34, color: 'rgba(255,255,255,0.6)' }}>na XP-Money</div>
          </div>
        </div>

        <div style={{ display: 'flex', fontSize: 30, color: '#27c26b', fontWeight: 700 }}>
          Começa o teu ovo grátis · xp-money.com
        </div>
      </div>
    ),
    { ...size },
  )
}
