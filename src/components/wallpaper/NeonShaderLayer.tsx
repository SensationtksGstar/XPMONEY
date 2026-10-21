'use client'

import { useState }     from 'react'
import { ShaderCanvas } from './ShaderCanvas'
import { NEON_GRID }    from './shaders'

/**
 * Camada do shader Neon Grid. Vive por cima do gradiente estatico do
 * SiteBackground e comeca a opacity 0: so faz fade-in quando o primeiro frame
 * esta desenhado. Nenhum no muda de posicao, por isso nao ha layout shift.
 * Se o WebGL2 nao existir, onReady nunca dispara e fica o gradiente.
 */
export function NeonShaderLayer() {
  const [ready, setReady] = useState(false)

  return (
    <div
      className="absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none"
      style={{ opacity: ready ? 1 : 0 }}
    >
      <ShaderCanvas
        fragment={NEON_GRID}
        interactive="window"
        className="absolute inset-0 w-full h-full"
        ariaLabel=""
        onReady={() => setReady(true)}
      />
    </div>
  )
}
