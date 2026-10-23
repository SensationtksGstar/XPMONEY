'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import Link                    from 'next/link'
import { useRouter }           from 'next/navigation'
import { useQuery }            from '@tanstack/react-query'
import { ChevronDown, X }      from 'lucide-react'
import { cn }                  from '@/lib/utils'
import { useLocale }           from '@/lib/i18n/LocaleProvider'
import { useVoltix }           from '@/hooks/useVoltix'
import { resolveMascotGender } from '@/lib/mascotGender'
import { ShareButton }         from '@/components/common/ShareButton'
import {
  MascotCreature, getMascotEvoName, type MascotGender,
} from '@/components/voltix/MascotCreature'
import { wrappedSeenKey, wrappedYear, type WrappedResponse, type WrappedStats } from '@/lib/wrapped'
import type { VoltixMood } from '@/types'

/**
 * Wrapped-lite — slides verticais em CSS puro (scroll-snap), SEM
 * framer-motion. Toque no slide / botão "Continuar" / teclado (↓ ↑ PgDn PgUp
 * Espaço Home End, Esc fecha). prefers-reduced-motion: sem smooth-scroll e
 * sem entradas animadas.
 *
 * Nunca mostra euros. Utilizadores com poucos dados recebem a versão curta
 * (intro → presença honesta → fim) — nada de números inventados.
 */

async function fetchWrapped(preview: boolean, signal: AbortSignal): Promise<WrappedResponse> {
  const res = await fetch(`/api/wrapped${preview ? '?preview=1' : ''}`, { signal })
  if (!res.ok) throw new Error(`wrapped ${res.status}`)
  const json = await res.json() as { data: WrappedResponse | null }
  if (!json.data) throw new Error('wrapped: empty payload')
  return json.data
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const on = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduced
}

interface SlideDef { id: string; content: ReactNode }

export function WrappedClient({ preview }: { preview: boolean }) {
  const { t, locale } = useLocale()
  const router        = useRouter()
  const reduced       = usePrefersReducedMotion()
  const { voltix }    = useVoltix()

  const query = useQuery({
    queryKey: ['wrapped', preview],
    queryFn:  ({ signal }) => fetchWrapped(preview, signal),
  })
  const data = query.data

  const nf = useMemo(() => new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'pt-PT'), [locale])
  const fmt = useCallback((n: number) => nf.format(n), [nf])

  // Abrir o Wrapped do ano (fora da pré-visualização) faz sumir o cartão do dashboard.
  useEffect(() => {
    if (!data || !data.open || data.preview) return
    try {
      localStorage.setItem(wrappedSeenKey(data.year), String(Date.now()))
    } catch (err) {
      console.warn('[wrapped] could not persist seen flag:', err)
    }
  }, [data])

  // Mascote: a da API (open) ou a do estado atual (fechado / a carregar).
  const stats: WrappedStats | null = data && data.open ? data.stats : null
  const gender: MascotGender = resolveMascotGender(stats?.mascotGender ?? voltix?.mascot_gender ?? null)
  const evo    = stats?.evolutionLevel ?? voltix?.evolution_level ?? 1
  const mascot = getMascotEvoName(gender, evo)
  const year   = data?.year ?? wrappedYear()

  const slides: SlideDef[] = useMemo(() => {
    if (!data) return []
    const mascotArt = (mood: VoltixMood, size = 'w-48 h-48 sm:w-56 sm:h-56') => (
      <div className={cn('mx-auto mb-8', size)}>
        <MascotCreature gender={gender} evo={evo} mood={mood} animate={!reduced} className="w-full h-full" />
      </div>
    )

    if (!data.open) {
      return [{
        id: 'closed',
        content: (
          <>
            {mascotArt('neutral')}
            <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight mb-4">{t('wrapped.closed_title', { year })}</h1>
            <p className="text-base text-white/60 leading-relaxed max-w-sm mx-auto mb-8">{t('wrapped.closed_sub')}</p>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center min-h-[48px] px-6 rounded-2xl bg-surface-2 border border-white/10 text-white font-semibold hover:bg-surface-3 active:bg-surface-3 transition-colors touch-manipulation"
            >
              {t('wrapped.back_home')}
            </Link>
          </>
        ),
      }]
    }

    const s     = data.stats
    const short = s.depth === 'short'
    const out: SlideDef[] = []

    /* 1 — intro */
    out.push({
      id: 'intro',
      content: (
        <>
          {data.preview && (
            <span className="inline-block mb-6 text-xs font-semibold uppercase tracking-wider text-white/50 border border-white/10 rounded-full px-3 py-1">
              {t('wrapped.preview_badge')}
            </span>
          )}
          {mascotArt('happy', 'w-56 h-56 sm:w-64 sm:h-64')}
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45 mb-4">{t('wrapped.eyebrow', { year })}</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight mb-4 break-words">{t('wrapped.intro_title', { mascot })}</h1>
          <p className="text-base text-white/60 leading-relaxed max-w-sm mx-auto">
            {short ? t('wrapped.intro_sub_short') : t('wrapped.intro_sub')}
          </p>
        </>
      ),
    })

    /* 2 — presença (ou a versão vazia, honesta) */
    if (s.activeDays === 0) {
      out.push({
        id: 'empty',
        content: (
          <>
            <h2 className="text-3xl font-bold text-white leading-tight mb-4">{t('wrapped.empty_title')}</h2>
            <p className="text-base text-white/60 leading-relaxed max-w-sm mx-auto">{t('wrapped.empty_sub', { mascot })}</p>
          </>
        ),
      })
    } else {
      out.push({
        id: 'presence',
        content: (
          <>
            <p className="text-8xl sm:text-9xl font-bold text-white tabular-nums leading-none tracking-tight">{fmt(s.activeDays)}</p>
            <p className="mt-3 text-lg font-semibold text-green-400">
              {s.activeDays === 1 ? t('wrapped.presence_label_one') : t('wrapped.presence_label')}
            </p>
            <div className="mt-8 space-y-2 max-w-sm mx-auto text-base text-white/65 leading-relaxed">
              {s.transactions > 0 && (
                <p>
                  {s.transactions === 1
                    ? t('wrapped.presence_tx_one', { mascot })
                    : t('wrapped.presence_tx', { n: fmt(s.transactions), mascot })}
                </p>
              )}
              {s.longestStreak >= 2 && <p>{t('wrapped.presence_streak', { n: fmt(s.longestStreak) })}</p>}
              {short && <p>{t('wrapped.presence_short')}</p>}
            </div>
          </>
        ),
      })
    }

    /* 3 — a mascote (só se evoluiu mesmo este ano) */
    if (s.evolutions > 0) {
      out.push({
        id: 'mascot',
        content: (
          <>
            {mascotArt('excited')}
            <p className="text-7xl font-bold text-white tabular-nums leading-none">{fmt(s.evolutions)}</p>
            <p className="mt-3 text-lg font-semibold text-green-400">
              {s.evolutions === 1 ? t('wrapped.mascot_label_one') : t('wrapped.mascot_label')}
            </p>
            <p className="mt-6 text-base text-white/60 leading-relaxed max-w-sm mx-auto">{t('wrapped.mascot_sub', { mascot })}</p>
          </>
        ),
      })
    }

    if (!short) {
      /* 4 — conquistas */
      const wins: Array<{ key: string; value: string; label: string }> = []
      if (s.xp > 0)       wins.push({ key: 'xp', value: fmt(s.xp), label: t('wrapped.wins_xp') })
      if (s.badges > 0)   wins.push({ key: 'badges', value: fmt(s.badges), label: s.badges === 1 ? t('wrapped.wins_badges_one') : t('wrapped.wins_badges') })
      if (s.missions > 0) wins.push({ key: 'missions', value: fmt(s.missions), label: s.missions === 1 ? t('wrapped.wins_missions_one') : t('wrapped.wins_missions') })
      if (wins.length > 0) {
        out.push({
          id: 'wins',
          content: (
            <>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-8">{t('wrapped.wins_title')}</h2>
              <ul className="w-full max-w-sm mx-auto bg-surface-1 border border-white/10 rounded-3xl divide-y divide-white/5 text-left">
                {wins.map(w => (
                  <li key={w.key} className="flex items-baseline justify-between gap-4 px-5 py-4">
                    <span className="text-sm text-white/60">{w.label}</span>
                    <span className="text-2xl font-bold text-white tabular-nums">{w.value}</span>
                  </li>
                ))}
              </ul>
              {s.truncated && <p className="mt-4 text-xs text-white/40 max-w-sm mx-auto">{t('wrapped.truncated_note')}</p>}
            </>
          ),
        })
      }

      /* 5 — o ano em movimentos (categoria por contagem + arco do score) */
      if (s.topCategory || s.score) {
        let scoreLine: string | null = null
        if (s.score) {
          const [yy, mm] = s.score.fromMonth.split('-').map(Number)
          const month = new Date(Date.UTC(yy, (mm || 1) - 1, 15)).toLocaleDateString(
            locale === 'en' ? 'en-US' : 'pt-PT', { month: 'long', timeZone: 'UTC' },
          )
          const diff = s.score.to - s.score.from
          scoreLine = diff > 0
            ? t('wrapped.score_up',   { month, from: s.score.from, to: s.score.to, diff })
            : diff < 0
              ? t('wrapped.score_down', { month, from: s.score.from, to: s.score.to })
              : t('wrapped.score_same', { month, from: s.score.from })
        }
        out.push({
          id: 'numbers',
          content: (
            <>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-8">{t('wrapped.numbers_title')}</h2>
              <div className="w-full max-w-sm mx-auto space-y-3 text-left">
                {s.topCategory && (
                  <div className="bg-surface-1 border border-white/10 rounded-3xl px-5 py-5">
                    <p className="text-2xl font-bold text-white break-words">
                      {s.topCategory.icon && <span className="mr-2" aria-hidden>{s.topCategory.icon}</span>}
                      {s.topCategory.name}
                    </p>
                    <p className="mt-2 text-sm text-white/60 leading-relaxed">
                      {t('wrapped.top_category', { share: s.topCategory.share })}
                    </p>
                  </div>
                )}
                {s.score && scoreLine && (
                  <div className="bg-surface-1 border border-white/10 rounded-3xl px-5 py-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-white/45">{t('wrapped.score_label')}</p>
                    <p className="mt-2 text-3xl font-bold text-white tabular-nums">
                      {s.score.from} <span className="text-white/35" aria-hidden>→</span> {s.score.to}
                    </p>
                    <p className="mt-2 text-sm text-white/60 leading-relaxed">{scoreLine}</p>
                  </div>
                )}
              </div>
            </>
          ),
        })
      }
    }

    /* 6 — fim + partilha */
    out.push({
      id: 'final',
      content: (
        <>
          {mascotArt('celebrating')}
          <h2 className="text-3xl sm:text-4xl font-bold text-white leading-tight mb-4">{t('wrapped.final_title')}</h2>
          <p className="text-base text-white/60 leading-relaxed max-w-sm mx-auto mb-8">
            {t('wrapped.final_sub', { next: year + 1, mascot })}
          </p>
          <ShareButton
            url="/p/wrapped"
            title={t('wrapped.share_title')}
            text={t('wrapped.share_text')}
            label={t('wrapped.share_label')}
            ariaLabel={t('wrapped.share_aria')}
            variant="solid"
          />
          <p className="mt-3 text-xs text-white/40 max-w-xs mx-auto">{t('wrapped.share_note')}</p>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex items-center justify-center min-h-[44px] px-4 text-sm text-white/55 hover:text-white transition-colors touch-manipulation"
          >
            {t('wrapped.back_home')}
          </Link>
        </>
      ),
    })

    return out
  }, [data, gender, evo, mascot, year, reduced, t, fmt, locale])

  /* ── navegação ───────────────────────────────────────────────────────── */
  const scrollerRef = useRef<HTMLDivElement>(null)
  const slideRefs   = useRef<(HTMLElement | null)[]>([])
  const [active, setActive] = useState(0)
  const [seen, setSeen]     = useState<Set<number>>(() => new Set([0]))

  const goTo = useCallback((i: number) => {
    const target = slideRefs.current[Math.max(0, Math.min(slides.length - 1, i))]
    target?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
  }, [slides.length, reduced])

  // Slide ativo = o que ocupa a maior parte do ecrã.
  useEffect(() => {
    const root = scrollerRef.current
    if (!root || slides.length === 0) return
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        const idx = Number((e.target as HTMLElement).dataset.index)
        if (!Number.isFinite(idx)) continue
        setActive(idx)
        setSeen(prev => (prev.has(idx) ? prev : new Set(prev).add(idx)))
      }
    }, { root, threshold: 0.6 })
    slideRefs.current.slice(0, slides.length).forEach(el => { if (el) io.observe(el) })
    return () => io.disconnect()
  }, [slides.length])

  // Foco no contentor para o teclado funcionar logo.
  useEffect(() => {
    if (slides.length > 0) scrollerRef.current?.focus({ preventScroll: true })
  }, [slides.length])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
      const el = document.activeElement as HTMLElement | null
      const onControl = !!el && el !== scrollerRef.current && /^(BUTTON|A|INPUT|TEXTAREA|SELECT)$/.test(el.tagName)
      switch (e.key) {
        case 'ArrowDown': case 'PageDown':
          e.preventDefault(); goTo(active + 1); break
        case ' ':
          if (onControl) return
          e.preventDefault(); goTo(e.shiftKey ? active - 1 : active + 1); break
        case 'ArrowUp': case 'PageUp':
          e.preventDefault(); goTo(active - 1); break
        case 'Home':
          e.preventDefault(); goTo(0); break
        case 'End':
          e.preventDefault(); goTo(slides.length - 1); break
        case 'Escape':
          e.preventDefault(); router.push('/dashboard'); break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, goTo, router, slides.length])

  function onSlideTap(e: ReactMouseEvent, i: number) {
    if ((e.target as HTMLElement).closest('a,button,input,label')) return
    if (i < slides.length - 1) goTo(i + 1)
  }

  /* ── render ──────────────────────────────────────────────────────────── */
  return (
    <div className="fixed inset-0 z-[60] bg-surface-0">
      {/* Barra fixa: marca + fechar (sempre alcançável). */}
      <div
        className="absolute top-0 inset-x-0 z-[2] flex items-center justify-between px-4 pointer-events-none"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 0.5rem)' }}
      >
        <span className="text-xs font-semibold text-white/45 tracking-wide">XP-Money · {year}</span>
        <Link
          href="/dashboard"
          aria-label={t('wrapped.close_aria')}
          className="pointer-events-auto w-11 h-11 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white active:bg-white/10 transition-colors touch-manipulation"
        >
          <X className="w-5 h-5" />
        </Link>
      </div>

      {query.isPending && (
        <div className="h-full flex flex-col items-center justify-center px-6 text-center" role="status">
          {/* Sem mascote aqui: o género vem do localStorage e este estado é
              SSR — renderizá-lo dava mismatch de hidratação a quem tem a Penny. */}
          <div className="w-40 h-40 mb-6 rounded-full bg-surface-1 border border-white/10 motion-safe:animate-pulse" aria-hidden />
          <p className="text-sm text-white/55">{t('wrapped.loading')}</p>
        </div>
      )}

      {query.isError && (
        <div className="h-full flex flex-col items-center justify-center px-6 text-center" role="alert">
          <p className="text-base text-white/70 mb-6">{t('wrapped.error')}</p>
          <button
            type="button"
            onClick={() => { void query.refetch() }}
            className="inline-flex items-center justify-center min-h-[48px] px-6 rounded-2xl bg-surface-2 border border-white/10 text-white font-semibold hover:bg-surface-3 active:bg-surface-3 transition-colors touch-manipulation"
          >
            {t('wrapped.retry')}
          </button>
        </div>
      )}

      {slides.length > 0 && (
        <>
          <div
            ref={scrollerRef}
            tabIndex={-1}
            aria-roledescription="carousel"
            aria-label={t('wrapped.meta_title')}
            className={cn(
              'h-full overflow-y-auto overscroll-contain snap-y snap-mandatory focus:outline-none',
              '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
              !reduced && 'scroll-smooth',
            )}
          >
            {slides.map((slide, i) => {
              const visible = seen.has(i)
              const isLast  = i === slides.length - 1
              return (
                <section
                  key={slide.id}
                  ref={el => { slideRefs.current[i] = el }}
                  data-index={i}
                  aria-roledescription="slide"
                  aria-label={t('wrapped.progress', { n: i + 1, total: slides.length })}
                  onClick={e => onSlideTap(e, i)}
                  className="relative snap-start snap-always h-[100dvh] flex flex-col items-center justify-center px-6 text-center select-none"
                  style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 4.5rem)', paddingTop: '4rem' }}
                >
                  <div
                    className={cn(
                      'w-full max-w-md transition-[opacity,transform] duration-700 ease-out',
                      'motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0',
                      visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
                    )}
                  >
                    {slide.content}
                  </div>

                  {!isLast && (
                    <button
                      type="button"
                      onClick={() => goTo(i + 1)}
                      aria-label={t('wrapped.next_aria')}
                      className="absolute left-1/2 -translate-x-1/2 inline-flex flex-col items-center justify-center min-h-[44px] min-w-[44px] px-4 text-xs font-medium text-white/40 hover:text-white/70 transition-colors touch-manipulation"
                      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
                    >
                      <span>{t('wrapped.next')}</span>
                      <ChevronDown className="w-4 h-4 mt-0.5" aria-hidden />
                    </button>
                  )}
                </section>
              )
            })}
          </div>

          {/* Progresso: decorativo (a navegação é por toque/teclado/botão). */}
          {slides.length > 1 && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 z-[2] flex flex-col gap-2 pointer-events-none" aria-hidden>
              {slides.map((slide, i) => (
                <span
                  key={slide.id}
                  className={cn(
                    'w-1.5 rounded-full transition-all duration-300 motion-reduce:transition-none',
                    i === active ? 'h-5 bg-white/80' : 'h-1.5 bg-white/20',
                  )}
                />
              ))}
            </div>
          )}
          <p className="sr-only" aria-live="polite">{t('wrapped.progress', { n: active + 1, total: slides.length })}</p>
        </>
      )}
    </div>
  )
}
