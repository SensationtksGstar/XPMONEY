-- AI cost / observability log.
--
-- Every Gemini and Groq call (parse-statement, scan-receipt, categorize)
-- records one row here so /admin/metrics can compute:
--   • cost per imported statement / scanned receipt
--   • cache hit-rate
--   • per-provider success / quota / timeout breakdown
--   • p50/p95 latency per operation
--
-- Rows are inserted fire-and-forget (failure to log never breaks the user
-- request). RLS: service-role only.

create table if not exists ai_calls (
  id          bigserial    primary key,
  created_at  timestamptz  not null default now(),
  user_id     uuid         references users(id) on delete set null,
  provider    text         not null,
  model       text         not null,
  operation   text         not null check (operation in ('scan-receipt','parse-statement','categorize-batch')),
  tokens_in   integer      not null default 0,
  tokens_out  integer      not null default 0,
  latency_ms  integer      not null default 0,
  cache_hit   boolean      not null default false,
  status      text         not null check (status in ('success','error','timeout','quota','auth')),
  error_msg   text
);

create index if not exists idx_ai_calls_created    on ai_calls(created_at desc);
create index if not exists idx_ai_calls_user_op    on ai_calls(user_id, operation, created_at desc);
create index if not exists idx_ai_calls_status     on ai_calls(status, created_at desc);

alter table ai_calls enable row level security;
-- No policies — only the service role (Supabase admin) reads/writes.
