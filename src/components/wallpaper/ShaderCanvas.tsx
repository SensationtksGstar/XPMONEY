'use client'

import { useEffect, useRef } from 'react'

/**
 * ShaderCanvas — minimal WebGL2 host for a fragment shader.
 *
 * Why roll our own instead of pulling in three.js / r3f:
 *   - The whole point is one fullscreen quad + one fragment shader. Three
 *     is ~150 kB gzipped; this hook weighs about 2 kB.
 *   - No scene graph, camera, meshes or lights to manage. Just a uniform
 *     loop the way ShaderToy shaders expect it.
 *   - We want the same API to drive a huge preview AND tiny thumbnails
 *     without wrestling with r3f's canvas lifecycle.
 *
 * Every shader written against this component must declare these three
 * uniforms (mirrors ShaderToy's convention — easy to port examples):
 *   uniform float iTime;         // seconds since mount
 *   uniform vec2  iResolution;   // canvas px (post-DPR)
 *   uniform vec2  iMouse;        // 0-1 UV; y is GL-flipped (0 = bottom)
 *
 * `animate={false}` renders exactly one frame then stops — cheap enough
 * to run in thumbnail grids without melting a laptop.
 */

const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

const FALLBACK_BG = 'linear-gradient(135deg, #0a1628 0%, #060b14 100%)'

interface Props {
  /** GLSL ES 3.00 fragment shader source. Must output `fragColor`. */
  fragment:   string
  /** If false, renders one frame on mount and pauses (cheap for previews). */
  animate?:   boolean
  /**
   * Pointer source:
   *   - true  (default) → canvas pointermove (element-local tracking)
   *   - false           → static UV (0.5, 0.5)
   *   - 'window'        → window pointermove, mapped to canvas rect.
   *     Use this when the canvas is a fullscreen fixed background behind
   *     interactive content (`pointer-events: none`) and you still want
   *     the whole site to drive the shader.
   */
  interactive?: boolean | 'window'
  className?: string
  ariaLabel?: string
}

export function ShaderCanvas({
  fragment,
  animate     = true,
  interactive = true,
  className   = '',
  ariaLabel,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // WebGL2 is supported everywhere we care about (96%+ global). If the
    // GPU is disabled / iOS Lockdown Mode / very old browser, we silently
    // leave the CSS fallback gradient visible — no red error banner.
    const gl = canvas.getContext('webgl2', {
      antialias:          false,
      alpha:              true,
      premultipliedAlpha: false,
      powerPreference:    'low-power',   // battery-friendly on laptops
    })
    if (!gl) return

    // ── Compile helpers ────────────────────────────────────────────
    const compile = (type: number, src: string): WebGLShader | null => {
      const sh = gl.createShader(type)
      if (!sh) return null
      gl.shaderSource(sh, src)
      gl.compileShader(sh)
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.warn('[ShaderCanvas] compile error:', gl.getShaderInfoLog(sh))
        gl.deleteShader(sh)
        return null
      }
      return sh
    }

    const vs = compile(gl.VERTEX_SHADER,   VERTEX_SHADER)
    const fs = compile(gl.FRAGMENT_SHADER, fragment)
    if (!vs || !fs) return

    const prog = gl.createProgram()
    if (!prog) return
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('[ShaderCanvas] link error:', gl.getProgramInfoLog(prog))
      return
    }

    // Fullscreen quad — two triangles via a TRIANGLE_STRIP of 4 verts.
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1,  1, -1,  -1,  1,  1,  1]),
      gl.STATIC_DRAW,
    )
    const loc = gl.getAttribLocation(prog, 'a_position')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    gl.useProgram(prog)
    const uTime  = gl.getUniformLocation(prog, 'iTime')
    const uRes   = gl.getUniformLocation(prog, 'iResolution')
    const uMouse = gl.getUniformLocation(prog, 'iMouse')

    // ── Resize (DPR-capped at 2 so mobile GPUs survive) ───────────
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr  = Math.min(window.devicePixelRatio || 1, 2)
      const w    = Math.max(1, Math.floor(rect.width  * dpr))
      const h    = Math.max(1, Math.floor(rect.height * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width  = w
        canvas.height = h
        gl.viewport(0, 0, w, h)
      }
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    // ── Mouse tracking (GL Y is flipped vs DOM) ───────────────────
    // Last pointer position is kept even after pointerleave so the
    // shader doesn't snap back to origin (would feel broken — users
    // want the effect to linger).
    const mouse = { x: 0.5, y: 0.5 }
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      mouse.x =       (e.clientX - r.left) / r.width
      mouse.y = 1.0 - (e.clientY - r.top ) / r.height
    }
    // `interactive === 'window'` lets a fullscreen-background canvas with
    // pointer-events:none still react to the whole page's cursor motion.
    const pointerTarget: HTMLCanvasElement | Window | null =
      interactive === 'window' ? window :
      interactive === true     ? canvas :
      null
    pointerTarget?.addEventListener('pointermove', onMove as EventListener, { passive: true })

    // ── Render loop ────────────────────────────────────────────────
    let raf = 0
    let running = true
    const start = performance.now()

    // Respect reduced-motion (OS-level user preference). We still render
    // ONE frame so the visual is not a dead rectangle.
    const reduced = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    const draw = (t: number) => {
      gl.uniform1f(uTime, (t - start) / 1000)
      gl.uniform2f(uRes, canvas.width, canvas.height)
      gl.uniform2f(uMouse, mouse.x, mouse.y)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }

    const loop = (t: number) => {
      if (!running) return
      draw(t)
      raf = requestAnimationFrame(loop)
    }

    if (animate && !reduced) {
      raf = requestAnimationFrame(loop)
    } else {
      // Single-frame render (preview grid / reduced motion).
      draw(performance.now())
    }

    // Pause when off-screen so idle scroll positions don't cost GPU.
    let io: IntersectionObserver | null = null
    if (animate && !reduced && 'IntersectionObserver' in window) {
      io = new IntersectionObserver((entries) => {
        const visible = entries[0]?.isIntersecting ?? false
        if (visible && !running) {
          running = true
          raf = requestAnimationFrame(loop)
        } else if (!visible && running) {
          running = false
          cancelAnimationFrame(raf)
        }
      }, { threshold: 0 })
      io.observe(canvas)
    }

    return () => {
      running = false
      cancelAnimationFrame(raf)
      pointerTarget?.removeEventListener('pointermove', onMove as EventListener)
      io?.disconnect()
      ro.disconnect()
      gl.deleteProgram(prog)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      if (buf) gl.deleteBuffer(buf)
    }
  }, [fragment, animate, interactive])

  return (
    <canvas
      ref={canvasRef}
      aria-label={ariaLabel}
      className={className}
      style={{ background: FALLBACK_BG }}
    />
  )
}
