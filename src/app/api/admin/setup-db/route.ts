import { auth }                    from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * One-time database setup endpoint (DEV ONLY).
 *
 * Per CLAUDE.md migrations must be applied by the user via the Supabase SQL
 * editor — there is no DB password available at deploy time. This route is
 * kept only for local scripting during development.
 *
 * Security:
 *   - Hard-refused in production (NODE_ENV === 'production').
 *   - Requires a logged-in Clerk session (prevents random scanners).
 *   - The previous `x-setup-secret: XPMONEY_SETUP` header path is removed:
 *     that secret is committed in the repo and was the sole guard, which made
 *     this endpoint a takeover vector if exposed.
 *
 * Usage (local only):
 *   curl -X POST http://localhost:3000/api/admin/setup-db \
 *     -H "Content-Type: application/json" \
 *     -b "__clerk_session=..." \
 *     -d '{"dbPassword":"your-supabase-db-password"}'
 */

const MIGRATION_SQL = `
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
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'goal_deposits'
    AND policyname  = 'Users manage own deposits'
  ) THEN
    CREATE POLICY "Users manage own deposits"
      ON public.goal_deposits FOR ALL
      USING (
        user_id = (
          SELECT id FROM public.users
          WHERE clerk_id = auth.jwt() ->> 'sub'
          LIMIT 1
        )
      );
  END IF;
END $$;
`

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production.' }, { status: 403 })
  }

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get DB password from body
  let dbPassword: string
  try {
    const body = await req.json()
    dbPassword = body.dbPassword
    if (!dbPassword || typeof dbPassword !== 'string') throw new Error('missing')
  } catch {
    return NextResponse.json({ error: 'Provide {"dbPassword":"..."}' }, { status: 400 })
  }

  const projectRef = 'iuhezbbfrssvlbwqnmhu'

  // Try to dynamically import pg (devDependency only available in local dev)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Client } = require('pg')

    const connStrings = [
      `postgres://postgres.${projectRef}:${dbPassword}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`,
      `postgres://postgres.${projectRef}:${dbPassword}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`,
      `postgres://postgres:${dbPassword}@db.${projectRef}.supabase.co:5432/postgres`,
    ]

    const errors: string[] = []
    for (const connStr of connStrings) {
      const client = new Client({
        connectionString: connStr,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 8000,
      })
      try {
        await client.connect()
        await client.query(MIGRATION_SQL)
        await client.end()
        return NextResponse.json({
          success: true,
          message: 'goal_deposits table created successfully ✓',
        })
      } catch (err: unknown) {
        errors.push(String(err instanceof Error ? err.message : err).slice(0, 120))
        try { await client.end() } catch { /* ignore */ }
      }
    }

    return NextResponse.json({
      success: false,
      error: 'All connection attempts failed',
      details: errors,
      hint: 'Check DB password in Supabase Dashboard → Settings → Database',
    }, { status: 500 })

  } catch (err: unknown) {
    return NextResponse.json({
      error: 'Setup failed',
      detail: String(err instanceof Error ? err.message : err),
    }, { status: 500 })
  }
}
