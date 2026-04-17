'use client'

import { useEffect, useState, useTransition } from 'react'
import { Check, Sparkles } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { MascotCreature, type MascotGender } from '@/components/voltix/MascotCreature'
import { readMascotGenderLocal, saveMascotGenderLocal } from '@/lib/mascotGender'

/**
 * MascotPicker — settings card that lets any user switch their companion
 * mascot between Voltix (blue thunder dragon) and Penny (cream angel cat).
 *
 * Writes to PATCH /api/profile { mascot_gender } and then invalidates the
 * ['voltix'] query so the widget / page re-fetch the new gender.
 *
 * `initialGender` is what the server page read from the DB on render. Once
 * mounted, we override that with the localStorage value if present — the user's
 * last click on this device is more authoritative than whatever the DB
 * happened to have cached (see src/lib/mascotGender.ts).
 */
/**
 * `currentEvo` is the user's actual mascot evolution level (1-6). We preview
 * both Voltix and Penny at THIS stage so the user sees the creature they'll
 * actually get after switching — not a fixed baby form that misrepresents the
 * choice. Defaults to 1 so brand-new users still see the starter mascot.
 */
interface MascotPickerProps {
  initialGender: MascotGender
  currentEvo?:   number
}

export function MascotPicker({ initialGender, currentEvo = 1 }: MascotPickerProps) {
  // Clamp defensively — MascotCreature expects a valid 1-6 evo
  const evo = Math.max(1, Math.min(6, Math.round(currentEvo))) as number
  const [gender, setGender] = useState<MascotGender>(initialGender)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [, startTransition] = useTransition()
  const qc = useQueryClient()

  // Hydrate from localStorage after mount (SSR-safe — window not available
  // during the server render that sets initialGender).
  useEffect(() => {
    const local = readMascotGenderLocal()
    if (local && local !== initialGender) setGender(local)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function choose(next: MascotGender) {
    if (next === gender || status === 'saving') return
    setGender(next)
    setStatus('saving')

    // Always persist locally first — this makes the choice work even if the
    // DB column hasn't been migrated yet (useVoltix will read the fallback).
    saveMascotGenderLocal(next)

    // Kick the voltix query cache right away so the widget updates instantly.
    startTransition(() => {
      qc.invalidateQueries({ queryKey: ['voltix'] })
    })

    try {
      const res = await fetch('/api/profile', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ mascot_gender: next }),
      })
      // Ignore 400/500 — the localStorage write already succeeded, so the UI
      // still reflects the choice. Server error most often means the DB column
      // doesn't exist yet (migration not run).
      if (!res.ok) {
        console.warn('[MascotPicker] server save failed; using localStorage only')
      }
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 1800)
    } catch (err) {
      console.warn('[MascotPicker] save failed:', err)
      // Still consider it saved — localStorage worked.
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 1800)
    }
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5">
      <h2 className="font-semibold text-white mb-1 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-yellow-400" />
        Mascote
      </h2>
      <p className="text-sm text-white/50 mb-4">
        Escolhe o companheiro que te acompanha na jornada financeira. Podes trocar sempre que quiseres.
      </p>

      <div className="grid grid-cols-2 gap-3">
        {/* Voltix */}
        <button
          type="button"
          onClick={() => choose('voltix')}
          disabled={status === 'saving'}
          aria-pressed={gender === 'voltix'}
          className={`group relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all touch-target no-tap-highlight ${
            gender === 'voltix'
              ? 'border-green-500 bg-green-500/10'
              : 'border-white/10 bg-white/5 hover:border-green-500/40'
          } disabled:opacity-60 disabled:cursor-wait`}
        >
          <div className="w-24 h-24 flex items-center justify-center">
            <MascotCreature
              gender="voltix"
              evo={evo}
              mood="happy"
              className="w-full h-full"
              animate={gender === 'voltix'}
            />
          </div>
          <div className="text-center">
            <p className="text-white font-bold text-sm">Voltix</p>
            <p className="text-[11px] text-white/50">Dragão-trovão azul</p>
          </div>
          {gender === 'voltix' && (
            <span className="absolute top-2 right-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-500 text-black">
              <Check className="w-3 h-3" strokeWidth={3} />
            </span>
          )}
        </button>

        {/* Penny */}
        <button
          type="button"
          onClick={() => choose('penny')}
          disabled={status === 'saving'}
          aria-pressed={gender === 'penny'}
          className={`group relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all touch-target no-tap-highlight ${
            gender === 'penny'
              ? 'border-pink-400 bg-pink-400/10'
              : 'border-white/10 bg-white/5 hover:border-pink-400/40'
          } disabled:opacity-60 disabled:cursor-wait`}
        >
          <div className="w-24 h-24 flex items-center justify-center">
            <MascotCreature
              gender="penny"
              evo={evo}
              mood="happy"
              className="w-full h-full"
              animate={gender === 'penny'}
            />
          </div>
          <div className="text-center">
            <p className="text-white font-bold text-sm">Penny</p>
            <p className="text-[11px] text-white/50">Gata-anjo creme</p>
          </div>
          {gender === 'penny' && (
            <span className="absolute top-2 right-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-pink-400 text-black">
              <Check className="w-3 h-3" strokeWidth={3} />
            </span>
          )}
        </button>
      </div>

      {/* Status line */}
      <div className="h-5 mt-3 text-xs flex items-center justify-center">
        {status === 'saving' && <span className="text-white/40">A guardar…</span>}
        {status === 'saved'  && <span className="text-green-400">Mascote actualizada ✓</span>}
        {status === 'error'  && <span className="text-red-400">Falha ao guardar. Tenta novamente.</span>}
        {status === 'idle'   && <span className="text-white/25">&nbsp;</span>}
      </div>
    </div>
  )
}
