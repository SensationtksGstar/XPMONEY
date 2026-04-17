'use client'

import { useEffect, useState } from 'react'
import Link                    from 'next/link'
import { BookOpen, Check, Clock, Lock, Star, Trophy, Zap, Crown } from 'lucide-react'
import { useUser }    from '@clerk/nextjs'
import { useUserPlan } from '@/lib/contexts/UserPlanContext'
import { COURSES, getCourseProgress } from '@/lib/courses'
import type { CourseProgress } from '@/lib/courses'

const LEVEL_COLOR: Record<string, string> = {
  'Iniciante':   'text-green-400 bg-green-500/15 border-green-500/20',
  'Intermédio':  'text-blue-400 bg-blue-500/15 border-blue-500/20',
  'Avançado':    'text-purple-400 bg-purple-500/15 border-purple-500/20',
}

const PLAN_RANK: Record<string, number> = {
  free:    0,
  premium: 1,
  // legacy aliases — manter cursos desbloqueados para contas antigas
  plus:    1,
  pro:     1,
  family:  1,
}

export default function CursosPage() {
  const { user }         = useUser()
  const { plan }         = useUserPlan()
  const [progress, setProgress] = useState<Record<string, CourseProgress>>({})

  useEffect(() => {
    if (!user?.id) return
    const map: Record<string, CourseProgress> = {}
    COURSES.forEach(c => { map[c.id] = getCourseProgress(user.id, c.id) })
    setProgress(map)
  }, [user?.id])

  const completedCount = Object.values(progress).filter(p => p.completedAt).length
  const totalLessons   = COURSES.reduce((s, c) => s + c.lessons.length, 0)
  const doneLessons    = Object.values(progress).reduce((s, p) => s + p.completedLessons.length, 0)

  return (
    <div className="space-y-6 sm:animate-fade-in-up pb-24">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-green-400" />
          Academia XP-Money
        </h1>
        <p className="text-white/50 text-sm mt-0.5">
          Cursos de gestão financeira com certificado oficial
        </p>
      </div>

      {/* Stats */}
      {user && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <div className="text-green-400 font-bold text-xl">{completedCount}</div>
            <div className="text-white/40 text-xs mt-0.5">Concluídos</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <div className="text-white font-bold text-xl">{doneLessons}/{totalLessons}</div>
            <div className="text-white/40 text-xs mt-0.5">Lições</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <div className="text-purple-400 font-bold text-xl">{completedCount}</div>
            <div className="text-white/40 text-xs mt-0.5">Certificados</div>
          </div>
        </div>
      )}

      {/* Course list */}
      <div className="space-y-4">
        {COURSES.map((course, i) => {
          const prog        = progress[course.id]
          const isCompleted = !!prog?.completedAt
          const lessonsComp = prog?.completedLessons.length ?? 0
          const hasQuiz     = !!prog && prog.quizScore !== null
          const pct         = Math.round((lessonsComp / course.lessons.length) * 100)
          const userRank    = PLAN_RANK[plan] ?? 0
          const reqRank     = PLAN_RANK[course.plan]
          const isLocked    = userRank < reqRank

          return (
            <div
              key={course.id}
              className="sm:animate-fade-in-up"
              style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'both' }}
            >
              {isLocked ? (
                /* Locked state */
                <div className="bg-white/3 border border-white/8 rounded-2xl p-5 opacity-80">
                  <div className="flex items-start gap-4">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${course.color} opacity-50 flex items-center justify-center text-2xl flex-shrink-0`}>
                      {course.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-bold text-white/60 text-base leading-tight">{course.title}</h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${LEVEL_COLOR[course.level]}`}>
                          {course.level}
                        </span>
                      </div>
                      <p className="text-white/35 text-xs mb-3 line-clamp-2">{course.subtitle}</p>
                      <div className="flex items-center gap-3 text-xs text-white/30">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{course.duration}min</span>
                        <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{course.lessons.length} lições</span>
                        <span className="flex items-center gap-1"><Trophy className="w-3 h-3" />Certificado</span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <div className="flex items-center gap-1 bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-bold px-2.5 py-1.5 rounded-xl">
                        <Lock className="w-3 h-3" />
                        Premium
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Link
                      href="/settings/billing"
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 font-bold text-sm rounded-xl transition-all"
                    >
                      <Crown className="w-4 h-4" />
                      Fazer upgrade para Premium
                    </Link>
                  </div>
                </div>
              ) : (
                /* Unlocked state */
                <Link href={`/cursos/${course.id}`} className="block group">
                  <div className={`bg-white/5 border rounded-2xl p-5 transition-all group-hover:border-white/25 ${
                    isCompleted ? 'border-green-500/40' : 'border-white/10'
                  }`}>
                    <div className="flex items-start gap-4">
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${course.color} flex items-center justify-center text-2xl flex-shrink-0 shadow-lg`}>
                        {course.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-bold text-white text-base leading-tight">{course.title}</h3>
                          {isCompleted && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-green-400 bg-green-500/15 px-1.5 py-0.5 rounded-full">
                              <Check className="w-2.5 h-2.5" /> Concluído
                            </span>
                          )}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${LEVEL_COLOR[course.level]}`}>
                            {course.level}
                          </span>
                        </div>
                        <p className="text-white/50 text-xs mb-3 line-clamp-2">{course.subtitle}</p>
                        <div className="flex items-center gap-3 text-xs text-white/40">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{course.duration}min</span>
                          <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{course.lessons.length} lições</span>
                          {hasQuiz && prog?.quizScore !== null && (
                            <span className="flex items-center gap-1 text-green-400">
                              <Star className="w-3 h-3" />{prog.quizScore}% no quiz
                            </span>
                          )}
                        </div>
                      </div>
                      <Zap className="w-4 h-4 text-white/20 group-hover:text-green-400 transition-colors flex-shrink-0 mt-1" />
                    </div>

                    {/* Progress bar */}
                    {pct > 0 && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs text-white/40">
                            {lessonsComp}/{course.lessons.length} lições
                          </span>
                          <span className="text-xs text-white/40">{pct}%</span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full bg-gradient-to-r ${course.color} transition-all duration-500`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* CTA */}
                    <div className="mt-4">
                      <div className={`w-full text-center py-2.5 rounded-xl text-sm font-bold transition-all ${
                        isCompleted
                          ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                          : pct > 0
                            ? 'bg-white/10 text-white group-hover:bg-white/15'
                            : 'bg-green-500 text-black group-hover:bg-green-400'
                      }`}>
                        {isCompleted ? '🏆 Ver certificado' : pct > 0 ? 'Continuar curso' : 'Começar curso'}
                      </div>
                    </div>
                  </div>
                </Link>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
