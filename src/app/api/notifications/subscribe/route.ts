import { auth }                    from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin }       from '@/lib/supabase'
import { resolveUser }               from '@/lib/resolveUser'
import { getServerLocale }           from '@/lib/i18n/server'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const subscription = await req.json()
  if (!subscription?.endpoint) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
  }

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Resolve locale from cookie so the subscriber gets push notifications
  // in their chosen language. If the DB doesn't yet have the `locale`
  // column (pre-migration install), the upsert below retries without it.
  const locale = await getServerLocale()

  const db = createSupabaseAdmin()

  const payload: Record<string, unknown> = {
    user_id:  internalId,
    endpoint: subscription.endpoint,
    p256dh:   subscription.keys?.p256dh ?? '',
    auth:     subscription.keys?.auth ?? '',
    locale,
  }

  let { error } = await db
    .from('push_subscriptions')
    .upsert(payload, { onConflict: 'user_id,endpoint' })

  // Fallback: retry without `locale` if the column does not exist yet.
  if (error && /locale/i.test(error.message)) {
    delete payload.locale
    ;({ error } = await db
      .from('push_subscriptions')
      .upsert(payload, { onConflict: 'user_id,endpoint' }))
  }

  if (error) {
    console.error('[subscribe]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { endpoint } = await req.json()

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const db = createSupabaseAdmin()

  await db
    .from('push_subscriptions')
    .delete()
    .eq('user_id', internalId)
    .eq('endpoint', endpoint)

  return NextResponse.json({ success: true })
}
