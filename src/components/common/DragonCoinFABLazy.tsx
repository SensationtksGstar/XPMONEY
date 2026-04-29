'use client'

import dynamic from 'next/dynamic'

/**
 * Client-side wrapper around the lazy `DragonCoinFAB` import.
 *
 * Why this file exists: Next.js 15 disallows `next/dynamic({ ssr: false })`
 * inside Server Components. Both the landing (`src/app/page.tsx`) and the
 * dashboard layout are server components, so the lazy import needs to
 * live inside a `'use client'` wrapper. This file is that wrapper —
 * it's the smallest possible client boundary that gives us:
 *
 *   1. A separate JS chunk for the FAB (lazy-loaded on the client)
 *   2. Zero server render — the chat client doesn't need SEO and we
 *      don't want to ship its HTML in the initial document
 *   3. A drop-in component for both server-component callers, no
 *      branching at the call site
 *
 * Saves ~25 KB gzipped off the critical-path JS by deferring the
 * chat-client chunk until after first paint.
 */

const DragonCoinFAB = dynamic(
  () => import('./DragonCoinFAB').then(m => ({ default: m.DragonCoinFAB })),
  { ssr: false },
)

export function DragonCoinFABLazy() {
  return <DragonCoinFAB />
}
