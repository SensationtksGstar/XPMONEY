-- ============================================================================
-- XP atómico: função award_xp (outubro 2026)
--
-- CORRER no Supabase SQL Editor. Pode correr ANTES ou DEPOIS do deploy: o
-- código (src/lib/awardXP.ts) chama db.rpc('award_xp', …) e, enquanto a
-- função não existir (PGRST202 / 42883), cai sozinho para o caminho antigo.
-- Até ~5 min depois de correr isto cada instância já está no caminho atómico.
--
-- PORQUÊ: o awardXP era read-modify-write no xp_progress (lê xp_total, soma
-- em JS, escreve o total). Dois awards concorrentes — transação + badge +
-- bónus de evolução no mesmo Promise.allSettled do POST /api/transactions,
-- o after() do daily-checkin, o GET de missões — liam o mesmo total e o
-- último a escrever apagava o incremento do outro: XP perdido em silêncio.
--
-- O QUE FAZ (numa só transação, por chamada):
--   1. SELECT … FOR UPDATE da row xp_progress do user (serializa chamadas
--      concorrentes para o mesmo user — a 2.ª espera pela 1.ª).
--      Sem row → devolve 0 rows e NÃO escreve nada (o código devolve null).
--   2. xp_total novo = xp_total + p_amount, com clamp a [0, 2147483647]
--      (respeita o CHECK xp_total >= 0; p_amount negativo = reversão, ex.
--      os 15 XP do DELETE de transação).
--   3. level novo = xp_level_for(xp_total novo) — os MESMOS limiares de
--      LEVELS em src/types/index.ts (o scripts/check-xp.mjs compara as duas
--      listas; se mudares os LEVELS, muda o ARRAY abaixo e volta a correr
--      este ficheiro).
--   4. INSERT no xp_history com o delta REAL (após clamp) + UPDATE do
--      xp_progress. Se o delta real for 0 (reversão com xp_total já a 0),
--      não escreve nada.
--   5. Devolve new_xp_total, new_level, previous_level (o nível guardado
--      antes) e xp_gained (delta real) — o código deteta o level-up daqui.
--   last_activity_at (DAU/MAU do /admin/metrics) só avança em ganhos, não em
--   reversões — igual ao caminho TS.
--
-- SEGURANÇA: SECURITY DEFINER com search_path fixo (pg_catalog, public) e
-- EXECUTE só para o service_role (o cliente admin do servidor). anon e
-- authenticated NÃO a podem chamar — senão qualquer user dava-se XP via
-- PostgREST (o mesmo exploit do antigo POST /api/xp).
--
-- IDEMPOTENTE / SEGURO CORRER 2×: DROP IF EXISTS + CREATE dentro de uma
-- transação; não toca em dados.
--
-- Teste rápido depois de correr (troca o uuid por um user real de teste —
-- ATENÇÃO: escreve mesmo; o 2.º SELECT desfaz):
--   SELECT * FROM public.award_xp('00000000-0000-0000-0000-000000000000', 1, 'manual_test');
--   SELECT * FROM public.award_xp('00000000-0000-0000-0000-000000000000', -1, 'manual_test_revert');
-- Verificar os limiares:
--   SELECT x, public.xp_level_for(x) FROM unnest(ARRAY[0,199,200,15999,16000,99999,100000]) AS x;
--   → 1,1,2,9,10,19,20
-- ============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.award_xp(uuid, integer, text);
DROP FUNCTION IF EXISTS public.xp_level_for(integer);

-- Nível para um XP total = nº de limiares <= XP (níveis contíguos 1..20),
-- piso 1. Espelho de getLevelFromXP (src/lib/gamification.ts).
CREATE FUNCTION public.xp_level_for(p_xp integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog, public
AS $$
  SELECT GREATEST(1, (
    SELECT count(*)::integer
    FROM unnest(
      -- XP_LEVELS (mantém em sincronia com LEVELS em src/types/index.ts;
      -- o scripts/check-xp.mjs lê esta lista e falha se divergir)
      ARRAY[0, 200, 500, 1000, 2000, 3500, 5500, 8000, 11500, 16000,
            21000, 27000, 34000, 42000, 51000, 61000, 72000, 84000, 92000, 100000]::integer[]
    ) AS t(req)
    WHERE t.req <= COALESCE(p_xp, 0)
  ))
$$;

CREATE FUNCTION public.award_xp(p_user_id uuid, p_amount integer, p_reason text)
RETURNS TABLE (
  new_xp_total   integer,
  new_level      integer,
  previous_level integer,
  xp_gained      integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_old_total integer;
  v_old_level integer;
  v_new_total integer;
  v_new_level integer;
  v_delta     integer;
  v_now       timestamptz := now();
BEGIN
  IF p_user_id IS NULL OR p_amount IS NULL OR p_reason IS NULL OR length(p_reason) = 0 THEN
    RAISE EXCEPTION 'award_xp: argumentos inválidos' USING ERRCODE = '22023';
  END IF;

  -- Lock da row: chamadas concorrentes para o mesmo user ficam em fila.
  SELECT p.xp_total, p.level
    INTO v_old_total, v_old_level
    FROM public.xp_progress AS p
   WHERE p.user_id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;  -- 0 rows: user sem xp_progress → nada escrito
  END IF;

  v_old_total := GREATEST(0, COALESCE(v_old_total, 0));
  v_old_level := COALESCE(v_old_level, public.xp_level_for(v_old_total));
  v_new_total := LEAST(2147483647::bigint,
                       GREATEST(0::bigint, v_old_total::bigint + p_amount::bigint))::integer;
  v_new_level := public.xp_level_for(v_new_total);
  v_delta     := v_new_total - v_old_total;

  IF v_delta <> 0 THEN
    INSERT INTO public.xp_history (user_id, amount, reason, earned_at)
    VALUES (p_user_id, v_delta, p_reason, v_now);

    UPDATE public.xp_progress AS p
       SET xp_total         = v_new_total,
           level            = v_new_level,
           last_activity_at = CASE WHEN p_amount > 0 THEN v_now ELSE p.last_activity_at END,
           updated_at       = v_now
     WHERE p.user_id = p_user_id;
  END IF;

  RETURN QUERY SELECT v_new_total, v_new_level, v_old_level, v_delta;
END;
$$;

-- Só o servidor (service_role) pode chamar. Em Supabase as funções novas
-- recebem EXECUTE para PUBLIC/anon/authenticated por defeito — revogar tudo.
REVOKE ALL ON FUNCTION public.award_xp(uuid, integer, text)  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.award_xp(uuid, integer, text)  FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_xp(uuid, integer, text) TO service_role;

REVOKE ALL ON FUNCTION public.xp_level_for(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.xp_level_for(integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.xp_level_for(integer) TO service_role;

COMMIT;

-- O PostgREST guarda o schema em cache: sem isto o db.rpc continuava a dar
-- PGRST202 até ao próximo reload automático.
NOTIFY pgrst, 'reload schema';
