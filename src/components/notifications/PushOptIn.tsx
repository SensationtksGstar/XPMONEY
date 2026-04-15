'use client'

import { useState, useEffect } from 'react'
import { Bell, BellOff, BellRing } from 'lucide-react'

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const arr = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i)
  return arr.buffer
}

type PermState = 'default' | 'granted' | 'denied' | 'unsupported' | 'loading'

export function PushOptIn() {
  const [state, setState]       = useState<PermState>('loading')
  const [working, setWorking]   = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported')
      return
    }
    setState(Notification.permission as PermState)

    // Register service worker
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})
  }, [])

  async function subscribe() {
    setWorking(true)
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { setState('denied'); return }

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''),
      })

      const res = await fetch('/api/notifications/subscribe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(sub.toJSON()),
      })

      if (res.ok) setState('granted')
    } catch (e) {
      console.error('[push]', e)
    } finally {
      setWorking(false)
    }
  }

  async function unsubscribe() {
    setWorking(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/notifications/subscribe', {
          method:  'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setState('default')
    } catch (e) {
      console.error('[push]', e)
    } finally {
      setWorking(false)
    }
  }

  if (state === 'unsupported' || state === 'loading') return null

  if (state === 'granted') {
    return (
      <button
        onClick={unsubscribe}
        disabled={working}
        className="flex items-center gap-2 px-4 py-2.5 bg-green-500/15 border border-green-500/30 text-green-400 rounded-xl text-sm font-medium hover:bg-green-500/25 transition-all disabled:opacity-50"
      >
        <BellRing className="w-4 h-4" />
        Notificações ativas
      </button>
    )
  }

  if (state === 'denied') {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 text-white/30 rounded-xl text-sm">
        <BellOff className="w-4 h-4" />
        Notificações bloqueadas — ativa nas definições do browser
      </div>
    )
  }

  return (
    <button
      onClick={subscribe}
      disabled={working}
      className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 text-white/60 hover:text-white hover:border-white/25 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
    >
      <Bell className="w-4 h-4" />
      {working ? 'A ativar...' : 'Ativar notificações diárias'}
    </button>
  )
}
