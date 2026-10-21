import Link from 'next/link'
import type { ReactNode } from 'react'
import { Logo }            from '@/components/ui/Logo'
import { LandingFooter }   from '@/components/landing/LandingFooter'
import { LanguageToggle }  from '@/components/common/LanguageToggle'
import { JsonLd }          from '@/components/seo/JsonLd'
import { breadcrumb, faqPage } from '@/lib/seo/jsonLd'
import { getServerT, getServerLocale } from '@/lib/i18n/server'
import { toolPath } from '@/lib/tools/registry'

/**
 * ToolShell — o template ÚNICO das ferramentas grátis públicas (/ferramentas/*).
 *
 * Server Component. A ilha interativa entra como `children` e é a única
 * parte 'use client' da página.
 *
 * REGRAS (valem para todas as ferramentas — não regredir):
 *  - Páginas públicas, SEM Clerk e SEM PostHog: nada de importar
 *    @clerk/nextjs nem '@/lib/posthog' aqui ou na ilha (o guard
 *    `node scripts/check-guards.mjs` falha se acontecer).
 *  - A ilha não usa recharts, framer-motion nem fetch. O resultado vive num
 *    <output aria-live="polite">.
 *  - NENHUM valor financeiro vai no URL, na query string ou no #fragmento.
 *    O CTA só leva `?ref=tool-…` (atribuição), nunca números.
 *  - A copy nunca diz "IA". Aviso "estimativa" sempre que o número depender
 *    de dados que o utilizador não nos dá.
 *
 * Estilo Apple-calm: superfícies neutras + hairline, verde #27c26b só no
 * CTA/sucesso, zero glow, texto >= 12px, gutter mobile de 16px.
 */

const SITE_URL = 'https://xp-money.com'

export interface ToolSource { label: string; href: string }
export interface ToolFaq    { q: string; a: string }

interface ToolShellProps {
  slug:     string
  title:    string
  intro:    string
  /** Descrição curta (JSON-LD WebApplication). */
  description: string
  /** A ilha client. */
  children: ReactNode
  /** Corpo da secção "Como calculamos" (fórmula, limitações). */
  howWeCalculate: ReactNode
  sources:    ToolSource[]
  /** ISO `YYYY-MM-DD` da última verificação dos números/fontes. */
  verifiedAt: string
  faq:        ToolFaq[]
  /** Ex.: '/sign-up?ref=tool-503020' — só atribuição, nunca valores. */
  ctaHref:    string
  ctaTitle?:  string
  ctaDesc?:   string
  ctaButton?: string
}

/** Cromado partilhado (nav + rodapé) — usado pelo hub e pelo ToolShell. */
export async function ToolsFrame({ children }: { children: ReactNode }) {
  const t = await getServerT()
  return (
    <main className="min-h-screen text-white">
      <nav className="sticky top-0 z-40 flex items-center justify-between border-b border-white/5 bg-surface-0/85 px-4 py-3 backdrop-blur-md sm:px-6 sm:py-4">
        <Link href="/" className="flex min-h-[44px] items-center gap-2">
          <Logo size={28} />
          <span className="font-bold tracking-tight text-white">XP-Money</span>
        </Link>
        <div className="flex items-center gap-3">
          <LanguageToggle />
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center text-sm text-white/70 transition-colors hover:text-white"
          >
            ← {t('blog.back_home')}
          </Link>
        </div>
      </nav>
      {children}
      <LandingFooter />
    </main>
  )
}

export async function ToolShell({
  slug, title, intro, description, children, howWeCalculate, sources,
  verifiedAt, faq, ctaHref, ctaTitle, ctaDesc, ctaButton,
}: ToolShellProps) {
  const t      = await getServerT()
  const locale = await getServerLocale()
  const path   = toolPath(slug)

  const verifiedLabel = t('tools.verified_at', {
    date: new Date(verifiedAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'pt-PT', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
    }),
  })

  const webApp = {
    '@context':          'https://schema.org',
    '@type':             'WebApplication',
    name:                title,
    description,
    url:                 `${SITE_URL}${path}`,
    applicationCategory: 'FinanceApplication',
    operatingSystem:     'Any',
    inLanguage:          locale === 'en' ? 'en-US' : 'pt-PT',
    isAccessibleForFree: true,
    offers:              { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    publisher:           { '@type': 'Organization', name: 'XP-Money', url: SITE_URL },
  }

  return (
    <ToolsFrame>
      <JsonLd schema={breadcrumb([
        { name: t('tools.breadcrumb_home'),  href: '/' },
        { name: t('tools.breadcrumb_tools'), href: '/ferramentas' },
        { name: title,                       href: path },
      ])} />
      <JsonLd schema={webApp} />
      {faq.length >= 3 && <JsonLd schema={faqPage(faq)} />}

      <article className="mx-auto max-w-3xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
        <nav aria-label="breadcrumb" className="mb-5 text-xs text-white/60">
          <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <li><Link href="/" className="hover:text-white">{t('tools.breadcrumb_home')}</Link></li>
            <li aria-hidden>›</li>
            <li><Link href="/ferramentas" className="hover:text-white">{t('tools.breadcrumb_tools')}</Link></li>
            <li aria-hidden>›</li>
            <li aria-current="page" className="text-white/80">{title}</li>
          </ol>
        </nav>

        <header className="mb-8">
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{title}</h1>
          <p className="mt-3 text-base leading-relaxed text-white/70">{intro}</p>
        </header>

        {/* A ilha client (única parte interativa da página). */}
        <section className="rounded-2xl border border-hairline bg-surface-1 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.4)] sm:p-6">
          {children}
          <p className="mt-5 border-t border-divider pt-4 text-xs leading-relaxed text-white/60">
            {t('tools.privacy_note')}
          </p>
        </section>

        <section className="mt-12" aria-labelledby={`${slug}-how`}>
          <h2 id={`${slug}-how`} className="text-xl font-bold">{t('tools.how_title')}</h2>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-white/75">{howWeCalculate}</div>

          <h3 className="mt-6 text-sm font-bold text-white/90">{t('tools.sources')}</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-white/75">
            {sources.map(s => (
              <li key={s.href}>
                {s.href.startsWith('/') ? (
                  <Link href={s.href} className="text-green-300 underline-offset-2 hover:underline">{s.label}</Link>
                ) : (
                  <a href={s.href} target="_blank" rel="noopener noreferrer" className="text-green-300 underline-offset-2 hover:underline">
                    {s.label}
                  </a>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-white/60">{verifiedLabel}</p>
        </section>

        <section className="mt-12" aria-labelledby={`${slug}-faq`}>
          <h2 id={`${slug}-faq`} className="text-xl font-bold">{t('tools.faq_title')}</h2>
          <div className="mt-3 divide-y divide-divider rounded-2xl border border-hairline bg-surface-1">
            {faq.map(item => (
              <details key={item.q} className="group px-4 sm:px-5">
                <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 py-3 text-sm font-semibold text-white [&::-webkit-details-marker]:hidden">
                  <span>{item.q}</span>
                  <span aria-hidden className="shrink-0 text-white/50 transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="pb-4 text-sm leading-relaxed text-white/75">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <aside className="mt-12 rounded-2xl border border-hairline bg-surface-1 p-6 text-center">
          <h2 className="text-lg font-bold">{ctaTitle ?? t('tools.cta_title')}</h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-white/70">{ctaDesc ?? t('tools.cta_desc')}</p>
          <Link
            href={ctaHref}
            className="mt-4 inline-flex min-h-[48px] items-center justify-center rounded-xl bg-brand-500 px-6 text-sm font-bold text-black transition-colors hover:bg-brand-400 touch-manipulation"
          >
            {ctaButton ?? t('tools.cta_button')}
          </Link>
        </aside>
      </article>
    </ToolsFrame>
  )
}
