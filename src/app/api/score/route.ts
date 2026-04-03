import { auth }              from '@clerk/nextjs/server'
import { NextResponse }        from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { calculateFinancialScore } from '@/lib/gamification'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createSupabaseAdmin()

  const { data: user } = await db
    .from('users').select('id').eq('clerk_id', userId).single()
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Score mais recente
  const { data: latest } = await db
    .from('financial_scores')
    .select('*')
    .eq('user_id', user.id)
    .order('calculated_at', { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json({ data: latest ?? null, error: null })
}

export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createSupabaseAdmin()
  const { data: user } = await db
    .from('users').select('id').eq('clerk_id', userId).single()
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const now   = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString()

  // Recolher dados para o cálculo
  const [txResult, goalsResult] = await Promise.all([
    db.from('transactions')
      .select('amount, type, date')
      .eq('user_id', user.id)
      .gte('date', start.split('T')[0])
      .lte('date', end.split('T')[0]),
    db.from('goals')
      .select('current_amount, target_amount, status')
      .eq('user_id', user.id)
      .eq('status', 'active'),
  ])

  const txs   = txResult.data ?? []
  const goals = goalsResult.data ?? []

  const income  = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const savings = income - expense

  const daysWithTx = new Set(txs.map(t => t.date)).size
  const goalsWithProgress = goals.filter(g => g.current_amount > 0).length

  const result = calculateFinancialScore({
    income_month:                 income,
    expense_month:                expense,
    savings_this_month:           savings,
    days_with_transactions:       daysWithTx,
    goals_with_progress:          goalsWithProgress,
    total_goals:                  goals.length,
    budget_overspent_categories:  0, // TODO: calcular com budgets
    total_categories_used:        new Set(txs.map((t: { type: string }) => t.type)).size,
  })

  // Obter score anterior para calcular trend
  const { data: prev } = await db
    .from('financial_scores')
    .select('score')
    .eq('user_id', user.id)
    .order('calculated_at', { ascending: false })
    .limit(1)
    .single()

  const trend = !prev ? 'stable'
    : result.score > prev.score ? 'up'
    : result.score < prev.score ? 'down'
    : 'stable'

  const { data: newScore, error } = await db
    .from('financial_scores')
    .insert({
      user_id:       user.id,
      score:         result.score,
      breakdown:     result.breakdown,
      trend,
      calculated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: newScore, error: null })
}
