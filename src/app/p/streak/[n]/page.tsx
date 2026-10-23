import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getServerT } from '@/lib/i18n/server'
import { SharePage } from '../../_lib/SharePage'
import { STREAK_SHARE_DAYS, parseStreakDays } from '../../_lib/share'

/**
 * /p/streak/[n] — destino PÚBLICO da partilha de um marco de sequência
 * (botão "Partilhar" no CelebrationModal de 7/30/60/100 dias).
 *
 * n ∈ {7,14,30,60,100} (conjunto fechado, generateStaticParams,
 * dynamicParams=false → 404 fora dele). Sem dados pessoais nem euros.
 * noindex,follow — destino de partilha, não página de SEO.
 */

export const dynamicParams = false

export function generateStaticParams() {
  return STREAK_SHARE_DAYS.map(n => ({ n: String(n) }))
}

type PageProps = { params: Promise<{ n: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { n: raw } = await params
  const n          = parseStreakDays(raw)
  if (n === null) return {}
  const t       = await getServerT()
  const title   = t('sharepage.streak_meta_title', { n })
  const desc    = t('sharepage.meta_desc')
  const path    = `/p/streak/${n}`
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

export default async function StreakSharePage({ params }: PageProps) {
  const { n: raw } = await params
  const n          = parseStreakDays(raw)
  if (n === null) notFound()
  const t = await getServerT()

  return (
    <SharePage
      eyebrow={t('sharepage.streak_eyebrow')}
      visual={
        <div className="flex flex-col items-center">
          <span className="text-7xl font-bold text-white tabular-nums leading-none">{n}</span>
          <span className="mt-2 text-sm font-semibold text-green-400">{t('sharepage.streak_days')}</span>
        </div>
      }
      title={t('sharepage.streak_title', { n })}
      sub={t('sharepage.streak_sub')}
      ctaHref="/sign-up?ref=share-streak"
      ctaLabel={t('sharepage.cta')}
      ctaNote={t('sharepage.cta_note')}
      learnMore={t('sharepage.learn_more')}
    />
  )
}
