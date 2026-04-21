'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams }    from 'next/navigation'
import { useUser }      from '@clerk/nextjs'
import { useQueryClient } from '@tanstack/react-query'
import { useUserPlan }  from '@/lib/contexts/UserPlanContext'
import Link             from 'next/link'
import {
  ArrowLeft, BookOpen, Check,
  Clock, Star, Trophy, Lock, Crown,
  ChevronLeft, RotateCcw, Award, Shield, Sparkles,
} from 'lucide-react'
import {
  getCourseProgress, markLessonComplete,
  saveCourseProgress,
} from '@/lib/courses'
import type { Course, CourseProgress } from '@/lib/courses'
import { getCourseById } from '@/lib/coursesAccess'
import { useLocale, useT } from '@/lib/i18n/LocaleProvider'

const PLAN_RANK: Record<string, number> = {
  free:    0,
  premium: 1,
  plus:    1,
  pro:     1,
  family:  1,
}

// ── Certificate helpers ──────────────────────────────────────────────────────
/** Deterministic certificate code (same inputs → same code). */
function certCode(courseId: string, userName: string, issuedAt: string) {
  const base = `${courseId}|${userName}|${issuedAt}`
  let hash = 0
  for (let i = 0; i < base.length; i++) hash = ((hash << 5) - hash + base.charCodeAt(i)) | 0
  const hex = Math.abs(hash).toString(16).toUpperCase().padStart(8, '0').slice(0, 8)
  return `XPM-${courseId.toUpperCase().slice(0, 3)}-${hex}`
}

/** Ornamental SVG corner flourish — gold filigree. */
function CornerFlourish({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 80" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#f5d97a" />
          <stop offset="50%"  stopColor="#d4a84a" />
          <stop offset="100%" stopColor="#8a6a1f" />
        </linearGradient>
      </defs>
      <path d="M2 2 L30 2 M2 2 L2 30" stroke="url(#gold)" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M10 2 Q18 6 18 14 T30 26" stroke="url(#gold)" strokeWidth="0.8" fill="none" opacity="0.9" />
      <path d="M2 10 Q6 18 14 18 T26 30" stroke="url(#gold)" strokeWidth="0.8" fill="none" opacity="0.9" />
      <circle cx="20" cy="20" r="1.6" fill="url(#gold)" />
      <circle cx="8"  cy="8"  r="2.2" fill="none" stroke="url(#gold)" strokeWidth="0.6" />
      <path d="M22 14 L28 8 M14 22 L8 28" stroke="url(#gold)" strokeWidth="0.5" opacity="0.6" />
    </svg>
  )
}

// ── Certificate component ────────────────────────────────────────────────────
function Certificate({ course, userName, issuedAt, onMintClick }: {
  course:       Course
  userName:     string
  issuedAt:     string
  onMintClick?: () => void
}) {
  const t = useT()
  const code = certCode(course.id, userName, issuedAt)
  const dateLong = new Date(issuedAt).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })
  const dateShort = new Date(issuedAt).toLocaleDateString('pt-PT')

  return (
    <div className="space-y-4">
      {/* ── Certificate frame ── */}
      <div className="animate-fade-in-up relative rounded-3xl overflow-hidden shadow-[0_20px_60px_-15px_rgba(212,168,74,0.35)]">
        {/* Outer gold gilt border */}
        <div className="p-[2px] bg-gradient-to-br from-[#f5d97a] via-[#8a6a1f] to-[#d4a84a] rounded-3xl">
          {/* Parchment base */}
          <div className="relative rounded-[calc(1.5rem-2px)] overflow-hidden bg-gradient-to-br from-[#0a0f1c] via-[#0d0a1f] to-[#130818] px-6 py-10 sm:px-10 sm:py-12">

            {/* Guilloché pattern background (subtle repeating circles) */}
            <svg className="absolute inset-0 w-full h-full opacity-[0.08] pointer-events-none" aria-hidden>
              <defs>
                <pattern id="guilloche" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                  <circle cx="20" cy="20" r="18" fill="none" stroke="#f5d97a" strokeWidth="0.3" />
                  <circle cx="0"  cy="0"  r="18" fill="none" stroke="#f5d97a" strokeWidth="0.3" />
                  <circle cx="40" cy="40" r="18" fill="none" stroke="#f5d97a" strokeWidth="0.3" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#guilloche)" />
            </svg>

            {/* Holographic sheen */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.04] to-transparent pointer-events-none" />
            <div className="absolute -top-24 -left-24 w-80 h-80 bg-[radial-gradient(closest-side,rgba(245,217,122,0.18),transparent)] pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-[radial-gradient(closest-side,rgba(139,92,246,0.15),transparent)] pointer-events-none" />

            {/* Inner decorative frame */}
            <div className="absolute inset-3 rounded-2xl border border-[#f5d97a]/25 pointer-events-none" />
            <div className="absolute inset-4 rounded-2xl border border-[#f5d97a]/10 pointer-events-none" />

            {/* Corner flourishes (gold filigree) */}
            <CornerFlourish className="absolute top-3 left-3 w-14 h-14" />
            <CornerFlourish className="absolute top-3 right-3 w-14 h-14 -scale-x-100" />
            <CornerFlourish className="absolute bottom-3 left-3 w-14 h-14 -scale-y-100" />
            <CornerFlourish className="absolute bottom-3 right-3 w-14 h-14 -scale-100" />

            {/* ── Content ── */}
            <div className="relative z-10 text-center">

              {/* Top ribbon */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-[#f5d97a]/15 via-[#f5d97a]/25 to-[#f5d97a]/15 border border-[#f5d97a]/30 mb-5">
                <Shield className="w-3 h-3 text-[#f5d97a]" />
                <span className="text-[10px] font-bold text-[#f5d97a] uppercase tracking-[0.3em]">
                  {t('academy.cert.eyebrow')}
                </span>
                <Shield className="w-3 h-3 text-[#f5d97a]" />
              </div>

              {/* Emoji seal */}
              <div className="relative w-20 h-20 mx-auto mb-4">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#f5d97a] via-[#d4a84a] to-[#8a6a1f] animate-[spin_30s_linear_infinite]" />
                <div className="absolute inset-[3px] rounded-full bg-[#0a0f1c] flex items-center justify-center text-4xl">
                  {course.emoji}
                </div>
              </div>

              {/* Main heading — serif, gold */}
              <h2 className="font-serif text-[11px] uppercase tracking-[0.4em] text-white/50 mb-1">
                {t('academy.cert.heading_small')}
              </h2>
              <h1 className="font-serif text-3xl sm:text-4xl font-bold bg-gradient-to-b from-[#fff3c4] via-[#f5d97a] to-[#b8842a] bg-clip-text text-transparent mb-1 leading-tight">
                {t('academy.cert.heading_big')}
              </h1>

              {/* Divider with diamond */}
              <div className="flex items-center justify-center gap-2 my-4" aria-hidden>
                <div className="h-px w-16 bg-gradient-to-r from-transparent to-[#f5d97a]/60" />
                <div className="w-1.5 h-1.5 rotate-45 bg-[#f5d97a]" />
                <div className="h-px w-16 bg-gradient-to-l from-transparent to-[#f5d97a]/60" />
              </div>

              {/* Recipient */}
              <p className="text-white/40 text-[11px] uppercase tracking-[0.3em] mb-2">{t('academy.cert.assigned_to')}</p>
              <h3 className="font-serif text-2xl sm:text-3xl font-bold text-white mb-1 italic">
                {userName}
              </h3>
              <div className="w-40 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent mx-auto mb-5" />

              <p className="text-white/60 text-xs sm:text-sm leading-relaxed max-w-sm mx-auto mb-2">
                {t('academy.cert.by')}
              </p>
              <h4 className="font-serif text-lg sm:text-xl font-bold text-[#f5d97a] leading-snug mb-3 px-2">
                {course.certificate.title}
              </h4>
              <p className="text-white/50 text-xs leading-relaxed max-w-md mx-auto mb-5 italic">
                “{course.certificate.description}”
              </p>

              {/* 5-star excellence mark */}
              <div className="flex items-center justify-center gap-1 mb-6" aria-label={t('academy.cert.stars_aria')}>
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 text-[#f5d97a] fill-[#f5d97a]" />
                ))}
              </div>

              {/* Signature row + official seal */}
              <div className="grid grid-cols-3 gap-3 items-end max-w-md mx-auto mb-6">
                {/* Left — academy signature */}
                <div className="text-center">
                  <div className="font-serif italic text-[#f5d97a] text-sm mb-1">~ XP-Money ~</div>
                  <div className="h-px bg-white/20 mb-1" />
                  <p className="text-[9px] text-white/40 uppercase tracking-wider">{t('academy.cert.academy')}</p>
                </div>

                {/* Centre — official seal */}
                <div className="flex items-center justify-center">
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 rounded-full border-2 border-[#f5d97a]/60 flex items-center justify-center">
                      <div className="absolute inset-1 rounded-full border border-[#f5d97a]/40" />
                      <div className="relative flex flex-col items-center justify-center">
                        <Award className="w-5 h-5 text-[#f5d97a]" />
                        <span className="text-[7px] font-bold text-[#f5d97a] tracking-wider mt-0.5">{t('academy.cert.official')}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right — date */}
                <div className="text-center">
                  <div className="font-serif text-white/80 text-sm mb-1">{dateShort}</div>
                  <div className="h-px bg-white/20 mb-1" />
                  <p className="text-[9px] text-white/40 uppercase tracking-wider">{t('academy.cert.issued')}</p>
                </div>
              </div>

              {/* Verification footer */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-[10px] text-white/35 font-mono">
                <span className="flex items-center gap-1.5">
                  <Shield className="w-3 h-3" />
                  {t('academy.cert.verify_n', { code })}
                </span>
                <span className="hidden sm:inline text-white/20">·</span>
                <span>xpmoney.app/verify</span>
                <span className="hidden sm:inline text-white/20">·</span>
                <span>{dateLong}</span>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* ── NFT upgrade CTA — waitlist / FOMO revenue-validation ── */}
      <button
        onClick={onMintClick}
        className="group w-full flex items-center gap-3 text-left bg-gradient-to-r from-purple-500/10 via-fuchsia-500/10 to-amber-500/10 border border-purple-500/25 hover:border-purple-400/50 rounded-2xl p-4 transition-all active:scale-[0.99] relative overflow-hidden"
      >
        {/* Shimmer across the button */}
        <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none" />

        <div className="w-11 h-11 flex-shrink-0 rounded-xl bg-gradient-to-br from-purple-500 via-fuchsia-500 to-amber-400 flex items-center justify-center shadow-lg shadow-purple-500/30 relative">
          <Sparkles className="w-5 h-5 text-white" />
          {/* Pulsing dot */}
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500">
            <span className="absolute inset-0 rounded-full bg-red-500 animate-ping" />
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <p className="text-sm font-bold text-white">Transforma em NFT colecionável</p>
            <span className="text-[9px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.5 rounded uppercase tracking-wider">Edição limitada</span>
          </div>
          <p className="text-xs text-white/50 leading-snug">
            Apenas 500 certificados serão mintados · Junta-te à lista de espera
          </p>
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="text-sm font-bold text-amber-300">Lista →</div>
          <div className="text-[10px] text-white/40 uppercase tracking-wider">de espera</div>
        </div>
      </button>
    </div>
  )
}

// ── Quiz component ───────────────────────────────────────────────────────────
function Quiz({ course, userId, onComplete }: {
  course:     Course
  userId:     string
  onComplete: (score: number) => void
}) {
  const t = useT()
  const [current,    setCurrent]    = useState(0)
  const [selected,   setSelected]   = useState<number | null>(null)
  const [answers,    setAnswers]    = useState<(number | null)[]>(Array(course.quiz.length).fill(null))
  const [showResult, setShowResult] = useState(false)

  const question = course.quiz[current]
  const isLast   = current === course.quiz.length - 1

  function handleAnswer(idx: number) {
    if (selected !== null) return
    setSelected(idx)
    const newAnswers = [...answers]
    newAnswers[current] = idx
    setAnswers(newAnswers)
  }

  function handleNext() {
    if (!isLast) {
      setCurrent(c => c + 1)
      setSelected(null)
    } else {
      const correct = answers.filter((a, i) => a === course.quiz[i].correct).length
      const score   = Math.round((correct / course.quiz.length) * 100)
      // Certificado exige 100% — todas as respostas correctas
      const passed  = correct === course.quiz.length
      saveCourseProgress(userId, course.id, {
        quizScore:     score,
        completedAt:   passed ? new Date().toISOString() : undefined,
        certificateAt: passed ? new Date().toISOString() : undefined,
      })
      setShowResult(true)
      if (passed) onComplete(score)
    }
  }

  if (showResult) {
    const correct = answers.filter((a, i) => a === course.quiz[i].correct).length
    const score   = Math.round((correct / course.quiz.length) * 100)
    const passed  = correct === course.quiz.length
    const wrongQuestions = answers
      .map((a, i) => a === course.quiz[i].correct ? -1 : i)
      .filter(i => i >= 0)

    return (
      <div className="animate-fade-in-up text-center py-8 space-y-4">
        <div className="text-6xl">{passed ? '🎉' : '💪'}</div>
        <h2 className="text-2xl font-bold text-white">
          {passed ? t('academy.quiz.perfect') : t('academy.quiz.almost')}
        </h2>
        <p className="text-white/60">
          {t('academy.quiz.result', { correct, total: course.quiz.length })}
          <span className={passed ? 'text-green-400 font-bold' : 'text-orange-400 font-bold'}>{score}%</span>
        </p>
        {passed ? (
          <p className="text-green-400 font-medium">{t('academy.quiz.cert_unlocked')}</p>
        ) : (
          <div className="space-y-3">
            <p className="text-white/50 text-sm leading-relaxed max-w-sm mx-auto">
              {t('academy.quiz.fail_rule')} <strong className="text-white">{t('academy.quiz.fail_rule_pct')}</strong>
              {wrongQuestions.length === 1
                ? t('academy.quiz.fail_one')
                : t('academy.quiz.fail_many', { n: wrongQuestions.length })
              }
            </p>
            <button
              onClick={() => { setCurrent(0); setSelected(null); setAnswers(Array(course.quiz.length).fill(null)); setShowResult(false) }}
              className="flex items-center gap-2 mx-auto px-6 py-2.5 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl text-sm transition-all"
            >
              <RotateCcw className="w-4 h-4" /> {t('academy.quiz.retry')}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Progress */}
      <div>
        <div className="flex justify-between text-xs text-white/40 mb-2">
          <span>{t('academy.quiz.progress', { current: current + 1, total: course.quiz.length })}</span>
          <span>{Math.round((current / course.quiz.length) * 100)}%</span>
        </div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-300"
            style={{ width: `${(current / course.quiz.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div key={current} className="space-y-4 animate-fade-in-up">
        <h3 className="text-base font-bold text-white leading-snug">{question.text}</h3>
        <div className="space-y-2.5">
          {question.options.map((opt, idx) => {
            const isSelected = selected === idx
            const isCorrect  = idx === question.correct
            const isWrong    = isSelected && !isCorrect && selected !== null

            return (
              <button
                key={idx}
                onClick={() => handleAnswer(idx)}
                disabled={selected !== null}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all active:scale-98 ${
                  selected === null
                    ? 'bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20'
                    : isCorrect && selected !== null
                      ? 'bg-green-500/20 border-green-500/50 text-green-300'
                      : isWrong
                        ? 'bg-red-500/20 border-red-500/50 text-red-300'
                        : 'bg-white/3 border-white/5 text-white/40'
                }`}
              >
                <span className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    isCorrect && selected !== null ? 'bg-green-500 text-black' :
                    isWrong ? 'bg-red-500 text-white' : 'bg-white/10'
                  }`}>
                    {isCorrect && selected !== null ? '✓' : isWrong ? '✗' : String.fromCharCode(65 + idx)}
                  </span>
                  {opt}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {selected !== null && (
        <button
          onClick={handleNext}
          className="w-full py-3 bg-green-500 hover:bg-green-400 active:bg-green-600 text-black font-bold rounded-xl text-sm transition-all animate-fade-in-up"
        >
          {isLast ? t('academy.quiz.see_result') : t('academy.quiz.next')}
        </button>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function CourseDetailPage() {
  const params   = useParams<{ id: string }>()
  const id       = params.id
  const { user } = useUser()
  const { plan } = useUserPlan()
  const { locale, t } = useLocale()
  // Rebuild the localised course whenever the id or language changes.
  const course   = useMemo(() => getCourseById(id, locale), [id, locale])

  const [activeLesson, setActiveLesson] = useState(0)
  const [progress,     setProgress]     = useState<CourseProgress>({ completedLessons: [], quizScore: null, completedAt: null, certificateAt: null })
  const [view,         setView]         = useState<'lessons' | 'quiz' | 'certificate'>('lessons')
  const [showMint,     setShowMint]     = useState(false)
  const [mintJoined,   setMintJoined]   = useState(false)

  // Waitlist counter — grows deterministically over time so the number feels alive.
  // Base 127 + ~1 person per day since 2026-01-01. Capped near the scarcity limit.
  const waitlistCount = (() => {
    const launch = new Date('2026-01-01').getTime()
    const daysSince = Math.floor((Date.now() - launch) / (1000 * 60 * 60 * 24))
    return Math.min(487, 127 + Math.max(0, daysSince))
  })()
  const waitlistSpot = waitlistCount + 1

  const loadProgress = useCallback(() => {
    if (user?.id && course) {
      const p = getCourseProgress(user.id, course.id)
      setProgress(p)
      if (p.completedAt) setView('certificate')
    }
  }, [user?.id, course])

  useEffect(() => { loadProgress() }, [loadProgress])

  if (!course) {
    return (
      <div className="text-center py-16">
        <p className="text-white/40">{t('academy.detail.not_found')}</p>
        <Link href="/cursos" className="text-green-400 text-sm mt-2 block">{t('academy.detail.back')}</Link>
      </div>
    )
  }

  const userRank = PLAN_RANK[plan] ?? 0
  const reqRank  = PLAN_RANK[course.plan]
  const isLocked = userRank < reqRank

  if (isLocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 space-y-5">
        <div className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${course.color} flex items-center justify-center text-4xl`}>
          {course.emoji}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">{course.title}</h1>
          <p className="text-white/50 max-w-md">{course.subtitle}</p>
        </div>
        <div className="flex items-center gap-2 bg-purple-500/15 border border-purple-500/30 text-purple-300 px-4 py-2.5 rounded-xl font-semibold text-sm">
          <Lock className="w-4 h-4" />
          {t('academy.detail.locked_plan')}
        </div>
        <Link href="/settings/billing"
          className="flex items-center gap-2 bg-purple-500 hover:bg-purple-400 text-white font-bold px-6 py-3 rounded-xl transition-all">
          <Crown className="w-5 h-5" />
          {t('academy.detail.upgrade')}
        </Link>
        <Link href="/cursos" className="text-white/40 hover:text-white text-sm">{t('academy.detail.back_academy')}</Link>
      </div>
    )
  }

  const lesson         = course.lessons[activeLesson]
  const isLessonDone   = progress.completedLessons.includes(lesson.id)
  const allLessonsDone = course.lessons.every(l => progress.completedLessons.includes(l.id))
  const hasCertificate = !!progress.certificateAt
  const userName       = user?.fullName ?? user?.firstName ?? t('academy.cert.user_fallback')
  const completedCount = progress.completedLessons.length
  const pct            = Math.round((completedCount / course.lessons.length) * 100)

  function handleMarkDone() {
    if (!user?.id) return
    markLessonComplete(user.id, course!.id, lesson.id)
    loadProgress()
    if (activeLesson < course!.lessons.length - 1) setActiveLesson(i => i + 1)
  }

  const [quizXpGained, setQuizXpGained] = useState<number | null>(null)
  const qc = useQueryClient()

  function handleQuizComplete(score: number) {
    loadProgress()
    setTimeout(() => setView('certificate'), 1500)
    // Award course-completion XP server-side. Idempotent — safe if the user
    // re-takes the quiz (the endpoint guards duplicates via xp_history).
    if (score === 100 && course) {
      fetch(`/api/courses/${course.id}/complete`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ quizScore: score }),
      })
        .then(r => r.ok ? r.json() : null)
        .then(res => {
          if (res && !res.already_awarded && res.xp_gained > 0) {
            setQuizXpGained(res.xp_gained)
            setTimeout(() => setQuizXpGained(null), 4500)
            // Refresh the XP bar so the new total shows up next visit
            qc.invalidateQueries({ queryKey: ['xp'] })
          }
        })
        .catch(err => console.warn('[course] complete XP award failed:', err))
    }
  }

  return (
    <div className="space-y-5 animate-fade-in-up pb-24 max-w-2xl mx-auto w-full overflow-x-hidden">

      {/* Floating XP-gained toast — fires once when the user passes the quiz */}
      {quizXpGained !== null && (
        <div
          role="status"
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-green-500 text-black font-bold px-4 py-2.5 rounded-xl shadow-xl animate-fade-in-up"
        >
          <Sparkles className="w-4 h-4" />
          {t('academy.xp.toast', { xp: quizXpGained })}
        </div>
      )}

      {/* Back + header */}
      <div className="flex items-center gap-3">
        <Link href="/cursos" className="p-2 text-white/40 hover:text-white transition-colors -ml-2">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-white text-base leading-tight truncate">{course.title}</h1>
          <div className="flex items-center gap-2 text-xs text-white/40 mt-0.5">
            <Clock className="w-3 h-3" />
            {t('academy.duration', { min: course.duration })}
            <span>·</span>
            <BookOpen className="w-3 h-3" />
            {t('academy.lessons_progress', { done: completedCount, total: course.lessons.length })}
          </div>
        </div>
        {hasCertificate && (
          <button
            onClick={() => setView('certificate')}
            className="flex items-center gap-1 text-xs font-bold text-yellow-400 bg-yellow-500/15 border border-yellow-500/30 px-2.5 py-1.5 rounded-xl"
          >
            <Trophy className="w-3.5 h-3.5" /> {t('academy.detail.cert_chip')}
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${course.color} transition-all duration-500`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1 text-xs text-white/30">
          <span>{t('academy.detail.pct_done', { pct })}</span>
          {allLessonsDone && !hasCertificate && <span className="text-green-400">{t('academy.detail.quiz_hint')}</span>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl bg-white/5 p-1">
        {(['lessons', 'quiz', 'certificate'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setView(tab)}
            disabled={tab === 'quiz' && !allLessonsDone}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-30 ${
              view === tab ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/70'
            }`}
          >
            {tab === 'lessons' ? t('academy.detail.tab_lessons') : tab === 'quiz' ? t('academy.detail.tab_quiz') : t('academy.detail.tab_cert')}
          </button>
        ))}
      </div>

      {/* ── LESSONS VIEW ── */}
      {view === 'lessons' && (
        <div className="space-y-4 animate-fade-in-up">
          {/* Lesson selector — wraps on multiple rows, no horizontal scroll */}
          <div className="flex flex-wrap gap-2">
            {course.lessons.map((l, i) => {
              const done = progress.completedLessons.includes(l.id)
              return (
                <button
                  key={l.id}
                  onClick={() => setActiveLesson(i)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    activeLesson === i
                      ? 'bg-green-500/20 border-green-500/40 text-green-300'
                      : done
                        ? 'bg-white/8 border-white/15 text-white/70'
                        : 'bg-white/5 border-white/10 text-white/40 hover:text-white/60'
                  }`}
                >
                  {done
                    ? <Check className="w-3 h-3 text-green-400" />
                    : <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[9px] text-white/50">{i + 1}</span>
                  }
                  <span>{l.title}</span>
                </button>
              )
            })}
          </div>

          {/* Lesson content */}
          <div key={lesson.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden animate-fade-in-up">
            <div className={`bg-gradient-to-r ${course.color} p-5`}>
              <div className="text-3xl mb-2">{lesson.emoji}</div>
              <h2 className="text-lg font-bold text-white">{lesson.title}</h2>
              <div className="flex items-center gap-1.5 text-white/70 text-xs mt-1">
                <Clock className="w-3 h-3" /> {lesson.duration} min
                {isLessonDone && <span className="ml-2 flex items-center gap-0.5 text-white"><Check className="w-3 h-3" /> {t('academy.detail.lesson_done')}</span>}
              </div>
            </div>

            <div className="p-5">
              <div className="prose prose-sm text-white/75 leading-relaxed space-y-3 break-words">
                {lesson.content.split('\n\n').map((para, i) => {
                  const rendered = para.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
                  if (para.includes('|') && para.includes('---')) return null
                  if (para.startsWith('| ')) {
                    const rows = para.split('\n').filter(r => r.trim() && !r.includes('---'))
                    return (
                      <div key={i} className="w-full">
                        <table className="w-full text-xs border-collapse table-fixed">
                          <tbody>
                          {rows.map((row, ri) => {
                            const cells    = row.split('|').filter(Boolean).map(c => c.trim())
                            const isHeader = ri === 0
                            return (
                              <tr key={ri} className={isHeader ? 'border-b border-white/20' : ''}>
                                {cells.map((cell, ci) => isHeader
                                  ? <th key={ci} className="px-2 py-1 text-left text-white/60 font-semibold break-words">{cell}</th>
                                  : <td key={ci} className="px-2 py-1.5 text-white/70 border-b border-white/5 break-words">{cell}</td>
                                )}
                              </tr>
                            )
                          })}
                          </tbody>
                        </table>
                      </div>
                    )
                  }
                  return (
                    <p key={i} className="text-white/70 text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: rendered }}
                    />
                  )
                })}
              </div>

              <div className="flex items-center gap-3 mt-6">
                {activeLesson > 0 && (
                  <button
                    onClick={() => setActiveLesson(i => i - 1)}
                    className="flex items-center gap-1 px-4 py-2.5 bg-white/5 border border-white/10 text-white/60 font-semibold rounded-xl text-sm hover:bg-white/10 transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" /> {t('academy.detail.prev')}
                  </button>
                )}
                <button
                  onClick={handleMarkDone}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 ${
                    isLessonDone
                      ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                      : 'bg-green-500 hover:bg-green-400 text-black'
                  }`}
                >
                  {isLessonDone
                    ? <><Check className="w-4 h-4" /> {t('academy.detail.lesson_done')}</>
                    : activeLesson < course.lessons.length - 1
                      ? <><Check className="w-4 h-4" /> {t('academy.detail.mark_advance')}</>
                      : <><Check className="w-4 h-4" /> {t('academy.detail.mark_done')}</>
                  }
                </button>
              </div>

              {allLessonsDone && !hasCertificate && (
                <button
                  onClick={() => setView('quiz')}
                  className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 font-bold rounded-xl text-sm transition-all animate-fade-in-up"
                >
                  <Star className="w-4 h-4" />
                  {t('academy.detail.quiz_cta')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── QUIZ VIEW ── */}
      {view === 'quiz' && (
        <div className="animate-fade-in-up bg-white/5 border border-white/10 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <Star className="w-5 h-5 text-yellow-400" />
            <h2 className="font-bold text-white">{t('academy.quiz.title')}</h2>
            <span className="text-xs text-white/40 ml-auto">{t('academy.quiz.meta', { count: course.quiz.length })}</span>
          </div>
          {progress.quizScore !== null && progress.quizScore === 100 ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-3">🏆</div>
              <p className="text-white font-bold text-lg">{t('academy.quiz.done')}</p>
              <p className="text-green-400 font-medium">{t('academy.quiz.score', { pct: progress.quizScore })}</p>
              <button onClick={() => setView('certificate')} className="mt-4 px-6 py-2.5 bg-green-500 text-black font-bold rounded-xl text-sm">
                {t('academy.quiz.view_cert')}
              </button>
            </div>
          ) : (
            <Quiz course={course} userId={user?.id ?? ''} onComplete={handleQuizComplete} />
          )}
        </div>
      )}

      {/* ── CERTIFICATE VIEW ── */}
      {view === 'certificate' && (
        <div className="animate-fade-in-up">
          {hasCertificate ? (
            <Certificate
              course={course}
              userName={userName}
              issuedAt={progress.certificateAt!}
              onMintClick={() => setShowMint(true)}
            />
          ) : (
            <div className="text-center py-12 space-y-4">
              <Trophy className="w-14 h-14 text-white/20 mx-auto" />
              <h3 className="text-lg font-semibold text-white/60">{t('academy.cert.locked_title')}</h3>
              <p className="text-white/40 text-sm">{t('academy.cert.locked_desc_a')} <strong className="text-white">{t('academy.cert.locked_desc_b')}</strong> {t('academy.cert.locked_desc_c')}</p>
              {!allLessonsDone && (
                <button onClick={() => setView('lessons')} className="px-6 py-2.5 bg-green-500 text-black font-bold rounded-xl text-sm">
                  {t('academy.cert.continue_lessons')}
                </button>
              )}
              {allLessonsDone && (
                <button onClick={() => setView('quiz')} className="px-6 py-2.5 bg-purple-500 text-white font-bold rounded-xl text-sm">
                  {t('academy.cert.do_quiz')}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── NFT mint waitlist modal ── */}
      {showMint && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mint-title"
          onClick={() => setShowMint(false)}
        >
          <div
            className="w-full max-w-md bg-gradient-to-br from-[#120a1f] via-[#0d1020] to-[#1a0820] border border-purple-500/30 rounded-3xl p-6 animate-fade-in-up shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {mintJoined ? (
              <div className="text-center space-y-3 py-4">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-green-500 to-emerald-400 flex items-center justify-center">
                  <Check className="w-8 h-8 text-black" />
                </div>
                <h3 className="text-xl font-bold text-white">Lugar #{waitlistSpot} garantido!</h3>
                <p className="text-white/60 text-sm leading-relaxed">
                  Estás na posição <strong className="text-amber-300">#{waitlistSpot}</strong> da lista.
                  Assim que o mint estiver disponível, recebes email com link exclusivo para converter{' '}
                  <strong className="text-white">{course.certificate.title}</strong> em NFT ao preço early supporter (€2,99 em vez de €7,99).
                </p>
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200/90 leading-relaxed">
                  <strong>Dica:</strong> Quem está no top 100 da lista tem prioridade no mint e recebe um badge exclusivo "Founding Collector" no perfil.
                </div>
                <button
                  onClick={() => { setShowMint(false); setMintJoined(false) }}
                  className="mt-2 px-6 py-2.5 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl text-sm transition-all"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 via-fuchsia-500 to-amber-400 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 id="mint-title" className="text-lg font-bold text-white">NFT Colecionável</h3>
                    <p className="text-xs text-white/50">Lista de espera · Primeira edição</p>
                  </div>
                </div>

                {/* Scarcity bar */}
                <div className="bg-gradient-to-r from-amber-500/15 to-red-500/10 border border-amber-500/30 rounded-xl p-3 mb-4">
                  <div className="flex items-center justify-between mb-1.5 text-xs">
                    <span className="font-bold text-amber-300 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      {waitlistCount} pessoas na lista
                    </span>
                    <span className="text-white/50">{500 - waitlistCount} de 500 lugares</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-red-500 rounded-full transition-all"
                      style={{ width: `${(waitlistCount / 500) * 100}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-white/50 mt-1.5">
                    Edição genesis limitada · Nunca mais será mintada
                  </p>
                </div>

                <div className="space-y-2 mb-5">
                  {[
                    { icon: '🔐', title: 'Prova de conhecimento verificável', desc: 'Registo público e imutável na blockchain Polygon — para sempre.' },
                    { icon: '💎', title: 'Só 500 unidades · Nunca mais', desc: 'Após esgotar, este NFT nunca voltará a ser emitido.' },
                    { icon: '🌍', title: 'Partilha Web3', desc: 'Mostra no OpenSea, perfil Discord, LinkedIn ou CV.' },
                    { icon: '🏆', title: 'Badge Founding Collector', desc: 'Top 100 recebe badge exclusivo no perfil XP-Money.' },
                  ].map(f => (
                    <div key={f.title} className="flex items-start gap-3 text-sm">
                      <span className="text-lg flex-shrink-0">{f.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white leading-snug">{f.title}</p>
                        <p className="text-xs text-white/50 leading-snug">{f.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-3 mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">Early supporter</p>
                    <p className="text-2xl font-bold text-white">€2,99</p>
                    <p className="text-[10px] text-white/40">só para quem entra agora</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Preço público</p>
                    <p className="text-lg text-white/50 line-through">€7,99</p>
                    <p className="text-[10px] text-red-300">−63%</p>
                  </div>
                </div>

                <button
                  onClick={() => setMintJoined(true)}
                  className="w-full py-3 bg-gradient-to-r from-purple-500 via-fuchsia-500 to-amber-400 hover:opacity-90 text-white font-bold rounded-xl text-sm transition-all active:scale-95 mb-2"
                >
                  Garantir o meu lugar #{waitlistCount + 1} →
                </button>
                <button
                  onClick={() => setShowMint(false)}
                  className="w-full py-2 text-white/40 hover:text-white/70 text-xs transition-colors"
                >
                  Perder o lugar
                </button>
                <p className="text-[10px] text-white/30 text-center mt-3 leading-relaxed">
                  Sem pagamento agora · Reserva grátis · Recebes email quando disponível
                </p>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
