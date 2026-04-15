#!/usr/bin/env node
/**
 * XP Money — Create goal_deposits table
 * Usage: node scripts/create-table.mjs <db-password>
 *
 * Find your DB password:
 *   Supabase Dashboard → Settings → Database → Database password
 */

import { createInterface } from 'readline'
import { createRequire }   from 'module'

const require = createRequire(import.meta.url)
const { Client } = require('pg')

const G = '\x1b[32m', Y = '\x1b[33m', R = '\x1b[31m', D = '\x1b[2m', B = '\x1b[1m', X = '\x1b[0m'
const log = m => console.log(m)

const SQL = `
CREATE TABLE IF NOT EXISTS public.goal_deposits (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id     UUID          NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  user_id     UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount      NUMERIC(15,2) NOT NULL,
  note        TEXT          NOT NULL DEFAULT '',
  date        DATE          NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_goal_deposits_goal_id ON public.goal_deposits(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_deposits_user_id ON public.goal_deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_deposits_date    ON public.goal_deposits(date DESC);
ALTER TABLE public.goal_deposits ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='goal_deposits' AND policyname='Users manage own deposits') THEN
    CREATE POLICY "Users manage own deposits" ON public.goal_deposits FOR ALL
    USING (user_id = (SELECT id FROM public.users WHERE clerk_id = auth.jwt() ->> 'sub' LIMIT 1));
  END IF;
END $$;
`

async function tryConnect(connStr) {
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 })
  await client.connect()
  await client.query(SQL)
  await client.end()
}

async function main() {
  const ref = 'iuhezbbfrssvlbwqnmhu'
  let dbPassword = process.argv[2]

  if (!dbPassword) {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    dbPassword = await new Promise(r => rl.question(
      `${B}Cole a password da base de dados Supabase:${X} `, r
    ))
    rl.close()
  }

  dbPassword = dbPassword.trim()
  log('')
  log(`${B}A criar tabela goal_deposits…${X}`)

  const attempts = [
    [`postgres://postgres.${ref}:${dbPassword}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`, 'Session pooler (EU)'],
    [`postgres://postgres.${ref}:${dbPassword}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`,    'Session pooler (US)'],
    [`postgres://postgres.${ref}:${dbPassword}@aws-0-eu-west-2.pooler.supabase.com:5432/postgres`,    'Session pooler (UK)'],
    [`postgres://postgres.${ref}:${dbPassword}@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`,'Session pooler (SG)'],
  ]

  for (const [connStr, label] of attempts) {
    try {
      process.stdout.write(`  Trying ${label}… `)
      await tryConnect(connStr)
      log(`${G}✓ OK!${X}`)
      log('')
      log(`${G}${B}✓ Tabela goal_deposits criada com sucesso!${X}`)
      log('')
      return
    } catch (e) {
      log(`${R}✗${X} ${D}${String(e.message).slice(0, 60)}${X}`)
    }
  }

  log('')
  log(`${Y}${B}Não foi possível conectar via pooler.${X}`)
  log(`${Y}Cola este SQL no Supabase SQL Editor:${X}`)
  log(`  https://supabase.com/dashboard/project/${ref}/sql/new`)
  log('')
  log(D + SQL + X)
}

main().catch(e => { console.error(e.message); process.exit(1) })
