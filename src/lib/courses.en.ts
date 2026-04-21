// ── XP-Money — Course Catalog · EN override ──────────────────────────────────
// Parallel English strings for the PT course catalogue.
//
// This file is an OVERRIDE MAP, not a full parallel `Course[]`. The PT file
// (`courses.ts`) is the single source of structural truth — IDs, emojis,
// colours, durations, correct-answer indexes. This file only holds translated
// strings. Anything missing from a lesson/quiz override falls back to PT via
// `coursesAccess.ts`.
//
// Keep structure intact when editing: every `\n\n` paragraph break, every `→`
// bullet, every `**bold**` / emoji / number / € value in the PT source must
// survive in EN. Numbers stay the same (€ not $). Portuguese tax terms (IRS,
// escalões, Anexo G) and PT banking names (CGD, Millennium, Revolut) stay
// verbatim — the tax course is explicitly about Portuguese fiscal law.

type LessonTextOverride = {
  title?:   string
  content?: string
}
type QuizTextOverride = {
  text?:    string
  options?: string[]
}
export interface CourseEnOverride {
  title?:       string
  subtitle?:    string
  certificate?: { title?: string; description?: string }
  lessons?:     Record<string, LessonTextOverride>    // keyed by lesson.id
  quiz?:        Record<string, QuizTextOverride>      // keyed by quiz.id
}

export const COURSES_EN: Record<string, CourseEnOverride> = {

  // ── 1. Gestão Básica ───────────────────────────────────────────────────────
  'gestao-basica': {
    title:    'Personal Finance Fundamentals',
    subtitle: 'Learn to control your money and build solid habits',
    certificate: {
      title:       'Certificate in Personal Finance Fundamentals',
      description: 'Mastered the essentials of personal budgeting, emergency funds and debt elimination.',
    },
    lessons: {
      l1: {
        title:   'What is financial health?',
        content: `Financial health is the ability to manage your money in a way that gives you stability, security and freedom — now and in the future. Like physical health, it's not a destination but an ongoing journey.

**The 4 pillars of financial health:**
→ **Liquidity** — Having cash available for emergencies (at least 3 months of expenses)
→ **Balance** — Consistently spending less than you earn
→ **Growth** — Making your money work for you (savings and investment)
→ **Protection** — Insurance, emergency fund, no high-risk debt

**Why most people fail?**
It's not a lack of knowledge — it's a lack of system. Without a clear method, money "disappears" with no explanation. XP-Money fixes exactly that: it turns money management into a game you actually want to win.

**The XP-Money Score** measures these 4 pillars and gives you a number between 0 and 100. Your goal: push that number up, week after week. Simple, measurable, motivating.`,
      },
      l2: {
        title:   'Personal Budgeting — The 50/30/20 Rule',
        content: `The 50/30/20 budget is the golden rule of personal finance. Split your monthly take-home pay into 3 simple buckets:

**50% — Needs**
Everything you need to live: rent/mortgage, food, transport, health, utilities. If this goes over 50%, it's a sign your fixed costs are too high.

**30% — Wants**
Restaurants, leisure, travel, streaming subscriptions, non-essential clothes. This is the easiest bucket to cut when you need to.

**20% — Savings and Investment**
This is the slice that builds your future: emergency fund, goal-based savings and long-term investments.

**Worked example with €1,200/month take-home:**
→ Needs: €600 (rent €450 + food €100 + transport €50)
→ Wants: €360 (going out €150 + streaming €30 + clothes €80 + other €100)
→ Savings: €240 (emergency fund €100 + holiday goal €80 + investment €60)

In XP-Money, categorise every transaction and see in real time which bucket you're in. The Score reacts live.`,
      },
      l3: {
        title:   'Emergency Fund',
        content: `An emergency fund is the foundation of any solid financial plan. Without one, a single unexpected expense — broken car, health issue, job loss — can wipe out years of savings.

**How much should you have?**
→ **Minimum:** 3 months of essential expenses
→ **Ideal:** 6 months of total expenses
→ **Conservative:** 12 months (if you have dependents or unstable work)

**Where to keep it?**
The emergency fund should be **separate from your checking account** (so you don't spend it without thinking) but **immediately accessible** (not locked in investments):
→ Savings account with good liquidity
→ Certificados de Aforro (Portuguese state savings) — capital guaranteed, liquidity in 30 days
→ Low-risk money-market ETF (better yield, accessible in 2-3 days)

**How to build it fast?**
1. Set a target (e.g. €5,000 for 6 months at €830/month)
2. Create a Goal in XP-Money with that amount
3. Automate a transfer at the start of every month (even small — €50 still counts)
4. Treat it as a non-negotiable expense, not an option

Consistency is everything. €100/month for 12 months beats €1,200 in a single impulsive decision you later reverse.`,
      },
      l4: {
        title:   'Debt — How to Kill It',
        content: `Debt is the biggest obstacle to financial freedom. But not all debt is equal.

**"Good" debt vs "bad" debt:**
→ **Good:** Low-rate mortgage, student loan — builds an asset or increases your earning power
→ **Bad:** Credit card, consumer personal loan, high-interest instalment plans — just pulls future spending forward

**The 2 most effective methods:**

🔴 **Avalanche Method (mathematically optimal)**
Pay the minimum on every debt. Extra money goes to the highest-rate debt. When that's gone, move to the next. Saves the most in interest.

🟡 **Snowball Method (psychologically effective)**
Pay the minimum on every debt. Extra money goes to the smallest balance. Clearing debts fast gives momentum. Costs slightly more but most people actually stick with it.

**Example — 3 debts:**
| Debt | Balance | Rate |
|--------|-------|------|
| Credit card | €400 | 24% |
| Personal | €2,000 | 12% |
| Car | €5,000 | 5% |

Avalanche: focus on the card (24%) → personal → car
Snowball: focus on the card (€400) → personal → car

**Golden rule:** Don't invest before clearing debt above 7%. The average investment return (~7%/year) doesn't beat paying 12-24% in interest.`,
      },
    },
    quiz: {
      q1: {
        text: 'In the 50/30/20 rule, what percentage goes to savings and investment?',
        options: ['10%', '20%', '30%', '50%'],
      },
      q2: {
        text: 'What is the minimum recommended size of an emergency fund?',
        options: ['1 month of expenses', '3 months of essential expenses', '6 months of salary', '€10,000 fixed'],
      },
      q3: {
        text: 'In the Avalanche debt-payoff method, which debt do you attack first?',
        options: ['The largest balance', 'The highest-rate debt', 'The smallest balance', 'The oldest debt'],
      },
      q4: {
        text: 'Where should you NOT keep your emergency fund?',
        options: ['Savings account', 'Certificados de Aforro', 'Volatile cryptocurrencies', 'Money-market ETF'],
      },
      q5: {
        text: 'Which of the following is an example of "good" debt?',
        options: ['Personal loan at 18%', 'Credit-card instalments', 'Fixed-rate mortgage at 3%', 'Bank overdraft'],
      },
    },
  },

  // ── 2. Investimento Iniciantes ─────────────────────────────────────────────
  'investimento-iniciantes': {
    title:    'Investing for Beginners',
    subtitle: 'Learn how to grow your money with simple, safe strategies',
    certificate: {
      title:       'Certificate in Beginner Investing',
      description: 'Understood the principles of risk/return, ETFs, compound interest and building a diversified portfolio.',
    },
    lessons: {
      l1: {
        title:   'Where to start investing',
        content: `Investing isn't just for the wealthy. With €50/month and consistency, anyone can build long-term wealth. The barrier isn't capital — it's knowledge and habit.

**Before you invest, confirm:**
✅ You have an emergency fund (3-6 months of expenses)
✅ You have no debt above 7% interest
✅ You have stable income (at least partially)

**The main investment vehicles:**
→ **Time deposits** — Guaranteed interest, protected capital. Ideal for short-term (<2 years)
→ **Bonds** — Loans to companies/governments with fixed interest. Low-to-medium risk
→ **Stocks** — Ownership in companies. High volatility, historical return ~7-10%/year
→ **ETFs** — A basket of stocks/bonds in one product. The best option for beginners
→ **Real estate** — Requires significant capital but is tangible and familiar

**The rule of 100:**
Subtract your age from 100. That's the ideal % in stocks:
→ 25 years old → 75% stocks, 25% bonds/cash
→ 45 years old → 55% stocks, 45% bonds/cash
→ 65 years old → 35% stocks, 65% bonds/cash

The younger you are, the more time you have to recover from drops — so you can take more risk.`,
      },
      l2: {
        title:   'Risk and Return',
        content: `The relationship between risk and return is the fundamental law of investing: **higher potential return demands higher risk**. There are no free lunches in financial markets.

**Types of risk:**
→ **Market risk** — Asset prices go up and down. Unavoidable in markets
→ **Company risk** — The company you invested in does badly. Solved by diversification
→ **Inflation risk** — Your money loses purchasing power. Cash in the bank loses value
→ **Liquidity risk** — You can't sell when you need to (e.g. real estate)

**Volatility isn't the enemy:**
A stock portfolio can drop 30-40% in a crisis. But historically it recovered and went even higher. The problem isn't the drop — it's selling during the drop.

**Golden rule:**
→ Money you need in <2 years → DO NOT put in stocks
→ Money you won't need for 5+ years → Stocks/ETFs are a fit
→ Emergency money → 100% liquid and safe

**Risk profile:**
Be honest with yourself. If watching your investment fall 20% keeps you up at night and makes you want to sell everything — your profile is conservative. That's fine. The best investment is the one you can actually hold through the tough moments.`,
      },
      l3: {
        title:   'ETFs — The Passive Investor\'s Best Friend',
        content: `An ETF (Exchange-Traded Fund) is a fund that tracks a market index (e.g. S&P 500, MSCI World) and trades on an exchange like a stock. By far the best way to start investing.

**Why ETFs are ideal for beginners:**
→ **Instant diversification** — An S&P 500 ETF gives you exposure to 500 US companies in one purchase
→ **Low costs** — TER (Total Expense Ratio) of 0.03% to 0.20% a year, vs 1.5-2.5% for active funds
→ **Transparency** — You know exactly what you're buying
→ **Liquidity** — Buy and sell at any time during market hours

**The most popular ETFs for beginners:**
| ETF | Index | TER | Holdings |
|-----|--------|-----|-------------|
| VWCE | FTSE All-World | 0.22% | ~3,700 global companies |
| CSPX | S&P 500 | 0.07% | 500 largest US companies |
| IWDA | MSCI World | 0.20% | 1,500 developed-market companies |

**Where to buy ETFs from Portugal:**
→ Interactive Brokers (lowest fees, ideal for amounts above €1,000)
→ Trading 212 (no commission, fractional ETFs, great to start)
→ Degiro (low fees, simple interface)

**DCA strategy (Dollar-Cost Averaging):**
Invest a fixed amount every month, regardless of price. In down months you buy cheaper. In up months you buy less. The average cost is optimised automatically.`,
      },
      l4: {
        title:   'Compound Interest — The 8th Wonder of the World',
        content: `"He who understands compound interest, earns it. He who doesn't, pays it." — Albert Einstein (attributed)

**What is compound interest?**
It's when your interest generates new interest. Your money works, and the fruits of your money's work also work. It's a financial snowball.

**A concrete example:**
€10,000 invested at 7%/year for 30 years:
→ Without compounding (principal only): €10,000 + €21,000 interest = €31,000
→ With compounding: €76,122 (!!)

**The magic formula: A = P × (1 + r)^t**
→ P = Initial capital (€10,000)
→ r = Return rate (0.07 = 7%)
→ t = Years (30)
→ A = €10,000 × (1.07)^30 = €76,122

**Time is the most important ingredient:**

| You invest | For | Result |
|---------|---------|-----------|
| €200/month | 20 years | ~€104,000 |
| €200/month | 30 years | ~€227,000 |
| €200/month | 40 years | ~€528,000 |

The difference between 30 and 40 years isn't 33% more — it's 132% more. Compound interest accelerates exponentially.

**The lesson:** Start today. One year of delay isn't a small difference — it's decades of compound growth lost. In XP-Money you can create an investment Goal and see the projected growth in real time.`,
      },
    },
    quiz: {
      q1: {
        text: 'What is an ETF?',
        options: [
          'A type of bank account with guaranteed interest',
          'A fund that tracks an index and trades on an exchange',
          'A life-insurance policy tied to investments',
          'A certificate issued by the state',
        ],
      },
      q2: {
        text: 'What is the main advantage of DCA (Dollar-Cost Averaging)?',
        options: [
          'It guarantees a positive return every time',
          'It eliminates market risk entirely',
          'It smooths your average purchase price over time',
          'It lets you always buy at the lowest price',
        ],
      },
      q3: {
        text: 'Before investing in stocks, what should you confirm?',
        options: [
          'That you have at least €10,000 available',
          'That you have an emergency fund and no high-rate debt',
          'That markets are trending up',
          'That you have a professional portfolio manager',
        ],
      },
      q4: {
        text: 'By the rule of 100, someone aged 30 should hold what % in stocks?',
        options: ['30%', '50%', '70%', '100%'],
      },
      q5: {
        text: 'What happens to €5,000 invested at 7%/year for 20 years with compounding?',
        options: [
          'It becomes €12,000',
          'It becomes €19,348',
          'It becomes €7,000',
          'It becomes €35,000',
        ],
      },
    },
  },

  // ── 3. Poupança e Independência Financeira ─────────────────────────────────
  'poupanca-independencia': {
    title:    'Savings and Financial Independence',
    subtitle: 'Set your savings rate and chart the path to financial freedom',
    certificate: {
      title:       'Certificate in Financial Independence',
      description: 'Mastered the concepts of savings rate, the FIRE movement and financial automation.',
    },
    lessons: {
      l1: {
        title:   'The Saver\'s Mindset',
        content: `The biggest barrier to saving isn't income — it's mindset. People with high incomes can live paycheck to paycheck. People with modest incomes can accumulate real wealth. The difference is how they think about money.

**Lifestyle inflation:**
When you earn more, you automatically spend more. This phenomenon is called "lifestyle inflation". New job, 20% raise? Within 6 months your expenses adapt and you're still not saving.

**How to fight it:**
Any time your income goes up, send at least 50% of the raise to savings/investment. If you earn +€200/month, €100 goes to savings, €100 improves your lifestyle. You grow on both sides.

**Saver vs. Consumer — two parallel worlds:**
→ **Consumer:** Gets paid → pays bills → spends what's left → eventually saves
→ **Saver:** Gets paid → saves first → lives on what's left

Order matters. If you save what's left, there's rarely anything left. If you spend what's left after saving, your lifestyle adapts.

**What motivates you most?**
Nailing down your "why" is essential. Freedom to work on projects you love? Never needing to say yes to a toxic boss out of financial necessity? Travel? Early retirement? XP-Money helps you turn that abstract goal into a concrete number with a deadline.`,
      },
      l2: {
        title:   'Savings Rate — The Number That Defines Everything',
        content: `Your savings rate is the percentage of your take-home pay you save and/or invest each month. It's the single most important personal-finance metric.

**Formula:**
Savings Rate = (Monthly Savings / Monthly Take-Home Pay) × 100

**The brutal impact of your savings rate:**
| Savings Rate | Years to Financial Independence |
|-----------------|--------------------------------------|
| 5% | 66 years |
| 10% | 51 years |
| 20% | 37 years |
| 35% | 25 years |
| 50% | 17 years |
| 65% | 10 years |

*Assuming 7%/year investment return and constant lifestyle*

**Why does the rate matter more than the absolute amount?**
€500/month saved on a €2,500 salary (20%) has the same time effect as €1,500/month on a €7,500 salary (20%). What matters is the proportion, not the number.

**How to raise your savings rate:**
→ Increase income (promotion, freelancing, second job)
→ Reduce fixed expenses (lower rent, cheaper car)
→ Kill unconscious spending (forgotten subscriptions, impulse buys)
→ Renegotiate contracts (insurance, internet, phone)

In XP-Money, your savings rate shows up in your financial Score. The goal: keep it above 20% every month.`,
      },
      l3: {
        title:   'The FIRE Movement — Financial Independence',
        content: `FIRE stands for Financial Independence, Retire Early. It's a growing movement of people optimising their finances to reach financial freedom decades before the traditional retirement age.

**The Magic Number — The 4% Rule:**
The 4% rule (based on the 1998 Trinity Study) says you can withdraw 4% of your portfolio per year without depleting it for 30+ years.

Your FIRE number = Annual expenses × 25

**Examples:**
→ Expenses: €1,500/month = €18,000/year → FIRE = €450,000
→ Expenses: €2,500/month = €30,000/year → FIRE = €750,000
→ Expenses: €4,000/month = €48,000/year → FIRE = €1,200,000

**FIRE variants:**
→ **Lean FIRE** — Living on very little (<€1,000/month). Maximum frugality
→ **Fat FIRE** — Independence with a comfortable lifestyle (>€4,000/month)
→ **Barista FIRE** — Semi-retirement: basic expenses covered by enjoyable part-time work
→ **Coast FIRE** — You already have enough invested; just wait for compounding to do the rest

**FIRE in Portugal:**
The relatively low cost of living, the NHR (Non-Habitual Resident) regime for investment income, and the favourable climate make Portugal a popular FIRE destination for Europeans and Americans. For Portuguese citizens, the number is more reachable than for Americans or Brits.

**The critique of FIRE:**
Some argue that "retiring" early is empty. The movement's response: FIRE isn't about quitting work — it's about working because you want to, not because you have to. It's freedom of choice.`,
      },
      l4: {
        title:   'Automating Your Savings',
        content: `Automation is the secret of successful savers. It takes willpower out of the equation — and that's good, because willpower is a limited resource.

**4-step automation system:**

**Step 1 — Separate savings account**
Open an account separate from your checking, ideally at another bank to add friction. Call it "Untouchable Savings" or the name of your goal.

**Step 2 — Automatic transfer on payday**
On the same day you get paid, set up an automatic transfer to the savings account. You'll never see the money in checking — what you don't see, you don't spend.

**Step 3 — Automatic monthly investment**
If you already have an emergency fund, set up an automatic investment plan (DCA) on your broker of choice (Trading 212, DEGIRO, etc.). Fixed amount, same day every month.

**Step 4 — Quarterly review (not monthly)**
Checking your portfolio every day is anxiety with no purpose. Review it quarterly: are you saving the planned %? Has the savings rate held? Has any expense crept up?

**Useful tools in Portugal:**
→ MB Way or online banking — scheduled automatic transfers
→ Your bank app — balance notifications
→ XP-Money — track score, savings and missions in real time

**Final rule:** Setup takes 2 hours. After that, it runs itself. That's the beauty of automation — the work is done once, the benefits last decades.`,
      },
    },
    quiz: {
      q1: {
        text: 'What does FIRE stand for?',
        options: [
          'Financial Investment Return Economy',
          'Financial Independence, Retire Early',
          'Future Income Retirement Estimate',
          'Fixed Income Retirement Earnings',
        ],
      },
      q2: {
        text: 'By the 4% rule, what is the "FIRE number" for expenses of €2,000/month?',
        options: ['€240,000', '€480,000', '€600,000', '€800,000'],
      },
      q3: {
        text: 'What is "lifestyle inflation"?',
        options: [
          'Inflation that affects luxury goods',
          'The tendency to spend more as income rises',
          'The rising cost of living over the years',
          'The depreciation of assets over time',
        ],
      },
      q4: {
        text: 'Which savings rate gets you to financial independence in ~17 years?',
        options: ['20%', '35%', '50%', '65%'],
      },
      q5: {
        text: 'What is the main benefit of automating your savings?',
        options: [
          'It guarantees higher returns',
          'It eliminates taxes on gains',
          'It removes the need for daily willpower',
          'It lets you access the money faster',
        ],
      },
    },
  },

  // ── 4. Impostos e IRS ──────────────────────────────────────────────────────
  'impostos-irs': {
    title:    'Taxes and IRS in Portugal',
    subtitle: 'Understand IRS, tax brackets and fiscal benefits — pay what\'s fair, no more',
    certificate: {
      title:       'Certificate in Personal Taxation',
      description: 'Understood how IRS works, progressive brackets, tax benefits and sound filing practices in Portugal.',
    },
    lessons: {
      l1: {
        title:   'How IRS works — brackets and rates',
        content: `IRS (the Portuguese personal income tax — Imposto sobre o Rendimento das Pessoas Singulares) is progressive: the more you earn, the higher the marginal rate. But **the marginal rate doesn't apply to everything** — only to the slice of income that falls inside each bracket.

**2026 brackets (indicative, confirm on Portal das Finanças):**
→ Up to €8,059 → 13.00%
→ €8,059 to €12,160 → 16.50%
→ €12,160 to €17,233 → 22.00%
→ €17,233 to €22,306 → 25.00%
→ €22,306 to €28,400 → 32.00%
→ €28,400 to €41,629 → 35.50%
→ €41,629 to €44,987 → 43.50%
→ €44,987 to €83,696 → 45.00%
→ Above €83,696 → 48.00%

**Worked example — taxable income €25,000:**
You don't pay 32% on €25,000. You pay:
→ 13% on the first €8,059 = €1,048
→ 16.5% on €4,101 (2nd bracket) = €677
→ 22% on €5,073 (3rd) = €1,116
→ 25% on €5,073 (4th) = €1,268
→ 32% on €2,694 (part of 5th) = €862
Total ≈ €4,971 → **effective** rate ~19.9% (not 32%)

The effective rate is always lower than the marginal rate. That's why it always pays to "move up a bracket" when your income rises.`,
      },
      l2: {
        title:   'Deductions, withholding and annual reconciliation',
        content: `During the year, your employer withholds IRS monthly based on an indicative table. That **withholding at source** is an estimate. The real reconciliation happens on the annual return (between April and June of the following year).

**Main tax-credit deductions:**
→ **General household expenses** — 35% of VAT paid, up to €250/adult, €125/child
→ **Health** — 15% of expenses, up to €1,000
→ **Education** — 30%, up to €800
→ **Care homes (lares)** — 25%, up to €403.75
→ **Property (rent)** — 15% of rent paid, up to €502
→ **PPR (retirement savings plan)** — 20% of the amount invested (with age-based limits)

**How to maximise your refund:**
1. **Always ask for an invoice with your NIF** — Even a coffee counts toward general expenses
2. **Validate invoices on e-fatura** by 25 February
3. **Confirm categorisation** — a miscategorised invoice can cost you €50-100 of refund
4. **Consider PPR** if your emergency fund is already built

**Practical rule:** any money left over from withholding is refunded in June-July of the following year. Those who paid less during the year get a smaller refund (or owe a top-up). It's not "winning" or "losing" — it's just cashflow.`,
      },
      l3: {
        title:   'Recibos verdes (self-employed)',
        content: `If you're a freelancer or self-employed you issue recibos verdes (green receipts). IRS works **differently** — calculated on net income after applying a coefficient.

**Coefficients by activity:**
→ Professional services (lawyer, doctor, designer, developer) → **0.75**
→ Commerce/industry → **0.15**
→ Goods sales and restaurants → **0.15**
→ Intellectual services → **0.35**

**Example:** A developer invoices €30,000/year. Taxable income = €30,000 × 0.75 = €22,500. Brackets are applied to those €22,500.

**VAT (IVA):**
→ Up to €15,000/year → exempt (isenção regime)
→ Above → standard regime (charge VAT, file quarterly)

**Segurança Social (Social Security):**
→ Quarterly contribution based on declared income
→ First payment only after 12 months of activity (initial exemption)
→ Rate: 21.4% on 70% of relevant income

**Golden rule:** always set aside **30-35% of what you invoice** into a separate account. Never spend the VAT or the IRS — it isn't yours. Automate a transfer to savings on the day you get paid.

In XP-Money, categorise incoming transactions as "income" to see your real savings rate — invoiced amount minus estimated IRS and SS.`,
      },
      l4: {
        title:   'Annual return — common mistakes',
        content: `The IRS return is filed on the Portal das Finanças between **1 April and 30 June**. For most people it's **pre-filled** — you just validate it.

**Mistakes that cost money:**
❌ **Not validating invoices on e-fatura** — If you don't visit e-fatura by 25 Feb, pending invoices don't count
❌ **Not declaring investment income** — Interest, dividends, stock capital gains (typically 28%, can be aggregated if beneficial)
❌ **Not using aggregation (englobamento)** when your marginal rate is low — Some rent and gains may be taxed more favourably inside IRS than autonomously
❌ **Swapping income between spouses** in separate-filing mode without simulating both scenarios
❌ **Filing on the deadline** — if you need to correct something you run out of time

**The official simulator:**
Before submitting, use the Portal das Finanças simulator. In families with children or big salary differences, separate vs joint filing can differ by hundreds of euros.

**When the AT sends you money:**
If your withholding during the year exceeded the IRS due, you get a refund (usually June-July). If you underpaid, you must settle by 31 August.

**Final checklist before submitting:**
☑ Deductions validated on e-fatura
☑ Dependents correctly identified
☑ Household up to date (marriage, divorce, birth)
☑ Separate vs joint filing simulated
☑ IBAN up to date for the refund
☑ All income categories declared (employment, rent, capital, capital gains)`,
      },
    },
    quiz: {
      q1: {
        text: 'IRS in Portugal is calculated as:',
        options: [
          'A flat rate on total income',
          'A progressive tax by brackets — the marginal rate only applies to the slice inside that bracket',
          'Always 23% of income',
          'A fixed amount per salary level',
        ],
      },
      q2: {
        text: 'A self-employed professional-services worker invoices €20,000/year. What\'s the taxable income?',
        options: ['€20,000', '€15,000', '€10,000', '€3,000'],
      },
      q3: {
        text: 'By what date must you validate invoices on e-fatura to count for the return?',
        options: ['31 December', '25 February', '30 June', '31 March'],
      },
      q4: {
        text: 'What is the annual deduction limit for health expenses?',
        options: ['€250', '€500', '€1,000', 'No limit'],
      },
      q5: {
        text: 'What is the most important practical rule for self-employed workers?',
        options: [
          'Always invoice with VAT',
          'Set aside 30-35% of what you invoice for IRS and Social Security',
          'Never contribute to a PPR',
          'Always file jointly',
        ],
      },
    },
  },

  // ── 5. Psicologia do Dinheiro ──────────────────────────────────────────────
  'psicologia-dinheiro': {
    title:    'The Psychology of Money',
    subtitle: 'Understand the mental biases that sabotage your finances — and how to neutralise them',
    certificate: {
      title:       'Certificate in Financial Psychology',
      description: 'Identifies and neutralises the main cognitive biases affecting spending, saving and investing decisions.',
    },
    lessons: {
      l1: {
        title:   'Money is emotion before it is maths',
        content: `Finance books treat money like a spreadsheet. But financial decisions are made by humans — and humans are emotional before they are rational.

**The brain has two systems (Kahneman):**
→ **System 1** — Fast, intuitive, emotional. Makes most daily spending decisions
→ **System 2** — Slow, analytical, effortful. Only kicks in when we force it

When you walk into a supermarket hungry, System 1 runs the show. When you do monthly budgeting at home, you know you can engage System 2. The point isn't "being rational" — it's **designing the environment** so System 1 fails less often.

**Foundational principle:**
> "Personal finance is more personal than finance" — Morgan Housel

There's no universal optimal budget. There's the budget **you can actually stick to**. Same with investing: the mathematically optimal portfolio is useless if you abandon it at the first -20% dip.

**Three uncomfortable truths:**
1. People with equal salaries have wildly different net worths — behaviour matters more than income
2. There are PhDs in economics who are broke, and truck drivers who die millionaires
3. More financial knowledge doesn't always lead to better decisions — emotion routes around knowledge`,
      },
      l2: {
        title:   'The 8 biases that drain your wallet',
        content: `Knowing these biases doesn't eliminate them — but it lets you spot them before they decide for you.

**1. Loss aversion (Prospect Theory)**
Losing €100 hurts 2× more than gaining €100 feels good. That's why you don't sell falling stocks (you wait to "break even") and you sell rising ones too soon.

**2. Anchoring**
The first price you see conditions the whole perception. A €500 watch next to a €2,000 one looks cheap. The seller knows this.

**3. Mental accounting**
We treat money differently depending on where it came from. €500 from salary is "saved". €500 from a lottery is "bonus", spent quickly. In practice, it's the same money.

**4. Confirmation bias**
You look for information that confirms what you've already decided. Want to buy Tesla? You'll read bullish analysis. You have to pause and **actively seek out the bearish takes**.

**5. Herd effect**
"Everyone is buying crypto" → you buy at the top. "Everyone is panicking" → you sell at the bottom. Individual investing fails at the exact moment it matters most.

**6. Present bias (Hyperbolic discounting)**
€100 today feels more appealing than €150 in a year — even though 50% annual return is excellent. That's why saving hurts.

**7. Sunk cost fallacy**
"I've already spent €3,000 on this car, I'll spend €2,000 more so I don't lose". Wrong: what you've already spent is irrelevant to the current decision.

**8. Overconfidence**
80% of drivers rate themselves "above average". Same with investors. Humility is a statistical edge.`,
      },
      l3: {
        title:   'Design the environment to win',
        content: `Willpower is a limited resource — it drains throughout the day. Consistent savers don't use more willpower; **they reduce how many times they need it**.

**Choice-architecture strategies:**

**1. Friction for spending — ease for saving**
→ Remove card from Amazon/1-click → Impulse spending drops 40%
→ Automatic transfer to savings on payday → Savings triple
→ Savings account at another bank with no phone app → Fewer withdrawals

**2. Pre-commitment**
→ Set up a DCA investment plan **before** temptation hits
→ Write a decision down in a rational moment ("I'll invest €200/month in ETFs, even if the market drops 30%")
→ Say the goal out loud to someone — accountability triples success rates

**3. Reframing**
→ See "€15/day" on coffee × 300 days = €4,500/year → Concrete impact
→ Calculate subscriptions annual × 10 years → Netflix at €14/month = €1,680 over 10 years
→ Convert price into "hours of work" → €200 = 20 hours at minimum wage

**4. Simple rules instead of complex calculations**
→ "I don't buy anything over €50 without sleeping on it 24h" (the 24h rule)
→ "I save 20% of any salary raise before adjusting my lifestyle"
→ "I check investments only 1× per quarter" — prevents emotional trading

XP-Money applies many of these ideas: the Score gives instant feedback (reframing), missions enforce simple rules, and the mascot adds emotional weight to overspending.`,
      },
      l4: {
        title:   'Risk tolerance — know yourself first',
        content: `Risk tolerance has **two dimensions**:

**1. Financial capacity to bear risk**
How much can you lose without affecting your life? Depends on age, stable income, dependents, emergency fund.

**2. Emotional tolerance for risk**
If your portfolio drops 30%, can you sleep? Most people overestimate this tolerance until the first real crisis.

**The honest stress test:**
Picture your total portfolio today. Cut it in **half**. Only half left. Would you panic-sell everything, or keep buying per your plan?

If the answer is "I'd sell everything", your portfolio is too aggressive. The ideal portfolio isn't the one that maximises returns — it's the one **you can hold through the worst moments**.

**Practical rule:**
→ Never invest money you might need in <3 years
→ Never invest so much that volatility keeps you up at night
→ If you avoid opening your broker app on red days, your portfolio is too aggressive

**The most important question:**
"What's the minimum I **accept** losing in a bad year?" — Not "what's the maximum I hope to gain". The gains take care of themselves. It's the losses that destroy portfolios (and mental health).

**Bottom line:**
Your financial decisions are never better than your behaviour on your worst days. A portfolio with "just" 5% return that you can hold for 30 years beats a 10% portfolio you abandon at the first crisis.

XP-Money reinforces behaviour via the mascot: consistency always wins. Small daily decisions, held over time, build wealth. Big impulsive decisions destroy it.`,
      },
    },
    quiz: {
      q1: {
        text: 'By Kahneman, humans have two decision systems. Which one makes most daily spending decisions?',
        options: [
          'System 1 — fast and emotional',
          'System 2 — slow and analytical',
          'A hybrid 50/50 system',
          'Neither — decisions are 100% rational',
        ],
      },
      q2: {
        text: 'What is loss aversion (Prospect Theory)?',
        options: [
          'Avoiding any risky investment',
          'The pain of losing something is about 2× greater than the pleasure of gaining the same amount',
          'Never accepting losses on stocks',
          'Always diversifying across assets',
        ],
      },
      q3: {
        text: 'Which of these is a good "choice architecture" strategy?',
        options: [
          'Save your card on every site so you can buy fast',
          'Set up an automatic transfer to savings on payday',
          'Check your investment portfolio every day',
          'Use cash only for special occasions',
        ],
      },
      q4: {
        text: 'What is the sunk cost fallacy?',
        options: [
          'Keeping bad decisions going because of money already spent that can\'t be recovered',
          'Spending more than you have in the account',
          'Investing in assets that will go bankrupt',
          'Miscalculating the return on an investment',
        ],
      },
      q5: {
        text: 'What is the honest risk-tolerance test?',
        options: [
          'Imagine a +30% return and whether you could celebrate',
          'Imagine your portfolio dropping 50% — and whether you\'d stick to the plan',
          'Look at the last decade\'s historical chart',
          'Consult a financial advisor',
        ],
      },
    },
  },

  // ── 6. Crédito e Hipoteca ──────────────────────────────────────────────────
  'credito-hipoteca': {
    title:    'Credit and Mortgages — Essential Guide',
    subtitle: 'How to evaluate a home loan, TAEG, spread and avoid traps in instalment purchases',
    certificate: {
      title:       'Certificate in Credit and Financing',
      description: 'Masters the concepts of TAN, TAEG, spread, amortisation and knows how to evaluate home-loan and consumer-credit offers in Portugal.',
    },
    lessons: {
      l1: {
        title:   'TAN, TAEG and spread — what you\'re really paying',
        content: `Every loan has three rates. Confusing them can cost you thousands of euros.

**TAN — Nominal Annual Rate (Taxa Anual Nominal)**
The "raw" interest the bank charges on outstanding capital. In home loans, it's made up of:
→ **Indexante** (variable) — Usually Euribor at 3/6/12 months
→ **Spread** (fixed) — The bank's margin. Negotiable.

TAN = Euribor + Spread. If the 6-month Euribor is 3.2% and the spread is 1.0%, the TAN is 4.2%.

**TAEG — Effective Annual Rate (Taxa Anual Efectiva Global)**
The rate that **includes everything**: interest, fees, mandatory insurance, taxes. The only number that actually tells you the total cost.

**Real example:**
Bank A: TAN 3.5%, TAEG 4.8%
Bank B: TAN 3.8%, TAEG 4.2%

Which is better? **Bank B** — despite the higher TAN, the effective cost is lower because it has fewer fees and cheaper insurance.

**Always compare by TAEG, never by TAN.** Banks sometimes advertise an attractive TAN and claw it back in the TAEG.

**TAER — Revised Effective Annual Rate**
Shows up on variable-rate credit. Simulates cost assuming the index moves up/down. It's a scenario, not a commitment.`,
      },
      l2: {
        title:   'Home loans — negotiating spread and insurance',
        content: `A home loan is the biggest financial decision most people ever make. 25-30 years of commitment. Each 0.1% of spread × €200,000 × 30 years costs **about €3,000**.

**How to negotiate the spread:**
1. **Request offers from 3-5 banks** at the same time (force competition)
2. **Show Bank A the offer from Bank B** — they often match or beat it
3. **Use certified credit intermediaries** — they often get better spreads than branch-level
4. **Premium profiles** (young, regulated professions, loyalty) get spreads 0.3-0.6% better

**Typical spreads 2025-2026:**
→ Best profile: 0.70-0.90%
→ Average profile: 1.00-1.30%
→ Risk profile: 1.50%+

**Associated insurance — where you lose money:**
The bank almost always requires:
→ Life insurance (mandatory)
→ Multi-risk home insurance (mandatory)

**You can buy these insurances OUTSIDE the bank**. Usually you save **30-50%** on annual premium. The bank may try to condition you (e.g. spread 0.1% higher if you don't take their internal insurance) — run the numbers:

External insurance saving: €300/year
Cost of 0.1% higher spread: €200/year on €200,000
→ External is worth it → you save €100/year × 30 years = €3,000

**Debt-to-income (taxa de esforço):**
Your monthly payment shouldn't exceed **35%** of take-home pay. Above that, any surprise (car repair, temporary unemployment) tips you into crisis.`,
      },
      l3: {
        title:   'Instalment purchases — the hidden trap',
        content: `"Only €49/month" sounds affordable. But **€49/month × 48 months = €2,352** — for a phone whose cash price is €1,500.

**The real cost of instalments:**
Sellers are incentivised to talk in €/month because it hides the total cost. Always calculate:

Instalment × number of months = **Total cost**
Total cost − cash price = **Interest paid**

**Example — smartphone:**
→ Cash price: €1,200
→ 24 instalments of €60 = €1,440
→ Interest: €240 (20% of the price)

You paid for a phone that costs €1,200 as if it cost €1,440. To the manufacturer, it's the same phone.

**When do instalments make sense?**
→ **Real** 0% interest (check the TAEG, not just the advertised "0%")
→ Free cash could earn more than the loan rate
→ Emergency — a temporary payment beats not having the essential item

**When it DOESN'T make sense:**
→ Buying depreciating goods (electronics, cars) on long-term instalments
→ Any TAEG above 10%
→ When the extra spend would matter in the current monthly budget
→ Stacking multiple instalments at once (loss of control)

**The 3-week rule:**
Before signing up for instalments above €500, wait 3 weeks. Most of the desire fades. What remains is a deliberate decision, not an impulse.

**Personal loan vs credit card:**
→ Credit card: 15-22% TAEG
→ Personal loan: 7-12% TAEG
→ Additional mortgage: 4-5% TAEG

Never use a credit card as long-term financing. Always pay the full monthly balance.`,
      },
      l4: {
        title:   'Pay down or invest? The critical decision',
        content: `You have €10,000 spare. Do you pay down the mortgage or invest? One of the most debated decisions in personal finance.

**Mathematical analysis:**
→ Loan rate (TAEG): 4.5%
→ Expected investment return: 7%
→ Difference: 2.5% a year in favour of investing

**But maths isn't everything:**

**Arguments FOR PAYING DOWN:**
✓ "Guaranteed" return equal to the loan rate (4.5% risk-free)
✓ Reduces financial risk in unemployment scenarios
✓ Psychological freedom — killing debt brings peace of mind
✓ Cuts total interest paid to the bank

**Arguments FOR INVESTING:**
✓ Higher historical expected return (7%+ vs 4.5%)
✓ Keeps liquidity — prepaid capital doesn't come back easily
✓ Diversification — not all "eggs" in the property
✓ Tax benefits (PPR benefit, lower interest on deduction)

**The hybrid answer (most sensible for most people):**
→ **50% pay down** — reduces capital and makes it psychologically lighter
→ **50% invest** — keeps market exposure and liquidity

**When to definitely pay down:**
→ TAEG > 5%
→ Approaching retirement (cut commitments)
→ Very risk-averse profile

**When to definitely invest:**
→ TAEG < 3%
→ 15+ year horizon
→ You already have an emergency fund + max out PPR

**Costs of prepaying in Portugal:**
→ Fixed-rate mortgage: prepayment fee up to 2%
→ Variable-rate mortgage: max fee 0.5% (by law)
→ Partial prepayments typically reduce the instalment (and/or the term)

Always simulate at the bank: "what's the new instalment if I prepay €10,000 and keep the term?" vs "what's the new term if I prepay €10,000 and keep the instalment?"`,
      },
    },
    quiz: {
      q1: {
        text: 'When comparing home-loan offers, which rate should you use?',
        options: ['TAN', 'TAEG', 'Euribor', 'Spread alone'],
      },
      q2: {
        text: 'What\'s the maximum recommended debt-to-income ratio for a home loan?',
        options: ['25% of take-home pay', '35% of take-home pay', '50% of take-home pay', 'No limit'],
      },
      q3: {
        text: 'A smartphone costs €1,200 cash or 24 × €60 = €1,440. What\'s the approximate TAEG?',
        options: ['0% — same price', 'About 20%', 'About 5%', 'Exactly 10%'],
      },
      q4: {
        text: 'The insurance associated with a home loan:',
        options: [
          'Must be taken out with the lending bank',
          'Can be bought outside the bank — often with 30-50% savings',
          'Is not mandatory',
          'Always costs the same at every bank',
        ],
      },
      q5: {
        text: 'When does it make more sense to pay down debt rather than invest?',
        options: [
          'Always — paying down is always better',
          'When the loan\'s TAEG exceeds the expected investment return',
          'Only after age 50',
          'Never — investing is always better',
        ],
      },
    },
  },

  // ── 7. Cripto, Blockchain e DeFi ───────────────────────────────────────────
  'cripto-avancado': {
    title:    'Crypto, Blockchain and DeFi',
    subtitle: 'Bitcoin, self-custody, swaps and DeFi — master decentralised money',
    certificate: {
      title:       'Certificate in Crypto and DeFi',
      description: 'Understands blockchain, Bitcoin, self-custody with hardware wallets, DEXs, L2s and DeFi protocols — with clear awareness of risks and Portuguese taxation.',
    },
    lessons: {
      l1: {
        title:   'Bitcoin and Blockchain — the fundamentals',
        content: `Blockchain is a public, distributed ledger: thousands of computers (nodes) hold the same copy of the transaction history, validate new operations by consensus, and make it practically impossible to rewrite the past. No middleman required — the agreement is mathematical.

**Bitcoin (BTC) — the first use case:**
→ Created in 2009 by Satoshi Nakamoto (pseudonym, identity unknown to this day)
→ Fixed maximum supply: **21 million** BTC (~19.8M already mined by 2026)
→ **Proof of Work** — miners compete solving SHA-256 hashes; the winner validates the block and gets new BTC
→ **Halving** every ~4 years: miner reward cuts in half. The last one was in 2024 (3.125 BTC/block). Next in 2028.

**Why it's called "digital gold":**
→ Programmed scarcity (can't be inflated by decree)
→ Censorship-resistant (no government can delete your wallet)
→ Portable (memorise 12 words and you cross borders)
→ Divisible (1 BTC = 100 million satoshis)

**What Bitcoin is NOT:**
❌ A "guaranteed investment" — it dropped 80% in 2018 and 2022
❌ "Fast for payments" — ~7 tx/second, 10-60 min confirmation (which is why L2s exist)
❌ "Anonymous" — it's *pseudonymous*. The whole history is public; only your real name doesn't appear naturally

**The rest of the ecosystem:**
→ **Ethereum (ETH)** — a blockchain with smart contracts (self-executing programs). The base layer of DeFi and NFTs. Moved to Proof of Stake in 2022
→ **Stablecoins (USDC, USDT)** — tokens pegged to the dollar. Useful for holding value without volatility
→ **Solana, Avalanche, etc.** — fast alternative blockchains with decentralisation trade-offs

**Practical rule:** don't put money into crypto you can't afford to lose. A sensible allocation in your overall portfolio is **0–10%**, never more.`,
      },
      l2: {
        title:   'Wallets and self-custody — "not your keys, not your coins"',
        content: `In crypto, money isn't "in an account" — it's at a blockchain address, controlled by a **private key**. Whoever holds the key holds the funds. Full stop.

**Custodial vs self-custody:**
→ **Custodial (Binance, Coinbase, Kraken, exchanges)** — They hold the key. Like money at a bank. Convenient, but **you depend on them** (see FTX 2022 — millions lost everything)
→ **Non-custodial (self-custody)** — The key is with you. You are the bank. No third parties, no freezes — but also no "I forgot my password, please reset"

**Seed phrase — the backup that is worth everything:**
When you create a wallet, you get 12 or 24 words (BIP-39 standard). This phrase **derives** every private key and address. Whoever has the seed has the wallet.

**Golden rules for the seed phrase:**
✅ Write it on paper (or steel, for fire/water) in 2 copies, stored in different places
✅ Never type it on an online computer, photo, cloud, email or phone notes
✅ Never share it with anyone — not even "official" tech support asks for it
❌ #1 phishing in crypto: sites asking for your seed phrase → **always a scam**

**Hot wallets (internet-connected):**
→ MetaMask, Phantom, Rabby, Trust Wallet — mobile apps / browser extensions
→ Ideal for: small amounts, daily use, DeFi, NFTs
→ Risk: malware, phishing, malicious sites

**Cold wallets (hardware, offline):**
→ **Ledger Nano S Plus / X** (~€80-150) — the most popular
→ **Trezor Safe 3 / 5** (~€80-180)
→ **BitBox02**, **Coldcard** (Bitcoin-only)

The private key never leaves the device. Even with an infected computer, you physically confirm every transaction on the hardware's button/screen.

**The 3-tier rule:**
→ **Exchange** — only what you need to buy/sell (active trading)
→ **Hot wallet** — money you use in DeFi/NFTs (small to medium amount)
→ **Cold wallet** — long-term savings ("the vault")

If you have more than **€2,000 in crypto**, a hardware wallet isn't a luxury — it's mandatory.`,
      },
      l3: {
        title:   'Swaps, DEXs and Layer 2 — trading without an intermediary',
        content: `To trade crypto for crypto, you have two roads: **CEX** (centralised exchange) or **DEX** (decentralised).

**CEX — Centralized Exchange:**
→ Binance, Coinbase, Kraken, Kucoin
→ Familiar interface (limit orders, spot, margin)
→ Fast and cheap on fees
→ But: mandatory KYC, custody on the exchange, account can be frozen, bankruptcy risk (FTX, Celsius)

**DEX — Decentralized Exchange:**
→ Uniswap, PancakeSwap, Jupiter (Solana), Curve (stables)
→ You keep custody (you connect a wallet, you never deposit)
→ No KYC
→ Price via **liquidity pools** (AMM) — not an order book

**Key concepts in a DEX swap:**

🔸 **Slippage** — difference between expected price and executed price. In small pools or large trades it can be 1-5%+. Set a tolerance (e.g. 0.5%).

🔸 **Gas fees** — paid to the blockchain to process the tx. On Ethereum L1 it can be €5-50. On L2s it's €0.05-0.50.

🔸 **MEV / front-running** — bots that spot your tx and jump ahead to profit. Use routers with protection (1inch, CowSwap) or private RPCs.

🔸 **Approvals** — before swapping an ERC-20 token you have to "approve" the contract to move your tokens. Revoke old approvals at **revoke.cash**.

**Layer 2 — the answer to Ethereum's slowness/cost:**
L2 processes transactions off L1 and then batches them onto L1. Result: same Ethereum security, a fraction of the cost.

→ **Arbitrum, Optimism, Base** (Optimistic Rollups) — more mature, L1 withdrawals take ~7 days
→ **zkSync, Starknet, Linea** (ZK Rollups) — mathematically proven, fast withdrawals
→ **Lightning Network** — Bitcoin L2 for instant micropayments (coffee, tips)

**Typical flow for a sensible user:**
1. Buy ETH/USDC on a CEX (Coinbase, Kraken)
2. Withdraw to a hardware wallet (on-chain, L1)
3. Bridge to an L2 (Arbitrum/Base) using the official bridge
4. Use a DEX on the L2 with low gas

**Bridges — the riskiest point of the ecosystem.** Billions have been hacked (Ronin, Wormhole, Nomad). Use only official bridges, never links from Discord/Twitter.`,
      },
      l4: {
        title:   'DeFi — real opportunities and real risks',
        content: `DeFi (Decentralized Finance) replicates banking services in smart contracts: loans, interest, swaps, derivatives — all without a bank.

**Main categories:**

**1. Lending/Borrowing — Aave, Compound, Morpho**
You deposit USDC and earn interest (~3-8% APY). Others borrow with over-collateralised crypto (e.g. deposit €1,500 of ETH to borrow €1,000 USDC). If ETH drops too much, the system auto-liquidates the collateral.

**2. Staking — ETH, SOL, ATOM**
Lock up crypto to validate the blockchain (PoS) and receive rewards (3-7% APY for ETH via Lido, Rocket Pool). Risk: lockup period, slashing (the validator can be penalised).

**3. Liquidity Providing (LP)**
You deposit 2 tokens in a pool (e.g. ETH/USDC) and earn a share of the fees. Watch out for **impermanent loss**: if the token prices diverge a lot from deposit time, you can exit with less value than if you had simply held (HODL).

**4. Yield aggregators — Yearn, Beefy, Pendle**
Automate yield strategies. Higher APY, but higher complexity and risk.

**5. Stablecoin yields**
USDC/USDT on Aave, sUSDe, etc. — 4-10% APY. "Safer" than LP but not *without* risk (see UST/Luna in 2022 — algorithmic stablecoin collapsed to €0 in days).

**The real (not abstract) risks:**

🔴 **Smart contract exploits** — bugs in the code. Poly Network €600M, Euler €200M, Curve, Multichain. Even audited code can fail.

🔴 **Rug pulls** — the project drains liquidity and vanishes. Very common in memecoins and new pools. Check: is the contract verified? Is liquidity locked? Is the dev doxxed?

🔴 **Oracle manipulation** — attackers manipulate the price the protocol reads and drain funds.

🔴 **Governance attacks** — taking over DAO votes to pass malicious proposals.

🔴 **Advanced phishing** — fake sites identical to Uniswap/Aave, malicious approvals. Always use a bookmark, never Google Ads.

**Immediate red flags:**
❌ "Sustainable" APY above 20% on stablecoins → unsustainable by definition
❌ "Double your BTC" → scam, always
❌ Anonymous team + no audit + low TVL → deadly combo
❌ Time pressure ("today only", "last spots") → scam

**Crypto taxation in Portugal (since 2023):**
→ Capital gains on crypto **held less than 365 days → taxed at 28%**
→ Held **more than 365 days → exempt** (provided it's not professional activity)
→ Crypto-to-crypto swaps **don't trigger a taxable event** until you cash out to fiat
→ Staking/lending income → category E, 28% (or aggregate)
→ Declared on Anexo G (capital gains) and Anexo J (foreign income, if the exchange is outside PT)

**Pragmatic conclusion:**
DeFi is one of the most innovative areas in finance. It's also the most hostile to amateurs. Start with stablecoins on top-5 TVL protocols, small amounts, and scale exposure only as you truly understand each risk. The best defence isn't diversification — it's **not putting in what you can't afford to lose**.`,
      },
    },
    quiz: {
      q1: {
        text: 'What does "not your keys, not your coins" mean?',
        options: [
          'If you don\'t hold the private keys (or seed phrase), you don\'t really control your funds — you depend on a third party',
          'That you need to buy several different wallets',
          'That Bitcoin has no real value',
          'That only hardware wallets are safe',
        ],
      },
      q2: {
        text: 'What is the Bitcoin halving?',
        options: [
          'A 50% price drop that happens every year',
          'The halving of the miner reward, every ~4 years',
          'A bug in the protocol',
          'A blockchain upgrade to make it faster',
        ],
      },
      q3: {
        text: 'What is the main advantage of a Layer 2 (Arbitrum, Optimism, Base)?',
        options: [
          'It\'s a completely independent blockchain, unrelated to Ethereum',
          'Much cheaper and faster transactions, inheriting L1 security',
          'It lets you mine even without specialised hardware',
          'It removes the need for a wallet',
        ],
      },
      q4: {
        text: 'What is "impermanent loss"?',
        options: [
          'Losing the seed phrase and being unable to recover the wallet',
          'A temporary loss that happens when Bitcoin\'s price drops',
          'Loss of value in a liquidity pool when the two tokens\' prices diverge from deposit time',
          'The cost of gas fees in congestion periods',
        ],
      },
      q5: {
        text: 'In Portugal, capital gains on crypto held for more than 365 days:',
        options: [
          'Are taxed at 28% like any other',
          'Are exempt from IRS (provided it isn\'t professional activity)',
          'Pay 48% at the top bracket',
          'Never need to be declared',
        ],
      },
    },
  },
}
