'use client'

import { useEffect, useState } from 'react'
import dynamic                   from 'next/dynamic'
import { usePathname }           from 'next/navigation'

// O shader (WebGL2 + loop rAF + GLSL) vem num chunk proprio, so carregado em
// desktop de ponteiro fino e fora das rotas da app. O mobile nunca o descarrega.
const NeonShaderLayer = dynamic(
  () => import('./NeonShaderLayer').then(m => m.NeonShaderLayer),
  { ssr: false },
)

// Rotas da app: o .dashboard-bg e opaco e tapa por completo o wallpaper, por
// isso correr o shader ai seria GPU gasta sem ninguem o ver. /onboarding fica
// de fora da lista de proposito: o seu <main> e transparente, o wallpaper ve-se.
const APP_ROUTE_PREFIXES = [
  '/dashboard', '/transactions', '/goals', '/missions', '/contas',
  '/orcamento', '/dividas', '/perspetiva', '/simulador', '/cursos',
  '/badges', '/voltix', '/wrapped', '/settings', '/sign-in', '/sign-up',
] as const

function isAppRoute(pathname: string | null): boolean {
  if (!pathname) return false
  return APP_ROUTE_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
}

/**
 * SiteBackground — fullscreen fixed Neon Grid behind every page.
 *
 * Arquitetura (Out 2026, sem CLS):
 *   - A camada de gradiente estatico renderiza SEMPRE, pintada desde o SSR,
 *     sem depender de estado. E a unica camada em mobile / ponteiro grosseiro
 *     e nas rotas da app.
 *   - Em desktop (>=1024px, pointer fine) e fora das rotas da app, o shader
 *     monta numa camada IRMA por cima, com opacity 0 e fade-in quando o
 *     primeiro frame esta pronto. Antes, a subarvore era trocada quando o
 *     media query resolvia e o React movia nos (CLS 0,23 em desktop).
 *
 * Stacking note (unchanged): fixed + z-0 + pointer-events-none, with
 * the page content wrapped in a relative z-10 div in the root layout
 * so navigation never lands behind the wallpaper.
 */
export function SiteBackground() {
  const pathname = usePathname()
  const [isLargeScreen, setIsLargeScreen] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px) and (pointer: fine)')
    const apply = () => setIsLargeScreen(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  const showShader = isLargeScreen && !isAppRoute(pathname)

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-0 pointer-events-none"
    >
      {/* Base deep navy fill (matches body bg) */}
      <div className="absolute inset-0 bg-surface-0" />
      {/* Top horizon glow — emerald hint, fakes the grid vanishing point */}
      <div
        className="absolute inset-x-0 top-1/3 h-[55vh]"
        style={{
          background:
            'radial-gradient(ellipse 100% 60% at 50% 50%, rgba(39,194,107,0.12) 0%, rgba(39,194,107,0.04) 35%, transparent 70%)',
        }}
      />
      {/* Faint perspective lines — pure CSS, repeating linear gradient.
          Half-screen height + bottom-anchored so it reads like the
          ground plane in the desktop shader. */}
      <div
        className="absolute inset-x-0 bottom-0 h-1/2 opacity-40"
        style={{
          background:
            'repeating-linear-gradient(to bottom, transparent 0px, transparent 26px, rgba(39,194,107,0.06) 26px, rgba(39,194,107,0.06) 27px)',
          maskImage:
            'linear-gradient(to top, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 100%)',
          WebkitMaskImage:
            'linear-gradient(to top, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 100%)',
        }}
      />
      {/* Shader por cima (so desktop, fora da app); fade-in interno. */}
      {showShader && <NeonShaderLayer />}
      {/* Same dim veil on every path so on-top copy contrast matches */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-surface-0/30 to-surface-0/60" />
    </div>
  )
}
