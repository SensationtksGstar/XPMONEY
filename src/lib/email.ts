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
