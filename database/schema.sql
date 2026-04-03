-- ============================================
-- XP MONEY — Schema PostgreSQL (Supabase)
-- Versão: 1.0.0
-- ============================================
-- Executar em: Supabase > SQL Editor
-- Ordem importa: respeitar foreign keys
-- ============================================

-- Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. UTILIZADORES
-- ============================================

CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_id        TEXT NOT NULL UNIQUE,
  email           TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  avatar_url      TEXT,
  plan            TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'plus', 'pro', 'family')),
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  country         TEXT NOT NULL DEFAULT 'PT',
  currency        TEXT NOT NULL DEFAULT 'EUR',
  referral_code   TEXT UNIQUE DEFAULT encode(gen_random_bytes(4), 'hex'),
  referred_by     UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_clerk_id ON users(clerk_id);
CREATE INDEX idx_users_email    ON users(email);

-- ============================================
-- 2. CONTAS FINANCEIRAS
-- ============================================

CREATE TABLE IF NOT EXISTS accounts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'checking'
              CHECK (type IN ('checking', 'savings', 'wallet', 'investment', 'credit')),
  balance     NUMERIC(15, 2) NOT NULL DEFAULT 0,
  currency    TEXT NOT NULL DEFAULT 'EUR',
  color       TEXT NOT NULL DEFAULT '#22c55e',
  icon        TEXT NOT NULL DEFAULT '💳',
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_accounts_user_id ON accounts(user_id);

-- Garantir apenas 1 conta default por utilizador
CREATE UNIQUE INDEX idx_accounts_default
  ON accounts(user_id) WHERE is_default = TRUE;

-- ============================================
-- 3. CATEGORIAS
-- ============================================

CREATE TABLE IF NOT EXISTS categories (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL = categoria do sistema
  name             TEXT NOT NULL,
  icon             TEXT NOT NULL DEFAULT '📦',
  color            TEXT NOT NULL DEFAULT '#94a3b8',
  transaction_type TEXT NOT NULL DEFAULT 'both'
                   CHECK (transaction_type IN ('income', 'expense', 'both')),
  is_default       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_categories_user_id ON categories(user_id);

-- Seed: categorias do sistema (user_id = NULL)
INSERT INTO categories (name, icon, color, transaction_type, is_default) VALUES
  ('Alimentação',  '🍔', '#f97316', 'expense', TRUE),
  ('Transporte',   '🚗', '#3b82f6', 'expense', TRUE),
  ('Saúde',        '🏥', '#ef4444', 'expense', TRUE),
  ('Lazer',        '🎮', '#8b5cf6', 'expense', TRUE),
  ('Educação',     '📚', '#06b6d4', 'expense', TRUE),
  ('Casa',         '🏠', '#84cc16', 'expense', TRUE),
  ('Roupas',       '👕', '#ec4899', 'expense', TRUE),
  ('Tecnologia',   '💻', '#64748b', 'expense', TRUE),
  ('Salário',      '💼', '#22c55e', 'income',  TRUE),
  ('Freelance',    '🧑‍💻', '#10b981', 'income',  TRUE),
  ('Investimentos','📈', '#f59e0b', 'income',  TRUE),
  ('Outros',       '📦', '#94a3b8', 'both',    TRUE)
ON CONFLICT DO NOTHING;

-- ============================================
-- 4. TRANSAÇÕES
-- ============================================

CREATE TABLE IF NOT EXISTS transactions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id   UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  amount       NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  type         TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  category_id  UUID NOT NULL REFERENCES categories(id),
  description  TEXT NOT NULL DEFAULT '',
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_id   ON transactions(user_id);
CREATE INDEX idx_transactions_date      ON transactions(date DESC);
CREATE INDEX idx_transactions_type      ON transactions(type);
CREATE INDEX idx_transactions_category  ON transactions(category_id);

-- ============================================
-- 5. SCORE DE SAÚDE FINANCEIRA
-- ============================================

CREATE TABLE IF NOT EXISTS financial_scores (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score           INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  breakdown       JSONB NOT NULL DEFAULT '{}',
  trend           TEXT NOT NULL DEFAULT 'stable' CHECK (trend IN ('up', 'down', 'stable')),
  calculated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scores_user_id        ON financial_scores(user_id);
CREATE INDEX idx_scores_calculated_at  ON financial_scores(calculated_at DESC);

-- View: score mais recente por utilizador
CREATE OR REPLACE VIEW latest_scores AS
  SELECT DISTINCT ON (user_id) *
  FROM financial_scores
  ORDER BY user_id, calculated_at DESC;

-- ============================================
-- 6. PROGRESSO XP
-- ============================================

CREATE TABLE IF NOT EXISTS xp_progress (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  xp_total             INTEGER NOT NULL DEFAULT 0 CHECK (xp_total >= 0),
  level                INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
  streak_days          INTEGER NOT NULL DEFAULT 0,
  last_activity_date   DATE,
  last_activity_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_xp_user_id ON xp_progress(user_id);

-- ============================================
-- 7. HISTÓRICO DE XP (log de ganhos)
-- ============================================

CREATE TABLE IF NOT EXISTS xp_history (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount     INTEGER NOT NULL,
  reason     TEXT NOT NULL,
  metadata   JSONB,
  earned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_xp_history_user_id   ON xp_history(user_id);
CREATE INDEX idx_xp_history_earned_at ON xp_history(earned_at DESC);

-- ============================================
-- 8. MISSÕES
-- ============================================

CREATE TABLE IF NOT EXISTS missions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type           TEXT NOT NULL,
  title          TEXT NOT NULL,
  description    TEXT NOT NULL,
  xp_reward      INTEGER NOT NULL DEFAULT 150,
  target_value   NUMERIC NOT NULL DEFAULT 1,
  current_value  NUMERIC NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'completed', 'expired', 'locked')),
  is_premium     BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at     TIMESTAMPTZ,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at   TIMESTAMPTZ
);

CREATE INDEX idx_missions_user_id ON missions(user_id);
CREATE INDEX idx_missions_status  ON missions(status);

-- ============================================
-- 9. BADGES
-- ============================================

CREATE TABLE IF NOT EXISTS badges (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL,
  icon        TEXT NOT NULL,
  xp_reward   INTEGER NOT NULL DEFAULT 0,
  rarity      TEXT NOT NULL DEFAULT 'common'
              CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  is_premium  BOOLEAN NOT NULL DEFAULT FALSE
);

-- Seed: badges do sistema
INSERT INTO badges (code, name, description, icon, xp_reward, rarity) VALUES
  ('first_transaction', 'Primeira Transação',   'Registaste a tua primeira transação.',            '🌱', 50,   'common'),
  ('week_streak',       'Semana Perfeita',       '7 dias consecutivos de controlo financeiro.',     '🔥', 300,  'rare'),
  ('month_streak',      'Mês Imparável',         '30 dias consecutivos. És uma máquina.',           '⚡', 1000, 'epic'),
  ('score_50',          'Score 50',              'Atingiste um Score de Saúde Financeira de 50.',   '📊', 100,  'common'),
  ('score_75',          'Score 75',              'Atingiste um Score de 75. Top 30%.',              '🏆', 300,  'rare'),
  ('score_90',          'Score Elite',           'Score acima de 90. Top 1% dos utilizadores.',    '💎', 1000, 'legendary'),
  ('early_adopter',     'Early Adopter',         'Estiveste aqui desde o início.',                 '🚀', 500,  'legendary'),
  ('goal_reached',      'Objetivo Atingido',     'Concluíste o teu primeiro objetivo.',            '🎯', 500,  'rare'),
  ('level_5',           'Gestor Consciente',     'Chegaste ao Nível 5.',                           '⚡', 200,  'rare'),
  ('level_10',          'Mestre das Finanças',   'Chegaste ao Nível 10.',                          '👑', 1000, 'epic')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS user_badges (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  badge_id   UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

CREATE INDEX idx_user_badges_user_id ON user_badges(user_id);

-- ============================================
-- 10. VOLTIX
-- ============================================

CREATE TABLE IF NOT EXISTS voltix_states (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  mood              TEXT NOT NULL DEFAULT 'neutral'
                    CHECK (mood IN ('sad', 'neutral', 'happy', 'excited', 'celebrating')),
  evolution_level   INTEGER NOT NULL DEFAULT 1 CHECK (evolution_level BETWEEN 1 AND 5),
  streak_days       INTEGER NOT NULL DEFAULT 0,
  last_interaction  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  customizations    JSONB NOT NULL DEFAULT '{"skin": "default", "accessory": null}'
);

-- ============================================
-- 11. OBJETIVOS FINANCEIROS
-- ============================================

CREATE TABLE IF NOT EXISTS goals (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  icon            TEXT NOT NULL DEFAULT '🎯',
  target_amount   NUMERIC(15, 2) NOT NULL CHECK (target_amount > 0),
  current_amount  NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  deadline        DATE,
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'completed', 'failed', 'paused')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_goals_user_id ON goals(user_id);
CREATE INDEX idx_goals_status  ON goals(status);

-- ============================================
-- 12. SUBSCRIÇÕES STRIPE
-- ============================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id      TEXT NOT NULL UNIQUE,
  stripe_subscription_id  TEXT UNIQUE,
  plan                    TEXT NOT NULL DEFAULT 'free'
                          CHECK (plan IN ('free', 'plus', 'pro', 'family')),
  status                  TEXT NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'canceled', 'past_due', 'trialing')),
  current_period_end      TIMESTAMPTZ,
  cancel_at_period_end    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 13. ORÇAMENTOS MENSAIS (Premium)
-- ============================================

CREATE TABLE IF NOT EXISTS budgets (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id)       ON DELETE CASCADE,
  category_id  UUID NOT NULL REFERENCES categories(id)  ON DELETE CASCADE,
  amount       NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  month        DATE NOT NULL, -- 1º dia do mês
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, category_id, month)
);

CREATE INDEX idx_budgets_user_id ON budgets(user_id);
CREATE INDEX idx_budgets_month   ON budgets(month DESC);

-- ============================================
-- 14. TRIGGERS: updated_at automático
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_goals_updated_at
  BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 15. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Ativar RLS em todas as tabelas com dados de utilizador
ALTER TABLE users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE xp_progress   ENABLE ROW LEVEL SECURITY;
ALTER TABLE xp_history    ENABLE ROW LEVEL SECURITY;
ALTER TABLE missions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges   ENABLE ROW LEVEL SECURITY;
ALTER TABLE voltix_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals         ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets       ENABLE ROW LEVEL SECURITY;

-- Políticas: utilizador só vê os seus próprios dados
-- (A autenticação é feita via header x-clerk-user-id no service role)
-- As políticas abaixo usam service_role que bypassa RLS,
-- garantindo que a app server-side tem acesso total controlado pelo código.

-- Para uso futuro com Supabase Auth nativo:
-- CREATE POLICY "Users can read own data" ON users
--   FOR SELECT USING (auth.uid()::text = clerk_id);
