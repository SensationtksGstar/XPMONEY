'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, X, Zap, Flame, Trophy, Star, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface XPEntry {
  id:        string
  amount:    number
  reason:    string
  earned_at: string
}

function reasonLabel(reason: string): { label: string; icon: React.ReactNode } {
  if (reason.includes('transaction'))  return { label: 'Transação registada',   icon: <TrendingUp className="w-3.5 h-3.5 text-green-400" /> }
  if (reason.includes('streak'))       return { label: 'Streak diário',          icon: <Flame       className="w-3.5 h-3.5 text-orange-400" /> }
  if (reason.includes('mission'))      return { label: 'Missão concluída',       icon: <Star        className="w-3.5 h-3.5 text-yellow-400" /> }
  if (reason.includes('badge'))        return { label: 'Badge desbloqueado',     icon: <Trophy      className="w-3.5 h-3.5 text-purple-400" /> }
  if (reason.includes('onboarding'))   return { label: 'Bónus de boas-vindas',  icon: <Zap         className="w-3.5 h-3.5 text-blue-400" /> }
  if (reason.includes('checkin') || reason.includes('login'))
                                        return { label: 'Check-in diário',        icon: <Zap         className="w-3.5 h-3.5 text-yellow-400" /> }
  return { label: reason,              icon: <Zap className="w-3.5 h-3.5 text-white/40" /> }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)   return 'agora'
  if (m < 60)  return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h`
  const d = Math.floor(h / 24)
  return `${d}d`
}

const LAST_SEEN_KEY = 'xpmoney:notif_last_seen'

export function NotificationPanel() {
  const [open, setOpen]       = useState(false)
  const [items, setItems]     = useState<XPEntry[]>([])
  const [loading, setLoading] = useState(false)
  // Start false — flip true only once we've confirmed there's unseen activity.
  const [hasNew, setHasNew]   = useState(false)
  const panelRef              = useRef<HTMLDivElement>(null)

  // ── Poll once on mount for the latest entry, so the dot is accurate ──
  useEffect(() => {
    const ac = new AbortController()
    ;(async () => {
      try {
        const res  = await fetch('/api/xp/history?limit=1', { signal: ac.signal })
        const json = await res.json()
        const latest = (json.data ?? [])[0] as XPEntry | undefined
        if (!latest) return
        const lastSeen = typeof window !== 'undefined'
          ? window.localStorage.getItem(LAST_SEEN_KEY)
          : null
        if (!lastSeen || new Date(latest.earned_at).getTime() > new Date(lastSeen).getTime()) {
          setHasNew(true)
        }
      } catch (err) {
        if ((err as { name?: string })?.name !== 'AbortError') {
          console.warn('[NotificationPanel] latest poll failed:', err)
        }
      }
    })()
    return () => ac.abort()
  }, [])

  async function loadHistory() {
    if (loading || items.length > 0) return
    setLoading(true)
    try {
      const res  = await fetch('/api/xp/history?limit=10')
      const json = await res.json()
      setItems(json.data ?? [])
    } catch (err) {
      console.warn('[NotificationPanel] failed to load history:', err)
    }
    finally { setLoading(false) }
  }

  function handleOpen() {
    setOpen(o => {
      const next = !o
      // Only clear the dot when actually opening.
      if (next) {
        setHasNew(false)
        try {
          window.localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString())
        } catch {
          // storage quota / private mode — dot will reappear on reload, acceptable
        }
      }
      return next
    })
    loadHistory()
  }

  // close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={panelRef} className="relative">
      {/* Bell button — 44×44 for touch a11y */}
      <button
        onClick={handleOpen}
        aria-label={open ? 'Fechar notificações' : 'Abrir notificações'}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          'w-11 h-11 flex items-center justify-center rounded-xl border transition-colors relative active:scale-95',
          open
            ? 'bg-green-500/10 border-green-500/30 text-green-400'
            : 'bg-white/5 border-white/8 text-white/50 hover:text-white',
        )}
      >
        <Bell className="w-4 h-4" />
        {hasNew && (
          <span className="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full" aria-hidden />
        )}
      </button>

      {/* Panel */}
        {open && (
          <div
            role="dialog"
            aria-modal="false"
            aria-label="Atividade recente"
            className="absolute right-0 top-12 z-50 w-72 max-w-[calc(100vw-1rem)] bg-[#0f1829] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <span className="text-sm font-bold text-white">Atividade recente</span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Fechar notificações"
                className="w-8 h-8 -m-1 flex items-center justify-center text-white/30 hover:text-white transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto">
              {loading && (
                <div className="p-4 space-y-3">
                  {[1,2,3].map(i => (
                    <div key={i} className="flex items-center gap-3 animate-pulse">
                      <div className="w-7 h-7 bg-white/8 rounded-lg flex-shrink-0" />
                      <div className="flex-1 space-y-1">
                        <div className="h-3 bg-white/8 rounded w-3/4" />
                        <div className="h-2 bg-white/5 rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!loading && items.length === 0 && (
                <div className="p-6 text-center">
                  <Zap className="w-8 h-8 text-white/15 mx-auto mb-2" />
                  <p className="text-sm text-white/40">Ainda sem atividade</p>
                </div>
              )}

              {!loading && items.map(item => {
                const { label, icon } = reasonLabel(item.reason)
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 px-4 py-3 border-b border-white/4 last:border-0 hover:bg-white/3 transition-colors"
                  >
                    <div className="w-7 h-7 bg-white/5 rounded-lg flex items-center justify-center flex-shrink-0">
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white/80 truncate">{label}</p>
                      <p className="text-[10px] text-white/30">{timeAgo(item.earned_at)}</p>
                    </div>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <span className="text-xs font-bold text-yellow-400">+{item.amount}</span>
                      <span className="text-[10px] text-yellow-400/60">XP</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
    </div>
  )
}
