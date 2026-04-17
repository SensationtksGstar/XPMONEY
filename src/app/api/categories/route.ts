import { auth }                    from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin }       from '@/lib/supabase'
import { resolveUser }               from '@/lib/resolveUser'
import { isDemoMode, demoResponse }  from '@/lib/demo/demoGuard'
import { DEMO_CATEGORIES }           from '@/lib/demo/mockData'
import { z }                         from 'zod'

export async function GET(_req: NextRequest) {
  if (isDemoMode()) return demoResponse(DEMO_CATEGORIES)

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createSupabaseAdmin()

  const { data: user } = await db
    .from('users')
    .select('id')
    .eq('clerk_id', userId)
    .single()

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { data, error } = await db
    .from('categories')
    .select('*')
    .or(`user_id.eq.${user.id},is_default.eq.true`)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, error: null })
}

/**
 * POST /api/categories — creates a user-owned custom category.
 *
 * The schema already supports per-user categories via `user_id`; the row just
 * needs to be inserted with `is_default = false`. We validate that the user
 * doesn't already own a category with the same name (case-insensitive) so the
 * category dropdown in TransactionForm doesn't show duplicates.
 */
const CreateCategorySchema = z.object({
  name:             z.string().trim().min(1).max(40),
  icon:             z.string().trim().min(1).max(8).default('📦'),
  color:            z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida').default('#94a3b8'),
  transaction_type: z.enum(['income', 'expense', 'both']).default('both'),
})

export async function POST(req: NextRequest) {
  if (isDemoMode()) {
    return NextResponse.json(
      { error: 'Não podes criar categorias no modo de demonstração.' },
      { status: 403 },
    )
  }

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const parsed = CreateCategorySchema.safeParse(body)
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0]
    return NextResponse.json(
      { error: first ?? 'Dados inválidos.' },
      { status: 400 },
    )
  }

  const db = createSupabaseAdmin()
  const name = parsed.data.name

  // Duplicate guard: match against both system defaults and the user's own
  // categories (case-insensitive). Prevents a user from creating "Casa" when
  // the system already seeds "Casa" — the dropdown would show two identical
  // rows and transactions would split between them.
  const { data: clash } = await db
    .from('categories')
    .select('id, name, is_default')
    .or(`user_id.eq.${internalId},is_default.eq.true`)
    .ilike('name', name)
    .limit(1)
    .maybeSingle()

  if (clash) {
    return NextResponse.json(
      { error: `Já existe uma categoria "${clash.name}".` },
      { status: 409 },
    )
  }

  const { data: inserted, error } = await db
    .from('categories')
    .insert({
      user_id:          internalId,
      name,
      icon:             parsed.data.icon,
      color:            parsed.data.color,
      transaction_type: parsed.data.transaction_type,
      is_default:       false,
    })
    .select()
    .single()

  if (error) {
    console.error('[categories] insert failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: inserted, error: null }, { status: 201 })
}
