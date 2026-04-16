import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin }       from '@/lib/supabase'
import webpush                       from 'web-push'

// ── Motivational daily reminders (PT-PT) ─────────────────────────────────────
// Large pool — rotates pseudo-randomly based on date so everyone gets
// the same message on the same day (feels curated, not random).
const MESSAGES = [
  { title: '💰 Regista as tuas despesas hoje!', body: 'Cada euro conta. 2 minutos fazem a diferença.' },
  { title: '📊 Como está o teu Score XP Money?', body: 'Verifica os teus hábitos e mantém o score a subir!' },
  { title: '🎯 Tens missões por completar!', body: 'Completa missões diárias e ganha XP para evoluir o Voltix.' },
  { title: '🔥 Mantém o teu streak hoje!', body: 'Não percas a sequência — regista pelo menos uma transação.' },
  { title: '🏆 Verifica as tuas poupanças', body: 'Estás perto dos teus objetivos? Faz um depósito hoje!' },
  { title: '⚡ O Voltix está à tua espera!', body: 'O teu copiloto financeiro tem novidades. Abre a app!' },
  { title: '📈 Semana nova, metas novas!', body: 'Define a tua meta financeira para esta semana.' },
  { title: '💡 Sabias?', body: 'Pequenas despesas diárias somam grandes valores no fim do mês. Regista-as!' },
  { title: '🌱 Investe em ti', body: 'Quem controla o dinheiro, controla o futuro. Começa agora.' },
  { title: '☕ Menos 1 café por dia', body: 'São 30€/mês. Em 1 ano, 360€ no teu fundo de emergência.' },
  { title: '🚀 Constrói o teu império', body: 'Liberdade financeira faz-se uma transação de cada vez.' },
  { title: '🧠 Gestão = liberdade', body: 'Quem sabe onde o dinheiro está, nunca está preso a ninguém.' },
  { title: '💪 Disciplina > motivação', body: 'Regista hoje, mesmo sem vontade. É assim que se ganha.' },
  { title: '🎮 +XP à tua espera', body: 'Cada transação registada = +5 XP. Vamos subir de nível!' },
  { title: '🔐 Fundo de emergência', body: '3 a 6 meses de despesas guardados. Estás no caminho?' },
  { title: '📉 Onde foi o dinheiro?', body: 'Abre a app e descobre onde estão a fugir os teus euros.' },
  { title: '🌟 Pequenos passos, grandes resultados', body: 'Um registo hoje é +1 passo para a tua independência.' },
  { title: '⏰ 2 minutos agora', body: 'Regista os gastos de hoje antes que te esqueças.' },
  { title: '🎯 A regra dos 50/30/20', body: 'Essenciais / Desejos / Poupança. Estás a cumprir?' },
  { title: '💎 Rico é quem controla o seu dinheiro', body: 'Não é quem ganha mais. Começa hoje.' },
  { title: '🧘 Paz financeira', body: 'Saber exactamente quanto tens e gastas = dormir descansado.' },
  { title: '🚴 Consistência vence talento', body: 'Regista todos os dias. Em 30 dias vais ver o impacto.' },
  { title: '🏅 Completa hoje o teu check-in', body: 'Streak + XP + Voltix feliz. Tudo num clique.' },
  { title: '🎓 Aprende e ganha', body: 'Completa um curso da Academia e ganha o teu certificado.' },
  { title: '💸 Despesas recorrentes', body: 'Netflix, Spotify, ginásio… já somaste quanto gastas?' },
  { title: '📅 Reviste a tua semana', body: 'Quanto gastaste em supérfluos? Vale a pena?' },
  { title: '🔔 Lembrete amigável', body: 'Não deixes para amanhã o registo que podes fazer hoje.' },
  { title: '🌅 Começa o dia bem', body: 'Abre a XP Money e define o tom financeiro do dia.' },
  { title: '🎁 Dinheiro poupado é dinheiro ganho', body: 'Transfere já para a tua meta. O teu eu futuro agradece.' },
  { title: '⚔️ Guerreiro das finanças', body: 'Cada registo é uma batalha vencida. Continua assim!' },
]

// Deterministic daily index — same day = same message for all users
function pickDailyIndex(): number {
  const d        = new Date()
  const dayIndex = Math.floor(d.getTime() / (24 * 60 * 60 * 1000))
  return dayIndex % MESSAGES.length
}

function initVapid() {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL ?? 'mailto:xpmoney@app.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '',
    process.env.VAPID_PRIVATE_KEY ?? '',
  )
}

// Authorization: only the Vercel Cron job may trigger a broadcast.
// The previous legacy `x-setup-secret: XPMONEY_SETUP` path is removed — the
// secret was committed in the repo, making daily-spam of every subscriber
// one curl away for anyone who read the source.
function authorised(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  const authHeader = req.headers.get('authorization')
  return authHeader === `Bearer ${cronSecret}`
}

async function sendDailyBroadcast() {
  initVapid()

  const db = createSupabaseAdmin()

  const { data: subs, error } = await db
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')

  if (error) {
    return { error: error.message, status: 500 }
  }
  if (!subs || subs.length === 0) {
    return { sent: 0, failed: 0, total: 0, message: 'No subscribers' }
  }

  const msg = MESSAGES[pickDailyIndex()] ?? MESSAGES[0]

  const results = await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({
          title: msg.title,
          body:  msg.body,
          icon:  '/icon',
          badge: '/icon',
          url:   '/dashboard',
        }),
        { TTL: 86400 },
      )
    )
  )

  const sent   = results.filter(r => r.status === 'fulfilled').length
  const failed = results.filter(r => r.status === 'rejected').length

  // Clean up expired/invalid subscriptions (410 Gone / 404 Not Found)
  const expiredEndpoints = subs
    .filter((_, i) => {
      const r = results[i]
      if (r.status !== 'rejected') return false
      const statusCode = (r.reason as { statusCode?: number })?.statusCode
      return statusCode === 404 || statusCode === 410
    })
    .map(s => s.endpoint)

  if (expiredEndpoints.length > 0) {
    await db.from('push_subscriptions').delete().in('endpoint', expiredEndpoints)
  }

  return { sent, failed, total: subs.length, message: msg.title }
}

// POST — manual trigger (admin or cron via secret header)
export async function POST(req: NextRequest) {
  if (!authorised(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const result = await sendDailyBroadcast()
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }
  return NextResponse.json(result)
}

// GET — used by Vercel Cron (sends Authorization: Bearer <CRON_SECRET>)
export async function GET(req: NextRequest) {
  if (!authorised(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const result = await sendDailyBroadcast()
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }
  return NextResponse.json(result)
}
