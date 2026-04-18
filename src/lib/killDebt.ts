/**
 * Kill Debt — lógica de cálculo e categorias.
 *
 * Núcleo puro (sem fetch / sem DB) para poder ser usado tanto em API
 * routes (server) como em componentes (client). A simulação mensal é
 * determinística e termina em no máximo 600 meses (50 anos) para não
 * entrar em loops infinitos se a prestação mínima não cobrir os juros.
 */

/** Categorias pré-definidas em PT-PT. O user pode adicionar novas — o
 *  campo é apenas texto livre limitado a 40 chars. Esta lista é usada
 *  para sugestões no formulário e para escolher o ícone/cor. */
export const DEBT_CATEGORIES = [
  { id: 'cartao',      label: 'Cartão de crédito', icon: '💳' },
  { id: 'pessoal',     label: 'Crédito pessoal',   icon: '🏦' },
  { id: 'carro',       label: 'Crédito auto',      icon: '🚗' },
  { id: 'hipoteca',    label: 'Hipoteca',          icon: '🏠' },
  { id: 'educacao',    label: 'Crédito estudante', icon: '🎓' },
  { id: 'prestacoes',  label: 'Prestações',        icon: '📦' },
  { id: 'familia',     label: 'Família / amigos',  icon: '👥' },
  { id: 'outro',       label: 'Outro',             icon: '📎' },
] as const

export type DebtCategoryId = typeof DEBT_CATEGORIES[number]['id']

/** Devolve label + ícone para uma categoria, com fallback seguro para
 *  categorias criadas pelo próprio user. */
export function resolveCategory(id: string): { label: string; icon: string } {
  const found = DEBT_CATEGORIES.find(c => c.id === id)
  if (found) return { label: found.label, icon: found.icon }
  // Categoria custom → mostra o id como label e um ícone genérico
  return { label: id, icon: '📌' }
}

export type DebtStrategy = 'avalanche' | 'snowball'
export type DebtStatus   = 'active' | 'killed'

export interface Debt {
  id:              string
  name:            string
  category:        string
  initial_amount:  number
  current_amount:  number
  interest_rate:   number  // % anual
  min_payment:     number
  strategy:        DebtStrategy
  status:          DebtStatus
  killed_at:       string | null
  created_at:      string
}

export interface DebtAttack {
  id:         string
  debt_id:    string
  amount:     number
  xp_earned:  number
  note:       string | null
  created_at: string
}

/**
 * Projecta o payoff de uma dívida isolada assumindo prestação mínima +
 * amortização extra fixa por mês. Devolve número de meses e juros pagos
 * totais, ou null se a prestação não cobrir os juros (dívida infinita).
 */
export function projectPayoff(
  balance:     number,
  annualRate:  number,
  monthly:     number,
  extra:       number = 0,
): { months: number; totalInterest: number } | null {
  if (balance <= 0) return { months: 0, totalInterest: 0 }
  const monthlyRate = (annualRate / 100) / 12
  const payment = monthly + extra
  // Se prestação não cobre juro do mês 0, é dívida infinita
  if (payment <= balance * monthlyRate) return null

  let current = balance
  let months = 0
  let interest = 0
  const MAX_MONTHS = 600

  while (current > 0 && months < MAX_MONTHS) {
    const monthlyInterest = current * monthlyRate
    interest += monthlyInterest
    current = current + monthlyInterest - payment
    months += 1
    if (current < 0.01) {
      // arredondar — último pagamento absorve resto
      current = 0
    }
  }
  if (months === MAX_MONTHS) return null
  return { months, totalInterest: Math.round(interest * 100) / 100 }
}

/**
 * Ordena dívidas pela estratégia escolhida:
 * - avalanche → maior taxa primeiro
 * - snowball  → menor saldo primeiro
 */
export function orderByStrategy(
  debts: Debt[],
  strategy: DebtStrategy,
): Debt[] {
  const active = debts.filter(d => d.status === 'active')
  if (strategy === 'avalanche') {
    return [...active].sort((a, b) => b.interest_rate - a.interest_rate)
  }
  return [...active].sort((a, b) => a.current_amount - b.current_amount)
}

/**
 * Simula o plano completo de abate — aplicando a prestação mínima a
 * todas e canalizando o "extra" mensal para a primeira dívida na
 * ordem da estratégia. Quando uma morre, o seu mínimo + extra passa
 * para a próxima ("snowball effect" clássico).
 */
export function simulatePlan(
  debts:    Debt[],
  monthlyExtra: number,
  strategy: DebtStrategy,
): {
  monthsToFree:  number
  totalInterest: number
  timeline:      Array<{ month: number; remaining: number }>
  infinite:      boolean
} {
  const queue = orderByStrategy(debts, strategy).map(d => ({
    id:      d.id,
    balance: d.current_amount,
    rate:    (d.interest_rate / 100) / 12,
    min:     d.min_payment,
  }))
  if (queue.length === 0) {
    return { monthsToFree: 0, totalInterest: 0, timeline: [], infinite: false }
  }

  let months = 0
  let interest = 0
  const MAX_MONTHS = 600
  const timeline: Array<{ month: number; remaining: number }> = []

  while (queue.some(d => d.balance > 0) && months < MAX_MONTHS) {
    // 1. Aplicar juro mensal a todas as dívidas activas
    for (const d of queue) {
      if (d.balance <= 0) continue
      const monthlyInterest = d.balance * d.rate
      interest += monthlyInterest
      d.balance += monthlyInterest
    }

    // 2. Pagar o mínimo em todas + extra no topo (primeira activa na queue)
    let availableExtra = monthlyExtra
    // Primeiro, pagar min em todas
    for (const d of queue) {
      if (d.balance <= 0) continue
      const pay = Math.min(d.min, d.balance)
      d.balance -= pay
      // Se a prestação mínima > saldo, o resto passa para extra (cascade)
      availableExtra += (d.min - pay)
    }
    // Canalizar extra para a primeira dívida activa
    for (const d of queue) {
      if (availableExtra <= 0) break
      if (d.balance <= 0) continue
      const pay = Math.min(availableExtra, d.balance)
      d.balance -= pay
      availableExtra -= pay
    }

    months += 1
    const remaining = queue.reduce((sum, d) => sum + Math.max(0, d.balance), 0)
    // Snapshot cada 3 meses para o gráfico não ter 600 pontos
    if (months === 1 || months % 3 === 0 || remaining <= 0) {
      timeline.push({ month: months, remaining: Math.round(remaining * 100) / 100 })
    }
  }

  return {
    monthsToFree:  months,
    totalInterest: Math.round(interest * 100) / 100,
    timeline,
    infinite:      months >= MAX_MONTHS,
  }
}

/**
 * Compara avalanche vs snowball — devolve os dois planos para o user
 * decidir. Útil na página de estratégia.
 */
export function compareStrategies(
  debts: Debt[],
  monthlyExtra: number,
): {
  avalanche: ReturnType<typeof simulatePlan>
  snowball:  ReturnType<typeof simulatePlan>
  savings:   number  // juros poupados escolhendo a melhor
  better:    DebtStrategy
} {
  const avalanche = simulatePlan(debts, monthlyExtra, 'avalanche')
  const snowball  = simulatePlan(debts, monthlyExtra, 'snowball')
  const better: DebtStrategy =
    avalanche.totalInterest <= snowball.totalInterest ? 'avalanche' : 'snowball'
  const savings = Math.abs(avalanche.totalInterest - snowball.totalInterest)
  return { avalanche, snowball, savings, better }
}

/**
 * Formata meses num label legível em PT-PT.
 *   0  → "Já está!"
 *   1  → "1 mês"
 *   5  → "5 meses"
 *   14 → "1 ano e 2 meses"
 */
export function formatMonths(months: number): string {
  if (months <= 0) return 'Já está!'
  if (months === 1) return '1 mês'
  if (months < 12) return `${months} meses`
  const y = Math.floor(months / 12)
  const m = months % 12
  if (m === 0) return y === 1 ? '1 ano' : `${y} anos`
  const yearPart = y === 1 ? '1 ano' : `${y} anos`
  const monthPart = m === 1 ? '1 mês' : `${m} meses`
  return `${yearPart} e ${monthPart}`
}

/**
 * XP atribuído por um ataque. Base: 1 XP por cada €2 pagos, com bonus
 * se a amortização for acima do mínimo mensal (esforço extra = +20%).
 * Cap a 500 por ataque para impedir abuso.
 */
export function xpForAttack(amount: number, minPayment: number): number {
  const base = Math.floor(amount / 2)
  const bonus = amount > minPayment ? Math.floor(base * 0.2) : 0
  return Math.min(500, base + bonus)
}
