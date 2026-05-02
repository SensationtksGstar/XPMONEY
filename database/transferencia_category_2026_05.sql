-- Add "Transferência" as a default category.
--
-- Many PT bank statements (especially Montepio with MB WAY) list both
-- sides of intra-account moves as separate transactions: a TRF outgoing
-- AND a TR-IPS incoming with the user's own name. Without a Transfer
-- category these inflate both income AND expense by the same amount,
-- making the dashboard's "receitas / despesas" totals misleading.
--
-- The import pipeline now auto-detects these pairs (lib/selfTransferDetect.ts)
-- and assigns them to this category. Dashboard widgets filter
-- type='transfer' OR category.name='Transferência' out of income/expense.

INSERT INTO categories (name, icon, color, transaction_type, is_default) VALUES
  ('Transferência', '🔁', '#a78bfa', 'both', TRUE)
ON CONFLICT DO NOTHING;
