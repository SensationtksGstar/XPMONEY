import type { Metadata } from 'next'
import { ToolShell }  from '@/components/tools/ToolShell'
import { CalcMataDividas, type CalcMataDividasLabels } from '@/components/tools/CalcMataDividas'
import { getServerT, getServerLocale } from '@/lib/i18n/server'
import { TOOLS, toolPath } from '@/lib/tools/registry'

/**
 * /ferramentas/mata-dividas — Avalanche vs Bola de Neve em euros.
 * Server component (ToolShell) + uma ilha client (CalcMataDividas). Sem
 * Clerk, sem PostHog, sem valores no URL. A matematica e a do
 * src/lib/killDebt.ts (a mesma do Planeador do /dividas).
 */

const SLUG  = 'mata-dividas'
const ENTRY = TOOLS.find(x => x.slug === SLUG)!
const PATH  = toolPath(SLUG)

export async function generateMetadata(): Promise<Metadata> {
  const t      = await getServerT()
  const locale = await getServerLocale()
  const title  = t('tools.dividas.meta_title')
  const desc   = t('tools.dividas.meta_desc')
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

export default async function MataDividasToolPage() {
  const t      = await getServerT()
  const locale = await getServerLocale()

  // Os placeholders {n}/{amount}/{interest}/{months} ficam intactos (t() sem
  // variaveis): a ilha preenche-os no cliente com o locale certo.
  const labels: CalcMataDividasLabels = {
    debtTitle:          t('tools.dividas.debt_title'),
    exampleName1:       t('tools.dividas.example_name1'),
    exampleName2:       t('tools.dividas.example_name2'),
    exampleBanner:      t('tools.dividas.example_banner'),
    exampleClear:       t('tools.dividas.example_clear'),
    nameLabel:          t('tools.dividas.name_label'),
    namePlaceholder:    t('tools.dividas.name_ph'),
    optional:           t('tools.optional'),
    balanceLabel:       t('tools.dividas.balance_label'),
    balancePlaceholder: t('tools.dividas.balance_ph'),
    rateLabel:          t('tools.dividas.rate_label'),
    ratePlaceholder:    t('tools.dividas.rate_ph'),
    minLabel:           t('tools.dividas.min_label'),
    minPlaceholder:     t('tools.dividas.min_ph'),
    minHint:            t('tools.dividas.min_hint'),
    remove:             t('tools.dividas.remove'),
    add:                t('tools.dividas.add'),
    maxReached:         t('tools.dividas.max_reached'),
    rowIncomplete:      t('tools.dividas.row_incomplete'),
    errorNumber:        t('tools.error_number'),
    errorRate:          t('tools.dividas.error_rate'),
    extraLabel:         t('tools.dividas.extra_label'),
    extraHint:          t('tools.dividas.extra_hint'),
    extraPlaceholder:   t('tools.dividas.extra_ph'),
    empty:              t('tools.dividas.empty'),
    incompleteNote:     t('tools.dividas.incomplete_note'),
    resultTitle:        t('tools.dividas.result_title'),
    avalancheTitle:     t('tools.dividas.avalanche_title'),
    avalancheDesc:      t('tools.dividas.avalanche_desc'),
    snowballTitle:      t('tools.dividas.snowball_title'),
    snowballDesc:       t('tools.dividas.snowball_desc'),
    freeIn:             t('tools.dividas.free_in'),
    totalInterest:      t('tools.dividas.total_interest'),
    attackOrder:        t('tools.dividas.attack_order'),
    infiniteValue:      t('tools.dividas.infinite_value'),
    infiniteWarn:       t('tools.dividas.infinite_warn'),
    cheaper:            t('tools.dividas.cheaper'),
    equivTitle:         t('tools.dividas.equiv_title'),
    equivBody:          t('tools.dividas.equiv_body'),
    betterAvalanche:    t('tools.dividas.better_avalanche'),
    betterSnowball:     t('tools.dividas.better_snowball'),
    caveat:             t('tools.dividas.caveat'),
    whatIfTitle:        t('tools.dividas.whatif_title'),
    whatIfIntro:        t('tools.dividas.whatif_intro'),
    perMonth:           t('tools.dividas.per_month'),
    whatIfCurrent:      t('tools.dividas.whatif_current'),
    whatIfBase:         t('tools.dividas.whatif_base'),
    whatIfNone:         t('tools.dividas.whatif_none'),
    whatIfEnds:         t('tools.dividas.whatif_ends'),
    whatIfNever:        t('tools.dividas.whatif_never'),
    whatIfSavesInterest: t('tools.dividas.whatif_saves_interest'),
    whatIfSavesBoth:    t('tools.dividas.whatif_saves_both'),
    whatIfSavesMonths:  t('tools.dividas.whatif_saves_months'),
  }

  return (
    <ToolShell
      slug={SLUG}
      title={t('tools.dividas.meta_title')}
      intro={t('tools.dividas.intro')}
      description={t('tools.dividas.meta_desc')}
      verifiedAt={ENTRY.updated}
      ctaHref="/sign-up?ref=tool-mata-dividas"
      ctaTitle={t('tools.dividas.cta_title')}
      ctaDesc={t('tools.dividas.cta_desc')}
      sources={[
        { label: t('tools.dividas.src_portal'),  href: 'https://clientebancario.bportugal.pt/' },
        { label: t('tools.dividas.src_503020'),  href: '/ferramentas/regra-50-30-20' },
      ]}
      faq={[
        { q: t('tools.dividas.faq1_q'), a: t('tools.dividas.faq1_a') },
        { q: t('tools.dividas.faq2_q'), a: t('tools.dividas.faq2_a') },
        { q: t('tools.dividas.faq3_q'), a: t('tools.dividas.faq3_a') },
        { q: t('tools.dividas.faq4_q'), a: t('tools.dividas.faq4_a') },
      ]}
      howWeCalculate={
        <>
          <p>{t('tools.dividas.how_1')}</p>
          <p>{t('tools.dividas.how_2')}</p>
          <p>{t('tools.dividas.how_3')}</p>
          <p>{t('tools.dividas.how_4')}</p>
        </>
      }
    >
      <CalcMataDividas locale={locale} labels={labels} />
    </ToolShell>
  )
}
