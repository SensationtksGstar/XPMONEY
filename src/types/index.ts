// ============================================
// XP MONEY — Global TypeScript Types
// ============================================

// ---- USER ----

export type Plan = 'free' | 'plus' | 'pro' | 'family'

export interface UserProfile {
  id: string
  clerk_id: string
  email: string
  name: string
  avatar_url: string | null
  plan: Plan
  onboarding_completed: boolean
  country: string
  currency: string
  created_at: string
  updated_at: string
}

// ---- ACCOUNTS ----

export type AccountType = 'checking' | 'savings' | 'wallet' | 'investment' | 'credit'

export interface Account {
  id: string
  user_id: string
  name: string
  type: AccountType
  balance: number
  currency: string
  color: string
  icon: string
  is_default: boolean
  created_at: string
}

// ---- TRANSACTIONS ----

export type TransactionType = 'income' | 'expense' | 'transfer'

export interface Transaction {
  id: string
  account_id: string
  user_id: string
  amount: number
  type: TransactionType
  category_id: string
  description: string
  date: string
  created_at: string
  // joins
  category?: Category
  account?: Account
}

export interface TransactionCreateInput {
  account_id: string
  amount: number
  type: TransactionType
  category_id: string
  description: string
  date: string
}

// ---- CATEGORIES ----

export interface Category {
  id: string
  user_id: string | null // null = default (sistema)
  name: string
  icon: string
  color: string
  transaction_type: TransactionType | 'both'
  is_default: boolean
}

export const DEFAULT_CATEGORIES: Omit<Category, 'id' | 'user_id'>[] = [
  { name: 'Alimentação',   icon: '🍔', color: '#f97316', transaction_type: 'expense', is_default: true },
  { name: 'Transporte',    icon: '🚗', color: '#3b82f6', transaction_type: 'expense', is_default: true },
  { name: 'Saúde',         icon: '🏥', color: '#ef4444', transaction_type: 'expense', is_default: true },
  { name: 'Lazer',         icon: '🎮', color: '#8b5cf6', transaction_type: 'expense', is_default: true },
  { name: 'Educação',      icon: '📚', color: '#06b6d4', transaction_type: 'expense', is_default: true },
  { name: 'Casa',          icon: '🏠', color: '#84cc16', transaction_type: 'expense', is_default: true },
  { name: 'Roupas',        icon: '👕', color: '#ec4899', transaction_type: 'expense', is_default: true },
  { name: 'Tecnologia',    icon: '💻', color: '#64748b', transaction_type: 'expense', is_default: true },
  { name: 'Salário',       icon: '💼', color: '#22c55e', transaction_type: 'income',  is_default: true },
  { name: 'Freelance',     icon: '🧑‍💻', color: '#10b981', transaction_type: 'income',  is_default: true },
  { name: 'Outros',        icon: '📦', color: '#94a3b8', transaction_type: 'both',    is_default: true },
]

// ---- FINANCIAL SCORE ----

export interface ScoreBreakdown {
  savings_rate:    number  // 0-25 pts
  expense_control: number  // 0-25 pts
  consistency:     number  // 0-25 pts
  goals_progress:  number  // 0-25 pts
}

export interface FinancialScore {
  id: string
  user_id: string
  score: number            // 0-100
  breakdown: ScoreBreakdown
  trend: 'up' | 'down' | 'stable'
  calculated_at: string
}

export type ScoreLevel = 'critical' | 'low' | 'medium' | 'good' | 'elite'

export function getScoreLevel(score: number): ScoreLevel {
  if (score < 40) return 'critical'
  if (score < 60) return 'low'
  if (score < 75) return 'medium'
  if (score < 90) return 'good'
  return 'elite'
}

export const SCORE_LABELS: Record<ScoreLevel, string> = {
  critical: 'Crítico',
  low:      'Fraco',
  medium:   'Médio',
  good:     'Bom',
  elite:    'Elite',
}

// ---- GAMIFICATION ----

export interface XPProgress {
  id: string
  user_id: string
  xp_total: number
  level: number
  xp_to_next_level: number
  xp_in_current_level: number
  last_activity_at: string
}

export const XP_REWARDS = {
  TRANSACTION_REGISTERED:  10,
  TRANSACTION_CATEGORIZED:  5,
  DAILY_LOGIN:             20,
  STREAK_7_DAYS:          300,
  STREAK_30_DAYS:        1000,
  MISSION_COMPLETED:      150,  // base, varia por missão
  SCORE_IMPROVED:         100,
  GOAL_REACHED:          1000,
  BUDGET_KEPT:            200,
  FIRST_TRANSACTION:       50,
  ONBOARDING_COMPLETE:    100,
} as const

export interface Level {
  number: number
  name: string
  xp_required: number  // XP total para atingir este nível
  icon: string
}

export const LEVELS: Level[] = [
  { number: 1,  name: 'Recruta Financeiro',      xp_required: 0,      icon: '🌱' },
  { number: 2,  name: 'Aprendiz Consciente',     xp_required: 200,    icon: '📊' },
  { number: 3,  name: 'Observador de Gastos',    xp_required: 500,    icon: '👁️' },
  { number: 4,  name: 'Controlador Iniciante',   xp_required: 1000,   icon: '🎯' },
  { number: 5,  name: 'Gestor Consciente',       xp_required: 2000,   icon: '⚡' },
  { number: 6,  name: 'Planeador Estratégico',   xp_required: 3500,   icon: '🗺️' },
  { number: 7,  name: 'Investidor em Formação',  xp_required: 5500,   icon: '📈' },
  { number: 8,  name: 'Analista de Riqueza',     xp_required: 8000,   icon: '🔍' },
  { number: 9,  name: 'Estrategista de Riqueza', xp_required: 11500,  icon: '🏆' },
  { number: 10, name: 'Mestre das Finanças',     xp_required: 16000,  icon: '👑' },
  { number: 20, name: 'Lenda XP Money',          xp_required: 100000, icon: '🌟' },
]

// ---- MISSIONS ----

export type MissionType =
  | 'register_transactions'
  | 'keep_daily_streak'
  | 'improve_score'
  | 'reach_savings_goal'
  | 'categorize_all'
  | 'reduce_category_spend'
  | 'complete_onboarding'
  | 'share_score'

export type MissionStatus = 'active' | 'completed' | 'expired' | 'locked'

export interface Mission {
  id: string
  user_id: string
  type: MissionType
  title: string
  description: string
  xp_reward: number
  target_value: number
  current_value: number
  status: MissionStatus
  expires_at: string | null
  started_at: string
  completed_at: string | null
  is_premium: boolean
}

// ---- BADGES ----

export interface Badge {
  id: string
  code: string
  name: string
  description: string
  icon: string
  xp_reward: number
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  is_premium: boolean
}

export interface UserBadge {
  id: string
  user_id: string
  badge_id: string
  earned_at: string
  badge: Badge
}

export const BADGE_CODES = {
  FIRST_TRANSACTION:  'first_transaction',
  WEEK_STREAK:        'week_streak',
  MONTH_STREAK:       'month_streak',
  SCORE_50:           'score_50',
  SCORE_75:           'score_75',
  SCORE_90:           'score_90',
  FIRST_GOAL:         'first_goal',
  GOAL_REACHED:       'goal_reached',
  LEVEL_5:            'level_5',
  LEVEL_10:           'level_10',
  SAVER_MONTH:        'saver_month',
  BUDGET_MASTER:      'budget_master',
  EARLY_ADOPTER:      'early_adopter',
} as const

// ---- VOLTIX ----

export type VoltixMood = 'sad' | 'neutral' | 'happy' | 'excited' | 'celebrating'
export type VoltixEvolution = 1 | 2 | 3 | 4 | 5

export interface VoltixState {
  id: string
  user_id: string
  mood: VoltixMood
  evolution_level: VoltixEvolution
  last_interaction: string
  streak_days: number
  customizations: VoltixCustomizations
}

export interface VoltixCustomizations {
  skin: string    // 'default' | 'dark' | 'golden' | 'cyber'
  accessory: string | null
}

export function getVoltixMoodFromScore(score: number): VoltixMood {
  if (score < 30) return 'sad'
  if (score < 50) return 'neutral'
  if (score < 70) return 'happy'
  if (score < 90) return 'excited'
  return 'celebrating'
}

// ---- GOALS ----

export type GoalStatus = 'active' | 'completed' | 'failed' | 'paused'

export interface Goal {
  id: string
  user_id: string
  name: string
  icon: string
  target_amount: number
  current_amount: number
  deadline: string | null
  status: GoalStatus
  created_at: string
  updated_at?: string
}

export interface GoalDeposit {
  id: string
  goal_id: string
  user_id: string
  amount: number        // positive = deposit, negative = withdrawal
  note: string
  date: string          // "YYYY-MM-DD"
  created_at: string
}

// ---- SUBSCRIPTIONS ----

export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing'

export interface Subscription {
  id: string
  user_id: string
  stripe_customer_id: string
  stripe_subscription_id: string
  plan: Plan
  status: SubscriptionStatus
  current_period_end: string
  cancel_at_period_end: boolean
}

// ---- API RESPONSES ----

export interface ApiResponse<T> {
  data: T | null
  error: string | null
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  per_page: number
  has_more: boolean
}

// ---- DASHBOARD SUMMARY ----

export interface DashboardSummary {
  balance_total: number
  income_month: number
  expense_month: number
  savings_rate: number
  score: FinancialScore | null
  xp: XPProgress | null
  active_missions: Mission[]
  recent_transactions: Transaction[]
  voltix: VoltixState | null
}
