import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const https = require('https')

const ACCESS_TOKEN = process.argv[2]
const REF = 'iuhezbbfrssvlbwqnmhu'

const sql = `DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'goal_deposits'
    AND policyname = 'Users manage own deposits'
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
END
$do$`

const body = JSON.stringify({ query: sql })

const options = {
  hostname: 'api.supabase.com',
  path: `/v1/projects/${REF}/database/query`,
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  }
}

const req = https.request(options, res => {
  let data = ''
  res.on('data', chunk => data += chunk)
  res.on('end', () => {
    console.log('Result:', data)
  })
})
req.on('error', e => console.error('Error:', e.message))
req.write(body)
req.end()
