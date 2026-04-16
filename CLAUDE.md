# XP Money — Claude context

Finance-gamification PWA, **PT-PT UI copy (not PT-BR)**. Deployed: https://xp-money.vercel.app
Core loop: log transactions → earn XP → level up mascot → unlock badges/missions/courses.

## Stack essentials

- **Next.js 15** App Router · **React 19** · **TypeScript strict**
- **Supabase** Postgres + RLS (`src/lib/supabase.ts` has `import 'server-only'`). I **cannot run DDL** (no DB password/PAT) — migrations go via the user's SQL editor, and new columns always need a localStorage/runtime fallback.
- **Clerk** auth. `userId` from Clerk is NEVER the Supabase UUID — resolve via `resolveUser(clerkId)`.
- **React Query** (`src/components/providers/QueryProvider.tsx`): staleTime 5m, gcTime 15m, retry 1. `queryKey` MUST NOT include `userId` (causes `''`→real-id double-fetch). Filter server-side via RLS.
- **Stripe** billing · `PLAN_RANK = { free:0, plus:1, pro:2, family:3 }` · read via `useUserPlan()`. Paid-only features gate on rank ≥ 1.
- **AI chain** (`src/lib/ai.ts`): Gemini 2.5 Flash → Gemini 2.0 Flash → Groq Llama. Env `GOOGLE_GEMINI_API_KEY` (falls back to `GOOGLE_API_KEY`/`GEMINI_API_KEY`). `maxOutputTokens`: 4k vision / 16k text. `parseStatement()` takes `{ kind:'text'|'pdf' }` — PDFs go only to Gemini (Groq text can't read them). Receipt OCR cached by SHA-256 in `ai_receipt_cache`.
- **Tailwind + Radix + lucide + framer-motion + recharts + sharp** (sharp is a **runtime dep**, not devDep — mascot upload route needs it).
- PostHog analytics · web-push notifications.

## Don't-re-discover rules

- **Silent errors are banned.** No `.catch(() => {})`. Use `console.warn('[source] failed:', err)` + `AbortController` cleanup in `useEffect`.
- **`.maybeSingle()` on probe queries** — `.single()` throws PGRST116 (500) for fresh users with no row yet. Already applied on xp/voltix/score/daily-checkin/import-statement.
- **Safe numerics** (`src/lib/safeNumber.ts`): `toNumber(v, 0)` wraps Supabase numeric columns (they come back as strings); `parseBoundedInt(raw, { default, min, max })` for URL params.
- **XP awards go through `awardXP(db, userId, amount, source)`** (`src/lib/awardXP.ts`) — returns `{ xp_gained, xp_total, level, leveled_up, previous_level }`. Never duplicate the logic.
- **Financial score** (`src/lib/gamification.ts` + `recalculateScore.ts`): returns **0 on truly empty state** (no tx + no goals) — not a 24 neutral baseline. `/api/score` POST delegates — don't inline.
- **PT decimal comma**: amount inputs use `type="text" inputMode="decimal" pattern="[0-9.,]*"` + `parseAmountLocale()` that accepts both `1.234,56` and `1,234.56`.
- **Dynamic-import heavy widgets** (`dynamic(..., { ssr:false, loading:<skeleton/> })`): dashboard widgets, AdBanner, recharts blocks (`SimuladorChart`, `GoalChart`). Keeps mobile JS small.
- **Demo mode** (`NEXT_PUBLIC_DEMO_MODE=true`): `isDemoMode()` / `demoResponse()` bypass Clerk with seeded data in `src/lib/demo/`.

## Gamification primitives

| Thing | Hook | API |
|---|---|---|
| XP | `useXP` + `awardXP` | `/api/xp` |
| Voltix (mood/evo) | `useVoltix` | `/api/voltix` |
| Missions | `useMissions` (has `is_premium`) | `/api/missions` |
| Badges | `awardBadge` | `/api/badges` |
| Streak | — (dashboard `useEffect`, runs once) | `/api/daily-checkin` |
| Notifications feed | `NotificationPanel` | `/api/xp/history` |

Celebration modals trigger on: streak 7, streak 30, level-up, badge unlock.

## Mascot system

Two mascots × 6 evolutions: **Voltix** (male, thunder dragon) · **Penny** (female, angel cat).

- Render: `<MascotCreature gender evo mood animate />` tries `/mascot/<gender>/<n>.webp` (512×512, in `public/mascot/<gender>/`) → `onError` falls back to SVG `VoltixCreature`/`PennyCreature`. Never broken UI.
- **Gender resolution** (`src/lib/mascotGender.ts`): `localStorage override > DB > 'voltix'`. `/api/voltix` sends `null` when DB has no value so localStorage isn't shadowed. `MascotPicker` hydrates via `useEffect`.
- **Evolution is score-based + monotonic** (`src/lib/mascotEvolution.ts`): thresholds `{2:35, 3:55, 4:72, 5:85, 6:95}` · XP bonuses `{2:200, 3:400, 4:700, 5:1000, 6:2000}`. `maybeEvolveMascot()` in `recalculateScore.ts` only bumps UP. Reset endpoint manually writes `evolution_level=1` to allow the downgrade.
- **Cinematic**: 5-stage framer-motion timeline in `MascotEvolutionCinematic.tsx` + runtime Web Audio SFX in `evolutionSfx.ts`. Preview via `?previewEvo=2-3`.
- Animation layers (no transform collision): `mascot-float` → aura → pointer tilt (desktop only, `perspective:800px`, ±16°, skipped on touch/reduced-motion) → `mascot-breathe` → `<img>` → sparkles (evo≥3). Keyframes in `src/app/globals.css`.
- Raw PNGs in `public/mascot/raw/` + `raw-clean/` are **gitignored** — commit only processed WebPs.

## Paid features (rank ≥ 1 gate)

- **Receipt scan** (`/api/scan-receipt`, `TransactionForm` Scan button).
- **Statement import** (`/api/import-statement`, `StatementImporter`): accepts CSV/TXT (≤200 KB) OR PDF (≤8 MB base64 → Gemini inline). Free users see full-panel paywall. Confirm path awards 5 XP per row.
- **Simulador de investimento**: `pro`/`family` only (page-level server-side check in `simulador/page.tsx`).

## Reset endpoint

`DELETE /api/transactions/reset` requires `{ confirm: "APAGAR" }`. Wipes `transactions`/`xp_history`/`financial_scores`/`goal_deposits`; resets `xp_progress` (0/1), `voltix_states` (evo 1, neutral, streak 0), active `missions.current_value`, `goals.current_amount`. Keeps badges + completed missions (historical). Client must also clear `localStorage['xpmoney:mascot_last_evo']`.

## A11y floor

- Touch targets ≥ **44×44** (mobile-first).
- `aria-label` on icon-only buttons.
- Overlays: `role="dialog"` + `aria-modal="true"` + `aria-labelledby={useId()}`.
- Destructive icons: mobile `opacity-60` always visible; desktop fade-in on hover. Never hover-only.

## Pricing (PT market, ~€1100 median)

Single-source pairs — keep both in sync: `settings/billing/BillingClient.tsx` (PLANS const) + `app/page.tsx` (landing hero).

| Plan | Monthly | Annual (~30% off) |
|---|---|---|
| Plus | €2,99 | €24,99 |
| Pro  | €5,99 | €49,99 |

Free plan sees `<AdBanner variant="feed\|banner" />` (dynamic-imported). Paid never see ads. NFT certificate mint is **waitlist only** — modal in `cursos/[id]`, no backend.

## Courses

`src/lib/courses.ts` + `(dashboard)/cursos/[id]/page.tsx`. Quiz threshold **100%**. Progress via `saveCourseProgress(userId, courseId, patch)` client-side. Certificate has deterministic code `XPM-XXX-HASH` from `certCode()`. Gated by `PLAN_RANK`.

## Shared UI — reuse, don't rebuild

`Logo` (never hardcode "⚡ XP Money"), `EmptyState`, `ConfirmDialog` (tone="danger"), `CelebrationModal` (role="alertdialog"), `Spinner`, `AdBanner`, `MascotCreature`, `MascotPicker`.

## Brand

- Master logo: `public/logo.svg` (512×512) — minimalist emerald square + bolt cutout via SVG mask.
- Favicon: `src/app/icon.svg` · Apple touch: `apple-icon.tsx` (180×180) · OG: `opengraph-image.tsx` (1200×630, uses `clip-path` polygon — Satori doesn't support `<mask>`).

## Workflow quirks

- **ESLint is interactive** in this repo. Don't script `next lint`. CI gate is `npx tsc --noEmit`.
- **Never amend commits.** Never `--no-verify` / `--no-gpg-sign` unless asked.
- **Never create `.md` docs** unless asked.
- Currency EUR · dates `dd/MM/yyyy` · months PT via `formatCurrency`/`formatMonth` in `lib/utils`.
- Vercel `.vercel/project.json` → `projectId: prj_YKQCICr9yOJe00wFfAJSWY2F882U`, name `xp-money`.
