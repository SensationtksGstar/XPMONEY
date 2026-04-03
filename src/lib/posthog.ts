'use client'

import posthog from 'posthog-js'

// ---- Inicialização (chamar 1x no layout root) ----
export function initPostHog() {
  if (typeof window === 'undefined') return
  if (posthog.__loaded) return

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host:          process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
    capture_pageview:  false, // controlamos manualmente via usePathname
    capture_pageleave: true,
    autocapture:       false, // eventos manuais para maior controlo
    person_profiles:   'identified_only',
  })
}

// ---- Identificação do utilizador ----
export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  posthog.identify(userId, properties)
}

export function resetUser() {
  posthog.reset()
}

// ============================================
// EVENTOS DE PRODUTO — XP MONEY
// Nomenclatura: entidade_ação (snake_case)
// ============================================

// AQUISIÇÃO
export const track = {
  // Onboarding
  onboarding_started:    () => posthog.capture('onboarding_started'),
  onboarding_step:       (step: number, data?: object) => posthog.capture('onboarding_step', { step, ...data }),
  onboarding_completed:  (challenge: string) => posthog.capture('onboarding_completed', { challenge }),

  // Autenticação
  signup_completed:      (method: string) => posthog.capture('signup_completed', { method }),
  login_completed:       (method: string) => posthog.capture('login_completed', { method }),

  // Core Loop
  transaction_created:   (type: string, category: string, amount: number) =>
    posthog.capture('transaction_created', { type, category, amount }),
  transaction_categorized: (category: string) =>
    posthog.capture('transaction_categorized', { category }),

  // Score
  score_viewed:          (score: number, level: string) =>
    posthog.capture('score_viewed', { score, level }),
  score_shared:          (score: number) =>
    posthog.capture('score_shared', { score }),

  // Gamificação
  xp_gained:             (amount: number, reason: string) =>
    posthog.capture('xp_gained', { amount, reason }),
  level_up:              (new_level: number) =>
    posthog.capture('level_up', { new_level }),
  mission_completed:     (mission_type: string, xp_reward: number) =>
    posthog.capture('mission_completed', { mission_type, xp_reward }),
  badge_earned:          (badge_code: string) =>
    posthog.capture('badge_earned', { badge_code }),
  streak_maintained:     (days: number) =>
    posthog.capture('streak_maintained', { days }),

  // Voltix
  voltix_interacted:     (mood: string) =>
    posthog.capture('voltix_interacted', { mood }),

  // Monetização
  upgrade_clicked:       (source: string, plan: string) =>
    posthog.capture('upgrade_clicked', { source, plan }),
  upgrade_completed:     (plan: string, billing: string) =>
    posthog.capture('upgrade_completed', { plan, billing }),
  upgrade_cancelled:     (plan: string) =>
    posthog.capture('upgrade_cancelled', { plan }),

  // Retenção
  daily_login:           (streak: number) =>
    posthog.capture('daily_login', { streak }),
  referral_sent:         () =>
    posthog.capture('referral_sent'),
  referral_converted:    () =>
    posthog.capture('referral_converted'),

  // Goals
  goal_created:          (name: string, target: number) =>
    posthog.capture('goal_created', { name, target }),
  goal_completed:        (name: string) =>
    posthog.capture('goal_completed', { name }),

  // Navegação
  page_viewed:           (path: string) =>
    posthog.capture('$pageview', { $current_url: window.location.href, path }),
}

export default posthog
