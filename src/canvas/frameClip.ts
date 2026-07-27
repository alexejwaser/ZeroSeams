// Clip-shape geometry for InDesign-style media frames.
// Turns a normalized ClipShape (0–1 units of frame size) into concrete clip
// paths for Konva rendering, and provides normalize/denormalize helpers so the
// clip is stored transform-free and re-scales with the frame automatically.

import type Konva from 'konva'
import type { AnchorPoint, ClipShape, Fill } from '@/types/canvas'
import { anchorsToPathData } from './CanvasPathNode'

type PathCtx = CanvasRenderingContext2D | Konva.Context

/** Solid colour of a Fill, or undefined for fill kinds that have none.
 *  Always read `fill` through this — the union grows (gradient) and an unguarded
 *  `fill.color` would silently break. */
export function solidColorOf(fill: Fill | undefined): string | undefined {
  if (!fill) return undefined
  return fill.type === 'solid' ? fill.color : undefined
}

/** Feather-style "image" glyph in a 24×24 box — centered hint on empty frames. */
export const EMPTY_FRAME_ICON_PATH =
  'M5 3 h14 a2 2 0 0 1 2 2 v14 a2 2 0 0 1 -2 2 h-14 a2 2 0 0 1 -2 -2 v-14 a2 2 0 0 1 2 -2 Z ' +
  'M10 8.5 a1.5 1.5 0 1 1 -3 0 a1.5 1.5 0 1 1 3 0 ' +
  'M21 15 L16 10 L5 21'

/** True for an absent clip or a plain (non-rounded) rectangle clip — these use
 *  Konva's zero-cost `clip` rect prop rather than a traced clipFunc. */
export function isPlainRectClip(clipShape: ClipShape | undefined): boolean {
  return !clipShape || (clipShape.kind === 'rect' && !clipShape.cornerRadius)
}

// ---------------------------------------------------------------------------
// Anchor normalization — 0–1 units of frame size ⟷ frame-local pixels.
// Storing anchors normalized means a frame resize never has to rewrite the clip.
// ---------------------------------------------------------------------------

/** Convert absolute-space anchors into 0–1 units relative to `bbox`. */
export function normalizeAnchors(
  anchors: AnchorPoint[],
  bbox: { x: number; y: number; width: number; height: number },
): AnchorPoint[] {
  const w = bbox.width || 1
  const h = bbox.height || 1
  return anchors.map((a) => ({
    x: (a.x - bbox.x) / w,
    y: (a.y - bbox.y) / h,
    handleIn: { dx: a.handleIn.dx / w, dy: a.handleIn.dy / h },
    handleOut: { dx: a.handleOut.dx / w, dy: a.handleOut.dy / h },
  }))
}

/** Convert normalized (0–1) anchors into frame-local pixels for the given size. */
export function denormalizeAnchors(
  anchors: AnchorPoint[],
  frameW: number,
  frameH: number,
): AnchorPoint[] {
  return anchors.map((a) => ({
    x: a.x * frameW,
    y: a.y * frameH,
    handleIn: { dx: a.handleIn.dx * frameW, dy: a.handleIn.dy * frameH },
    handleOut: { dx: a.handleOut.dx * frameW, dy: a.handleOut.dy * frameH },
  }))
}

// ---------------------------------------------------------------------------
// buildClipFunc — a Konva/Canvas clipFunc that traces the clip path.
// Follows Konva convention: issue path commands only; the caller (Konva) runs
// beginPath()/clip() around it.
// ---------------------------------------------------------------------------

/** Returns undefined for a degenerate frame. Critical: Konva runs
 *  `beginPath(); clipFunc(); clip()`, so a clipFunc that issues NO path commands
 *  clips the entire group away — it does not mean "no clip". Callers must pass
 *  the undefined straight through to Konva rather than invoking an empty trace. */
export function buildClipFunc(
  clipShape: ClipShape,
  frameW: number,
  frameH: number,
): ((ctx: PathCtx) => void) | undefined {
  if (frameW <= 0 || frameH <= 0) return undefined
  return (ctx: PathCtx) => {
    if (clipShape.kind === 'rect') {
      const r = clipShape.cornerRadius
      if (r && r > 0) {
        traceRoundedRect(ctx, frameW, frameH, Math.min(r, frameW / 2, frameH / 2))
      } else {
        ctx.rect(0, 0, frameW, frameH)
      }
    } else if (clipShape.kind === 'ellipse') {
      ctx.ellipse(frameW / 2, frameH / 2, frameW / 2, frameH / 2, 0, 0, Math.PI * 2, false)
    } else {
      traceBeziers(ctx, denormalizeAnchors(clipShape.anchors, frameW, frameH))
    }
  }
}

function traceRoundedRect(ctx: PathCtx, w: number, h: number, r: number): void {
  ctx.moveTo(r, 0)
  ctx.arcTo(w, 0, w, h, r)
  ctx.arcTo(w, h, 0, h, r)
  ctx.arcTo(0, h, 0, 0, r)
  ctx.arcTo(0, 0, w, 0, r)
  ctx.closePath()
}

function traceBeziers(ctx: PathCtx, anchors: AnchorPoint[]): void {
  if (anchors.length < 2) return
  const first = anchors[0]
  ctx.moveTo(first.x, first.y)
  const segment = (a: AnchorPoint, b: AnchorPoint): void => {
    const outZero = a.handleOut.dx === 0 && a.handleOut.dy === 0
    const inZero = b.handleIn.dx === 0 && b.handleIn.dy === 0
    if (outZero && inZero) {
      ctx.lineTo(b.x, b.y)
    } else {
      ctx.bezierCurveTo(
        a.x + a.handleOut.dx, a.y + a.handleOut.dy,
        b.x + b.handleIn.dx, b.y + b.handleIn.dy,
        b.x, b.y,
      )
    }
  }
  for (let i = 0; i < anchors.length - 1; i++) segment(anchors[i], anchors[i + 1])
  // Clip paths are always closed — trace the closing segment too.
  segment(anchors[anchors.length - 1], first)
  ctx.closePath()
}

// ---------------------------------------------------------------------------
// clipShapeToPathData — SVG `d` string for the clip at a concrete size.
// Reuses anchorsToPathData for path clips.
// ---------------------------------------------------------------------------

export function clipShapeToPathData(clipShape: ClipShape, w: number, h: number): string {
  if (w <= 0 || h <= 0) return ''
  if (clipShape.kind === 'rect') {
    const r = clipShape.cornerRadius
    if (r && r > 0) {
      const rr = Math.min(r, w / 2, h / 2)
      return (
        `M ${rr} 0 H ${w - rr} A ${rr} ${rr} 0 0 1 ${w} ${rr} ` +
        `V ${h - rr} A ${rr} ${rr} 0 0 1 ${w - rr} ${h} ` +
        `H ${rr} A ${rr} ${rr} 0 0 1 0 ${h - rr} ` +
        `V ${rr} A ${rr} ${rr} 0 0 1 ${rr} 0 Z`
      )
    }
    return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`
  }
  if (clipShape.kind === 'ellipse') {
    const rx = w / 2
    const ry = h / 2
    return `M 0 ${ry} A ${rx} ${ry} 0 1 0 ${w} ${ry} A ${rx} ${ry} 0 1 0 0 ${ry} Z`
  }
  return anchorsToPathData(denormalizeAnchors(clipShape.anchors, w, h), true)
}
