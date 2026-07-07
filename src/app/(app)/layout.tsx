import { ClerkProvider } from '@clerk/nextjs'
import { ptPT, enUS }    from '@clerk/localizations'
import { getServerLocale } from '@/lib/i18n/server'

/**
 * Authenticated-surface layout — the ONLY place ClerkProvider is mounted.
 *
 * Round-3 perf split (June 2026): ClerkProvider used to live in the root
 * layout, so the ~120 KB gzipped Clerk client SDK shipped to EVERY route,
 * including the public marketing surface (landing, blog, legal, contacto,
 * newsletter) that never calls a Clerk hook. Moving the provider down into
 * this `(app)` route group means the public routes (which render under the
 * root layout alone) no longer pull in Clerk at all.
 *
 * Everything that touches Clerk client-side lives under this group:
 *   - (dashboard)/* — the whole authenticated app (Sidebar/TopBar/AdBanner/
 *     UserPlanProvider all use Clerk hooks)
 *   - sign-in, sign-up — render Clerk's <SignIn>/<SignUp>
 *   - onboarding       — gated, uses Clerk hooks
 *
 * Server `auth()` (from @clerk/nextjs/server, used by API routes + admin +
 * reports) is middleware-based and provider-independent, so those routes
 * correctly stay OUTSIDE this group with no Clerk client bundle.
 *
 * Async because Clerk's localization bundle must be resolved from the
 * server-side locale (xpmoney-locale cookie + Accept-Language) on the first
 * paint — same logic the root layout uses for <html lang>.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const locale = await getServerLocale()

  return (
    <ClerkProvider
      localization={locale === 'en' ? enUS : ptPT}
      appearance={{
        variables: {
          colorPrimary:    '#27c26b',
          colorBackground: '#13161b',
          colorText:       '#f8fafc',
          borderRadius:    '0.75rem',
        },
      }}
    >
      {children}
    </ClerkProvider>
  )
}
