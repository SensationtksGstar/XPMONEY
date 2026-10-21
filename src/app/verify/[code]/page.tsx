import { cache }               from 'react'
import type { Metadata }       from 'next'
import Link                    from 'next/link'
import { notFound }            from 'next/navigation'
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
 *
 * Código inexistente → notFound() (404 real, antes devolvia 200 com o cartão
 * "não encontrado"). Se a LEITURA falhar (tabela em falta / erro transitório)
 * não podemos afirmar que o código não existe: mostra o cartão "não
 * encontrado" com 200 em vez de um 404 que poderia ser cacheado.
 */

/** Primeiro nome + inicial do apelido — privacidade por omissão. */
function displayName(full: string | null): string | null {
  if (!full) return null
  const parts = full.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[parts.length - 1][0]}.`
}

interface CertRow { course_id: string; user_name: string | null; issued_at: string }

/** Deduplicado por request: generateMetadata + page partilham a mesma leitura. */
const lookupCertificate = cache(async (
  code: string,
): Promise<{ cert: CertRow | null; readFailed: boolean }> => {
  try {
    const db = createSupabaseAdmin()
    const { data, error } = await db
      .from('certificates')
      .select('course_id, user_name, issued_at')
      .eq('code', code)
      .maybeSingle()
    if (error) {
      console.warn('[verify] read failed (pré-migração?):', error.message)
      return { cert: null, readFailed: true }
    }
    return { cert: data, readFailed: false }
  } catch (err) {
    console.warn('[verify] unexpected error:', err)
    return { cert: null, readFailed: true }
  }
})

function normalizeCode(raw: string): string {
  let decoded = raw
  try { decoded = decodeURIComponent(raw) } catch { /* % malformado: usa o literal */ }
  return decoded.trim().toUpperCase().slice(0, 64)
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>
}): Promise<Metadata> {
  const { code: raw } = await params
  const code   = normalizeCode(raw)
  const t      = await getServerT()
  const locale = await getServerLocale()
  const url    = `https://xp-money.com/verify/${encodeURIComponent(code)}`

  const { cert } = await lookupCertificate(code)
  const course   = cert ? getCourseById(cert.course_id, locale) : null
  const title    = course
    ? t('verify.meta_title', { course: course.title })
    : t('verify.invalid_title')

  return {
    title,
    robots:     { index: false, follow: true },
    alternates: { canonical: url },
    openGraph:  { title, url, type: 'website' },
  }
}

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code: raw } = await params
  const code   = normalizeCode(raw)
  const t      = await getServerT()
  const locale = await getServerLocale()

  const { cert, readFailed } = await lookupCertificate(code)
  // Linha confirmadamente inexistente → 404 real. Falha de leitura → cartão.
  if (!cert && !readFailed) notFound()

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
