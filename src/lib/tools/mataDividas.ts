/**
 * Mata-Dividas publico — helpers puros da ferramenta /ferramentas/mata-dividas.
 *
 * A MATEMATICA (simulatePlan / compareStrategies / orderByStrategy) vive em
 * src/lib/killDebt.ts e nunca se reimplementa aqui: este ficheiro so
 * converte as linhas do formulario em `Debt[]`, monta a escada do "E se
 * pagares mais?" e compara resultados.
 *
 * Sem imports de runtime (so `import type`): corre em
 * scripts/check-tools.mjs com --experimental-strip-types.
 */

import type { Debt } from '@/lib/killDebt'

/** Limite de dividas no formulario publico. */
export const MAX_DEBTS = 6

/** Extras fixos da tabela "E se pagares mais?" (euros por mes). */
export const WHATIF_EXTRAS: readonly number[] = [0, 50, 100, 200]

export interface DebtInput {
  name:    string
  balance: number
  /** TAEG em % ao ano (0 a 100). */
  ratePct: number
  /** Prestacao minima mensal em euros (>= 0). */
  min:     number
}

/** Resumo comum a qualquer resultado de simulatePlan. */
export interface PlanSummary {
  monthsToFree:  number
  totalInterest: number
  infinite:      boolean
}

/**
 * Linhas validas do formulario -> `Debt[]` para o killDebt.ts.
 * Os ids sao posicionais ("d1"…): a ordem de entrada e o desempate estavel
 * de orderByStrategy (Array.sort e estavel).
 */
export function toSimDebts(rows: readonly DebtInput[]): Debt[] {
  return rows.map((r, i) => ({
    id:             `d${i + 1}`,
    name:           r.name,
    category:       'outro',
    initial_amount: r.balance,
    current_amount: r.balance,
    interest_rate:  r.ratePct,
    min_payment:    r.min,
    strategy:       'avalanche',
    status:         'active',
    killed_at:      null,
    created_at:     '',
  }))
}

/**
 * Escada de extras da tabela "E se pagares mais?": 0/50/100/200 e, se o
 * extra atual for outro valor, esse tambem (ordenado, sem duplicados).
 */
export function whatIfLadder(currentExtra: number): number[] {
  const set = new Set<number>(WHATIF_EXTRAS)
  if (Number.isFinite(currentExtra) && currentExtra >= 0) {
    set.add(Math.round(currentExtra * 100) / 100)
  }
  return [...set].sort((a, b) => a - b)
}

/**
 * Os dois metodos dao o mesmo resultado? (ambos terminam, mesmos meses e
 * mesmos juros ao cêntimo). Ex.: 1 divida, ou a mais pequena ser tambem a
 * mais cara.
 */
export function plansEquivalent(a: PlanSummary, b: PlanSummary): boolean {
  if (a.infinite || b.infinite) return false
  return a.monthsToFree === b.monthsToFree
    && Math.abs(a.totalInterest - b.totalInterest) < 0.005
}

export type SavingsKind = 'saves' | 'ends' | 'never' | 'none'

export interface Savings {
  kind:     SavingsKind
  /** Juros poupados vs a base (so em 'saves'). */
  interest: number
  /** Meses poupados vs a base (so em 'saves'). */
  months:   number
}

/**
 * O que um cenario de extra poupa face a base (extra 0).
 *  - 'never' : o cenario continua sem fim.
 *  - 'ends'  : a base nunca acabava e o cenario acaba.
 *  - 'saves' : ambos acabam e poupa-se juros e/ou meses.
 *  - 'none'  : sem diferenca (a propria base).
 */
export function savingsVsBase(base: PlanSummary, row: PlanSummary): Savings {
  if (row.infinite)  return { kind: 'never', interest: 0, months: 0 }
  if (base.infinite) return { kind: 'ends',  interest: 0, months: 0 }
  const interest = Math.round((base.totalInterest - row.totalInterest) * 100) / 100
  const months   = base.monthsToFree - row.monthsToFree
  if (interest < 0.005 && months <= 0) return { kind: 'none', interest: 0, months: 0 }
  return { kind: 'saves', interest: Math.max(0, interest), months: Math.max(0, months) }
}
