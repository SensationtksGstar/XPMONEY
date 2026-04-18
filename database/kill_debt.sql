-- ─────────────────────────────────────────────────────────────────────────────
-- Kill Debt — feature premium para eliminação de dívidas
--
-- O utilizador regista as suas dívidas (cartão, pessoal, carro, etc.) com
-- saldo actual, taxa anual e prestação mínima. Pode escolher uma de duas
-- estratégias (avalanche = juro mais alto primeiro; snowball = valor mais
-- baixo primeiro) e registar "ataques" — amortizações extra — que baixam o
-- saldo e dão XP.
--
-- Duas tabelas:
--   • debts         — cada dívida em andamento ou já abatida
--   • debt_attacks  — histórico de pagamentos aplicados à dívida
--
-- Ambas com RLS: o utilizador só vê e manipula os seus próprios registos.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── debts ───────────────────────────────────────────────────────────────────
create table if not exists public.debts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  name            text not null,
  category        text not null default 'outro',
  initial_amount  numeric(12, 2) not null check (initial_amount >= 0),
  current_amount  numeric(12, 2) not null check (current_amount >= 0),
  interest_rate   numeric(5, 2) not null default 0 check (interest_rate >= 0 and interest_rate <= 100),
  min_payment     numeric(12, 2) not null default 0 check (min_payment >= 0),
  strategy        text not null default 'avalanche' check (strategy in ('avalanche', 'snowball')),
  status          text not null default 'active' check (status in ('active', 'killed')),
  killed_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_debts_user_status
  on public.debts(user_id, status);

comment on table public.debts is
  'Dívidas do utilizador — cartão, pessoal, carro, hipoteca, etc. — para tracking na feature Kill Debt.';
comment on column public.debts.interest_rate is
  'Taxa anual efectiva global em percentagem (ex: 14.99 = 14,99%).';
comment on column public.debts.strategy is
  'Estratégia de abate: avalanche (juro mais alto primeiro) ou snowball (saldo mais baixo primeiro).';

-- ── debt_attacks ─────────────────────────────────────────────────────────────
create table if not exists public.debt_attacks (
  id          uuid primary key default gen_random_uuid(),
  debt_id     uuid not null references public.debts(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  amount      numeric(12, 2) not null check (amount > 0),
  xp_earned   integer not null default 0,
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_debt_attacks_debt
  on public.debt_attacks(debt_id, created_at desc);
create index if not exists idx_debt_attacks_user
  on public.debt_attacks(user_id, created_at desc);

comment on table public.debt_attacks is
  'Histórico de amortizações (pagamentos extra) aplicadas a uma dívida.';

-- ── updated_at trigger ──────────────────────────────────────────────────────
create or replace function public.touch_debts_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_debts_updated_at on public.debts;
create trigger trg_debts_updated_at
  before update on public.debts
  for each row execute function public.touch_debts_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.debts        enable row level security;
alter table public.debt_attacks enable row level security;

-- Service role (Supabase admin) bypassa RLS — mantido para o backend fazer
-- leituras/escritas em nome do user via createSupabaseAdmin().
drop policy if exists "debts_service_role"        on public.debts;
drop policy if exists "debt_attacks_service_role" on public.debt_attacks;
create policy "debts_service_role"
  on public.debts
  for all
  to service_role
  using (true)
  with check (true);
create policy "debt_attacks_service_role"
  on public.debt_attacks
  for all
  to service_role
  using (true)
  with check (true);

-- Clientes autenticados (via Clerk JWT mapeado a auth.uid()) — cada user só
-- vê e manipula os seus próprios registos. Isto é o guard-rail em caso de
-- leitura directa do Supabase a partir do browser.
drop policy if exists "debts_own_rows"        on public.debts;
drop policy if exists "debt_attacks_own_rows" on public.debt_attacks;
create policy "debts_own_rows"
  on public.debts
  for all
  to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "debt_attacks_own_rows"
  on public.debt_attacks
  for all
  to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());
