import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getServerT } from '@/lib/i18n/server'
import { SharePage } from '../../_lib/SharePage'
import { evoSlugs, parseEvoSlug } from '../../_lib/share'
import { MASCOT_OG_VER } from '../../_lib/ogVersion'

/**
 * /p/evo/[slug] — destino PÚBLICO da partilha de uma evolução da mascote
 * (botão "Partilhar" no fim da MascotEvolutionCinematic).
 *
 * slug ∈ {voltix,penny}-{2..6} (conjunto fechado, generateStaticParams,
 * dynamicParams=false → 404 real fora dele). Sem dados pessoais nem euros:
 * só a forma. noindex,follow — é destino de partilha, não página de SEO.
 */

export const dynamicParams = false

export function generateStaticParams() {
  return evoSlugs().map(slug => ({ slug }))
}

type PageProps = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const share    = parseEvoSlug(slug)
  if (!share) return {}
  const t       = await getServerT()
  const title   = t('sharepage.evo_meta_title', { name: share.name })
  const desc    = t('sharepage.meta_desc')
  const path    = `/p/evo/${slug}`
  const ogImage = `${path}/opengraph-image`
  return {
    title,
    description: desc,
    alternates:  { canonical: path },
    robots:      { index: false, follow: true },
    openGraph: {
      type:   'website',
      title,
      description: desc,
      url:    `https://xp-money.com${path}`,
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card:        'summary_large_image',
      title,
      description: desc,
      images:      [ogImage],
    },
  }
}

export default async function EvoSharePage({ params }: PageProps) {
  const { slug } = await params
  const share    = parseEvoSlug(slug)
  if (!share) notFound()
  const t = await getServerT()

  return (
    <SharePage
      eyebrow={t('sharepage.evo_eyebrow')}
      visual={
        // PNG gerado por scripts/build-og-mascots.mjs (o mesmo da OG). O ?v=
        // é o hash do conteúdo (ogVersion.ts, gerado pelo script): o SW serve
        // imagens cache-first, por isso um re-corte tem de mudar o URL.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/mascot/og/${share.gender}-${share.evo}.png?v=${MASCOT_OG_VER}`}
          alt={t('sharepage.evo_img_alt', { name: share.name })}
          width={220}
          height={220}
          className="w-[220px] h-[220px] object-contain"
        />
      }
      title={t('sharepage.evo_title', { name: share.name })}
      sub={t('sharepage.evo_sub')}
      ctaHref="/sign-up?ref=share-evo"
      ctaLabel={t('sharepage.cta')}
      ctaNote={t('sharepage.cta_note')}
      learnMore={t('sharepage.learn_more')}
    />
  )
}
