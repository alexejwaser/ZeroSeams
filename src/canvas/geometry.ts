import type { CanvasObject } from '@/types/canvas'

// ---------------------------------------------------------------------------
// rotateAroundCenter — pure utility
// Konva positions rects/text at top-left (x, y) and rotates around that point.
// To rotate around the visual center, compute where the center is in canvas
// space given the current rotation, then find the new top-left that keeps the
// center at that same canvas-space point with the new rotation angle.
// Ellipses are exempt: Konva renders them at their CENTER, so they already
// rotate around the center — no fix needed.
// ---------------------------------------------------------------------------

export function rotateAroundCenter(
  x: number, y: number, w: number, h: number,
  oldRotDeg: number, newRotDeg: number,
): { x: number; y: number; rotation: number } {
  const oldR = (oldRotDeg * Math.PI) / 180
  const newR = (newRotDeg * Math.PI) / 180
  const hw = w / 2, hh = h / 2
  const cx = x + hw * Math.cos(oldR) - hh * Math.sin(oldR)
  const cy = y + hw * Math.sin(oldR) + hh * Math.cos(oldR)
  return {
    rotation: newRotDeg,
    x: cx - (hw * Math.cos(newR) - hh * Math.sin(newR)),
    y: cy - (hw * Math.sin(newR) + hh * Math.cos(newR)),
  }
}

// ---------------------------------------------------------------------------
// fitCover — cover-fit + center a bitmap into a frame
// The kernel previously duplicated inline in CanvasImageNode / CanvasVideoNode:
// aspect > fAspect ? height-fit : width-fit, overflow split evenly on both axes.
// Degenerate inputs (any dimension ≤ 0) return a zero-offset box sized to the
// frame — never NaN.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// findDropTargetId — top-most-first hit-test for drop-on-shape / drop-on-frame.
// Reverse-iterates objectOrder (z-order top→bottom) and returns the first
// container that contains the point:
//   (a) empty media frame (ImageObject with isEmpty)   → bbox test
//   (b) ShapeObject rect / ellipse                     → rect / ellipse test
//   (c) closed PathObject                              → bbox test (v1)
// Rotation is ignored (unrotated bbox) — acceptable for v1.
// ---------------------------------------------------------------------------

/**
 * Snap a rect that lives in a rotated frame's local space.
 *
 * Content inside a media frame is positioned in frame-local coordinates, but snap
 * targets are canvas-absolute and axis-aligned. So: rotate the local rect's corners
 * into absolute space, snap that AABB, then rotate the correction back into local
 * space. Without this, content snapping has to be switched off whenever the frame
 * is rotated.
 *
 * `snapAABB` receives the absolute axis-aligned box and returns the snapped
 * top-left, mirroring computeSnap's contract.
 */
export function snapRectInRotatedFrame(
  local: { x: number; y: number; width: number; height: number },
  frameX: number,
  frameY: number,
  rotationDeg: number,
  snapAABB: (box: { x: number; y: number; width: number; height: number }) => { x: number; y: number },
): { x: number; y: number } {
  if (!rotationDeg) {
    const snapped = snapAABB({
      x: frameX + local.x, y: frameY + local.y, width: local.width, height: local.height,
    })
    return { x: snapped.x - frameX, y: snapped.y - frameY }
  }

  const rad = (rotationDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [cx, cy] of [
    [local.x, local.y], [local.x + local.width, local.y],
    [local.x + local.width, local.y + local.height], [local.x, local.y + local.height],
  ]) {
    const ax = frameX + cx * cos - cy * sin
    const ay = frameY + cx * sin + cy * cos
    minX = Math.min(minX, ax); maxX = Math.max(maxX, ax)
    minY = Math.min(minY, ay); maxY = Math.max(maxY, ay)
  }

  const snapped = snapAABB({ x: minX, y: minY, width: maxX - minX, height: maxY - minY })
  // Rotate the absolute correction back into frame-local space (R⁻¹ = Rᵀ).
  const dax = snapped.x - minX
  const day = snapped.y - minY
  return {
    x: local.x + dax * cos + day * sin,
    y: local.y - dax * sin + day * cos,
  }
}

/**
 * The single convertibility predicate: can this object become a media frame?
 * Lines, arrows and open paths have no interior to fill. Every caller (context
 * menu, properties panel, the drop hit-test below, the store action) must use
 * this — re-deriving it is how the drop hooks ended up silently swallowing media
 * dropped on a line.
 */
export function canBecomeFrame(obj: CanvasObject | undefined): boolean {
  if (!obj) return false
  if (obj.type === 'shape') return obj.kind === 'rect' || obj.kind === 'ellipse'
  if (obj.type === 'path') return obj.closed
  return false
}

function pointInRect(px: number, py: number, x: number, y: number, w: number, h: number): boolean {
  return px >= x && px <= x + w && py >= y && py <= y + h
}

function pointInEllipse(px: number, py: number, x: number, y: number, w: number, h: number): boolean {
  const rx = w / 2
  const ry = h / 2
  if (rx <= 0 || ry <= 0) return false
  const nx = (px - (x + rx)) / rx
  const ny = (py - (y + ry)) / ry
  return nx * nx + ny * ny <= 1
}

export function findDropTargetId(
  px: number,
  py: number,
  objects: Record<string, CanvasObject>,
  objectOrder: string[],
): string | null {
  for (let i = objectOrder.length - 1; i >= 0; i--) {
    const obj = objects[objectOrder[i]]
    if (!obj || !obj.visible || obj.locked) continue
    if (obj.type === 'image') {
      if (obj.isEmpty && pointInRect(px, py, obj.frameX, obj.frameY, obj.frameWidth, obj.frameHeight)) {
        return obj.id
      }
    } else if (!canBecomeFrame(obj)) {
      continue // line/arrow/open path have no interior to fill
    } else if (obj.type === 'shape') {
      if (obj.kind === 'ellipse') {
        if (pointInEllipse(px, py, obj.x, obj.y, obj.width, obj.height)) return obj.id
      } else if (pointInRect(px, py, obj.x, obj.y, obj.width, obj.height)) {
        return obj.id
      }
    } else if (obj.type === 'path') {
      if (pointInRect(px, py, obj.x, obj.y, obj.width, obj.height)) return obj.id
    }
  }
  return null
}

export function fitCover(
  naturalW: number,
  naturalH: number,
  frameW: number,
  frameH: number,
): { contentOffsetX: number; contentOffsetY: number; contentWidth: number; contentHeight: number } {
  if (naturalW <= 0 || naturalH <= 0 || frameW <= 0 || frameH <= 0) {
    return {
      contentOffsetX: 0,
      contentOffsetY: 0,
      contentWidth: Math.max(0, frameW),
      contentHeight: Math.max(0, frameH),
    }
  }
  const aspect = naturalW / naturalH
  const fAspect = frameW / frameH
  let cW: number
  let cH: number
  if (aspect > fAspect) {
    cH = frameH
    cW = cH * aspect
  } else {
    cW = frameW
    cH = cW / aspect
  }
  return {
    contentOffsetX: (frameW - cW) / 2,
    contentOffsetY: (frameH - cH) / 2,
    contentWidth: cW,
    contentHeight: cH,
  }
}
