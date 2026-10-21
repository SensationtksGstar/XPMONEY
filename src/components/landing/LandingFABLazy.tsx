'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

/**
 * Landing-only wrapper around the Dragon Coin chat FAB.
 *
 * Why a SEPARATE wrapper from `DragonCoinFABLazy` (used by the dashboard
 * layout): when both routes import the same client module, webpack can hang
 * it off a chunk shared with the `(app)/(dashboard)/layout` code, so the
 * public landing ended up downloading + evaluating ~370 kB raw of dashboard
 * JS (long tasks of 1.1-1.3 s on a throttled mobile CPU). A module that only
 * `src/app/page.tsx` imports keeps the landing's reference manifest clean.
 *
 * Mount strategy (load-by-intent): the chat chunk is not even requested until
 * the first user interaction (pointer/touch/key/scroll) OR the browser is idle
 * (requestIdleCallback, 5 s timeout; setTimeout fallback for Safari). The FAB
 * therefore never competes with the LCP / TBT window. Nothing is rendered
 * before that — the chat has no SEO value.
 */

const DragonCoinFAB = dynamic(
  () => import('@/components/common/DragonCoinFAB').then(m => ({ default: m.DragonCoinFAB })),
  { ssr: false },
)

const IDLE_TIMEOUT_MS = 5000
const INTENT_EVENTS = ['pointerdown', 'touchstart', 'keydown', 'scroll'] as const

export function LandingFABLazy() {
  const [mount, setMount] = useState(false)

  useEffect(() => {
    if (mount) return
    let done = false
    const go = () => {
      if (done) return
      done = true
      cleanup()
      setMount(true)
    }

    const opts: AddEventListenerOptions = { passive: true, once: true }
    INTENT_EVENTS.forEach(ev => window.addEventListener(ev, go, opts))

    let idleId: number | undefined
    let timeoutId: number | undefined
    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(go, { timeout: IDLE_TIMEOUT_MS })
    } else {
      timeoutId = window.setTimeout(go, IDLE_TIMEOUT_MS)
    }

    function cleanup() {
      INTENT_EVENTS.forEach(ev => window.removeEventListener(ev, go))
      if (idleId !== undefined && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId)
      }
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
    return cleanup
  }, [mount])

  return mount ? <DragonCoinFAB /> : null
}
