import 'server-only'
import { Resend } from 'resend'

/**
 * Lightweight admin-notification email helper.
 *
 * Provider: Resend (https://resend.com) — chosen for the generous free tier
 * (3,000/mo · 100/day) and an HTTP API that fits the Vercel/Edge model
 * (no SMTP socket reuse). The DB is the source of truth for every
 * submission; email is a courtesy ping so the admin sees it without
 * opening Supabase.
 *
 * Graceful degradation: if RESEND_API_KEY or ADMIN_EMAIL are missing the
 * call is a console.warn no-op. This keeps deploys working on day-1
 * before the user adds the env vars; existing endpoints don't 500.
 *
 * Sender (`from` address):
 *   - Resend gives `onboarding@resend.dev` for testing without domain
 *     verification — that's our default. Mail still arrives in inbox but
 *     marked as "via resend.dev" by some clients.
 *   - Once xp-money.com is verified in Resend, set EMAIL_FROM to e.g.
 *     `XP-Money <noreply@xp-money.com>` and emails go out under the brand.
 *   - We never read the user's Clerk email as a `from` — that would spoof.
 *     The user email goes in `reply_to` so a reply lands directly with them.
 *
 * Failures are logged but not thrown — the caller (an API route) has
 * already saved the row to the DB and returned 201 to the user. Email
 * failure must never make the submission look broken.
 */

interface AdminEmailInput {
  subject:    string
  /** Short HTML body. Wrapped in a minimal styled shell. Plain text auto-derived. */
  html:       string
  /** When the user gave us an email, set replyTo so a click on Reply works. */
  replyTo?:   string | null
}

const ADMIN_EMAIL_RAW = process.env.ADMIN_EMAIL?.trim()
const RESEND_KEY      = process.env.RESEND_API_KEY?.trim()
const FROM_DEFAULT    = 'XP-Money <onboarding@resend.dev>'
const FROM            = process.env.EMAIL_FROM?.trim() || FROM_DEFAULT

let cachedResend: Resend | null = null
function getResend(): Resend | null {
  if (!RESEND_KEY) return null
  if (!cachedResend) cachedResend = new Resend(RESEND_KEY)
  return cachedResend
}

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function notifyAdmin(input: AdminEmailInput): Promise<{ ok: boolean; reason?: string }> {
  const resend = getResend()
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set — skipping admin email')
    return { ok: false, reason: 'no_api_key' }
  }
  if (!ADMIN_EMAIL_RAW) {
    console.warn('[email] ADMIN_EMAIL not set — skipping admin email')
    return { ok: false, reason: 'no_admin_email' }
  }

  try {
    const { error } = await resend.emails.send({
      from:     FROM,
      to:       [ADMIN_EMAIL_RAW],
      subject:  input.subject,
      html:     wrapHtml(input.html),
      text:     htmlToText(input.html),
      // `replyTo` is the modern field; older Resend SDKs accept `reply_to`.
      // We pass `replyTo` (camelCase) which the v3 SDK uses; the API
      // accepts both shapes.
      replyTo:  input.replyTo ?? undefined,
    })
    if (error) {
      console.warn('[email] Resend returned error:', error)
      return { ok: false, reason: error.message ?? 'resend_error' }
    }
    return { ok: true }
  } catch (err) {
    console.warn('[email] notifyAdmin threw:', err)
    return { ok: false, reason: err instanceof Error ? err.message : 'unknown' }
  }
}

/**
 * Minimal HTML shell — dark-on-light, mobile-readable, no external CSS or
 * images (so it survives every email client's image blocker). Inline styles
 * are mandatory: Gmail strips `<style>` and most clients ignore stylesheets.
 */
function wrapHtml(inner: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:20px 24px;background:#0d1424;color:#ffffff;font-weight:700;font-size:16px;">
          ⚡ XP-Money · admin notification
        </td></tr>
        <tr><td style="padding:24px;font-size:14px;line-height:1.55;">
          ${inner}
        </td></tr>
        <tr><td style="padding:14px 24px;background:#fafafa;border-top:1px solid #e4e4e7;font-size:11px;color:#71717a;">
          Email automático do XP-Money. Se não esperavas receber isto,
          basta ignorar — não há nenhuma acção necessária.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

/**
 * Tiny HTML escaper for embedding user-submitted text in the email body.
 * Mandatory — without it a bug report that contains `<script>` or
 * `</td><td>` could break the email layout or get flagged as phishing.
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ─────────────────────────────────────────────────────────────────────────────
// Newsletter — recipient-facing emails
// ─────────────────────────────────────────────────────────────────────────────
//
// `notifyAdmin` above goes from xp-money → admin. The functions below go from
// xp-money → an end user, so the wrapping shell needs an unsubscribe footer
// (legally required in most jurisdictions, mandatory for ESP good standing).
//
// All copy is locale-aware (PT/EN). Rendering uses inline styles for the
// same reasons as `wrapHtml` — Gmail strips <style>, etc.
//
// The functions return { ok, reason } same as notifyAdmin so callers can
// log without throwing. Email failure must NOT prevent the user's
// "subscribed" 200 response — a re-send / re-attempt button can come later.

interface NewsletterUserEmail {
  to:                string
  locale:            'pt' | 'en'
  /** URL the recipient clicks to act. The function renders the button. */
  actionUrl:         string
  /** Optional unsubscribe URL. Mandatory in welcome/campaign emails;
   *  omitted on the confirmation email since they're not on the list yet. */
  unsubscribeUrl?:   string
}

const SITE_URL = 'https://xp-money.com'

function newsletterShell(opts: {
  locale:          'pt' | 'en'
  inner:           string
  unsubscribeUrl?: string
}): string {
  const isEn = opts.locale === 'en'
  const footerLines: string[] = []
  if (opts.unsubscribeUrl) {
    footerLines.push(
      isEn
        ? `Don't want these anymore? <a href="${opts.unsubscribeUrl}" style="color:#71717a;">Unsubscribe</a>.`
        : `Já não queres receber? <a href="${opts.unsubscribeUrl}" style="color:#71717a;">Cancela aqui</a>.`,
    )
  }
  footerLines.push(
    isEn
      ? `XP-Money · <a href="${SITE_URL}" style="color:#71717a;">xp-money.com</a> · Lisbon, Portugal`
      : `XP-Money · <a href="${SITE_URL}" style="color:#71717a;">xp-money.com</a> · Lisboa, Portugal`,
  )

  return `<!doctype html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:24px 28px;background:#0d1424;color:#ffffff;font-weight:700;font-size:18px;">
          ⚡ XP-Money
        </td></tr>
        <tr><td style="padding:28px;font-size:15px;line-height:1.6;">
          ${opts.inner}
        </td></tr>
        <tr><td style="padding:16px 28px;background:#fafafa;border-top:1px solid #e4e4e7;font-size:11px;color:#71717a;line-height:1.5;">
          ${footerLines.map(l => `<div style="margin:2px 0;">${l}</div>`).join('')}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

/**
 * Step 1 of the double-opt-in flow. Sent immediately after the user
 * submits the signup form. The email contains the click-to-confirm
 * button; until they click, status stays 'pending' and we do NOT
 * count them as a subscriber.
 *
 * No unsubscribe link here on purpose — they're not on the list yet,
 * and including one would be confusing ("unsubscribe from what?").
 */
export async function sendNewsletterConfirmation(opts: NewsletterUserEmail): Promise<{ ok: boolean; reason?: string }> {
  const resend = getResend()
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set — skipping newsletter confirmation')
    return { ok: false, reason: 'no_api_key' }
  }
  const isEn = opts.locale === 'en'
  const subject = isEn
    ? 'Confirm your XP-Money newsletter signup'
    : 'Confirma a tua inscrição na newsletter do XP-Money'
  const inner = isEn
    ? `<h2 style="margin:0 0 12px;font-size:20px;color:#0d1424;">One last step 👋</h2>
       <p>Thanks for subscribing to the XP-Money newsletter. Click the button below to confirm your email and we'll start sending you our short, jargon-free pieces on personal finance in Portugal.</p>
       <div style="margin:24px 0;text-align:center;">
         <a href="${opts.actionUrl}" style="display:inline-block;padding:12px 28px;background:#22c55e;color:#000;font-weight:700;text-decoration:none;border-radius:10px;font-size:15px;">Confirm my email</a>
       </div>
       <p style="font-size:13px;color:#71717a;">If the button doesn't work, paste this URL in your browser:<br><a href="${opts.actionUrl}" style="color:#16a34a;word-break:break-all;">${opts.actionUrl}</a></p>
       <p style="font-size:13px;color:#71717a;margin-top:18px;">This link expires in 7 days. If you didn't request this, you can ignore the email — we won't send anything else.</p>`
    : `<h2 style="margin:0 0 12px;font-size:20px;color:#0d1424;">Falta só um clique 👋</h2>
       <p>Obrigado por te inscreveres na newsletter do XP-Money. Carrega no botão abaixo para confirmares o teu email e começamos a enviar-te os nossos artigos curtos e sem jargão sobre finanças pessoais em Portugal.</p>
       <div style="margin:24px 0;text-align:center;">
         <a href="${opts.actionUrl}" style="display:inline-block;padding:12px 28px;background:#22c55e;color:#000;font-weight:700;text-decoration:none;border-radius:10px;font-size:15px;">Confirmar o meu email</a>
       </div>
       <p style="font-size:13px;color:#71717a;">Se o botão não funcionar, copia este URL para o browser:<br><a href="${opts.actionUrl}" style="color:#16a34a;word-break:break-all;">${opts.actionUrl}</a></p>
       <p style="font-size:13px;color:#71717a;margin-top:18px;">Este link expira em 7 dias. Se não foste tu a pedir isto, podes ignorar — não enviamos mais nada.</p>`

  try {
    const html = newsletterShell({ locale: opts.locale, inner })
    const { error } = await resend.emails.send({
      from:    FROM,
      to:      [opts.to],
      subject,
      html,
      text:    htmlToText(html),
    })
    if (error) {
      console.warn('[email] newsletter confirmation Resend error:', error)
      return { ok: false, reason: error.message ?? 'resend_error' }
    }
    return { ok: true }
  } catch (err) {
    console.warn('[email] sendNewsletterConfirmation threw:', err)
    return { ok: false, reason: err instanceof Error ? err.message : 'unknown' }
  }
}

/**
 * Step 2: sent after the user clicks the confirmation link in step 1.
 * Welcomes them properly + sets expectations (frequency, content type)
 * + hands them an unsubscribe link (legally required from here on).
 */
export async function sendNewsletterWelcome(opts: NewsletterUserEmail & { unsubscribeUrl: string }): Promise<{ ok: boolean; reason?: string }> {
  const resend = getResend()
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set — skipping newsletter welcome')
    return { ok: false, reason: 'no_api_key' }
  }
  const isEn = opts.locale === 'en'
  const subject = isEn
    ? 'Welcome to XP-Money 👋'
    : 'Bem-vindo ao XP-Money 👋'
  const inner = isEn
    ? `<h2 style="margin:0 0 12px;font-size:20px;color:#0d1424;">You're in.</h2>
       <p>Thanks for confirming. You'll get short pieces (~2 minutes to read) on personal finance in Portugal — IRS deductions, budgeting, statement parsing, debt payoff. No clickbait, no recycled LinkedIn posts.</p>
       <p><strong>Frequency:</strong> 1-2 per month. We'd rather skip a month than send filler.</p>
       <div style="margin:24px 0;text-align:center;">
         <a href="${opts.actionUrl}" style="display:inline-block;padding:12px 28px;background:#22c55e;color:#000;font-weight:700;text-decoration:none;border-radius:10px;font-size:15px;">Try XP-Money free</a>
       </div>
       <p style="font-size:13px;color:#71717a;">While you wait for the first issue, take 5 minutes to set up your account — the app does the heavy lifting (receipts, statements, score) so the newsletter complements it instead of repeating it.</p>`
    : `<h2 style="margin:0 0 12px;font-size:20px;color:#0d1424;">Estás dentro.</h2>
       <p>Obrigado por confirmares. Vais receber peças curtas (~2 minutos de leitura) sobre finanças pessoais em Portugal — deduções de IRS, orçamento, leitura de extratos, abate de dívidas. Sem clickbait nem reciclagem de posts do LinkedIn.</p>
       <p><strong>Frequência:</strong> 1-2 por mês. Preferimos saltar um mês a mandar enchimento.</p>
       <div style="margin:24px 0;text-align:center;">
         <a href="${opts.actionUrl}" style="display:inline-block;padding:12px 28px;background:#22c55e;color:#000;font-weight:700;text-decoration:none;border-radius:10px;font-size:15px;">Experimentar o XP-Money grátis</a>
       </div>
       <p style="font-size:13px;color:#71717a;">Enquanto a primeira edição não chega, leva 5 minutos para configurar a tua conta — a app faz o trabalho pesado (recibos, extratos, score) e a newsletter complementa em vez de repetir.</p>`

  try {
    const html = newsletterShell({
      locale:         opts.locale,
      inner,
      unsubscribeUrl: opts.unsubscribeUrl,
    })
    const { error } = await resend.emails.send({
      from:    FROM,
      to:      [opts.to],
      subject,
      html,
      text:    htmlToText(html),
    })
    if (error) {
      console.warn('[email] newsletter welcome Resend error:', error)
      return { ok: false, reason: error.message ?? 'resend_error' }
    }
    return { ok: true }
  } catch (err) {
    console.warn('[email] sendNewsletterWelcome threw:', err)
    return { ok: false, reason: err instanceof Error ? err.message : 'unknown' }
  }
}
