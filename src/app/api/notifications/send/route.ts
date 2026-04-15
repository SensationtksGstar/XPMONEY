import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin }       from '@/lib/supabase'
import webpush                       from 'web-push'

// Motivational daily reminders — rotates based on day of week
const MESSAGES = [
  { title: '💰 Regista as tuas despesas hoje!', body: 'Cada euro conta. 2 minutos de atenção às finanças fazem a diferença.' },
  { title: '📊 Como está o teu Score XP Money?', body: 'Verifica os teus hábitos financeiros e mantém o score a subir!' },
  { title: '🎯 Tens missões por completar!', body: 'Completa as tuas missões diárias e ganha XP para evoluir o Voltix.' },
  { title: '🔥 Mantém o streak hoje!', body: 'Não percas a sequência — regista pelo menos uma transação hoje.' },
  { title: '🏆 Verifica as tuas poupanças', body: 'Estás a aproximar-te dos teus objetivos? Faz um depósito hoje!' },
  { title: '⚡ O Voltix está à tua espera!', body: 'O teu copiloto financeiro tem novidades. Abre a app para ver!' },
  { title: '📈 Semana nova, metas novas!', body: 'Define a tua meta financeira para esta semana e cumpre-a.' },
]

function initVapid() {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL ?? 'mailto:xpmoney@app.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '',
    process.env.VAPID_PRIVATE_KEY ?? '',
  )
}

export async function POST(req: NextRequest) {
  initVapid()
  // Protected by secret header (used by cron job or admin)
  const secret = req.headers.get('x-setup-secret')
  if (secret !== 'XPMONEY_SETUP') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const db = createSupabaseAdmin()

  // Get all push subscriptions
  const { data: subs, error } = await db
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!subs || subs.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No subscribers' })
  }

  // Pick message based on day of week
  const msg = MESSAGES[new Date().getDay()] ?? MESSAGES[0]

  const results = await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify({
          title: msg.title,
          body:  msg.body,
          icon:  '/icons/icon-192.png',
          badge: '/icons/icon-96.png',
          url:   '/dashboard',
        }),
        { TTL: 86400 }, // 24h time-to-live
      )
    )
  )

  const sent   = results.filter(r => r.status === 'fulfilled').length
  const failed = results.filter(r => r.status === 'rejected').length

  // Clean up expired/invalid subscriptions
  const expiredEndpoints = subs
    .filter((_, i) => results[i].status === 'rejected')
    .map(s => s.endpoint)

  if (expiredEndpoints.length > 0) {
    await db
      .from('push_subscriptions')
      .delete()
      .in('endpoint', expiredEndpoints)
  }

  return NextResponse.json({ sent, failed, total: subs.length })
}

// GET endpoint for testing: send a test notification to the calling user
export async function GET(req: NextRequest) {
  initVapid()
  const secret = req.headers.get('x-setup-secret')
  if (secret !== 'XPMONEY_SETUP') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const db = createSupabaseAdmin()
  const { data: subs } = await db
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .limit(1)

  if (!subs || subs.length === 0) {
    return NextResponse.json({ message: 'No subscribers found' })
  }

  try {
    await webpush.sendNotification(
      { endpoint: subs[0].endpoint, keys: { p256dh: subs[0].p256dh, auth: subs[0].auth } },
      JSON.stringify({
        title: '✅ Notificações ativas!',
        body:  'As notificações diárias da XP Money estão a funcionar corretamente.',
        icon:  '/icons/icon-192.png',
        url:   '/dashboard',
      }),
    )
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}
