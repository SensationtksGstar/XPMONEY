/**
 * Pré-normalização do texto de um montante antes de parseAmountLocale.
 *
 * parseAmountLocale lê um ponto/vírgula isolado como DECIMAL ("1.300" -> 1,3),
 * o que é o contrário do que escreve quem digita um salário em PT-PT
 * ("1.300" = mil e trezentos). Aqui, um único grupo de separador + EXATAMENTE
 * 3 dígitos (sem mais separadores decimais) é tratado como milhar:
 *   "1.300", "1,300", "12.500", "1.300.000" -> sem separadores.
 * Não toca em "1.300,50" / "1,300.50" / "12,5" / "0.500" (o primeiro grupo
 * não pode começar por 0: "0.500" é meio euro, não 500).
 *
 * NÃO usar em campos de percentagem ("7.500" nunca é milhar numa taxa).
 *
 * Sem imports de runtime: corre em scripts/check-tools.mjs.
 */
const THOUSANDS_ONLY = /^[1-9]\d{0,2}([.,]\d{3})+$/

export function stripThousandsOnly(raw: string): string {
  const compact = raw.trim().replace(/\s+/g, '')
  return THOUSANDS_ONLY.test(compact) ? compact.replace(/[.,]/g, '') : raw
}
