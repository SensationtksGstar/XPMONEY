-- =========================================================================
-- users.premium_until — expiração do Passe Anual one-time (Junho 2026)
-- =========================================================================
-- Contexto: Multibanco + MB WAY não suportam débito recorrente no Stripe, por
-- isso não aparecem num checkout `mode:'subscription'`. Para os oferecer a
-- clientes PT criámos um "Passe Anual" de pagamento único (`mode:'payment'`)
-- que concede Premium por 1 ano. Como um pagamento único não expira no lado
-- do Stripe, guardamos a data-limite aqui e a app trata-a em read-time.
--
-- `premium_until = NULL` significa "sem expiração" — é o caso de TODOS os
-- subscritores atuais (cartão/anual), que continuam Premium enquanto
-- `plan = 'premium'`. Só os utilizadores do passe têm uma data preenchida.
--
-- O código degrada graciosamente se esta migração ainda não correu: o helper
-- `fetchPlanRow` (src/lib/plan.ts) apanha o erro de coluna inexistente
-- (PostgREST 42703) e relê sem a coluna, por isso o dashboard nunca dá 500.
--
-- Executar no SQL editor do Supabase (Dashboard → SQL).
-- =========================================================================

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS premium_until TIMESTAMPTZ DEFAULT NULL;

-- Index para varreduras futuras (ex.: relatório de passes a expirar).
CREATE INDEX IF NOT EXISTS idx_users_premium_until
  ON users (premium_until);

COMMIT;

-- Verificação (correr à parte se quiseres confirmar):
--   SELECT id, plan, premium_until FROM users WHERE premium_until IS NOT NULL;

-- =========================================================================
-- Rollback (se precisares reverter):
--   DROP INDEX IF EXISTS idx_users_premium_until;
--   ALTER TABLE users DROP COLUMN IF EXISTS premium_until;
-- =========================================================================
