import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server'
import { isDemoMode } from '@/lib/demo/demoGuard'

// ---- DEMO MODE — bypasses all auth ----
// Uses the SAFE helper that refuses to enable demo mode on production
// unless `ALLOW_DEMO_IN_PROD='true'` is ALSO set (server-only, no
// NEXT_PUBLIC_ prefix). See src/lib/demo/demoGuard.ts for rationale.
const DEMO_MODE = isDemoMode()

// ---- PÁGINAS DA APP (as únicas páginas que passam pelo Clerk) ----
// Tudo o que NÃO está aqui e não começa por /api passa ao lado do Clerk
// (marketing, blog, legais, /verify, /contacto, /newsletter/*, /ferramentas,
// /.well-known/*, e URLs inexistentes → o Next devolve o 404 real).
//
// ⚠️ Uma rota PRIVADA nova (página em src/app/(app)/, src/app/admin/ ou
// src/app/reports/) TEM de entrar nesta lista. As páginas de (dashboard)
// têm defesa em profundidade (auth() + redirect no (dashboard)/layout.tsx),
// mas /onboarding e /admin/mascot-upload dependem SÓ do middleware.
// O guard `node scripts/check-guards.mjs` falha se faltar algum prefixo
// (lê este array por regex — mantém-no como literal de strings).
const isAppPage = createRouteMatcher([
  '/dashboard(.*)',
  '/transactions(.*)',
  '/goals(.*)',
  '/missions(.*)',
  '/contas(.*)',
  '/orcamento(.*)',
  '/dividas(.*)',
  '/perspetiva(.*)',
  '/simulador(.*)',
  '/cursos(.*)',
  '/badges(.*)',
  '/voltix(.*)',
  '/settings(.*)',
  '/onboarding(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/admin(.*)',
  '/reports(.*)',
])

// Rotas que, DENTRO do clerk(), não exigem sessão. Na prática só cá chegam
// /api/* e as páginas do isAppPage, por isso o que conta aqui são as APIs
// públicas e o sign-in/sign-up. As entradas de páginas de marketing ficam
// como segunda camada (se um prefixo do isAppPage alguma vez as apanhar,
// pelo menos não exigem login).
// NOTE: admin routes (setup-db, set-plan) are NOT public — they require a
// signed-in Clerk session AND refuse to run in production. They were public
// before, which combined with a hard-coded shared secret was a plan-escalation
// hole.
// notifications/send + cron/* fazem a sua PRÓPRIA autenticação (Bearer
// CRON_SECRET via header `authorization`, comparação timing-safe) — por isso
// passam o middleware sem sessão Clerk.
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
  '/api/cron/(.*)',
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

// O clerkMiddleware faz authenticateRequest (parse de cookies, verificação
// do JWT e, numa instância dev ou com sessão expirada, o HANDSHAKE 307 para
// *.clerk.accounts.dev) ANTES de chamar este callback. Um
// `if (isPublicRoute) return next()` aqui dentro NÃO evita esse trabalho —
// em out. 2026 descobriu-se que o Googlebot, o crawler do AdSense e os
// bots de pré-visualização social recebiam 307 de handshake em /, /blog e
// /.well-known/*, apesar de estarem no isPublicRoute. É por isso que as
// páginas de marketing passam ao lado do Clerk por completo (ver
// `middleware` abaixo): nunca voltar a pôr páginas públicas atrás do clerk().
const clerk = clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) return NextResponse.next()

  const { userId } = await auth()

  if (!userId) {
    const signInUrl = new URL('/sign-in', request.url)
    signInUrl.searchParams.set('redirect_url', request.url)
    return NextResponse.redirect(signInUrl)
  }

  return NextResponse.next()
})

/**
 * Decide se o pedido tem de passar pelo Clerk.
 *  - /api/*        → SEMPRE (deny-by-default: uma rota de API nova esquecida
 *                    no isPublicRoute falha fechada, nunca aberta).
 *  - isAppPage     → sim (páginas autenticadas + sign-in/sign-up).
 *  - tudo o resto  → não: o Next serve a página pública ou o 404 real.
 * O path é normalizado como o Clerk faz (decodeURI + colapsar `//`) para que
 * `/%61pi/…` ou `//dashboard` não fujam ao matcher; encoding malformado
 * falha FECHADO (vai para o Clerk).
 */
function needsClerk(req: NextRequest): boolean {
  let path: string
  try {
    path = decodeURI(req.nextUrl.pathname).replace(/\/\/+/g, '/').toLowerCase()
  } catch (err) {
    console.warn('[middleware] malformed path, routing through Clerk:', err)
    return true
  }
  if (path.startsWith('/api')) return true
  try {
    return isAppPage(req)
  } catch (err) {
    console.warn('[middleware] isAppPage failed, routing through Clerk:', err)
    return true
  }
}

export default function middleware(req: NextRequest, ev: NextFetchEvent) {
  if (DEMO_MODE) return demoMiddleware(req)
  if (!needsClerk(req)) return NextResponse.next()
  return clerk(req, ev)
}

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
    //
    // `txt|mp3|...` (julho 2026): /ads.txt chegou a produção a devolver a
    // página de sign-in porque .txt não estava na lista de extensões — o
    // Google teria reprovado a verificação AdSense com isso. Mesma classe
    // de bug do favicon//blog/sitemap: TODO o ficheiro estático novo em
    // public/ com extensão fora desta regex é intercetado pelo Clerk para
    // visitantes anónimos. Áudio/vídeo/fonts entram já também — o
    // /sfx/evolution-v1.mp3 só servia porque quem o pede está autenticado.
    // (Desde out. 2026 o `middleware` acima já deixa passar tudo o que não é
    // /api nem página da app; esta exclusão poupa a invocação de todo.)
    '/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|opengraph-image|twitter-image|sitemap.xml|robots.txt|sw.js|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|txt|mp3|mp4|webm|wav|woff|woff2|ttf|otf)$).*)',
  ],
}
