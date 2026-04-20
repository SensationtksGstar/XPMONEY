/**
 * Five interactive fragment shaders designed to feel like a futuristic OS
 * wallpaper — atmospheric, green-tinted (brand palette), mouse-reactive.
 *
 * All shaders share the same contract (set up by ShaderCanvas):
 *   uniform float iTime;         // seconds
 *   uniform vec2  iResolution;   // canvas px
 *   uniform vec2  iMouse;        // 0..1 UV (y already flipped to GL space)
 *
 * Output via `fragColor`. GLSL ES 3.00 (WebGL2).
 *
 * Design intent: these are "ambient and soothing" first, "flashy" second.
 * The landing is a conversion surface, not a demoscene entry — the shaders
 * support the copy, they don't distract from it. Mouse interactivity is
 * intentionally subtle so the visitor FEELS something is alive without
 * it grabbing their eye away from the CTA.
 */

const HEADER = `#version 300 es
precision highp float;
uniform float iTime;
uniform vec2  iResolution;
uniform vec2  iMouse;
out vec4 fragColor;
`

// Shared helpers — kept brand-aware so all five wallpapers look like
// siblings from the same design system, not a random gradient pack.
const HELPERS = /* glsl */ `
// Brand green: #22c55e → (0.13, 0.77, 0.37)
const vec3 BRAND_GREEN   = vec3(0.13, 0.77, 0.37);
// Brand emerald accent: #10b981
const vec3 BRAND_EMERALD = vec3(0.06, 0.72, 0.50);
// Deep background: #060b14
const vec3 DEEP_BG       = vec3(0.023, 0.043, 0.078);

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.02;
    a *= 0.5;
  }
  return v;
}
`

// ── 1. Neon Grid ─────────────────────────────────────────────────────
// Tron-style perspective floor receding into a green horizon. Mouse
// brightens a localised patch of the grid to simulate "cursor light".
const NEON_GRID = HEADER + HELPERS + /* glsl */ `
void main() {
  vec2 fragCoord = gl_FragCoord.xy;
  vec2 uv = fragCoord / iResolution;
  vec2 p = (uv - 0.5) * 2.0;
  p.x *= iResolution.x / iResolution.y;

  // Mouse in the same UV-centred coords.
  vec2 m = (iMouse - 0.5) * 2.0;
  m.x *= iResolution.x / iResolution.y;

  vec3 col = DEEP_BG;

  // Upper half: subtle horizon glow + faint stars.
  if (p.y > -0.05) {
    float horizon = smoothstep(0.6, -0.05, p.y);
    col += BRAND_GREEN * horizon * 0.28;
    float star = step(0.9975, hash(floor(p * 80.0)));
    col += vec3(star) * (1.0 - horizon) * 0.8;
  }
  // Lower half: perspective grid.
  else {
    float depth = 1.0 / max(-p.y, 0.05);
    vec2 grid = vec2(p.x * depth, depth - iTime * 0.4);
    vec2 g = abs(fract(grid) - 0.5);
    float line = smoothstep(0.48, 0.50, max(g.x, g.y));
    float horiz = smoothstep(0.48, 0.50, g.y) * 1.2;
    float fade = smoothstep(4.0, 0.0, depth);

    // Mouse halo projected down onto the grid.
    float mouseLight = 0.0;
    if (m.y < 0.0) {
      vec2 mp = vec2(m.x * (1.0 / -m.y), (1.0 / -m.y) - iTime * 0.4);
      mouseLight = 0.5 / (1.0 + 8.0 * length(grid - mp));
    }

    col += BRAND_GREEN * (line + horiz * 0.3) * fade;
    col += BRAND_EMERALD * mouseLight * fade;
  }

  // Subtle scanline so it reads "screen" not "image".
  col *= 0.92 + 0.08 * sin(fragCoord.y * 1.5);

  fragColor = vec4(col, 1.0);
}
`

// ── 2. Aurora Ribbons ────────────────────────────────────────────────
// Slow, silky colour bands that weave across the screen like a northern
// light. Mouse acts as a weak gravitational pull on the band centre.
const AURORA = HEADER + HELPERS + /* glsl */ `
void main() {
  vec2 fragCoord = gl_FragCoord.xy;
  vec2 uv = fragCoord / iResolution;
  vec2 p = (uv - 0.5);
  p.x *= iResolution.x / iResolution.y;

  vec2 m = (iMouse - 0.5);
  m.x *= iResolution.x / iResolution.y;

  vec3 col = DEEP_BG;

  // Layer three ribbons at different phases for depth.
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float phase = iTime * (0.15 + fi * 0.07);

    // Waveform — sin of x with noise perturbation.
    float wave =
        sin(p.x * (2.0 + fi) + phase) * 0.08
      + fbm(vec2(p.x * 1.3 + phase, fi + iTime * 0.05)) * 0.25 - 0.12;

    // Mouse dips the ribbon slightly toward the cursor Y position.
    float pull = 0.12 * exp(-12.0 * (p.x - m.x) * (p.x - m.x));
    wave += (m.y - wave) * pull;

    float d = abs(p.y - wave);
    float band = smoothstep(0.18, 0.0, d) * (0.7 - fi * 0.18);

    vec3 tint = mix(BRAND_GREEN, BRAND_EMERALD, fi * 0.5);
    col += tint * band;
  }

  // Very light starfield behind.
  float stars = step(0.997, hash(floor(fragCoord * 0.5)));
  col += vec3(stars) * 0.35;

  // Radial vignette for focus.
  col *= 1.0 - 0.55 * length(p);

  fragColor = vec4(col, 1.0);
}
`

// ── 3. Voronoi Veil ──────────────────────────────────────────────────
// Animated voronoi cells that pulse brighter the closer the mouse is.
// Reads as a "data fabric" — cells are a common sci-fi UI motif.
const VORONOI = HEADER + HELPERS + /* glsl */ `
vec2 cellPoint(vec2 cell) {
  // Each cell gets a pseudo-random site that drifts in a Lissajous orbit.
  vec2 seed = vec2(hash(cell), hash(cell + 17.3));
  return vec2(
    0.5 + 0.4 * sin(iTime * 0.6 + seed.x * 6.28),
    0.5 + 0.4 * cos(iTime * 0.7 + seed.y * 6.28)
  );
}

void main() {
  vec2 fragCoord = gl_FragCoord.xy;
  vec2 uv = fragCoord / iResolution;
  vec2 p = uv * vec2(iResolution.x / iResolution.y, 1.0) * 6.0;

  vec2 gp = floor(p);
  vec2 fp = fract(p);

  float d1 = 1e9, d2 = 1e9;
  vec2  closest = vec2(0.0);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 off = vec2(float(x), float(y));
      vec2 c   = cellPoint(gp + off);
      float d  = length(fp - (off + c));
      if (d < d1)      { d2 = d1; d1 = d; closest = gp + off; }
      else if (d < d2) { d2 = d; }
    }
  }

  // Cell edge: F2 - F1 is the classic voronoi edge distance.
  float edge = smoothstep(0.02, 0.0, d2 - d1);

  // Mouse proximity — map mouse into the same tiled space.
  vec2 mp = iMouse * vec2(iResolution.x / iResolution.y, 1.0) * 6.0;
  float cellDist = length(mp - (closest + 0.5));
  float mouseGlow = exp(-1.5 * cellDist);

  float pulse = 0.5 + 0.5 * sin(iTime * 1.5 + hash(closest) * 6.28);

  vec3 col = DEEP_BG;
  col += BRAND_GREEN   * edge * (0.4 + 0.6 * pulse);
  col += BRAND_EMERALD * mouseGlow * 0.7;

  // Soft cell fill for the nearest-to-cursor one.
  col += mouseGlow * 0.05 * (1.0 - d1);

  fragColor = vec4(col, 1.0);
}
`

// ── 4. Metaballs ─────────────────────────────────────────────────────
// Three liquid blobs drifting and merging. The mouse is a fourth,
// user-controlled blob — the whole field re-shapes as you move.
const METABALLS = HEADER + HELPERS + /* glsl */ `
float ball(vec2 p, vec2 c, float r) {
  return r / dot(p - c, p - c);
}

void main() {
  vec2 fragCoord = gl_FragCoord.xy;
  vec2 uv = fragCoord / iResolution;
  vec2 p = (uv - 0.5) * 2.0;
  p.x *= iResolution.x / iResolution.y;

  vec2 m = (iMouse - 0.5) * 2.0;
  m.x *= iResolution.x / iResolution.y;

  // Three autonomous blobs.
  vec2 b1 = vec2(0.6 * sin(iTime * 0.7),          0.5 * cos(iTime * 0.9));
  vec2 b2 = vec2(0.7 * cos(iTime * 0.5 + 1.7),    0.4 * sin(iTime * 0.8 + 2.1));
  vec2 b3 = vec2(0.5 * sin(iTime * 0.9 + 3.3),   -0.5 * cos(iTime * 0.6 + 0.4));

  float f =
      ball(p, b1, 0.06)
    + ball(p, b2, 0.05)
    + ball(p, b3, 0.045)
    + ball(p, m,  0.065);

  // iso-surface: threshold + soft edge for anti-alias feel.
  float surf = smoothstep(0.8, 1.4, f);
  float rim  = smoothstep(1.4, 1.8, f);

  vec3 col = DEEP_BG;
  col = mix(col, BRAND_GREEN * 0.7, surf);
  col = mix(col, BRAND_EMERALD,     rim);

  // Inner hot core — makes it feel like plasma, not paint.
  col += BRAND_GREEN * smoothstep(2.0, 3.5, f) * 0.4;

  fragColor = vec4(col, 1.0);
}
`

// ── 5. Starfield Drift ───────────────────────────────────────────────
// Slow radial particle stream — the classic hyperspace/drift look,
// cranked way down so it's atmospheric not nauseous. Mouse offsets
// the vanishing point, which gives a sense of "looking around".
const STARFIELD = HEADER + HELPERS + /* glsl */ `
float particle(vec2 p, vec2 c, float size) {
  float d = length(p - c);
  return smoothstep(size, 0.0, d);
}

void main() {
  vec2 fragCoord = gl_FragCoord.xy;
  vec2 uv = fragCoord / iResolution;
  vec2 p = (uv - 0.5) * 2.0;
  p.x *= iResolution.x / iResolution.y;

  // Vanishing point tracks the cursor.
  vec2 center = (iMouse - 0.5) * 2.0;
  center.x *= iResolution.x / iResolution.y;
  center *= 0.6;              // dampen — no vertigo

  vec2 d = p - center;

  vec3 col = DEEP_BG;

  // Four radial layers, each with different speed so near/far parallax.
  for (int i = 0; i < 4; i++) {
    float fi   = float(i);
    float sp   = 0.15 + fi * 0.05;
    float z    = fract(iTime * sp + hash(vec2(fi, 3.1)));
    vec2  np   = d / max(z, 0.001) * 0.15;
    vec2  cell = floor(np);
    vec2  fp   = fract(np);
    float hv   = hash(cell + fi * 11.3);
    if (hv > 0.6) {
      float pt = particle(fp, vec2(hv, fract(hv * 7.0)), 0.08 + z * 0.12);
      float depth = 1.0 - z;
      col += BRAND_GREEN * pt * depth * (0.3 + hv * 0.5);
    }
  }

  // Faint streaks toward the centre for motion cue.
  float streak = pow(1.0 - abs(dot(normalize(d + 1e-4), vec2(1.0, 0.0))), 4.0)
               + pow(1.0 - abs(dot(normalize(d + 1e-4), vec2(0.0, 1.0))), 4.0);
  col += BRAND_EMERALD * streak * 0.04;

  // Central glow.
  col += BRAND_GREEN * exp(-6.0 * length(d)) * 0.25;

  fragColor = vec4(col, 1.0);
}
`

export interface WallpaperDef {
  id:          string
  nameKey:     'wallpaper.neon' | 'wallpaper.aurora' | 'wallpaper.voronoi' | 'wallpaper.metaballs' | 'wallpaper.stars'
  descKey:     'wallpaper.neon_d' | 'wallpaper.aurora_d' | 'wallpaper.voronoi_d' | 'wallpaper.metaballs_d' | 'wallpaper.stars_d'
  fragment:    string
}

export const SHADERS: readonly WallpaperDef[] = [
  { id: 'neon',      nameKey: 'wallpaper.neon',      descKey: 'wallpaper.neon_d',      fragment: NEON_GRID },
  { id: 'aurora',    nameKey: 'wallpaper.aurora',    descKey: 'wallpaper.aurora_d',    fragment: AURORA     },
  { id: 'voronoi',   nameKey: 'wallpaper.voronoi',   descKey: 'wallpaper.voronoi_d',   fragment: VORONOI    },
  { id: 'metaballs', nameKey: 'wallpaper.metaballs', descKey: 'wallpaper.metaballs_d', fragment: METABALLS  },
  { id: 'stars',     nameKey: 'wallpaper.stars',     descKey: 'wallpaper.stars_d',     fragment: STARFIELD  },
] as const
