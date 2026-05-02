import 'server-only'
import { createSupabaseAdmin } from '@/lib/supabase'

/**
 * Fire-and-forget cost / observability log for every AI provider call.
 *
 * NEVER throws — failures here must not break the user-facing request.
 * If the migration `database/ai_calls_2026_05.sql` hasn't been applied,
 * inserts silently no-op (Supabase returns "relation does not exist" and
 * we swallow it). This matches the codebase pattern for new tables.
 */

export type AiOperation = 'scan-receipt' | 'parse-statement' | 'categorize-batch'
export type AiStatus    = 'success' | 'error' | 'timeout' | 'quota' | 'auth'

export interface LogAiCallParams {
  userId?:    string | null
  provider:   string
  model:      string
  operation:  AiOperation
  tokensIn?:  number
  tokensOut?: number
  latencyMs:  number
  cacheHit?:  boolean
  status:     AiStatus
  error?:     string
}

export async function logAiCall(p: LogAiCallParams): Promise<void> {
  try {
    const db = createSupabaseAdmin()
    await db.from('ai_calls').insert({
      user_id:    p.userId    ?? null,
      provider:   p.provider,
      model:      p.model,
      operation:  p.operation,
      tokens_in:  Math.max(0, Math.round(p.tokensIn  ?? 0)),
      tokens_out: Math.max(0, Math.round(p.tokensOut ?? 0)),
      latency_ms: Math.max(0, Math.round(p.latencyMs)),
      cache_hit:  !!p.cacheHit,
      status:     p.status,
      error_msg:  p.error?.slice(0, 500) ?? null,
    })
  } catch (err) {
    // Never propagate. Logging failures must not affect user requests.
    console.warn('[ai-cost-log] insert failed (non-fatal):', err)
  }
}

/**
 * Map a provider error message to a status enum. Mirrors the classifier
 * in lib/ai.ts but lives here to keep the log call decoupled.
 */
export function classifyStatus(err: unknown): AiStatus {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
  if (/timeout|deadline/.test(msg))                 return 'timeout'
  if (/\b401|403\b|unauthenticat|api[_ ]?key/.test(msg)) return 'auth'
  if (/quota|resource[_ ]?exhausted|\b429\b|rate[_ -]?limit|billing/.test(msg)) return 'quota'
  return 'error'
}

/**
 * Approximate Gemini 2.5 Flash and 2.0 Flash pricing as of May 2026 (USD per
 * 1M tokens). Used by /admin/metrics to estimate cumulative cost. NOT
 * authoritative — Google can change pricing; refresh when noticeably off.
 */
export const PRICING_USD_PER_M = {
  'gemini-2.5-flash':      { in: 0.075, out: 0.30 },
  'gemini-2.5-flash-text': { in: 0.075, out: 0.30 },
  'gemini-2.5-flash-vision':{ in: 0.075, out: 0.30 },
  'gemini-2.0-flash':      { in: 0.10,  out: 0.40 },
  'gemini-2.0-flash-text': { in: 0.10,  out: 0.40 },
  'gemini-2.0-flash-vision':{ in: 0.10,  out: 0.40 },
  'groq-llama-3.3':        { in: 0.59,  out: 0.79 },
  'groq-llama-text':       { in: 0.59,  out: 0.79 },
  'groq-vision':           { in: 0.34,  out: 0.34 },
  'cache':                 { in: 0,     out: 0 },
} as const

export function estimateCostUsd(model: string, tokensIn: number, tokensOut: number): number {
  const p = (PRICING_USD_PER_M as Record<string, { in: number; out: number }>)[model]
  if (!p) return 0
  return (tokensIn / 1_000_000) * p.in + (tokensOut / 1_000_000) * p.out
}
