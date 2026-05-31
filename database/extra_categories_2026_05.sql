-- Extra default categories — May 2026.
--
-- User feedback: the seed (12 categories from schema.sql + Transferência
-- from the May patch) leaves common PT-finance buckets unrepresented.
-- Adding them as defaults so every fresh user gets a richer dropdown
-- without manual setup, and so the AI categorizer in lib/ai.ts has
-- more discriminative options.
--
-- ON CONFLICT DO NOTHING — idempotent, safe to re-run, won't disturb
-- any matching category the user (or a previous migration) already
-- created.
--
-- Naming convention: PT-PT, capitalised, no diacritics in identifiers
-- but full diacritics in display.
INSERT INTO categories (name, icon, color, transaction_type, is_default) VALUES
  -- ── EXPENSE
  ('Serviços',     '🔧', '#0ea5e9', 'expense', TRUE),  -- canalizador, electricista, internet, mecânico
  ('Subscrições',  '📺', '#a855f7', 'expense', TRUE),  -- Netflix, Spotify, ginásio, jornais, software
  ('Impostos',     '🏛️', '#dc2626', 'expense', TRUE),  -- IRS, IUC, IMI, taxas
  ('Seguros',      '🛡️', '#0891b2', 'expense', TRUE),  -- auto, casa, vida, saúde
  ('Animais',      '🐾', '#ca8a04', 'expense', TRUE),  -- veterinário, ração, tosquia
  ('Restaurante',  '🍽️', '#fb923c', 'expense', TRUE),  -- separado de "Alimentação" (supermercado)
  ('Combustível',  '⛽', '#1e40af', 'expense', TRUE),  -- separado de "Transporte" (passes, uber, etc.)
  ('Viagens',      '✈️', '#7c3aed', 'expense', TRUE),  -- férias, hotéis, voos

  -- ── INCOME
  ('Renda',        '🏠', '#16a34a', 'income',  TRUE),  -- arrendamento que recebes (não confundir com despesa "Casa")
  ('Reembolsos',   '💸', '#14b8a6', 'income',  TRUE),  -- IRS, devoluções, seguros
  ('Vendas',       '🏷️', '#eab308', 'income',  TRUE),  -- OLX, Vinted, mobília usada
  ('Prémios',      '🎁', '#f59e0b', 'income',  TRUE),  -- bónus, prémios profissionais, lotaria
  ('Dividendos',   '📊', '#84cc16', 'income',  TRUE)   -- distinto de "Investimentos" — só os fluxos de retorno
ON CONFLICT DO NOTHING;
