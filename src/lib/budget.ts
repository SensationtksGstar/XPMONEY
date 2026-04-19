/**
 * Orçamento Pessoal — lógica pura do método 50/30/20.
 *
 * - Mapeia categorias de despesa em 3 buckets: needs / wants / savings.
 * - Calcula o estado do orçamento do mês (gasto vs limite por bucket).
 * - Determina severidade de cada bucket (ok / caution / over).
 *
 * Núcleo isolado de qualquer IO (sem fetch / sem DB) para poder correr em
 * server (API) e client (computações derivadas).
 */

export type BudgetBucket = 'needs' | 'wants' | 'savings'

export interface Budget {
  id:              string
  user_id:         string
  monthly_income:  number
  pct_needs:       number
  pct_wants:       number
  pct_savings:     number
}

export interface BucketStatus {
  bucket:   BudgetBucket
  label:    string
  limit:    number     // EUR permitido pelo orçamento este mês
  spent:    number     // EUR gasto até agora
  pct:      number     // % do limite usado (pode ultrapassar 100)
  severity: 'ok' | 'caution' | 'over'
  topCategories: Array<{ name: string; icon: string | null; total: number }>
}

export interface BudgetStatus {
  month:          string   // YYYY-MM
  income:         number   // orçamento total disponível (= monthly_income)
  totalSpent:     number
  totalRemaining: number   // pode ser negativo se ultrapassar o rendimento
  buckets:        BucketStatus[]
}

export const BUCKET_LABELS: Record<BudgetBucket, string> = {
  needs:   'Necessidades',
  wants:   'Desejos',
  savings: 'Poupança',
}

export const BUCKET_DESCRIPTIONS: Record<BudgetBucket, string> = {
  needs:   'Renda, alimentação, transportes, saúde — coisas sem as quais não vives.',
  wants:   'Restaurantes, lazer, subscrições, roupas — melhora a vida mas não é crítico.',
  savings: 'Fundo de emergência, investimentos, objetivos — o teu futuro.',
}

export const BUCKET_COLORS: Record<BudgetBucket, {
  bg: string; border: string; bar: string; text: string
}> = {
  needs: {
    bg:     'bg-blue-500/10',
    border: 'border-blue-500/30',
    bar:    'from-blue-500 to-cyan-400',
    text:   'text-blue-300',
  },
  wants: {
    bg:     'bg-amber-500/10',
    border: 'border-amber-500/30',
    bar:    'from-amber-500 to-orange-400',
    text:   'text-amber-300',
  },
  savings: {
    bg:     'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    bar:    'from-emerald-500 to-green-400',
    text:   'text-emerald-300',
  },
}

/**
 * Mapeia o nome de categoria para um bucket. Heurística por keywords —
 * cobre as categorias default de `schema.sql` (PT) e as variantes comuns
 * em inglês. Categorias desconhecidas caem em 'wants' (safety default —
 * assume gasto discricionário até o user saber melhor).
 */
export function categoryToBucket(categoryName: string | null): BudgetBucket {
  if (!categoryName) return 'wants'
  const n = categoryName.toLowerCase().trim()

  // Necessidades — vivência básica
  if (/\b(renda|hipoteca|casa|habita|condomin|rent|mortgage|housing)\b/.test(n)) return 'needs'
  if (/\b(aliment|mercado|supermerc|groceri|food)\b/.test(n))                    return 'needs'
  if (/\b(sa(u|ú)de|medic|farmac|health|pharma)\b/.test(n))                       return 'needs'
  if (/\b(transp|combust(i|í)vel|gasolina|metro|autocarro|fuel)\b/.test(n))        return 'needs'
  if (/\b(educa|school|university|universidade)\b/.test(n))                        return 'needs'
  if (/\b(seguros?|insurance)\b/.test(n))                                          return 'needs'
  if (/\b(luz|(á|a)gua|electr|gas|internet|telem|telef|wifi|phone|utilit)\b/.test(n)) return 'needs'

  // Poupança / Investimento / Objetivos
  if (/\b(poupan|saving|save|invest|fundo|etf|ppr|reforma|retirement)\b/.test(n)) return 'savings'
  if (/\b(objetivo|goal|meta)\b/.test(n))                                          return 'savings'

  // Tudo o resto é wants (lazer, restaurantes, viagens, roupas, subscrições)
  return 'wants'
}

/**
 * Constrói o estado do orçamento a partir da config + transações do mês.
 *
 * @param budget    config do user (income + percentagens)
 * @param tx        transações do mês corrente, apenas type='expense'
 */
export function buildBudgetStatus(
  budget: Budget,
  tx: Array<{ amount: number; category: { name: string | null; icon: string | null } | null }>,
  month: string,
): BudgetStatus {
  const income = Number(budget.monthly_income) || 0

  const limits: Record<BudgetBucket, number> = {
    needs:   (income * Number(budget.pct_needs))   / 100,
    wants:   (income * Number(budget.pct_wants))   / 100,
    savings: (income * Number(budget.pct_savings)) / 100,
  }

  // Acumular por bucket + manter top categorias por bucket
  const spent: Record<BudgetBucket, number> = { needs: 0, wants: 0, savings: 0 }
  const byCategory: Record<BudgetBucket, Map<string, { icon: string | null; total: number }>> = {
    needs:   new Map(),
    wants:   new Map(),
    savings: new Map(),
  }

  for (const t of tx) {
    const name   = t.category?.name ?? 'Sem categoria'
    const icon   = t.category?.icon ?? null
    const bucket = categoryToBucket(name)
    const amount = Number(t.amount) || 0

    spent[bucket] += amount

    const cats = byCategory[bucket]
    const existing = cats.get(name)
    if (existing) {
      existing.total += amount
    } else {
      cats.set(name, { icon, total: amount })
    }
  }

  const buckets: BucketStatus[] = (['needs', 'wants', 'savings'] as const).map(bucket => {
    const limit = limits[bucket]
    const s     = spent[bucket]
    const pct   = limit > 0 ? (s / limit) * 100 : 0

    const severity: BucketStatus['severity'] =
      pct >= 100 ? 'over' : pct >= 80 ? 'caution' : 'ok'

    const topCategories = Array.from(byCategory[bucket].entries())
      .map(([name, v]) => ({ name, icon: v.icon, total: v.total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 4)

    return {
      bucket,
      label:   BUCKET_LABELS[bucket],
      limit,
      spent:   s,
      pct,
      severity,
      topCategories,
    }
  })

  const totalSpent = spent.needs + spent.wants + spent.savings

  return {
    month,
    income,
    totalSpent,
    totalRemaining: income - totalSpent,
    buckets,
  }
}

/**
 * Validação — as 3 percentagens devem somar exactamente 100 (tolerância 0.5).
 */
export function validatePercentages(needs: number, wants: number, savings: number): boolean {
  const sum = needs + wants + savings
  return Math.abs(sum - 100) <= 0.5
}
