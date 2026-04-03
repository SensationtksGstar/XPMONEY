import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ---- Tailwind ----
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ---- Moeda ----
export function formatCurrency(
  amount: number,
  currency = 'EUR',
  locale = 'pt-PT',
): string {
  return new Intl.NumberFormat(locale, {
    style:    'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatCurrencyCompact(amount: number, currency = 'EUR'): string {
  if (Math.abs(amount) >= 1_000_000)
    return formatCurrency(amount / 1_000_000, currency) + 'M'
  if (Math.abs(amount) >= 1_000)
    return formatCurrency(amount / 1_000, currency) + 'k'
  return formatCurrency(amount, currency)
}

// ---- Datas ----
export function formatDate(date: string | Date): string {
  const d = new Date(date)
  if (isToday(d))     return 'Hoje'
  if (isYesterday(d)) return 'Ontem'
  return format(d, "d 'de' MMMM", { locale: ptBR })
}

export function formatDateFull(date: string | Date): string {
  return format(new Date(date), "d 'de' MMMM 'de' yyyy", { locale: ptBR })
}

export function formatRelativeTime(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR })
}

export function formatMonth(date: Date = new Date()): string {
  return format(date, "MMMM 'de' yyyy", { locale: ptBR })
}

// ---- Percentagem ----
export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

// ---- Números ----
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

// ---- Score ----
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

// ---- Transações ----
export function getTransactionSign(type: 'income' | 'expense' | 'transfer'): string {
  return type === 'income' ? '+' : type === 'expense' ? '-' : '↔'
}

export function getTransactionColor(type: 'income' | 'expense' | 'transfer'): string {
  return type === 'income' ? 'text-green-500' : type === 'expense' ? 'text-red-400' : 'text-blue-400'
}

// ---- Strings ----
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function truncate(str: string, length: number): string {
  return str.length > length ? str.slice(0, length) + '…' : str
}

// ---- Array ----
export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((acc, item) => {
    const group = String(item[key])
    acc[group] = acc[group] ?? []
    acc[group].push(item)
    return acc
  }, {} as Record<string, T[]>)
}
