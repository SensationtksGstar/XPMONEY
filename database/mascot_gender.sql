-- ─────────────────────────────────────────────────────────────────────────────
-- Mascot gender — user can pick Voltix (male, blue dragon) or Penny (female,
-- white angel-cat) as their companion mascot during onboarding. Defaults to
-- Voltix for backwards compatibility.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.users
  add column if not exists mascot_gender text
    check (mascot_gender in ('voltix', 'penny'))
    default 'voltix';

comment on column public.users.mascot_gender is
  'Which mascot the user picked during onboarding — voltix (male) or penny (female).';
