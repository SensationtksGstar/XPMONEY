// ============================================================
// XP MONEY — DEMO MODE MOCK DATA
// Used when NEXT_PUBLIC_DEMO_MODE=true
// ============================================================

import type {
  Transaction, Mission, Goal, FinancialScore,
  XPProgress, Category,
} from '@/types'

export const DEMO_USER = {
  id:         'demo-user-id',
  clerk_id:   'demo-clerk-id',
  email:      'demo@xpmoney.app',
  name:       'Demo User',
  firstName:  'Demo',
  lastName:   'User',
  avatar_url: null,
  plan:       'free' as const,
  onboarding_completed: true,
}

export const DEMO_CATEGORIES: Category[] = [
  { id: 'cat-1',  user_id: null, name: 'Salário',       icon: '💼', color: '#22c55e', transaction_type: 'income',   is_default: true },
  { id: 'cat-2',  user_id: null, name: 'Freelance',     icon: '💻', color: '#10b981', transaction_type: 'income',   is_default: true },
  { id: 'cat-3',  user_id: null, name: 'Alimentação',   icon: '🛒', color: '#f97316', transaction_type: 'expense',  is_default: true },
  { id: 'cat-4',  user_id: null, name: 'Transportes',   icon: '🚌', color: '#3b82f6', transaction_type: 'expense',  is_default: true },
  { id: 'cat-5',  user_id: null, name: 'Lazer',         icon: '🎮', color: '#8b5cf6', transaction_type: 'expense',  is_default: true },
  { id: 'cat-6',  user_id: null, name: 'Saúde',         icon: '💊', color: '#ec4899', transaction_type: 'expense',  is_default: true },
  { id: 'cat-7',  user_id: null, name: 'Casa',          icon: '🏠', color: '#eab308', transaction_type: 'expense',  is_default: true },
  { id: 'cat-8',  user_id: null, name: 'Poupança',      icon: '🏦', color: '#06b6d4', transaction_type: 'both',     is_default: true },
  { id: 'cat-9',  user_id: null, name: 'Restaurantes',  icon: '🍕', color: '#ef4444', transaction_type: 'expense',  is_default: true },
  { id: 'cat-10', user_id: null, name: 'Roupa',         icon: '👕', color: '#a78bfa', transaction_type: 'expense',  is_default: true },
]

const today = new Date()
const fmt = (d: Date) => d.toISOString().split('T')[0]
const daysAgo = (n: number) => { const d = new Date(today); d.setDate(d.getDate() - n); return fmt(d) }

export const DEMO_TRANSACTIONS: Transaction[] = [
  { id: 'tx-1',  account_id: 'acc-1', user_id: 'demo-user-id', amount: 1850,  type: 'income',  category_id: 'cat-1', description: 'Salário Março',       date: daysAgo(2),  created_at: daysAgo(2),  category: DEMO_CATEGORIES[0] },
  { id: 'tx-2',  account_id: 'acc-1', user_id: 'demo-user-id', amount: 320,   type: 'income',  category_id: 'cat-2', description: 'Projeto website',     date: daysAgo(3),  created_at: daysAgo(3),  category: DEMO_CATEGORIES[1] },
  { id: 'tx-3',  account_id: 'acc-1', user_id: 'demo-user-id', amount: 67.50, type: 'expense', category_id: 'cat-3', description: 'Supermercado Pingo',  date: daysAgo(0),  created_at: daysAgo(0),  category: DEMO_CATEGORIES[2] },
  { id: 'tx-4',  account_id: 'acc-1', user_id: 'demo-user-id', amount: 42,    type: 'expense', category_id: 'cat-4', description: 'Passe Mensal Metro',  date: daysAgo(1),  created_at: daysAgo(1),  category: DEMO_CATEGORIES[3] },
  { id: 'tx-5',  account_id: 'acc-1', user_id: 'demo-user-id', amount: 15.99, type: 'expense', category_id: 'cat-5', description: 'Netflix',             date: daysAgo(4),  created_at: daysAgo(4),  category: DEMO_CATEGORIES[4] },
  { id: 'tx-6',  account_id: 'acc-1', user_id: 'demo-user-id', amount: 28,    type: 'expense', category_id: 'cat-6', description: 'Farmácia',            date: daysAgo(5),  created_at: daysAgo(5),  category: DEMO_CATEGORIES[5] },
  { id: 'tx-7',  account_id: 'acc-1', user_id: 'demo-user-id', amount: 650,   type: 'expense', category_id: 'cat-7', description: 'Renda Apartamento',   date: daysAgo(6),  created_at: daysAgo(6),  category: DEMO_CATEGORIES[6] },
  { id: 'tx-8',  account_id: 'acc-1', user_id: 'demo-user-id', amount: 200,   type: 'expense', category_id: 'cat-8', description: 'Poupança mensal',     date: daysAgo(6),  created_at: daysAgo(6),  category: DEMO_CATEGORIES[7] },
  { id: 'tx-9',  account_id: 'acc-1', user_id: 'demo-user-id', amount: 34.80, type: 'expense', category_id: 'cat-9', description: 'Jantar restaurante',  date: daysAgo(7),  created_at: daysAgo(7),  category: DEMO_CATEGORIES[8] },
  { id: 'tx-10', account_id: 'acc-1', user_id: 'demo-user-id', amount: 89,    type: 'expense', category_id: 'cat-10', description: 'Zara — camisas',     date: daysAgo(8),  created_at: daysAgo(8),  category: DEMO_CATEGORIES[9] },
  { id: 'tx-11', account_id: 'acc-1', user_id: 'demo-user-id', amount: 12.50, type: 'expense', category_id: 'cat-3', description: 'Padaria',             date: daysAgo(9),  created_at: daysAgo(9),  category: DEMO_CATEGORIES[2] },
  { id: 'tx-12', account_id: 'acc-1', user_id: 'demo-user-id', amount: 55,    type: 'expense', category_id: 'cat-5', description: 'Concerto music',      date: daysAgo(10), created_at: daysAgo(10), category: DEMO_CATEGORIES[4] },
]

export const DEMO_SCORE: FinancialScore = {
  id:           'score-1',
  user_id:      'demo-user-id',
  score:        72,
  breakdown: {
    savings_rate:    18,
    expense_control: 22,
    consistency:     20,
    goals_progress:  12,
  },
  trend:        'up',
  calculated_at: new Date().toISOString(),
}

export const DEMO_XP: XPProgress = {
  id:                   'xp-1',
  user_id:              'demo-user-id',
  xp_total:             1340,
  level:                5,
  xp_in_current_level:  340,
  xp_to_next_level:     500,
  last_activity_at:     new Date().toISOString(),
}

export const DEMO_MISSIONS: Mission[] = [
  {
    id: 'mission-1', user_id: 'demo-user-id',
    type: 'register_transactions',
    title: 'Regista 5 transações',
    description: 'Regista pelo menos 5 transações este mês',
    xp_reward: 150, target_value: 5, current_value: 5,
    status: 'active', is_premium: false,
    started_at: daysAgo(10), completed_at: null, expires_at: daysAgo(-20),
  },
  {
    id: 'mission-2', user_id: 'demo-user-id',
    type: 'keep_daily_streak',
    title: 'Mantém 7 dias seguidos',
    description: 'Regista pelo menos 1 transação durante 7 dias consecutivos',
    xp_reward: 300, target_value: 7, current_value: 4,
    status: 'active', is_premium: false,
    started_at: daysAgo(4), completed_at: null, expires_at: daysAgo(-20),
  },
  {
    id: 'mission-3', user_id: 'demo-user-id',
    type: 'reach_savings_goal',
    title: 'Poupa 10% do rendimento',
    description: 'Atinge uma taxa de poupança mínima de 10% este mês',
    xp_reward: 400, target_value: 10, current_value: 9,
    status: 'active', is_premium: false,
    started_at: daysAgo(10), completed_at: null, expires_at: daysAgo(-20),
  },
]

export const DEMO_GOALS: Goal[] = [
  {
    id: 'goal-1', user_id: 'demo-user-id',
    name: 'Fundo de Emergência',
    icon: '🛡️',
    target_amount: 3000,
    current_amount: 1200,
    deadline: daysAgo(-60),
    status: 'active',
    created_at: daysAgo(30), updated_at: daysAgo(5),
  },
  {
    id: 'goal-2', user_id: 'demo-user-id',
    name: 'Férias em Lisboa',
    icon: '✈️',
    target_amount: 800,
    current_amount: 640,
    deadline: daysAgo(-30),
    status: 'active',
    created_at: daysAgo(60), updated_at: daysAgo(2),
  },
  {
    id: 'goal-3', user_id: 'demo-user-id',
    name: 'Novo MacBook',
    icon: '💻',
    target_amount: 1800,
    current_amount: 450,
    deadline: null,
    status: 'active',
    created_at: daysAgo(20), updated_at: daysAgo(10),
  },
]

export const DEMO_BADGES = [
  { id: 'b-1', badge_id: 'badge-early', earned_at: daysAgo(30), badge: { code: 'early_adopter', name: 'Early Adopter', icon: '🚀', rarity: 'legendary', description: 'Estiveste aqui desde o início.' } },
  { id: 'b-2', badge_id: 'badge-first', earned_at: daysAgo(29), badge: { code: 'first_transaction', name: 'Primeira Transação', icon: '🌱', rarity: 'common', description: 'Registaste a tua primeira transação.' } },
  { id: 'b-3', badge_id: 'badge-score', earned_at: daysAgo(5),  badge: { code: 'score_50', name: 'Score 50', icon: '📊', rarity: 'common', description: 'Atingiste score 50.' } },
]

export const DEMO_VOLTIX = {
  id: 'voltix-1', user_id: 'demo-user-id',
  mood: 'happy' as const,
  evolution_level: 3,
  streak_days: 4,
  last_interaction: new Date().toISOString(),
  mascot_gender: 'voltix' as const,
}

export const DEMO_ACCOUNT = {
  id: 'acc-1', user_id: 'demo-user-id',
  name: 'Conta Principal',
  type: 'checking' as const,
  balance: 1284.21,
  currency: 'EUR',
  color: '#22c55e',
  icon: '🏦',
  is_default: true,
  created_at: daysAgo(30),
}
