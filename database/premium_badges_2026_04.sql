-- =========================================================================
-- Premium badges — April 2026
-- =========================================================================
-- Three new "trophy wall" badges that mark the hardest-to-reach gamified
-- peaks in the app. Coded as `is_premium=true` so the UI can render them
-- with a distinct gold/crown treatment over the normal rarity tiers.
--
-- How to apply:
--   Paste into the Supabase SQL editor and run.
--
-- Why ON CONFLICT DO NOTHING: safe to rerun; re-executing will not duplicate
-- or clobber any user_badges rows (the award pipeline joins on badges.code).
-- =========================================================================

INSERT INTO badges (code, name, description, icon, xp_reward, rarity, is_premium)
VALUES
  (
    'debt_killed',
    'Mata-Dívidas',
    'Eliminaste uma dívida por completo. Um peso a menos.',
    '⚔️',
    500,
    'epic',
    true
  ),
  (
    'academy_master',
    'Mestre da Academia',
    'Concluíste TODOS os cursos. És oficialmente imparável.',
    '🎓',
    1500,
    'legendary',
    true
  ),
  (
    'gold_saver',
    'Poupador de Ouro',
    'Acumulaste €5.000 em poupanças. Liberdade a ganhar forma.',
    '💰',
    1000,
    'legendary',
    true
  )
ON CONFLICT (code) DO NOTHING;
