// ── XP-Money — Locale-aware course accessor ──────────────────────────────────
// Merges the PT base (single structural source of truth) with the EN override
// map. Pure, side-effect-free: safe to call from both server and client.
//
// The PT file stays untouched. When `locale === 'en'`, lesson/quiz items with
// no override gracefully fall back to PT so the UI never breaks.

import { COURSES, type Course, type Lesson, type QuizQuestion } from './courses'
import { COURSES_EN, type CourseEnOverride } from './courses.en'
import type { Locale } from './i18n/translations'

/**
 * Deep-merge a single PT course with its EN override. Returns a fresh mutable
 * object so downstream consumers can mutate safely (the source PT array is
 * never touched). Any field missing in the override falls back to PT.
 */
function mergeEn(base: Course, override: CourseEnOverride | undefined): Course {
  if (!override) return cloneCourse(base)

  const lessons: Lesson[] = base.lessons.map(l => {
    const lo = override.lessons?.[l.id]
    return {
      ...l,
      title:   lo?.title   ?? l.title,
      content: lo?.content ?? l.content,
    }
  })

  const quiz: QuizQuestion[] = base.quiz.map(q => {
    const qo = override.quiz?.[q.id]
    return {
      ...q,
      text:    qo?.text    ?? q.text,
      options: qo?.options ? [...qo.options] : [...q.options],
    }
  })

  return {
    ...base,
    title:    override.title    ?? base.title,
    subtitle: override.subtitle ?? base.subtitle,
    certificate: {
      title:       override.certificate?.title       ?? base.certificate.title,
      description: override.certificate?.description ?? base.certificate.description,
    },
    lessons,
    quiz,
  }
}

/** Shallow clone that still returns fresh arrays for lessons/quiz. */
function cloneCourse(c: Course): Course {
  return {
    ...c,
    certificate: { ...c.certificate },
    lessons:     c.lessons.map(l => ({ ...l })),
    quiz:        c.quiz.map(q => ({ ...q, options: [...q.options] })),
  }
}

/**
 * Returns the course catalogue in the requested locale. PT returns a shallow
 * clone of the source; EN returns PT base deep-merged with the override map.
 */
export function getCourses(locale: Locale): Course[] {
  if (locale === 'pt') return COURSES.map(cloneCourse)
  return COURSES.map(c => mergeEn(c, COURSES_EN[c.id]))
}

/**
 * Returns a single course by id in the requested locale, or `undefined` if
 * the id is unknown. Pure function — safe for server or client components.
 */
export function getCourseById(id: string, locale: Locale): Course | undefined {
  const base = COURSES.find(c => c.id === id)
  if (!base) return undefined
  if (locale === 'pt') return cloneCourse(base)
  return mergeEn(base, COURSES_EN[id])
}
