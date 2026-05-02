-- Global merchant → category cache.
--
-- Once a merchant description is categorized (by AI or by a user manually
-- correcting in the preview), the result lives here for ALL users. Next
-- time anyone imports a statement with the same normalized description,
-- we read from cache and never call AI for it again.
--
-- Privacy note (CRITICAL): this table is GLOBAL — descriptions live here
-- across users. We MUST NOT store descriptions that contain PII. The
-- application-level allowlist (src/lib/merchantCache.ts → isAllowedToCache)
-- only writes descriptions that match merchant patterns ("COMPRA *",
-- "MB WAY *", "DD *", etc.) and explicitly REJECTS personal-transfer
-- shapes ("TR-IPS-<NAME>", "IBAN ...", phone-number-only descriptors).
--
-- Confidence + validations let us evolve a category over time:
--   • First write: confidence 0.5, validations 1
--   • User confirmed (didn't change category in preview): confidence ↑, validations++
--   • User corrected (changed in preview): confidence reset, validations reset
-- Reads only trust entries with validations ≥ 2 OR confidence ≥ 0.8.

create table if not exists merchant_categories (
  normalized_desc  text         primary key,
  category         text         not null,
  merchant         text,
  confidence       real         not null default 0.5 check (confidence >= 0 and confidence <= 1),
  validations      integer      not null default 1 check (validations >= 0),
  source           text         not null default 'ai' check (source in ('ai','user','seed')),
  created_at       timestamptz  not null default now(),
  updated_at       timestamptz  not null default now()
);

create index if not exists idx_merchant_categories_updated on merchant_categories(updated_at desc);
create index if not exists idx_merchant_categories_validations on merchant_categories(validations desc);

alter table merchant_categories enable row level security;
-- No policies — only the service role (Supabase admin) reads/writes.

-- Helper: bump validations + confidence on confirmed reuse. Idempotent —
-- safe to call from many requests in parallel; Postgres serializes the
-- update via the row-level lock on the primary key.
create or replace function bump_merchant_validation(p_normalized_desc text, p_category text)
returns void language plpgsql as $$
begin
  update merchant_categories
     set validations = validations + 1,
         confidence  = least(1.0, confidence + 0.05),
         updated_at  = now()
   where normalized_desc = p_normalized_desc
     and category        = p_category;
end;
$$;
