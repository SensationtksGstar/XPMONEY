-- ============================================================
-- XP Money — TODAS as migrações pendentes, num só script (out. 2026)
-- Seguro correr mais do que uma vez: cada bloco usa IF NOT EXISTS / DROP IF EXISTS / WHERE NOT EXISTS.
-- Como usar: Supabase → SQL Editor → New query → colar tudo → Run.
-- ============================================================

-- ------------------------------------------------------------
-- >>> premium_until_column_2026_06.sql
-- ------------------------------------------------------------
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


-- ------------------------------------------------------------
-- >>> stripe_events_2026_04.sql
-- ------------------------------------------------------------
-- =========================================================================
-- stripe_events — idempotency ledger for Stripe webhooks
-- =========================================================================
-- Stripe retries webhook deliveries on any non-2xx response, with jittered
-- exponential backoff over ~3 days. Without an idempotency check, a single
-- transient DB error could cause the SAME event (same id) to be processed
-- many times — duplicating plan changes, double-writing subscriptions, etc.
--
-- This table is the de-dup ledger. Every incoming event_id is recorded
-- BEFORE the switch-case runs. If the row already exists, the handler
-- short-circuits with 200 OK and does nothing.
--
-- Apply via Supabase SQL editor. The webhook code has a try/catch fallback
-- that still processes events if this table is missing (so you can deploy
-- the code first and apply the migration on a relaxed schedule), but you
-- really want it applied before public launch.
-- =========================================================================

CREATE TABLE IF NOT EXISTS stripe_events (
  event_id    text    PRIMARY KEY,
  event_type  text    NOT NULL,
  received_at timestamptz DEFAULT now()
);

-- Tiny table; no indexes beyond the PK are needed.
-- Retention policy suggestion (optional): prune rows older than 90 days.
-- Stripe replays only happen within a few days, so 90 d is safe.
--   DELETE FROM stripe_events WHERE received_at < now() - interval '90 days';


-- ------------------------------------------------------------
-- >>> bug_reports.sql
-- ------------------------------------------------------------
-- ── XP Money — Bug reports ────────────────────────────────────────────────
-- Lets authenticated users submit bug reports from Settings without exposing
-- the admin email. Rows are written via the Supabase admin client (service
-- role), so no inbound RLS policy is required for INSERT. The admin reads
-- them via the Supabase dashboard.
--
-- Columns kept intentionally small — title + description + a bit of context
-- (user-agent, URL, app version) is enough to triage 95% of issues. Attachments
-- can come later if needed.

create table if not exists bug_reports (
  id          uuid primary key default gen_random_uuid(),

  -- null allowed in case an anonymous / logged-out report form is added later.
  user_id     uuid references users(id) on delete set null,
  clerk_id    text,                -- raw Clerk id so we can reach the user even if users row is gone
  email       text,                -- best-known email at submission time

  -- Distinguishes where the message came from: 'bug' (Settings → Reportar um bug)
  -- or 'contact' (public /contacto form). Admin dashboard filters by this.
  type        text not null default 'bug' check (type in ('bug','contact')),

  title       text not null,
  description text not null,

  -- context (helps reproduce)
  page_url    text,
  user_agent  text,
  app_version text,                -- build SHA / deploy tag

  -- triage state — updated manually in the Supabase dashboard
  status      text not null default 'new' check (status in ('new', 'triaged', 'resolved', 'wontfix')),

  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists bug_reports_status_idx     on bug_reports (status);
create index if not exists bug_reports_user_idx       on bug_reports (user_id);
create index if not exists bug_reports_type_idx       on bug_reports (type);
create index if not exists bug_reports_created_at_idx on bug_reports (created_at desc);

-- ── If the table already exists (older migration), retro-add the column.
alter table bug_reports add column if not exists type text not null default 'bug';
-- Guard the CHECK constraint separately so older rows with NULL survive.
do $$ begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'bug_reports_type_check'
      and table_name = 'bug_reports'
  ) then
    alter table bug_reports add constraint bug_reports_type_check
      check (type in ('bug','contact'));
  end if;
end $$;

-- RLS: off. The table is admin-only — all writes go through the service role.
alter table bug_reports enable row level security;

-- No SELECT/INSERT/UPDATE/DELETE policies for anon or authenticated roles —
-- they have zero access. Service role (our admin client) bypasses RLS so
-- /api/bug-report can still INSERT.


-- ------------------------------------------------------------
-- >>> newsletter_2026_04.sql
-- ------------------------------------------------------------
-- ============================================================================
-- newsletter_subscribers — opt-in mailing list with double-opt-in flow
-- ============================================================================
--
-- Why double-opt-in (not just store-and-go):
--   - RGPD/ePrivacy: consent must be "freely given, specific, informed and
--     unambiguous". A user typing an email and clicking submit is one
--     verification; clicking the link in the confirmation email proves they
--     control that mailbox. Without it, anyone can add anyone (revenge
--     subscription, mailing-list spam).
--   - Resend (and most providers) penalise sender reputation when emails
--     bounce; double-opt-in cuts bounce rate dramatically.
--
-- Token strategy:
--   - confirm_token: required to flip status from 'pending' → 'active'.
--     Generated server-side with crypto.randomBytes(32).toString('hex'),
--     so 64 hex chars = 256 bits. Random enough that brute-forcing is
--     not viable.
--   - unsubscribe_token: separate token used in every campaign email's
--     unsubscribe link. Kept distinct from confirm_token so we can
--     rotate one without invalidating the other.
--
-- Status lifecycle:
--   pending     → email submitted, confirm email sent, awaiting click
--   active      → user clicked confirm link; we may send campaigns
--   unsubscribed → user clicked unsubscribe in any campaign email
--   bounced     → reserved for future webhook integration with Resend;
--                 marks emails that hard-bounced so we stop sending
--
-- Apply via Supabase SQL editor.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email              TEXT        NOT NULL UNIQUE,
  locale             TEXT        NOT NULL DEFAULT 'pt'
                                 CHECK (locale IN ('pt', 'en')),
  source             TEXT,           -- 'landing' | 'blog' | 'signup' | etc.
  status             TEXT        NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending', 'active', 'unsubscribed', 'bounced')),
  -- 64 hex chars = 256-bit random token; generated server-side per row
  confirm_token      TEXT        NOT NULL UNIQUE,
  unsubscribe_token  TEXT        NOT NULL UNIQUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at       TIMESTAMPTZ,
  unsubscribed_at    TIMESTAMPTZ,
  -- IP + UA captured at signup for abuse forensics. NOT exposed in any
  -- API response — service-role only.
  signup_ip          TEXT,
  signup_ua          TEXT
);

-- Lookups by token are exact-match → indexed via UNIQUE already.
-- Status is filtered when sending campaigns, so an index pays off:
CREATE INDEX IF NOT EXISTS newsletter_status_idx
  ON public.newsletter_subscribers (status);

-- Cleanup: pending entries older than 7 days never confirmed → drop
-- them so the unique-email constraint doesn't permanently lock the
-- address out of re-signup. Run via cron when ready, or manually.
--   DELETE FROM public.newsletter_subscribers
--    WHERE status = 'pending' AND created_at < NOW() - INTERVAL '7 days';

-- RLS: service-role only. No user has direct access.
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;


-- ------------------------------------------------------------
-- >>> net_worth_snapshots_2026_05.sql
-- ------------------------------------------------------------
-- Net-worth history (Património trend)
-- One snapshot per user per day, written whenever the user changes any
-- account balance (create/update/delete). The /contas trend chart reads
-- these. Code degrades gracefully when this table doesn't exist yet, so
-- applying this migration is safe to do at any time.
--
-- Run in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS net_worth_snapshots (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  net           NUMERIC(15, 2) NOT NULL,
  assets        NUMERIC(15, 2) NOT NULL,
  liabilities   NUMERIC(15, 2) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One row per user per day — repeated edits on the same day upsert.
  UNIQUE (user_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_nws_user_date
  ON net_worth_snapshots(user_id, snapshot_date);

-- Service-role only (the API uses the service key); no public policies.
ALTER TABLE net_worth_snapshots ENABLE ROW LEVEL SECURITY;


-- ------------------------------------------------------------
-- >>> streak_freeze_2026_07.sql
-- ------------------------------------------------------------
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


-- ------------------------------------------------------------
-- >>> certificates_2026_07.sql
-- ------------------------------------------------------------
-- ═══════════════════════════════════════════════════════════════════════════
-- CERTIFICADOS DA ACADEMIA — julho 2026
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Até aqui o certificado era 100% client-side: código DERIVADO de
-- course.id+userName+data (mudava se o user renomeasse o perfil, colidia
-- entre homónimos, impossível de verificar). Esta tabela torna-o real:
--   • code gerado no servidor (XPM- + 10 hex), único e permanente;
--   • verificação pública em xp-money.com/verify/<code>;
--   • é o pré-requisito da visão cripto (ancoragem on-chain futura).
--
-- A app funciona SEM esta migração (fallback runtime — o certificado
-- continua com o código derivado, apenas sem URL de verificação).
--
-- Correr no Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS certificates (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id  TEXT NOT NULL,
  code       TEXT NOT NULL UNIQUE,
  user_name  TEXT,
  issued_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_certificates_code    ON certificates(code);
CREATE INDEX IF NOT EXISTS idx_certificates_user_id ON certificates(user_id);

-- RLS: acesso apenas via service-role (todas as leituras/escritas passam
-- pelas rotas API do servidor — incluindo a verificação pública, que só
-- expõe curso + primeiro nome + data).
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;


-- ------------------------------------------------------------
-- >>> onboarding_profile_2026_07.sql
-- ------------------------------------------------------------
-- ============================================================================
-- onboarding_profile — perfil de onboarding agregável (julho 2026)
-- ============================================================================
-- O QUÊ: uma coluna jsonb em `users` com as respostas do onboarding:
--   { "v": 1, "motivation": "debts" | "save_goal" | "track" | "invest" | "curious" | null,
--     "life_stage": "student" | "first_job" | "independent" | "family" | "pre_retire" | null,
--     "goal": "emergency" | ..., "goal_amount": 0,
--     "discovery_source": "social" | "search" | "friend" | "blog" | "other" | null,
--     "challenge_legacy": string | null, "answered_at": ISO }
--
-- PORQUÊ jsonb e não colunas: perguntas futuras do onboarding entram sem
-- nova migração; skip grava null ("não quis responder" também é dado).
--
-- ANTES desta migração: as respostas iam APENAS para Clerk publicMetadata
-- (não agregável — impossível fazer "quantos users vieram por dívidas?")
-- e para PostHog (sem key em produção = vazio). Com a coluna, a secção
-- "Quem são os users" em /admin/metrics ganha dados, e podes agregar no
-- SQL editor:
--
--   select onboarding_profile->>'motivation' as motivo, count(*)
--   from users where onboarding_profile is not null group by 1 order by 2 desc;
--
-- OPCIONAL: o código degrada graciosamente sem ela (retry sem a coluna,
-- mesmo padrão do mascot_gender). Só o dashboard de insight precisa dela.
-- Users que completaram o onboarding ANTES da migração ficam com a coluna
-- a NULL — as respostas deles vivem no Clerk publicMetadata (re-hidratáveis
-- com um script one-off se um dia valer a pena).
-- ============================================================================

alter table public.users
  add column if not exists onboarding_profile jsonb;

comment on column public.users.onboarding_profile is
  'Respostas do onboarding (v1: motivation, life_stage, goal, goal_amount, discovery_source, challenge_legacy, answered_at). Null = onboarding anterior à migração ou ainda não completado.';


-- ------------------------------------------------------------
-- >>> award_xp_rpc_2026_10.sql
-- ------------------------------------------------------------
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


-- >>> stripe_events só é lida pelo servidor (service_role): fechar ao anon
ALTER TABLE IF EXISTS public.stripe_events ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- >>> backfill_missions_xp_2026_10.sql (paga XP de missões antigas; idempotente)
-- ------------------------------------------------------------
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

-- >>> Verificação final: deve devolver os níveis 1,1,2,9,10,19,20
SELECT x, public.xp_level_for(x) AS nivel FROM unnest(ARRAY[0,199,200,15999,16000,99999,100000]) AS x;
