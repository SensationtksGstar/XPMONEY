import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse, type NextRequest } from 'next/server'
import { isDemoMode } from '@/lib/demo/demoGuard'

// ---- DEMO MODE — bypasses all auth ----
// Uses the SAFE helper that refuses to enable demo mode on production
// unless `ALLOW_DEMO_IN_PROD='true'` is ALSO set (server-only, no
// NEXT_PUBLIC_ prefix). See src/lib/demo/demoGuard.ts for rationale.
const DEMO_MODE = isDemoMode()

// Rotas públicas (não requerem autenticação)
// NOTE: admin routes (setup-db, set-plan) are NOT public — they require a
// signed-in Clerk session AND refuse to run in production. They were public
// before, which combined with a hard-coded shared secret was a plan-escalation
// hole.
// notifications/send is also NOT public — it accepts Vercel Cron Bearer via
// the `authorization` header, which Clerk middleware does not block.
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/termos',
  '/privacidade',
  '/cookies',
  '/contacto',
  '/api/webhooks/(.*)',
  '/api/notifications/send',
  '/api/landing-chat',
  '/api/contact-message',
  '/api/newsletter/(.*)',
  '/newsletter/(.*)',
  // BLOG — descoberto em julho 2026 a devolver 307→/sign-in em produção:
  // nunca esteve nesta lista, por isso TODA a estratégia SEO (7 artigos)
  // estava invisível para o público e para o Googlebot. Nunca remover.
  '/blog(.*)',
  // Verificação pública de certificados da Academia.
  '/verify(.*)',
  '/sw.js',
  '/manifest.json',
  '/icons/(.*)',
])

// Em demo mode, redireciona / para /dashboard e deixa tudo passar
function demoMiddleware(request: NextRequest) {
  if (request.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  return NextResponse.next()
}

export default DEMO_MODE
  ? (request: NextRequest) => demoMiddleware(request)
  : clerkMiddleware(async (auth, request) => {
      // Public routes skip session resolution entirely — auth() does real
      // work (cookie parse + JWT verify), so check the cheap matcher first.
      if (isPublicRoute(request)) return NextResponse.next()

      const { userId } = await auth()

      if (!userId) {
        const signInUrl = new URL('/sign-in', request.url)
        signInUrl.searchParams.set('redirect_url', request.url)
        return NextResponse.redirect(signInUrl)
      }

      return NextResponse.next()
    })

export const config = {
  matcher: [
    // Skip Next.js internals + image extensions + the auto-generated
    // metadata routes (icon, apple-icon, opengraph-image, twitter-image —
    // produced from src/app/icon.svg, apple-icon.tsx, opengraph-image.tsx).
    // The metadata routes are served WITHOUT a file extension (e.g. `/icon`,
    // not `/icon.svg`), so the trailing `\.(svg|png|...)` exclusion alone
    // doesn't match them. Without listing them here, Clerk's auth middleware
    // intercepts `/icon` and 307-redirects to `/sign-in`, leaving the browser
    // to fall back to a default favicon ("X" — the first letter of the
    // page title in Chrome/Edge).
    //
    // `sitemap.xml` + `robots.txt` are the SAME class of bug: produced by
    // src/app/sitemap.ts / robots.ts, served at extensionless-ish paths that
    // Clerk was intercepting → Googlebot got a 307 to /sign-in instead of the
    // file. They are NOT in isPublicRoute either, so they MUST be excluded
    // here or search engines can never read the sitemap (June 2026 SEO audit).
    //
    // `sw.js` + `manifest.json` are static files in public/ that the browser
    // re-fetches on its own cadence — they're already in isPublicRoute, but
    // excluding them here skips the Clerk middleware invocation entirely.
    '/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|opengraph-image|twitter-image|sitemap.xml|robots.txt|sw.js|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
