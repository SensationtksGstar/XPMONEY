/**
 * Cookie / analytics consent — single source of truth.
 *
 * RGPD + ePrivacy require opt-in BEFORE non-essential trackers fire. We store
 * the decision in localStorage (durable across sessions, survives sign-out)
 * and broadcast a CustomEvent so providers mounted before the decision can
 * react when it arrives.
 *
 * States:
 *   - "accepted" → analytics + future non-essential cookies allowed
 *   - "rejected" → analytics blocked, only strictly-necessary cookies
 *   - null       → no decision yet → banner shows, providers stay dormant
 *
 * The 6-month renewal window mirrors CNPD guidance ("consent should be
 * sought again after a reasonable period"). After that we drop the value
 * and the banner reappears.
 */

const STORAGE_KEY = 'xpmoney:cookie-consent'
const RENEW_AFTER_MS = 1000 * 60 * 60 * 24 * 180   // 6 months
export const CONSENT_EVENT = 'xpmoney:consent-changed'

export type ConsentValue = 'accepted' | 'rejected'

interface StoredConsent {
  value:    ConsentValue
  decided:  number   // ms epoch
}

function read(): StoredConsent | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredConsent>
    if (parsed.value !== 'accepted' && parsed.value !== 'rejected') return null
    if (typeof parsed.decided !== 'number') return null
    if (Date.now() - parsed.decided > RENEW_AFTER_MS) return null
    return parsed as StoredConsent
  } catch {
    return null
  }
}

export function getConsent(): ConsentValue | null {
  return read()?.value ?? null
}

export function setConsent(value: ConsentValue): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ value, decided: Date.now() }),
    )
  } catch { /* private mode / quota — best effort */ }
  // Broadcast so providers can react without polling.
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }))
}

export function clearConsent(): void {
  if (typeof window === 'undefined') return
  try { window.localStorage.removeItem(STORAGE_KEY) } catch { /* */ }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: null }))
}
