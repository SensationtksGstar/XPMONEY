// Golden-case guard for the free public tools' math (src/lib/tools/*).
//
// Run: node --experimental-strip-types scripts/check-tools.mjs
//
// Why: the /ferramentas/* calculators are YMYL pages indexed by Google. A
// silent arithmetic regression (rounding, TSU rate, proportionality) would
// publish wrong money numbers. tsc can't catch that — this can.
//
// The libs under test must stay free of runtime imports (only `import type`)
// so Node can load them with --experimental-strip-types.

import { compute503020 } from '../src/lib/tools/budget503020.ts'
import { computeSubsidioNatal, splitPlan } from '../src/lib/tools/subsidioNatal.ts'
import { stripThousandsOnly } from '../src/lib/tools/amountText.ts'
import { parseAmountLocale } from '../src/lib/safeNumber.ts'

let failures = 0
function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  ok   ${name}`)
  } else {
    failures += 1
    console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`)
  }
}
const eq = (a, b) => Math.abs(a - b) < 1e-9

// ── 50/30/20 ────────────────────────────────────────────────────────────
console.log('compute503020')
{
  const r = compute503020({ netIncome: 1300 })
  check('1300: needs 650',     eq(r.needs, 650),     String(r.needs))
  check('1300: wants 390',     eq(r.wants, 390),     String(r.wants))
  check('1300: savings 260',   eq(r.savings, 260),   String(r.savings))
  check('1300: emergency3 1950', eq(r.emergency3, 1950), String(r.emergency3))
  check('1300: emergency6 3900', eq(r.emergency6, 3900), String(r.emergency6))
  check('1300: 3 meses em 12 = 162.5', eq(r.monthlyToEmergency3In12, 162.5), String(r.monthlyToEmergency3In12))
  check('1300 sem renda: rentExceedsNeeds false', r.rentExceedsNeeds === false)
  check('1300 sem renda: rentShare 0', r.rentShareOfIncome === 0)
  check('1300: soma dos 3 baldes = rendimento', eq(r.needs + r.wants + r.savings, 1300))
}
{
  const r = compute503020({ netIncome: 1300, rent: 700 })
  check('1300 + renda 700: rentExceedsNeeds true', r.rentExceedsNeeds === true)
  check('1300 + renda 700: share ~53.8%', Math.abs(r.rentShareOfIncome - 700 / 1300) < 1e-12)
}
{
  const r = compute503020({ netIncome: 1300, rent: 650 })
  check('renda == necessidades (650): NAO excede (so passa quando > 50%)', r.rentExceedsNeeds === false)
}
{
  const r = compute503020({ netIncome: 0 })
  const all = [r.needs, r.wants, r.savings, r.emergency3, r.emergency6, r.monthlyToEmergency3In12, r.rentShareOfIncome]
  check('0: tudo a 0', all.every(v => v === 0), JSON.stringify(r))
  check('0: rentExceedsNeeds false', r.rentExceedsNeeds === false)
}
{
  // Entradas sujas nunca produzem NaN/negativos.
  const r = compute503020({ netIncome: NaN, rent: -50 })
  check('NaN/negativo tratados como 0', r.needs === 0 && r.rentShareOfIncome === 0 && r.rentExceedsNeeds === false)
}
{
  // Arredondamento a cêntimos (1234,57 * 0,3 = 370,371).
  const r = compute503020({ netIncome: 1234.57 })
  check('arredonda a cêntimos', eq(r.wants, 370.37) && eq(r.needs, 617.29) && eq(r.savings, 246.91),
    `${r.needs}/${r.wants}/${r.savings}`)
}

// ── Subsídio de Natal ───────────────────────────────────────────────────
console.log('computeSubsidioNatal')
{
  const r = computeSubsidioNatal({ baseMensalBruto: 1000, mesesTrabalhados: 12, taxaRetencaoPct: 0, emDuodecimos: false })
  check('1000/12/0%: bruto 1000',  eq(r.bruto, 1000),  String(r.bruto))
  check('1000/12/0%: tsu 110',     eq(r.tsu, 110),     String(r.tsu))
  check('1000/12/0%: irs 0',       eq(r.irs, 0),       String(r.irs))
  check('1000/12/0%: liquido 890', eq(r.liquido, 890), String(r.liquido))
  check('1000/12/0%: duodecimos 74.17', eq(r.porMesSeDuodecimos, 74.17), String(r.porMesSeDuodecimos))
}
{
  const r = computeSubsidioNatal({ baseMensalBruto: 1200, mesesTrabalhados: 6, taxaRetencaoPct: 10, emDuodecimos: false })
  check('1200/6/10%: bruto 600',   eq(r.bruto, 600),   String(r.bruto))
  check('1200/6/10%: tsu 66',      eq(r.tsu, 66),      String(r.tsu))
  check('1200/6/10%: irs 60',      eq(r.irs, 60),      String(r.irs))
  check('1200/6/10%: liquido 474', eq(r.liquido, 474), String(r.liquido))
  check('1200/6/10%: parte mensal = liquido / meses trabalhados (79)', eq(r.porMesSeDuodecimos, 79), String(r.porMesSeDuodecimos))
}
{
  const r = computeSubsidioNatal({ baseMensalBruto: 1500, mesesTrabalhados: 12, taxaRetencaoPct: 15.5, emDuodecimos: true })
  check('1500/12/15.5%: liquido = bruto - tsu - irs', eq(r.liquido, r.bruto - r.tsu - r.irs), JSON.stringify(r))
  check('1500/12/15.5%: irs 232.5', eq(r.irs, 232.5), String(r.irs))
}
{
  // Limites: meses fora de 1-12 e taxa fora de 0-60 são limpos, nunca NaN.
  const hi = computeSubsidioNatal({ baseMensalBruto: 1000, mesesTrabalhados: 99, taxaRetencaoPct: 500, emDuodecimos: false })
  check('meses>12 limitado a 12', hi.mesesUsados === 12 && eq(hi.bruto, 1000))
  check('taxa>60 limitada a 60',  hi.taxaUsada === 60 && eq(hi.irs, 600))
  const bad = computeSubsidioNatal({ baseMensalBruto: NaN, mesesTrabalhados: NaN, taxaRetencaoPct: -3, emDuodecimos: false })
  check('entrada suja nao produz NaN', [bad.bruto, bad.tsu, bad.irs, bad.liquido, bad.porMesSeDuodecimos].every(Number.isFinite))
  check('entrada suja = 0 euros', bad.bruto === 0 && bad.liquido === 0)
}

// ── Plano em 3 partes ───────────────────────────────────────────────────
console.log('splitPlan')
{
  const s = splitPlan(890, 50, 30)
  check('890 em 50/30/20: 445 / 267 / 178', eq(s.a, 445) && eq(s.b, 267) && eq(s.c, 178), JSON.stringify(s))
  const t = splitPlan(100.01, 33, 33)
  check('as 3 partes somam sempre o liquido', eq(t.a + t.b + t.c, 100.01), JSON.stringify(t))
}

// ── Texto de montantes (milhar vs decimal) ──────────────────────────────
console.log('stripThousandsOnly + parseAmountLocale')
{
  const parse = (s, percent = false) => parseAmountLocale(percent ? s : stripThousandsOnly(s))
  const cases = [
    ['1.300', 1300], ['1,300', 1300], ['1300', 1300], ['1300,50', 1300.5], ['1300.50', 1300.5],
    ['1.300,50', 1300.5], ['1,300.50', 1300.5], ['12.500', 12500], ['1.300.000', 1300000],
    ['1 300', 1300], ['12,5', 12.5], ['0.500', 0.5], ['0,5', 0.5], ['1.5', 1.5], ['2.50', 2.5],
  ]
  for (const [raw, want] of cases) {
    const got = parse(raw)
    check(`"${raw}" -> ${want}`, eq(got, want), String(got))
  }
  check('percentagem "7.500" nao e milhar (7.5)', eq(parse('7.500', true), 7.5), String(parse('7.500', true)))
  check('percentagem "7,500" nao e milhar (7.5)', eq(parse('7,500', true), 7.5), String(parse('7,500', true)))
}

if (failures > 0) {
  console.error(`\n${failures} golden case(s) FAILED`)
  process.exit(1)
}
console.log('\nall golden cases passed')
