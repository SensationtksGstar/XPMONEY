import type { Metadata } from 'next'
import { getServerT }    from '@/lib/i18n/server'

/**
 * Metadata do /sign-in. A page e um server component que renderiza o <SignIn>
 * do Clerk; o layout existe so para fixar noindex + canonical proprio (antes
 * herdava canonical=home e era indexavel, competindo com a landing).
 * `follow: true` para os crawlers continuarem a seguir os links de volta.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT()
  return {
    title:      t('auth.signin.title'),
    robots:     { index: false, follow: true },
    alternates: { canonical: '/sign-in' },
  }
}

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return children
}
