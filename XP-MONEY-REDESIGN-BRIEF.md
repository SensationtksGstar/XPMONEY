# XP-Money — Design Extraction & Apple-Style Redesign Brief

> **Purpose of this document.** It is a self-contained *design pack* extracted from the real production codebase of XP-Money. Hand it to any design-focused AI (or designer) to redesign the product toward a calmer, clearer, more "Apple-like" feel — **especially on mobile, which currently feels cluttered and confusing.** Everything below is pulled from the actual code (Tailwind config, `globals.css`, layout & component source), not guessed.

---

## 0. TL;DR — what to change and why

The app is well-built and feature-rich, but its visual language is **"gamified neon dark glassmorphism"**: one loud green used for *everything*, colored glows on icons/buttons, gradient text, and — on mobile — a home screen that stacks **~18–20 widgets** and a bottom nav that surfaces only **3 destinations** while burying **13 features** behind a "More" drawer. That density + decoration is the opposite of Apple restraint.

**The redesign goal in one line:** *keep the brand soul (the mascots + a single green accent) but strip the noise — fewer things per screen, one clear hierarchy, generous whitespace, neutral depth instead of neon glow, and a navigation a first-time user can read at a glance.*

The five highest-impact moves:
1. **Demote green to an accent.** Today it borders every card, tints every active icon, and glows. Apple uses one accent *sparingly* — most chrome is neutral gray.
2. **Kill the glows.** Remove colored `drop-shadow`/`box-shadow` halos on icons, FAB, logo. Replace with soft neutral shadows + hairline borders.
3. **Simplify the mobile home.** From ~20 stacked sections to a focused glance (hero metric → period summary → recent activity → one CTA). Everything else lives on its own screen.
4. **Fix the navigation & labels.** Group the buried features into a structured menu; fix the "Contas" label collision; remove competing add-buttons; take the language toggle out of the top bar.
5. **Establish real scales.** A strict type scale, an 8-pt spacing rhythm, and semantic surface layers instead of ad-hoc `white/3` · `white/5` · `white/10`.

---

## 1. Product context (so design decisions fit the product)

- **What it is:** a finance-gamification **PWA** — users log transactions, a financial *score* climbs, a *mascot evolves*, and XP/badges/missions/courses unlock. Core loop is habit-forming money tracking made playful.
- **Audience:** Portuguese consumers (bilingual **PT-PT default + EN-US**), **mobile-first**, mostly mid-range Android + iPhone. Solo-founder product, early stage.
- **Brand soul:** two collectible mascots — **Voltix** (thunder dragon, male) and **Penny** (angel cat, female), each with 6 evolutions. This is the genuine differentiator and must be *preserved and celebrated* — just presented cleanly, not buried among a dozen widgets or wrapped in neon.
- **Tone target:** premium, calm, trustworthy (it handles people's money) but still warm and game-like. Think **Apple Wallet / Fitness / Health**, not a neon crypto dashboard.

### Hard technical constraints the redesign MUST respect
- **Next.js 15 (App Router) · React 19 · TypeScript strict.**
- **Tailwind CSS 3.4** utility classes + **Radix primitives** + **lucide-react** icons + **framer-motion** + **recharts**. Stay within this stack — do **not** propose a rewrite to another framework or CSS system.
- **Dark theme only** (no light mode today).
- **i18n:** every string comes from `useT()` / translation keys (`src/lib/i18n/translations.ts`). Never hardcode copy; keep keys stable.
- **Performance budget:** mobile-first. Heavy widgets (recharts, framer-motion) are `dynamic()`-imported with skeletons — keep that discipline; don't pull heavy libs into the initial bundle.
- **Accessibility floor:** touch targets ≥ 44×44 px; `aria-label` on icon-only buttons; dialogs use `role="dialog"`/`aria-modal`; respect `prefers-reduced-motion`.
- **PWA:** safe-area insets (`env(safe-area-inset-*)`) already handled — keep them.

---

## 2. The problem, with evidence (why mobile "feels confusing")

All of the following is confirmed in code.

### 2.1 Navigation buries almost everything
- The mobile **bottom nav** (`src/components/layout/MobileNav.tsx`) is a 5-cell grid: **[Início] [Transações] [＋ FAB] [Objetivos] [Mais]** — only **3 real destinations** + an add button + "More".
- **13 features** live in the desktop sidebar; on mobile **10 of them are dumped into a flat 3×3 "Mais" bottom-sheet**: Contas (net worth), Orçamento, Cursos, Missões, Dívidas, Voltix, Badges, Perspetiva, Simulador, Definições. Core money features (Orçamento, Dívidas, Contas) are **2 taps + an animation deep** and easy to never discover.
- **Label collision (real):** the bottom-nav item that opens `/transactions` is labelled **"Contas"** (`nav.transactions_short` = *Contas* / *Accounts*), while the actual accounts/net-worth page `/contas` is labelled **"Património"** (`nav.networth`). So "Contas" doesn't go to your accounts. The desktop sidebar calls the same `/transactions` item **"Transações"** — inconsistent across breakpoints.

### 2.2 The mobile home screen is overloaded
`src/app/(app)/(dashboard)/dashboard/page.tsx` stacks, in order on mobile: header → streak banner → period filter → quick-actions (3 buttons) → pro-tools teaser (3 locked cards) → upgrade banner → Voltix hero + expense breakdown → financial score → XP bar → monthly summary → net-worth → spending velocity → biggest expenses → recurring expenses → cash-flow chart → debt widget → **ad banner** → missions preview → recent transactions → **second ad banner**. That's **~18–20 sections, ~3000–3500 px of scroll (8–9 viewport heights)** before a user reaches their recent transactions, past **two ad units** and several upsell blocks.

### 2.3 Competing calls-to-action for the same job
"Add a transaction" is offered by **three** surfaces at once: the green **FAB** in the bottom nav, the **QuickActions** 3-card row (Expense/Income/Savings), *and* a header "Add" button on ≥sm. Decision friction.

### 2.4 Decoration outweighs content
- **Green is used for everything:** CTAs, every active nav icon, most card borders (`border-green-500/20`), positive states, XP. There is no neutral resting state, so nothing stands out.
- **Neon glows everywhere:** icon `drop-shadow-[0_0_8px_rgba(34,197,94,0.6)]`, FAB `box-shadow: 0 0 24px rgba(34,197,94,0.45)`, logo green drop-shadow, DragonCoin FAB double green glow + `animate-ping` halo, score-ring glow, CTA `shadow-[0_12px_40px_-15px_rgba(34,197,94,0.6)]`.
- **Gradient text** (`from-green-400 to-emerald-300 bg-clip-text`) and a live **WebGL "neon grid" wallpaper** behind content on desktop. All of it competes with the data.

### 2.5 Chrome clutter in the top bar
Mobile `TopBar` right side crams **four** controls: Language toggle · Upgrade badge (which *vanishes* below 375 px) · Notification bell · Avatar. Language switching does not belong in the top chrome.

---

## 3. Current design system (the extracted "construction")

### 3.1 Color tokens
**CSS variables** (`src/app/globals.css`, HSL):

| Token | Value (HSL) | ≈ Hex | Role |
|---|---|---|---|
| `--background` | `222 47% 6%` | `#0a0e17` | app base (very dark desaturated navy) |
| `--card` | `222 47% 9%` | `#0f1420` | card surface |
| `--foreground` | `210 40% 98%` | `#f8fafc` | primary text |
| `--muted-foreground` | `215 20% 55%` | `#7c8aa0` | secondary text |
| `--primary` | `142 71% 45%` | `#22c55e` | green — accent/CTA |
| `--secondary` / `--muted` / `--border` / `--input` | `217 33% 17%` | `#1e293b` | borders, inputs, muted fills |
| `--destructive` | `0 84% 60%` | `#ef4444` | danger |
| `--ring` | `142 71% 45%` | `#22c55e` | focus ring |
| `--radius` | `0.75rem` | 12px | base radius |

**Brand & semantic palette** (`tailwind.config.ts`):
- `brand.50…950` — green ramp, `brand.500 = #22c55e` primary.
- `xp` — `gold #f59e0b`, `silver #94a3b8`, `bronze #cd7c2c`, `purple #8b5cf6`, `blue #3b82f6`.
- `score` — `critical #ef4444` (0-39) · `low #f97316` (40-59) · `medium #eab308` (60-74) · `good #22c55e` (75-89) · `elite #8b5cf6` (90-100).
- Ad-hoc surfaces in components: `white/3`, `white/5`, `white/8`, `white/10` (no named scale).
- Premium = **purple** (`purple-500/400`), gradients `from-purple-500 to-pink-500`.
- Raw near-black hexes used directly in chrome: `#060b14`, `#0a0f1e`, `#0d1221`, `#0f1829`.

### 3.2 Typography
- **Sans:** `Inter` (system-ui fallback). **Mono:** `JetBrains Mono`.
- Weights in use: **400 / 600 / 700 / 900** (900 "black" on score values & hero — reads gamey).
- Sizes are **ad hoc**, from `text-[9px]`/`text-[10px]` (nav labels, hints — *too small*) up to `text-4xl`/`text-5xl` (hero). No defined scale.
- `tracking-tight` on logos/headings; `tabular-nums` on numbers (good).

### 3.3 Spacing, radius, depth
- **Spacing:** 4-px base; gaps `gap-2/3/4`; card padding `p-5/p-6/p-8`; section rhythm inconsistent (landing `px-6 py-24`/`py-16`; app `space-y-*` varies).
- **Radius:** `lg 8px` · `xl 12px` (most cards/buttons) · `2xl 16px` (modals/panels) · `3xl 24px` (celebration) · `full` (pills/FAB). Mostly consistent.
- **Depth:** almost no neutral shadows — depth comes from `backdrop-blur` + `border-white/10`. Accent depth is **colored glow** (the thing to remove).

### 3.4 Signature classes & motion (`globals.css`)
- `.glass-card` = `bg-white/5 backdrop-blur-md border border-white/10 rounded-xl` — the ubiquitous card material.
- `.dashboard-bg` = radial green 8% (top-left) + radial purple 6% (bottom-right) over `--background`.
- `.badge-common/rare/epic/legendary` = slate/blue/purple/yellow rarity tints.
- Motion: `fade-in-up` (0.4s), `slide-up` (0.32s, `cubic-bezier(0.32,0.72,0,1)` — nicely Apple-ish), `slide-up-fast` (0.18s), `fade-in` (0.14s); confetti + mascot idle loops; all gated by `prefers-reduced-motion`.
- Site-wide **WebGL "neon grid" wallpaper** (`SiteBackground`) on `(min-width:1024px) and (pointer:fine)`; static CSS gradient fallback on mobile.

### 3.5 Component inventory (shared UI, reuse these — don't rebuild)
`src/components/ui/`, `common/`, `layout/`:
- **Logo** (`/app-icon.webp` + optional wordmark; has green drop-shadow), **Spinner** (`xs–lg`, tones light/dark/brand), **EmptyState** (icon/title/desc/action, `tone default|subtle`), **ConfirmDialog** (`tone danger|warning|info`; bottom-sheet on mobile → centered on desktop), **CelebrationModal** (`role=alertdialog`, confetti + auto-close bar), **CategoryIcon** (squircle `rounded-2xl`, color at ~14% bg / 22% border), **NotificationPanel** (bell + XP history), **Toaster** (`success|error|info|xp`), **AdBanner** (`feed|banner`, null for paid), **PremiumFeatureLock** (blurred faux-preview + purple lock card), **DragonCoinFAB** (chat assistant, green-glow), **LanguageToggle** (PT/EN segmented pill).
- **Layout:** `Sidebar` (desktop, 264px, 13 items + premium CTA), `TopBar` (mobile sticky), `MobileNav` (bottom nav + FAB + More sheet).
- **Dashboard cards:** FinancialScoreCard (score ring), XPProgressBar, NetWorthWidget, StreakBanner, QuickActions, RecentTransactions, plus dynamically-imported MonthlySummary / ExpenseBreakdown / BiggestExpenses / CashFlowChart / SpendingVelocity / RecurringExpenses / DebtWidget / VoltixWidget / MissionCard.

### 3.6 Information architecture (routes)
- **Primary (daily):** `/dashboard`, `/transactions`, `/goals`.
- **Money:** `/contas` (net worth), `/orcamento` (budget), `/dividas` (debt, Premium).
- **Progress/gamification:** `/missions`, `/badges`, `/voltix` (pet), `/cursos` (academy, Premium).
- **Premium tools:** `/perspetiva` (wealth projection), `/simulador` (scenario).
- **Account:** `/settings`, `/settings/billing`.
- **Public:** `/` (landing — **13 stacked blocks**: nav, hero, how-it-works, features, mascot showcase, advantages, outcomes, comparison, reviews, FAQ, pricing, newsletter, final-CTA, footer), `/blog`, `/contacto`, legal pages.

---

## 4. The Apple-style target (principles → apply these)

Apple's design DNA, translated to this product:

1. **Deference — content over chrome.** The UI recedes so the user's money data is the hero. Remove decoration that doesn't carry meaning (glows, gradient text, the busy wallpaper on data screens).
2. **Clarity — one idea per screen, one primary action.** Ruthless hierarchy: a single hero element, then a calm stack. Large, legible type. No competing CTAs.
3. **Depth via material, not neon.** Layered translucent surfaces + soft *neutral* shadows communicate elevation. Colored halos are out.
4. **Restraint with color.** One accent (green), used only for the primary action and the single most important positive signal. Everything else is a neutral gray scale. Semantic colors (red/orange/etc.) appear only when semantically required.
5. **Generous whitespace & rhythm.** Consistent 8-pt spacing; breathing room between groups; fewer items visible at once (progressive disclosure).
6. **Typographic hierarchy does the work.** A strict scale; weight and size (not color or boxes) establish importance. Apple's "large title" pattern for screen headers.
7. **Calm, physical motion.** Subtle, spring-based transitions (the existing `slide-up` easing is already right); no theatrical glows/confetti as default.

**Keep the personality:** this is a *game* about money — so keep the mascots, the streak, XP, badges. Just make them **quiet by default and delightful on the moments that matter** (a level-up, hitting a goal), rather than shouting on every screen.

---

## 5. Concrete redesign direction

Framed as decisions + DO/DON'T. Specific token *starting points* are given for the design AI to refine — not rigid law.

### 5.1 Color — calm the palette
- **Introduce a neutral surface scale** (Apple systemGray-style, layered) and use it for 90% of chrome. Suggested dark layers over `#0a0e17`:
  - `surface-0` base `#0a0e17` · `surface-1` `#12161f` · `surface-2` `#1a1f2a` · `surface-3` `#242a37`; hairline border `rgba(255,255,255,0.08)`; dividers `rgba(255,255,255,0.06)`.
  - Replace ad-hoc `white/3·5·8·10` with these named layers so elevation is consistent.
- **Green becomes accent-only.** DO: green for the primary button on a screen, the single key positive number, focus ring. DON'T: green borders on every card, green tint on every active icon (use white/neutral for active states, reserve green for *the* primary).
- **Text scale:** primary `rgba(255,255,255,0.92)`, secondary `~0.60`, tertiary `~0.40`. Stop at 3 levels; avoid `white/20`-and-below for anything readable.
- **Semantic colors stay** for finance meaning (income green, expense red/rose, transfer blue, score ramp) but **desaturate slightly** so they read premium, not primary-crayon.

### 5.2 Depth — remove the neon
- **DELETE** colored glows: icon `drop-shadow-[0_0_*px_rgba(34,197,94,…)]`, FAB `box-shadow:0 0 24px …`, DragonCoin double-glow + `animate-ping`, logo green drop-shadow, CTA green shadow, score-ring glow.
- **REPLACE** with neutral elevation: e.g. cards `shadow-[0_1px_2px_rgba(0,0,0,0.4)]` + hairline border; raised elements a slightly larger soft neutral shadow. Let translucency + border do most of the work.
- **Tone down the wallpaper:** on data-dense screens (dashboard, lists) drop the neon grid to a near-flat calm surface; keep a *subtle* signature backdrop only on marketing/hero and empty states.

### 5.3 Typography — a strict scale
Define roles (Inter is fine — SF-adjacent):

| Role | Size / line-height | Weight |
|---|---|---|
| Large title (screen header) | 30–34 / 1.1 | 700 |
| Title | 22–24 / 1.2 | 600 |
| Headline (card) | 17 / 1.3 | 600 |
| Body | 15–16 / 1.4 | 400 |
| Subhead / secondary | 13 / 1.35 | 400–500 |
| Caption / label | 12 / 1.3 | 500 |

DO: adopt Apple's **large-title screen header** (big bold title top-left, content below). DON'T: use `text-[9px]/[10px]` for nav labels (bump to 11–12 min); DON'T use weight-900 as decoration (cap at 700 for hero numbers).

### 5.4 Spacing — 8-pt rhythm & breathing room
- Standardize on a 4/8/12/16/24/32/48 scale. Card padding `16` (compact) / `20` (standard). Between-group gaps `24–32`. Screen side padding `20` on mobile.
- **More vertical air** between sections; fewer sections per screen (see 5.6).

### 5.5 Navigation — the mobile fix (highest priority)
- **Fix labels first (quick win):** the `/transactions` tab must read **"Movimentos"** (or "Transações"), never "Contas". Reserve *Contas*/*Património* for `/contas`. Make mobile & desktop labels identical.
- **Rethink the bottom tab bar** as ~4–5 *stable, meaningful* destinations matching the user's mental model, e.g.: **Início · Movimentos · ＋ · Metas · Mais.** (Roughly current, but correctly labelled.) If Orçamento or Contas is truly daily-use, consider promoting one and folding gamification into a single "Progresso" hub.
- **Restructure the "Mais" sheet into labelled groups** instead of a flat 3×3 of 10 icons:
  - *Dinheiro:* Contas · Orçamento · Dívidas
  - *Progresso:* Missões · Conquistas · Voltix · Academia
  - *Ferramentas (Premium):* Perspetiva · Simulador
  - *Conta:* Definições
  Grouped lists with section headers read instantly; a wall of equal icons does not.
- **One add action.** Keep the FAB as the single global "add", and **remove the QuickActions triple-card** from the home (or vice-versa — but not both). Drop the redundant header "Add" on ≥sm.
- **Declutter the TopBar:** move the **language toggle into Settings** (Apple keeps language in settings, not chrome). Keep top bar to: screen title (large-title pattern) · notifications · avatar. Reconsider the always-present upgrade badge — surface upgrade at *contextual* moments (paywalls, settings) rather than as permanent chrome.
- **Give secondary screens a clear header + back affordance** (large title + back chevron), so they feel connected, not orphaned.

### 5.6 Dashboard — progressive disclosure (second priority)
Cut the home from ~20 sections to a focused **glance**, roughly:
1. **Header** — greeting + large title (+ streak as a small inline chip, not a full banner).
2. **One hero** — the Financial Score *or* Net Worth as a single confident card (pick the primary; link to the other). The mascot gets its clear moment here.
3. **This-period summary** — income / expense / savings, one tidy card, with the period control.
4. **Recent activity** — last 4–5 transactions + "Ver tudo".
5. **One contextual nudge max** — a single upsell OR a single ad at the very bottom, not two ad banners + teaser + upgrade banner.

Move charts (cash flow, velocity, biggest expenses, breakdown), missions preview, and pro-tool teasers to their **own screens** or behind a "Ver mais" expansion. Rule of thumb: **the home should fit in ~2–3 screen heights, not 9.**

### 5.7 Components — refinements (keep the APIs)
- **glass-card:** keep as the base material but map it onto the new surface scale + neutral shadow (drop the green-tinted borders as a default; green border only for *the* selected/primary item).
- **Buttons:** one primary (solid green, black text) per screen; secondaries neutral (`surface-2` + hairline). Consistent height (44px), radius (12px), weight (600).
- **CelebrationModal / streak / XP:** keep, but make the *default* presentation quiet; save confetti/motion for genuine milestones. Cap black (900) weights.
- **PremiumFeatureLock:** good pattern; align its purple to the calmer palette and reduce blur theatrics.
- **CategoryIcon, Toaster, ConfirmDialog, EmptyState, Spinner:** already clean and Apple-adjacent — keep; just inherit the new tokens.

### 5.8 Landing page — tighten
13 stacked blocks is a lot. Consolidate toward a tighter Apple-marketing rhythm: a spacious hero (mascot as the star), 3–4 strong product moments (how-it-works + the 2–3 best features + mascot evolution), social proof, pricing, CTA, footer. Fold FAQ/advantages/comparison/outcomes into fewer, denser sections. One accent, lots of whitespace, big type.

---

## 6. What to preserve (don't "redesign away")
- The **two mascots** and their evolutions — the brand's heart. Present them cleanly and give them spotlight moments.
- The **single green identity** (just used with restraint).
- **Gamification mechanics** (score, XP, streak, badges, missions) — keep, quiet by default.
- **Working foundations:** safe-area handling, 44px touch targets, i18n via `useT()`, `dynamic()` performance discipline, `prefers-reduced-motion`, the tasteful `slide-up` easing, the component library's clean APIs.

---

## 7. Constraints for whoever implements this
- Stay in **Tailwind 3.4 + Radix + lucide + framer-motion + recharts**. No framework/CSS-system swap; no new heavy dependencies.
- Preserve **component APIs and i18n keys**; add tokens/classes rather than renaming existing ones where possible.
- **Dark theme, mobile-first, PWA.** Keep `dynamic()` imports for charts/motion; don't regress the bundle.
- Maintain **accessibility** (roles/aria/44px/reduced-motion) and **safe-area** insets.
- Deliver as **incremental, reviewable changes** (tokens → navigation → dashboard → components → landing), each independently shippable — this codebase auto-deploys to production on every push, so nothing half-finished should land.

---

## 8. Suggested order of execution (fastest value first)
1. **Token pass** — introduce the neutral surface + text scales, the type scale, spacing scale; strip glows globally. (Foundational; everything else rides on it.)
2. **Navigation & labels** — fix the "Contas" collision, group the "Mais" sheet, remove the duplicate add-CTA, declutter the TopBar. (Directly fixes "mobile is confusing".)
3. **Dashboard diet** — progressive disclosure to a ~3-screen home.
4. **Component polish** — buttons, cards, celebration/gamification calmed.
5. **Landing tighten.**

---

*Extracted from the XP-Money codebase. Every token, class, route, and component named above exists in the repo and can be grep'd. A design AI can execute against this directly; a human designer can use it as the current-state spec + creative brief.*
