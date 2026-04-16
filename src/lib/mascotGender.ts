/**
 * Client-side persistence for the user's mascot choice.
 *
 * Canonical storage is `public.users.mascot_gender` in Postgres, but the user's
 * most recent click in the picker lives in localStorage. We treat localStorage
 * as the authoritative value for THIS device, because:
 *
 *   - The PATCH /api/profile may be in-flight or may have failed silently (the
 *     most common cause is the DB migration not having run yet).
 *   - Even if the DB still has the old value, the user's explicit click should
 *     take effect instantly and survive a page refresh.
 *   - On a brand-new device / after clearing storage, the DB takes over so
 *     cross-device sync still works once the migration is applied.
 *
 * Precedence when reading (order matters):
 *   1. localStorage override    — most recent click on this device
 *   2. DB value                 — canonical, kicks in on fresh devices
 *   3. 'voltix' default
 */

import type { MascotGender } from '@/components/voltix/MascotCreature'

const STORAGE_KEY = 'xpmoney:mascot_gender'

export function saveMascotGenderLocal(gender: MascotGender): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, gender)
  } catch {
    /* storage disabled / full — nothing we can do */
  }
}

export function readMascotGenderLocal(): MascotGender | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === 'voltix' || raw === 'penny') return raw
    return null
  } catch {
    return null
  }
}

/**
 * Merge localStorage override with DB-provided gender. See precedence in the
 * file header. LocalStorage wins if present, otherwise DB value, otherwise
 * default to 'voltix'.
 */
export function resolveMascotGender(
  dbValue: MascotGender | null | undefined,
): MascotGender {
  const local = readMascotGenderLocal()
  if (local) return local
  if (dbValue === 'penny' || dbValue === 'voltix') return dbValue
  return 'voltix'
}
