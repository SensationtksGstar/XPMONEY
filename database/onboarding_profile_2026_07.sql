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
