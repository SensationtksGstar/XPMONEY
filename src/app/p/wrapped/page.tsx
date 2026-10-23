import type { Metadata } from 'next'
import { getServerT } from '@/lib/i18n/server'
import { SharePage } from '../_lib/SharePage'
import { MASCOT_OG_VER } from '../_lib/ogVersion'

/**
 * /p/wrapped — destino PÚBLICO da partilha do Wrapped-lite ("O teu ano na
 * XP-Money", último slide de /wrapped).
 *
 * GENÉRICA de propósito: não sabe quem partilhou nem mostra números de
 * ninguém (sem dias, sem XP, sem euros) — o convite é "vê o teu". Sem ano
 * no texto para não envelhecer entre deploys. noindex,follow — é destino de
 * partilha, não página de SEO. O CTA leva só `?ref=share-wrapped`.
 */

const PATH = '/p/wrapped'

export async function generateMetadata(): Promise<Metadata> {
  const t       = await getServerT()
  const title   = t('wrapped.sharepage_meta_title')
  const desc    = t('wrapped.sharepage_meta_desc')
  const ogImage = `${PATH}/opengraph-image`
  return {
    title,
    description: desc,
    alternates:  { canonical: PATH },
    robots:      { index: false, follow: true },
    openGraph: {
      type:   'website',
      title,
      description: desc,
      url:    `https://xp-money.com${PATH}`,
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

export default async function WrappedSharePage() {
  const t = await getServerT()

  return (
    <SharePage
      eyebrow={t('wrapped.sharepage_eyebrow')}
      visual={
        <div className="flex items-end justify-center gap-2" aria-hidden>
          {/* Mesmos PNGs da OG (scripts/build-og-mascots.mjs); ?v= = hash do conteúdo. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/mascot/og/voltix-4.png?v=${MASCOT_OG_VER}`}
            alt=""
            width={150}
            height={150}
            className="w-[150px] h-[150px] object-contain"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/mascot/og/penny-4.png?v=${MASCOT_OG_VER}`}
            alt=""
            width={150}
            height={150}
            className="w-[150px] h-[150px] object-contain"
          />
        </div>
      }
      title={t('wrapped.sharepage_title')}
      sub={t('wrapped.sharepage_sub')}
      ctaHref="/sign-up?ref=share-wrapped"
      ctaLabel={t('sharepage.cta')}
      ctaNote={t('sharepage.cta_note')}
      learnMore={t('sharepage.learn_more')}
    />
  )
}
