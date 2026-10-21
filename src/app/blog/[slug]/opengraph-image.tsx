import { ImageResponse } from 'next/og'
import { getAllSlugs, getPostBySlug } from '@/lib/blog'

/**
 * OG / Twitter image por artigo — 1200x630 PNG gerado no build.
 *
 * Antes nenhum artigo tinha og:image (partilhas no WhatsApp/LinkedIn/X saiam
 * como link cru) e o JSON-LD apontava para uma imagem 404. Visual Apple-calm:
 * superficie #0b0d10, titulo a branco, verde #27c26b SO no ponto da marca.
 * Sem glow, sem gradiente. A arte da mascote fica de fora de proposito: o
 * next/og nao descodifica WebP de forma fiavel.
 */

export const alt         = 'XP-Money'
export const size        = { width: 1200, height: 630 }
export const contentType = 'image/png'

export async function generateStaticParams() {
  return getAllSlugs().map(slug => ({ slug }))
}

/** Tamanho da fonte escala com o comprimento para caber em <= 3 linhas. */
function titleFontSize(len: number): number {
  if (len <= 40) return 76
  if (len <= 70) return 64
  if (len <= 100) return 54
  return 46
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post     = getPostBySlug(slug, 'pt')

  const raw   = post?.title ?? 'XP-Money'
  const title = raw.length > 120 ? `${raw.slice(0, 117).trimEnd()}...` : raw

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
          padding:        '72px 80px',
          color:          '#ffffff',
          fontFamily:     'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div
            style={{
              width:        16,
              height:       16,
              borderRadius: 8,
              background:   '#27c26b',
              marginRight:  16,
            }}
          />
          <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: -0.5 }}>
            XP-Money
          </div>
        </div>

        <div
          style={{
            display:    'flex',
            fontSize:   titleFontSize(title.length),
            fontWeight: 700,
            lineHeight: 1.12,
            letterSpacing: -1,
            maxWidth:   1040,
          }}
        >
          {title}
        </div>

        <div style={{ display: 'flex', fontSize: 28, color: 'rgba(255,255,255,0.5)' }}>
          xp-money.com/blog
        </div>
      </div>
    ),
    { ...size },
  )
}
