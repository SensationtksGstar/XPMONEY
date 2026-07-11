-- ═══════════════════════════════════════════════════════════════════════════
-- STREAK FREEZE + LONGEST STREAK — julho 2026
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Mecânica (implementada em /api/daily-checkin, com fallback runtime — a app
-- funciona sem esta migração, o freeze fica simplesmente desativado):
--
--   • streak_freezes — proteções disponíveis. Falhar EXATAMENTE 1 dia com
--     streak ≥ 3 e um freeze disponível consome-o e o streak continua
--     (loss-aversion à Duolingo — o mecanismo de retenção nº 1 deles).
--     Ganha-se +1 a cada marco de 7 dias (7, 14, 21…), cap em 2.
--     Default 1: todos os utilizadores existentes começam com uma proteção.
--
--   • longest_streak — recorde pessoal, atualizado a cada check-in.
--     Fica guardado mesmo quando o streak atual reseta (o "melhor de sempre"
--     é o número que dói perder e o que dá orgulho mostrar).
--
-- Correr no Supabase SQL Editor. Idempotente (IF NOT EXISTS).
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE voltix_states
  ADD COLUMN IF NOT EXISTS streak_freezes integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS longest_streak integer NOT NULL DEFAULT 0;

-- Backfill do recorde: para quem já tem streak ativo, o recorde nunca é
-- inferior ao streak atual.
UPDATE voltix_states
   SET longest_streak = GREATEST(longest_streak, streak_days)
 WHERE streak_days > longest_streak;
