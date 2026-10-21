/**
 * Calculadora 50/30/20 + fundo de emergência — matemática pura.
 *
 * Sem imports de runtime: corre no browser (ilha client), no servidor e no
 * `node --experimental-strip-types scripts/check-tools.mjs` (casos-ouro).
 *
 * As percentagens são as mesmas do Orçamento 50/30/20 da app (defaults
 * 50/30/20 em /orcamento e `validatePercentages` de src/lib/budget.ts, que
 * exige soma 100). Ficam aqui como constantes próprias porque budget.ts não
 * as exporta e importá-lo traria o resto do módulo para a ilha pública.
 *
 * O rendimento é SEMPRE o líquido mensal (o que chega à conta).
 */

export const SPLIT_503020 = { needs: 0.5, wants: 0.3, savings: 0.2 } as const

export interface Compute503020Input {
  /** Salário líquido mensal, em euros. */
  netIncome: number
  /** Renda / prestação da casa (opcional), em euros. */
  rent?: number
}

export interface Compute503020Result {
  needs:   number
  wants:   number
  savings: number
  /** Renda a dividir pelo líquido (fração: 0,54 = 54%). 0 sem renda ou sem rendimento. */
  rentShareOfIncome: number
  /** A renda sozinha já passa o bucket das necessidades (50%). */
  rentExceedsNeeds:  boolean
  /** Fundo de emergência: 3 e 6 meses de necessidades. */
  emergency3: number
  emergency6: number
  /** Quanto poupar por mês para chegar aos 3 meses em 12 meses. */
  monthlyToEmergency3In12: number
}

/** Valor finito e >= 0; qualquer outra coisa (NaN, negativo, Infinity) conta como 0. */
function clean(n: number | undefined): number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0
}

/** Arredonda a cêntimos (evita 390.00000000000006). */
export function roundCents(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function compute503020(input: Compute503020Input): Compute503020Result {
  const income = clean(input.netIncome)
  const rent   = clean(input.rent)

  const needs   = roundCents(income * SPLIT_503020.needs)
  const wants   = roundCents(income * SPLIT_503020.wants)
  const savings = roundCents(income * SPLIT_503020.savings)

  return {
    needs,
    wants,
    savings,
    rentShareOfIncome:       income > 0 ? rent / income : 0,
    rentExceedsNeeds:        rent > needs,
    emergency3:              roundCents(needs * 3),
    emergency6:              roundCents(needs * 6),
    monthlyToEmergency3In12: roundCents((needs * 3) / 12),
  }
}
