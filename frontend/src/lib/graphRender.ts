import { cssVar, withAlpha, NODE_COLOR_VAR } from './nodeVisuals'
import type { NodeKind } from '../types/atlas'

/* ============================================================================
   Pure rendering helpers for the graph canvas — the cinematic layer.
   All colors come from a resolved palette (no per-frame getComputedStyle);
   all glows are pre-built radial gradients (never ctx.shadowBlur per frame).
   ========================================================================== */

export interface GraphPalette {
  dark: boolean
  bgEdge: string
  bgCenter: string
  accent: string
  critical: string
  warning: string
  missing: string
  silent: string
  linkBase: string // rgba() healthy hairline base
  particle: string
  outline: string
  label: string
  labelCenter: string
  haloAccent: string
  nodeGrey: string
  nodeGreyExt: string
  node: Record<NodeKind, string>
}

export function resolvePalette(): GraphPalette {
  const kinds: NodeKind[] = ['service', 'queue', 'database', 'store', 'cache', 'external']
  return {
    dark: document.documentElement.classList.contains('dark'),
    bgEdge: cssVar('--graph-bg-edge'),
    bgCenter: cssVar('--graph-bg-center'),
    accent: cssVar('--color-neutral'),
    critical: cssVar('--color-critical'),
    warning: cssVar('--color-warning'),
    missing: cssVar('--link-missing'),
    silent: cssVar('--link-silent'),
    linkBase: cssVar('--link-healthy'),
    particle: cssVar('--link-particle'),
    outline: cssVar('--node-outline'),
    label: cssVar('--node-label'),
    labelCenter: cssVar('--node-label-center'),
    haloAccent: cssVar('--halo-accent'),
    nodeGrey: cssVar('--node-grey'),
    nodeGreyExt: cssVar('--node-grey-ext'),
    node: Object.fromEntries(kinds.map((k) => [k, cssVar(NODE_COLOR_VAR[k])])) as Record<NodeKind, string>,
  }
}

/* --- easing ---------------------------------------------------------------- */

export const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t)
export const smoothstep = (t: number) => {
  const x = clamp01(t)
  return x * x * (3 - 2 * x)
}
/** ease-out with a soft overshoot — the spawn "pop" */
export const easeOutBack = (t: number) => {
  const x = clamp01(t)
  const c = 1.20158
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2)
}
export const easeOutQuint = (t: number) => 1 - Math.pow(1 - clamp01(t), 5)

/* --- link geometry ---------------------------------------------------------
   Matches force-graph's curved-link formula (quadratic bezier whose control
   point sits perpendicular at the midpoint, offset by curvature × length), so
   our drawn paths, our comets, and the library's hit-testing all agree.
   --------------------------------------------------------------------------- */

export interface Pt {
  x: number
  y: number
}

export function controlPoint(s: Pt, t: Pt, curvature: number): Pt {
  const mx = (s.x + t.x) / 2
  const my = (s.y + t.y) / 2
  const dx = t.x - s.x
  const dy = t.y - s.y
  const d = Math.hypot(dx, dy) || 1
  // unit perpendicular
  const px = -dy / d
  const py = dx / d
  return { x: mx + px * curvature * d, y: my + py * curvature * d }
}

export function pointOnLink(s: Pt, t: Pt, curvature: number, u: number): Pt {
  if (!curvature) {
    return { x: s.x + (t.x - s.x) * u, y: s.y + (t.y - s.y) * u }
  }
  const c = controlPoint(s, t, curvature)
  const v = 1 - u
  return {
    x: v * v * s.x + 2 * v * u * c.x + u * u * t.x,
    y: v * v * s.y + 2 * v * u * c.y + u * u * t.y,
  }
}

export function traceLinkPath(ctx: CanvasRenderingContext2D, s: Pt, t: Pt, curvature: number) {
  ctx.beginPath()
  ctx.moveTo(s.x, s.y)
  if (curvature) {
    const c = controlPoint(s, t, curvature)
    ctx.quadraticCurveTo(c.x, c.y, t.x, t.y)
  } else {
    ctx.lineTo(t.x, t.y)
  }
}

/* --- node body -------------------------------------------------------------
   Bodies are FLAT Apple-grey discs with a crisp hairline rim — a lit radial
   gradient reads as a Vista-era orb (user-confirmed, twice). Depth belongs to
   the halo, edges, and motion, never the disc itself. The gradient cache below
   serves halos only.
   --------------------------------------------------------------------------- */

const gradCache = new Map<string, CanvasGradient>()

export function clearGradientCache() {
  gradCache.clear()
}

/** soft ambient halo (focus/hover) — pre-built accent gradient, origin-centered */
export function haloGradient(
  ctx: CanvasRenderingContext2D,
  pal: GraphPalette,
  radius: number,
  alpha: number,
): CanvasGradient {
  const key = `halo-${radius}-${alpha}-${pal.dark}`
  let g = gradCache.get(key)
  if (!g) {
    g = ctx.createRadialGradient(0, 0, 0, 0, 0, radius)
    g.addColorStop(0, withAlpha(pal.accent, alpha))
    g.addColorStop(0.55, withAlpha(pal.accent, alpha * 0.45))
    g.addColorStop(1, withAlpha(pal.accent, 0))
    gradCache.set(key, g)
  }
  return g
}

/* --- comet particles -------------------------------------------------------
   A travelling head with a decaying tail. Light mode uses plain source-over
   (additive 'lighter' clips to white on near-white backgrounds); dark mode
   goes additive for real glow.
   --------------------------------------------------------------------------- */

export interface Comet {
  linkId: string
  t0: number
  error?: boolean
}

export const COMET_TRAVEL_MS = 950
export const COMET_TAIL = 9

export function drawComet(
  ctx: CanvasRenderingContext2D,
  s: Pt,
  t: Pt,
  curvature: number,
  progress: number,
  color: string,
  dark: boolean,
) {
  ctx.save()
  ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over'
  for (let i = COMET_TAIL; i >= 0; i--) {
    const u = progress - i * 0.016
    if (u <= 0 || u >= 1) continue
    const p = pointOnLink(s, t, curvature, u)
    const k = 1 - i / (COMET_TAIL + 1)
    const rad = 0.9 + k * 1.7
    ctx.beginPath()
    ctx.arc(p.x, p.y, rad, 0, 2 * Math.PI)
    ctx.fillStyle = withAlpha(color, (dark ? 0.5 : 0.75) * k * k)
    ctx.fill()
  }
  ctx.restore()
}
