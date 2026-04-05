import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse, type NextRequest } from 'next/server'

// ---- DEMO MODE — bypasses all auth ----
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

// Rotas públicas (não requerem autenticação)
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks/(.*)',
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
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
