import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Rotas públicas (não requerem autenticação)
const isPublicRoute = createRouteMatcher([
  '/',                        // landing page
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks/(.*)',        // Stripe webhooks — sem auth
])

// Rotas que requerem onboarding completo
const requiresOnboarding = createRouteMatcher([
  '/dashboard(.*)',
  '/transactions(.*)',
  '/missions(.*)',
  '/voltix(.*)',
  '/goals(.*)',
  '/settings(.*)',
])

export default clerkMiddleware(async (auth, request) => {
  const { userId, sessionClaims } = await auth()

  // Se é rota pública, deixa passar
  if (isPublicRoute(request)) return NextResponse.next()

  // Se não está autenticado, redireciona para sign-in
  if (!userId) {
    const signInUrl = new URL('/sign-in', request.url)
    signInUrl.searchParams.set('redirect_url', request.url)
    return NextResponse.redirect(signInUrl)
  }

  // Se está autenticado mas não completou onboarding
  const onboardingCompleted = (sessionClaims?.metadata as Record<string, unknown>)?.onboarding_completed
  if (requiresOnboarding(request) && !onboardingCompleted) {
    const onboardingUrl = new URL('/onboarding', request.url)
    return NextResponse.redirect(onboardingUrl)
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
