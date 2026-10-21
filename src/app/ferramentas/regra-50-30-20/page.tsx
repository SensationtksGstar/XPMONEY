import type { Metadata } from 'next'
import { ToolShell }  from '@/components/tools/ToolShell'
import { Calc503020, type Calc503020Labels } from '@/components/tools/Calc503020'
import { getServerT, getServerLocale } from '@/lib/i18n/server'
import { TOOLS, toolPath } from '@/lib/tools/registry'

/**
 * /ferramentas/regra-50-30-20 — calculadora 50/30/20 + fundo de emergência.
 * Server component (ToolShell) + uma ilha client (Calc503020). Sem Clerk,
 * sem PostHog, sem valores no URL.
 */

const SLUG  = 'regra-50-30-20'
const ENTRY = TOOLS.find(x => x.slug === SLUG)!
const PATH  = toolPath(SLUG)

export async function generateMetadata(): Promise<Metadata> {
  const t      = await getServerT()
  const locale = await getServerLocale()
  const title  = t('tools.503020.meta_title')
  const desc   = t('tools.503020.meta_desc')
  return {
    title,
    description: desc,
    alternates:  { canonical: PATH },
    openGraph: {
      type:        'website',
      title,
      description: desc,
      url:         `https://xp-money.com${PATH}`,
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

export default async function Regra503020Page() {
  const t      = await getServerT()
  const locale = await getServerLocale()

  // Os placeholders {pct}/{amount} ficam intactos (t() sem variáveis): a ilha
  // preenche-os no cliente com o locale certo.
  const labels: Calc503020Labels = {
    incomeLabel:       t('tools.503020.income_label'),
    incomeHint:        t('tools.503020.income_hint'),
    incomePlaceholder: t('tools.503020.income_ph'),
    rentLabel:         t('tools.503020.rent_label'),
    rentPlaceholder:   t('tools.503020.rent_ph'),
    optional:          t('tools.optional'),
    errorNumber:       t('tools.error_number'),
    empty:             t('tools.503020.empty'),
    resultTitle:       t('tools.503020.result_title'),
    needs:             t('tools.503020.needs'),
    needsDesc:         t('tools.503020.needs_desc'),
    wants:             t('tools.503020.wants'),
    wantsDesc:         t('tools.503020.wants_desc'),
    savings:           t('tools.503020.savings'),
    savingsDesc:       t('tools.503020.savings_desc'),
    rentShare:         t('tools.503020.rent_share'),
    rentWarn:          t('tools.503020.rent_warn'),
    emTitle:           t('tools.503020.em_title'),
    em3:               t('tools.503020.em_3'),
    em6:               t('tools.503020.em_6'),
    emPlan:            t('tools.503020.em_plan'),
    emNote:            t('tools.503020.em_note'),
  }

  return (
    <ToolShell
      slug={SLUG}
      title={t('tools.503020.meta_title')}
      intro={t('tools.503020.intro')}
      description={t('tools.503020.meta_desc')}
      verifiedAt={ENTRY.updated}
      ctaHref="/sign-up?ref=tool-503020"
      sources={[
        { label: t('tools.503020.src_article'), href: '/blog/regra-50-30-20-salario-portugues-1300' },
        { label: t('tools.503020.src_method'),  href: 'https://www.bankrate.com/banking/what-is-the-50-30-20-rule/' },
      ]}
      faq={[
        { q: t('tools.503020.faq1_q'), a: t('tools.503020.faq1_a') },
        { q: t('tools.503020.faq2_q'), a: t('tools.503020.faq2_a') },
        { q: t('tools.503020.faq3_q'), a: t('tools.503020.faq3_a') },
        { q: t('tools.503020.faq4_q'), a: t('tools.503020.faq4_a') },
      ]}
      howWeCalculate={
        <>
          <p>{t('tools.503020.how_1')}</p>
          <p>{t('tools.503020.how_2')}</p>
          <p>{t('tools.503020.how_3')}</p>
          <p>{t('tools.503020.how_4')}</p>
        </>
      }
    >
      <Calc503020 locale={locale} labels={labels} />
    </ToolShell>
  )
}
