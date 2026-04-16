# XP Money — Claude context

Finance-gamification PWA, **PT-PT**. Deployed: https://xp-money.vercel.app
Core loop: log transactions → earn XP → level up mascot → unlock badges/missions/courses.

## Stack (non-obvious bits)

- **Next.js 15** App Router + **React 19** + **TypeScript strict**
- **Supabase** Postgres + RLS (`src/lib/supabase.ts`) — I **cannot** run DDL here (no DB password / PAT). Migrations for Supabase must be applied by the user via the SQL editor. Always provide a copy-paste link and a localStorage/runtime fallback for anything that depends on a new column.
- **Clerk** auth — `userId = user.id` (Clerk id), never the Supabase UUID. Resolve to internal id via `resolveUser(clerkId)`.
- **React Query** — provider at `src/components/providers/QueryProvider.tsx` (staleTime 5m, gcTime 15m, retry 1). `queryKey` NEVER includes `userId` (causes `''`→real-id double-fetch). Filter server-side via RLS.
- **Stripe** billing — plans ranked in `PLAN_RANK = { free:0, plus:1, pro:2, family:3 }`, read via `useUserPlan()` from `src/lib/contexts/UserPlanContext`.
- **Google Gemini** — `gemini-2.5-flash` (thinking model, size `maxOutputTokens` generously: 4k vision / 16k text) → fallback `gemini-2.0-flash` → Groq Llama 4 Scout. Env: `GOOGLE_GEMINI_API_KEY` (falls back to `GOOGLE_API_KEY` / `GEMINI_API_KEY`). Used by `/api/scan-receipt` and `/api/import-statement`. Receipt OCR caches by SHA-256 image hash in `ai_receipt_cache`.
- **Tailwind + Radix + lucide-react + framer-motion + recharts + sharp** (sharp is a **dependency**, not devDependency — needed by the mascot upload route).
- **PostHog** analytics, **web-push** notifications.

## Critical patterns (do not re-discover)

### XP awards
`src/lib/awardXP.ts` → `awardXP(userId, amount, source)` returns `{ xp_gained, xp_total, level, leveled_up, previous_level }`. Uses `Promise.allSettled`. Never duplicate.

### Safe numeric coercion
`src/lib/safeNumber.ts`:
- `toNumber(v, fallback = 0)` — always wrap Supabase numeric/money columns
- `parseBoundedInt(raw, { default, min, max })` — URL params

### Financial score
`src/lib/gamification.ts` + `src/lib/recalculateScore.ts`. Includes `expense_by_category` map + income/expense ratio + concentration penalty. `/api/score` POST delegates — don't inline.

### Silent errors are banned
No `.catch(() => {})`. Use `console.warn('[source] failed:', err)` + `AbortController` in `useEffect` cleanup.

### Dynamic imports for heavy widgets
Dashboard widgets (FinancialScoreCard, XPProgressBar, VoltixWidget, MonthlySummary, RecentTransactions, MissionCard, AdBanner) are all `dynamic(..., { ssr: false, loading: <skeleton /> })`. Keeps mobile JS small.

### Demo mode
`NEXT_PUBLIC_DEMO_MODE=true` — `isDemoMode()` / `demoResponse()` bypass Clerk + seeded data in `src/lib/demo/`.

## Mascot system (recent — key context)

Two mascots, 6 evolutions each:
- **Voltix** (male, thunder dragon): Voltini → Voltito → Voltix → Voltaryon → Magnavoltix → Imperivoltix
- **Penny**  (female, angel cat): Pennini → Pennito → Penny → Pennyara → Pennael → Seraphenny

Render pipeline — prefers real 3D WebPs, falls back to hand-crafted SVG:
```
<MascotCreature gender evo mood animate />   ← router in src/components/voltix/MascotCreature.tsx
  tries /mascot/<gender>/<n>.webp            ← 512×512 alpha, in public/mascot/<gender>/
  onError → VoltixCreature | PennyCreature   ← SVG fallback, never broken UI
```

Animation layers (each its own transform, no collision):
1. `animate-mascot-float` — translateY + rotate
2. aura (blur circle)
3. **pointer tilt** — `perspective: 800px` + `rotateX/rotateY` set via `ref.current.style.transform` on pointermove (desktop only; skipped on touch + `prefers-reduced-motion`). Max ±16°, 0.35s return.
4. `animate-mascot-breathe` — scale
5. `<img>` of the pet
6. sparkles (evo ≥ 3)

Keyframes defined in `src/app/globals.css` (mascotFloat/Breathe/Sway/Aura/Feather/Sparkle + delay-300/600/900/1200/1500).

### Mascot gender — localStorage wins
`src/lib/mascotGender.ts`. Precedence: **localStorage override > DB > 'voltix'**. `resolveMascotGender(dbValue)` is called inside `useVoltix` so consumers always get the right gender. `/api/voltix` sends `null` when DB has no value (not `'voltix'`) — forcing a default would shadow localStorage. Picker at `src/components/settings/MascotPicker.tsx` hydrates from localStorage on mount via `useEffect`.

### Asset pipeline
Raw PNGs live in `public/mascot/raw/<gender>/<1..6>.png` (gitignored). Two scripts:
- `scripts/remove-bg-mascots.mjs` — AI bg removal via `@imgly/background-removal-node` (ONNX U²-Net, local, no API key, ~90 MB cached model, ~12s/image). Output → `public/mascot/raw-clean/<gender>/<n>.png`.
- `scripts/process-mascot.mjs` — sharp trim → fit 480×480 lanczos3 → extend 512×512 → WebP q88. Targets <80 KB per asset.

Dev-only upload UI at `/admin/mascot-upload` (route `src/app/api/admin/upload-mascot/route.ts` refuses prod). Drag-and-drop 12 tiles → inline sharp pipeline → commit.

## Plans & pricing (PT market, tuned for ~€1100 median)

Single source of truth pairs — keep them in sync:
- `src/app/(dashboard)/settings/billing/BillingClient.tsx` (PLANS constant)
- `src/app/page.tsx` (hardcoded landing hero prices)

| Plan | Monthly | Annual (save ~30%) |
|---|---|---|
| Plus | €2,99 | €24,99 |
| Pro  | €5,99 | €49,99 |

NFT mint (certificate → collectible): €2,99 early / €7,99 regular. Net ~€2,69 after Stripe + gas. **Waitlist only** — modal in `cursos/[id]`, no backend yet. When shipping: Stripe webhook → Thirdweb Engine mint on Polygon as SBT.

### AdSense
Free plan only. `<AdBanner variant="feed|banner" />` dynamic-imported. Paid never see ads.

## Courses / Academia

`src/lib/courses.ts` + `(dashboard)/cursos/[id]/page.tsx`. Quiz threshold **100%**. Progress via `saveCourseProgress(userId, courseId, patch)` (client-side). Certificate: gold filigree + guilloché + rotating seal + deterministic code `XPM-XXX-HASH` from `certCode()`. Gate by `PLAN_RANK`.

## Shared UI — reuse, do not rebuild
- `Logo` (brand SVG — never hardcode `⚡ XP Money`)
- `EmptyState`, `ConfirmDialog` (tone="danger"), `CelebrationModal` (role="alertdialog"), `Spinner`, `AdBanner`
- `MascotCreature` / `MascotPicker` — described above

## Brand / icons
- Master logo: `public/logo.svg` (512×512, hero + OG)
- Favicon: `src/app/icon.svg` (auto-served at `/icon`)
- Apple touch: `src/app/apple-icon.tsx` (ImageResponse 180×180)
- OG image: `src/app/opengraph-image.tsx` (ImageResponse 1200×630)
- PWA manifest: `public/manifest.json` → `/logo.svg` + `/icon`
- Concept: rounded-square coin, emerald top / navy bottom (pokéball-style), gold bolt in chrome capsule.

## Accessibility floor
- Touch targets ≥ **44px** (mobile-first)
- `aria-label` on icon-only buttons
- `role="dialog"` + `aria-modal="true"` on overlays
- Destructive icons: mobile `opacity-60` always visible, desktop fades in on hover. Never hover-only.

## Gamification primitives

| Thing | Hook / Helper | API |
|---|---|---|
| XP | `useXP` + `awardXP` | `/api/xp` |
| Voltix (mood/evo) | `useVoltix` | `/api/voltix` |
| Missions | `useMissions` (has `is_premium`) | `/api/missions` |
| Badges | `awardBadge` | `/api/badges` |
| Streak / check-in | — (dashboard `useEffect`, runs once) | `/api/daily-checkin` |

Celebration modals trigger on: streak=7, streak=30, level-up, badge unlock.

## Environment & workflow quirks

- **ESLint is interactive** in this repo (`next lint` prompts config choice). Don't script it. Use `npm run typecheck` (`tsc --noEmit`) as the CI-ish gate.
- **Never amend commits** — always new commits. Never `--no-verify` / `--no-gpg-sign` unless asked.
- **Never create `.md` docs** unless the user asks.
- **Currency EUR**, dates `dd/MM/yyyy`, months PT — `formatCurrency` + `formatMonth` in `lib/utils`.
- **PT-PT** in UI copy (not PT-BR).
- `.vercel/project.json` → `projectId: prj_YKQCICr9yOJe00wFfAJSWY2F882U`, name `xp-money`.
- `raw/` and `raw-clean/` inside `public/mascot/` are gitignored — only commit the processed WebPs.
