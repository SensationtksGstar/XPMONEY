import type { Metadata } from 'next'
import Link from 'next/link'
import { ToolsFrame } from '@/components/tools/ToolShell'
import { JsonLd }     from '@/components/seo/JsonLd'
import { breadcrumb } from '@/lib/seo/jsonLd'
import { getServerT, getServerLocale } from '@/lib/i18n/server'
import { TOOLS, toolPath } from '@/lib/tools/registry'

/**
 * /ferramentas — hub das calculadoras grátis e públicas.
 *
 * Server component, SEM Clerk/PostHog (público por defeito desde que o
 * middleware só passa pelo Clerk as páginas da app). Cada ferramenta vive
 * em /ferramentas/<slug> e usa o ToolShell.
 */

export async function generateMetadata(): Promise<Metadata> {
  const t      = await getServerT()
  const locale = await getServerLocale()
  const title  = t('tools.hub.meta_title')
  const desc   = t('tools.hub.meta_desc')
  return {
    title,
    description: desc,
    alternates:  { canonical: '/ferramentas' },
    openGraph: {
      type:        'website',
      title,
      description: desc,
      url:         'https://xp-money.com/ferramentas',
      locale:      locale === 'en' ? 'en_US' : 'pt_PT',
      images:      [{ url: '/opengraph-image.png', width: 1200, height: 630 }],
    },
    twitter: {
      card:        'summary_large_image',
      title,
      description: desc,
      images:      ['/opengraph-image.png'],
    },
    robots: { index: true, follow: true },
  }
}

export default async function FerramentasHubPage() {
  const t = await getServerT()

  return (
    <ToolsFrame>
      <JsonLd schema={breadcrumb([
        { name: t('tools.breadcrumb_home'),  href: '/' },
        { name: t('tools.breadcrumb_tools'), href: '/ferramentas' },
      ])} />

      <div className="mx-auto max-w-3xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
        <header className="mb-10">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-green-400">
            {t('tools.hub.eyebrow')}
          </p>
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{t('tools.hub.title')}</h1>
          <p className="mt-3 text-base leading-relaxed text-white/70">{t('tools.hub.intro')}</p>
        </header>

        <ul className="space-y-3">
          {TOOLS.map(tool => (
            <li key={tool.id}>
              <Link
                href={toolPath(tool.slug)}
                className="block rounded-2xl border border-white/10 bg-surface-1 p-5 transition-colors hover:border-white/20 hover:bg-surface-2 touch-manipulation"
              >
                <h2 className="text-lg font-bold text-white">{t(tool.titleKey)}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-white/70">{t(tool.descKey)}</p>
                <span className="mt-3 inline-flex min-h-[44px] items-center text-sm font-semibold text-green-300">
                  {t('tools.hub.open')} →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </ToolsFrame>
  )
}
