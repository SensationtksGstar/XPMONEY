# XP Money — Claude context

Finance-gamification PWA. Bilingual **PT-PT (default) + EN-US**. Deployed: https://xp-money.com (alias `xp-money.vercel.app`).
Core loop: log transactions → score climbs → mascot evolves → XP/badges/missions/courses unlock.

## Stack

- **Next.js 15** App Router · **React 19** · **TypeScript strict** · **Tailwind 3.4** + Radix + lucide + framer-motion + recharts
- **Supabase** Postgres + RLS — `src/lib/supabase.ts` is `import 'server-only'`. **I cannot run DDL** (no DB password). Migrations live in `database/*.sql` and the user runs them in the Supabase SQL editor; new code must always have a runtime fallback for "table not yet created".
- **Clerk** auth · `localization` prop wired to `ptPT`/`enUS` from `@clerk/localizations`. `userId` from Clerk is **NEVER** the Supabase UUID — resolve via `resolveUser(clerkId)`.
- **React Query** — staleTime 5 min, gcTime 15 min, retry 1. `queryKey` MUST NOT include `userId` (causes `''`→real-id double-fetch). Filter server-side via RLS.
- **Stripe** billing — Customer Portal at `/api/billing/portal`. Webhook at `/api/webhooks/stripe` is signature-verified + idempotent via `stripe_events` table.
  - **PT payment methods supported by Stripe:** Cards (always), **Multibanco** (bank-reference, 24-72h pay-by), **MBWay** (instant mobile, launched in Stripe 2024 — yes, Stripe DOES support it directly; don't tell the user otherwise). Activate both at https://dashboard.stripe.com/settings/payment_methods.
  - **VAT / IVA:** user is in **regime de isenção Art. 53.º CIVA** — no VAT charged. Stripe price is gross revenue (PRICE_NET_OF_VAT === PRICE_GROSS in `/admin/metrics`). When >€15k/year cross-over → switch to standard regime + add `automatic_tax: true` to checkout (recipe in `src/lib/stripe.ts` comment).
- **AI chain** (`src/lib/ai.ts`): Gemini 2.5 Flash → Gemini 2.0 Flash → Groq Llama. Env `GOOGLE_GEMINI_API_KEY` (falls back to `GOOGLE_API_KEY`/`GEMINI_API_KEY`). `parseStatement({ kind:'text'|'pdf' })` — PDFs go only to Gemini. **Locale-aware**: pass `locale` arg → builds PT or EN system prompt; the EN variant tells the model to keep DB category names in PT verbatim so historical data stays intact.
- **PostHog** analytics · web-push (VAPID) · sharp (RUNTIME dep — mascot upload route).

## Plans (2-tier, April 2026)

`PLAN_RANK` from `src/lib/stripe.ts`: `{ free:0, premium:1, plus:1, pro:1, family:1 }` — Plus/Pro/Family are LEGACY aliases mapped to Premium for backwards-compat with old subscriptions. Read via `useUserPlan()`. Paid features gate on rank ≥ 1.

**Pricing** (synced between `LandingPricing.tsx` + `BillingClient.tsx`):
- Free: ad-supported, **`FREE_GOAL_LIMIT = 2` active goals** (server-enforced in `/api/goals` POST, returns 403 with `code: 'free_goal_limit'` when at limit), **1 active debt in Mata-Dívidas** (paywall on 2nd), **Orçamento 50/30/20 fully unlocked** (retention hook), 3 starter courses, no AI features.
- Premium: €4,99/mo · €39,99/yr (~33% annual discount). All features, unlimited goals + debts, 4 advanced courses, no ads.

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
- **Local-state hooks shared across components must use React Query as the store, not `useState`.** Example: `useBudgetOverrides` in `src/hooks/useBudget.ts`. Two consumers each calling `useState` give independent state instances — when one mutates, the other never sees it (looked like "click does nothing" to users in the budget bucket toggle bug). Use `client.setQueryData(KEY, ...)` + `useQuery({ queryKey: KEY, queryFn: readFromLocalStorage })` so every consumer subscribes to the same cache entry.
- **Touch targets ≥ 40-44 px even in compact navs.** `LanguageToggle` had `px-2 py-1 text-[10px]` (~28 px tall) and mobile users tapped between buttons or hit the active side (no-op via `!active && setLocale`) thinking the button was broken. Default+compact now use `min-h-[40px]` / `min-h-[44px]` + `touch-manipulation` (kills iOS 300 ms double-tap delay) + `active:bg-white/10` for visible pressed feedback.
- **Mobile-Safari prints PDFs at the SCREEN viewport, not @page A4.** Means a `grid-cols-3` chart with `text-2xl` will overflow on a 375-px iPhone when the user clicks Save-as-PDF. Fix: explicit `@media print` overrides that force desktop sizing (`grid-template-columns: repeat(3, …) !important`, font-size resets) AND a mobile-friendly screen layout (`grid-cols-1 sm:grid-cols-3`, `text-xl sm:text-2xl`, `tabular-nums break-words`). See `src/app/reports/print/page.tsx` `report-summary-grid` / `report-summary-card` / `report-summary-value` classes.

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

`DELETE /api/transactions/reset` requires `{ confirm: "APAGAR" }`. Updated April 2026 — true factory wipe (was: kept badges + completed missions; user reported it as a bug because Mata-Dívidas + missions stayed):

**Wipes (full delete):** `transactions`, `xp_history`, `financial_scores`, `goal_deposits`, `goals`, `debts` (cascades to `debt_attacks`), `missions` (active AND completed), `user_badges`, `budgets`.

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

`GET /api/account/export` streams a `xpmoney-export-YYYY-MM-DD.json` with every user-scoped row across 14 tables. Each secondary table wrapped in try/catch → missing migration produces partial file with `_warnings` array, never 500. Strips `clerk_id` from the user row before emitting (internal reference, not user data).

## Blog (`/blog`)

MDX-based, filesystem source of truth. Layout:

```
content/blog/<slug>/
  index.pt.mdx     ← canonical, mandatory
  index.en.mdx     ← optional; EN reader falls back to PT (chip "Em PT")
```

Frontmatter (gray-matter): `title`, `description`, `date`, `keywords[]`, `author?`, `ogImage?`, `draft?`. Reading time auto-computed (~220 wpm). Drafts hidden in production, visible in dev.

- `src/lib/blog.ts` — `getAllPosts(locale)` / `getPostBySlug(slug, locale)` / `getAllSlugs()`. Server-only.
- `/blog` index — server component, lists newest-first.
- `/blog/[slug]` — server component renders MDX via `next-mdx-remote/rsc` + `remark-gfm`. Pre-renders all slugs at build via `generateStaticParams()`.
- Each post emits `BlogPosting` + `BreadcrumbList` JSON-LD via `lib/seo/jsonLd.ts → article()`.
- Sitemap (`src/app/sitemap.ts`) aggregates posts dynamically — no redeploy needed when publishing.
- Tailwind `prose prose-invert prose-emerald` (via `@tailwindcss/typography` plugin) styles the content.
- Soft conversion CTA ("Try it free") at the foot of every post.

**Currently published (5 articles, all PT-only):**
1. `ynab-alternativas-portugal-2026` — comparison content
2. `irs-2026-7-deducoes-esquecidas` — seasonal SEO (April-June)
3. `extracto-cgd-30-segundos-ia` — feature demo, drives Premium
4. `regra-50-30-20-salario-portugues-1300` — authority + drives `/orçamento`
5. `porque-apps-financas-desistem-de-ti` — contrarian, viral on socials

Marketing roadmap planning lives in MARKETING.md (gitignored).

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

## SEO — structured data + Twitter cards

- **`src/lib/seo/jsonLd.ts`** — locale-aware helpers: `organization()`, `website()` (with SearchAction), `softwareApplication()` (FinanceApplication category, FAQPage feature list, monthly Offer), `faqPage(qas)`, `premiumProduct(locale)` (monthly + yearly Offers), `breadcrumb(items)`, `article(post)` (BlogPosting).
- **`src/components/seo/JsonLd.tsx`** — server component that emits `<script type="application/ld+json">`. Escapes `<` to `<` to prevent breakout via attacker-controlled answer text.
- Mounted: Organization + WebSite in root layout (every page); SoftwareApplication + FAQPage + Product on landing; BreadcrumbList on legal pages + contact + every blog post; Article on each blog post.
- **Twitter Cards**: `summary_large_image` in root metadata. Without this, links shared on X render as plain blue links.
- **GoogleBot directives**: `max-image-preview: large`, `max-snippet: -1` so SERP previews use full OG image and full description.
- **Verification env vars** (optional): `GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION`, `YANDEX_SITE_VERIFICATION` — Next.js emits the right meta tag automatically when set.

## Cost-inflation rate limits

`src/lib/rateLimit.ts` exports `guardRequest` (IP+UA based) and `guardUser` (Supabase user UUID based, prefix `u:` to avoid bucket collisions with IP keys). Both use Upstash sliding-window when configured, in-memory fallback otherwise.

Per-user limits applied (April 2026 — the original IP limits were trivially bypassed by paid attackers rotating IPs):
- `/api/scan-receipt` — 30/h + 100/d per user. Premium-gated. Worst-case ~$1.5/month per attacker.
- `/api/import-statement` — 5/h + 15/d per user. Premium-gated. Statement parsing burns 30k+ output tokens per call so the cap is tighter.

Rate-limit response includes `Retry-After` + locale-aware error message.

## Build constraints (Next.js 15)

- `dynamic({ ssr: false })` is **forbidden inside Server Components** — hard compile error at build time. Wrap in a tiny `'use client'` file. See `src/components/common/DragonCoinFABLazy.tsx` for the canonical pattern.
- `tsc --noEmit` does NOT catch this — only `next build` does. **Run `npx next build` locally before pushing changes that touch dynamic imports or server/client boundaries.**
- Local build fails at "Collecting page data: supabaseUrl is required" because the worktree has no `.env.local` — irrelevant to Vercel where the env vars exist. The "Compiled successfully" line above that is the signal.

## Mobile perf (rounds 1+2 shipped, round 3 deferred)

Round 1 (commit bb74adb) + Round 2 (eb9d7ef + b4e9b83) shaved ~35-50 KB gzipped off the mobile critical path. Combined changes:

- `DragonCoinFAB` lazy-loaded via `DragonCoinFABLazy.tsx` (used on landing + dashboard layout).
- `ShaderCanvas` lazy-loaded inside `SiteBackground` so mobile (which uses CSS gradient fallback) never ships the WebGL plumbing.
- `LandingFAQ` rewritten as async server component using native `<details>` / `<summary>` (was `'use client'` with React state). FAQ entries now in SSR HTML at first byte.
- `LandingPricing` split into async server component + tiny `PricingPeriodToggle` client island. Yearly/monthly variants both server-rendered, toggled via Tailwind `group-data-[period=…]/p:` descendant variants — no JS round-trip.

**Round 3 (deferred):** ClerkProvider in root layout ships ~120 KB gzipped to every public route (landing, blog, legal). Splitting `(marketing)` / `(app)` route groups would drop it from non-auth routes. **High value (~25-30% mobile JS reduction) but high risk** — any Clerk hook used outside the provider crashes. Needs full audit of the 30+ files importing Clerk hooks, ~2-3h focused work in a clean window.

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

TODOs that require the user to act on a third-party dashboard — code is already prepared. Single ground-truth view: visit `/admin/setup` (admin-only, gated by `ADMIN_CLERK_ID`).

**Required for shipped features to actually work:**
- **`ADMIN_CLERK_ID` env**: the admin's Clerk `user_2…` id, in Vercel env. Without it, every `/admin/*` page returns 404 (stealth).
- **`RESEND_API_KEY` + `ADMIN_EMAIL` env**: needed for bug-report and newsletter emails. Without these the BD rows are still saved but emails go silent (logged via `console.warn`).
- **3 SQL migrations** (Supabase SQL Editor):
  - `database/stripe_events_2026_04.sql` (webhook idempotency)
  - `database/bug_reports.sql` (bug-report + contact submission table)
  - `database/newsletter_2026_04.sql` (newsletter subscribers — `/api/newsletter/*` returns friendly 503 without it)
- **Stripe Customer Portal**: enable at https://dashboard.stripe.com/settings/billing/portal so the "Gerir subscrição" button works.
- **Stripe payment methods**: enable Multibanco + MBWay at https://dashboard.stripe.com/settings/payment_methods so PT customers see the right options at checkout.

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
- **Round 3 perf — Clerk split** (~120 KB gzipped off public routes): move `<ClerkProvider>` out of root layout into `(app)` route group; `(marketing)` group keeps no provider. Needs full audit of files importing Clerk hooks (any usage outside the provider crashes). High value, high risk, ~2-3h focused work.
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
