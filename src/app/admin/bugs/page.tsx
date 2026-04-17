import { auth }                 from '@clerk/nextjs/server'
import { notFound, redirect }    from 'next/navigation'
import { createSupabaseAdmin }  from '@/lib/supabase'
import { AdminBugStatusControl } from './AdminBugStatusControl'

/**
 * /admin/bugs — internal dashboard that lists every bug report submitted
 * from Settings → "Reportar um bug".
 *
 * Gating: uses `ADMIN_CLERK_ID` (server-only env var — a single Clerk user
 * id). Anyone else hitting this URL gets a 404 so they can't even tell the
 * page exists. This keeps one source of truth for "who is admin": change
 * the env var in Vercel to rotate.
 *
 * If the `bug_reports` table doesn't exist yet, we render an inline helper
 * with the exact SQL to run in the Supabase SQL editor — the admin can
 * copy-paste and come back. No crash, no blank screen.
 */

export const metadata = { title: 'Admin · Bug Reports' }
export const dynamic  = 'force-dynamic'

interface BugReport {
  id:          string
  user_id:     string | null
  clerk_id:    string | null
  email:       string | null
  title:       string
  description: string
  page_url:    string | null
  user_agent:  string | null
  app_version: string | null
  status:      'new' | 'triaged' | 'resolved' | 'wontfix'
  type?:       'bug' | 'contact'
  created_at:  string
  resolved_at: string | null
}

const STATUS_STYLES: Record<BugReport['status'], string> = {
  new:      'bg-orange-500/15 text-orange-300 border-orange-500/30',
  triaged:  'bg-blue-500/15   text-blue-300   border-blue-500/30',
  resolved: 'bg-green-500/15  text-green-300  border-green-500/30',
  wontfix:  'bg-white/10      text-white/60   border-white/20',
}

function formatWhen(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('pt-PT', {
    day:    '2-digit',
    month:  '2-digit',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  })
}

export default async function AdminBugsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const adminId = process.env.ADMIN_CLERK_ID
  // If env isn't configured, refuse rather than opening the page up.
  // If caller isn't the admin, 404 — the page "doesn't exist" for them.
  if (!adminId || userId !== adminId) notFound()

  const db = createSupabaseAdmin()
  const { data, error } = await db
    .from('bug_reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  const reports = (data ?? []) as BugReport[]
  const missingTable = error && /relation .* does not exist/i.test(error.message)

  const counts = {
    new:      reports.filter(r => r.status === 'new').length,
    triaged:  reports.filter(r => r.status === 'triaged').length,
    resolved: reports.filter(r => r.status === 'resolved').length,
    wontfix:  reports.filter(r => r.status === 'wontfix').length,
  }

  return (
    <main className="min-h-screen bg-[#0a0f1e] text-white p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Bug reports</h1>
            <p className="text-white/50 text-sm mt-0.5">
              {missingTable
                ? 'Tabela ainda não existe — corre a migração abaixo.'
                : `${reports.length} reports · ${counts.new} novos · ${counts.triaged} em triagem`}
            </p>
          </div>
          <a
            href="/dashboard"
            className="text-sm text-white/60 hover:text-white"
          >
            ← Dashboard
          </a>
        </header>

        {missingTable && (
          <section className="bg-orange-500/5 border border-orange-500/30 rounded-xl p-5">
            <h2 className="font-semibold text-orange-300 mb-2">⚙ Migração em falta</h2>
            <p className="text-sm text-white/70 mb-3">
              Cola o SQL abaixo em <strong>Supabase → SQL Editor</strong>, corre, e recarrega esta página:
            </p>
            <pre className="text-[11px] text-green-300 bg-black/40 border border-white/5 rounded-lg p-4 overflow-x-auto leading-relaxed">{`CREATE TABLE IF NOT EXISTS public.bug_reports (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  clerk_id    TEXT,
  email       TEXT,
  title       TEXT        NOT NULL,
  description TEXT        NOT NULL,
  page_url    TEXT,
  user_agent  TEXT,
  app_version TEXT,
  status      TEXT        NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','triaged','resolved','wontfix')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS bug_reports_status_idx     ON public.bug_reports (status);
CREATE INDEX IF NOT EXISTS bug_reports_user_idx       ON public.bug_reports (user_id);
CREATE INDEX IF NOT EXISTS bug_reports_created_at_idx ON public.bug_reports (created_at DESC);

ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;`}</pre>
          </section>
        )}

        {!missingTable && reports.length === 0 && (
          <section className="bg-white/5 border border-white/10 rounded-xl p-10 text-center">
            <p className="text-4xl mb-3">🎉</p>
            <h2 className="font-semibold">Zero reports por tratar</h2>
            <p className="text-sm text-white/50 mt-1">
              Assim que um user submeter um bug, aparece aqui.
            </p>
          </section>
        )}

        <div className="space-y-3">
          {reports.map(r => (
            <article
              key={r.id}
              className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-white/20 transition-colors"
            >
              <header className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    {r.type === 'contact' && (
                      <span className="text-[9px] font-bold uppercase tracking-widest text-blue-300 bg-blue-500/10 border border-blue-500/30 px-1.5 py-0.5 rounded">
                        Contacto
                      </span>
                    )}
                    {(!r.type || r.type === 'bug') && (
                      <span className="text-[9px] font-bold uppercase tracking-widest text-orange-300 bg-orange-500/10 border border-orange-500/30 px-1.5 py-0.5 rounded">
                        Bug
                      </span>
                    )}
                    <h3 className="font-semibold text-white truncate">{r.title}</h3>
                  </div>
                  <p className="text-xs text-white/40 mt-0.5">
                    {formatWhen(r.created_at)}
                    {r.email && <> · <a href={`mailto:${r.email}`} className="underline hover:text-white/60">{r.email}</a></>}
                  </p>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${STATUS_STYLES[r.status]}`}>
                  {r.status}
                </span>
              </header>

              <p className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed mb-3">
                {r.description}
              </p>

              <footer className="flex items-center justify-between gap-3 flex-wrap pt-3 border-t border-white/5">
                <div className="text-[10px] text-white/40 space-y-0.5 min-w-0 flex-1">
                  {r.page_url && <p className="truncate"><span className="text-white/30">URL:</span> {r.page_url}</p>}
                  {r.user_agent && <p className="truncate"><span className="text-white/30">UA:</span> {r.user_agent}</p>}
                  {r.app_version && <p><span className="text-white/30">Build:</span> <code>{r.app_version}</code></p>}
                </div>
                <AdminBugStatusControl id={r.id} current={r.status} />
              </footer>
            </article>
          ))}
        </div>
      </div>
    </main>
  )
}
