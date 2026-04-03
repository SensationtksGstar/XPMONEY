import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Client-side: usa a anon key (segura no browser)
export const supabase = createClient(supabaseUrl, supabaseAnon)

// Server-side: usa a service role key (apenas em API routes e Server Components)
// NUNCA expor no browser
export function createSupabaseAdmin() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY não definida')
  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// Helper para queries autenticadas com Clerk user id
export function createSupabaseWithUser(clerkUserId: string) {
  return createClient(supabaseUrl, supabaseAnon, {
    global: {
      headers: { 'x-clerk-user-id': clerkUserId },
    },
  })
}
