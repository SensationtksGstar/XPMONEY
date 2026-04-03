import { LEVELS, XP_REWARDS, type XPProgress, type Level } from '@/types'

// ---- XP e Níveis ----

export function getLevelFromXP(totalXP: number): Level {
  let current = LEVELS[0]
  for (const level of LEVELS) {
    if (totalXP >= level.xp_required) current = level
    else break
  }
  return current
}

export function getNextLevel(currentLevel: number): Level | null {
  return LEVELS.find(l => l.number === currentLevel + 1) ?? null
}

export function calculateXPProgress(totalXP: number): Omit<XPProgress, 'id' | 'user_id' | 'last_activity_at'> {
  const currentLevel = getLevelFromXP(totalXP)
  const nextLevel    = getNextLevel(currentLevel.number)

  const xpInCurrentLevel  = totalXP - currentLevel.xp_required
  const xpToNextLevel     = nextLevel ? nextLevel.xp_required - currentLevel.xp_required : 0

  return {
    xp_total: totalXP,
    level: currentLevel.number,
    xp_in_current_level: xpInCurrentLevel,
    xp_to_next_level: xpToNextLevel,
  }
}

export function getXPPercentage(xpProgress: Omit<XPProgress, 'id' | 'user_id' | 'last_activity_at'>): number {
  if (xpProgress.xp_to_next_level === 0) return 100
  return Math.min(100, Math.round((xpProgress.xp_in_current_level / xpProgress.xp_to_next_level) * 100))
}

// ---- Score Financeiro ----

export interface ScoreInput {
  income_month: number
  expense_month: number
  savings_this_month: number
  days_with_transactions: number
  goals_with_progress: number
  total_goals: number
  budget_overspent_categories: number
  total_categories_used: number
}

export function calculateFinancialScore(input: ScoreInput): {
  score: number
  breakdown: {
    savings_rate:    number
    expense_control: number
    consistency:     number
    goals_progress:  number
  }
} {
  // 1. Taxa de poupança (0-25 pts)
  // Ideal: poupar >= 20% do rendimento
  const savingsRate = input.income_month > 0
    ? input.savings_this_month / input.income_month
    : 0
  const savingsScore = Math.min(25, Math.round(savingsRate * 125))

  // 2. Controlo de despesas (0-25 pts)
  // Penaliza categorias em que gastou acima do orçamento
  const overspendRatio = input.total_categories_used > 0
    ? input.budget_overspent_categories / input.total_categories_used
    : 0
  const expenseScore = Math.round(25 * (1 - overspendRatio))

  // 3. Consistência de registo (0-25 pts)
  // Ideal: registar transações todos os dias do mês
  const daysInMonth   = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
  const consistencyRatio = input.days_with_transactions / daysInMonth
  const consistencyScore = Math.min(25, Math.round(consistencyRatio * 25))

  // 4. Progresso em objetivos (0-25 pts)
  const goalsScore = input.total_goals > 0
    ? Math.min(25, Math.round((input.goals_with_progress / input.total_goals) * 25))
    : 12 // neutro se não tem objetivos

  const total = savingsScore + expenseScore + consistencyScore + goalsScore

  return {
    score: Math.min(100, Math.max(0, total)),
    breakdown: {
      savings_rate:    savingsScore,
      expense_control: expenseScore,
      consistency:     consistencyScore,
      goals_progress:  goalsScore,
    },
  }
}

// ---- Missões ----

export const MISSION_TEMPLATES = [
  {
    type: 'register_transactions' as const,
    title: 'Regista 5 transações',
    description: 'Regista pelo menos 5 transações este mês para conheceres os teus hábitos',
    xp_reward: 150,
    target_value: 5,
    is_premium: false,
  },
  {
    type: 'keep_daily_streak' as const,
    title: 'Mantém 7 dias seguidos',
    description: 'Regista pelo menos 1 transação durante 7 dias consecutivos',
    xp_reward: 300,
    target_value: 7,
    is_premium: false,
  },
  {
    type: 'improve_score' as const,
    title: 'Melhora o teu Score',
    description: 'Aumenta o teu Score de Saúde Financeira em pelo menos 5 pontos',
    xp_reward: 200,
    target_value: 5,
    is_premium: false,
  },
  {
    type: 'categorize_all' as const,
    title: 'Zero transações sem categoria',
    description: 'Categoriza todas as tuas transações do mês',
    xp_reward: 100,
    target_value: 1,
    is_premium: false,
  },
  {
    type: 'reach_savings_goal' as const,
    title: 'Poupa 10% do rendimento',
    description: 'Atinge uma taxa de poupança mínima de 10% este mês',
    xp_reward: 400,
    target_value: 10,
    is_premium: false,
  },
  {
    type: 'keep_daily_streak' as const,
    title: 'Mantém 30 dias seguidos',
    description: 'O desafio máximo: 30 dias consecutivos de controlo financeiro',
    xp_reward: 1000,
    target_value: 30,
    is_premium: true,
  },
  {
    type: 'reduce_category_spend' as const,
    title: 'Reduz despesas de Lazer',
    description: 'Gasta menos 20% em Lazer comparado ao mês anterior',
    xp_reward: 250,
    target_value: 20,
    is_premium: true,
  },
] as const

// ---- Badges ----

export const BADGE_DEFINITIONS = [
  {
    code:        'first_transaction',
    name:        'Primeira Transação',
    description: 'Registaste a tua primeira transação. A jornada começa!',
    icon:        '🌱',
    xp_reward:   50,
    rarity:      'common' as const,
    is_premium:  false,
  },
  {
    code:        'week_streak',
    name:        'Semana Perfeita',
    description: '7 dias consecutivos de controlo financeiro.',
    icon:        '🔥',
    xp_reward:   300,
    rarity:      'rare' as const,
    is_premium:  false,
  },
  {
    code:        'month_streak',
    name:        'Mês Imparável',
    description: '30 dias consecutivos. És uma máquina.',
    icon:        '⚡',
    xp_reward:   1000,
    rarity:      'epic' as const,
    is_premium:  false,
  },
  {
    code:        'score_50',
    name:        'Score 50',
    description: 'Atingiste um Score de Saúde Financeira de 50.',
    icon:        '📊',
    xp_reward:   100,
    rarity:      'common' as const,
    is_premium:  false,
  },
  {
    code:        'score_75',
    name:        'Score 75 — Quase Elite',
    description: 'Atingiste um Score de 75. Estás no top 30%.',
    icon:        '🏆',
    xp_reward:   300,
    rarity:      'rare' as const,
    is_premium:  false,
  },
  {
    code:        'score_90',
    name:        'Score Elite',
    description: 'Score acima de 90. Estás no 1% dos utilizadores.',
    icon:        '💎',
    xp_reward:   1000,
    rarity:      'legendary' as const,
    is_premium:  false,
  },
  {
    code:        'early_adopter',
    name:        'Early Adopter',
    description: 'Estiveste aqui desde o início. Isso não se esquece.',
    icon:        '🚀',
    xp_reward:   500,
    rarity:      'legendary' as const,
    is_premium:  false,
  },
  {
    code:        'goal_reached',
    name:        'Objetivo Atingido',
    description: 'Concluíste o teu primeiro objetivo de poupança.',
    icon:        '🎯',
    xp_reward:   500,
    rarity:      'rare' as const,
    is_premium:  false,
  },
]

// ---- Formatação de XP ----

export function formatXP(xp: number): string {
  if (xp >= 1_000_000) return `${(xp / 1_000_000).toFixed(1)}M XP`
  if (xp >= 1_000)     return `${(xp / 1_000).toFixed(1)}k XP`
  return `${xp} XP`
}

export { XP_REWARDS }
