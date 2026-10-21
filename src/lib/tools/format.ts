/**
 * Formatação mínima para as ilhas das ferramentas públicas.
 *
 * Não reutiliza src/lib/utils (puxa date-fns + clsx/tailwind-merge) para
 * manter a ilha client pequena. Mesmo contrato de formatCurrency: EUR com
 * 2 casas, pt-PT / en-US.
 */
export type ToolLocale = 'pt' | 'en'

const intlLocale = (l: ToolLocale) => (l === 'en' ? 'en-US' : 'pt-PT')

export function fmtEUR(n: number, locale: ToolLocale): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n)
}

/** 0,5384 → "54%" (inteiro). */
export function fmtPct(fraction: number, locale: ToolLocale): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: 'percent', maximumFractionDigits: 0,
  }).format(fraction)
}

/** Substitui {chave} num texto já traduzido (os rótulos vêm do servidor). */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`))
}
