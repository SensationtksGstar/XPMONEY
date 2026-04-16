'use client'

/**
 * MascotEvolutionWatcher — global side-effect component that fires the
 * evolution cinematic whenever the server-reported `evolution_level` is
 * higher than the last stage this device has acknowledged.
 *
 * Strategy:
 *   - Read current evo from useVoltix (already polled/cached via React Query)
 *   - Compare to `xpmoney:mascot_last_evo` in localStorage (per-device memory)
 *   - On mismatch (new > old) → fire cinematic, then persist new value
 *
 * Why localStorage instead of a "justEvolved" server flag:
 *   - Avoids a DB migration (we can't run DDL from here)
 *   - Survives page reloads that happen mid-cinematic
 *   - Each device sees the reveal exactly once even across sessions
 *
 * First-ever mount on a new device hydrates the key silently — we never
 * replay old evolutions retroactively.
 *
 * Dev preview: `?previewEvo=2-3` forces an immediate cinematic without
 * touching localStorage or the server.
 */

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { useVoltix } from '@/hooks/useVoltix'
import type { EvoStage } from '@/lib/mascotEvolution'
import type { MascotGender } from '@/types'

const MascotEvolutionCinematic = dynamic(
  () => import('./MascotEvolutionCinematic').then(m => m.MascotEvolutionCinematic),
  { ssr: false },
)

const LAST_EVO_KEY = 'xpmoney:mascot_last_evo'

function readLastEvo(): EvoStage | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LAST_EVO_KEY)
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 1 || n > 6) return null
    return n as EvoStage
  } catch {
    return null
  }
}

function writeLastEvo(evo: EvoStage): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LAST_EVO_KEY, String(evo))
  } catch {
    /* storage disabled — we'll just re-fire once next session, not critical */
  }
}

function clampEvo(n: unknown): EvoStage {
  const x = Number(n)
  if (!Number.isFinite(x)) return 1
  return (Math.max(1, Math.min(6, Math.round(x))) as EvoStage)
}

export function MascotEvolutionWatcher() {
  const { voltix } = useVoltix()
  const params = useSearchParams()
  const [cinematic, setCinematic] = useState<{
    gender:  MascotGender
    fromEvo: EvoStage
    toEvo:   EvoStage
  } | null>(null)

  // ── Dev preview: ?previewEvo=2-3 ───────────────────────────────────────
  useEffect(() => {
    const raw = params?.get('previewEvo')
    if (!raw) return
    const [fromStr, toStr] = raw.split('-')
    const from = clampEvo(fromStr)
    const to   = clampEvo(toStr)
    if (to <= from) return
    const gender = (voltix?.mascot_gender ?? 'voltix') as MascotGender
    setCinematic({ gender, fromEvo: from, toEvo: to })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  // ── Real detection ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!voltix) return
    const serverEvo = clampEvo(voltix.evolution_level)
    const lastSeen  = readLastEvo()

    // First encounter on this device: silently hydrate, don't replay.
    if (lastSeen === null) {
      writeLastEvo(serverEvo)
      return
    }

    if (serverEvo > lastSeen) {
      const gender = (voltix.mascot_gender ?? 'voltix') as MascotGender
      setCinematic({ gender, fromEvo: lastSeen, toEvo: serverEvo })
      writeLastEvo(serverEvo)
    } else if (serverEvo < lastSeen) {
      // Defensive: if some migration / debug lowered the server value, just sync down.
      writeLastEvo(serverEvo)
    }
  }, [voltix])

  if (!cinematic) return null

  return (
    <MascotEvolutionCinematic
      open
      onClose={() => setCinematic(null)}
      gender={cinematic.gender}
      fromEvo={cinematic.fromEvo}
      toEvo={cinematic.toEvo}
    />
  )
}
