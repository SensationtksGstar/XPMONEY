'use client'

import { useState } from 'react'

/**
 * ReviewAvatar — foto de perfil dos testemunhos da landing.
 *
 * Client island mínimo (~1 KB): o LandingReviews é server component e o
 * onError de fallback exige um handler client (mesmo racional do
 * PricingPeriodToggle). Se a imagem falhar, degrada para a inicial do nome
 * num círculo neutro — nunca UI quebrada (regra do projeto, padrão
 * MascotCreature onError→SVG).
 *
 * As fotos são retratos 100% gerados por IA (pessoas que NÃO existem) —
 * nunca stock de pessoas reais em testemunhos sintéticos (direitos de
 * imagem). alt="" + aria-hidden: o avatar é decorativo, o nome está no
 * <p> adjacente; repeti-lo seria ruído para screen readers.
 */
export function ReviewAvatar({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div
        aria-hidden
        className="w-9 h-9 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-sm font-semibold text-white/70 flex-shrink-0"
      >
        {name.charAt(0)}
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- 128px estático em public/, next/image seria overhead
    <img
      src={src}
      alt=""
      aria-hidden
      width={36}
      height={36}
      loading="lazy"
      decoding="async"
      onError={() => {
        console.warn('[ReviewAvatar] failed to load:', src)
        setFailed(true)
      }}
      className="w-9 h-9 rounded-full object-cover border border-white/10 flex-shrink-0"
    />
  )
}
