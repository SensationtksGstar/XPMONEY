# XP Money — Setup Guide

## 1. Clone the repo

```bash
git clone https://github.com/your-org/xpmoney.git
cd xpmoney
```

## 2. Install dependencies

```bash
npm install
```

## 3. Configure environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in all values as described in the sections below.

---

## 4. Clerk (Authentication)

1. Go to https://dashboard.clerk.com and create a new application.
2. Choose your sign-in methods (email, Google, etc.).
3. Copy **Publishable Key** → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
4. Copy **Secret Key** → `CLERK_SECRET_KEY`
5. In Clerk dashboard → **Redirect URLs**, add:
   - Sign-in fallback: `https://yourdomain.com/sign-in`
   - Sign-up fallback: `https://yourdomain.com/sign-up`
   - After sign-in: `https://yourdomain.com/dashboard`
   - After sign-up: `https://yourdomain.com/onboarding`
6. In **Sessions → Customize session token**, add a `metadata` claim so onboarding status is available in middleware:
   ```json
   { "metadata": "{{user.public_metadata}}" }
   ```

---

## 5. Supabase (Database)

1. Go to https://app.supabase.com and create a new project.
2. Once provisioned, go to **SQL Editor** and run the contents of `database/schema.sql` to create all tables.
3. Go to **Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret — server-side only)

---

## 6. Stripe (Payments)

1. Go to https://dashboard.stripe.com and create or use an existing account.
2. In **Products**, create two products:
   - **XP Money Plus** — add two prices: €3.99/month and €29.99/year (recurring)
   - **XP Money Pro** — add two prices: €7.99/month and €59.99/year (recurring)
3. Copy the four **Price IDs** (`price_...`) into your `.env.local`:
   - `STRIPE_PLUS_MONTHLY_PRICE_ID`
   - `STRIPE_PLUS_YEARLY_PRICE_ID`
   - `STRIPE_PRO_MONTHLY_PRICE_ID`
   - `STRIPE_PRO_YEARLY_PRICE_ID`
4. Go to **Developers → API keys** and copy:
   - **Secret key** → `STRIPE_SECRET_KEY`
   - **Publishable key** → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
5. Go to **Developers → Webhooks → Add endpoint**:
   - URL: `https://yourdomain.com/api/webhooks/stripe`
   - Events to listen for: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy the **Signing secret** → `STRIPE_WEBHOOK_SECRET`
6. For local webhook testing, install the [Stripe CLI](https://stripe.com/docs/stripe-cli) and run:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

---

## 7. PostHog (Analytics)

1. Go to https://posthog.com and create a new project (select the EU region if you want data stored in Europe).
2. Copy **Project API Key** → `NEXT_PUBLIC_POSTHOG_KEY`
3. Set `NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com` (or `https://us.i.posthog.com` for US region).

---

## 8. Local development

```bash
npm run dev
```

App runs at http://localhost:3000.

To check TypeScript:
```bash
npm run typecheck
```

---

## 9. Deploy to Vercel

1. Push your repo to GitHub.
2. Go to https://vercel.com → **Add New Project** → import your GitHub repo.
3. Vercel auto-detects Next.js — no build settings needed.
4. Under **Environment Variables**, add every variable from `.env.example` with your production values.
   - Use `pk_live_` / `sk_live_` Stripe keys for production.
   - Set `NEXT_PUBLIC_APP_URL=https://yourdomain.com`.
5. Click **Deploy**.
6. After the first deploy, update your Stripe webhook endpoint URL to the live domain.
7. Update Clerk redirect URLs to the live domain.

The `vercel.json` in this repo already sets the deployment region to `lhr1` (London) and gives the Stripe webhook handler a 30-second timeout.
