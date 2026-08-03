import { create } from 'zustand'
import { useEffect, useRef } from 'react'
import type { AnchorPoint, CanvasObject, ClipShape, ImageObject, PathObject, ShapeObject, TextObject, VideoObject } from '@/types/canvas'
import { useCanvasStore } from './useCanvasStore'
import { spanText } from './textSpans'
import { apply2dFill } from './fill'
import { clipShapeToPathData, solidColorOf } from './frameClip'
import { EMPTY_FRAME_FILL } from './frameModel'
import { getVideoElement } from './videoElementRegistry'

const THUMBNAIL_CONCURRENCY = 3

interface ThumbnailState {
  thumbnails: Record<string, string>
  pendingIds: Set<string>
  markDirty: (id: string) => void
  clearDirty: (id: string) => void
  setThumbnail: (id: string, url: string) => void
  removeThumbnail: (id: string) => void
}

export const useThumbnailStore = create<ThumbnailState>((set) => ({
  thumbnails: {},
  pendingIds: new Set<string>(),

  markDirty: (id) =>
    set((state) => {
      const next = new Set(state.pendingIds)
      next.add(id)
      return { pendingIds: next }
    }),

  clearDirty: (id) =>
    set((state) => {
      const next = new Set(state.pendingIds)
      next.delete(id)
      return { pendingIds: next }
    }),

  setThumbnail: (id, url) =>
    set((state) => ({
      thumbnails: { ...state.thumbnails, [id]: url },
    })),

  removeThumbnail: (id) =>
    set((state) => {
      const { [id]: _removed, ...rest } = state.thumbnails
      return { thumbnails: rest }
    }),
}))

// ---------------------------------------------------------------------------
// Path helpers — inlined here to avoid circular dep with CanvasPathNode.tsx
// ---------------------------------------------------------------------------

interface PathBBox {
  x: number
  y: number
  width: number
  height: number
}

function computePathBBox(anchors: AnchorPoint[]): PathBBox {
  if (anchors.length === 0) return { x: 0, y: 0, width: 0, height: 0 }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const a of anchors) {
    minX = Math.min(minX, a.x)
    minY = Math.min(minY, a.y)
    maxX = Math.max(maxX, a.x)
    maxY = Math.max(maxY, a.y)
    // Include control handles in bbox approximation
    minX = Math.min(minX, a.x + a.handleIn.dx, a.x + a.handleOut.dx)
    minY = Math.min(minY, a.y + a.handleIn.dy, a.y + a.handleOut.dy)
    maxX = Math.max(maxX, a.x + a.handleIn.dx, a.x + a.handleOut.dx)
    maxY = Math.max(maxY, a.y + a.handleIn.dy, a.y + a.handleOut.dy)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

function anchorsToPathData(anchors: AnchorPoint[], closed: boolean): string {
  if (anchors.length < 2) return ''
  const parts: string[] = []
  const first = anchors[0]
  parts.push(`M ${first.x} ${first.y}`)
  for (let i = 1; i < anchors.length; i++) {
    const prev = anchors[i - 1]
    const curr = anchors[i]
    const cp1x = prev.x + prev.handleOut.dx
    const cp1y = prev.y + prev.handleOut.dy
    const cp2x = curr.x + curr.handleIn.dx
    const cp2y = curr.y + curr.handleIn.dy
    parts.push(`C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${curr.x} ${curr.y}`)
  }
  if (closed && anchors.length > 1) {
    const last = anchors[anchors.length - 1]
    const cp1x = last.x + last.handleOut.dx
    const cp1y = last.y + last.handleOut.dy
    const cp2x = first.x + first.handleIn.dx
    const cp2y = first.y + first.handleIn.dy
    parts.push(`C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${first.x} ${first.y}`)
    parts.push('Z')
  }
  return parts.join(' ')
}

// ---------------------------------------------------------------------------
// Media-frame thumbnail helpers — shared by the image and video branches.
// Both draw the same three layers in the same order as the canvas nodes do:
// clip silhouette → frame fill → media → frame stroke.
// ---------------------------------------------------------------------------

interface FrameThumbGeom {
  /** Top-left of the frame box inside the SIZE×SIZE thumbnail. */
  offsetX: number
  offsetY: number
  /** Size of the frame box inside the thumbnail. */
  drawW: number
  drawH: number
  /** Frame space → thumbnail space. */
  scaleX: number
  scaleY: number
}

/** Fit a frame's aspect ratio proportionally into a SIZE×SIZE thumbnail. */
function frameThumbGeom(frameW: number, frameH: number, size: number): FrameThumbGeom {
  const aspect = frameW > 0 && frameH > 0 ? frameW / frameH : 1
  const drawW = aspect > 1 ? size : size * aspect
  const drawH = aspect > 1 ? size / aspect : size
  return {
    offsetX: (size - drawW) / 2,
    offsetY: (size - drawH) / 2,
    drawW,
    drawH,
    scaleX: frameW > 0 ? drawW / frameW : 1,
    scaleY: frameH > 0 ? drawH / frameH : 1,
  }
}

/**
 * Enter frame-local thumbnail space with the frame's real clip silhouette
 * applied, paint the fill, and hand control back to `paintMedia` (which draws in
 * that same space, origin 0,0, extent drawW×drawH). Always balanced by a restore.
 *
 * The clip geometry comes from `clipShapeToPathData` — the same function the
 * export path and the frame stroke use — rather than a re-derived rect, so a
 * rounded / elliptical / custom-path frame thumbnails as the shape it actually is.
 */
function paintFrameThumb(
  ctx: CanvasRenderingContext2D,
  g: FrameThumbGeom,
  frame: { clipShape?: ClipShape; fill?: ImageObject['fill']; frameStroke?: string; frameStrokeWidth?: number },
  isEmpty: boolean,
  paintMedia: (() => void) | null,
): void {
  const d = clipShapeToPathData(frame.clipShape ?? { kind: 'rect' }, g.drawW, g.drawH)
  if (!d) return
  const silhouette = new Path2D(d)

  ctx.save()
  ctx.translate(g.offsetX, g.offsetY)
  ctx.save()
  ctx.clip(silhouette)

  // An empty frame is a fill swatch and nothing else, so it falls back to the
  // same placeholder colour CanvasImageNode paints rather than staying blank.
  const fill = frame.fill ?? (isEmpty ? { type: 'solid' as const, color: EMPTY_FRAME_FILL } : undefined)
  if (apply2dFill(ctx, fill, 0, 0, g.drawW, g.drawH)) {
    ctx.fillRect(0, 0, g.drawW, g.drawH)
  }
  paintMedia?.()
  ctx.restore()

  // Outline: the object's own frame stroke when it has one, otherwise a hairline
  // so a pale or unfilled frame still reads as a shape against the panel.
  if (frame.frameStroke && frame.frameStrokeWidth) {
    ctx.strokeStyle = frame.frameStroke
    ctx.lineWidth = Math.max(1, Math.min(frame.frameStrokeWidth * g.scaleX, 3))
  } else {
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'
    ctx.lineWidth = 1
  }
  ctx.stroke(silhouette)
  ctx.restore()
}

// ---------------------------------------------------------------------------
// generateThumbnail — pure HTML Canvas 2D, no Konva dependency
// ---------------------------------------------------------------------------

export async function generateThumbnail(obj: CanvasObject): Promise<string> {
  const SIZE = 60
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  if (obj.type === 'image') {
    const img = obj as ImageObject
    const g = frameThumbGeom(img.frameWidth, img.frameHeight, SIZE)

    // Empty frames (grid cells) have src: '' — there is no bitmap to await, and
    // routing them through Image() would only ever hit onerror and produce a
    // blank thumbnail. This is the path that replaced LayerPanel's EmptyFrameThumb.
    if (img.isEmpty || !img.src) {
      paintFrameThumb(ctx, g, img, true, null)
      return canvas.toDataURL('image/png')
    }

    return await new Promise<string>((resolve) => {
      const el = new Image()
      el.onload = () => {
        paintFrameThumb(ctx, g, img, false, () => {
          ctx.drawImage(
            el,
            img.contentOffsetX * g.scaleX,
            img.contentOffsetY * g.scaleY,
            img.contentWidth * g.scaleX,
            img.contentHeight * g.scaleY,
          )
        })
        resolve(canvas.toDataURL('image/png'))
      }
      // A frame whose bitmap fails to decode still has fill + silhouette worth
      // showing — better than the blank the old empty-string return produced.
      el.onerror = () => {
        paintFrameThumb(ctx, g, img, false, null)
        resolve(canvas.toDataURL('image/png'))
      }
      el.src = obj.src
    })
  }

  if (obj.type === 'video') {
    // Video objects used to fall through to a blank canvas — they had no branch
    // at all, so every video layer rendered an empty swatch in the panel.
    const vid = obj as VideoObject
    const g = frameThumbGeom(vid.frameWidth, vid.frameHeight, SIZE)
    // The live <video> is the only decoded pixel source available synchronously;
    // CanvasVideoNode seeks it to trimStart on canplay, so an idle video already
    // holds its poster frame.
    const el = getVideoElement(vid.id)
    const decoded = el != null && el.readyState >= 2 && el.videoWidth > 0

    paintFrameThumb(ctx, g, vid, false, decoded
      ? () => {
          ctx.drawImage(
            el,
            vid.contentOffsetX * g.scaleX,
            vid.contentOffsetY * g.scaleY,
            vid.contentWidth * g.scaleX,
            vid.contentHeight * g.scaleY,
          )
        }
      : () => {
          // Not decoded yet (project just loaded, or the element was unmounted):
          // a neutral plate with a play glyph, never nothing.
          ctx.fillStyle = '#3a3a3a'
          ctx.fillRect(0, 0, g.drawW, g.drawH)
          ctx.fillStyle = 'rgba(255,255,255,0.75)'
          const r = Math.min(g.drawW, g.drawH) * 0.18
          const cx = g.drawW / 2, cy = g.drawH / 2
          ctx.beginPath()
          ctx.moveTo(cx - r * 0.6, cy - r)
          ctx.lineTo(cx + r, cy)
          ctx.lineTo(cx - r * 0.6, cy + r)
          ctx.closePath()
          ctx.fill()
        })
    return canvas.toDataURL('image/png')
  }

  if (obj.type === 'text') {
    const txt = obj as TextObject
    ctx.fillStyle = '#2a2a2a'
    ctx.fillRect(0, 0, SIZE, SIZE)

    const sample = spanText(txt).slice(0, 20)
    // Scale font to fit SIZE px wide
    const maxFontSize = Math.min(txt.fontSize, SIZE * 0.4)
    ctx.fillStyle = txt.fill
    ctx.font = `${maxFontSize}px ${txt.fontFamily}`
    ctx.textBaseline = 'middle'
    ctx.fillText(sample, 2, SIZE / 2, SIZE - 4)
    return canvas.toDataURL('image/png')
  }

  if (obj.type === 'shape') {
    const shape = obj as ShapeObject
    // The gradient is resolved against the thumbnail box, not the object's real
    // size — fill geometry is normalized, so it re-scales to any box for free.
    const hasFill = apply2dFill(ctx, shape.fill, 2, 2, SIZE - 4, SIZE - 4)
    if (!hasFill) ctx.fillStyle = '#888888'
    ctx.strokeStyle = shape.stroke || 'transparent'
    ctx.lineWidth = Math.min(shape.strokeWidth || 0, 2)

    if (shape.kind === 'ellipse') {
      ctx.beginPath()
      ctx.ellipse(SIZE / 2, SIZE / 2, SIZE / 2 - 2, SIZE / 2 - 2, 0, 0, Math.PI * 2)
      ctx.fill()
      if (ctx.lineWidth > 0) ctx.stroke()
    } else if (shape.kind === 'line' || shape.kind === 'arrow') {
      // A line has no interior — solidColorOf answers undefined for a gradient
      // rather than guessing one, matching CanvasShapeNode.
      ctx.strokeStyle = solidColorOf(shape.fill) ?? '#888888'
      ctx.lineWidth = Math.max(ctx.lineWidth, 2)
      ctx.beginPath()
      ctx.moveTo(2, SIZE / 2)
      ctx.lineTo(SIZE - 2, SIZE / 2)
      ctx.stroke()
    } else {
      // rect (default)
      const r = Math.min(shape.cornerRadius ?? 0, SIZE / 4)
      ctx.beginPath()
      ctx.roundRect(2, 2, SIZE - 4, SIZE - 4, r)
      ctx.fill()
      if (ctx.lineWidth > 0) ctx.stroke()
    }
    return canvas.toDataURL('image/png')
  }

  if (obj.type === 'path') {
    const path = obj as PathObject
    ctx.fillStyle = '#2a2a2a'
    ctx.fillRect(0, 0, SIZE, SIZE)
    if (path.anchors.length < 2) return canvas.toDataURL('image/png')
    const bbox = computePathBBox(path.anchors)
    if (bbox.width < 1 && bbox.height < 1) return canvas.toDataURL('image/png')
    const margin = 4
    const scale = Math.min(
      (SIZE - margin * 2) / Math.max(bbox.width, 1),
      (SIZE - margin * 2) / Math.max(bbox.height, 1)
    )
    const offX = (SIZE - bbox.width * scale) / 2
    const offY = (SIZE - bbox.height * scale) / 2
    const scaledAnchors = path.anchors.map((a) => ({
      x: (a.x - bbox.x) * scale + offX,
      y: (a.y - bbox.y) * scale + offY,
      handleIn: { dx: a.handleIn.dx * scale, dy: a.handleIn.dy * scale },
      handleOut: { dx: a.handleOut.dx * scale, dy: a.handleOut.dy * scale },
    }))
    const svgPath = anchorsToPathData(scaledAnchors, path.closed)
    if (!svgPath) return canvas.toDataURL('image/png')
    const p2d = new Path2D(svgPath)
    ctx.strokeStyle = path.stroke || '#4488ff'
    ctx.lineWidth = Math.max(1, path.strokeWidth * scale)
    // Resolved against the scaled bbox the path actually occupies in the
    // thumbnail, so a gradient lines up with the silhouette.
    if (apply2dFill(ctx, path.fill, offX, offY, bbox.width * scale, bbox.height * scale)) {
      ctx.fill(p2d)
    }
    ctx.stroke(p2d)
    return canvas.toDataURL('image/png')
  }

  if (obj.type === 'group') {
    ctx.fillStyle = '#333333'
    ctx.fillRect(0, 0, SIZE, SIZE)
    ctx.font = `${SIZE * 0.55}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('📦', SIZE / 2, SIZE / 2)
    return canvas.toDataURL('image/png')
  }

  return canvas.toDataURL('image/png')
}

// ---------------------------------------------------------------------------
// useThumbnailGenerator — call once in CarouselStage
// ---------------------------------------------------------------------------

export function useThumbnailGenerator(): void {
  const markDirty = useThumbnailStore((s) => s.markDirty)
  const clearDirty = useThumbnailStore((s) => s.clearDirty)
  const setThumbnail = useThumbnailStore((s) => s.setThumbnail)
  const removeThumbnail = useThumbnailStore((s) => s.removeThumbnail)
  const prevObjectsRef = useRef<Record<string, CanvasObject>>({})
  const prevPastLengthRef = useRef<number>(-1)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Shared: flush pending dirty IDs → generate thumbnails
  function flushPending(): void {
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      const currentObjects = useCanvasStore.getState().objects
      const ids = Array.from(useThumbnailStore.getState().pendingIds)
      let idx = 0

      async function worker(): Promise<void> {
        while (idx < ids.length) {
          const id = ids[idx++]
          const obj = currentObjects[id]
          if (!obj) {
            clearDirty(id)
            continue
          }
          try {
            const url = await generateThumbnail(obj)
            if (url) setThumbnail(id, url)
            clearDirty(id)
          } catch {
            clearDirty(id)
          }
        }
      }

      void Promise.all(Array.from({ length: Math.min(THUMBNAIL_CONCURRENCY, ids.length) }, worker))
    }, 150)
  }

  // On mount: generate thumbnails for any objects already in the store
  // (handles project loaded before this component mounted)
  useEffect(() => {
    const state = useCanvasStore.getState()
    const ids = Object.keys(state.objects)
    if (ids.length > 0) {
      prevObjectsRef.current = state.objects
      prevPastLengthRef.current = state.past.length
      for (const id of ids) markDirty(id)
      flushPending()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Subscribe: generate on each new history commit
  useEffect(() => {
    const unsubscribe = useCanvasStore.subscribe((state) => {
      const pastLength = state.past.length
      const objects = state.objects

      if (pastLength === prevPastLengthRef.current) return
      prevPastLengthRef.current = pastLength

      const prev = prevObjectsRef.current
      const dirtyIds: string[] = []

      for (const id of Object.keys(objects)) {
        if (prev[id] !== objects[id]) dirtyIds.push(id)
      }
      for (const id of Object.keys(prev)) {
        if (!objects[id]) removeThumbnail(id)
      }

      prevObjectsRef.current = objects

      if (dirtyIds.length === 0) return
      for (const id of dirtyIds) markDirty(id)
      flushPending()
    })

    return () => {
      unsubscribe()
      if (timerRef.current !== null) clearTimeout(timerRef.current)
    }
  }, [markDirty, clearDirty, setThumbnail, removeThumbnail])
}
