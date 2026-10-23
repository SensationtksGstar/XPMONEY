import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { ImageResponse } from 'next/og'

/**
 * OG 1200×630 da partilha do Wrapped-lite. Estática e GENÉRICA (nenhum dado
 * de quem partilhou, nenhum ano — não envelhece entre deploys).
 *
 * Apple-calm: fundo #0b0d10, texto branco, verde #27c26b só no ponto da
 * marca e no CTA, sem glow nem gradiente. As mascotes vêm dos PNGs de
 * `scripts/build-og-mascots.mjs` (o next/og não descodifica WebP de forma
 * fiável). Copy em PT (mercado principal; a imagem não sabe o idioma).
 */

export const alt         = 'XP-Money'
export const size        = { width: 1200, height: 630 }
export const contentType = 'image/png'

async function mascotDataUri(file: string): Promise<string | null> {
  try {
    const buf = await readFile(path.join(process.cwd(), 'public', 'mascot', 'og', file))
    return `data:image/png;base64,${buf.toString('base64')}`
  } catch (err) {
    console.warn('[og/wrapped] mascot png missing — run scripts/build-og-mascots.mjs:', err)
    return null
  }
}

export default async function Image() {
  const [voltix, penny] = await Promise.all([
    mascotDataUri('voltix-4.png'),
    mascotDataUri('penny-4.png'),
  ])

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
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, paddingRight: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: 16, height: 16, borderRadius: 8, background: '#27c26b', marginRight: 16 }} />
            <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: -0.5 }}>XP-Money</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 36, color: 'rgba(255,255,255,0.6)', marginBottom: 12 }}>
              Dias, sequências, evoluções
            </div>
            <div style={{ display: 'flex', fontSize: 84, fontWeight: 700, letterSpacing: -2, lineHeight: 1.05 }}>
              O meu ano na XP-Money
            </div>
          </div>

          <div style={{ display: 'flex', fontSize: 30, color: '#27c26b', fontWeight: 700 }}>
            Começa o teu ovo grátis · xp-money.com
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', width: 420 }}>
          {voltix && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={voltix} width={240} height={240} alt="" />
          )}
          {penny && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={penny} width={200} height={200} alt="" style={{ marginLeft: -40 }} />
          )}
        </div>
      </div>
    ),
    { ...size },
  )
}
