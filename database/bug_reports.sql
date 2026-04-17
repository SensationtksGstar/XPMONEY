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
create index if not exists bug_reports_created_at_idx on bug_reports (created_at desc);

-- RLS: off. The table is admin-only — all writes go through the service role.
alter table bug_reports enable row level security;

-- No SELECT/INSERT/UPDATE/DELETE policies for anon or authenticated roles —
-- they have zero access. Service role (our admin client) bypasses RLS so
-- /api/bug-report can still INSERT.
