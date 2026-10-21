'use client'

import { getConsent } from '@/lib/consent'

/**
 * Product-event helpers (`track.*`) for PostHog.
 *
 * posthog-js is NEVER imported statically here. A static `import posthog from
 * 'posthog-js'` pulled ~50-60 KB gzipped into every chunk that touched `track`
 * (and, via chunk sharing, into routes that never fire an event), and loaded
 * the SDK with no consent at all. The SDK is now `await import()`-ed lazily and
 * ONLY when ALL of these hold:
 *   1. NEXT_PUBLIC_POSTHOG_KEY is defined (it is NOT in Vercel prod today), AND
 *   2. the user's stored cookie-consent is "accepted".
 *
 * Contract with `PostHogProvider` (src/components/providers/PostHogProvider.tsx):
 * the Provider is the ONE place that calls `posthog.init(...)`. We reuse the same
 * singleton (same module instance from `import('posthog-js')`) and just wait for
 * `__loaded` before capturing.
 *
 * Queue semantics: events fired BEFORE consent are DISCARDED (never buffered —
 * keeping pre-consent events to send later is processing without a legal basis).
 * The in-memory queue below only holds events fired AFTER consent while the SDK
 * is still downloading/initialising; it is flushed in order, dropped if consent
 * is withdrawn meanwhile, and gives up (with a warn) after MAX_WAIT_MS.
 */

type PostHog = typeof import('posthog-js').default

const POLL_MS     = 250
const MAX_WAIT_MS = 10_000

let clientPromise: Promise<PostHog> | null = null
function loadClient(): Promise<PostHog> {
  if (!clientPromise) {
    clientPromise = import('posthog-js').then(m => m.default)
    // A failed chunk load (offline / deploy skew) must not be cached forever:
    // reset so the NEXT event retries the import instead of failing until reload.
    clientPromise.catch(() => { clientPromise = null })
  }
  return clientPromise
}

const queue: Array<(ph: PostHog) => void> = []
let flushing = false

async function flush() {
  if (flushing) return
  flushing = true
  try {
    const ph = await loadClient()
    const started = Date.now()
    while (queue.length > 0) {
      // Consent withdrawn/rejected while we were waiting → drop everything.
      if (getConsent() !== 'accepted') { queue.length = 0; break }
      if (ph.__loaded) {
        const job = queue.shift()!
        try { job(ph) } catch (err) { console.warn('[posthog] capture failed:', err) }
        continue
      }
      if (Date.now() - started > MAX_WAIT_MS) {
        console.warn('[posthog] SDK not initialised after', MAX_WAIT_MS, 'ms — dropping', queue.length, 'queued event(s)')
        queue.length = 0
        break
      }
      await new Promise(resolve => setTimeout(resolve, POLL_MS))
    }
  } catch (err) {
    console.warn('[posthog] failed to load SDK:', err)
    queue.length = 0
  } finally {
    flushing = false
  }
}

function enqueue(job: (ph: PostHog) => void) {
  if (typeof window === 'undefined') return
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return   // analytics not configured
  if (getConsent() !== 'accepted') return            // no consent → discard, never buffer
  queue.push(job)
  void flush()
}

function capture(event: string, properties?: Record<string, unknown>) {
  enqueue(ph => { ph.capture(event, properties) })
}

// ---- Identificação do utilizador ----
export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  enqueue(ph => { ph.identify(userId, properties) })
}

export function resetUser() {
  enqueue(ph => { ph.reset() })
}

// ============================================
// EVENTOS DE PRODUTO — XP MONEY
// Nomenclatura: entidade_ação (snake_case)
// ============================================

// AQUISIÇÃO
export const track = {
  // Onboarding
  onboarding_started:    () => capture('onboarding_started'),
  onboarding_step:       (step: number, data?: object) => capture('onboarding_step', { step, ...data }),
  onboarding_completed:  (challenge: string) => capture('onboarding_completed', { challenge }),

  // Autenticação
  signup_completed:      (method: string) => capture('signup_completed', { method }),
  login_completed:       (method: string) => capture('login_completed', { method }),

  // Core Loop
  transaction_created:   (type: string, category: string, amount: number) =>
    capture('transaction_created', { type, category, amount }),
  transaction_categorized: (category: string) =>
    capture('transaction_categorized', { category }),

  // Score
  score_viewed:          (score: number, level: string) =>
    capture('score_viewed', { score, level }),
  score_shared:          (score: number) =>
    capture('score_shared', { score }),

  // Gamificação
  xp_gained:             (amount: number, reason: string) =>
    capture('xp_gained', { amount, reason }),
  level_up:              (new_level: number) =>
    capture('level_up', { new_level }),
  mission_completed:     (mission_type: string, xp_reward: number) =>
    capture('mission_completed', { mission_type, xp_reward }),
  badge_earned:          (badge_code: string) =>
    capture('badge_earned', { badge_code }),
  streak_maintained:     (days: number) =>
    capture('streak_maintained', { days }),

  // Voltix
  voltix_interacted:     (mood: string) =>
    capture('voltix_interacted', { mood }),

  // Monetização
  upgrade_clicked:       (source: string, plan: string) =>
    capture('upgrade_clicked', { source, plan }),
  upgrade_completed:     (plan: string, billing: string) =>
    capture('upgrade_completed', { plan, billing }),
  upgrade_cancelled:     (plan: string) =>
    capture('upgrade_cancelled', { plan }),

  // Retenção
  daily_login:           (streak: number) =>
    capture('daily_login', { streak }),
  referral_sent:         () =>
    capture('referral_sent'),
  referral_converted:    () =>
    capture('referral_converted'),

  // Goals
  goal_created:          (name: string, target: number) =>
    capture('goal_created', { name, target }),
  goal_completed:        (name: string) =>
    capture('goal_completed', { name }),

  // Navegação
  page_viewed:           (path: string) =>
    capture('$pageview', { $current_url: window.location.href, path }),
}
