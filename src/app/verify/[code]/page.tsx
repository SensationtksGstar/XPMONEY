import type { Metadata }       from 'next'
import Link                    from 'next/link'
import { ShieldCheck, ShieldX } from 'lucide-react'
import { createSupabaseAdmin } from '@/lib/supabase'
import { getCourseById }       from '@/lib/coursesAccess'
import { getServerT, getServerLocale } from '@/lib/i18n/server'
import { Logo }                from '@/components/ui/Logo'

/**
 * /verify/[code] — verificação PÚBLICA de certificados da Academia.
 *
 * Rota pública (listada no middleware), sem Clerk. Mostra apenas o mínimo:
 * curso, primeiro nome + inicial do titular, data de emissão. noindex — é
 * uma página de destino de partilha, não de descoberta.
 */

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

/** Primeiro nome + inicial do apelido — privacidade por omissão. */
function displayName(full: string | null): string | null {
  if (!full) return null
  const parts = full.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[parts.length - 1][0]}.`
}

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code: raw } = await params
  const code   = decodeURIComponent(raw).trim().toUpperCase()
  const t      = await getServerT()
  const locale = await getServerLocale()

  let cert: { course_id: string; user_name: string | null; issued_at: string } | null = null
  try {
    const db = createSupabaseAdmin()
    const { data, error } = await db
      .from('certificates')
      .select('course_id, user_name, issued_at')
      .eq('code', code)
      .maybeSingle()
    if (error) console.warn('[verify] read failed (pré-migração?):', error.message)
    else cert = data
  } catch (err) {
    console.warn('[verify] unexpected error:', err)
  }

  const course = cert ? getCourseById(cert.course_id, locale) : null
  const valid  = !!cert && !!course
  const intl   = locale === 'en' ? 'en-US' : 'pt-PT'

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <Logo size={32} />
        <span className="font-bold text-white text-lg tracking-tight">XP-Money</span>
      </Link>

      <div className="w-full max-w-md bg-surface-1 border border-white/10 rounded-2xl p-7 text-center shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
        {valid && cert && course ? (
          <>
            <div className="mx-auto w-14 h-14 rounded-2xl bg-green-500/15 border border-green-500/30 flex items-center justify-center mb-4">
              <ShieldCheck className="w-7 h-7 text-green-400" />
            </div>
            <h1 className="text-lg font-bold text-white mb-1">{t('verify.valid_title')}</h1>
            <p className="text-sm text-white/55 mb-5">{t('verify.valid_sub')}</p>

            <div className="text-left bg-white/5 border border-white/10 rounded-xl divide-y divide-white/5">
              <div className="px-4 py-3">
                <p className="text-[11px] uppercase tracking-wider text-white/35">{t('verify.field_course')}</p>
                <p className="text-sm font-semibold text-white">{course.title}</p>
              </div>
              {displayName(cert.user_name) && (
                <div className="px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wider text-white/35">{t('verify.field_holder')}</p>
                  <p className="text-sm font-semibold text-white">{displayName(cert.user_name)}</p>
                </div>
              )}
              <div className="px-4 py-3">
                <p className="text-[11px] uppercase tracking-wider text-white/35">{t('verify.field_date')}</p>
                <p className="text-sm font-semibold text-white">
                  {new Date(cert.issued_at).toLocaleDateString(intl, { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              </div>
              <div className="px-4 py-3">
                <p className="text-[11px] uppercase tracking-wider text-white/35">{t('verify.field_code')}</p>
                <p className="text-sm font-mono text-white/80">{code}</p>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="mx-auto w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
              <ShieldX className="w-7 h-7 text-white/40" />
            </div>
            <h1 className="text-lg font-bold text-white mb-1">{t('verify.invalid_title')}</h1>
            <p className="text-sm text-white/55">{t('verify.invalid_sub')}</p>
          </>
        )}
      </div>

      <Link href="/" className="mt-6 text-sm text-white/40 hover:text-white transition-colors">
        {t('verify.back_home')}
      </Link>
    </main>
  )
}
