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
      const { userId } = await auth()

      if (isPublicRoute(request)) return NextResponse.next()

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
    '/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|opengraph-image|twitter-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
