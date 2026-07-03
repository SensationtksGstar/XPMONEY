// XP Money — Service Worker
//
// Two responsibilities:
//   1. Push notifications (was the only thing here in v1).
//   2. Aggressive caching of static assets + stale-while-revalidate of
//      the app shell, so the PWA cold-starts in <1s on mobile instead
//      of the 5 s the user reported when the SW had no fetch handler at
//      all.
//
// Cache strategy:
//   • Next.js static chunks (/_next/static/*) — content-hashed by Next,
//     so they can never go stale. Cache-first, forever.
//   • Static assets (icons, mascot WebPs, fonts, images) — cache-first.
//   • HTML navigations — NETWORK-FIRST with a short timeout, cache as the
//     offline fallback. v2 used stale-while-revalidate here, which served
//     HTML from a PREVIOUS deploy whose content-hashed chunk URLs no
//     longer exist on the current one → "Loading chunk N failed" on every
//     first open after a deploy. Fresh HTML always references chunks that
//     exist; the cached copy only serves when the network genuinely can't
//     (offline PWA boot / dead connection).
//   • /api/*  — bypass entirely (the route handlers already set
//     Cache-Control: no-store; caching would break Stripe webhooks /
//     auth tokens / per-user data).
//   • cross-origin requests — bypass (let the browser handle Clerk,
//     PostHog, Stripe, Google Fonts, etc.).

// Bump these strings whenever the cache logic itself changes so old
// caches get purged on next activate. NOT tied to app version — Next's
// static chunks are already content-hashed.
const STATIC_CACHE  = 'xpmoney-static-v3'
const RUNTIME_CACHE = 'xpmoney-runtime-v3'

// Files cached on install so the PWA boots even fully offline.
const PRECACHE_URLS = [
  '/',
  '/dashboard',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS).catch(err => {
        // One missing icon shouldn't block install — log and continue.
        console.warn('[sw] precache partial failure:', err)
      }))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

// ── Fetch handler ────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const request = event.request

  // Bypass anything we don't own.
  if (request.method !== 'GET') return

  let url
  try { url = new URL(request.url) } catch { return }

  if (url.origin !== self.location.origin) return        // cross-origin
  if (url.pathname.startsWith('/api/'))    return        // dynamic per-user
  if (url.pathname === '/sw.js')           return        // never cache the SW itself
  if (url.pathname.startsWith('/_next/data/')) return    // RSC payloads — let Next handle freshness

  // Next.js content-hashed static chunks — cache forever once seen.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // Static brand / mascot / icon / font assets — cache-first, the URL
  // change implicitly invalidates because Next adds content hashes to
  // image URLs in production builds. WebPs / PNGs in /public stay stable
  // by design (admin re-uploads under same filename) — for those we'd
  // need a forced refresh; not worth a versioning scheme yet.
  if (
    url.pathname.startsWith('/icons/')  ||
    url.pathname.startsWith('/mascot/') ||
    /\.(?:woff2?|ttf|otf|eot)$/i.test(url.pathname) ||
    /\.(?:webp|png|jpe?g|gif|svg|avif)$/i.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // HTML navigations (page requests) — network-first. Serving cached HTML
  // first (v2's stale-while-revalidate) caused deploy skew: old HTML asks
  // for old chunk hashes that 404 on the new deployment. Accept-header
  // sniff is the reliable cross-browser shortcut here.
  const accept = request.headers.get('accept') || ''
  if (request.mode === 'navigate' || accept.includes('text/html')) {
    event.respondWith(networkFirst(request, RUNTIME_CACHE))
    return
  }

  // Everything else — pass through to the network, no caching.
})

// ── Strategies ───────────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cache  = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch (err) {
    // Offline + no cache — let the fetch error propagate so the browser
    // shows its native "offline" treatment instead of a half-broken page.
    throw err
  }
}

// Network-first with a timeout: fresh HTML wins (correct chunk refs after a
// deploy); the cache serves only when the network fails or is pathologically
// slow. 4 s is generous for a Vercel-edge HTML response even on 3G — beyond
// that the user is better served by the cached shell than a spinner.
async function networkFirst(request, cacheName, timeoutMs = 4000) {
  const cache = await caches.open(cacheName)

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const response = await fetch(request, { signal: controller.signal })
    clearTimeout(timer)
    if (response.ok) {
      // Clone before consuming — Response body can only be read once.
      cache.put(request, response.clone()).catch(() => { /* quota — ignore */ })
    }
    return response
  } catch {
    // Offline / timed out → any cached copy (runtime SWR copy or the
    // install-time precache, which lives in STATIC_CACHE — hence the
    // cache-agnostic caches.match fallback).
    const cached = await cache.match(request) || await caches.match(request)
    if (cached) return cached
    throw new Error('offline and not cached')
  }
}

// ── Push notification handler (unchanged from v1) ────────────────────────────
self.addEventListener('push', function (event) {
  let data = { title: 'XP Money 💰', body: 'Cuida das tuas finanças hoje!', icon: '/icons/icon-192.png', badge: '/icons/icon-96.png', url: '/dashboard' }

  if (event.data) {
    try { data = { ...data, ...event.data.json() } } catch (_) {}
  }

  const options = {
    body:              data.body,
    icon:              data.icon,
    badge:             data.badge,
    tag:               'xpmoney-daily',
    renotify:          true,
    requireInteraction: false,
    vibrate:           [100, 50, 100],
    data:              { url: data.url },
    actions: [
      { action: 'open',    title: 'Abrir app' },
      { action: 'dismiss', title: 'Dispensar'  },
    ],
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  )
})

// ── Notification click handler (unchanged from v1) ───────────────────────────
self.addEventListener('notificationclick', function (event) {
  event.notification.close()

  if (event.action === 'dismiss') return

  const url = event.notification.data?.url ?? '/dashboard'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // Focus existing window if open
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      // Open new window
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
