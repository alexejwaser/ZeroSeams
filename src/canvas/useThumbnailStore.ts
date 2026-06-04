import { create } from 'zustand'
import { useEffect, useRef } from 'react'
import type { AnchorPoint, CanvasObject, ImageObject, PathObject, ShapeObject, TextObject } from '@/types/canvas'
import { useCanvasStore } from './useCanvasStore'
import { spanText } from './textSpans'

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
// generateMaskThumbnail — black/white mask preview (white=visible, black=hidden)
// ---------------------------------------------------------------------------

function generateMaskThumbnail(img: ImageObject): string {
  const SIZE = 44
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx || !img.mask || img.mask.anchors.length < 3) {
    if (ctx) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SIZE, SIZE) }
    return canvas.toDataURL()
  }
  const { anchors, inverted } = img.mask
  const scaleX = SIZE / Math.max(img.contentWidth, 1)
  const scaleY = SIZE / Math.max(img.contentHeight, 1)
  const scaled = anchors.map((a) => ({
    x: a.x * scaleX,
    y: a.y * scaleY,
    handleIn: { dx: a.handleIn.dx * scaleX, dy: a.handleIn.dy * scaleY },
    handleOut: { dx: a.handleOut.dx * scaleX, dy: a.handleOut.dy * scaleY },
  }))
  const pathData = anchorsToPathData(scaled, true)
  if (inverted) {
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, SIZE, SIZE)
    if (pathData) {
      ctx.fillStyle = '#000'
      ctx.fill(new Path2D(pathData))
    }
  } else {
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, SIZE, SIZE)
    if (pathData) {
      ctx.fillStyle = '#fff'
      ctx.fill(new Path2D(pathData))
    }
  }
  return canvas.toDataURL()
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
    return await new Promise<string>((resolve) => {
      const el = new Image()
      el.onload = () => {
        // Determine scale to fit the frame (proportional) into SIZE×SIZE
        const frameAspect = img.frameWidth / img.frameHeight
        let drawW = SIZE
        let drawH = SIZE
        if (frameAspect > 1) {
          drawH = SIZE / frameAspect
        } else {
          drawW = SIZE * frameAspect
        }
        const offsetX = (SIZE - drawW) / 2
        const offsetY = (SIZE - drawH) / 2

        // Scale factors from frame space to thumbnail draw space
        const scaleX = drawW / img.frameWidth
        const scaleY = drawH / img.frameHeight

        ctx.save()
        // Clip to the frame area within the thumbnail
        ctx.beginPath()
        ctx.rect(offsetX, offsetY, drawW, drawH)
        ctx.clip()

        // Draw the content image offset into the clipped region
        const contentX = offsetX + img.contentOffsetX * scaleX
        const contentY = offsetY + img.contentOffsetY * scaleY
        const contentW = img.contentWidth * scaleX
        const contentH = img.contentHeight * scaleY
        ctx.drawImage(el, contentX, contentY, contentW, contentH)
        ctx.restore()

        resolve(canvas.toDataURL('image/png'))
      }
      el.onerror = () => resolve('')
      el.src = obj.src
    })
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
    ctx.fillStyle = shape.fill || '#888888'
    ctx.strokeStyle = shape.stroke || 'transparent'
    ctx.lineWidth = Math.min(shape.strokeWidth || 0, 2)

    if (shape.kind === 'ellipse') {
      ctx.beginPath()
      ctx.ellipse(SIZE / 2, SIZE / 2, SIZE / 2 - 2, SIZE / 2 - 2, 0, 0, Math.PI * 2)
      ctx.fill()
      if (ctx.lineWidth > 0) ctx.stroke()
    } else if (shape.kind === 'line' || shape.kind === 'arrow') {
      ctx.strokeStyle = shape.fill || '#888888'
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
    if (path.fill && path.fill !== 'transparent') {
      ctx.fillStyle = path.fill
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
            if (obj.type === 'image') {
              const imgObj = obj as ImageObject
              if (imgObj.mask) {
                setThumbnail(`${id}__mask`, generateMaskThumbnail(imgObj))
              } else {
                removeThumbnail(`${id}__mask`)
              }
            }
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
