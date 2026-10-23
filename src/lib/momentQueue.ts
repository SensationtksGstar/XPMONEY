/**
 * momentQueue — orquestrador de "momentos" de ecrã (out. 2026).
 *
 * Problema: cinematic de evolução, modais de celebração (streak/nível/badge),
 * boas-vindas e pedidos (push, instalar PWA) viviam em componentes
 * independentes e podiam aparecer todos ao mesmo tempo — no dia 1 o modal
 * "Bem-vindo" tapava o hatch do ovo.
 *
 * Regra: UM momento ativo de cada vez, por prioridade
 *   cinematic > celebration > welcome > request
 *
 * - Não-preemptivo para os modais: quem já está no ecrã acaba primeiro.
 * - Exceção: um `request` (card de push / prompt PWA — não-modais, ficam no
 *   ecrã até serem dispensados) é RECUPERADO quando chega algo de prioridade
 *   superior: volta a 'waiting' (esconde-se) e regressa depois. Sem isto, um
 *   card de push esquecido bloqueava para sempre qualquer celebração.
 * - Janela de acomodação (SETTLE_MS) antes de cada concessão: pedidos que
 *   chegam quase juntos (dashboard + watcher na mesma montagem) competem por
 *   prioridade, não por ordem de chegada. Intervalo (GAP_MS) entre momentos
 *   seguidos para não "encavalitar".
 * - Pedidos (`request`): no máximo 1 por sessão (sessionStorage + memória do
 *   módulo) e 1 por dia civil do dispositivo (localStorage). Conta-se quando
 *   é CONCEDIDO (= vai ser mostrado). Um pedido negado fica 'denied'.
 *   O limite é por PEDIDO (chave estável, 3.º argumento de useMoment), não por
 *   montagem: o mesmo pedido que já tem a quota do dia volta a ser concedido
 *   se o componente remontar (navegar para fora e voltar); outro pedido não.
 *
 * Uso (componentes client):
 *   const slot = useMoment('celebration', hasSomethingToShow)
 *   if (slot === 'granted') render o modal
 *
 * `wanted=false` (ou desmontar) liberta o lugar. Sem storage (modo privado)
 * o limite cai para a memória do módulo — nunca rebenta.
 */

import { useEffect, useId, useState } from 'react'

export type MomentKind   = 'cinematic' | 'celebration' | 'welcome' | 'request'
export type MomentStatus = 'idle' | 'waiting' | 'granted' | 'denied'

const PRIORITY: Record<MomentKind, number> = {
  cinematic:   0,
  celebration: 1,
  welcome:     2,
  request:     3,
}

const SETTLE_MS = 250
const GAP_MS    = 500

const REQ_SESSION_KEY = 'xpmoney:moment:request-session'
const REQ_DAY_KEY     = 'xpmoney:moment:request-day'

interface Entry {
  id:       string
  kind:     MomentKind
  seq:      number
  /** Já contou para o limite de pedidos (re-concessão após recuperação é livre). */
  counted:  boolean
  /** Identidade estável do pedido (quota diária/sessão pertence a esta chave). */
  reqKey:   string
  listener: (s: MomentStatus) => void
}

let waiting: Entry[]       = []
let active: Entry | null   = null
let timer: ReturnType<typeof setTimeout> | null = null
let seq = 0
let requestHolder: string | null = null

/* ── limite de pedidos ─────────────────────────────────────────────────── */

function todayKey(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function requestAllowed(key: string): boolean {
  if (requestHolder !== null) return requestHolder === key
  try {
    const sess = window.sessionStorage.getItem(REQ_SESSION_KEY)
    if (sess && sess !== key) return false
    const day = window.localStorage.getItem(REQ_DAY_KEY)
    if (day && day.startsWith(`${todayKey()}|`) && day !== `${todayKey()}|${key}`) return false
  } catch (err) {
    console.warn('[momentQueue] storage unavailable, using in-memory request cap:', err)
  }
  return true
}

function markRequestGranted(key: string): void {
  requestHolder = key
  try {
    window.sessionStorage.setItem(REQ_SESSION_KEY, key)
    window.localStorage.setItem(REQ_DAY_KEY, `${todayKey()}|${key}`)
  } catch (err) {
    console.warn('[momentQueue] could not persist request cap:', err)
  }
}

/* ── agendador ─────────────────────────────────────────────────────────── */

function hasBetterThanRequest(): boolean {
  return waiting.some(w => w.kind !== 'request')
}

function schedule(delay: number): void {
  if (timer !== null) return
  const canRevoke = active?.kind === 'request' && hasBetterThanRequest()
  if (active && !canRevoke) return
  if (!active && waiting.length === 0) return
  timer = setTimeout(pick, delay)
}

function pick(): void {
  timer = null

  // Recupera um pedido não-modal quando chegou algo mais importante.
  if (active && active.kind === 'request' && hasBetterThanRequest()) {
    const revoked = active
    active = null
    waiting.push(revoked)
    revoked.listener('waiting')
  }
  if (active) return

  waiting.sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind] || a.seq - b.seq)

  while (waiting.length > 0) {
    const next = waiting.shift() as Entry
    if (next.kind === 'request' && !next.counted) {
      if (!requestAllowed(next.reqKey)) {
        next.listener('denied')
        continue
      }
      markRequestGranted(next.reqKey)
      next.counted = true
    }
    active = next
    next.listener('granted')
    return
  }
}

function enqueue(id: string, kind: MomentKind, reqKey: string, listener: (s: MomentStatus) => void): void {
  if (active?.id === id || waiting.some(w => w.id === id)) return
  waiting.push({ id, kind, seq: seq++, counted: false, reqKey, listener })
  listener('waiting')
  schedule(SETTLE_MS)
}

function release(id: string): void {
  if (active?.id === id) {
    active = null
    schedule(GAP_MS)
    return
  }
  waiting = waiting.filter(w => w.id !== id)
}

/* ── hook ──────────────────────────────────────────────────────────────── */

/**
 * Pede um lugar para um momento de tipo `kind` enquanto `wanted` for true.
 * Devolve 'granted' quando é a vez deste componente aparecer.
 * `requestKey` (só `request`): identidade estável do pedido, ex. 'push-nudge'
 * ou 'pwa-install' — a quota diária/sessão pertence-lhe e sobrevive a remontagens.
 */
export function useMoment(kind: MomentKind, wanted: boolean, requestKey?: string): MomentStatus {
  const id = useId()
  const [status, setStatus] = useState<MomentStatus>('idle')

  useEffect(() => {
    if (!wanted) return
    enqueue(id, kind, requestKey ?? id, setStatus)
    return () => {
      release(id)
      setStatus('idle')
    }
  }, [id, kind, wanted, requestKey])

  return wanted ? status : 'idle'
}
