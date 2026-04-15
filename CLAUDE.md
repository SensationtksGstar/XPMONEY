# XP Money — Claude context

Finance-gamification PWA (PT-PT). Deployed: **https://xp-money.vercel.app**.
Primary user flow: log transactions → earn XP → level up Voltix (mascot) → unlock badges/missions/courses.

## Stack

- **Next.js 15** App Router + **React 19** + **TypeScript** (strict)
- **Supabase** (Postgres + RLS) — client in `src/lib/supabase.ts`
- **Clerk** auth — user id is `user.id` (Clerk ID), not Supabase UUID
- **React Query** (`@tanstack/react-query`) — provider at `src/components/providers/QueryProvider.tsx` (staleTime 5min, gcTime 15min, retry 1)
- **Stripe** billing (free / plus / pro / family plans, ranks in `PLAN_RANK` constant)
- **Google Gemini** (`@google/generative-ai`, model `gemini-2.0-flash`) for receipt OCR (`/api/scan-receipt`) and bank-statement parsing (`/api/import-statement`). Free tier: 1M tokens/day. Env: `GOOGLE_GEMINI_API_KEY` (falls back to `GOOGLE_API_KEY` / `GEMINI_API_KEY`).
- **PostHog** analytics, **web-push** for notifications
- Tailwind + Radix UI + lucide-react + framer-motion + recharts
- `next.config.ts` has `experimental.optimizePackageImports` for lucide/recharts/framer/radix

## Project shape

```
src/
  app/
    (dashboard)/        # All authed routes: dashboard, transactions, goals, missions,
                        # voltix, cursos/[id], perspetiva, simulador, settings, badges
    api/                # accounts, admin, badges, billing, categories, daily-checkin,
                        # goals, import-statement, missions, notifications, onboarding,
                        # profile, scan-receipt, score, summary, transactions, voltix,
                        # webhooks, xp
    onboarding/         sign-in/  sign-up/
  components/           ads, dashboard, layout, missions, notifications,
                        providers, transactions, ui, voltix
  hooks/                useAccounts, useCategories, useFinancialScore, useGoals,
                        useMissions, useTransactions, useVoltix, useXP
  lib/                  awardBadge, awardXP, courses, gamification, posthog,
                        recalculateScore, resolveUser, safeNumber, stripe,
                        supabase, userCache, utils, contexts/, demo/
database/               SQL migrations
```

## Critical patterns (DO NOT re-discover)

### XP awards — always use the helper
`src/lib/awardXP.ts` → `awardXP(userId, amount, source)` returns `{ xp_gained, xp_total, level, leveled_up, previous_level }`. Used by transaction/goal/mission routes. Uses `Promise.allSettled` for parallel writes. Never duplicate this logic.

### Safe numeric coercion
`src/lib/safeNumber.ts`:
- `toNumber(v, fallback = 0)` — handles Postgres numeric-as-string, NaN, null
- `parseBoundedInt(raw, { default, min, max })` — safe URL param parsing

Always use `toNumber` when reading Supabase numeric/money columns.

### React Query keys
`queryKey` must NOT include `userId` — it causes double-fetch on mount (`''` → real id). All hooks already follow this. Filter by `userId` server-side via RLS instead.

### Financial score
`src/lib/gamification.ts` + `src/lib/recalculateScore.ts`. Categories include `expense_by_category` map + expense/income ratio scoring + concentration penalty. `/api/score` POST delegates to `recalculateScore`. Never hardcode score components.

### Demo mode
`NEXT_PUBLIC_DEMO_MODE=true` bypasses Clerk and uses seeded demo user. `src/lib/demo/` + `src/lib/resolveUser.ts` handle the switch.

### Plans & gating
```ts
const PLAN_RANK = { free: 0, plus: 1, pro: 2, family: 3 }
```
Obtain via `useUserPlan()` from `src/lib/contexts/UserPlanContext`. Courses/features gate by `PLAN_RANK[plan] >= PLAN_RANK[required]`.

**PT-market pricing** (tuned for conversion — PT median net salary ~€1100):
- Plus: **€2,99/mo · €24,99/yr** (saves ~30%)
- Pro:  **€5,99/mo · €49,99/yr** (saves ~30%)
- NFT mint: **€2,99 early · €7,99 regular** (−63%) — net profit ~€2,69/mint after Stripe+gas

Edit the truth source in `src/app/(dashboard)/settings/billing/BillingClient.tsx` (PLANS constant) AND the landing `src/app/page.tsx` (hardcoded hero prices). Both must match.

### AdSense
Free users only. `<AdBanner variant="feed|banner" />` dynamically imported. Two placements on dashboard. Paid plans never see ads.

### Dynamic imports for heavy widgets
Dashboard widgets (FinancialScoreCard, XPProgressBar, VoltixWidget, MonthlySummary, RecentTransactions, MissionCard, AdBanner) are all `dynamic(..., { ssr: false, loading: <skeleton /> })`. Keeps mobile JS small.

### Shared UI components — reuse, do not rebuild
- `components/ui/Logo.tsx` — XP Money brand logo SVG. Props: `size`, `showText`, `textClass`, `className`. Always use this; never hardcode `⚡ XP Money`.
- `components/ui/EmptyState.tsx` — icon + title + description + optional primary/secondary actions
- `components/ui/ConfirmDialog.tsx` — accessible modal, ESC key, 44px touch targets, `tone="danger"` for destructive
- `components/ui/CelebrationModal.tsx` — countdown progress bar, pause on hover, ESC/Enter, `role="alertdialog"`
- `components/ui/Spinner.tsx` — 4 sizes × 3 tones, `role="status"`

### Brand / icons
- **Master SVG logo**: `public/logo.svg` (full-detail, 512×512 — for hero + OG)
- **Favicon**: `src/app/icon.svg` — Next.js auto-serves at `/icon` and wires into `<head>`. Simplified geometry for legibility at 16–32px.
- **Apple touch icon**: `src/app/apple-icon.tsx` (generated 180×180 via `ImageResponse`)
- **OG image**: `src/app/opengraph-image.tsx` (1200×630 via `ImageResponse`) — auto-attached to metadata
- **PWA manifest**: `public/manifest.json` → points to `/logo.svg` + `/icon`
- Logo concept: rounded-square coin, emerald top / navy bottom (pokéball-style), gold lightning bolt in a chrome capsule centre. Ties visually to Voltix mascot.

### Accessibility floor
- Touch targets **≥ 44px** (mobile-first)
- `aria-label` on icon-only buttons
- `role="dialog"` + `aria-modal="true"` on overlays
- Mobile: delete/destructive icons are `opacity-60` (always visible), desktop fades in on hover. Never hover-only.

### Silent errors
Never `.catch(() => {})`. Use `console.warn('[source] failed:', err)` + `AbortController` for fetch inside `useEffect` cleanup.

## Courses / Academia (`src/lib/courses.ts` + `(dashboard)/cursos/[id]/page.tsx`)

- Quiz threshold: **100%** (all questions correct). `passed = correct === course.quiz.length`.
- Progress stored client-side via `saveCourseProgress(userId, courseId, patch)`.
- Certificate: premium redesign with gold filigree, guilloché pattern, rotating seal, serif typography, deterministic code `XPM-XXX-HASH` via `certCode()`.
- **NFT waitlist CTA** under the certificate — €4,99 "Transforma em NFT colecionável". FOMO/validation mode: `setShowMint` opens modal, `setMintJoined(true)` on click (no backend yet). When ready to ship: Stripe webhook → Thirdweb Engine mint on Polygon as SBT. Revenue model: user pays, platform covers ~€0.01 gas, margin ~€4.90.

## Gamification primitives

- **XP** → `useXP` hook + `awardXP` helper + `/api/xp`
- **Voltix** (mascot, levels with tier) → `useVoltix` + `/api/voltix`
- **Missions** → `useMissions` + `/api/missions` (has `is_premium` flag)
- **Badges** → `awardBadge` helper + `/api/badges`
- **Streak** (`StreakBanner`) + daily check-in → `/api/daily-checkin` called once from dashboard `useEffect`
- **Celebration modals** trigger on streak=7, streak=30, level-up, badge unlocks

## Receipt OCR & bank statement import

- `/api/scan-receipt` — Gemini Vision (`gemini-2.0-flash`), returns structured `{ amount, date, description, category }`. Uses `responseMimeType: 'application/json'` for reliable JSON output.
- `/api/import-statement` — parses bank statements and categorises transactions

## Things to remember

- Use **PT-PT** in UI copy (not PT-BR)
- Currency is **EUR**, format `formatCurrency()` from `lib/utils`
- Date format `dd/MM/yyyy`, month names in PT (`formatMonth()`)
- Never create `.md` docs unless asked
- Never amend commits; create new ones
- `.vercel/project.json` → projectId `prj_YKQCICr9yOJe00wFfAJSWY2F882U`, name `xp-money`
