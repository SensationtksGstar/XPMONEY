/**
 * Client-side persistence for the user's mascot choice.
 *
 * The canonical storage is `public.users.mascot_gender` in Postgres, but that
 * column is added via migration — until it's applied, the API always returns
 * undefined and we fall back to 'voltix'. This helper lets us persist the
 * choice in localStorage as well, so the widget respects the user's selection
 * even before the DB migration runs.
 *
 * Precedence when reading:
 *   1. DB value (if column exists + user has a value)    — primary
 *   2. localStorage override                             — fallback
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
 * Merge DB-provided gender with localStorage fallback. DB always wins if
 * present and valid; otherwise we use the local override; otherwise default
 * to 'voltix'.
 */
export function resolveMascotGender(
  dbValue: MascotGender | null | undefined,
): MascotGender {
  if (dbValue === 'penny' || dbValue === 'voltix') return dbValue
  const local = readMascotGenderLocal()
  if (local) return local
  return 'voltix'
}
