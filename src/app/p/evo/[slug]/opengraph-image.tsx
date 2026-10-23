import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { ImageResponse } from 'next/og'
import { notFound } from 'next/navigation'
import { evoSlugs, parseEvoSlug } from '../../_lib/share'

/**
 * OG 1200×630 da partilha de uma evolução. Gerada no build (slugs fechados).
 *
 * Apple-calm: fundo #0b0d10, texto branco, verde #27c26b só no ponto da
 * marca e no CTA, sem glow nem gradiente. A arte vem dos PNGs gerados por
 * `scripts/build-og-mascots.mjs` (public/mascot/og/<gender>-<n>.png) — o
 * next/og não descodifica WebP de forma fiável. Copy em PT (mercado
 * principal; a imagem é estática por slug, não sabe o idioma de quem vê).
 */

export const alt         = 'XP-Money'
export const size        = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Conjunto fechado, como a página: fora dele → 404 (nunca uma OG genérica).
export const dynamicParams = false

export function generateStaticParams() {
  return evoSlugs().map(slug => ({ slug }))
}

async function mascotDataUri(gender: string, evo: number): Promise<string | null> {
  try {
    const file = path.join(process.cwd(), 'public', 'mascot', 'og', `${gender}-${evo}.png`)
    const buf  = await readFile(file)
    return `data:image/png;base64,${buf.toString('base64')}`
  } catch (err) {
    console.warn('[og/evo] mascot png missing — run scripts/build-og-mascots.mjs:', err)
    return null
  }
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const share    = parseEvoSlug(slug)
  if (!share) notFound()
  const name     = share.name
  const art      = await mascotDataUri(share.gender, share.evo)

  return new ImageResponse(
    (
      <div
        style={{
          width:      '100%',
          height:     '100%',
          display:    'flex',
          background: '#0b0d10',
          padding:    '64px 72px',
          color:      '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, paddingRight: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: 16, height: 16, borderRadius: 8, background: '#27c26b', marginRight: 16 }} />
            <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: -0.5 }}>XP-Money</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 36, color: 'rgba(255,255,255,0.6)', marginBottom: 12 }}>
              A minha mascote evoluiu para
            </div>
            <div style={{ display: 'flex', fontSize: 84, fontWeight: 700, letterSpacing: -2, lineHeight: 1.05 }}>
              {name}
            </div>
          </div>

          <div style={{ display: 'flex', fontSize: 30, color: '#27c26b', fontWeight: 700 }}>
            Começa o teu ovo grátis · xp-money.com
          </div>
        </div>

        {art && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 440 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={art} width={400} height={400} alt="" />
          </div>
        )}
      </div>
    ),
    { ...size },
  )
}
