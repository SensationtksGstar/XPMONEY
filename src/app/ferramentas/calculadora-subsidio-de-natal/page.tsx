import type { Metadata } from 'next'
import { ToolShell }  from '@/components/tools/ToolShell'
import { CalcSubsidioNatal, type CalcSubsidioNatalLabels } from '@/components/tools/CalcSubsidioNatal'
import { getServerT, getServerLocale } from '@/lib/i18n/server'
import { TOOLS, toolPath } from '@/lib/tools/registry'

/**
 * /ferramentas/calculadora-subsidio-de-natal — estimativa líquida do
 * subsídio de Natal + plano em 3 partes. Server component (ToolShell) +
 * uma ilha client. Sem Clerk, sem PostHog, sem valores no URL.
 *
 * Números legais (rever todos os anos, ver src/lib/tools/subsidioNatal.ts):
 * art. 263.º CT, TSU 11%, art. 99.º-C CIRS. Sem tabelas de IRS embutidas.
 */

const SLUG  = 'calculadora-subsidio-de-natal'
const ENTRY = TOOLS.find(x => x.slug === SLUG)!
const PATH  = toolPath(SLUG)

export async function generateMetadata(): Promise<Metadata> {
  const t      = await getServerT()
  const locale = await getServerLocale()
  const title  = t('tools.natal.meta_title')
  const desc   = t('tools.natal.meta_desc')
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

export default async function SubsidioNatalPage() {
  const t      = await getServerT()
  const locale = await getServerLocale()

  const labels: CalcSubsidioNatalLabels = {
    baseLabel:       t('tools.natal.base_label'),
    baseHint:        t('tools.natal.base_hint'),
    basePlaceholder: t('tools.natal.base_ph'),
    monthsLabel:     t('tools.natal.months_label'),
    monthsHint:      t('tools.natal.months_hint'),
    monthsOne:       t('tools.natal.months_one'),
    monthsMany:      t('tools.natal.months_many'),
    monthsFull:      t('tools.natal.months_full'),
    rateLabel:       t('tools.natal.rate_label'),
    rateHint:        t('tools.natal.rate_hint'),
    ratePlaceholder: t('tools.natal.rate_ph'),
    duoLabel:        t('tools.natal.duo_label'),
    duoHint:         t('tools.natal.duo_hint'),
    errorNumber:     t('tools.error_number'),
    errorRate:       t('tools.natal.rate_error'),
    empty:           t('tools.natal.empty'),
    estimate:        t('tools.natal.estimate'),
    resultTitle:     t('tools.natal.result_title'),
    gross:           t('tools.natal.gross'),
    tsu:             t('tools.natal.tsu'),
    irs:             t('tools.natal.irs'),
    net:             t('tools.natal.net'),
    perMonth:        t('tools.natal.per_month'),
    caveat:          t('tools.natal.caveat'),
    rateMissing:     t('tools.natal.rate_missing'),
    planTitle:       t('tools.natal.plan_title'),
    planIntro:       t('tools.natal.plan_intro'),
    planEmergency:   t('tools.natal.plan_emergency'),
    planDebt:        t('tools.natal.plan_debt'),
    planFun:         t('tools.natal.plan_fun'),
    planTotal:       t('tools.natal.plan_total'),
  }

  return (
    <ToolShell
      slug={SLUG}
      title={t('tools.natal.meta_title')}
      intro={t('tools.natal.intro')}
      description={t('tools.natal.meta_desc')}
      verifiedAt={ENTRY.updated}
      ctaHref="/sign-up?ref=tool-subsidio-natal"
      ctaTitle={t('tools.natal.cta_title')}
      ctaDesc={t('tools.natal.cta_desc')}
      sources={[
        { label: t('tools.natal.src_article'), href: '/blog/subsidio-de-natal' },
        { label: t('tools.natal.src_ct'),      href: 'https://www.pgdlisboa.pt/leis/lei_mostra_articulado.php?nid=1047&tabela=leis' },
        { label: t('tools.natal.src_ss'),      href: 'https://www.seg-social.pt/calculo-das-contribuicoes1' },
        { label: t('tools.natal.src_cirs'),    href: 'https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/cirs_rep/Pages/irs99c.aspx' },
        { label: t('tools.natal.src_tables'),  href: 'https://info.portaldasfinancas.gov.pt/pt/destaques/Paginas/Despacho-SEAF-2026-01-05-novas-tabela-RF-IRS-2026.aspx' },
      ]}
      faq={[
        { q: t('tools.natal.faq1_q'), a: t('tools.natal.faq1_a') },
        { q: t('tools.natal.faq2_q'), a: t('tools.natal.faq2_a') },
        { q: t('tools.natal.faq3_q'), a: t('tools.natal.faq3_a') },
        { q: t('tools.natal.faq4_q'), a: t('tools.natal.faq4_a') },
      ]}
      howWeCalculate={
        <>
          <p>{t('tools.natal.how_1')}</p>
          <p>{t('tools.natal.how_2')}</p>
          <p>{t('tools.natal.how_3')}</p>
          <p>{t('tools.natal.how_4')}</p>
          <p>{t('tools.natal.how_5')}</p>
        </>
      }
    >
      <CalcSubsidioNatal locale={locale} labels={labels} />
    </ToolShell>
  )
}
