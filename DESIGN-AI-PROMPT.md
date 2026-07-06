# Design-AI handoff prompt — XP-Money mobile redesign (Apple-style)

> Paste everything under the line into a design-focused AI (v0.dev, Lovable, Bolt,
> Magic Patterns, Figma AI, or any design-tuned model). It is self-contained.
> For extra depth, also attach `XP-MONEY-REDESIGN-BRIEF.md` and the mascot images —
> above all the EGGS (`public/mascot/voltix/1.webp`, `public/mascot/penny/1.webp`,
> the day-one state) plus an evolved form for contrast (`voltix/3.webp`, `penny/3.webp`). Prompt is in
> English on purpose (design tools perform better); the product UI copy must stay
> Portuguese (PT-PT) — examples are given.

---

## ROLE
You are a **senior product designer with Apple-caliber taste** — the calm precision of Apple Wallet, Fitness, and Health. You are redesigning a *live* fintech PWA. Your output must be **both beautiful and implementable in the existing stack** (constraints below). Prioritize mobile.

## THE PRODUCT
**XP-Money** — a finance-*gamification* PWA for Portuguese consumers. The loop: users log transactions → a financial **score** rises → a collectible **mascot evolves** → XP / badges / missions / courses unlock. It's money-tracking made habit-forming and playful. Bilingual **PT-PT (default)** + EN-US, **mobile-first** (mid-range Android + iPhone), **dark theme only**.

**Brand soul — PRESERVE, don't redesign away:** two mascots, **Voltix** (thunder dragon) and **Penny** (angel cat), each with 6 evolutions; a single **green** identity; the gamification (score, streak, XP, badges, missions). These are the differentiator. Keep them — present them *cleanly and quietly*, delightful only on real milestones.

**Critical mascot fact — the journey starts as an EGG.** Evolution stage 1 is an egg (Voltini / Pennini); it hatches and evolves as the financial score rises, at real score thresholds **20 · 48 · 68 · 85 · 95**. Every new user's first experience is the egg — design the day-one state around it (e.g. the dashboard hero shows the egg with a quiet "hatches at score 20" progress hint). The mascot shown anywhere in the UI must reflect the user's *current* stage, never a generic evolved form.

## THE GOAL
Redesign toward **calm, Apple-grade restraint — especially on MOBILE**, which today feels cluttered and confusing. Guiding principles:
- **Content over chrome.** The UI recedes so the user's money is the hero.
- **One accent.** Green marks *only* the primary action and the single most important positive signal. Everything else is neutral.
- **Neutral depth.** Soft neutral shadows + hairline borders + translucency. **No neon glows.**
- **One idea per screen, one primary action.** Ruthless hierarchy; type does the work.
- **Generous whitespace**, strict 8-pt rhythm, progressive disclosure (fewer things visible at once).
- **Keep the personality** — quiet by default, celebratory on a level-up or a goal reached.

## WHAT'S BROKEN TODAY (the brief you must fix)
1. **Overloaded home:** the mobile dashboard stacks **~18–20 widgets (~3000 px of scroll)** plus **two ad banners** before the user reaches their recent transactions.
2. **Buried navigation:** the bottom nav surfaces only **3 destinations**; **13 features** are dumped into a **flat 10-icon "More" sheet** — core money features (accounts, budget, debt) sit 2 taps deep and go undiscovered.
3. **Label collision (real bug):** the bottom-nav item labelled **"Contas"** opens the *Transactions* list; the actual accounts/net-worth page is labelled **"Património"**. "Contas" doesn't open your accounts.
4. **Decoration over content:** green is used for *everything* (every card border, every active icon) and there are **colored glows everywhere** (icons, FAB, buttons, logo) → nothing stands out.
5. **Competing CTAs:** "add a transaction" is offered by **three** surfaces at once (a floating ＋ button, a 3-card quick-action row, and a header button).
6. **Cluttered top bar:** it crams a language toggle + upgrade badge + notification bell + avatar.

## TARGET DESIGN TOKENS (dark theme — use these exact values)
**Color — one accent, neutral surfaces with a faint green bias:**
- ground `#0b0d10` · surface-1 `#13161b` · surface-2 `#1b1f26` · surface-3 `#242a33`
- hairline border `rgba(255,255,255,.08)` · divider `rgba(255,255,255,.05)`
- text: primary `#f2f4f7` · secondary `#98a2b0` · tertiary `#616b78`
- **accent (single)** `#27c26b` — primary button + the single key positive number ONLY
- semantic finance (slightly desaturated): income `#34c77b` · expense `#f0708a` · info `#5b9df0` · warning `#e6a23c`; premium purple `#a78bfa`

**Type — system font stack (renders as San Francisco on Apple), `tabular-nums` for figures:**
- Large title 34 / 700 / -0.03em · Title 24 / 600 · Headline 17 / 600 · Body 15 / 400 · Subhead 13 · Caption 12 (**min 11** — no 9–10 px). Cap weight at **700**. Adopt Apple's **large-title** screen headers.

**Depth — neutral only:** card = 1 px hairline border + `shadow: 0 1px 2px rgba(0,0,0,.5)`; raised elements a soft larger neutral shadow. **Delete every colored glow / drop-shadow.**

**Spacing / shape:** 8-pt rhythm; card padding 16–20; between-group gaps 24–32; mobile side padding 20. Radii: cards 16–18, buttons 12 or full — consistent per element type.

**Motion:** subtle, spring easing `cubic-bezier(.32,.72,0,1)`; respect `prefers-reduced-motion`; no default confetti/glow.

## DELIVERABLES (design these, mobile-first, dark, in phone frames)
**Priority 1 — the two that fix "mobile is confusing":**
1. **Mobile dashboard (home)** — cut to a focused *glance*, ≤ 3 screen-heights:
   - Greeting + **large-title** header; streak as a small inline chip (not a banner).
   - **ONE hero:** the Financial Score (a calm ring or big number) with the **mascot at its current stage beside it** — for a new user that's the **EGG**, with a quiet progress hint ("O ovo choca aos 20" + a thin progress track). This fuses gamification and clarity in one card.
   - A **"Este mês"** summary card — Receita / Despesa / Poupança, tabular numbers.
   - **"Recentes"** — 4–5 transaction rows (category dot + name + category + amount) + "Ver tudo".
   - **One** primary CTA: **"＋ Adicionar movimento"**. Everything else (charts, missions, pro teasers, ads) moves to its own screen or a "Ver mais".
2. **Bottom tab bar + "More" sheet:**
   - 5 correctly-labelled tabs: **Início · Movimentos · ＋ · Metas · Mais** (note: "Movimentos" for transactions — never "Contas").
   - The **"Mais" sheet grouped by theme** with section headers: **Dinheiro** (Contas, Orçamento, Dívidas) · **Progresso** (Missões, Voltix, Badges, Academia) · **Ferramentas · Premium** (Perspetiva, Simulador) · **Conta** (Definições).

**Priority 2 — the system, shown on real components:**
3. Core components: button (primary/secondary), card, transaction list row, tab bar, large-title section header, and a **calmed** celebration/level-up moment.
4. (Optional) one secondary screen — Transactions list *or* Accounts/Net-worth ("Contas / Património") — applying the system.
5. (Optional) Landing hero — spacious, the mascot as the star, one accent, big type.

## HARD CONSTRAINTS (output must be droppable into the codebase)
- **Stack:** Next.js 15 App Router · React 19 · **Tailwind CSS 3.4** · Radix primitives · **lucide-react** icons · framer-motion · recharts. **If you generate code, output React + Tailwind utility classes in this stack.** No other CSS framework; no new heavy dependencies.
- **Dark theme only. Mobile-first. PWA** — respect safe-area insets (`env(safe-area-inset-*)`).
- **All UI copy in PT-PT** (examples above). Keep it i18n-friendly — no logic that depends on the copy text.
- **Accessibility:** touch targets ≥ 44×44 px; `aria-label` on icon-only buttons; dialog `role`/`aria-modal`; visible keyboard focus; respect `prefers-reduced-motion`.
- **Preserve** the mascots (I'll attach the images), the single green accent (used sparingly), and the gamification — just quieter.

## OUTPUT FORMAT
For **each** screen: (a) the visual, in a **dark phone frame**; (b) if you generate code, the **React + Tailwind** implementation; (c) 2–3 sentences on the key decisions. **Start with the mobile dashboard and the navigation** — they are the priority. If you can only do one thing, do those two beautifully.

## IF YOU DISAGREE WITH A CHOICE
You're the design specialist — if a token or layout call is wrong, improve it and say why. The non-negotiables are only: dark theme, one green accent used sparingly, no neon glows, mascots preserved, PT-PT copy, and Tailwind-implementable output.
