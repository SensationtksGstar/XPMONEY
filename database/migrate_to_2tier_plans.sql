-- ============================================================================
-- XP-Money — Migração de planos: 4-tier → 2-tier
-- Data: Abril 2026
--
-- Modelo anterior: { free, plus, pro, family }
-- Modelo novo:     { free, premium }
--
-- Estratégia: qualquer assinatura paga (plus/pro/family) é colapsada para
-- `premium`. Nenhuma feature é perdida — pelo contrário, antigos Plus ganham
-- acesso às features que antes eram só Pro.
--
-- Ordem de execução:
--   1. Backfill dos dados (UPDATE)
--   2. Drop das CHECK constraints antigas
--   3. ADD das novas CHECK constraints
--
-- Executar no SQL editor do Supabase (Dashboard → SQL).
-- ============================================================================

BEGIN;

-- ── 1. Backfill: users ──────────────────────────────────────────────────────
UPDATE users
SET plan = 'premium'
WHERE plan IN ('plus', 'pro', 'family');

-- ── 2. Backfill: subscriptions ──────────────────────────────────────────────
UPDATE subscriptions
SET plan = 'premium'
WHERE plan IN ('plus', 'pro', 'family');

-- ── 3. Drop old CHECK constraints ───────────────────────────────────────────
-- Supabase atribui nomes auto-gerados (users_plan_check, subscriptions_plan_check).
-- Se o nome não bater certo, corre:
--   SELECT conname FROM pg_constraint WHERE conrelid = 'users'::regclass AND contype='c';
ALTER TABLE users         DROP CONSTRAINT IF EXISTS users_plan_check;
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;

-- ── 4. Add new CHECK constraints ────────────────────────────────────────────
ALTER TABLE users
  ADD CONSTRAINT users_plan_check
  CHECK (plan IN ('free', 'premium'));

ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_plan_check
  CHECK (plan IN ('free', 'premium'));

-- ── 5. Verificação (opcional, não modifica dados) ───────────────────────────
-- SELECT plan, COUNT(*) FROM users         GROUP BY plan;
-- SELECT plan, COUNT(*) FROM subscriptions GROUP BY plan;

COMMIT;

-- ============================================================================
-- Rollback (se precisares reverter):
--
-- BEGIN;
-- ALTER TABLE users         DROP CONSTRAINT IF EXISTS users_plan_check;
-- ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;
-- ALTER TABLE users
--   ADD CONSTRAINT users_plan_check
--   CHECK (plan IN ('free', 'plus', 'pro', 'family'));
-- ALTER TABLE subscriptions
--   ADD CONSTRAINT subscriptions_plan_check
--   CHECK (plan IN ('free', 'plus', 'pro', 'family'));
-- COMMIT;
--
-- Nota: o rollback só repõe a constraint — todos os registos que foram
-- migrados para `premium` mantêm-se `premium`. Para repor o plano original
-- precisarias de um backup anterior à migração.
-- ============================================================================
