-- ─────────────────────────────────────────────────────────────────────────────
-- Orçamento Pessoal — feature FREE que aplica o método 50/30/20
--
-- 50% Necessidades (renda, alimentação, transporte, saúde) ·
-- 30% Desejos (lazer, restaurantes, subscrições não essenciais) ·
-- 20% Poupança (investimento, fundo emergência, objetivos)
--
-- Uma linha por user com o rendimento mensal + percentagens configuradas.
-- Percentagens defaultam a 50/30/20 mas o user pode ajustar (ex: 40/30/30
-- para quem está a agressivamente poupar).
--
-- A tabela budgets tem um único row por user (UNIQUE constraint em user_id).
-- Service role bypassa RLS; user autenticado só vê o seu próprio row.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.budgets (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references public.users(id) on delete cascade,
  monthly_income  numeric(12, 2) not null default 0 check (monthly_income >= 0),
  pct_needs       numeric(5, 2)  not null default 50.0 check (pct_needs   >= 0 and pct_needs   <= 100),
  pct_wants       numeric(5, 2)  not null default 30.0 check (pct_wants   >= 0 and pct_wants   <= 100),
  pct_savings     numeric(5, 2)  not null default 20.0 check (pct_savings >= 0 and pct_savings <= 100),
  updated_at      timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create index if not exists idx_budgets_user on public.budgets(user_id);

comment on table public.budgets is
  'Orçamento Pessoal (método 50/30/20) — um por utilizador.';
comment on column public.budgets.monthly_income is
  'Rendimento líquido mensal expectável em EUR.';

-- ── updated_at trigger ──────────────────────────────────────────────────────
create or replace function public.touch_budgets_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_budgets_updated_at on public.budgets;
create trigger trg_budgets_updated_at
  before update on public.budgets
  for each row execute function public.touch_budgets_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.budgets enable row level security;

drop policy if exists "budgets_service_role" on public.budgets;
create policy "budgets_service_role"
  on public.budgets
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "budgets_own_rows" on public.budgets;
create policy "budgets_own_rows"
  on public.budgets
  for all
  to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());
