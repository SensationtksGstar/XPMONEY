// Golden-case guard for the effective-plan decision (src/lib/plan.ts).
//
// Run: node --experimental-strip-types scripts/check-plan.mjs
//
// Why: isPremiumActive() only looked at users.plan + premium_until. A user
// whose Annual Pass had EXPIRED and who then subscribed kept paying and stayed
// Free (the subscription webhook writes plan, never clears premium_until).
// resolvePremium() now ORs in a live subscriptions row. tsc can't catch a
// regression in this boolean logic — this can.
//
// plan.ts must keep ONLY `import type` at the top (types are stripped); a
// runtime import (especially an '@/…' alias) would make this script fail.

import {
  isPremiumActive,
  isSubscriptionPremium,
  pickSubscription,
  resolvePremium,
  PREMIUM_SUB_STATUSES,
  SUB_PERIOD_GRACE_MS,
  planQueryFallback,
} from '../src/lib/plan.ts'

let failures = 0
function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  ok   ${name}`)
  } else {
    failures += 1
    console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`)
  }
}
function eq(name, got, want) {
  const g = JSON.stringify(got)
  const w = JSON.stringify(want)
  check(name, g === w, `got ${g}, want ${w}`)
}

const NOW    = Date.parse('2026-10-22T12:00:00Z')
const PAST   = '2026-06-01T00:00:00Z'
const FUTURE = '2027-06-01T00:00:00Z'
const liveSub = (extra = {}) => ({
  status: 'active', plan: 'premium', stripe_subscription_id: 'sub_123', ...extra,
})

console.log('isPremiumActive (plan + pass only — contract unchanged)')
eq('free plan → false',                          isPremiumActive('free', null, NOW), false)
eq('null plan → false',                          isPremiumActive(null, null, NOW), false)
eq('premium, no expiry (subscription) → true',   isPremiumActive('premium', null, NOW), true)
eq('premium, future pass → true',                isPremiumActive('premium', FUTURE, NOW), true)
eq('premium, expired pass → false',              isPremiumActive('premium', PAST, NOW), false)
eq('legacy plus, no expiry → true',              isPremiumActive('plus', null, NOW), true)
eq('premium, garbage date → false (fail closed)', isPremiumActive('premium', 'not-a-date', NOW), false)
eq('expiry exactly now → false',                 isPremiumActive('premium', new Date(NOW).toISOString(), NOW), false)

console.log('isSubscriptionPremium')
eq('statuses mirror the webhook',                [...PREMIUM_SUB_STATUSES].sort(), ['active', 'past_due', 'trialing'])
eq('active + id + premium → true',               isSubscriptionPremium(liveSub()), true)
eq('trialing → true',                            isSubscriptionPremium(liveSub({ status: 'trialing' })), true)
eq('past_due (dunning) → true',                  isSubscriptionPremium(liveSub({ status: 'past_due' })), true)
eq('canceled → false',                           isSubscriptionPremium(liveSub({ status: 'canceled' })), false)
eq('portal backfill row (no sub id) → false',    isSubscriptionPremium(liveSub({ stripe_subscription_id: null })), false)
eq('plan free (unknown price) → false',          isSubscriptionPremium(liveSub({ plan: 'free' })), false)
eq('plan missing → false',                       isSubscriptionPremium(liveSub({ plan: null })), false)
eq('legacy pro → true',                          isSubscriptionPremium(liveSub({ plan: 'pro' })), true)
eq('null → false',                               isSubscriptionPremium(null), false)
// Missed customer.subscription.deleted: the row still says active, but its
// period ended long ago → must NOT keep Premium forever.
const DAY = 24 * 60 * 60 * 1000
const iso = (ms) => new Date(ms).toISOString()
eq('grace is 7 days',                            SUB_PERIOD_GRACE_MS, 7 * DAY)
eq('period ends in future → true',               isSubscriptionPremium(liveSub({ current_period_end: FUTURE }), NOW), true)
eq('period ended 3 days ago (in grace) → true',  isSubscriptionPremium(liveSub({ current_period_end: iso(NOW - 3 * DAY) }), NOW), true)
eq('period ended 8 days ago (stale row) → false', isSubscriptionPremium(liveSub({ current_period_end: iso(NOW - 8 * DAY) }), NOW), false)
eq('stale active row months old → false',        isSubscriptionPremium(liveSub({ current_period_end: PAST }), NOW), false)
eq('period end null (unknown) → true',           isSubscriptionPremium(liveSub({ current_period_end: null }), NOW), true)
eq('period end garbage → false (fail closed)',   isSubscriptionPremium(liveSub({ current_period_end: 'nope' }), NOW), false)

console.log('pickSubscription (PostgREST embed shapes)')
eq('object passes through',                      pickSubscription(liveSub()), liveSub())
eq('array → premium row wins',                   pickSubscription([liveSub({ status: 'canceled' }), liveSub()]), liveSub())
eq('array of non-premium → first',               pickSubscription([liveSub({ status: 'canceled' })]), liveSub({ status: 'canceled' }))
eq('empty array → null',                         pickSubscription([]), null)
eq('null → null',                                pickSubscription(null), null)

console.log('resolvePremium (the effective plan)')
const r = (plan, premiumUntil, subscription) => resolvePremium({ plan, premiumUntil, subscription, now: NOW })

// THE bug: expired pass + new subscription → must be Premium.
eq('expired pass + live subscription → premium (sec-3)',
  r('premium', PAST, liveSub()),
  { isPremium: true, passActive: false, hasActiveSubscription: true })
eq('plan says free but live subscription → premium',
  r('free', null, liveSub()),
  { isPremium: true, passActive: false, hasActiveSubscription: true })
eq('expired pass, no subscription → free',
  r('premium', PAST, null),
  { isPremium: false, passActive: false, hasActiveSubscription: false })
eq('expired pass + canceled subscription → free',
  r('premium', PAST, liveSub({ status: 'canceled' })),
  { isPremium: false, passActive: false, hasActiveSubscription: false })
eq('active pass, no subscription → premium, passActive',
  r('premium', FUTURE, null),
  { isPremium: true, passActive: true, hasActiveSubscription: false })
eq('active pass + live subscription → both flags',
  r('premium', FUTURE, liveSub()),
  { isPremium: true, passActive: true, hasActiveSubscription: true })
eq('subscriber, no pass column (42703) → premium',
  r('premium', null, liveSub()),
  { isPremium: true, passActive: false, hasActiveSubscription: true })
eq('manual promotion (no sub row, no expiry) → premium (unchanged)',
  r('premium', null, null),
  { isPremium: true, passActive: false, hasActiveSubscription: false })
eq('free + portal backfill row → free',
  r('free', null, liveSub({ stripe_subscription_id: null })),
  { isPremium: false, passActive: false, hasActiveSubscription: false })
eq('free user, no subscription → free',
  r('free', null, undefined),
  { isPremium: false, passActive: false, hasActiveSubscription: false })
eq('free (fixed by admin) + stale active row → free',
  r('free', null, liveSub({ current_period_end: PAST })),
  { isPremium: false, passActive: false, hasActiveSubscription: false })
eq('pickSubscription array honours now (stale row loses)',
  pickSubscription([liveSub({ current_period_end: PAST }), liveSub({ stripe_subscription_id: 'sub_new', current_period_end: FUTURE })], NOW),
  liveSub({ stripe_subscription_id: 'sub_new', current_period_end: FUTURE }))

console.log('planQueryFallback (schema drift — must never fail OPEN)')
const both  = { withPremiumUntil: true,  withSubEmbed: true }
const noPU  = { withPremiumUntil: false, withSubEmbed: true }
const noSub = { withPremiumUntil: true,  withSubEmbed: false }
const none  = { withPremiumUntil: false, withSubEmbed: false }
eq('42703 naming premium_until → drop premium_until',
  planQueryFallback({ code: '42703', message: 'column users.premium_until does not exist' }, both), 'drop_premium_until')
eq('42703 on an embed column → drop EMBED, keep premium_until (was fail-open)',
  planQueryFallback({ code: '42703', message: 'column subscriptions_1.current_period_end does not exist' }, both), 'drop_embed')
eq('42703 without text, embed present → drop embed first',
  planQueryFallback({ code: '42703', message: null }, both), 'drop_embed')
eq('42703 after embed dropped → only premium_until left',
  planQueryFallback({ code: '42703', message: 'whatever' }, noSub), 'drop_premium_until')
eq('42703 naming premium_until but already dropped, embed left → drop embed',
  planQueryFallback({ code: '42703', message: 'premium_until' }, noPU), 'drop_embed')
eq('42703 with nothing left → fail',
  planQueryFallback({ code: '42703', message: 'x' }, none), 'fail')
eq('PGRST200 (no FK in cache) → drop embed',
  planQueryFallback({ code: 'PGRST200', message: 'Could not find a relationship' }, both), 'drop_embed')
eq('42P01 (table absent) → drop embed',
  planQueryFallback({ code: '42P01' }, both), 'drop_embed')
eq('PGRST200 after embed dropped → fail',
  planQueryFallback({ code: 'PGRST200' }, noSub), 'fail')
eq('network/other error → fail',
  planQueryFallback({ code: '08006', message: 'connection failure' }, both), 'fail')

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`)
  process.exit(1)
}
console.log('\nAll plan checks passed.')
