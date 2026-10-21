/**
 * Calculadora do Subsídio de Natal — estimativa líquida (matemática pura).
 *
 * Sem imports de runtime (corre no browser, no servidor e no script de
 * casos-ouro `scripts/check-tools.mjs`).
 *
 * BASE LEGAL (confirmada em out. 2026 — rever todos os anos):
 *  - Art. 263.º do Código do Trabalho (setor privado): o subsídio vale um mês
 *    de retribuição e paga-se até 15 de dezembro; é proporcional ao tempo de
 *    serviço no ano civil no ano de admissão, no ano de cessação e quando o
 *    contrato é suspenso por facto respeitante ao trabalhador. Na função
 *    pública rege o art. 151.º da LTFP (pago em novembro).
 *  - TSU do trabalhador: 11% (Código dos Regimes Contributivos / Segurança
 *    Social, regime geral). Outros regimes (ex.: função pública) podem ter
 *    descontos diferentes — a ferramenta avisa.
 *  - Art. 99.º-C n.º 5 e 6 do CIRS: o subsídio de Natal tem SEMPRE retenção
 *    autónoma (não se soma ao salário do mês) e, se for pago em duodécimos,
 *    retém-se em cada pagamento a parte proporcional do imposto calculado
 *    sobre o subsídio.
 *
 * NÃO embutimos tabelas de retenção (mudam todos os anos e dependem da
 * situação familiar): o utilizador indica a taxa. Isto mantém a ferramenta
 * honesta — é uma ESTIMATIVA; o valor final é o do recibo de vencimento.
 */

export const TSU_WORKER_RATE = 0.11
export const MAX_WITHHOLDING_PCT = 60

export interface SubsidioNatalInput {
  /** Retribuição base mensal bruta (+ diuturnidades, se as houver), em euros. */
  baseMensalBruto: number
  /** Meses trabalhados no ano civil (1–12). Menos de 12 = proporcional (art. 263.º). */
  mesesTrabalhados: number
  /** Taxa de retenção de IRS, em % (0–60), a que aparece no recibo. */
  taxaRetencaoPct: number
  /** Recebe o subsídio diluído em duodécimos (só muda como é apresentado). */
  emDuodecimos: boolean
}

export interface SubsidioNatalResult {
  bruto:   number
  tsu:     number
  irs:     number
  liquido: number
  /**
   * Fatia líquida mensal se o subsídio vier em duodécimos: líquido repartido
   * pelos meses trabalhados (12 num ano completo → líquido/12).
   */
  porMesSeDuodecimos: number
  /** Valores efetivamente usados depois de limpar a entrada. */
  mesesUsados: number
  taxaUsada:   number
}

function finitePositive(n: number): number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0
}

export function roundCents(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function computeSubsidioNatal(input: SubsidioNatalInput): SubsidioNatalResult {
  const base  = finitePositive(input.baseMensalBruto)
  const meses = Math.min(12, Math.max(1, Math.round(finitePositive(input.mesesTrabalhados) || 12)))
  const taxa  = Math.min(MAX_WITHHOLDING_PCT, finitePositive(input.taxaRetencaoPct))

  const bruto   = roundCents((base * meses) / 12)
  const tsu     = roundCents(bruto * TSU_WORKER_RATE)
  const irs     = roundCents((bruto * taxa) / 100)
  const liquido = roundCents(bruto - tsu - irs)

  return {
    bruto,
    tsu,
    irs,
    liquido,
    porMesSeDuodecimos: roundCents(liquido / meses),
    mesesUsados: meses,
    taxaUsada:   taxa,
  }
}

/**
 * Divide o líquido em 3 partes por percentagem (somam 100). A última parte
 * leva o resto, para os euros somarem sempre exatamente o líquido.
 */
export function splitPlan(liquido: number, pctA: number, pctB: number) {
  const a = roundCents((liquido * pctA) / 100)
  const b = roundCents((liquido * pctB) / 100)
  const c = roundCents(liquido - a - b)
  return { a, b, c }
}
