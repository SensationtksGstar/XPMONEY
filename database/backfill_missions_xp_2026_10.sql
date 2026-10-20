-- ============================================================================
-- Backfill: pagar o XP das missões auto-concluídas que nunca foi pago
-- (outubro 2026)
--
-- CORRER DEPOIS do deploy do fix "XP das missoes passa a ser pago" — o
-- código novo já não cria missões 'completed' sem pagamento; este script só
-- repara as que ficaram para trás.
--
-- PORQUÊ: até outubro 2026, updateMissionProgress punha status='completed'
-- no instante em que a missão chegava ao alvo e o endpoint de resgate
-- (/api/missions/[id]/complete) recusava essas missões com 'Already
-- completed'. Resultado: todas as missões que progrediam sozinhas
-- (register_transactions, keep_daily_streak, improve_score, categorize_all,
-- reach_savings_goal) apareciam em "Concluídas" com +XP, mas o XP nunca
-- entrava no xp_progress.
--
-- O QUE FAZ (numa só instrução — atómica):
--   1. unpaid: missões 'completed', com progresso real no alvo
--      (current_value >= target_value — exclui as "concluídas" a 0 % via
--      o farm antigo por curl, que aliás já tinham sido pagas), de users com
--      row em xp_progress, e SEM nenhuma row no xp_history com
--      reason = 'mission_completed:<id>' (o mesmo reason que o código usa).
--   2. ins: insere essa row no xp_history (o ledger).
--   3. soma por user e incrementa xp_progress.xp_total.
--
-- IDEMPOTENTE / SEGURO CORRER 2×: a chave é o reason 'mission_completed:<id>'.
-- Depois da 1.ª execução todas as missões pagas têm a row no ledger, por
-- isso o NOT EXISTS exclui-as e a 2.ª execução insere 0 rows e não altera
-- nenhum xp_total. Missões já pagas pelo endpoint antigo também ficam de fora
-- pelo mesmo motivo.
--
-- NÍVEL: xp_progress.level NÃO é recalculado aqui (a tabela de LEVELS vive
-- no código TS). O awardXP recalcula o nível a partir do xp_total na próxima
-- atribuição de XP (check-in diário / próximo registo), por isso fica certo
-- na próxima abertura da app.
--
-- Pré-visualizar antes (opcional, só leitura):
--   SELECT m.user_id, COUNT(*) AS missoes, SUM(m.xp_reward) AS xp
--   FROM missions m
--   WHERE m.status = 'completed'
--     AND m.current_value >= m.target_value
--     AND EXISTS (SELECT 1 FROM xp_progress p WHERE p.user_id = m.user_id)
--     AND NOT EXISTS (SELECT 1 FROM xp_history h
--                     WHERE h.user_id = m.user_id
--                       AND h.reason = 'mission_completed:' || m.id::text)
--   GROUP BY m.user_id;
-- ============================================================================

WITH unpaid AS (
  SELECT m.id, m.user_id, m.xp_reward
  FROM missions m
  WHERE m.status = 'completed'
    AND m.current_value >= m.target_value
    AND m.xp_reward > 0
    AND EXISTS (SELECT 1 FROM xp_progress p WHERE p.user_id = m.user_id)
    AND NOT EXISTS (
      SELECT 1 FROM xp_history h
      WHERE h.user_id = m.user_id
        AND h.reason  = 'mission_completed:' || m.id::text
    )
),
ins AS (
  INSERT INTO xp_history (user_id, amount, reason, earned_at)
  SELECT user_id, xp_reward, 'mission_completed:' || id::text, now()
  FROM unpaid
  RETURNING user_id, amount
)
UPDATE xp_progress p
SET    xp_total   = p.xp_total + s.t,
       updated_at = now()
FROM  (SELECT user_id, SUM(amount) AS t FROM ins GROUP BY user_id) s
WHERE  p.user_id = s.user_id;
