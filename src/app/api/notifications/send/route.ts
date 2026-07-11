import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin }       from '@/lib/supabase'
import { XP_REWARDS }                from '@/types'
import webpush                       from 'web-push'

// =============================================================================
//  Daily push notifications — XP-Money
// =============================================================================
//
//  Two kinds of messages, intentionally separated so the notification is
//  never generic "please come back":
//
//    A. REGISTER reminders  — for subscribers who did NOT log a transaction
//       in the previous 24 h. Tone: practical nudge ("você esqueceu-se de
//       hoje"), never guilt.
//    B. MOTIVATIONAL quotes — for everyone else. Tone: habit-reinforcing,
//       brand-voice aphorisms about saving + financial freedom.
//
//  The system picks A or B per subscriber at send time (one DB call per
//  subscriber), then rotates deterministically within the chosen bank
//  based on the calendar day — so a given user gets the same message as
//  every other user of the same locale that day, but the message bank
//  mirrors their actual state. Keeps the broadcast feeling curated,
//  not spammed.
//
//  Cron: Vercel cron at 18:00 UTC daily (vercel.json).
//  Auth: Bearer CRON_SECRET.
// =============================================================================

// ── Locale resolution ────────────────────────────────────────────────────────
// Locale per-subscriber is best-effort: if `push_subscriptions.locale`
// column exists in the DB we honour it, otherwise every push defaults to
// PT (the historic single-locale behaviour). The runtime fallback is the
// CLAUDE.md rule for DDL-less rollouts — the feature keeps working before
// the column migration lands.
type Locale = 'pt' | 'en'

interface NotificationMessage { title: string; body: string }

// ── Message banks ────────────────────────────────────────────────────────────
//
// 20+ reminders per locale; 30+ motivational per locale. Both banks are
// wider than the old single 30-string pool so users don't see repeats
// for weeks even as subscriber count grows.

const REGISTER_PT: NotificationMessage[] = [
  { title: '💰 Regista as tuas despesas de hoje',  body: '2 minutos agora evita uma hora a procurar extratos no fim do mês.' },
  { title: '⏰ Ainda não registaste nada hoje',     body: 'Abre a app e adiciona o que gastaste — cada euro conta.' },
  { title: '📝 Lembrete amigável',                  body: 'Não deixes para amanhã o registo que podes fazer em 30 segundos.' },
  { title: '🧾 Tira foto ao recibo',                body: 'A IA extrai tudo. Só tens de apontar a câmara.' },
  { title: '🌅 Como começou o dia?',                body: 'Um café, gasolina, o almoço... regista antes que te esqueças.' },
  { title: '🔔 1 minuto para pôr as contas em dia', body: 'Regista agora e mantém o teu Score XP-Money a subir.' },
  { title: '📊 Sem registos = sem Score',           body: 'A tua saúde financeira começa com hoje. Regista as operações.' },
  { title: '💳 Usaste o cartão hoje?',              body: 'Cada movimento conta. Abre a app e anota os de hoje.' },
  { title: '🎯 Hábito > Motivação',                 body: 'Disciplina é apenas mostrar-se todos os dias. Está na hora do registo.' },
  { title: '🧠 Confia na app, não na memória',      body: 'Regista agora enquanto a informação está fresca.' },
  { title: '📱 Dois toques, zero esforço',          body: 'Abre a XP-Money, regista o que gastaste, fecha. Feito.' },
  { title: '🔥 Mantém o teu streak',                body: 'Abrir a app e fazer o check-in é o que mantém a sequência viva. Aproveita e regista o dia.' },
  { title: '⚡ Voltix à tua espera',                 body: 'O teu copiloto precisa de dados para te ajudar. Regista os de hoje.' },
  { title: '📉 Onde foi o dinheiro?',               body: 'Sem registos hoje, essa pergunta não terá resposta amanhã.' },
  { title: '🧾 Adicionar despesas rápido',          body: '"+" no dashboard → valor + categoria → guardar. 15 segundos.' },
  { title: `🎮 +${XP_REWARDS.TRANSACTION_REGISTERED} XP por cada registo`, body: 'Um gesto minúsculo, XP acumulado a sério. Vamos.' },
  { title: '⏱️ A regra dos 30 segundos',            body: 'Se leva menos de 30 s, faz agora. Regista a transação.' },
  { title: '🗓️ Check-in diário',                    body: 'Abre a app, confirma os gastos do dia, fecha. É só isso.' },
  { title: '💡 Não confies na memória',             body: 'Em 3 dias vais esquecer-te do café de hoje. Anota já.' },
  { title: '⚡ O Voltix dá-te um toque',             body: 'O teu dia ainda não foi registado. 2 minutos resolvem.' },
]

const REGISTER_EN: NotificationMessage[] = [
  { title: '💰 Log today’s spending',         body: '2 minutes now saves an hour hunting statements later.' },
  { title: '⏰ Nothing logged yet today',     body: 'Open the app and add what you spent — every euro counts.' },
  { title: '📝 Friendly reminder',            body: 'Don’t push to tomorrow what takes 30 seconds today.' },
  { title: '🧾 Snap the receipt',             body: 'The AI reads it. You just point the camera.' },
  { title: '🌅 How did the day start?',       body: 'Coffee, fuel, lunch… log it before you forget.' },
  { title: '🔔 1 minute to catch up',         body: 'Log now and keep your XP-Money score climbing.' },
  { title: '📊 No logs = no score',           body: 'Your financial health starts with today. Log the moves.' },
  { title: '💳 Used the card today?',         body: 'Every swipe matters. Open the app and note them.' },
  { title: '🎯 Habits > motivation',          body: 'Discipline is just showing up. Time to log.' },
  { title: '🧠 Trust the app, not your memory', body: 'Log it while the detail is fresh.' },
  { title: '📱 Two taps, zero effort',        body: 'Open XP-Money, log what you spent, close. Done.' },
  { title: '🔥 Keep the streak',              body: 'Opening the app and checking in is what keeps the chain alive. Log the day while you are at it.' },
  { title: '⚡ Voltix is waiting',             body: 'Your copilot needs data to help. Log today.' },
  { title: '📉 Where did the money go?',      body: 'No logs today, no answer tomorrow.' },
  { title: '🧾 Add spending fast',            body: '"+" on the dashboard → amount + category → save. 15 s.' },
  { title: `🎮 +${XP_REWARDS.TRANSACTION_REGISTERED} XP per log`, body: 'Tiny gesture, real XP. Go.' },
  { title: '⏱️ The 30-second rule',           body: 'If it takes under 30 s, do it now. Log the transaction.' },
  { title: '🗓️ Daily check-in',               body: 'Open the app, confirm the day’s spend, close. That’s it.' },
  { title: '💡 Don’t trust memory',           body: 'In 3 days you’ll forget today’s coffee. Note it now.' },
  { title: '⚡ A nudge from Voltix',           body: 'Today isn’t logged yet. 2 minutes fixes it.' },
]

const MOTIVATION_PT: NotificationMessage[] = [
  { title: '💪 Disciplina > motivação',         body: 'Quem poupa nos dias sem vontade é quem chega à liberdade.' },
  { title: '🚀 Constrói o teu império',         body: 'A liberdade financeira faz-se uma transação de cada vez.' },
  { title: '☕ Menos 1 café por dia',            body: '30€/mês. Em 10 anos, 3.600€ + juros. Pensa nisso.' },
  { title: '🧘 Paz financeira',                 body: 'Saber exactamente quanto tens e gastas = dormir descansado.' },
  { title: '🌱 Rico é quem controla o dinheiro', body: 'Não é quem ganha mais. Começa por saber onde gastas.' },
  { title: '🔐 Fundo de emergência',            body: '3 a 6 meses de despesas guardados. Onde estás na escala?' },
  { title: '📈 A regra dos 50/30/20',           body: '50% essenciais, 30% desejos, 20% poupança. Estás perto?' },
  { title: '🎓 Aprende e ganha',                body: 'Completa um curso da Academia. Certificado digital no fim.' },
  { title: '⏳ O juro composto é mágico',       body: 'Poupar cedo vale 10× poupar tarde. O tempo é o amplificador.' },
  { title: '🏅 O teu eu futuro agradece',       body: 'Cada euro que guardas hoje é um dia livre que compras.' },
  { title: '🔥 Streak = hábito',                body: 'Consistência vence talento. Um dia de cada vez.' },
  { title: '💡 Pequenas despesas, grande soma', body: 'Netflix, Spotify, ginásio… já viste o total anual?' },
  { title: '🎯 A próxima meta?',                body: 'Define-a na app. Sem meta, não há avanço.' },
  { title: '⚡ O dragão come XP',                body: 'Voltix cresce contigo. Registos, missões, cursos.' },
  { title: '🌟 Pequenos passos, grandes saltos', body: 'Em 30 dias de registos, tens um mapa claro do teu dinheiro.' },
  { title: '🧠 Gestão = liberdade',             body: 'Quem sabe onde o dinheiro está, nunca está preso.' },
  { title: '💎 O que se mede, melhora',         body: 'Sem saber, não há estratégia. Saber começa com registar.' },
  { title: '🏆 Tens missões por cumprir',       body: 'Cada missão = +XP + Voltix mais perto da evolução 6.' },
  { title: '🧭 Onde queres estar em 1 ano?',    body: 'Goals da app + depósitos regulares = lá chegas.' },
  { title: '💸 Dívida má vs boa',               body: 'Crédito habitação a 4% vs cartão a 19%. Mata o segundo primeiro.' },
  { title: '🎁 Dinheiro poupado = dinheiro ganho', body: 'Cada euro poupado é um euro que não precisas de ganhar.' },
  { title: '🔎 Revê os gastos recorrentes',     body: 'Cancelar 1 subscrição = €120/ano no bolso.' },
  { title: '⚔️ Guerreiro das finanças',          body: 'Cada registo é uma vitória. Pequena, mas vitória.' },
  { title: '💰 Rendimento passivo começa assim', body: 'Poupar → investir → juros compostos → repetir.' },
  { title: '🎖️ Certificados da Academia',       body: 'Completa um curso e ganha o teu certificado digital.' },
  { title: '⚖️ Dinheiro bem gerido dá tempo',   body: 'Stress financeiro rouba horas. Gestão devolve-as.' },
  { title: '🗺️ O mapa é a tua app',             body: 'Sem mapa, só andas às voltas. Abre o dashboard.' },
  { title: '🏖️ Férias começam agora',            body: 'Cada depósito na meta "Férias 2027" é 1 dia a mais de sol.' },
  { title: '🌳 Plantar hoje, colher em 10 anos', body: 'A melhor altura para poupar foi ontem. A segunda é agora.' },
  { title: '🤖 Deixa a IA trabalhar',           body: 'Scan de recibos + import de extratos. Tu só aprovas.' },
]

const MOTIVATION_EN: NotificationMessage[] = [
  { title: '💪 Discipline > motivation',       body: 'People who save on lazy days are the ones who get free.' },
  { title: '🚀 Build your empire',             body: 'Financial freedom is made one transaction at a time.' },
  { title: '☕ One less coffee a day',          body: '€30/mo. In 10 years, €3,600 plus interest. Think about it.' },
  { title: '🧘 Financial peace',               body: 'Knowing exactly what you have and spend = sleeping easy.' },
  { title: '🌱 Rich = controls money',         body: 'Not "earns the most". Start by knowing where it goes.' },
  { title: '🔐 Emergency fund',                body: '3 to 6 months of expenses saved. Where are you on that scale?' },
  { title: '📈 The 50/30/20 rule',             body: '50% needs, 30% wants, 20% savings. Close?' },
  { title: '🎓 Learn and earn',                body: 'Finish an Academy course. Digital certificate at the end.' },
  { title: '⏳ Compound interest is magic',    body: 'Saving early is 10× saving late. Time is the multiplier.' },
  { title: '🏅 Your future self thanks you',   body: 'Every euro saved today is one free day you bought.' },
  { title: '🔥 Streak = habit',                body: 'Consistency beats talent. One day at a time.' },
  { title: '💡 Small spends, big total',       body: 'Netflix, Spotify, gym… seen the annual total?' },
  { title: '🎯 What’s the next goal?',         body: 'Set it in the app. No goal, no progress.' },
  { title: '⚡ The dragon eats XP',             body: 'Voltix grows with you. Logs, missions, courses.' },
  { title: '🌟 Small steps, big leaps',        body: 'After 30 days of logs, you’ll have a clear money map.' },
  { title: '🧠 Management = freedom',          body: 'Anyone who knows where the money is, isn’t trapped.' },
  { title: '💎 What you measure, you improve', body: 'No data, no strategy. Strategy starts with logging.' },
  { title: '🏆 You have missions to run',      body: 'Each mission = +XP + Voltix closer to evolution 6.' },
  { title: '🧭 Where in 1 year?',              body: 'App goals + regular deposits = that’s how you get there.' },
  { title: '💸 Bad debt vs good debt',         body: 'Mortgage at 4% vs card at 19%. Kill the second first.' },
  { title: '🎁 Saved = earned',                body: 'Every euro saved is one you don’t need to earn.' },
  { title: '🔎 Review recurring spend',        body: 'Cancelling one subscription = €120/yr back in your pocket.' },
  { title: '⚔️ Financial warrior',              body: 'Every log is a win. Small, but a win.' },
  { title: '💰 Passive income starts here',    body: 'Save → invest → compound → repeat.' },
  { title: '🎖️ Academy certificates',          body: 'Finish a course, earn your digital certificate.' },
  { title: '⚖️ Money well run buys time',      body: 'Money stress steals hours. Good management gives them back.' },
  { title: '🗺️ The map is your app',           body: 'Without a map, you’re just wandering. Open the dashboard.' },
  { title: '🏖️ Vacation starts today',          body: 'Each deposit toward "Holiday 2027" is one extra day in the sun.' },
  { title: '🌳 Plant today, harvest in 10 yrs', body: 'Best time to save was yesterday. Second best is now.' },
  { title: '🤖 Let the AI do the grunt work',  body: 'Receipt scan + statement import. You just approve.' },
]

// Deterministic daily index — same day + same bank = same message.
function dayIndex(): number {
  return Math.floor(Date.now() / (24 * 60 * 60 * 1000))
}

function pickMessage(
  kind:   'register' | 'motivation',
  locale: Locale,
): NotificationMessage {
  const bank =
    kind === 'register'
      ? (locale === 'en' ? REGISTER_EN : REGISTER_PT)
      : (locale === 'en' ? MOTIVATION_EN : MOTIVATION_PT)
  return bank[dayIndex() % bank.length] ?? bank[0]
}

// ── Per-subscriber classification ────────────────────────────────────────────
//
// Três classes, por prioridade:
//   1. streak_risk — streak ≥ 3 dias E ainda sem check-in hoje (UTC). O alvo
//      nº 1 de retenção (loss aversion): a mensagem leva o número REAL e o
//      deep link /dashboard é literalmente o botão de salvar o streak — o
//      dashboard dispara o POST /api/daily-checkin ao montar.
//   2. register — sem transações nas últimas 24 h.
//   3. motivation — todos os restantes.
type SubscriberClass = { kind: 'streak_risk' | 'register' | 'motivation'; streak: number }

async function classify(
  db:      ReturnType<typeof createSupabaseAdmin>,
  userId:  string | null,
): Promise<SubscriberClass> {
  if (!userId) return { kind: 'motivation', streak: 0 }  // landing-only subscribers
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const [txRes, voltixRes] = await Promise.all([
    db.from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', cutoff),
    db.from('voltix_states')
      .select('streak_days, last_interaction')
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  const streak = voltixRes.data?.streak_days ?? 0
  const last   = voltixRes.data?.last_interaction ? new Date(voltixRes.data.last_interaction) : null
  const now    = new Date()
  // Mesmo boundary do daily-checkin: dia UTC (lambda corre em UTC).
  const checkedInToday = !!last &&
    last.getUTCFullYear() === now.getUTCFullYear() &&
    last.getUTCMonth()    === now.getUTCMonth() &&
    last.getUTCDate()     === now.getUTCDate()

  if (streak >= 3 && !checkedInToday) return { kind: 'streak_risk', streak }
  return { kind: (txRes.count ?? 0) === 0 ? 'register' : 'motivation', streak }
}

/** Mensagem de streak em risco — dinâmica (o número real É a mensagem),
 *  sem banco rotativo. */
function streakRiskMessage(streak: number, locale: Locale): NotificationMessage {
  return locale === 'en'
    ? { title: `🔥 Your ${streak}-day streak dies at midnight`, body: 'Open the app for 10 seconds and it survives. That’s all it takes.' }
    : { title: `🔥 O teu streak de ${streak} dias apaga-se à meia-noite`, body: 'Abre a app 10 segundos e ele sobrevive. É só isso.' }
}

function initVapid() {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL ?? 'mailto:xpmoney@app.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '',
    process.env.VAPID_PRIVATE_KEY ?? '',
  )
}

function authorised(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  // Refuse undefined AND empty-string secrets. Empty string compared with
  // `authHeader === "Bearer "` would let any request sending exactly
  // "Bearer " through — a trivial mis-config turning the endpoint public.
  // 20 chars is the floor because CRON_SECRET should be a UUID-class
  // token; anything shorter is user error.
  if (!cronSecret || cronSecret.length < 20) return false

  const authHeader = req.headers.get('authorization') ?? ''
  const expected   = `Bearer ${cronSecret}`

  // Timing-safe compare — not strictly required here (network jitter
  // dwarfs the signal in practice), but cheap to get right and it
  // removes a `===` that static analysers flag on auth paths.
  const a = Buffer.from(authHeader)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false

  // Both buffers are short (< 200 bytes); timingSafeEqual is O(n).
  // Dynamic import to avoid polluting the Edge runtime bundle if this
  // file is ever migrated. Falls back to length+constant compare if
  // the crypto module isn't available (won't happen on Node, but safe).
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { timingSafeEqual } = require('node:crypto')
    return timingSafeEqual(a, b)
  } catch {
    // Last-resort constant-time-ish fallback
    let diff = 0
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
    return diff === 0
  }
}

// ── Broadcast ────────────────────────────────────────────────────────────────
// mode 'daily'         → broadcast das 18:00 UTC (todas as classes).
// mode 'streak-rescue' → cron das 21:30 UTC: SÓ envia a quem está em
//   streak_risk (last call, 2h30 antes do boundary de meia-noite UTC) —
//   quem já fez check-in ou não tem streak não recebe nada, zero spam extra.
//   A tag 'xpmoney-daily' + renotify do SW substitui a push das 18:00 em vez
//   de empilhar.
async function sendDailyBroadcast(mode: 'daily' | 'streak-rescue' = 'daily') {
  initVapid()

  const db = createSupabaseAdmin()

  // Pull `user_id` + `locale` if the columns exist. If the runtime DB
  // doesn't yet have `locale` (pre-April-2026 installs), Supabase returns
  // an error the first time — we retry without the column so the old
  // single-locale broadcast keeps working.
  let subs: Array<{ endpoint: string; p256dh: string; auth: string; user_id: string | null; locale: string | null }> = []
  const { data, error } = await db
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, user_id, locale')
  if (error) {
    // Retry without `locale` — likely column doesn't exist yet.
    const fallback = await db
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth, user_id')
    if (fallback.error) return { error: fallback.error.message, status: 500 }
    subs = (fallback.data ?? []).map(r => ({ ...r, locale: null }))
  } else {
    subs = data ?? []
  }

  if (subs.length === 0) return { sent: 0, failed: 0, total: 0, message: 'No subscribers' }

  // Classify + send per-subscriber. Parallel with Promise.allSettled so
  // one Chrome throttle doesn't stall the whole broadcast.
  const results = await Promise.allSettled(
    subs.map(async sub => {
      const locale: Locale = sub.locale === 'en' ? 'en' : 'pt'
      const cls    = await classify(db, sub.user_id)
      // Resgate de streak: só os em risco recebem; o resto é saltado.
      if (mode === 'streak-rescue' && cls.kind !== 'streak_risk') return 'skipped' as const
      const msg = cls.kind === 'streak_risk'
        ? streakRiskMessage(cls.streak, locale)
        : pickMessage(cls.kind, locale)
      // Sem icon/badge no payload — os defaults corretos vivem no sw.js
      // (o antigo '/icon' já foi intercetado pelo middleware do Clerk).
      return webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({
          title: msg.title,
          body:  msg.body,
          url:   '/dashboard',
        }),
        { TTL: 86400 },
      )
    })
  )

  const skipped = results.filter(r => r.status === 'fulfilled' && r.value === 'skipped').length
  const sent    = results.filter(r => r.status === 'fulfilled' && r.value !== 'skipped').length
  const failed  = results.filter(r => r.status === 'rejected').length

  // Clean up expired/invalid subscriptions (410 Gone / 404 Not Found).
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

  return { sent, failed, skipped, total: subs.length }
}

function modeFrom(req: NextRequest): 'daily' | 'streak-rescue' {
  return req.nextUrl.searchParams.get('mode') === 'streak-rescue' ? 'streak-rescue' : 'daily'
}

// POST — manual trigger (admin or cron via secret header)
export async function POST(req: NextRequest) {
  if (!authorised(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const result = await sendDailyBroadcast(modeFrom(req))
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
  const result = await sendDailyBroadcast(modeFrom(req))
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }
  return NextResponse.json(result)
}
