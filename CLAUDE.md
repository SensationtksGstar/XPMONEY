# XP Money — Claude context

Finance-gamification PWA. Bilingual **PT-PT (default) + EN-US**. Deployed: https://xp-money.com (alias `xp-money.vercel.app`).
Core loop: log transactions → score climbs → mascot evolves → XP/badges/missions/courses unlock.

## Stack

- **Next.js 15** App Router · **React 19** · **TypeScript strict** · **Tailwind 3.4** + Radix + lucide + framer-motion + recharts
- **Supabase** Postgres + RLS — `src/lib/supabase.ts` is `import 'server-only'`. **I cannot run DDL** (no DB password). Migrations live in `database/*.sql` and the user runs them in the Supabase SQL editor; new code must always have a runtime fallback for "table not yet created".
- **Clerk** auth · `localization` prop wired to `ptPT`/`enUS` from `@clerk/localizations`. `userId` from Clerk is **NEVER** the Supabase UUID — resolve via `resolveUser(clerkId)`.
- **React Query** — staleTime 5 min, gcTime 15 min, retry 1. `queryKey` MUST NOT include `userId` (causes `''`→real-id double-fetch). Filter server-side via RLS.
- **Stripe** billing — Customer Portal at `/api/billing/portal`. Webhook at `/api/webhooks/stripe` is signature-verified + idempotent via `stripe_events` table.
- **AI chain** (`src/lib/ai.ts`): Gemini 2.5 Flash → Gemini 2.0 Flash → Groq Llama. Env `GOOGLE_GEMINI_API_KEY` (falls back to `GOOGLE_API_KEY`/`GEMINI_API_KEY`). `parseStatement({ kind:'text'|'pdf' })` — PDFs go only to Gemini. **Locale-aware**: pass `locale` arg → builds PT or EN system prompt; the EN variant tells the model to keep DB category names in PT verbatim so historical data stays intact.
- **PostHog** analytics · web-push (VAPID) · sharp (RUNTIME dep — mascot upload route).

## Plans (2-tier, April 2026)

`PLAN_RANK` from `src/lib/stripe.ts`: `{ free:0, premium:1, plus:1, pro:1, family:1 }` — Plus/Pro/Family are LEGACY aliases mapped to Premium for backwards-compat with old subscriptions. Read via `useUserPlan()`. Paid features gate on rank ≥ 1.

**Pricing** (synced between `LandingPricing.tsx` + `BillingClient.tsx`):
- Free: ad-supported, 2 goals, 3 starter courses (`gestao-basica`, `investimento-iniciantes`, `psicologia-dinheiro`), no AI features.
- Premium: €4,99/mo · €39,99/yr (~33% annual discount). All features, 4 advanced courses, no ads.

**No-refund policy** — codified in `src/app/(legal)/termos/page.tsx` §5 under Art. 17.º n.º 1 al. m) DL 24/2014. Users waive 14-day cooling-off via immediate-execution consent at checkout. Cancellation = period-end; access kept until paid period ends.

## i18n (PT/EN)

- **Source of truth**: `src/lib/i18n/translations.ts` — flat-key dict, `pt` is canonical, `en` is `Partial<...>` (falls back to PT when missing).
- **Client**: `useT()` / `useLocale()` from `LocaleProvider`. **Server**: `getServerT()` / `getServerLocale()` from `@/lib/i18n/server` — reads `xpmoney-locale` cookie, falls back to `Accept-Language`.
- `<html lang>` is dynamic via `getServerLocale()` in root layout.
- `generateMetadata()` in root layout flips `<title>`/`<meta description>`/`og:locale`/keywords per locale.
- Course content: PT in `src/lib/courses.ts` (source); EN overrides keyed by id in `src/lib/courses.en.ts`. Pages call `getCourseById(id, locale)` from `coursesAccess.ts`.
- `LanguageToggle` (compact PT/EN segmented control) lives in landing nav + mobile TopBar.
- Format helpers (`formatCurrency`/`formatMonth`/`formatDate`) accept optional `Locale`.

## Don't-re-discover rules

- **Silent errors are banned.** No `.catch(() => {})`. Always `console.warn('[source] failed:', err)` + AbortController cleanup in `useEffect`.
- **`.maybeSingle()` for probe queries** — `.single()` throws PGRST116 (500) for fresh users without a row.
- **Safe numerics** (`src/lib/safeNumber.ts`): `toNumber(v, 0)` for Supabase numeric columns (they come back as strings); `parseBoundedInt(raw, { default, min, max })` for URL params.
- **XP awards through `awardXP(db, userId, amount, reason)`** (`src/lib/awardXP.ts`). Never duplicate the logic. Idempotent guards expected via `xp_history` reason check on call site.
- **Financial score** (`src/lib/gamification.ts` + `recalculateScore.ts`): returns **0 on truly empty state**. `/api/score` POST delegates to the lib — don't inline.
- **PT decimal comma**: amount inputs use `type="text" inputMode="decimal" pattern="[0-9.,]*"` + `parseAmountLocale()` (accepts `1.234,56` AND `1,234.56`).
- **Dynamic-import heavy widgets** (`dynamic(..., { ssr:false, loading:<skeleton/> })`) for dashboard widgets, AdBanner, recharts (`SimuladorChart`, `GoalChart`).
- **Demo mode** is now SAFE: `isDemoMode()` from `src/lib/demo/demoGuard.ts` refuses to enable on `NODE_ENV='production'` unless `ALLOW_DEMO_IN_PROD='true'` is ALSO set (server-only, no NEXT_PUBLIC_ prefix). Use this helper everywhere — never read `NEXT_PUBLIC_DEMO_MODE` directly for auth-bypass logic.
- **Plan gates run SERVER-SIDE on every paid action.** Already enforced on `/api/scan-receipt`, `/api/import-statement`, `/api/courses/[id]/complete`, `/simulador`, `/perspetiva`, PDF report.
- **Mobile dead-end pattern is banned.** Never use `disabled` on a submit button for length/format validation — on mobile a disabled tap gives zero feedback and the user thinks the form is broken. Validate inside the handler and surface inline error text instead. `BugReportCard` and `ContactForm` follow this; replicate it on any new form.

## Mata-Dívidas planner (`/dividas`)

The `Planeador` panel is a deliberately-dense decision tool, not just a status card. It has three independent subpanels that must all stay in sync with `monthlyExtra` + `strategy` state:

  1. **Avalanche vs Bola de Neve comparison** — ALWAYS visible (not just the active strategy). Each card shows months + total interest + a numbered queue of debts to attack from `orderByStrategy()`. When both methods produce identical output (1 debt active, extra=0, similar rates) we render a "Estratégias equivalentes" info card instead — silent equality looked like a UI bug to users.
  2. **Result panel** — "Livre em / Juros totais / Próxima a abater" for the active strategy. Falls back to "minimum doesn't cover interest" warning when `simulatePlan().infinite`.
  3. **"E se pagares mais?" sensitivity table** — clickable ladder of scenarios (around the current extra: ½, 1×, 2×, 3×; or fixed 0/50/100/200/500 when current is 0). Each row runs `simulatePlan` and shows months + interest + savings vs the no-extra baseline. Tapping a row sets `monthlyExtra` to that value — turns the table into a what-if tuner without leaving the page.

If you add new debt-related UI, route it through `simulatePlan` / `compareStrategies` / `orderByStrategy` from `src/lib/killDebt.ts` — never re-implement the math.

## Gamification primitives

| Thing | Hook | API |
|---|---|---|
| XP | `useXP` + `awardXP` | `/api/xp` |
| Voltix (mood/evo) | `useVoltix` | `/api/voltix` |
| Missions | `useMissions` | `/api/missions` |
| Badges | `awardBadge` + `checkAllBadges` | `/api/badges` |
| Streak | dashboard `useEffect` daily | `/api/daily-checkin` |
| Score | `recalculateScore` | `/api/score` |

Celebration modals: streak 7, streak 30, level-up, badge unlock.

**XP rewards** (`src/types/index.ts → XP_REWARDS`):
- TRANSACTION_REGISTERED: 15 · DAILY_LOGIN: 25 · GOAL_CREATED: 100
- STREAK_7_DAYS: 300 · STREAK_30_DAYS: 1000 · GOAL_REACHED: 1000

## Mascot system

Two mascots × 6 evolutions: **Voltix** (male, thunder dragon — names Voltini→Voltito→Voltix→Voltaryon→Magnavoltix→Imperivoltix) · **Penny** (female, angel cat — Pennini→Pennito→Penny→Pennyara→Pennael→Seraphenny).

- Render: `<MascotCreature gender evo mood animate />` tries `/mascot/<gender>/<n>.webp` (512×512) → `onError` fallback to SVG `VoltixCreature`/`PennyCreature`. Never broken UI.
- Gender resolution (`src/lib/mascotGender.ts`): `localStorage > DB > 'voltix'`. `/api/voltix` sends `null` when DB has no value so localStorage isn't shadowed.
- **Evolution is SCORE-based + monotonic** (`src/lib/mascotEvolution.ts`). **Tuned April 2026** (was `{2:35, 3:55, 4:72, 5:85, 6:95}` and bonus `{2:200, 3:400, 4:700, 5:1000, 6:2000}`):
  - Thresholds: `{2:20, 3:48, 4:68, 5:85, 6:95}` (Evo 2 dramatically easier so users see the "wow moment" in week 1)
  - XP bonuses: `{2:350, 3:500, 4:800, 5:1200, 6:2500}`
  - Late-game (5/6) intentionally untouched — keeps top-tier aspirational.
- Cinematic: 5-stage framer-motion timeline in `MascotEvolutionCinematic.tsx` + Web Audio SFX. Preview via `?previewEvo=2-3`.
- **Landing hero** uses `PlatedMascot` (`src/components/landing/PlatedMascot.tsx`) — 8-layer monochrome deep-blue plate with iridescence + rim light + specular core + chromatic fringe + idle Lissajous when no pointer activity.
- Raw PNGs in `public/mascot/raw/` + `raw-clean/` are **gitignored** — commit only processed WebPs.

## Site-wide visuals

- **Neon Grid wallpaper** (`SiteBackground` mounted in root layout). On `(min-width: 1024px) and (pointer: fine)` it renders the live WebGL2 fragment shader from `src/components/wallpaper/shaders.ts` (cursor-reactive). On mobile / coarse-pointer: replaced with a static CSS gradient stack (zero GPU). 4 other shaders (Aurora, Voronoi, Metaballs, Starfield) sit in `shaders.ts` ready for a future theme picker.
- `body` is **transparent**; `html` keeps `bg-background` as flash-of-unstyled protection. Root layout wraps `{children}` in `relative z-10` so content always sits above the fixed `z-0` backdrop.

## Reset endpoint

`DELETE /api/transactions/reset` requires `{ confirm: "APAGAR" }`. Wipes `transactions`/`xp_history`/`financial_scores`/`goal_deposits`; resets `xp_progress` (0/1), `voltix_states` (evo 1, neutral, streak 0), active `missions.current_value`, `goals.current_amount`. Keeps badges + completed missions. Client clears `localStorage['xpmoney:mascot_last_evo']`.

## Security baseline (April 2026)

- Demo mode: see above.
- Rate limiting: `src/lib/rateLimit.ts` — auto-uses Upstash Redis when `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` are set, in-memory fallback otherwise. Applied to `/api/landing-chat` (10/10min + 150/day) and `/api/contact-message` (3/5min + 20/day).
- Cloudflare Turnstile: `src/lib/turnstile.ts` + `src/components/common/TurnstileWidget.tsx`. No-ops when `TURNSTILE_SECRET_KEY`/`NEXT_PUBLIC_TURNSTILE_SITE_KEY` are unset. Wired into `/contacto`.
- Stripe webhook: signature-verified + idempotent via `stripe_events` table (migration in `database/stripe_events_2026_04.sql`). `current_period_end` null-guarded.
- Admin endpoints (`/api/admin/upload-mascot`, `/api/admin/setup-db`) gated on `ADMIN_CLERK_ID` env with 404 stealth response.
- CRON_SECRET comparison: `crypto.timingSafeEqual` + minimum 20 chars.
- Transaction POST verifies `account_id` / `category_id` ownership before insert.
- Headers (`next.config.ts`): HSTS preload, Permissions-Policy denies powerful APIs except `camera=(self)`, `Cache-Control: no-store` on `/api/*`, `poweredByHeader: false`.

## A11y floor

- Touch targets ≥ **44×44** (mobile-first).
- `aria-label` on icon-only buttons.
- Overlays: `role="dialog"` + `aria-modal="true"` + `aria-labelledby={useId()}`.
- Destructive icons: mobile `opacity-60` always visible; desktop fade-in on hover. Never hover-only.

## Shared UI — reuse, don't rebuild

`Logo` (never hardcode "⚡ XP Money"), `EmptyState`, `ConfirmDialog` (tone="danger"), `CelebrationModal` (role="alertdialog"), `Spinner`, `AdBanner`, `MascotCreature`, `MascotPicker`, `LanguageToggle`, `LanguageSwitcher`, `PremiumFeatureLock`, `TurnstileWidget`.

## Brand

- Master logo: `public/logo.svg` (512×512).
- Favicon: `src/app/icon.svg` · Apple touch: `apple-icon.tsx` (180×180) · OG: `opengraph-image.tsx` (1200×630, uses `clip-path` — Satori doesn't support `<mask>`).

## Workflow

- **ESLint is interactive** in this repo. Don't script `next lint`. **CI gate: `npx tsc --noEmit`** — must pass before commit.
- **Auto-push to main** for Vercel deploy: `git push origin HEAD:main`. No PR workflow unless explicitly requested.
- **Never amend commits.** Never `--no-verify` / `--no-gpg-sign` unless asked.
- **Never create `.md` docs** unless asked. (CLAUDE.md updates are explicitly OK.)
- Commit messages: prefix with type — `fix:`, `feat:`, `sec:`, `tune:`, `feat(i18n):`, etc. Body explains WHY, not what. End with `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
- Currency EUR · dates `dd/MM/yyyy` PT or `MMM d, yyyy` EN · `formatCurrency`/`formatMonth` in `lib/utils`.
- Vercel `.vercel/project.json` → `projectId: prj_YKQCICr9yOJe00wFfAJSWY2F882U`, name `xp-money`.

## Pending user actions (one-time setup)

These are TODOs that require the user to act on a third-party dashboard — code is already prepared.

- **Stripe Customer Portal**: enable at https://dashboard.stripe.com/settings/billing/portal so the "Gerir subscrição" button works.
- **Upstash Redis** (optional, for rate-limit at scale): set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` in Vercel env. Without these the limiter falls back to in-memory.
- **Cloudflare Turnstile** (optional, for hard anti-bot on `/contacto`): set `TURNSTILE_SECRET_KEY` + `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in Vercel env. Without these the form falls back to honeypot only.
- **SQL migrations not yet confirmed applied**: `database/stripe_events_2026_04.sql` (Stripe idempotency), `database/bug_reports.sql` (bug-report submission table), `database/newsletter_2026_04.sql` (newsletter subscribers — required for `/api/newsletter/*` to work).

## Backlog (cosmetic / non-blocking)

- 4 unused shaders in `shaders.ts` (~400 LOC) — keep as theme-picker seed or delete.
- Dashboard layout has its own `dashboard-bg` solid which covers the Neon Grid (intentional).
- Strict CSP — currently NOT set (Clerk + PostHog + AdSense + Turnstile mix needs nonce infra; deferred).
