import { auth, clerkClient }        from '@clerk/nextjs/server'
import { NextRequest, NextResponse }   from 'next/server'
import { createSupabaseAdmin }         from '@/lib/supabase'
import { z }                           from 'zod'

/**
 * Profile API.
 *
 * `challenge` and `goal` are stored in Clerk's `publicMetadata` rather than
 * the Supabase `users` table — those columns don't exist in the schema and we
 * can't run DDL from code. Clerk metadata survives across devices/sessions
 * and needs no migration. The rest (name, currency, mascot_gender) lives in
 * Supabase as before.
 */

const UpdateProfileSchema = z.object({
  name:          z.string().min(1).max(100).optional(),
  challenge:     z.string().max(40).optional(),
  goal:          z.string().max(40).optional(),
  currency:      z.string().length(3).optional(),
  mascot_gender: z.enum(['voltix', 'penny']).optional(),
})

interface ProfileMeta {
  challenge?: string
  goal?:     string
}

export async function GET(_req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createSupabaseAdmin()
  const { data: dbProfile, error } = await db
    .from('users')
    .select('id, name, email, avatar_url, plan, currency, mascot_gender, created_at')
    .eq('clerk_id', userId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Pull challenge/goal from Clerk publicMetadata
  let meta: ProfileMeta = {}
  try {
    const clerk = await clerkClient()
    const u     = await clerk.users.getUser(userId)
    meta        = (u.publicMetadata ?? {}) as ProfileMeta
  } catch (err) {
    console.warn('[profile] failed to read Clerk metadata:', err)
  }

  return NextResponse.json({
    data: {
      ...(dbProfile ?? {}),
      challenge: meta.challenge ?? '',
      goal:      meta.goal      ?? '',
    },
    error: null,
  })
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await req.json()
  const parsed = UpdateProfileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const db = createSupabaseAdmin()

  // ── 1. Update DB columns that exist (name, currency, mascot_gender) ──
  const dbUpdates: Record<string, string> = { updated_at: new Date().toISOString() }
  if (parsed.data.name)          dbUpdates.name          = parsed.data.name
  if (parsed.data.currency)      dbUpdates.currency      = parsed.data.currency
  if (parsed.data.mascot_gender) dbUpdates.mascot_gender = parsed.data.mascot_gender

  // Only hit the DB if there's something other than updated_at to save
  if (Object.keys(dbUpdates).length > 1) {
    const { error } = await db
      .from('users')
      .update(dbUpdates)
      .eq('clerk_id', userId)

    if (error) {
      console.error('[profile] db update failed:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  // ── 2. Update Clerk publicMetadata for challenge/goal (no DDL needed) ──
  if (parsed.data.challenge !== undefined || parsed.data.goal !== undefined) {
    try {
      const clerk    = await clerkClient()
      const current  = await clerk.users.getUser(userId)
      const existing = (current.publicMetadata ?? {}) as ProfileMeta

      await clerk.users.updateUserMetadata(userId, {
        publicMetadata: {
          ...current.publicMetadata,
          challenge: parsed.data.challenge ?? existing.challenge ?? '',
          goal:      parsed.data.goal      ?? existing.goal      ?? '',
        },
      })
    } catch (err) {
      console.error('[profile] clerk metadata update failed:', err)
      return NextResponse.json(
        { error: 'Não foi possível guardar objetivos. Tenta novamente.' },
        { status: 500 },
      )
    }
  }

  // ── 3. Return merged profile ──
  const { data: fresh } = await db
    .from('users')
    .select('id, name, email, avatar_url, plan, currency, mascot_gender')
    .eq('clerk_id', userId)
    .maybeSingle()

  return NextResponse.json({
    data: {
      ...(fresh ?? {}),
      challenge: parsed.data.challenge ?? '',
      goal:      parsed.data.goal      ?? '',
    },
    error: null,
  })
}
