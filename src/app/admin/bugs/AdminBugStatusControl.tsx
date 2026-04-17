'use client'

import { useState, useTransition } from 'react'

/**
 * AdminBugStatusControl — tiny status dropdown for the admin bug dashboard.
 *
 * Posts to /api/admin/bug-status with { id, status }. The API is gated by
 * the same ADMIN_CLERK_ID env var the page uses, so a leaked URL can't be
 * weaponised.
 *
 * Optimistic local state so the admin can blast through a backlog without
 * waiting for a round-trip on each click. Rolls back on error.
 */

const STATUSES = ['new', 'triaged', 'resolved', 'wontfix'] as const
type Status = typeof STATUSES[number]

interface Props {
  id:      string
  current: Status
}

export function AdminBugStatusControl({ id, current }: Props) {
  const [status,  setStatus]  = useState<Status>(current)
  const [pending, startTxn]   = useTransition()
  const [err,     setErr]     = useState<string | null>(null)

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as Status
    const prev = status
    setStatus(next)
    setErr(null)

    startTxn(async () => {
      try {
        const res = await fetch('/api/admin/bug-status', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ id, status: next }),
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j?.error ?? 'Falha ao atualizar')
        }
      } catch (error) {
        console.warn('[AdminBugStatusControl] update failed:', error)
        setErr(error instanceof Error ? error.message : 'Falha')
        setStatus(prev)  // rollback
      }
    })
  }

  return (
    <div className="flex items-center gap-2">
      {err && <span className="text-[10px] text-red-300">{err}</span>}
      <select
        value={status}
        onChange={onChange}
        disabled={pending}
        className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white outline-none hover:bg-white/10 disabled:opacity-60"
      >
        {STATUSES.map(s => (
          <option key={s} value={s} className="bg-[#0a0f1e]">{s}</option>
        ))}
      </select>
    </div>
  )
}
