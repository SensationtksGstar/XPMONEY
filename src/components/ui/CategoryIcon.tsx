'use client'

/**
 * CategoryIcon — Revolut/N26-style transaction icon
 *
 * Design principles:
 * - Rounded square (squircle), not a plain circle
 * - Full-colour category background with subtle inner glow
 * - Crisp Lucide SVG icon (never emoji at small sizes)
 * - Income gets a distinct "money in" green treatment
 * - Transfer gets a blue bilateral arrow treatment
 */

import {
  UtensilsCrossed, Car, Heart, Gamepad2, GraduationCap,
  Home, Shirt, Laptop, Wallet, Briefcase, Package, TrendingUp,
  ArrowLeftRight, Fuel, ShoppingCart, Baby, Plane, Music,
  Dumbbell, Coffee, Landmark, PiggyBank, Gift, Stethoscope,
  Wrench, Smartphone, Bus, ShoppingBag, ArrowDownLeft, ArrowUpRight,
  type LucideIcon,
} from 'lucide-react'

type TransactionType = 'income' | 'expense' | 'transfer'

interface CategoryIconProps {
  categoryName?: string | null
  categoryColor?: string | null
  type: TransactionType
  size?: 'sm' | 'md' | 'lg'
}

/* ── Category → Icon mapping ─────────────────────────────────────────── */
const ICON_MAP: Record<string, LucideIcon> = {
  // Expenses
  alimentação:   UtensilsCrossed,
  alimentacao:   UtensilsCrossed,
  restaurante:   UtensilsCrossed,
  comida:        UtensilsCrossed,
  supermercado:  ShoppingCart,
  transporte:    Car,
  combustível:   Fuel,
  combustivel:   Fuel,
  uber:          Car,
  autocarro:     Bus,
  metro:         Bus,
  saúde:         Heart,
  saude:         Heart,
  médico:        Stethoscope,
  medico:        Stethoscope,
  farmácia:      Stethoscope,
  farmacia:      Stethoscope,
  ginásio:       Dumbbell,
  ginasio:       Dumbbell,
  lazer:         Gamepad2,
  entretenimento:Gamepad2,
  música:        Music,
  musica:        Music,
  educação:      GraduationCap,
  educacao:      GraduationCap,
  curso:         GraduationCap,
  casa:          Home,
  renda:         Home,
  habitação:     Home,
  habitacao:     Home,
  roupas:        Shirt,
  roupa:         Shirt,
  vestuário:     Shirt,
  vestuario:     Shirt,
  moda:          Shirt,
  tecnologia:    Laptop,
  software:      Smartphone,
  telemóvel:     Smartphone,
  telemovel:     Smartphone,
  streaming:     Laptop,
  viagem:        Plane,
  viagens:       Plane,
  bebé:          Baby,
  bebe:          Baby,
  criança:       Baby,
  crianca:       Baby,
  café:          Coffee,
  cafe:          Coffee,
  presente:      Gift,
  presentes:     Gift,
  manutenção:    Wrench,
  manutencao:    Wrench,
  compras:       ShoppingBag,
  outros:        Package,
  other:         Package,
  // Income
  salário:       Wallet,
  salario:       Wallet,
  vencimento:    Wallet,
  freelance:     Briefcase,
  rendimento:    Wallet,
  investimentos: TrendingUp,
  dividendos:    TrendingUp,
  poupança:      PiggyBank,
  poupanca:      PiggyBank,
  banco:         Landmark,
}

/* ── Color palette per type ──────────────────────────────────────────── */
const TYPE_DEFAULTS = {
  income:   { color: '#22c55e', icon: ArrowDownLeft },
  expense:  { color: '#94a3b8', icon: Package },
  transfer: { color: '#60a5fa', icon: ArrowLeftRight },
}

/* ── Size map ────────────────────────────────────────────────────────── */
const SIZES = {
  sm: { wrap: 'w-8 h-8 rounded-xl',   icon: 'w-3.5 h-3.5' },
  md: { wrap: 'w-10 h-10 rounded-2xl', icon: 'w-4.5 h-4.5' },
  lg: { wrap: 'w-12 h-12 rounded-2xl', icon: 'w-5 h-5' },
}

export function CategoryIcon({
  categoryName,
  categoryColor,
  type,
  size = 'md',
}: CategoryIconProps) {
  const sz = SIZES[size]

  // Resolve icon
  const key    = (categoryName ?? '').toLowerCase().trim()
  const Icon   = ICON_MAP[key] ?? TYPE_DEFAULTS[type].icon
  const color  = categoryColor ?? TYPE_DEFAULTS[type].color

  // For income: always use green, override category color
  const finalColor = type === 'income' ? '#22c55e' : type === 'transfer' ? '#60a5fa' : color

  // Background: colour at 14% opacity; border: colour at 22% opacity
  const bg     = `${finalColor}24`
  const border = `${finalColor}38`

  return (
    <div
      className={`${sz.wrap} flex items-center justify-center flex-shrink-0 transition-transform active:scale-90`}
      style={{ backgroundColor: bg, border: `1.5px solid ${border}` }}
    >
      <Icon
        strokeWidth={2}
        className={sz.icon}
        style={{ color: finalColor }}
      />
    </div>
  )
}
