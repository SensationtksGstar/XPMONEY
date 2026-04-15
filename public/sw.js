// XP Money — Service Worker
// Handles push notifications and caching

const CACHE_NAME = 'xpmoney-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

// ── Push notification handler ────────────────────────────────────────────────
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

// ── Notification click handler ───────────────────────────────────────────────
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
