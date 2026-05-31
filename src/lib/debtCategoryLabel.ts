import type { TranslationKey } from '@/lib/i18n/translations'

/**
 * Locale glue for debt categories. `DEBT_CATEGORIES` (in killDebt.ts) keeps
 * PT-only labels because that lib is pure/runtime-translation-free; this
 * module maps the predefined ids to translation keys so the UI can show
 * them in the active locale. User-created (custom) categories have no key
 * and fall back to their raw label.
 */
export const DEBT_CAT_KEY: Record<string, TranslationKey> = {
  cartao:     'debtcat.cartao',
  pessoal:    'debtcat.pessoal',
  carro:      'debtcat.carro',
  hipoteca:   'debtcat.hipoteca',
  educacao:   'debtcat.educacao',
  prestacoes: 'debtcat.prestacoes',
  familia:    'debtcat.familia',
  outro:      'debtcat.outro',
}

/** Known ids translate via t(); custom ids show their raw label verbatim. */
export function catLabel(
  id: string,
  rawLabel: string,
  t: (k: TranslationKey) => string,
): string {
  const key = DEBT_CAT_KEY[id]
  return key ? t(key) : rawLabel
}
