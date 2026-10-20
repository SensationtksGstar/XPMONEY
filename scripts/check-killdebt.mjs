// Golden-case guard for the Mata-Dívidas planner math (src/lib/killDebt.ts).
//
// Run: node --experimental-strip-types scripts/check-killdebt.mjs
//
// Why: simulatePlan used to drop the minimum payment of a killed debt instead
// of rolling it into the next one (no real snowball). A €500/20%/min €50 +
// €5.000/10%/min €100 plan showed 65 months / €1.519,63 instead of the correct
// 45 months / €1.126,94. tsc can't catch arithmetic regressions — this can.
//
// killDebt.ts must keep ONLY `import type` from '@/…' (types are stripped);
// a runtime alias import would make this script fail to load.

import { simulatePlan, compareStrategies } from '../src/lib/killDebt.ts'

let failures = 0
function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  ok   ${name}`)
  } else {
    failures += 1
    console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function debt(id, current_amount, interest_rate, min_payment, extra = {}) {
  return {
    id,
    name:           id,
    category:       'outro',
    initial_amount: current_amount,
    current_amount,
    interest_rate,
    min_payment,
    strategy:       'avalanche',
    status:         'active',
    killed_at:      null,
    created_at:     '2026-01-01T00:00:00Z',
    ...extra,
  }
}

const A = debt('A', 500, 20, 50)
const B = debt('B', 5000, 10, 100)
const caseA = [A, B]

console.log('killDebt golden cases')

// (a) Real snowball: freed minimums roll into the next debt.
{
  const r = simulatePlan(caseA, 0, 'avalanche')
  check('(a) A+B extra 0 avalanche → 45 months', r.monthsToFree === 45, `got ${r.monthsToFree}`)
  check('(a) A+B extra 0 avalanche → interest ≈ €1126.94',
    Math.abs(r.totalInterest - 1126.94) < 1, `got ${r.totalInterest}`)
  check('(a) not infinite', r.infinite === false)
  const last = r.timeline[r.timeline.length - 1]
  check('(a) timeline ends at 0', last && last.remaining === 0, `got ${JSON.stringify(last)}`)
}

// (b) Paying more never costs more time or more interest.
{
  const base = simulatePlan(caseA, 0, 'avalanche')
  for (const extra of [50, 100]) {
    const r = simulatePlan(caseA, extra, 'avalanche')
    check(`(b) extra ${extra} months ≤ extra 0`, r.monthsToFree <= base.monthsToFree,
      `${r.monthsToFree} vs ${base.monthsToFree}`)
    check(`(b) extra ${extra} interest ≤ extra 0`, r.totalInterest <= base.totalInterest,
      `${r.totalInterest} vs ${base.totalInterest}`)
  }
  // Monotonic across a wider ladder, both strategies.
  for (const strategy of ['avalanche', 'snowball']) {
    let prev = simulatePlan(caseA, 0, strategy)
    for (const extra of [25, 50, 100, 200, 500, 2000]) {
      const r = simulatePlan(caseA, extra, strategy)
      check(`(b) ${strategy} extra ${extra} monotonic`,
        r.monthsToFree <= prev.monthsToFree && r.totalInterest <= prev.totalInterest + 0.01,
        `${r.monthsToFree}m/${r.totalInterest} after ${prev.monthsToFree}m/${prev.totalInterest}`)
      prev = r
    }
  }
}

// (c) A single debt gives the same result under both strategies.
{
  const one = [debt('X', 3000, 15, 90)]
  for (const extra of [0, 100]) {
    const av = simulatePlan(one, extra, 'avalanche')
    const sn = simulatePlan(one, extra, 'snowball')
    check(`(c) single debt extra ${extra} avalanche === snowball`,
      av.monthsToFree === sn.monthsToFree && av.totalInterest === sn.totalInterest,
      `${av.monthsToFree}/${av.totalInterest} vs ${sn.monthsToFree}/${sn.totalInterest}`)
  }
}

// (d) savings is never negative.
{
  const scenarios = [
    [caseA, 0], [caseA, 100],
    [[debt('C1', 1500, 18.9, 60), debt('C2', 6000, 9.5, 150), debt('C3', 9000, 7, 200)], 100],
    [[debt('S', 200, 5, 20), debt('L', 8000, 22, 250)], 50],
  ]
  for (const [debts, extra] of scenarios) {
    const c = compareStrategies(debts, extra)
    check(`(d) savings ≥ 0 (${debts.map(d => d.id).join('+')}, extra ${extra})`, c.savings >= 0, `got ${c.savings}`)
  }
}

// (e) Edge cases: minimum doesn't cover interest → infinite; no debts → zero;
//     numeric strings (Supabase numeric) don't concatenate.
{
  const inf = simulatePlan([debt('I', 10000, 24, 50)], 0, 'avalanche')
  check('(e) min below interest → infinite', inf.infinite === true)
  const empty = simulatePlan([], 100, 'avalanche')
  check('(e) no debts → 0 months, not infinite', empty.monthsToFree === 0 && empty.infinite === false)
  const asStrings = simulatePlan(
    [debt('A', '500', '20', '50'), debt('B', '5000.00', '10', '100')], 0, 'avalanche')
  check('(e) numeric strings behave like numbers', asStrings.monthsToFree === 45,
    `got ${asStrings.monthsToFree}`)
  const killed = simulatePlan([A, debt('K', 999, 30, 10, { status: 'killed' })], 0, 'avalanche')
  const onlyA  = simulatePlan([A], 0, 'avalanche')
  check('(e) killed debts are ignored', killed.monthsToFree === onlyA.monthsToFree)
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`)
  process.exit(1)
}
console.log('\nAll killDebt checks passed.')
