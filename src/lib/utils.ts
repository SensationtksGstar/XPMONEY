import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, isToday, isYesterday, type Locale as DateFnsLocale } from 'date-fns'
import { ptBR, enUS } from 'date-fns/locale'
import type { Locale } from './i18n/translations'

// ---- Tailwind ----
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ---- Locale mapping ─────────────────────────────────────────────────
// Two sides of the same concept: "pt" | "en" drives every UI string AND
// all numeric/date formatting. Keep the mappings together so we never
// drift (e.g. showing PT copy with "$1,234.56" or vice-versa).
const INTL_LOCALE: Record<Locale, string> = {
  pt: 'pt-PT',
  en: 'en-US',
}
const DATE_FNS_LOCALE: Record<Locale, DateFnsLocale> = {
  pt: ptBR,   // date-fns has no pt-PT — ptBR is visually identical for our formats
  en: enUS,
}

// ---- Currency ───────────────────────────────────────────────────────
// Signature is deliberately overloaded: legacy callers pass no locale (and
// get PT formatting for backwards-compat); new callers pass 'pt' | 'en' OR
// a full BCP-47 tag. Keeping the default avoids rewriting every legacy
// `formatCurrency(n)` call site in a single PR.
export function formatCurrency(
  amount:   number,
  currency: string = 'EUR',
  locale:   Locale | string = 'pt-PT',
): string {
  const intlLocale = locale === 'pt' ? 'pt-PT' : locale === 'en' ? 'en-US' : locale
  return new Intl.NumberFormat(intlLocale, {
    style:                 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatCurrencyCompact(
  amount:   number,
  currency: string = 'EUR',
  locale:   Locale | string = 'pt-PT',
): string {
  if (Math.abs(amount) >= 1_000_000)
    return formatCurrency(amount / 1_000_000, currency, locale) + 'M'
  if (Math.abs(amount) >= 1_000)
    return formatCurrency(amount / 1_000, currency, locale) + 'k'
  return formatCurrency(amount, currency, locale)
}

// ---- Dates ──────────────────────────────────────────────────────────
function dateFnsFor(locale?: Locale): DateFnsLocale {
  if (locale && DATE_FNS_LOCALE[locale]) return DATE_FNS_LOCALE[locale]
  return ptBR // default for legacy callers
}

export function formatDate(date: string | Date, locale?: Locale): string {
  const d = new Date(date)
  if (isToday(d))     return locale === 'en' ? 'Today'     : 'Hoje'
  if (isYesterday(d)) return locale === 'en' ? 'Yesterday' : 'Ontem'
  return locale === 'en'
    ? format(d, 'MMM d', { locale: enUS })
    : format(d, "d 'de' MMMM", { locale: ptBR })
}

export function formatDateFull(date: string | Date, locale?: Locale): string {
  return locale === 'en'
    ? format(new Date(date), 'MMMM d, yyyy', { locale: enUS })
    : format(new Date(date), "d 'de' MMMM 'de' yyyy", { locale: ptBR })
}

export function formatRelativeTime(date: string | Date, locale?: Locale): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: dateFnsFor(locale) })
}

export function formatMonth(date: Date = new Date(), locale?: Locale): string {
  return locale === 'en'
    ? format(date, 'MMMM yyyy', { locale: enUS })
    : format(date, "MMMM 'de' yyyy", { locale: ptBR })
}

// ---- Percentage ─────────────────────────────────────────────────────
export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

// ---- Numbers ────────────────────────────────────────────────────────
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

// ---- Score ──────────────────────────────────────────────────────────
export function getScoreColor(score: number): string {
  if (score < 40) return 'text-score-critical'
  if (score < 60) return 'text-score-low'
  if (score < 75) return 'text-score-medium'
  if (score < 90) return 'text-score-good'
  return 'text-score-elite'
}

export function getScoreBgColor(score: number): string {
  if (score < 40) return 'bg-red-500'
  if (score < 60) return 'bg-orange-500'
  if (score < 75) return 'bg-yellow-500'
  if (score < 90) return 'bg-green-500'
  return 'bg-purple-500'
}

// ---- Transactions ───────────────────────────────────────────────────
export function getTransactionSign(type: 'income' | 'expense' | 'transfer'): string {
  return type === 'income' ? '+' : type === 'expense' ? '-' : '↔'
}

export function getTransactionColor(type: 'income' | 'expense' | 'transfer'): string {
  return type === 'income' ? 'text-green-500' : type === 'expense' ? 'text-red-400' : 'text-blue-400'
}

// ---- Strings ────────────────────────────────────────────────────────
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function truncate(str: string, length: number): string {
  return str.length > length ? str.slice(0, length) + '…' : str
}

// ---- Arrays ─────────────────────────────────────────────────────────
export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((acc, item) => {
    const group = String(item[key])
    acc[group] = acc[group] ?? []
    acc[group].push(item)
    return acc
  }, {} as Record<string, T[]>)
}

export { INTL_LOCALE, DATE_FNS_LOCALE }
