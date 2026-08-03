import { useRef } from 'react'
import type { CanvasObject, ImageObject, VideoObject, GuidelineObject } from '@/types/canvas'
import { SNAP_THRESHOLD } from './constants'
import { useCanvasStore } from './useCanvasStore'
import { denormalizeAnchors } from './frameClip'
import { computePathBBox } from './CanvasPathNode'

export interface SnapGuide {
  orientation: 'h' | 'v'
  position: number
  kind: 'frame' | 'object'
}

interface DragBox {
  x: number
  y: number
  width: number
  height: number
}

type SnapTarget = { position: number; kind: 'frame' | 'object' }

/**
 * Axis-aligned bounding box a media frame should expose as a snap target.
 *
 * Two corrections over the raw frameX/Y/Width/Height:
 *  - a `path` clip's visible silhouette can sit well inside the frame rect, so
 *    snap to the silhouette, not the enclosing box (rect/ellipse clips have a
 *    silhouette AABB identical to the frame, so they cost nothing here);
 *  - a rotated frame's on-screen extent is the rotated corners' AABB. The frame
 *    Group rotates about its top-left origin — same pivot rule as
 *    buildFrameFromShape in useCanvasStore.
 *
 * Runs once per gesture: startSnapSession caches buildTargets for the drag.
 */
function frameSnapBox(f: ImageObject | VideoObject): {
  x: number; y: number; width: number; height: number
} {
  let localX = 0
  let localY = 0
  let w = f.frameWidth
  let h = f.frameHeight

  if (f.clipShape?.kind === 'path') {
    const bbox = computePathBBox(denormalizeAnchors(f.clipShape.anchors, w, h), true)
    localX = bbox.x
    localY = bbox.y
    w = bbox.width
    h = bbox.height
  }

  if (!f.rotation) {
    return { x: f.frameX + localX, y: f.frameY + localY, width: w, height: h }
  }

  const rad = (f.rotation * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [cx, cy] of [
    [localX, localY], [localX + w, localY],
    [localX + w, localY + h], [localX, localY + h],
  ]) {
    const rx = f.frameX + cx * cos - cy * sin
    const ry = f.frameY + cx * sin + cy * cos
    minX = Math.min(minX, rx); maxX = Math.max(maxX, rx)
    minY = Math.min(minY, ry); maxY = Math.max(maxY, ry)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

function buildTargets(
  allObjects: CanvasObject[],
  frameCount: number,
  frameWidth: number,
  frameHeight: number,
): { verticalTargets: SnapTarget[]; horizontalTargets: SnapTarget[] } {
  const verticalTargets: SnapTarget[] = []
  const horizontalTargets: SnapTarget[] = []

  for (let i = 0; i < frameCount; i++) {
    verticalTargets.push({ position: i * frameWidth, kind: 'frame' })
    verticalTargets.push({ position: i * frameWidth + frameWidth / 2, kind: 'frame' })
    verticalTargets.push({ position: (i + 1) * frameWidth, kind: 'frame' })
  }
  horizontalTargets.push({ position: 0, kind: 'frame' })
  horizontalTargets.push({ position: frameHeight / 2, kind: 'frame' })
  horizontalTargets.push({ position: frameHeight, kind: 'frame' })

  for (const obj of allObjects) {
    // Guidelines ARE snap targets, not snappable objects — skip bbox processing
    if (obj.type === 'guideline') {
      const g = obj as GuidelineObject
      if (g.orientation === 'horizontal') {
        horizontalTargets.push({ position: g.position, kind: 'object' })
      } else {
        verticalTargets.push({ position: g.position, kind: 'object' })
      }
      continue
    }

    let objX: number, objY: number, objW: number, objH: number
    if (obj.type === 'image' || obj.type === 'video') {
      // Video frames use the same frame model as images — don't rely on x/y/width
      // /height mirroring frameX/Y/Width/Height, that's an unguarded invariant.
      const box = frameSnapBox(obj as ImageObject | VideoObject)
      objX = box.x; objY = box.y; objW = box.width; objH = box.height
    } else {
      objX = obj.x; objY = obj.y; objW = obj.width; objH = obj.height
    }
    verticalTargets.push({ position: objX, kind: 'object' })
    verticalTargets.push({ position: objX + objW / 2, kind: 'object' })
    verticalTargets.push({ position: objX + objW, kind: 'object' })
    horizontalTargets.push({ position: objY, kind: 'object' })
    horizontalTargets.push({ position: objY + objH / 2, kind: 'object' })
    horizontalTargets.push({ position: objY + objH, kind: 'object' })
  }

  return { verticalTargets, horizontalTargets }
}

// Core snap math against pre-built target arrays — no buildTargets call.
function computeSnapFromTargets(
  box: DragBox,
  verticalTargets: SnapTarget[],
  horizontalTargets: SnapTarget[],
  threshold: number,
): { x: number; y: number; guides: SnapGuide[] } {
  const boxLeft = box.x
  const boxCenterX = box.x + box.width / 2
  const boxRight = box.x + box.width
  const boxTop = box.y
  const boxCenterY = box.y + box.height / 2
  const boxBottom = box.y + box.height

  let snappedX = box.x
  let snappedY = box.y
  const guides: SnapGuide[] = []

  let bestDist = threshold
  let bestDx = 0
  let bestVertGuide: SnapGuide | null = null

  for (const target of verticalTargets) {
    const pos = target.position
    const distLeft = Math.abs(boxLeft - pos)
    if (distLeft < bestDist) { bestDist = distLeft; bestDx = pos - boxLeft; bestVertGuide = { orientation: 'v', position: pos, kind: target.kind } }
    const distCenter = Math.abs(boxCenterX - pos)
    if (distCenter < bestDist) { bestDist = distCenter; bestDx = pos - boxCenterX; bestVertGuide = { orientation: 'v', position: pos, kind: target.kind } }
    const distRight = Math.abs(boxRight - pos)
    if (distRight < bestDist) { bestDist = distRight; bestDx = pos - boxRight; bestVertGuide = { orientation: 'v', position: pos, kind: target.kind } }
  }
  if (bestVertGuide !== null) { snappedX = box.x + bestDx; guides.push(bestVertGuide) }

  let bestDistY = threshold
  let bestDy = 0
  let bestHorizGuide: SnapGuide | null = null

  for (const target of horizontalTargets) {
    const pos = target.position
    const distTop = Math.abs(boxTop - pos)
    if (distTop < bestDistY) { bestDistY = distTop; bestDy = pos - boxTop; bestHorizGuide = { orientation: 'h', position: pos, kind: target.kind } }
    const distCenter = Math.abs(boxCenterY - pos)
    if (distCenter < bestDistY) { bestDistY = distCenter; bestDy = pos - boxCenterY; bestHorizGuide = { orientation: 'h', position: pos, kind: target.kind } }
    const distBottom = Math.abs(boxBottom - pos)
    if (distBottom < bestDistY) { bestDistY = distBottom; bestDy = pos - boxBottom; bestHorizGuide = { orientation: 'h', position: pos, kind: target.kind } }
  }
  if (bestHorizGuide !== null) { snappedY = box.y + bestDy; guides.push(bestHorizGuide) }

  return { x: snappedX, y: snappedY, guides }
}

export function computeSnap(
  box: DragBox,
  allObjects: CanvasObject[],
  frameCount: number,
  frameWidth: number,
  frameHeight: number,
  threshold: number,
): { x: number; y: number; guides: SnapGuide[] } {
  const { verticalTargets, horizontalTargets } = buildTargets(allObjects, frameCount, frameWidth, frameHeight)
  return computeSnapFromTargets(box, verticalTargets, horizontalTargets, threshold)
}

// Core resize snap math against pre-built target arrays — no buildTargets call.
function computeSnapResizeFromTargets(
  box: DragBox,
  anchor: string,
  verticalTargets: SnapTarget[],
  horizontalTargets: SnapTarget[],
  threshold: number,
  keepRatio?: boolean,
): { box: DragBox; guides: SnapGuide[] } {
  const guides: SnapGuide[] = []
  let { x, y, width, height } = box

  const leftFree = anchor === 'top-left' || anchor === 'middle-left' || anchor === 'bottom-left'
  const rightFree = anchor === 'top-right' || anchor === 'middle-right' || anchor === 'bottom-right'
  const topFree = anchor === 'top-left' || anchor === 'top-center' || anchor === 'top-right'
  const bottomFree = anchor === 'bottom-left' || anchor === 'bottom-center' || anchor === 'bottom-right'

  const isCorner = (leftFree || rightFree) && (topFree || bottomFree)

  if (keepRatio && isCorner) {
    // box is already proportional (Konva enforces this before calling boundBoxFunc).
    // Snap each free edge independently, then pick the axis with the smaller snap
    // distance and derive the other axis from the aspect ratio.
    const aspectRatio = box.width / box.height

    // --- Try snapping horizontal free edge ---
    let hBestDist = threshold
    let hBestSnap = rightFree ? x + width : x
    let hGuide: SnapGuide | null = null
    if (rightFree) {
      for (const t of verticalTargets) {
        const d = Math.abs((x + width) - t.position)
        if (d < hBestDist) { hBestDist = d; hBestSnap = t.position; hGuide = { orientation: 'v', position: t.position, kind: t.kind } }
      }
    } else {
      // leftFree
      for (const t of verticalTargets) {
        const d = Math.abs(x - t.position)
        if (d < hBestDist) { hBestDist = d; hBestSnap = t.position; hGuide = { orientation: 'v', position: t.position, kind: t.kind } }
      }
    }

    // --- Try snapping vertical free edge ---
    let vBestDist = threshold
    let vBestSnap = bottomFree ? y + height : y
    let vGuide: SnapGuide | null = null
    if (bottomFree) {
      for (const t of horizontalTargets) {
        const d = Math.abs((y + height) - t.position)
        if (d < vBestDist) { vBestDist = d; vBestSnap = t.position; vGuide = { orientation: 'h', position: t.position, kind: t.kind } }
      }
    } else {
      // topFree
      for (const t of horizontalTargets) {
        const d = Math.abs(y - t.position)
        if (d < vBestDist) { vBestDist = d; vBestSnap = t.position; vGuide = { orientation: 'h', position: t.position, kind: t.kind } }
      }
    }

    const hSnapped = hBestDist < threshold
    const vSnapped = vBestDist < threshold

    if (!hSnapped && !vSnapped) return { box: { x, y, width, height }, guides: [] }

    // Pick axis with smaller snap distance; if tie, prefer horizontal
    const useHoriz = !vSnapped || (hSnapped && hBestDist <= vBestDist)

    if (useHoriz) {
      // Snap the horizontal edge, derive vertical from aspect ratio
      if (rightFree) {
        width = Math.max(5, hBestSnap - x)
      } else {
        const fixedRight = x + width
        x = hBestSnap
        width = Math.max(5, fixedRight - hBestSnap)
      }
      const newHeight = width / aspectRatio
      if (bottomFree) {
        height = newHeight
      } else {
        // topFree — fix bottom, move top
        y = (y + height) - newHeight
        height = newHeight
      }
      if (hGuide) guides.push(hGuide)
    } else {
      // Snap the vertical edge, derive horizontal from aspect ratio
      if (bottomFree) {
        height = Math.max(5, vBestSnap - y)
      } else {
        const fixedBottom = y + height
        y = vBestSnap
        height = Math.max(5, fixedBottom - vBestSnap)
      }
      const newWidth = height * aspectRatio
      if (rightFree) {
        width = newWidth
      } else {
        // leftFree — fix right, move left
        x = (x + width) - newWidth
        width = newWidth
      }
      if (vGuide) guides.push(vGuide)
    }

    return { box: { x, y, width, height }, guides }
  }

  // Non-proportional (or side handle): snap each free edge independently
  if (leftFree) {
    const fixedRight = x + width
    let bestDist = threshold, bestSnap = x
    let bestGuide: SnapGuide | null = null
    for (const t of verticalTargets) {
      const d = Math.abs(x - t.position)
      if (d < bestDist) { bestDist = d; bestSnap = t.position; bestGuide = { orientation: 'v', position: t.position, kind: t.kind } }
    }
    x = bestSnap
    width = Math.max(5, fixedRight - bestSnap)
    if (bestGuide) guides.push(bestGuide)
  } else if (rightFree) {
    const rightEdge = x + width
    let bestDist = threshold, bestSnap = rightEdge
    let bestGuide: SnapGuide | null = null
    for (const t of verticalTargets) {
      const d = Math.abs(rightEdge - t.position)
      if (d < bestDist) { bestDist = d; bestSnap = t.position; bestGuide = { orientation: 'v', position: t.position, kind: t.kind } }
    }
    width = Math.max(5, bestSnap - x)
    if (bestGuide) guides.push(bestGuide)
  }

  if (topFree) {
    const fixedBottom = y + height
    let bestDist = threshold, bestSnap = y
    let bestGuide: SnapGuide | null = null
    for (const t of horizontalTargets) {
      const d = Math.abs(y - t.position)
      if (d < bestDist) { bestDist = d; bestSnap = t.position; bestGuide = { orientation: 'h', position: t.position, kind: t.kind } }
    }
    y = bestSnap
    height = Math.max(5, fixedBottom - bestSnap)
    if (bestGuide) guides.push(bestGuide)
  } else if (bottomFree) {
    const bottomEdge = y + height
    let bestDist = threshold, bestSnap = bottomEdge
    let bestGuide: SnapGuide | null = null
    for (const t of horizontalTargets) {
      const d = Math.abs(bottomEdge - t.position)
      if (d < bestDist) { bestDist = d; bestSnap = t.position; bestGuide = { orientation: 'h', position: t.position, kind: t.kind } }
    }
    height = Math.max(5, bestSnap - y)
    if (bestGuide) guides.push(bestGuide)
  }

  return { box: { x, y, width, height }, guides }
}

// Snaps only the specific edge being dragged (determined by anchor name).
// Used in Transformer boundBoxFunc so each handle snaps its own edge.
// When keepRatio is true and a corner handle is active, snaps a single axis
// and derives the other from the aspect ratio to preserve proportionality.
export function computeSnapResize(
  box: DragBox,
  anchor: string,
  allObjects: CanvasObject[],
  frameCount: number,
  frameWidth: number,
  frameHeight: number,
  threshold: number,
  keepRatio?: boolean,
): { box: DragBox; guides: SnapGuide[] } {
  const { verticalTargets, horizontalTargets } = buildTargets(allObjects, frameCount, frameWidth, frameHeight)
  return computeSnapResizeFromTargets(box, anchor, verticalTargets, horizontalTargets, threshold, keepRatio)
}

const ROTATION_SNAP_ANGLES = [0, 45, 90, 135, 180, -135, -90, -45]
const ROTATION_SNAP_THRESHOLD = 8

export function _snapRotation(degrees: number): number {
  for (const target of ROTATION_SNAP_ANGLES) {
    if (Math.abs(degrees - target) < ROTATION_SNAP_THRESHOLD) return target
  }
  return degrees
}

export function useSnapGuides(): {
  computeSnap: (box: DragBox, excludeId: string) => { x: number; y: number; guides: SnapGuide[] }
  computeSnapResize: (box: DragBox, anchor: string, excludeId: string, threshold: number, keepRatio?: boolean) => { box: DragBox; guides: SnapGuide[] }
  computeSnapGroup: (box: DragBox, excludeIds: string[]) => { x: number; y: number; guides: SnapGuide[] }
  computeSnapResizeGroup: (box: DragBox, anchor: string, excludeIds: string[], threshold: number, keepRatio?: boolean) => { box: DragBox; guides: SnapGuide[] }
  snapRotation: (degrees: number) => number
  startSnapSession: (excludeId: string | string[], opts?: { contentMode?: boolean }) => void
  endSnapSession: () => void
} {
  const objects = useCanvasStore((s) => s.objects)
  const snapEnabled = useCanvasStore((s) => s.snapEnabled)
  const objectOrder = useCanvasStore((s) => s.objectOrder)
  const frameCount = useCanvasStore((s) => s.frameCount)
  const frameWidth = useCanvasStore((s) => s.frameWidth)
  const frameHeight = useCanvasStore((s) => s.frameHeight)

  // Cache of pre-built snap targets for the duration of a drag/transform session.
  // Built once at drag/transform start; cleared on end. Keyed by sorted excludeId(s).
  const snapSessionRef = useRef<{
    excludeKey: string
    verticalTargets: SnapTarget[]
    horizontalTargets: SnapTarget[]
  } | null>(null)

  function getObjects(excludeId: string | string[]): CanvasObject[] {
    const excludeSet = new Set(Array.isArray(excludeId) ? excludeId : [excludeId])
    return objectOrder
      .filter((id) => !excludeSet.has(id))
      .map((id) => objects[id])
      .filter((obj): obj is CanvasObject => obj !== undefined)
  }

  function startSnapSession(excludeId: string | string[], opts?: { contentMode?: boolean }): void {
    const excludeKey = Array.isArray(excludeId) ? [...excludeId].sort().join(',') : excludeId
    const objs = getObjects(excludeId)
    const { verticalTargets, horizontalTargets } = buildTargets(objs, frameCount, frameWidth, frameHeight)
    // Content-edit mode: the dragged object is excluded from the target set (so
    // content doesn't snap to itself), but we ADD its own frame edges/centers as
    // targets so content can snap to the frame it lives in.
    if (opts?.contentMode && typeof excludeId === 'string') {
      const self = objects[excludeId]
      if (self) {
        let fx: number, fy: number, fw: number, fh: number
        if (self.type === 'image' || self.type === 'video') {
          fx = self.frameX; fy = self.frameY; fw = self.frameWidth; fh = self.frameHeight
        } else {
          fx = self.x; fy = self.y; fw = self.width; fh = self.height
        }
        verticalTargets.push(
          { position: fx, kind: 'frame' },
          { position: fx + fw / 2, kind: 'frame' },
          { position: fx + fw, kind: 'frame' },
        )
        horizontalTargets.push(
          { position: fy, kind: 'frame' },
          { position: fy + fh / 2, kind: 'frame' },
          { position: fy + fh, kind: 'frame' },
        )
      }
    }
    snapSessionRef.current = { excludeKey, verticalTargets, horizontalTargets }
  }

  function endSnapSession(): void {
    snapSessionRef.current = null
  }

  function boundComputeSnap(box: DragBox, excludeId: string) {
    if (!snapEnabled) return { x: box.x, y: box.y, guides: [] }
    const session = snapSessionRef.current
    if (session && session.excludeKey === excludeId) {
      return computeSnapFromTargets(box, session.verticalTargets, session.horizontalTargets, SNAP_THRESHOLD)
    }
    return computeSnap(box, getObjects(excludeId), frameCount, frameWidth, frameHeight, SNAP_THRESHOLD)
  }

  function boundComputeSnapResize(box: DragBox, anchor: string, excludeId: string, threshold: number, keepRatio?: boolean) {
    if (!snapEnabled) return { box, guides: [] }
    const session = snapSessionRef.current
    if (session && session.excludeKey === excludeId) {
      return computeSnapResizeFromTargets(box, anchor, session.verticalTargets, session.horizontalTargets, threshold, keepRatio)
    }
    return computeSnapResize(box, anchor, getObjects(excludeId), frameCount, frameWidth, frameHeight, threshold, keepRatio)
  }

  function boundComputeSnapGroup(box: DragBox, excludeIds: string[]) {
    if (!snapEnabled) return { x: box.x, y: box.y, guides: [] }
    const excludeKey = [...excludeIds].sort().join(',')
    const session = snapSessionRef.current
    if (session && session.excludeKey === excludeKey) {
      return computeSnapFromTargets(box, session.verticalTargets, session.horizontalTargets, SNAP_THRESHOLD)
    }
    return computeSnap(box, getObjects(excludeIds), frameCount, frameWidth, frameHeight, SNAP_THRESHOLD)
  }

  function boundComputeSnapResizeGroup(box: DragBox, anchor: string, excludeIds: string[], threshold: number, keepRatio?: boolean) {
    if (!snapEnabled) return { box, guides: [] }
    const excludeKey = [...excludeIds].sort().join(',')
    const session = snapSessionRef.current
    if (session && session.excludeKey === excludeKey) {
      return computeSnapResizeFromTargets(box, anchor, session.verticalTargets, session.horizontalTargets, threshold, keepRatio)
    }
    return computeSnapResize(box, anchor, getObjects(excludeIds), frameCount, frameWidth, frameHeight, threshold, keepRatio)
  }

  return {
    computeSnap: boundComputeSnap,
    computeSnapResize: boundComputeSnapResize,
    computeSnapGroup: boundComputeSnapGroup,
    computeSnapResizeGroup: boundComputeSnapResizeGroup,
    snapRotation: (degrees: number) => !snapEnabled ? degrees : _snapRotation(degrees),
    startSnapSession,
    endSnapSession,
  }
}
