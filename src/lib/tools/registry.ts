import type { TranslationKey } from '@/lib/i18n/translations'

/**
 * Registo das ferramentas grátis públicas (/ferramentas/*).
 *
 * Fonte única para o hub, o sitemap e o breadcrumb. Acrescentar uma
 * ferramenta = uma entrada aqui + a página em src/app/ferramentas/<slug>/.
 *
 * `updated` é a data (ISO) da última revisão dos números/fontes — alimenta o
 * `lastModified` do sitemap em vez da data do build. Atualiza-a quando
 * reveres a matemática ou as fontes (e o "Verificado a" da página).
 *
 * Só `import type` aqui: este ficheiro é lido por sitemap.ts (servidor) e
 * nunca deve puxar o dicionário i18n para o bundle.
 */
export interface ToolEntry {
  id:       string
  /** Segmento do URL: /ferramentas/<slug>. */
  slug:     string
  titleKey: TranslationKey
  descKey:  TranslationKey
  /** ISO `YYYY-MM-DD` da última revisão. */
  updated:  string
}

export const TOOLS: readonly ToolEntry[] = [
  {
    id:       'subsidio-natal',
    slug:     'calculadora-subsidio-de-natal',
    titleKey: 'tools.natal.card_title',
    descKey:  'tools.natal.card_desc',
    updated:  '2026-10-20',
  },
  {
    id:       '503020',
    slug:     'regra-50-30-20',
    titleKey: 'tools.503020.card_title',
    descKey:  'tools.503020.card_desc',
    updated:  '2026-10-20',
  },
]

export const TOOLS_HUB_UPDATED = '2026-10-20'

export function toolPath(slug: string): string {
  return `/ferramentas/${slug}`
}
