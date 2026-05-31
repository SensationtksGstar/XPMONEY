import { auth }                      from '@clerk/nextjs/server'
import { NextRequest, NextResponse }   from 'next/server'
import { createSupabaseAdmin }         from '@/lib/supabase'
import { resolveUser }                 from '@/lib/resolveUser'
import { recordNetWorthSnapshot }      from '@/lib/netWorthSnapshot'
import { z }                           from 'zod'

/**
 * PATCH /api/accounts/[id] — update an account the caller owns. Used by the
 * Património (net worth) page to edit balances, names, type, icon, colour.
 *
 * DELETE /api/accounts/[id] — remove an account. BLOCKED when the account
 * still has transactions: the FK is `ON DELETE CASCADE`, so deleting would
 * silently wipe every transaction booked to it. We return 409 with a code
 * the client surfaces as "move/delete its transactions first".
 */

const UpdateAccountSchema = z.object({
  name:    z.string().min(1).max(60).optional(),
  type:    z.enum(['checking', 'savings', 'wallet', 'investment', 'credit']).optional(),
  balance: z.number().optional(),
  color:   z.string().max(20).optional(),
  icon:    z.string().max(8).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const parsed = UpdateAccountSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const db = createSupabaseAdmin()
  const { data, error } = await db
    .from('accounts')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', internalId)   // ownership guard — can only edit own accounts
    .select('*')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data)  return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  // Snapshot net worth for the trend chart (best-effort, never blocks).
  await recordNetWorthSnapshot(db, internalId, new Date().toISOString().split('T')[0])

  return NextResponse.json({ data, error: null })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const db = createSupabaseAdmin()

  // Block deletion when transactions reference this account — the FK cascades,
  // so a delete here would erase the user's history without warning.
  const { count } = await db
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', internalId)
    .eq('account_id', id)

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: 'account_has_transactions', code: 'account_has_transactions', count },
      { status: 409 },
    )
  }

  const { error } = await db
    .from('accounts')
    .delete()
    .eq('id', id)
    .eq('user_id', internalId)   // ownership guard

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Net worth changed — snapshot it (best-effort).
  await recordNetWorthSnapshot(db, internalId, new Date().toISOString().split('T')[0])

  return NextResponse.json({ success: true })
}
