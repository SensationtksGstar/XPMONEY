import { auth }              from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin }       from '@/lib/supabase'
import { resolveUser }               from '@/lib/resolveUser'
import { awardXP }                   from '@/lib/awardXP'
import { checkAllBadges }            from '@/lib/checkAllBadges'
import { xpForAttack }               from '@/lib/killDebt'
import { z }                         from 'zod'

/**
 * POST /api/debts/[id]/attack
 *
 * Regista uma amortização (pagamento extra) contra uma dívida, actualiza
 * o saldo da dívida, marca como killed se chegar a 0 e premeia o user
 * com XP (base 1 XP/€2 pagos + 20% bonus se acima do mínimo mensal).
 *
 * Transaccional via dois writes sequenciais — Supabase JS client não
 * tem transactions nativas, por isso se o segundo write falhar deixamos
 * um log e confiamos que o row do attack serve de auditoria.
 */

const AttackSchema = z.object({
  amount: z.number().positive().max(10_000_000),
  note:   z.string().max(200).optional().nullable(),
})

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: debtId } = await ctx.params
  if (!debtId) return NextResponse.json({ error: 'ID em falta' }, { status: 400 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }
  const parsed = AttackSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const db = createSupabaseAdmin()

  // 1. Ler a dívida (+ guarda: tem de ser do próprio user)
  const { data: debt, error: lookupErr } = await db
    .from('debts')
    .select('id, current_amount, min_payment, status')
    .eq('id',      debtId)
    .eq('user_id', internalId)
    .maybeSingle()

  if (lookupErr) {
    console.warn('[debts/attack] lookup failed:', lookupErr)
    return NextResponse.json({ error: lookupErr.message }, { status: 500 })
  }
  if (!debt) {
    return NextResponse.json({ error: 'Dívida não encontrada' }, { status: 404 })
  }
  if (debt.status === 'killed') {
    return NextResponse.json({ error: 'Dívida já foi abatida.' }, { status: 400 })
  }

  // 2. Calcular novo saldo + XP merecido (clamp a 0 se passar)
  const currentAmount = Number(debt.current_amount) || 0
  const minPayment    = Number(debt.min_payment)    || 0
  const payment       = parsed.data.amount
  const newBalance    = Math.max(0, currentAmount - payment)
  const isKillShot    = newBalance === 0
  const xp            = xpForAttack(payment, minPayment) + (isKillShot ? 100 : 0)

  // 3. Update dívida
  const updatePatch: Record<string, unknown> = { current_amount: newBalance }
  if (isKillShot) {
    updatePatch.status    = 'killed'
    updatePatch.killed_at = new Date().toISOString()
  }
  const { error: updateErr } = await db
    .from('debts')
    .update(updatePatch)
    .eq('id', debtId)
    .eq('user_id', internalId)

  if (updateErr) {
    console.warn('[debts/attack] update failed:', updateErr)
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  // 4. Registar o attack para o histórico
  const { data: attack, error: attackErr } = await db
    .from('debt_attacks')
    .insert({
      debt_id:   debtId,
      user_id:   internalId,
      amount:    payment,
      xp_earned: xp,
      note:      parsed.data.note ?? null,
    })
    .select()
    .maybeSingle()

  if (attackErr) {
    // Não reverter o update do saldo — o importante é o saldo ficar
    // correcto. O row de histórico é bonito mas não crítico.
    console.warn('[debts/attack] attack insert failed (saldo actualizado):', attackErr)
  }

  // 5. Premiar XP (best-effort)
  let xpResult = null
  try {
    xpResult = await awardXP(db, internalId, xp, 'debt_attack')
  } catch (err) {
    console.warn('[debts/attack] XP award failed (non-fatal):', err)
  }

  // 6. Check badges — fires `debt_killed` when the attack zeroed the debt.
  // Non-fatal: a missing badges row never breaks the user-visible flow.
  let newBadges: Awaited<ReturnType<typeof checkAllBadges>> = []
  if (isKillShot) {
    try {
      newBadges = await checkAllBadges(db, internalId)
    } catch (err) {
      console.warn('[debts/attack] badge check failed (non-fatal):', err)
    }
  }

  return NextResponse.json({
    data: {
      attack,
      new_balance: newBalance,
      killed:      isKillShot,
      xp_earned:   xp,
      xp_result:   xpResult,
      badges:      newBadges,
    },
    error: null,
  }, { status: 201 })
}
