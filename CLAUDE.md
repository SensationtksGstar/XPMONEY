# XP Money — Claude context

Finance-gamification PWA. Bilingual **PT-PT (default) + EN-US**. Deployed: https://xp-money.com (alias `xp-money.vercel.app`).
Core loop: log transactions → score climbs → mascot evolves → XP/badges/missions/courses unlock.

## Stack

- **Next.js 15** App Router · **React 19** · **TypeScript strict** · **Tailwind 3.4** + Radix + lucide + framer-motion + recharts
  - **Versões (out. 2026, sec upgrade):** `next@15.5.28` (+ `eslint-config-next@15.5.28` alinhado) e `@clerk/nextjs@6.39.8` — fecham o critical do Next (DoS RSC + bypass do middleware via segment-prefetch) e o GHSA-w24r do Clerk. Ficar na linha 15.5.x / 6.x (sem saltos de major sem decisão). **`sharp` NÃO se atualiza** (0.34.x é dep de runtime da rota de upload de mascotes; o aviso libvips fica conhecido). Nunca `npm audit fix --force`. Resto do `npm audit --omit=dev` = transitivas (`@clerk/localizations` traz um `@clerk/shared@4.8.2` antigo, só strings).
- **Vercel region `fra1`** (`vercel.json` regions; era `lhr1`) — ao lado do Supabase eu-central-1 (cada ida sequencial à BD deixou de atravessar o Canal) e todo o processamento fica na UE (RGPD). Confirmar: header `x-vercel-id` contém `::fra1::`. Não voltar a `lhr1`.
- **Supabase** Postgres + RLS — `src/lib/supabase.ts` is `import 'server-only'`. **I cannot run DDL** (no DB password). Migrations live in `database/*.sql` and the user runs them in the Supabase SQL editor; new code must always have a runtime fallback for "table not yet created".
- **Clerk** auth · `localization` prop wired to `ptPT`/`enUS` from `@clerk/localizations`. `userId` from Clerk is **NEVER** the Supabase UUID — resolve via `resolveUser(clerkId)`. `resolveUser` só põe HITS em cache (1 h, tag `user-id-<clerkId>`, `.maybeSingle()`): um miss/erro lança dentro do `unstable_cache` (não fica guardado) e devolve `null` fora; o onboarding POST faz `revalidateTag(\`user-id-${userId}\`)`. Nunca voltar a cachear `null` (o user acabado de criar ficava 1 h "inexistente"). ⚠️ Produção ainda corre numa instância Clerk **DEV** (`pk_test_`, cap 100 users) — o vigia alerta até à migração para `pk_live_`.
- **React Query** — staleTime 5 min, gcTime 15 min, retry 1. `queryKey` MUST NOT include `userId` (causes `''`→real-id double-fetch). Filter server-side via RLS.
- **Stripe** billing — Customer Portal at `/api/billing/portal`. Webhook at `/api/webhooks/stripe` is signature-verified + idempotent via `stripe_events` table.
  - **Webhook endpoint (July 2026): `we_1Too2A…` → `https://xp-money.com/api/webhooks/stripe`**, api_version pinned `2025-02-24.acacia` (= SDK pin in `src/lib/stripe.ts`). The ORIGINAL endpoint (`we_1TNCmG…`, xp-money.vercel.app, api_version dahlia) had been **auto-disabled by Stripe** after repeated delivery failures (stale signing secret) — meaning NO events were being delivered at all; it's now manually disabled, do not re-enable it. `STRIPE_WEBHOOK_SECRET` in Vercel matches the new endpoint. **If webhook deliveries ever fail again: check `stripe.webhookEndpoints.list()` for `status: disabled` FIRST** — Stripe silently kills endpoints after ~sustained failures and everything downstream (plan grants, cancellations, pass activation) stops.
  - **Webhook lifecycle invariants (July 2026 audit — keep them):** subscriptions upsert MUST pass `onConflict: 'user_id'` (table unique is user_id, not the PK the client defaults to — without it a re-subscription silently never stores the new subscription id and the eventual cancellation can't find the row → premium forever). Stripe statuses outside `active|canceled|past_due|trialing` MUST be clamped before writing (`clampStatus`) or the CHECK constraint rejects the row silently; effective plan gates on status (`PREMIUM_STATUSES` = active/trialing/past_due), not just the price. Any downgrade of `users.plan` to 'free' MUST go through `downgradeRespectingPass()` — an unexpired Annual Pass keeps plan='premium' (plain `plan='free'` voids a paid pass because `isPremiumActive` short-circuits on plan==='free'). O ramo de subscrição do `checkout.session.completed` também respeita `PREMIUM_STATUSES` (status não-premium → plan 'free' via `downgradeRespectingPass`) — um checkout reprocessado dias depois não pode ressuscitar Premium numa subscrição cancelada.
  - **Idempotência = RESERVAR → PROCESSAR → LIBERTAR SE FALHAR (out. 2026 — não regredir):** INSERT em `stripe_events` (23505 → 200 idempotent; tabela ausente 42P01/PGRST205 → segue sem dedupe), `handle(event, db)` faz **throw** em qualquer escrita Supabase que decide acesso, e no catch faz DELETE da reserva + 500 para o retry do Stripe reprocessar. Nunca voltar a gravar o evento antes de processar com erros só em `console.warn` (era "pagou e não recebeu Premium"). `handle()` corre sob deadline duro de 20 s (`HANDLE_DEADLINE_MS` < maxDuration 30) + chamadas Stripe com `STRIPE_CALL_OPTS` (timeout 8 s) + `checkpoint(signal)` antes de cada escrita — senão um timeout da lambda deixava a reserva órfã. Se o próprio DELETE falhar → email ao admin (apagar a row em stripe_events + reenviar o evento no Dashboard). **Utilizador não encontrado = 200 + `alertUnmatchedPayment()` (notifyAdmin em `after()`), NUNCA 500** — 500 sustentados fazem o Stripe desativar o endpoint. Depois de cada escrita em plan/premium_until: `revalidateTag(\`user-profile-${clerkId}\`)`. Janela residual conhecida (sem DDL): uma escrita já em voo quando o deadline dispara pode commitar → o retry do `grantPass` pode empilhar +1 ano (fecha-se só com marcador de conclusão em BD).
  - **`metadata.internalUserId`**: os checkouts (subscrição e passe — session, `subscription_data` e `payment_intent_data`) gravam o `users.id` do Supabase além do `metadata.userId` (Clerk id). O webhook resolve PRIMEIRO pelo internalUserId → sobrevive à migração para o Clerk de produção (clerk_ids novos). Manter os dois.
  - **PT payment methods — CRITICAL nuance:** Cards work in BOTH subscription + one-time. **Multibanco** (bank-reference, 24-72h pay-by) and **MBWay** (instant mobile) are **one-time ONLY** — they do NOT support recurring billing, so Stripe **hides them in `mode:'subscription'` checkout** (this is why a subscription checkout shows card-only, NOT a code bug). To offer them you MUST use a one-time `mode:'payment'` checkout. Activate both at https://dashboard.stripe.com/settings/payment_methods (account must be PT/EUR).
  - **Annual Pass (one-time, June 2026)** — `createPassCheckoutSession()` in `src/lib/stripe.ts` (`mode:'payment'`, `payment_method_types:['card','multibanco','mb_way']`, price env `STRIPE_PREMIUM_PASS_PRICE_ID`, one-time). Triggered from `BillingClient` ("Passe Anual" section, free users) via `/api/billing/checkout` with `cycle:'pass'`. Webhook grants Premium for 1 year by setting `users.premium_until` — **only when paid**: card/MBWay are `paid` at `checkout.session.completed`; **Multibanco confirms async** → granted at `checkout.session.async_payment_succeeded`. `grantPass()` EXTENDS (stacks) existing `premium_until`. **Effective-plan resolution is centralised in `src/lib/plan.ts`** (`isPremiumActive` + `fetchPlanRow` with 42703 graceful fallback for pre-migration deploys) — used by dashboard layout, perspetiva, goals/missions APIs, `userCache`. Migration: `database/premium_until_column_2026_06.sql`. No auto-renewal — pass users see "ativo até DD/MM" instead of the Customer Portal button.
  - **VAT / IVA:** user is in **regime de isenção Art. 53.º CIVA** — no VAT charged. Stripe price is gross revenue (PRICE_NET_OF_VAT === PRICE_GROSS in `/admin/metrics`). When >€15k/year cross-over → switch to standard regime + add `automatic_tax: true` to checkout (recipe in `src/lib/stripe.ts` comment).
- **AI chain** (`src/lib/ai.ts`): Gemini 2.5 Flash → Gemini 2.0 Flash → Groq Llama. Env `GOOGLE_GEMINI_API_KEY` (falls back to `GOOGLE_API_KEY`/`GEMINI_API_KEY`). `parseStatement({ kind:'text'|'pdf' })` — PDFs go only to Gemini. **Locale-aware**: pass `locale` arg → builds PT or EN system prompt; the EN variant tells the model to keep DB category names in PT verbatim so historical data stays intact.
- **PostHog** analytics · web-push (VAPID) · sharp (RUNTIME dep — mascot upload route).
- **Analytics stack (July 2026) — two tools, two jobs, don't conflate:**
  - **Vercel Web Analytics** (`<Analytics />` in root layout, `@vercel/analytics/next`) = **the authoritative visitor count**. Cookieless + anonymous → NOT consent-gated → counts ALL visitors. Was enabled on the Vercel project since April but the component was never mounted (dashboard sat empty until 2026-07-03). No read API — numbers live at vercel.com → xp-money → Analytics.
  - **PostHog** = consent-gated product analytics (a *sample*: only visitors who accept the cookie banner). ⚠️ `NEXT_PUBLIC_POSTHOG_KEY` is NOT set in Vercel prod → PostHog captures nothing until the user adds it. `/admin/metrics` has a "Tráfego & aquisição" section that queries PostHog via HogQL (`src/lib/trafficStats.ts`, needs optional server envs `POSTHOG_PERSONAL_API_KEY` + `POSTHOG_PROJECT_ID`; degrades to a setup hint without them). Never label PostHog numbers as total traffic. `src/lib/posthog.ts` NO LONGER imports `posthog-js` statically: dynamic `import()` + in-memory queue; events enter only with `NEXT_PUBLIC_POSTHOG_KEY` set AND consent `'accepted'` — pre-consent events are DISCARDED (never buffer them: that would be processing without a legal basis). `PostHogProvider` stays the ONLY place that calls `posthog.init`; the queue waits for `__loaded` (max 10 s) and resets itself if the chunk import fails. Don't re-add a top-level `import posthog from 'posthog-js'` anywhere (~50-60 kB gzip into shared chunks).

## Plans (2-tier, April 2026)

`PLAN_RANK` from `src/lib/stripe.ts`: `{ free:0, premium:1, plus:1, pro:1, family:1 }` — Plus/Pro/Family are LEGACY aliases mapped to Premium for backwards-compat with old subscriptions. Read via `useUserPlan()`. Paid features gate on rank ≥ 1.

**Pricing** (synced between `LandingPricing.tsx` + `BillingClient.tsx`):
- Free: ad-supported, **`FREE_GOAL_LIMIT = 2` active goals** (server-enforced in `/api/goals` POST, returns 403 with `code: 'free_goal_limit'` when at limit), **`FREE_DEBT_LIMIT = 1` active debt in Mata-Dívidas** (server-enforced in `/api/debts` POST since June 2026, 403 `code: 'free_debt_limit'` — was client-only before), **Orçamento 50/30/20 fully unlocked** (retention hook), 3 starter courses, no AI features.
- **Every server-side plan gate resolves the EFFECTIVE plan via `src/lib/plan.ts`** (`fetchPlanRow`/`isPremiumActive` — respects Annual Pass `premium_until` expiry). June 2026 audit converted the last raw `users.plan` readers (scan-receipt, import-statement, courses complete, simulador) — never gate on raw `plan` again (an expired pass would stay premium forever).
- Premium: €4,99/mo · €39,99/yr (~33% annual discount). All features, unlimited goals + debts, 4 advanced courses, no ads.

**No-refund policy** — codified in `src/app/(legal)/termos/page.tsx` §5 under Art. 17.º n.º 1 al. m) DL 24/2014. Users waive 14-day cooling-off via immediate-execution consent at checkout. Cancellation = period-end; access kept until paid period ends.

## i18n (PT/EN)

- **Source of truth**: `src/lib/i18n/translations.ts` — flat-key dict, `pt` is canonical, `en` is `Partial<...>` (falls back to PT when missing).
- **Client**: `useT()` / `useLocale()` from `LocaleProvider`. **Server**: `getServerT()` / `getServerLocale()` from `@/lib/i18n/server` — reads `xpmoney-locale` cookie, falls back to `Accept-Language`.
- `<html lang>` is dynamic via `getServerLocale()` in root layout.
- `generateMetadata()` in root layout flips `<title>`/`<meta description>`/`og:locale`/keywords per locale.
- Course content: PT in `src/lib/courses.ts` (source); EN overrides keyed by id in `src/lib/courses.en.ts`. Pages call `getCourseById(id, locale)` from `coursesAccess.ts`.
- `LanguageToggle` (compact PT/EN segmented control) lives in landing nav (+ blog nav). In-app, language switching is the `LanguageSwitcher` card in /settings — it was REMOVED from the mobile TopBar in the Fase 3 nav cleanup (idioma é definição, não chrome); don't re-add it there.
- **`LocaleProvider` takes a REQUIRED `initialLocale`** (root layout passes `getServerLocale()`): client islands now SSR in the visitor's language (it used to `useState('pt')` and fix itself in an effect → EN visitors got PT HTML + a re-render). The client no longer resolves the locale from scratch; it only syncs `localStorage` → `xpmoney-locale` cookie once and calls `router.refresh()`. Any new `<LocaleProvider>` mount must pass `initialLocale`.
- Format helpers (`formatCurrency`/`formatMonth`/`formatDate`) accept optional `Locale`. `formatMonths` (killDebt) also takes optional `locale` (default `'pt'`).

**i18n patterns (May 2026 — follow these, don't re-discover):**
- **`t()` is typed to `TranslationKey` (= `keyof` the PT dict).** Referencing a key not defined in PT is a **tsc error** — this is the safety net for every i18n sweep. EN is `Partial`, so a missing EN key silently falls back to PT (never broken, just untranslated). Always mirror PT→EN.
- **Module-level label arrays / PT-only constant maps** (e.g. `SCORE_LABELS`, `PERIOD_LABELS`, `DEBT_CATEGORIES.label`, `LEVELS.name`) can't call `t()`. Pattern: a `Record<id, TranslationKey>` resolved with `t()` in render, with a fallback for unknown ids (e.g. user-created categories). See `XPProgressBar` (`LEVEL_NAME_KEY`), `FinancialScoreCard` (`SCORE_LEVEL_KEY`), `PeriodFilter` (`PERIOD_KEY`).
- **Locale-aware short month / date labels** computed client-side via `toLocaleDateString(locale === 'en' ? 'en-US' : 'pt-PT', …)` so APIs stay language-neutral (return raw `YYYY-MM`). See `CashFlowChart`, `BudgetHistory`.
- **Shared debt-category labels**: `src/lib/debtCategoryLabel.ts` exports `DEBT_CAT_KEY` + `catLabel(id, rawLabel, t)`. Reused by `/dividas` + `/dividas/[id]`.
- **Don't branch UI logic on error-message text** (`errorMsg.includes('Plano')` breaks under i18n). Track a boolean state instead (see `StatementImporter` `planError`).
- **Coverage as of June 2026**: dashboard widgets (all), Mata-Dívidas (`/dividas` + `[id]`), AI import flow (`ReceiptScanner` + `StatementImporter`), `BudgetHistory`, `BugReportCard`, `LandingChat`, **Missões (`/missions` + `MissionCard` + dashboard)**, the **`NotificationPanel`** (TopBar bell), and the **6-step onboarding flow** (`/onboarding`) are fully PT/EN. **Still PT-only**: `FauxPerspectivaPreview` (decorative blurred backdrop behind the perspetiva paywall — low priority).
- **Mission template title/description are DB-frozen PT strings** (copied from `MISSION_TEMPLATES` at creation). Resolved back to keys at render via `src/lib/missionLabel.ts` → `missionTitle()` / `missionDescription()`, keyed on `${type}_${target_value}` (unique per template — `keep_daily_streak` has 7- and 30-day variants), with fallback to the raw DB string for unmapped combos. **If you add a new MISSION_TEMPLATE, add matching `missions.tpl.<type>_<target>.title`/`.desc` keys (PT+EN) + an entry in `missionLabel.ts`** or it renders the raw PT.
- **Validation guards** (run after any i18n change — they catch what `tsc` can't): `node scripts/check-i18n-placeholders.mjs` (PT↔EN placeholder parity across the dict) + `node scripts/check-i18n-callsites.mjs` (every `t('key', {…})` passes args matching the key's `{placeholders}`). The interpolation `{n}`/`{amount}` mismatch bug is invisible to `tsc` — these scripts are the net.

## Don't-re-discover rules

- **Tailwind: `theme.extend.opacity` acrescenta 2/3/4/6/8/12/22.** Antes, `bg-white/3`, `border-white/8`, `bg-white/8`, etc. (86 usos) NÃO geravam CSS (só a escala default de múltiplos de 5 existe). Se usares uma opacidade fora de ambas as escalas, acrescenta-a ao `tailwind.config.ts` — verificar no CSS gerado (`.next/static/css`) que a regra existe.
- **iOS anti-zoom**: `globals.css` termina com `@media (pointer: coarse)` que sobe para 16px os `input`/`select`/`textarea` PEQUENOS (os `text-base..6xl` ficam como estão — o valor da transação é `text-5xl`). Não mexer no viewport/`maximumScale` (prejudica o zoom do utilizador). `!important` — ganha ao `text-sm` em touch.
- `(dashboard)/loading.tsx` genérico existe para as rotas sem `loading.tsx` próprio; os de cada rota sobrepõem-se.
- **Silent errors are banned.** No `.catch(() => {})`. Always `console.warn('[source] failed:', err)` + AbortController cleanup in `useEffect`.
- **`.maybeSingle()` for probe queries** — `.single()` throws PGRST116 (500) for fresh users without a row.
- **Safe numerics** (`src/lib/safeNumber.ts`): `toNumber(v, 0)` for Supabase numeric columns (they come back as strings); `parseBoundedInt(raw, { default, min, max })` for URL params.
- **XP awards through `awardXP(db, userId, amount, reason)`** (`src/lib/awardXP.ts`). Never duplicate the logic. Idempotent guards expected via `xp_history` reason check on call site.
- **Financial score** (`src/lib/gamification.ts` + `recalculateScore.ts`): returns **0 on truly empty state**. `/api/score` POST delegates to the lib — don't inline.
- **PT decimal comma**: amount inputs use `type="text" inputMode="decimal" pattern="[0-9.,]*"` + `parseAmountLocale()` (accepts `1.234,56` AND `1,234.56`).
- **Dynamic-import heavy widgets** (`dynamic(..., { ssr:false, loading:<skeleton/> })`) for dashboard widgets, AdBanner, recharts (`SimuladorChart`, `GoalChart`).
- **Demo mode** is now SAFE: `isDemoMode()` from `src/lib/demo/demoGuard.ts` refuses to enable on `NODE_ENV='production'` unless `ALLOW_DEMO_IN_PROD='true'` is ALSO set (server-only, no NEXT_PUBLIC_ prefix). Use this helper everywhere — never read `NEXT_PUBLIC_DEMO_MODE` directly for auth-bypass logic.
- **Plan gates run SERVER-SIDE on every paid action.** Already enforced on `/api/scan-receipt`, `/api/import-statement` (+ its `/confirm` step — ownership-validated, rate-limited AND premium-gated since June 2026; it was an open XP-farm before), `/api/courses/[id]/complete`, `/api/debts` POST, `/simulador`, `/perspetiva`, PDF report.
- **Fire-and-forget on Vercel needs `after()` from `next/server`** (Next ≥15.1). A bare `void somePromise()` can be silently dropped when the lambda freezes post-response. All admin-email/newsletter/mission-tick sites use `after(() => …)`. BUT: do NOT defer the transaction-create gamification chain (`awardXP`/`recalculateScore`/missions) — the client invalidates `['score']`/`['xp']`/`['missions']` the moment the 201 lands, so deferring serves stale values ("score doesn't move"). It stays awaited; make it FAST instead (internals are batched with `Promise.all`).
- **Independent Supabase reads in one request get `Promise.all`-batched.** June 2026 sweep: summary (main+prev window), daily-checkin, goals POST, budget/status, transactions POST ownership probes, `checkAllBadges` (5 reads + awards in 2 batches), `recalculateScore` (prev-score folded into the initial batch). Keep new routes in this style — every sequential await is ~30-60 ms on Vercel.
- **Mobile dead-end pattern is banned.** Never use `disabled` on a submit button for length/format validation — on mobile a disabled tap gives zero feedback and the user thinks the form is broken. Validate inside the handler and surface inline error text instead. `BugReportCard` and `ContactForm` follow this; replicate it on any new form.
- **Local-state hooks shared across components must use React Query as the store, not `useState`.** Example: `useBudgetOverrides` in `src/hooks/useBudget.ts`. Two consumers each calling `useState` give independent state instances — when one mutates, the other never sees it (looked like "click does nothing" to users in the budget bucket toggle bug). Use `client.setQueryData(KEY, ...)` + `useQuery({ queryKey: KEY, queryFn: readFromLocalStorage })` so every consumer subscribes to the same cache entry.
- **Touch targets ≥ 40-44 px even in compact navs.** `LanguageToggle` had `px-2 py-1 text-[10px]` (~28 px tall) and mobile users tapped between buttons or hit the active side (no-op via `!active && setLocale`) thinking the button was broken. Default+compact now use `min-h-[40px]` / `min-h-[44px]` + `touch-manipulation` (kills iOS 300 ms double-tap delay) + `active:bg-white/10` for visible pressed feedback.
- **Mobile-Safari prints PDFs at the SCREEN viewport, not @page A4.** Means a `grid-cols-3` chart with `text-2xl` will overflow on a 375-px iPhone when the user clicks Save-as-PDF. Fix: explicit `@media print` overrides that force desktop sizing (`grid-template-columns: repeat(3, …) !important`, font-size resets) AND a mobile-friendly screen layout (`grid-cols-1 sm:grid-cols-3`, `text-xl sm:text-2xl`, `tabular-nums break-words`). See `src/app/reports/print/page.tsx` `report-summary-grid` / `report-summary-card` / `report-summary-value` classes.

## Mata-Dívidas planner (`/dividas`)

The `Planeador` panel is a deliberately-dense decision tool, not just a status card. It has three independent subpanels that must all stay in sync with `monthlyExtra` + `strategy` state:

  1. **Avalanche vs Bola de Neve comparison** — ALWAYS visible (not just the active strategy). Each card shows months + total interest + a numbered queue of debts to attack from `orderByStrategy()`. When both methods produce identical output (1 debt active, extra=0, similar rates) we render a "Estratégias equivalentes" info card instead — silent equality looked like a UI bug to users.
  2. **Result panel** — "Livre em / Juros totais / Próxima a abater" for the active strategy. Falls back to "minimum doesn't cover interest" warning when `simulatePlan().infinite`.
  3. **"E se pagares mais?" sensitivity table** — clickable ladder of scenarios (around the current extra: ½, 1×, 2×, 3×; or fixed 0/50/100/200/500 when current is 0). Each row runs `simulatePlan` and shows months + interest + savings vs the no-extra baseline. Tapping a row sets `monthlyExtra` to that value — turns the table into a what-if tuner without leaving the page.

If you add new debt-related UI, route it through `simulatePlan` / `compareStrategies` / `orderByStrategy` from `src/lib/killDebt.ts` — never re-implement the math.

**`simulatePlan` = orçamento mensal FIXO (out. 2026 — não regredir):** budget = soma dos mínimos + extra; cada mês paga `min(mínimo, saldo, disponível)` a cada dívida ativa e o resto rola em cascata pela ordem da estratégia — os mínimos de dívidas já abatidas CONTINUAM no orçamento (bola de neve real; antes desapareciam após o mês da morte e inflacionavam prazos/juros). Coerção numérica local (Supabase devolve numeric como string). Caso-ouro: A €500/20%/mín €50 + B €5.000/10%/mín €100, extra 0 → **45 meses / €1.126,94** (era 65/€1.519,63). **Correr `node --experimental-strip-types scripts/check-killdebt.mjs` depois de qualquer mudança em `killDebt.ts`** — e esse ficheiro só pode ter `import type` de `@/…` (um import de runtime com alias parte o script).

## Previsão de gastos (Premium, July 2026)

Deterministic month-end spend forecast — **no AI calls, no new tables, computed on read**. Designed by a 3-specialist panel (UX/data/integration), implemented + adversarially reviewed (10 confirmed findings fixed pre-ship).

- **Lib** `src/lib/spendForecast.ts` (pure, IO-free): baseline = recency-weighted (0.8^i) avg of ≤6 usable months (≥3 tx), winsorized at K≥3; pace = S / user's own day-of-month profile φ(d) (the salary-day fix); blend α=clamp(d/D,.10,.90); recurring floor via `normalizeDescription` keys (**remaining** amounts only — max(0, median−paid) — never double-count over/partial payments); honest confidence (low/med/high) + remainder-only range. Per-category baselines are **zero-inclusive** (absent months = real €0, else quarterly bills forecast at full monthly value) and Kc=0 categories are α-damped (day-1 one-offs must not pace-explode). All params in `FORECAST_PARAMS`.
- **API** `GET /api/forecast?overrides=` — premium-gated via `fetchPlanRow`, `code:'plan_required'`; one `Promise.all`; budgets-table-absent tolerated; demo payload. ⚠️ **PostgREST silently caps at 1000 rows** (no error!) — the tx query is `.order('date',{ascending:false}).limit(5000)` so a cap sheds OLDEST history, never the current month. Apply this lesson to any unbounded multi-month query — **default tool since Oct 2026: `fetchAll` from `src/lib/fetchAll.ts`** (pages with `.range` until a short page, returns `{ rows, truncated }`, THROWS on error; stable order MANDATORY: `.order(<date>, desc).order('id')`; never ignore `truncated` — warn/surface it). Used by `/api/account/export` (growing tables → `_warnings` when truncated; now includes `debts` + `debt_attacks`), `/api/transactions/export` (last-line note in the CSV + `X-Export-Truncated`) and `/api/recurring`. Big exports are sent via `streamText()` (`src/lib/streamText.ts`, ReadableStream — a buffered Vercel response >4,5 MB is a 413). Still unpaginated (backlog): summary 'all'/12m, cashflow, budget/history, notifications/send, reports/print, simulador. ⚠️ `transactions.original_description` is NOT a column (no migration creates it; only the import's merchant-cache key) — never select it on `transactions` (`/api/recurring` 500'd for everyone because of it).
- **UI**: `SpendForecast` widget **replaced SpendingVelocity** (absorbed — one month-end number per screen; free branch keeps velocity view + calm one-line teaser, no blur/crown). `/orcamento` shows per-bucket "Previsão: ~€X" (+overrun amber) + free teaser row. First component in the new Apple-calm language (neutral surface `#13161b`, hairline, amber as alarm ceiling — never red; `approxEur()` = ~€5-rounded, no cents, `~` single-sourced).
- **Hook** `useSpendForecast` — `enabled: isPaid` (free users never fetch); key `['forecast', overrides]`; invalidated by transaction mutations (useTransactions) and budget saves.
- **Mascot speaks it**: `forecastDelta` in mascotSpeak ctx — over vs BUDGET ("passas o orçamento"), under vs BASELINE ("abaixo do costume") — references must match copy; premium-only, ≥€10 deltas, never upsells.
- i18n prefix `predict.*` (+`pricing/billing.premium_f13`). Copy NEVER says "IA".

## Redesign Apple-style (FASES 1-5 SHIPPED, July 2026)

Owner-approved direction: **Apple restraint** — one green accent `#27c26b`, neutral surfaces (`#0b0d10/#13161b/#1b1f26/#242a33`), hairline borders, NO neon glows, strict type scale (min 11-12px), 8-pt spacing; the MASCOT is the one deliberately-alive element (Tamagotchi = the product's soul, per owner). Docs in repo root: `XP-MONEY-REDESIGN-BRIEF.md` (current-state extraction + direction) and `DESIGN-AI-PROMPT.md` (handoff prompt for design AIs). Direction artifact (v3) approved: egg-first narrative ("o dia um é um ovo", hatch at score 18-20 per real thresholds).

**Fases:** ✅ 1. Mascote viva (speech bubble + tap-to-talk no dashboard, `mascotSpeak.ts` shared brain, idle micro-bursts CSS). ✅ 1.5 Previsão de gastos (secção acima). ✅ **2. Token pass (SHIPPED July 2026, commits 9bde6a4→ed09e01)** — ver subsecção abaixo. ✅ **3. Navegação mobile (SHIPPED July 2026, ddee51d→c9caf66)** — regras: (a) `/transactions` chama-se **"Movimentos"/"Activity" em TODOS os breakpoints** (tab, sidebar, títulos TopBar+página) — NUNCA reutilizar "Contas" (colidia com /contas Património, era o bug de navegação nº1); (b) sheet "Mais" é **`MORE_GROUPS` agrupado** (Dinheiro/Progresso/Ferramentas/Conta, linhas 48px estilo Apple Settings com scroll interno) — não voltar à grelha de ícones; ícones = os da Sidebar (Crosshair missões, Sword dívidas); (c) **um add-CTA por viewport**: FAB é o único add em <lg, botão do header do dashboard é `hidden lg:flex` (só desktop, onde não há FAB) — `QuickActions` foi APAGADO, não recriar; (d) **TopBar = título/logo + sino + avatar, nada mais** — idioma vive no `LanguageSwitcher` de /settings, upsell vive nos momentos contextuais (banner dashboard free, paywalls), o badge Premium fixo morreu; TopBar mapeia títulos também para /contas /orcamento /dividas (reutiliza chaves `nav.*`). ✅ **4. Dashboard diet (SHIPPED July 2026)** — o dashboard é um GLANCE: header (saudação + `StreakChip` + add desktop-only) → herói (VoltixWidget 2/3 | Score+XP 1/3) → resumo do período (PeriodFilter + MonthlySummary + SpendForecast) → RecentTransactions → expander **"Análise detalhada"** (colapsado por defeito; contém ExpenseBreakdown/CashFlowChart/BiggestExpenses/RecurringExpenses — os chunks recharts só carregam ao expandir) → **UM** AdBanner feed no fundo. Regras: (a) NÃO re-adicionar secções ao feed do dashboard — widget novo ou vai para o expander ou substitui algo; (b) o 2º ad, o banner upgrade permanente e o ProToolsShowcase morreram — upsell é contextual (SpendForecast teaser free, paywalls, billing); (c) `StreakBanner` foi APAGADO (sucessor: `StreakChip` no header; celebrações 7/30 continuam no CelebrationModal do daily-checkin); (d) NetWorthWidget/DebtWidget/MissionCard/ProToolsShowcase foram APAGADOS no polish pós-Fase 5 (as páginas próprias já continham o conteúdo em versão completa; git history preserva-os). **Polish adicional shipped:** `purple-*` re-ancorado à família violet (#8b5cf6 = xp.purple = score.elite — UM roxo premium, mesma regra do verde); últimos glows roxos mortos (PricingPeriodToggle, card+CTAs da LandingPricing) e gradientes roxo→rosa do chrome achatados (Sidebar CTA, PremiumFeatureLock pill). CelebrationModal ficou deliberadamente intocado — confetti só em milestones genuínos + font-black é a exceção-wow. ✅ **5. Landing tighten (SHIPPED July 2026)** — cortados 3 blocos: `LandingAdvantages` (duplicava a Features — o próprio comentário do ficheiro o admitia; o banner anual duplicava o pitch yearly da Pricing), `LandingOutcomes` (stats fabricadas) e `LandingComparison`. Ficheiros APAGADOS (git history tem-nos); chaves i18n `landing.adv/outcomes.*` foram apagadas na onda B (continham números inventados); `landing.comparison.*` pode ainda estar órfã no dict (inofensivo). Fluxo final (out. 2026): Hero → HowItWorks → Features → MascotShowcase → **Founder** → FAQ (alimenta o FAQPage JSON-LD — nunca cortar sem repensar o schema; ordem [8,1..7] igual em `LandingFAQ.tsx` e no `faqs` de `page.tsx`) → Pricing → Newsletter → CTA → Footer. O bloco **Reviews foi SUBSTITUÍDO** por `LandingFounder` (ver "Landing honesta" abaixo); `LandingReviews`/`ReviewAvatar`/`public/avatars/review-*` foram APAGADOS (git history tem-nos). **Não re-adicionar blocos sem cortar outros.** A história do certificado NFT vive no FAQ; yearly pricing na Pricing. **Redesign concluído** — polish restante é incremental (roxo premium, CelebrationModal, etc.), não uma fase.

**Token system (Fase 2 — regras, não regredir):**
- **Superfícies**: `surface.0–3` no Tailwind (`#0b0d10/#13161b/#1b1f26/#242a33`) + `hairline`/`divider` (`white 8%/6%`). CSS vars em `globals.css` re-apontadas (background/card/primary/ring/border). Chrome novo usa `bg-surface-N`, nunca hex cru. `.glass-card` = surface-1/80 + hairline + sombra neutra `0_1px_2px_rgba(0,0,0,0.4)`.
- **UM verde `#27c26b`**: os ramps `green` E `emerald` do Tailwind foram AMBOS re-apontados para a mesma escala (emerald = alias de green ao nível do token — call sites `emerald-*` não conseguem reintroduzir um segundo tom). `brand.500` idem; `score.good` idem. Nunca acrescentar outro verde (teal/lime/mint) sem decisão do dono.
- **Zero glow colorido**: profundidade = superfície + hairline + sombra neutra. Não reintroduzir `drop-shadow`/`box-shadow` com cor (o padrão `0_0_Npx rgba(verde)` foi extinto). Exceções vivas deliberadas: título dourado do certificado (cursos/[id]) e o ponto "novidade" 2.5px.
- **Verde é semântico, não chrome**: focus rings, estados selecionados, sucesso/positivo, chips de estado MANTÊM verde (auditoria commit b04d4f7 confirmou que a maioria era legítima). Hover/default de cards = `white/10→20`, nunca verde.
- **Tipografia**: piso 11px (`text-[9px]/[10px]` extintos), peso máx 700 (`font-black` só em CelebrationModal + MascotEvolutionCinematic — momentos-wow). `reports/print` está EXCLUÍDO de sweeps (palete e tamanhos próprios de impressão, desenhados ao pixel).
- **Hexes de tema**: charts recharts, Clerk appearance (`colorPrimary #27c26b`, cards `#13161b`), emails e `manifest.json` (`theme_color #0b0d10`) já migrados. Ficam com valores próprios POR DESIGN: cores-semente de categorias/contas (dados persistidos — mudar só afeta users novos e des-sincroniza dos existentes), arte SVG das mascotes, paletas de confetti, GLSL dos shaders (assinatura desktop; o fallback mobile já está no verde novo).

## Landing honesta (out. 2026 — onda B, não regredir)

- **NUNCA reintroduzir números de utilizadores, notas médias, testemunhos ou avatares gerados que não sejam reais e verificáveis** (DL 57/2008 alterado pelo DL 109-G/2021, Diretiva Omnibus — prática comercial desleal da lista negra). Vale também para paywalls (`PremiumFeatureLock`/`StatementImporter`) e para claims de precisão (“~92%”) ou contagens (“40+ missões”) sem fonte. Sem `aggregateRating` no JSON-LD. Testemunhos reais só com consentimento escrito.
- **Bloco fundador** (`LandingFounder`, “Feito por uma pessoa, em Portugal”): sem nome nem foto até o dono fornecer os reais (decisão D2; o comentário no componente diz onde entram; nunca retrato gerado por IA).
- **FAQ**: a pergunta “Tenho de dar acesso à minha conta bancária?” (q8/a8) é a 1.ª e a única aberta por defeito. A copy distingue sempre o que é grátis (registo manual) do que é Premium (scan de talão, import PDF/CSV).
- **Pricing/billing**: certificados = “Certificado digital nos 3 cursos grátis” / “de todos os 7 cursos” (Premium) — sem a palavra “verificável” enquanto `certificates_2026_07.sql` não estiver confirmada em prod. `pricing.footer_note` fala do Passe Anual (MB WAY/Multibanco) — só manter se esses métodos estiverem ativos no Stripe.
- **Mobile**: hero com `grid-cols-1` + `min-w-0` nas colunas (sem isso o `truncate` alarga a track e o CTA é cortado <430px); nav com wordmark só ≥440px, botões 44px, `InstallAppButton iconOnlyMobile` (escondido <340px) e `LanguageToggle collapseOnMobile` (só o idioma inativo <sm). Zero blur-blobs no hero/CTA final.
- **Footer**: “Ferramentas grátis” → `/ferramentas`; “Academia” só volta quando existir página pública de cursos; links com `min-h-[44px]`.

## Retenção & navegação (out. 2026)

- **Deep link de registo**: `?add=1` (e o legado `?new=true`) é lido pelo `MobileNav` via `window.location` (sem `useSearchParams`) e abre o `TransactionForm` em qualquer rota da app, depois `router.replace(pathname)`. O shortcut do `manifest.json` e os pushes da classe `register` apontam para `/dashboard?add=1`.
- **Daily check-in** (dashboard) corre no mount (não espera pelo `useUser` do Clerk) e invalida `['voltix']`, `['xp']`, `['missions']` quando `!already_checked`; toast `streak.freeze_earned` quando ganha freeze. O efeito repõe `checkinDone.current=false` no cleanup (StrictMode de dev).
- **Push** (`/api/notifications/send`): usa o nome REAL da mascote (`users.mascot_gender` + `voltix_states.evolution_level` → `EVO_NAMES`/`PENNY_EVO_NAMES` de `mascotMeta.ts`); bancos de mensagens sem texto específico do dragão/Voltix.
- **Nav e plano**: `Sidebar`/`MobileNav` usam `useUserPlan().isFree`; o chip `t('nav.badge_premium')` e o cartão de upgrade só aparecem a free e só em `/perspetiva` e `/simulador`. `/dividas` e `/cursos` NÃO levam badge (têm parte grátis).
- `DebtForm` segue o padrão sem dead-end: `disabled` só durante `submitting`, `noValidate`, erros inline com `role="alert"` + `aria-describedby`.

## Património / Net Worth (`/contas`)

The app is **flow-based** (tracks transactions, computes score from flow); `accounts.balance` was vestigial (onboarding makes one `'Conta Principal'` at €0, no UI ever set it, transactions never touch it). The `/contas` page makes it an **honest manual net-worth SNAPSHOT** — NOT a reconciled real-time balance (the flow model can't guarantee that, so we don't pretend). User sets each account's balance; net worth = assets − liabilities.

- **Math + type metadata**: `src/lib/netWorth.ts` — `computeNetWorth(accounts)`, `ACCOUNT_TYPE_META` (label key + icon + `isLiability`), `ACCOUNT_TYPES`. `credit` is the only liability type (balance = money owed → subtracts).
- **API**: `/api/accounts` (GET+POST, existing) + `/api/accounts/[id]` (PATCH balance/name/type/icon/colour, DELETE). **DELETE is blocked (409 `account_has_transactions`) when the account has transactions** — the FK is `ON DELETE CASCADE`, so deleting would silently wipe history. Both ownership-guarded via `resolveUser` + `.eq('user_id', internalId)`.
- **Hook**: `useAccounts()` now exposes `createAccount` / `updateAccount` / `deleteAccount` mutations (invalidate `['accounts']`).
- **Dashboard**: o antigo `NetWorthWidget` foi APAGADO no pós-Fase 4 (o dashboard é um glance; o património vive em `/contas`, um toque no sheet Mais → Dinheiro). `NetWorthTrend` (o chart em `/contas`) continua vivo — não confundir os dois.
- Balance edits commit on blur (inline), use `parseAmountLocale` (PT comma + EN dot). Fully PT/EN.
- **Trend** (`NetWorthTrend` on `/contas`): net-worth area chart over time. Built from `net_worth_snapshots` — `recordNetWorthSnapshot(db, userId, today)` (`src/lib/netWorthSnapshot.ts`) upserts one row/day **on every account create/update/delete** (no cron — each balance edit is a data point). Read via `GET /api/networth/history?days=N`. **Both the writer and reader degrade silently when the `net_worth_snapshots` table is absent** (migration `database/net_worth_snapshots_2026_05.sql` — see Pending user actions), so `/contas` works before the migration; the chart just stays empty (and shows a "history builds here" hint at 1 point, nothing at 0).

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
- TRANSACTION_REGISTERED: 15 — com **recompensa variável (julho 2026)**: ~10% de "crítico" 3-5× decidido SERVER-side em `/api/transactions` POST (nunca no cliente); a resposta traz `xp: {amount, critical}` e o TransactionForm celebra. DELETE de transação **reverte 15 XP** (clamp a 0) — o farm criar/apagar morreu.
- DAILY_LOGIN: 25 · GOAL_CREATED: 100 · STREAK_7_DAYS: 300 · STREAK_30_DAYS: 1000 · **STREAK_60_DAYS: 1500 · STREAK_100_DAYS: 3000** · GOAL_REACHED: 1000
- **LEVELS 11-19 existem** (21k→92k XP; o deserto 10→20 que congelava a barra ~4 anos foi preenchido). Nomes i18n em `level.name_*`.
- **Streak freeze (julho 2026)**: falhar EXATAMENTE 1 dia com streak ≥3 e freeze disponível → streak continua; ganha-se +1 a cada marco de 7 (cap 2); recorde em `longest_streak`. Mecânica no daily-checkin com fallback 42703 pré-migração. `POST /api/xp` foi REMOVIDO (era um exploit: qualquer user autenticado dava-se 100k XP) — XP é 100% server-side via awardXP; nunca reintroduzir com amount vindo do body.
- **Missões renovam** (julho 2026): GET /api/missions expira vencidas e re-semeia lote de 3 (validade 7 dias) quando não há ativas, rodando pelos 7 templates via contagem histórica — nunca voltar ao seed único do onboarding. O re-seed conta só ativas NÃO vencidas (uma vencida cujo pagamento falhou não bloqueia o lote novo).
- **XP de missões é pago APENAS por `completeMission()`** (`src/lib/missions/complete.ts`, out. 2026 — não regredir; antes as auto-concluídas nunca pagavam e o `/complete` pagava qualquer 'active' a 0% = farm por curl): exige `current_value >= target_value`, recusa expired/locked, claim condicional `.eq('status','active').select('id')` (só quem muda a row paga), probe no ledger pela reason `mission_completed:<id>` e paga via `awardXP`; se a probe/awardXP falhar ANTES de escrever, `releaseClaim()` devolve a missão a 'active' (retry real no próximo tick). `updateMissionProgress` NÃO completa: deixa 'active' com current=target e devolve `readyIds`; o chamador paga com `completeReadyMissions()` em SÉRIE e DEPOIS do seu `Promise.allSettled` (nunca dois awardXP concorrentes no mesmo pedido). `recalculateScore` só recolhe ids via `opts.readyMissionIds`, nunca paga. POST `/api/transactions` paga com await (não `after()` — o cliente invalida `['missions']`/`['xp']` no 201) e devolve `missions_completed`; o daily-checkin paga dentro do seu `after()`; GET `/api/missions` paga as vencidas que estavam no alvo antes de expirar o resto. `/api/missions/[id]/complete` = claim manual com `guardUser` 20/h (404 / 409 `mission_not_ready` / 200 `{already:true}` / 200 `{xp}`). **Legacy 'completed' sem pagamento → `already` em código; só o backfill SQL as paga** (atómico; um CAS em código não fecha a race). ⚠️ `awardXP` é read-modify-write: o `after()` do checkin e o GET de missões podem sobrepor-se a outro pedido e perder um incremento — o fix real é o RPC atómico (perf-api-7).
- **Streak clock**: `voltix_states.last_interaction` é o relógio do streak e SÓ o daily-checkin o escreve (mais onboarding/reset no estado inicial). GET `/api/voltix` (sync de humor) e a evolução da mascote já NÃO o escrevem — não reintroduzir (corriam antes do check-in num dia novo e o streak ficava parado). 1.º check-in no dia do onboarding = dia 1 (`Math.max(1, streak_days ?? 0)`).
- **Certificados persistidos**: `/api/courses/[id]/complete` garante row em `certificates` (idempotente, code permanente); GET `/api/certificates/[courseId]`; verificação pública `/verify/[code]` (rota pública no middleware). Incluídos no reset (wipe) e no export RGPD.

## Mascot system

Two mascots × 6 evolutions: **Voltix** (male, thunder dragon — names Voltini→Voltito→Voltix→Voltaryon→Magnavoltix→Imperivoltix) · **Penny** (female, angel cat — Pennini→Pennito→Penny→Pennyara→Pennael→Seraphenny).

- Render: `<MascotCreature gender evo mood animate />` tries `/mascot/<gender>/<n>.webp` (512×512) → `onError` fallback to SVG `VoltixCreature`/`PennyCreature`. Never broken UI.
- Gender resolution (`src/lib/mascotGender.ts`): `localStorage > DB > 'voltix'`. `/api/voltix` sends `null` when DB has no value so localStorage isn't shadowed.
- **Evolution is SCORE-based + monotonic + PACED** (`src/lib/mascotEvolution.ts` + `maybeEvolveMascot` em `recalculateScore.ts`).
  - Thresholds (May 2026 tune): `{2:18, 3:38, 4:60, 5:80, 6:95}` · XP bonuses: `{2:300, 3:500, 4:900, 5:1500, 6:3000}`.
  - **Pacing (julho 2026 — NÃO remover): score alto sozinho não evolui o bicho.** Bug real: 1 receita numa conta nova → poupança 100% + controlo perfeito = ~51 pts → ovo saltava direto para evo 3 no primeiro registo. Três guardas em `maybeEvolveMascot`: (a) **+1 nível por evento** (nunca saltar formas; bónus = só o passo dado); (b) **cooldown 20h** entre evoluções, lido do `xp_history` reason `mascot_evolved_to_%` (sem DDL) — o hatch 1→2 é ISENTO (dopamina do dia 1 é sagrada); (c) **`EVO_MIN_ACTIVE_DAYS`** = dias ativos distintos lifetime `{3:5, 4:14, 5:30, 6:60}` (probe `activeDaysSince()` só corre no ramo de evolução, fora do hot path). Quando o score já chega mas o pacing trava, o mascotSpeak diz `mascot.speak.evo_ready` ("sinto a próxima forma a chegar") em vez de "faltam 0 pontos".
  - **"Dias ativos" = `activeDaysSince(db, userId, {since?, stopAt?})`** (`src/lib/activeDays.ts`, out. 2026): dias civis distintos em **Europe/Lisbon** no `xp_history` (reasons `daily_login` + `transaction_registered`), paginado até 5000 rows / `stopAt`; erro → 0 (fail closed). **NUNCA usar `transactions.date`** (vem do extrato/cliente: um import de 3 meses fabricava dias e saltava o pacing). O cooldown de 20h lê **`xp_history.earned_at`** — a coluna `created_at` NÃO existe no xp_history (até out. 2026 o cooldown estava morto por um 42703 descartado); erro na probe → não evolui.
- **Tamagotchi layer (July 2026):** the pet SPEAKS on the dashboard — `src/lib/mascotSpeak.ts` is the ONE shared voice brain (contextual hooks first: egg-hatch progress from real `EVO_SCORE_THRESHOLDS` via `nextEvoProgress()`, streak≥3, premium forecast delta; then the `voltix.mood_*_1..3` trio rotated by day). Deterministic, no Math.random. `VoltixWidget` renders a SpeechBubble + tap-to-talk (button, keyboard-accessible; card is NOT a giant Link — CTA navigates); `/voltix` page uses the same brain. Idle "bursts of life": `animate-mascot-hop` (9s cycle) / `animate-egg-nudge` (12s) on the raster `<img>` — occasional motion reads alive, constant reads GIF; reduced-motion gated. New speak lines need PT+EN keys (`mascot.speak.*`).
- Cinematic: 5-stage framer-motion timeline in `MascotEvolutionCinematic.tsx` + Web Audio SFX. Preview via `?previewEvo=2-3`. (The old per-evolution `evo-*.mp4` clips were removed in the June 2026 art refresh — they don't drive the cinematic and went stale when the mascots were redesigned. New clips TBD.)
- **Landing hero** (`LandingHero.tsx`) shows `/mascot/hero-v2.webp` (the "imagem de abertura" — Voltix warrior holding a phone with the app) as a **plain full-colour image, NO glow/shadow** (the user disliked effects). Old `PlatedMascot` retired + deleted. The `-v2` suffix is a cache-bust (renamed because same-filename updates kept serving stale).
- **Brand icons (June 2026, all = the ONE "ICONE APP" green device mark):** nav `Logo.tsx`, favicon `src/app/icon.png`, `apple-icon.png`, `manifest.json`, PWA install prompt header, and Org/Product JSON-LD all point at `/app-icon.webp`. (`FAVICOIN` dark-XP tile → `/logo-icon.webp`, now unused after the user asked for ICONE APP everywhere.) Evolution-chart banner was REMOVED from `LandingAdvantages.tsx`.
- **Visual identity refresh (June 2026):** all 12 mascot WebPs + hero + evolution sheets replaced with pro art. **Pipeline (reproducible, Python — rembg+scipy+PIL installed):** source PNG → `rembg` **`birefnet-general`** model (cleanest on these sources; u2net/isnet left artefacts) → core-solid belly: `scipy.ndimage.binary_fill_holes(alpha>170)` eroded 1px set to opaque (the cream belly is enclosed by the dark outline; this stops it going transparent→"black belly") → outer-edge de-fringe `clip((a-55)*1.7,0,255)` (kills white halo) → autocrop → fit 512×512 → WebP q90. **Evolution sheets** (`evolucoes-{voltix,penny}.webp`) are COMPOSITED from the 6 clean individuals (not re-keyed from the messy source sheet). **Voltix filename GOTCHA:** `IMPERIALVOLTIX.png`=evo-5 (Magnavoltix, muscular), `MAGNAVOLTIX.png`=evo-6 (Imperivoltix, 3-headed boss) — map by power-order. **Cache-bust:** bump `MASCOT_ASSET_VER` in `MascotCreature.tsx` (currently `'7'`) AND the hardcoded `?v=` in `LandingMascotShowcase.tsx` together on every re-cut.
- **✅ RESOLVED 2026-06-27 — checkerboard remnants (commit `6f370e2`):** the source PNGs bake a **checkerboard fake-transparency** background (flat RGB, NO real alpha — confirmed: only `Pennini.png` is RGBA, the other 13 are RGB). birefnet left grey/white checker stuck in concave pockets where it's the same neutral as the cream belly; colour/hole-fill/connected-component all failed (single component, belly-coloured). **Key that cracked it: the checker is ACHROMATIC** (R=G=B, two flat greys ~242/254) whereas the cream belly & Penny's white fur are **WARM (R>B by 15-47)**. The cutter (`checker_region` in the pipeline) keys `chroma≤6 & min≥224` AND local-std texture, dilates, re-intersects with the achromatic key → removes checker incl. **enclosed** pockets birefnet keeps, sparing the smooth warm belly. Fixed voltix-3/4/6 cleanly. **Penny is white-on-white** (whole textured body reads achromatic → an automatic pass nibbles fur tips), so Penny's clean shipped cuts were KEPT and only **penny-4's hip/ribbon pocket** was removed via a tight ROI surgical pass. Verify any re-cut by compositing over **navy AND magenta AND black** (black reveals opaque checker best). Source folders: `…\xp mascotes\MASCULINO\PNG VOLTIX\` + `…\FEMININO\PNG PENNY\`. **If the art is ever re-done, real-alpha source exports (remove.bg) remain the simplest path** and would let Penny use the same automatic pass.
- **⚠️ July 2026 correction (v7, user-reported "ovo com cores bugadas"):** the v6 achromatic pass ALSO ate bright interior highlights on Voltix (egg's yellow-bolt white-hot core, eye sparkles, white claws, evo-6 silver tabard — specular whites ARE achromatic+textured, same signature as checker). **Full-figure automatic passes are DONE — never re-run one over a shipped-clean mascot.** v7 repair (in `public/` now): voltix 1/2/5 restored to their pre-v6 cuts; voltix 3/4/6 = pre-v6 base + v6 alpha applied ONLY on removal-components ≥200 px (the true checker pockets; small components = highlight damage, reverted). Verify any future cut at FULL RES over navy+black — the damage was invisible at 340 px thumbnails.
- Raw PNGs in `public/mascot/raw/` + `raw-clean/` are **gitignored** — commit only processed WebPs.

## Site-wide visuals

- **Neon Grid wallpaper** (`SiteBackground` mounted in root layout). **O gradiente estático renderiza SEMPRE** (pintado desde o SSR, sem estado); o shader WebGL2 só monta numa **camada irmã por cima**, com fade-in de 700 ms no primeiro frame (`onReady`), em `(min-width: 1024px) and (pointer: fine)` e **FORA das rotas da app** (`APP_ROUTE_PREFIXES` em `SiteBackground.tsx` — o `.dashboard-bg` opaco tapava-o; `/onboarding` fica de fora da lista porque o seu `<main>` é transparente). **Nunca voltar a trocar a subárvore por estado** (CLS 0,23 medido em desktop). Rota nova da app → acrescentar o prefixo a `APP_ROUTE_PREFIXES`. `ShaderCanvas` renderiza a 0.75× do DPR (máx. 1×) a ~30 fps; `NEON_GRID` é export nomeado de `shaders.ts` e só entra via `NeonShaderLayer.tsx` (chunk dinâmico — o mobile nunca descarrega o shader). Os outros 4 shaders (Aurora, Voronoi, Metaballs, Starfield) ficam em `shaders.ts` para um futuro theme picker.
- `body` is **transparent**; `html` keeps `bg-background` as flash-of-unstyled protection. Root layout wraps `{children}` in `relative z-10` so content always sits above the fixed `z-0` backdrop.

## Reset endpoint

`DELETE /api/transactions/reset` requires `{ confirm: "APAGAR" }`. Updated April 2026 — true factory wipe (was: kept badges + completed missions; user reported it as a bug because Mata-Dívidas + missions stayed):

**Wipes (full delete):** `transactions`, `xp_history`, `financial_scores`, `goal_deposits`, `goals`, `debts` (cascades to `debt_attacks`), `missions` (active AND completed), `user_badges`, `budgets`, `net_worth_snapshots` (accounts + balances kept, but the net-worth trend history is post-onboarding activity → wiped).

**Resets in-place:** `xp_progress` (xp_total → 0, level → 1, streak → 0), `voltix_states` (evo 1, mood neutral, streak 0).

**Keeps:** `users` (the account), `accounts` (bank-account config), user-created `categories`, `subscriptions` (data wipe ≠ Stripe cancel — user does that separately).

Client also clears `localStorage['xpmoney:mascot_last_evo']` and (on full account delete via `/api/account`) `xpmoney:cookie-consent`. Each delete in `Promise.allSettled` so older Supabase projects without `debts`/`budgets` tables don't break.

## Account erasure (RGPD Art. 17)

`DELETE /api/account` requires `{ confirm: "APAGAR-CONTA" }`. Different from reset — this nukes the account itself:

1. Cancel Stripe subscription immediately (`prorate: false`, terms accepted no-refund). Idempotent — no-op if already cancelled.
2. Sweep `users.referred_by → NULL` for any referees (the FK has no ON DELETE clause, would otherwise block).
3. Delete the `users` row → cascades through every child table.
4. `clerk.users.deleteUser(clerkId)`.

Done LAST so a Clerk outage doesn't leave half-erased data; on Clerk failure returns `{ partial: true }` with a friendly message. Client (`PrivacyCards`) does `signOut({ redirectUrl: '/' })` after.

## Data export (RGPD Art. 20)

`GET /api/account/export` streams a `xpmoney-export-YYYY-MM-DD.json` with every user-scoped row across 15 tables (incl. `net_worth_snapshots`). Each secondary table wrapped in try/catch → missing migration produces partial file with `_warnings` array, never 500. Strips `clerk_id` from the user row before emitting (internal reference, not user data).

## Blog (`/blog`)

MDX-based, filesystem source of truth. Layout:

```
content/blog/<slug>/
  index.pt.mdx     ← canonical, mandatory
  index.en.mdx     ← optional; EN reader falls back to PT (chip "Em PT")
```

Frontmatter (gray-matter): `title`, `description`, `date`, `keywords[]`, `updated?` (YYYY-MM-DD; alimenta JSON-LD `dateModified`, `og:modified_time` e o `lastModified` do sitemap — datas YAML sem aspas são normalizadas por `normalizeIsoDate()`), `author?`, `ogImage?`, `draft?`. Reading time auto-computed (~220 wpm). Drafts hidden in production, visible in dev.

- `src/lib/blog.ts` — `getAllPosts(locale)` / `getPostBySlug(slug, locale)` / `getAllSlugs()`. Server-only.
- `/blog` index — server component, lists newest-first.
- `/blog/[slug]` — server component renders MDX via `next-mdx-remote/rsc` + `remark-gfm`. Pre-renders all slugs at build via `generateStaticParams()`.
- Each post emits `BlogPosting` + `BreadcrumbList` JSON-LD via `lib/seo/jsonLd.ts → article()`.
- Sitemap (`src/app/sitemap.ts`) aggregates posts dynamically (`lastModified` = `updated ?? date`; sem `priority`/`changefreq`; entradas estáticas com data escrita à mão — ao mudar substancialmente landing/contacto/legais, atualizar a data em `sitemap.ts`) — no redeploy needed when publishing.
- **og:image por artigo**: `src/app/blog/[slug]/opengraph-image.tsx` (1200×630, fundo `#0b0d10`, só o verde da marca, sem glow, sem WebP); `generateMetadata` define `openGraph.images`/`twitter.images` explicitamente (`ogImage` do frontmatter sobrepõe). O fallback de imagem do JSON-LD `article()` aponta para essa rota (antes apontava para uma imagem 404). `src/app/opengraph-image.png` tem de ficar < 250 kB (WhatsApp ignora previews > ~300 kB; está em ~87 kB) e `icon.png` é 48×48.
- **Slugs evergreen + 308**: os 4 slugs com “2026” foram renomeados e `next.config.ts → redirects()` tem 4 entradas `permanent:true` (308) dos antigos para os novos. Não renomear slugs publicados sem acrescentar o redirect.
- **Regra YMYL (blog + cursos)**: conteúdo fiscal/financeiro só com números confirmados em fonte primária (Portal das Finanças, CIRS, EBF, DR) e link no texto; o que não se confirma, retira-se. Nunca preços/estatísticas de concorrentes sem fonte (art. 16.º Código da Publicidade). Cursos de investimento: sem tickers nem corretoras concretas, só critérios (índice, ISIN/KID, custos, domicílio e tributação PT, intermediário regulado/CMVM), com o disclaimer “Conteúdo educativo. Não é aconselhamento financeiro nem recomendação de investimento.” no topo das lições. Rever os artigos fiscais anualmente.
- Tailwind `prose prose-invert prose-emerald` (via `@tailwindcss/typography` plugin) styles the content.
- Soft conversion CTA ("Try it free") at the foot of every post.

**Currently published (8 articles; only #1 has an EN version):**
1. `alternativas-ynab-portugal` (PT+EN) — comparison content; só o YNAB tem preço (de ynab.com, com data), restantes afirmações com fonte
2. `deducoes-irs` — seasonal SEO (April-June); 8 deduções, cada número com link ao Portal das Finanças; tem `updated`
3. `extracto-cgd-30-segundos-ia` — feature demo, drives Premium
4. `regra-50-30-20-salario-portugues-1300` — authority + drives `/orçamento`
5. `porque-apps-financas-desistem-de-ti` — contrarian, viral on socials
6. `subsidio-de-ferias` — seasonal SEO (June, subsídio de férias lands), high-intent windfall guide → funnels to goals/Mata-Dívidas; cross-links #4 + #2
7. `reembolso-irs` — seasonal SEO (June/July, IRS refunds land), contrarian "refund = you lent the State at 0%" angle + PT-specific withholding nuance; forms a 2-piece windfall cluster with #6 (mutual cross-links) + links #2

8. `subsidio-de-natal` — seasonal SEO (Nov/Dec, prazo até 15/12; art. 263.º CT, TSU 11%, retenção autónoma art. 99.º-C CIRS); liga às 2 ferramentas grátis + #6 + #7

**Seasonal cluster (#6 + #7 + #8):** subsídio-de-férias, IRS-reembolso and subsídio-de-natal cross-link each other + #2 — "windfall" cash-window content cluster (June/July, then Nov/Dec). Distribution kit (LinkedIn/X/IG/communities copy + UTM-per-channel advice) was delivered in-chat, not committed.

Marketing roadmap planning lives in MARKETING.md (gitignored).

## Ferramentas grátis públicas (`/ferramentas`, out. 2026)

Hub `/ferramentas` + `/ferramentas/regra-50-30-20` + `/ferramentas/calculadora-subsidio-de-natal`: a maior alavanca orgânica sem marca. Rotas PÚBLICAS (verificado por `check-guards`; testar sempre com curl sem sessão).

- **Template único** `ToolShell` (server, `src/components/tools/`: breadcrumb + `WebApplication` + `FAQPage` JSON-LD, “Como calculamos”, fontes, “Verificado a”, FAQ em `<details>`, CTA calmo) + **UMA ilha client por ferramenta**. Registo em `src/lib/tools/registry.ts` (alimenta o hub e o sitemap; `updated` = data da última revisão → “Verificado a” e `lastmod`). Nova ferramenta = entrada no registry + página + chaves `tools.<id>.*` PT+EN + casos-ouro em `scripts/check-tools.mjs`.
- **Regras (não regredir):** sem Clerk, PostHog, recharts, framer-motion nem `fetch` na ilha (First Load ≈ blog); **NENHUM valor financeiro no URL/query/fragmento** (o CTA leva só `?ref=tool-…`); rótulos traduzidos no servidor e passados por props (a ilha não carrega o dicionário); resultado em `<output aria-live="polite">`; nunca `disabled` por validação (`AmountField` mostra erro inline); a copy nunca diz “IA”; **todo o número leva fonte + data**.
- **Matemática** em `src/lib/tools/*.ts` SEM imports de runtime (corre em `node --experimental-strip-types scripts/check-tools.mjs`). `amountText.ts` trata um grupo separador + exatamente 3 dígitos como milhar (“1.300” = 1300, não 1,3); taxas usam `{ percent: true }` (“7.500” = 7,5%).
- **Subsídio de Natal**: NÃO embutir tabelas de retenção de IRS (YMYL, mudam todos os anos) — o utilizador indica a taxa do recibo; taxa inválida não calcula, taxa em branco calcula a 0% com nota âmbar. Base legal: art. 263.º CT, TSU trabalhador 11%, art. 99.º-C n.os 5-6 CIRS (a taxa pode diferir da do salário mensal). Rever os números todos os anos (nov.) e atualizar `updated`.
- O `PostHogProvider`/AdSense do root layout ainda se aplicam a estas páginas (decisão D1, até ao refactor de providers) — a ilha em si não toca em analytics.

## Newsletter pipeline

Double-opt-in (RGPD + ePrivacy), Resend backend.

- DB: `newsletter_subscribers` table — `email` UNIQUE, `locale`, `source`, `status` (pending|active|unsubscribed|bounced), `confirm_token`, `unsubscribe_token` (both 256-bit random hex, separate so we can rotate independently), `signup_ip`/`signup_ua` for forensics. Migration: `database/newsletter_2026_04.sql`. RLS: service-role only.
- `POST /api/newsletter/subscribe` — public, rate-limited (3/5min + 30/day per IP+UA), honeypot field. Branches on existing-row status: new → insert pending; pending → resend same token; active → silent no-op (anti-enumeration); unsubscribed → flip to pending with rotated tokens.
- `GET /api/newsletter/confirm?token=…` — flips pending → active, fires welcome email, redirects to `/newsletter/confirmed?status=ok|already|invalid`.
- `GET + POST /api/newsletter/unsubscribe?token=…` — POST mirrors GET so Gmail's `List-Unsubscribe-Post` works. Idempotent.
- Both `/newsletter/confirmed` and `/newsletter/goodbye` are noindex,nofollow — landing-from-email only.
- Component: `src/components/common/NewsletterSignup.tsx` (variants `default` and `inline`, has hidden honeypot field). Mounted on landing between Pricing and Final CTA.
- Email templates in `src/lib/email.ts`: `sendNewsletterConfirmation` (no unsubscribe footer — they're not on the list yet) + `sendNewsletterWelcome` (mandatory unsubscribe footer from here on).

## Email infrastructure (`src/lib/email.ts`)

Resend backend. Graceful no-op when `RESEND_API_KEY` or `ADMIN_EMAIL` missing — logs warn, never crashes the caller.

- `notifyAdmin({ subject, html, replyTo })` — admin-facing (xp-money → admin). Used by `/api/bug-report` and `/api/contact-message` after the DB row is saved (fire-and-forget, never blocks the user response).
- `sendNewsletterConfirmation(email, locale, actionUrl)` — recipient-facing, no unsubscribe footer.
- `sendNewsletterWelcome(email, locale, actionUrl, unsubscribeUrl)` — recipient-facing, mandatory unsubscribe footer.
- `escapeHtml(s)` — exported, mandatory before embedding user-submitted text in email HTML.
- Sender default: `XP-Money <onboarding@resend.dev>` (Resend's testing sender, works without domain verification). Override with `EMAIL_FROM` env when xp-money.com domain is verified in Resend.
- All shells use inline styles (Gmail strips `<style>`).

## RGPD compliance

- **Cookie consent banner** (`src/components/common/CookieConsentBanner.tsx`) — gates PostHog init (`PostHogProvider` waits for `xpmoney:consent-changed` CustomEvent OR a stored "accepted" decision). Equal visual weight on Accept/Reject (CNPD has fined sites with buried Reject). 6-month renewal window. State in `localStorage['xpmoney:cookie-consent']`.
- **`src/lib/consent.ts`** — single source of truth: `getConsent()`, `setConsent('accepted'|'rejected')`, `clearConsent()`. Broadcasts `CONSENT_EVENT` for cross-component reactivity.
- **PostHog** — uses `opt_out_capturing_by_default: true` as belt-and-braces (any imported helper that fires `capture()` before init still won't leak).
- **Account erasure** + **export** — see Reset endpoint section above.
- **Privacy policy** — `src/app/(legal)/privacidade/page.tsx`. Updated April 2026 to disclose newsletter subscriber processing (email + locale + signup IP/UA, kept until unsubscribed, double opt-in mandatory). Still flagged as TEMPLATE — validate with a lawyer before serious traffic.
- **Textos legais coerentes com o que o site faz (out. 2026, não regredir):** `privacidade` lista os subcontratantes reais (Clerk, Supabase Frankfurt, Vercel com funções em Frankfurt, Stripe, Google Gemini + AdSense, Groq, Resend, PostHog opcional) e a finalidade/base legal da publicidade no plano grátis; `cookies` declara o AdSense (Google Ireland), o PostHog como analítica opcional só com consentimento, o Vercel Analytics sem cookies e o cookie `xpmoney-locale` (1 ano). `consent.body` NÃO pode voltar a dizer “não usamos publicidade” nem prometer uma mensagem de consentimento da Google que não esteja verificada em AdSense > Privacidade e mensagens; `landing.features.c8_desc` = “Não vendemos os teus dados. Nunca.” (nunca “zero partilha com terceiros”; o mesmo vale para `landing.faq.a1`, que alimenta o FAQPage JSON-LD). Evitar cláusulas datadas tipo “hoje inativa”. Continuam TEMPLATE: validar com advogado.

## Service worker + deploy skew (July 2026)

`public/sw.js` caches: `_next/static` + images/fonts cache-first (content-hashed/version-busted → safe), HTML navigations **network-first with 4 s timeout → cache fallback** (offline boot still works). **Never serve HTML cache-first/SWR**: v2 did stale-while-revalidate on navigations and every deploy produced "Loading chunk N failed" (stale HTML → dead chunk hashes). Bump `STATIC_CACHE`/`RUNTIME_CACHE` version strings when changing cache LOGIC (**now `xpmoney-static-v4` / `xpmoney-runtime-v4`**). **Precache = `['/', '/manifest.json', '/app-icon.webp']`, fetched + `cache.put` ONE BY ONE with `Promise.allSettled`** (never atomic `addAll`: it failed forever on `/dashboard` (307) and `public/icons` (non-existent) so nothing was ever cached offline); no `redirected` or `!ok` response is ever stored; push icon/badge = `/app-icon.webp`. `ServiceWorkerRegistrar` only reloads on a SW update if there was already a controller (`hadController` captured before `register()`) — otherwise the 1st install reloaded the page. Belt-and-braces: `ChunkErrorRecovery` (root layout, renders null) listens for chunk-load errors globally and hard-reloads at most once/minute — covers tabs left open across a deploy. If a user reports this error again: it self-heals on reload; check `vercel ls` for a deploy that happened at that moment.

## PWA install UX

`src/components/common/PWAInstallPrompt.tsx` (auto-prompt, mounted in root layout) + `InstallAppButton.tsx` (manual CTA in landing nav).

- Chromium browsers: capture `beforeinstallprompt`, surface native install via `event.prompt()`. Auto-prompt fires after 5s delay; manual button bypasses any cooldown.
- iOS Safari: no `beforeinstallprompt` API exists (Apple never implemented it). Detection via UA → instructional card with the actual Share → "Add to Home Screen" steps + icons. Pretending a button works on iOS is the worst UX possible — don't do it.
- Hidden when already standalone (`display-mode: standalone` OR `navigator.standalone`) or dismissed within 14 days.
- Communication between prompt and button via window CustomEvents: `AVAILABLE_EVENT` (prompt → button: "I confirmed an install path is real, you may render") and `OPEN_EVENT` (button → prompt: "user clicked, open the modal now").

## Admin operational pages

All gated by `ADMIN_CLERK_ID` env (the admin's Clerk user_id). 404 stealth response for everyone else — admin pages "don't exist" for non-admins.

- **`/admin/setup`** — env-var presence checks (`process.env[name]` only, never logs values), DB migration checks (`select count head` + catch "relation does not exist"), and a list of manual actions (Stripe portal toggle, AT registration, Resend domain DNS, Search Console verification) with one-click external links. Single ground-truth view for the post-launch wait-and-measure phase.
- **`/admin/metrics`** — MRR / ARR / ARPU / conversion / signups 7d-30d / engagement (DAU/MAU via `xp_progress.last_activity_at`) / AI cache hit rate / Stripe webhook health + 30d cancellations / churn estimate. Defensive — every secondary query in try/catch with inline `_warnings` so a missing migration never blanks the page. Yearly subscribers counted as monthly (over-estimates MRR until `subscriptions.cycle` column lands).
- **`/admin/bugs`** — triage queue for `bug_reports` table (`type='bug'` + `type='contact'`).
- **`/admin/mascot-upload`** — admin-only mascot WebP upload.
- **Vigia diário `GET /api/cron/vigia`** (Vercel Cron 07:00 UTC, maxDuration 60, Bearer `CRON_SECRET`; público no middleware via `'/api/cron/(.*)'`). Re-verifica os incidentes que só foram descobertos semanas depois: Googlebot UA com `redirect:'manual'` recebe 200 em `/`, `/blog`, um artigo, `/termos`, `/sitemap.xml`, `/robots.txt`, `/ads.txt` (um 307 falha); rota inexistente = 404; publishable key Clerk = `pk_live_`; região `fra1`; webhook Stripe sem endpoint xp-money.com `disabled` e ≥1 `enabled`; `RESEND_API_KEY` não vazia. Falha → `notifyAdmin` (HTML via `escapeHtml`). Nunca expõe valores de envs (só presença/comprimento). **Ao criar uma rota pública nova ou ao fechar um incidente novo, acrescenta-lhe um check aqui.**

## SEO — structured data + Twitter cards

- **`src/lib/seo/jsonLd.ts`** — locale-aware helpers: `organization()`, `website()` (NO SearchAction — there is no site search; `alternateName ['XP Money','XPMoney']` on org + website), `softwareApplication()` (FinanceApplication category, FAQPage feature list, monthly Offer), `faqPage(qas)`, `premiumProduct(locale)` (monthly + yearly Offers), `breadcrumb(items)`, `article(post)` (BlogPosting).
- **`src/components/seo/JsonLd.tsx`** — server component that emits `<script type="application/ld+json">`. Escapes `<` to `<` to prevent breakout via attacker-controlled answer text.
- Mounted: Organization + WebSite in root layout (every page); SoftwareApplication + FAQPage + Product on landing; BreadcrumbList on legal pages + contact + every blog post; Article on each blog post.
- **Twitter Cards**: `summary_large_image` in root metadata. Without this, links shared on X render as plain blue links. **No `twitter:site`/`twitter:creator`** until the owner confirms an X account (they pointed at an unconfirmed handle).
- **Root layout has no `preconnect`/`dns-prefetch`** (`clerk.xp-money.com` is NXDOMAIN, the browser never talks to Supabase). Add hints only in layouts that really need them.
- **`robots.ts` deliberately does NOT block `/dashboard`, `/settings`, `/transactions`** (it keeps `/admin`, `/api`, `/onboarding`, `/reports`): crawlers must see the 307 to drop already-indexed URLs. `sign-in`/`sign-up` are `noindex,follow` with their own canonical (layouts in `src/app/(app)/sign-*/`). `/verify` and `/verify/[code]` are `noindex,follow`.
- **Certificados**: `/verify` (entrada manual, form GET sem JS) redireciona para `/verify/<CODIGO>`; `/verify/[code]` devolve 404 real para código inexistente (falha de leitura/tabela em falta continua 200 com cartão “não encontrado” — para não cachear 404); o certificado em `/cursos/[id]` liga ao URL de verificação.
- **GoogleBot directives**: `max-image-preview: large`, `max-snippet: -1` so SERP previews use full OG image and full description.
- **Verification env vars** (optional): `GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION`, `YANDEX_SITE_VERIFICATION` — Next.js emits the right meta tag automatically when set.

## Cost-inflation rate limits

`src/lib/rateLimit.ts` exports `guardRequest` (IP+UA based) and `guardUser` (Supabase user UUID based, prefix `u:` to avoid bucket collisions with IP keys). Both use Upstash sliding-window when configured, in-memory fallback otherwise.

Per-user limits applied (April 2026 — the original IP limits were trivially bypassed by paid attackers rotating IPs):
- `/api/scan-receipt` — 30/h + 100/d per user. Premium-gated. Worst-case ~$1.5/month per attacker.
- `/api/import-statement` — 5/h + 15/d per user. Premium-gated. Statement parsing burns 30k+ output tokens per call so the cap is tighter.

Rate-limit response includes `Retry-After` + locale-aware error message.

**Global ceiling (Oct 2026):** `guardGlobal(scope, limit, windowMs)` — one shared bucket (key `'g:'+scope`) on the same Upstash/in-memory infra; fails OPEN with a warn if the backend errors. `/api/landing-chat` uses `guardGlobal('landing-chat', 3000, 86_400_000)` — the per-IP+UA limit is bypassed by rotating the UA, so the public chat's AI cost had no ceiling. It runs AFTER body/schema validation, right before the Gemini loop (only requests that will actually cost an AI call count). At the ceiling → 503 `code:'chat_busy'` (`landingchat.busy`). Without Upstash the ceiling is per lambda instance.

## Build constraints (Next.js 15)

- `dynamic({ ssr: false })` is **forbidden inside Server Components** — hard compile error at build time. Wrap in a tiny `'use client'` file. See `src/components/common/DragonCoinFABLazy.tsx` for the canonical pattern.
- `tsc --noEmit` does NOT catch this — only `next build` does. **Run `npx next build` locally before pushing changes that touch dynamic imports or server/client boundaries.**
- Local build fails at "Collecting page data: supabaseUrl is required" because the worktree has no `.env.local` — irrelevant to Vercel where the env vars exist. The "Compiled successfully" line above that is the signal. **Full local build (to the route table) works with dummy envs:** `NEXT_PUBLIC_SUPABASE_URL=https://dummy.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummyanon SUPABASE_SERVICE_ROLE_KEY=dummyservice STRIPE_SECRET_KEY=sk_test_dummy NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_ZHVtbXkuY2xlcmsuYWNjb3VudHMuZGV2JA CLERK_SECRET_KEY=sk_test_dummy npx next build` — and `npx next start -p 3123` with the same envs gives a local middleware smoke test (curl as Googlebot: public pages 200 with no `x-clerk-*`, unknown URL 404, `/dashboard` 307 to the dummy handshake).

## Mobile perf (rounds 1+2+3 shipped)

Round 1 (commit bb74adb) + Round 2 (eb9d7ef + b4e9b83) shaved ~35-50 KB gzipped off the mobile critical path. Combined changes:

- `DragonCoinFAB` lazy-loaded via `DragonCoinFABLazy.tsx` (dashboard layout). **The landing uses its OWN wrapper `LandingFABLazy.tsx`** (mounts the chat on first interaction or `requestIdleCallback` ≤5 s) — don't merge the two: the shared module dragged dashboard-layout chunks into the landing.
- `ShaderCanvas` lazy-loaded inside `SiteBackground` so mobile (which uses CSS gradient fallback) never ships the WebGL plumbing.
- `LandingFAQ` rewritten as async server component using native `<details>` / `<summary>` (was `'use client'` with React state). FAQ entries now in SSR HTML at first byte.
- `LandingPricing` split into async server component + tiny `PricingPeriodToggle` client island. Yearly/monthly variants both server-rendered, toggled via Tailwind `group-data-[period=…]/p:` descendant variants — no JS round-trip.

**Round 3 (SHIPPED June 2026, commit 3837314):** ClerkProvider moved out of the root layout into a new **`(app)` route group** (`src/app/(app)/layout.tsx` is the sole mount point). The four Clerk-dependent route trees — `(dashboard)`, `sign-in`, `sign-up`, `onboarding` — were `git mv`'d under `(app)` (route groups don't change URLs). Root layout keeps `getServerLocale()` for `<html lang>` but no longer imports Clerk. **Result (next build):** legal pages dropped to 103 kB First Load JS (= 102 kB shared baseline + 301 B), proving Clerk left the shared chunk; landing/blog/contacto/newsletter all shed it too; `(app)` routes correctly still carry it (sign-in 146 kB, dashboard 324 kB).
- **The audit that de-risked it (re-run before touching this structure):** a repo-wide grep for client Clerk hooks/components (`useUser|useAuth|useClerk|useSession|<SignIn|<SignUp|<UserButton|…|from '@clerk/nextjs'`) returns a CLOSED set — every consumer already sits under `(app)`. `AdBanner` (uses `useUserPlan`) renders only in `(dashboard)`; `UserPlanProvider` is mounted in `(dashboard)/layout.tsx`. `admin/*` + `reports/*` + all `/api/*` use only server `auth()` from `@clerk/nextjs/server` (middleware-based, provider-independent) → they correctly stay OUTSIDE `(app)` with no Clerk client bundle. No public/marketing component touches Clerk.
- **Gotcha:** after the move, `tsc --noEmit` errors with stale `.next/types/**/page.js not found` referencing OLD paths — it's the cached route-type validator, NOT real source errors. `rm -rf .next` then re-run `tsc` (and `next build` regenerates them clean).
- **Don't re-add a provider to root.** If a NEW public route ever needs a Clerk hook, that's a design smell — public routes are providerless by design; gate the feature behind an `(app)` route instead.

## Security baseline (April 2026)

- Demo mode: see above.
- Rate limiting: `src/lib/rateLimit.ts` — auto-uses Upstash Redis when `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` are set, in-memory fallback otherwise. Applied to `/api/landing-chat` (10/10min + 150/day) and `/api/contact-message` (3/5min + 20/day).
- Cloudflare Turnstile: `src/lib/turnstile.ts` + `src/components/common/TurnstileWidget.tsx`. No-ops when `TURNSTILE_SECRET_KEY`/`NEXT_PUBLIC_TURNSTILE_SITE_KEY` are unset. Wired into `/contacto`.
- Stripe webhook: signature-verified + idempotent via `stripe_events` table (migration in `database/stripe_events_2026_04.sql`). `current_period_end` null-guarded.
- Admin endpoints (`/api/admin/upload-mascot`, `/api/admin/setup-db`) gated on `ADMIN_CLERK_ID` env with 404 stealth response.
- CRON_SECRET comparison: `crypto.timingSafeEqual` + minimum 20 chars. `'/api/cron/(.*)'` is in `isPublicRoute` (like `/api/notifications/send`) → **every cron route MUST do its own Bearer CRON_SECRET check** (the middleware lets it through without a session). `/api/cronx`-style lookalikes still require auth.
- **Middleware shape (Oct 2026 — see Bug-fixed):** default export is a wrapper — only `/api/*` (deny-by-default) and the `isAppPage` prefixes reach `clerk()`; everything else goes straight to Next. The path is normalised the way Clerk does it (decodeURI, collapse `//`, lowercase) BEFORE matching, so `/%61pi/…` or `//dashboard` can't slip past; malformed encoding fails CLOSED (goes through Clerk). Marketing entries stay in `isPublicRoute` as a second layer.
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

- **Brand kit refreshed June 2026** (raster, professionally designed — no longer the hand-coded SVG Digivice). `Logo.tsx` now renders `<img src="/logo-icon.webp">` (the green "XP" power-bolt tile), NOT inline SVG — the new mark is a detailed gradient raster that can't be faithfully traced to vectors. `showText` still appends the "XP-Money" wordmark.
- Favicon: `src/app/icon.png` · Apple touch: `src/app/apple-icon.png` (180×180) · OG + Twitter card: static `src/app/opengraph-image.png` (1200×630, the `REDES SOCIAIS` brand card — replaced the Satori-generated `opengraph-image.tsx`). All convention files are static images now; the old `icon.svg`/`apple-icon.tsx`/`opengraph-image.tsx` were deleted.
- Org/Product JSON-LD `logo` points to `/logo-icon.webp` (`src/lib/seo/jsonLd.ts`). The old `public/logo.svg` was deleted.
- Spare brand assets live in `public/brand/` (`favicon.png`, `app-icon.png`, `notification.png`, `logo-horizontal.webp`, `social.png`) for future wiring (web-push icon, light-bg contexts, etc.).

## Workflow

- **ESLint is interactive** in this repo. Don't script `next lint`. **CI gate: `npx tsc --noEmit` + `node scripts/check-guards.mjs`** — both must pass before EVERY commit. check-guards fails if a page in `(app)/`/`admin/`/`reports/` isn't covered by `isAppPage`, if a public entry (pages, `route.*` outside `/api`, not-found/error/loading/default) or any layout wrapping it imports `@clerk/nextjs` **transitively** (follows relative + `@/` imports, dynamic `import()`, `require`; ignores `import type` and commented imports — so a public page importing TopBar/Sidebar/StreakChip/PushNudgeCard/PrivacyCards FAILS), or if an `isPublicRoute` pattern swallows a private page (`'/r(.*)'` → /reports; write `'/r/(.*)'`). **Keep `isAppPage` a literal array of strings** — the script parses it by regex. After touching `killDebt.ts`: `node --experimental-strip-types scripts/check-killdebt.mjs`. After touching `src/lib/tools/*` or the tool islands: `node --experimental-strip-types scripts/check-tools.mjs` (golden cases). `scripts/check-i18n-callsites.mjs` lists `git ls-files --cached --others` and skips files missing on disk (it used to die with ENOENT on deleted-but-uncommitted files).
- **Auto-push to main** for Vercel deploy: `git push origin HEAD:main`. No PR workflow unless explicitly requested.
- **Never amend commits.** Never `--no-verify` / `--no-gpg-sign` unless asked.
- **Never create `.md` docs** unless asked. (CLAUDE.md updates are explicitly OK.)
- Commit messages: prefix with type — `fix:`, `feat:`, `sec:`, `tune:`, `feat(i18n):`, etc. Body explains WHY, not what. End with `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
- Currency EUR · dates `dd/MM/yyyy` PT or `MMM d, yyyy` EN · `formatCurrency`/`formatMonth` in `lib/utils`.
- Vercel `.vercel/project.json` → `projectId: prj_YKQCICr9yOJe00wFfAJSWY2F882U`, name `xp-money`.

## Pending user actions (one-time setup)

TODOs that require the user to act on a third-party dashboard — code is already prepared. Single ground-truth view: visit `/admin/setup` (admin-only, gated by `ADMIN_CLERK_ID`).

**Required for shipped features to actually work:**
- **`ADMIN_CLERK_ID` env**: the admin's Clerk `user_2…` id, in Vercel env. Without it, every `/admin/*` page returns 404 (stealth).
- **`RESEND_API_KEY` + `ADMIN_EMAIL` env**: needed for bug-report and newsletter emails. Without these the BD rows are still saved but emails go silent (logged via `console.warn`). **⚠ Julho 2026 — diagnóstico real: a env `RESEND_API_KEY` EXISTE no Vercel mas com VALOR VAZIO** (criada 32d antes sem colar a chave; `vercel env ls` mostra-a "Encrypted" e engana — só `vercel env pull` revela o comprimento 0). Confirmado nos runtime logs: `[email] RESEND_API_KEY not set — skipping newsletter confirmation`. O dono tem de colar a chave `re_…` real (Vercel → Settings → Env Vars → RESEND_API_KEY → Edit) + redeploy. E lembrar: sem domínio verificado no Resend, o sender de teste `onboarding@resend.dev` só entrega ao email da própria conta Resend — subscritores reais precisam de domínio verificado + `EMAIL_FROM`. **Causa raiz provável descoberta ao configurar o AdSense: `vercel env add NAME production` com stdin não-interativo (pipe/redirect) diz "Added" mas grava a env VAZIA — bug do CLI no Windows, reproduzido 3× (PS pipe, bash pipe, bash `< file`). Envs por CLI: usar a API REST (`POST /v10/projects/{id}/env`, token em `%APPDATA%\com.vercel.cli\Data\auth.json`) ou o dashboard web, e verificar SEMPRE o valor com `vercel env pull` (o `env ls` mostra "Encrypted" e engana).**
- **3 SQL migrations** (Supabase SQL Editor):
  - `database/stripe_events_2026_04.sql` (webhook idempotency)
  - `database/bug_reports.sql` (bug-report + contact submission table)
  - `database/newsletter_2026_04.sql` (newsletter subscribers — `/api/newsletter/*` returns friendly 503 without it)
- **`database/net_worth_snapshots_2026_05.sql`** — OPTIONAL. `/contas` (Património) works fully without it; only the net-worth *trend chart* needs it. Writer + reader degrade silently when the table is absent.
- **`database/streak_freeze_2026_07.sql`** — RECOMENDADA. Colunas `streak_freezes`/`longest_streak` em voltix_states. Sem ela o streak freeze (proteção à Duolingo, ganha-se a cada marco de 7 dias, cap 2) fica desativado com fallback silencioso no daily-checkin.
- **`database/certificates_2026_07.sql`** — RECOMENDADA. Tabela `certificates` (código servidor `XPM-…`, único e permanente) + verificação pública em `/verify/[code]`. Sem ela o certificado mantém o código derivado legacy sem URL de verificação. É o pré-requisito da visão cripto (ancoragem on-chain futura).
- **`database/backfill_missions_xp_2026_10.sql`** — RECOMENDADA, correr DEPOIS do deploy de out. 2026. Paga (idempotente pela reason `mission_completed:<id>`, `INSERT … WHERE NOT EXISTS` atómico) o XP das missões que ficaram 'completed' sem pagamento antes do `completeMission`. Tem uma query de pré-visualização só de leitura no topo; seguro correr 2×. Até lá essas missões mostram "+X XP recebidos" sem o XP ter entrado.
- **`CRON_SECRET` ≥ 20 chars** no Vercel — senão o vigia (`/api/cron/vigia`) e `/api/notifications/send` respondem sempre 403.
- **Clerk Production instance** — produção ainda corre na instância DEV (`pk_test_`, `*.clerk.accounts.dev`, cap 100 users). Criar a instância Production + CNAMEs DNS + `pk_live_`/`sk_live_`/`CLERK_JWT_KEY` no Vercel (dashboard web ou API REST, nunca `vercel env add` por stdin) e migrar os users COM o mapeamento clerk_id antigo→novo (`users.email` é UNIQUE — sem o mapeamento os users existentes ficam presos no onboarding). Os checkouts já gravam `metadata.internalUserId` para o webhook sobreviver à troca.
- **Stripe Customer Portal**: enable at https://dashboard.stripe.com/settings/billing/portal so the "Gerir subscrição" button works.
- **Stripe payment methods**: enable Multibanco + MBWay at https://dashboard.stripe.com/settings/payment_methods so PT customers see the right options at checkout.

**Onda B (out. 2026) — decisões/confirmações do dono antes de promover:**
- Nome + foto REAL para o bloco fundador (`LandingFounder`); `NEXT_PUBLIC_POSTHOG_KEY` continua por definir (eventos `track.*` inertes até haver chave + consentimento).
- Confirmar no Stripe que Multibanco/MB WAY e `STRIPE_PREMIUM_PASS_PRICE_ID` existem (a `pricing.footer_note` fala do Passe Anual) e em `/admin/setup` que a tabela `certificates` existe.
- AdSense: ativar a mensagem de consentimento europeia (Privacidade e mensagens) se se quiser voltar a prometê-la no texto legal; validar `cookies`/`privacidade` com advogado.
- Rever os artigos fiscais (`deducoes-irs`, `subsidio-de-natal`, `reembolso-irs`, `subsidio-de-ferias`) e as ferramentas contra as fontes citadas; a OG global `opengraph-image.png` tem um quadriculado de falsa transparência no centro — refazer a arte com fundo sólido.
- Pós-deploy: curl sem sessão às rotas `/ferramentas*`, `/verify`, `/blog/*`; os 4 slugs antigos devem dar 308; testar Facebook Sharing Debugger/LinkedIn Post Inspector; reinstalar o PWA para o shortcut `?add=1`.

**Required for legal/fiscal compliance:**
- **Início de Actividade na AT** (Portal das Finanças): CAE 62020 (or similar), regime de isenção Art. 53.º CIVA. Without this you're collecting Stripe deposits without a registered economic activity = tax fraud.

**Optional / degraded-but-functional:**
- **Upstash Redis** (rate-limit at scale): `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`. Without: in-memory per-instance.
- **Cloudflare Turnstile** (anti-bot on `/contacto`): `TURNSTILE_SECRET_KEY` + `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. Without: honeypot only.
- **`EMAIL_FROM`** env: branded sender like `XP-Money <noreply@xp-money.com>` after verifying domain in Resend (DNS records). Without: defaults to `onboarding@resend.dev`.
- **`GOOGLE_SITE_VERIFICATION` / `BING_SITE_VERIFICATION`**: Search Console + Bing Webmaster property verification. Meta tag is emitted automatically when set.
- **`NEXT_PUBLIC_APP_URL`**: absolute site URL (default localhost:3000 → email links break in production).

## Backlog (cosmetic / non-blocking / data-bound)

**Code-side, doable when there's a janela limpa:**
- 4 unused shaders in `shaders.ts` (~400 LOC) — keep as theme-picker seed or delete.
- Dashboard layout has its own `dashboard-bg` solid which covers the Neon Grid (intentional).
- Strict CSP — currently NOT set (Clerk + PostHog + AdSense + Turnstile mix needs nonce infra; deferred).
- `subscriptions.cycle` column — without it, `/admin/metrics` MRR over-estimates by treating yearly subscribers as monthly. Add when there's enough yearly volume to matter.

**Data-bound (don't act until ≥30-60 days of measurement):**
- **Premium+ tier €9,99** (proposed: unlimited AI, multi-account, accountant CSV export). Needs A/B-able conversion data.
- **More blog articles** — write the next ones based on Search Console queries, not guesses.
- **CAC / LTV / Rule of 40** in `/admin/metrics` — needs marketing spend input + 60+ days of churn data.

**Bug-fixed during this session (don't re-introduce):**
- `useBudgetOverrides` was `useState`-based → state didn't share across consumers → bucket toggle "did nothing". Now React Query.
- Reset endpoint kept badges + completed missions + never wiped debts/budgets → "começar do zero" wasn't actually zero. Now full wipe.
- `dynamic({ssr:false})` directly inside server components broke Vercel build (Next.js 15). Use `DragonCoinFABLazy.tsx` pattern.
- PDF report mobile overflow on summary cards (iOS Safari uses screen viewport for print). Fixed via `@media print` overrides.
- LanguageToggle was 28 px tall in compact mode → mobile taps missed. Now `min-h-[40px]`.
- Favicon was being intercepted by Clerk middleware (`/icon` not extension-matched). Fixed in `src/middleware.ts` matcher.
- **`/blog` NUNCA esteve na lista pública do middleware** — todo o blog (7 artigos, a estratégia SEO inteira) devolvia 307→/sign-in em produção, invisível para users e Googlebot (descoberto julho 2026 ao adicionar /verify). `'/blog(.*)'` está agora em isPublicRoute — nunca remover; ao criar rotas públicas novas, TESTAR com curl sem sessão.
- **O Clerk middleware corria em TODAS as páginas, incluindo as públicas (out. 2026).** `clerkMiddleware` faz `authenticateRequest` + handshake (307 para `*.clerk.accounts.dev` na instância dev) ANTES do callback, por isso `if (isPublicRoute) return next()` dentro do callback não evitava nada: Googlebot, Mediapartners-Google (AdSense) e bots de preview social levavam 307 em `/`, `/blog`, `/.well-known/*`, e URLs inexistentes faziam 307→/sign-in (soft-404). Fix em `src/middleware.ts`: export default é um wrapper; só `/api/*` e os prefixos `isAppPage` passam por `clerk()`. **Nunca voltar a pôr páginas públicas atrás do `clerk()`.** **Uma página privada NOVA em `(app)/`, `admin/` ou `reports/` TEM de entrar no `isAppPage`** (`/onboarding` e `/admin/mascot-upload` dependem SÓ do middleware) — `check-guards.mjs` apanha o esquecimento. Rotas públicas novas já não precisam de mexer no middleware. `src/app/not-found.tsx` = server component PT/EN, `noindex,follow`, links para `/` e `/blog` (nunca `/dashboard` — quem lá cai agora são anónimos de links partidos); `notFound()` dentro de `(dashboard)` usa `src/app/(app)/(dashboard)/not-found.tsx` (mantém o shell + CTA `/dashboard`). Admin fica no root not-found de propósito (stealth 404 igual a qualquer outro).
