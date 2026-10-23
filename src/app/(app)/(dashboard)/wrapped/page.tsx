import type { Metadata } from 'next'
import { getServerT } from '@/lib/i18n/server'
import { WrappedClient } from './WrappedClient'

/**
 * /wrapped — Wrapped-lite "O teu ano na XP-Money" (1-31 de dezembro,
 * Europe/Lisbon). A janela e o `?preview=1` (só ADMIN_CLERK_ID ou fora de
 * produção) são decididos pela API; a página só passa a intenção.
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT()
  return {
    title:  t('wrapped.meta_title'),
    robots: { index: false, follow: false },
  }
}

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function WrappedPage({ searchParams }: PageProps) {
  const sp      = await searchParams
  const preview = sp.preview === '1'
  return <WrappedClient preview={preview} />
}
