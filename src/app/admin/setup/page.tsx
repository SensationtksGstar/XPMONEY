import { auth }                 from '@clerk/nextjs/server'
import { notFound, redirect }    from 'next/navigation'
import Link                       from 'next/link'
import { Check, X, AlertCircle, ExternalLink } from 'lucide-react'
import { createSupabaseAdmin }    from '@/lib/supabase'

/**
 * /admin/setup — operational health checklist for the admin.
 *
 * Same gating pattern as /admin/bugs and /admin/metrics: `ADMIN_CLERK_ID`
 * env var, 404 for everyone else.
 *
 * Built specifically for the post-launch "wait and measure" phase. Five
 * external actions (Vercel envs, Supabase migrations, Stripe portal, AT
 * registration, Resend domain) trickle through the user's todo list at
 * different paces, and remembering which is done after a few weeks is
 * easy to lose track of. This page is the single ground-truth view.
 *
 * Three categories:
 *
 *   1. Environment variables — read directly from process.env at request
 *      time (server component). We only check presence, never log the
 *      value (some are secrets).
 *   2. Database migrations — for each expected table, run a tiny COUNT
 *      head-only query. PostgREST returns "relation … does not exist"
 *      when the table is missing; that error is the signal.
 *   3. Manual actions — things that can't be detected programmatically
 *      (Stripe dashboard toggles, AT registration, DNS records). Listed
 *      with link buttons so they're one click away.
 *
 * Status semantics:
 *   ✓ green   = configured / applied
 *   ✗ red     = required, missing — needs action
 *   ⚠ amber   = optional, missing — degraded but functional
 *   — grey    = manual, can't check from here
 */

export const metadata = { title: 'Admin · Setup status' }
export const dynamic    = 'force-dynamic'
export const revalidate = 0

type Status = 'ok' | 'missing-required' | 'missing-optional' | 'manual'

interface Row {
  label:   string
  status:  Status
  hint?:   string
  link?:   { href: string; label: string }
}

// ── Env-var checks ─────────────────────────────────────────────────────────
// `present()` only confirms a non-empty string. We don't try to validate
// the format (e.g. that a Stripe key starts with sk_) — too fragile and
// not worth the false positives on test/live key swaps.
function present(name: string): boolean {
  const v = process.env[name]
  return !!v && v.trim().length > 0 && !v.includes('placeholder')
}

function envRow(opts: {
  name:     string
  required: boolean
  hint:     string
  link?:    { href: string; label: string }
}): Row {
  const ok = present(opts.name)
  return {
    label:  opts.name,
    status: ok ? 'ok' : (opts.required ? 'missing-required' : 'missing-optional'),
    hint:   opts.hint,
    link:   opts.link,
  }
}

// ── Migration checks ───────────────────────────────────────────────────────
async function tableExists(table: string): Promise<boolean> {
  try {
    const db = createSupabaseAdmin()
    const { error } = await db.from(table).select('*', { count: 'exact', head: true })
    if (error && /relation .* does not exist/i.test(error.message)) return false
    return true
  } catch (err) {
    console.warn(`[admin/setup] tableExists(${table}) threw:`, err)
    return false
  }
}

async function migrationRow(opts: {
  table:     string
  required:  boolean
  hint:      string
}): Promise<Row> {
  const ok = await tableExists(opts.table)
  return {
    label:  opts.table,
    status: ok ? 'ok' : (opts.required ? 'missing-required' : 'missing-optional'),
    hint:   opts.hint,
  }
}

export default async function AdminSetupPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  if (!process.env.ADMIN_CLERK_ID || userId !== process.env.ADMIN_CLERK_ID) notFound()

  // Run all DB checks in parallel — each is a head-only count, cheap.
  const migrations = await Promise.all([
    migrationRow({ table: 'users',                    required: true,  hint: 'Schema base — sem isto a app não funciona' }),
    migrationRow({ table: 'transactions',             required: true,  hint: 'Schema base' }),
    migrationRow({ table: 'budgets',                  required: true,  hint: '/orçamento depende disto' }),
    migrationRow({ table: 'goals',                    required: true,  hint: '/goals' }),
    migrationRow({ table: 'subscriptions',            required: true,  hint: 'Stripe webhook + plan gating' }),
    migrationRow({ table: 'ai_receipt_cache',         required: false, hint: 'Cache opcional dos scans de recibo — economia de quota Gemini' }),
    migrationRow({ table: 'bug_reports',              required: false, hint: 'Submissão de bug + contacto. database/bug_reports.sql' }),
    migrationRow({ table: 'stripe_events',            required: false, hint: 'Idempotência do webhook Stripe. database/stripe_events_2026_04.sql' }),
    migrationRow({ table: 'newsletter_subscribers',   required: false, hint: 'Newsletter signup + double opt-in. database/newsletter_2026_04.sql' }),
  ])

  const envs: Row[] = [
    // ── Required for core flows ─────────────────────────────────────────
    envRow({
      name:     'NEXT_PUBLIC_SUPABASE_URL',
      required: true,
      hint:     'URL do projecto Supabase. Sem isto, nenhuma rota com BD funciona.',
      link:     { href: 'https://app.supabase.com', label: 'Supabase' },
    }),
    envRow({
      name:     'SUPABASE_SERVICE_ROLE_KEY',
      required: true,
      hint:     'Service-role key (NÃO a anon key) — usada server-side para bypass RLS.',
    }),
    envRow({
      name:     'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
      required: true,
      hint:     'Auth UI Clerk — sem isto sign-in/up partem.',
      link:     { href: 'https://dashboard.clerk.com', label: 'Clerk' },
    }),
    envRow({
      name:     'CLERK_SECRET_KEY',
      required: true,
      hint:     'Auth server-side Clerk.',
    }),
    envRow({
      name:     'ADMIN_CLERK_ID',
      required: true,
      hint:     'Clerk ID do admin (este user). Gateia /admin/*.',
    }),
    envRow({
      name:     'STRIPE_SECRET_KEY',
      required: true,
      hint:     'Cobranças. Sem isto /api/billing/checkout devolve erro claro.',
      link:     { href: 'https://dashboard.stripe.com/apikeys', label: 'Stripe' },
    }),
    envRow({
      name:     'STRIPE_PREMIUM_MONTHLY_PRICE_ID',
      required: true,
      hint:     'Price ID do plano Premium mensal (price_…)',
    }),
    envRow({
      name:     'STRIPE_PREMIUM_YEARLY_PRICE_ID',
      required: true,
      hint:     'Price ID do plano Premium anual.',
    }),
    envRow({
      name:     'STRIPE_WEBHOOK_SECRET',
      required: true,
      hint:     'whsec_… — verifica assinatura dos eventos Stripe.',
    }),
    envRow({
      name:     'GOOGLE_GEMINI_API_KEY',
      required: true,
      hint:     'IA para scan de recibos + import de extratos. Aceita também GOOGLE_API_KEY ou GEMINI_API_KEY como alias.',
      link:     { href: 'https://aistudio.google.com/apikey', label: 'Google AI Studio' },
    }),

    // ── Required for newly-shipped features (this round) ───────────────
    envRow({
      name:     'RESEND_API_KEY',
      required: true,
      hint:     'Envio de emails (bug reports + newsletter). Sem isto: BD continua, emails ficam silenciados no log.',
      link:     { href: 'https://resend.com/api-keys', label: 'Resend' },
    }),
    envRow({
      name:     'ADMIN_EMAIL',
      required: true,
      hint:     'Email para onde vão os bug reports e mensagens de contacto. Ex: bruno.dmc91@gmail.com',
    }),

    // ── Optional / degrade-but-functional ─────────────────────────────
    envRow({
      name:     'EMAIL_FROM',
      required: false,
      hint:     'Sender custom (ex: XP-Money <noreply@xp-money.com>). Sem isto cai em onboarding@resend.dev — funcional mas mostra "via resend.dev".',
    }),
    envRow({
      name:     'UPSTASH_REDIS_REST_URL',
      required: false,
      hint:     'Rate-limit GLOBAL (não per-instance). Sem isto cai em Map em memória — vulnerável a distributed scraping.',
      link:     { href: 'https://console.upstash.com', label: 'Upstash' },
    }),
    envRow({
      name:     'UPSTASH_REDIS_REST_TOKEN',
      required: false,
      hint:     'Token Upstash — par com o URL acima.',
    }),
    envRow({
      name:     'NEXT_PUBLIC_TURNSTILE_SITE_KEY',
      required: false,
      hint:     'Anti-bot Cloudflare em /contacto. Sem isto: honeypot only.',
      link:     { href: 'https://dash.cloudflare.com/?to=/:account/turnstile', label: 'Cloudflare Turnstile' },
    }),
    envRow({
      name:     'TURNSTILE_SECRET_KEY',
      required: false,
      hint:     'Turnstile server secret — par com o site key.',
    }),
    envRow({
      name:     'GOOGLE_SITE_VERIFICATION',
      required: false,
      hint:     'Verificação Google Search Console — meta tag injectada automaticamente quando definido.',
      link:     { href: 'https://search.google.com/search-console', label: 'Google Search Console' },
    }),
    envRow({
      name:     'BING_SITE_VERIFICATION',
      required: false,
      hint:     'Verificação Bing Webmaster.',
      link:     { href: 'https://www.bing.com/webmasters', label: 'Bing Webmaster' },
    }),
    envRow({
      name:     'CRON_SECRET',
      required: false,
      hint:     '20+ chars random. Protege /api/notifications/send (Vercel Cron). Sem isto: endpoint funciona mas qualquer um pode dispará-lo.',
    }),
    envRow({
      name:     'NEXT_PUBLIC_APP_URL',
      required: false,
      hint:     'URL absoluto do site (ex: https://xp-money.com). Default: localhost:3000. Sem isto: links em emails apontam para localhost.',
    }),
    envRow({
      name:     'NEXT_PUBLIC_POSTHOG_KEY',
      required: false,
      hint:     'PostHog analytics. Já gating por consentimento RGPD (não dispara antes do banner Aceitar).',
    }),
    envRow({
      name:     'NEXT_PUBLIC_ADSENSE_CLIENT',
      required: false,
      hint:     'AdSense para o plano Free. Sem isto: zero anúncios. (E o Free fica mais limpo, na verdade.)',
    }),
  ]

  const manual: Row[] = [
    {
      label:  'Stripe Customer Portal',
      status: 'manual',
      hint:   'Activar em Settings → Billing portal → "Customer portal". Sem isto, o botão "Gerir subscrição" devolve erro.',
      link:   { href: 'https://dashboard.stripe.com/settings/billing/portal', label: 'Stripe portal settings' },
    },
    {
      label:  'Stripe Tax (se passares para regime normal)',
      status: 'manual',
      hint:   'Hoje estás em isenção Art. 53.º — não precisas. Quando cruzares €15k/ano e mudares para regime normal, activa Stripe Tax + adiciona automatic_tax: true ao checkout (deixei nota no /lib/stripe.ts).',
      link:   { href: 'https://dashboard.stripe.com/settings/tax', label: 'Stripe Tax' },
    },
    {
      label:  'Início de Actividade na AT',
      status: 'manual',
      hint:   'Portal das Finanças → CAE 62020 → Regime de isenção Art. 53.º. Sem isto não podes facturar legalmente o que a Stripe te deposita.',
      link:   { href: 'https://www.portaldasfinancas.gov.pt', label: 'Portal das Finanças' },
    },
    {
      label:  'Domínio xp-money.com verificado em Resend',
      status: 'manual',
      hint:   'Tira "via resend.dev" dos emails — passam a aparecer como noreply@xp-money.com. Precisa adicionar registos DNS (SPF, DKIM).',
      link:   { href: 'https://resend.com/domains', label: 'Resend domains' },
    },
    {
      label:  'Google Search Console — verificar propriedade',
      status: 'manual',
      hint:   'Add property → "HTML tag" → copia o token, mete em GOOGLE_SITE_VERIFICATION (Vercel) → Verify.',
      link:   { href: 'https://search.google.com/search-console', label: 'Search Console' },
    },
  ]

  // Aggregate counters for the header summary
  const allRows = [...envs, ...migrations]
  const counts = {
    ok:           allRows.filter(r => r.status === 'ok').length,
    missingReq:   allRows.filter(r => r.status === 'missing-required').length,
    missingOpt:   allRows.filter(r => r.status === 'missing-optional').length,
  }

  return (
    <main className="min-h-screen bg-[#0a0f1e] text-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Setup status</h1>
            <p className="text-white/50 text-sm mt-0.5">
              {counts.ok} OK · <span className={counts.missingReq > 0 ? 'text-red-400 font-semibold' : ''}>{counts.missingReq} obrigatórios em falta</span> · {counts.missingOpt} opcionais em falta
            </p>
          </div>
          <div className="flex gap-3 text-sm">
            <Link href="/admin/metrics" className="text-white/60 hover:text-white">Métricas →</Link>
            <Link href="/admin/bugs"    className="text-white/60 hover:text-white">Bugs →</Link>
            <a href="/dashboard"        className="text-white/60 hover:text-white">← Dashboard</a>
          </div>
        </header>

        {counts.missingReq > 0 && (
          <section className="bg-red-500/5 border border-red-500/30 rounded-xl p-4">
            <h2 className="font-semibold text-red-300 text-sm mb-1.5">⚠ Acção obrigatória</h2>
            <p className="text-xs text-white/70">
              Há {counts.missingReq} item(s) obrigatório(s) por configurar — features dependentes ficam quebradas (botão de checkout, scan de recibos, emails, etc.) até serem corrigidos.
            </p>
          </section>
        )}

        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-white/45 mb-3">
            Variáveis de ambiente · Vercel → Settings → Environment Variables
          </h2>
          <RowList rows={envs} />
        </section>

        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-white/45 mb-3">
            Migrations Supabase · SQL Editor
          </h2>
          <RowList rows={migrations} />
          <p className="text-[11px] text-white/45 mt-2">
            Tabelas em falta detectadas via "relation does not exist" do PostgREST. Aplica os ficheiros em <code className="text-white/60">database/*.sql</code> no Supabase SQL Editor.
          </p>
        </section>

        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-white/45 mb-3">
            Acções manuais · não detectáveis daqui
          </h2>
          <RowList rows={manual} />
        </section>

        <footer className="pt-4 border-t border-white/5 text-[11px] text-white/35">
          Esta página NÃO mostra valores das variáveis — apenas presença. Os secrets ficam no Vercel.
        </footer>
      </div>
    </main>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
function RowList({ rows }: { rows: Row[] }) {
  return (
    <ul className="bg-white/5 border border-white/10 rounded-xl divide-y divide-white/5 overflow-hidden">
      {rows.map(r => (
        <li key={r.label} className="flex items-start gap-3 px-4 py-3">
          <StatusIcon status={r.status} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <code className="text-sm text-white font-mono">{r.label}</code>
              <StatusChip status={r.status} />
              {r.link && (
                <a
                  href={r.link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-0.5"
                >
                  {r.link.label}
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            {r.hint && <p className="text-[11px] text-white/55 mt-0.5 leading-relaxed">{r.hint}</p>}
          </div>
        </li>
      ))}
    </ul>
  )
}

function StatusIcon({ status }: { status: Status }) {
  if (status === 'ok')               return <Check       className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
  if (status === 'missing-required') return <X           className="w-4 h-4 text-red-400     mt-0.5 flex-shrink-0" />
  if (status === 'missing-optional') return <AlertCircle className="w-4 h-4 text-amber-400   mt-0.5 flex-shrink-0" />
  return <span aria-hidden className="w-4 h-4 text-white/30 mt-0.5 flex-shrink-0">—</span>
}

function StatusChip({ status }: { status: Status }) {
  const map: Record<Status, { label: string; cls: string }> = {
    'ok':                 { label: 'OK',        cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
    'missing-required':   { label: 'Em falta',  cls: 'bg-red-500/15     text-red-300     border-red-500/30' },
    'missing-optional':   { label: 'Opcional',  cls: 'bg-amber-500/10   text-amber-300   border-amber-500/30' },
    'manual':             { label: 'Manual',    cls: 'bg-white/5        text-white/60    border-white/15' },
  }
  const m = map[status]
  return (
    <span className={`inline-block text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${m.cls}`}>
      {m.label}
    </span>
  )
}
