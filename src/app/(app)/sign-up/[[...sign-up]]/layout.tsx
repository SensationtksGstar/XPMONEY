import type { Metadata } from 'next'
import { getServerT }    from '@/lib/i18n/server'

/**
 * Metadata do /sign-up — ver o layout gemeo do /sign-in. noindex + canonical
 * proprio em vez do canonical=home herdado.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT()
  return {
    title:      t('auth.signup.title'),
    robots:     { index: false, follow: true },
    alternates: { canonical: '/sign-up' },
  }
}

export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return children
}
