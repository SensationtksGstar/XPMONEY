-- ─────────────────────────────────────────────────────────────────────────────
-- AI Receipt Cache
-- Caches the structured result of receipt OCR scans by SHA-256 hash of the
-- uploaded image. When the same image is uploaded again (user retries, or
-- two users upload an identical image) we serve the cached result and skip
-- the AI call entirely.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.ai_receipt_cache (
  image_hash   text        primary key,
  result       jsonb       not null,
  hit_count    integer     not null default 1,
  provider     text,               -- which AI provider produced the result
  created_at   timestamptz not null default now(),
  last_hit_at  timestamptz not null default now()
);

create index if not exists ai_receipt_cache_created_idx
  on public.ai_receipt_cache (created_at desc);

-- Service-role only — deny direct access to authenticated/anon roles.
alter table public.ai_receipt_cache enable row level security;
-- No policies = effectively read/write only via service role.

-- Helper RPC to atomically increment hit_count + bump last_hit_at.
create or replace function public.bump_ai_cache_hit(p_hash text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.ai_receipt_cache
     set hit_count   = hit_count + 1,
         last_hit_at = now()
   where image_hash = p_hash;
$$;

-- Optional: scheduled cleanup job (run manually or via cron) to purge entries
-- older than 30 days.
-- delete from public.ai_receipt_cache where created_at < now() - interval '30 days';
