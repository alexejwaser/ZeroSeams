// Fill painting — the single translator between the stored `Fill` union and the
// four surfaces that have to render it: Konva nodes, the imperative live-resize
// path, the HTML Canvas 2D thumbnail renderer, and CSS swatch previews.
//
// Fill geometry is stored NORMALIZED (see the Fill docs in types/canvas.ts):
// angle in degrees, cx/cy/r in 0–1 object units. Every function here takes the
// concrete box to resolve against, so nothing normalized ever leaks out and no
// stored value ever has to be rewritten when a box resizes.

import type { Fill, GradientStop } from '@/types/canvas'

/** A colour string that means "paint nothing". */
function isBlankColor(c: string): boolean {
  const s = c.trim().toLowerCase()
  return s === '' || s === 'transparent' || s === 'none'
}

/** Coerce the stored value into a Fill. A bare colour string — the legacy and
 *  still-canonical form for a solid shape/path fill — becomes a solid Fill;
 *  'transparent' / '' become undefined so callers can treat "no paint" uniformly. */
export function normalizeFill(f: string | Fill | undefined): Fill | undefined {
  if (f == null) return undefined
  if (typeof f === 'string') return isBlankColor(f) ? undefined : { type: 'solid', color: f }
  if (f.type === 'solid') return isBlankColor(f.color) ? undefined : f
  if (f.stops.length === 0) return undefined
  return f
}

/** Inverse of normalizeFill: collapse a solid Fill back to its bare colour
 *  string. ShapeObject/PathObject store solids as plain strings, so writing this
 *  form back keeps a shape→frame→shape round-trip value-identical, and keeps
 *  every project file that never touches a gradient byte-identical to before. */
export function denormalizeFill(f: Fill | undefined): string | Fill | undefined {
  if (!f) return undefined
  return f.type === 'solid' ? f.color : f
}

/** Stops sorted by offset and clamped to 0–1 — CanvasGradient.addColorStop
 *  throws on an out-of-range offset. */
function safeStops(stops: GradientStop[]): GradientStop[] {
  return stops
    .map((s) => ({ offset: Math.min(1, Math.max(0, s.offset)), color: s.color }))
    .sort((a, b) => a.offset - b.offset)
}

/** Konva colour stops are one flat array: [offset, color, offset, color, …]. */
function flatStops(stops: GradientStop[]): Array<number | string> {
  const out: Array<number | string> = []
  for (const s of safeStops(stops)) out.push(s.offset, s.color)
  return out
}

/**
 * Endpoints of a linear gradient across `w`×`h` at `origin`.
 * The axis runs through the box centre in direction (cos θ, sin θ) and is long
 * enough to cover the whole box, so 0 and 1 land exactly on opposite corners
 * for a diagonal angle rather than clipping mid-box.
 */
function linearEndpoints(
  angleDeg: number, w: number, h: number, originX: number, originY: number,
): { start: { x: number; y: number }; end: { x: number; y: number } } {
  const rad = (angleDeg * Math.PI) / 180
  const dx = Math.cos(rad)
  const dy = Math.sin(rad)
  // Projection of the box onto the gradient axis.
  const len = Math.abs(w * dx) + Math.abs(h * dy)
  const cx = originX + w / 2
  const cy = originY + h / 2
  return {
    start: { x: cx - (dx * len) / 2, y: cy - (dy * len) / 2 },
    end: { x: cx + (dx * len) / 2, y: cy + (dy * len) / 2 },
  }
}

// ---------------------------------------------------------------------------
// Konva
// ---------------------------------------------------------------------------

/** Every fill attribute Konva reads, so a node can never retain stale state. */
export interface KonvaFillProps {
  fill: string | undefined
  fillPriority: 'color' | 'linear-gradient' | 'radial-gradient'
  fillLinearGradientStartPoint: { x: number; y: number } | undefined
  fillLinearGradientEndPoint: { x: number; y: number } | undefined
  fillLinearGradientColorStops: Array<number | string> | undefined
  fillRadialGradientStartPoint: { x: number; y: number } | undefined
  fillRadialGradientEndPoint: { x: number; y: number } | undefined
  fillRadialGradientStartRadius: number | undefined
  fillRadialGradientEndRadius: number | undefined
  fillRadialGradientColorStops: Array<number | string> | undefined
}

const NO_FILL: KonvaFillProps = {
  fill: undefined,
  fillPriority: 'color',
  fillLinearGradientStartPoint: undefined,
  fillLinearGradientEndPoint: undefined,
  fillLinearGradientColorStops: undefined,
  fillRadialGradientStartPoint: undefined,
  fillRadialGradientEndPoint: undefined,
  fillRadialGradientStartRadius: undefined,
  fillRadialGradientEndRadius: undefined,
  fillRadialGradientColorStops: undefined,
}

/**
 * Konva props for a fill, resolved against a concrete `w`×`h` box whose local
 * origin is (`originX`,`originY`). Spread onto the node — never pass `fill=`
 * alongside it.
 *
 * EVERY key is always present, several of them deliberately `undefined`. That
 * is not defensive noise: Konva's `Context._fill` falls through to
 * `fillLinearGradientColorStops` whenever `fill` is falsy, so a node that once
 * carried a gradient keeps painting it after the fill is switched to none —
 * and a linear→radial switch would keep painting the linear one, since linear
 * is tested first in that fallthrough. Emitting the full key set means both
 * react-konva's prop diff and an imperative `setAttrs` clear what's stale.
 *
 * `originX/originY` exist because local space differs per node: a Konva Rect
 * placed at the object's x/y has its origin at 0,0; a Konva Ellipse is
 * positioned by its CENTRE so its box starts at (-w/2, -h/2); a Konva Path
 * built from absolute anchors has its origin at the canvas origin, so the
 * object's bbox top-left must be passed in.
 */
export function konvaFillProps(
  f: string | Fill | undefined,
  w: number,
  h: number,
  originX = 0,
  originY = 0,
): KonvaFillProps {
  const fill = normalizeFill(f)
  if (!fill || w <= 0 || h <= 0) return { ...NO_FILL }

  if (fill.type === 'solid') {
    return { ...NO_FILL, fill: fill.color, fillPriority: 'color' }
  }

  if (fill.type === 'linear') {
    const { start, end } = linearEndpoints(fill.angle, w, h, originX, originY)
    return {
      ...NO_FILL,
      fillPriority: 'linear-gradient',
      fillLinearGradientStartPoint: start,
      fillLinearGradientEndPoint: end,
      fillLinearGradientColorStops: flatStops(fill.stops),
    }
  }

  const centre = { x: originX + fill.cx * w, y: originY + fill.cy * h }
  return {
    ...NO_FILL,
    fillPriority: 'radial-gradient',
    fillRadialGradientStartPoint: centre,
    fillRadialGradientEndPoint: centre,
    fillRadialGradientStartRadius: 0,
    fillRadialGradientEndRadius: Math.max(fill.r * Math.max(w, h), 0.01),
    fillRadialGradientColorStops: flatStops(fill.stops),
  }
}

// ---------------------------------------------------------------------------
// HTML Canvas 2D (thumbnails)
// ---------------------------------------------------------------------------

/** Set `ctx.fillStyle` for a fill over the box (`x`,`y`,`w`,`h`).
 *  Returns false when there is nothing to paint — callers must skip the fill()
 *  entirely rather than painting whatever fillStyle happened to be set. */
export function apply2dFill(
  ctx: CanvasRenderingContext2D,
  f: string | Fill | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
): boolean {
  const fill = normalizeFill(f)
  if (!fill || w <= 0 || h <= 0) return false

  if (fill.type === 'solid') {
    ctx.fillStyle = fill.color
    return true
  }

  if (fill.type === 'linear') {
    const { start, end } = linearEndpoints(fill.angle, w, h, x, y)
    const grd = ctx.createLinearGradient(start.x, start.y, end.x, end.y)
    for (const s of safeStops(fill.stops)) grd.addColorStop(s.offset, s.color)
    ctx.fillStyle = grd
    return true
  }

  const cx = x + fill.cx * w
  const cy = y + fill.cy * h
  const r = Math.max(fill.r * Math.max(w, h), 0.01)
  const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
  for (const s of safeStops(fill.stops)) grd.addColorStop(s.offset, s.color)
  ctx.fillStyle = grd
  return true
}

// ---------------------------------------------------------------------------
// CSS (swatch previews in the properties and layer panels)
// ---------------------------------------------------------------------------

function cssStops(stops: GradientStop[]): string {
  return safeStops(stops).map((s) => `${s.color} ${(s.offset * 100).toFixed(2)}%`).join(', ')
}

/** A CSS `background` value for a fill. Empty string when there is no paint,
 *  so callers can fall back to their own placeholder. */
export function fillPreviewCss(f: string | Fill | undefined): string {
  const fill = normalizeFill(f)
  if (!fill) return ''
  if (fill.type === 'solid') return fill.color
  if (fill.type === 'linear') {
    // CSS 0deg points UP and grows clockwise; our 0° points RIGHT — hence +90.
    return `linear-gradient(${fill.angle + 90}deg, ${cssStops(fill.stops)})`
  }
  // `ellipse <r> <r>` rather than `circle <r>`: CSS forbids a percentage radius
  // on `circle`, and in the square swatch the two are identical anyway.
  const pct = (fill.r * 100).toFixed(2)
  return `radial-gradient(ellipse ${pct}% ${pct}% at ${(fill.cx * 100).toFixed(2)}% ${(fill.cy * 100).toFixed(2)}%, ${cssStops(fill.stops)})`
}

// ---------------------------------------------------------------------------
// Defaults used by the editor UI
// ---------------------------------------------------------------------------

/** Two stops is the floor — a one-stop gradient is just a solid with extra steps. */
export const DEFAULT_GRADIENT_STOPS: GradientStop[] = [
  { offset: 0, color: '#ffffff' },
  { offset: 1, color: '#000000' },
]
