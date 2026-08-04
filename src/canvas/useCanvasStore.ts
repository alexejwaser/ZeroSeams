import { create } from 'zustand'
import type { CanvasObject, ImageObject, GroupObject, ShapeObject, PathObject, ShapeKind, TextObject, VideoObject, GuidelineObject, ClipShape, Fill } from '@/types/canvas'
import type { GridTemplate } from './gridTemplates'
import type { Frame, FrameRatio, Platform, CarouselProject } from '@/types/project'
import { fitCover } from './geometry'
import { normalizeAnchors, denormalizeAnchors } from './frameClip'
import { normalizeFill, denormalizeFill } from './fill'
import { buildEmptyFrameImage, frameToEmptyImage, isEmptyFrame, makeEmptyCell } from './frameModel'
import { computePathBBox } from './CanvasPathNode'

/** Media payload accepted by insertMediaIntoFrame. */
export type InsertMedia =
  | { kind: 'image'; src: string; naturalWidth: number; naturalHeight: number }
  | {
      kind: 'video'
      filePath: string
      naturalWidth: number
      naturalHeight: number
      naturalDuration: number
      name?: string
    }

/** Smallest frame a media frame may be. Below this, computePathBBox can return a
 *  zero dimension (collinear closed path), which makes buildClipFunc emit an empty
 *  path — and an empty clip path clips the whole group away rather than doing
 *  nothing. Refuse the conversion instead of producing an invisible frame. */
const MIN_FRAME_SIZE = 1

/** Build the empty media frame that `obj` (a rect/ellipse shape or a closed path)
 *  becomes. Returns null when the object isn't convertible or its bbox is
 *  degenerate. Pure — callers wrap it in idPreservingSwapState. */
function buildFrameFromShape(obj: CanvasObject, id: string): ImageObject | null {
  let frameRect: { x: number; y: number; width: number; height: number }
  let clipShape: ClipShape
  // Shapes/paths store `string | Fill`; frames store `Fill`. Carried straight
  // through (via normalizeFill) so a gradient survives the conversion.
  let fillValue: string | Fill
  let stroke: string
  let strokeWidth: number
  let rotation: number

  if (obj.type === 'shape') {
    const s = obj as ShapeObject
    if (s.kind !== 'rect' && s.kind !== 'ellipse') return null // no-op for line/arrow
    // Pivot rule: the frame Group rotates about its top-left origin (frameX/frameY).
    // A Rect ShapeObject also rotates about its top-left, so its geometry maps 1:1.
    // A Konva Ellipse rotates about its CENTER, so offset the frame origin to keep
    // the rotated frame visually coincident with the rotated ellipse.
    if (s.kind === 'ellipse' && s.rotation) {
      const rad = (s.rotation * Math.PI) / 180
      const cos = Math.cos(rad), sin = Math.sin(rad)
      const hw = s.width / 2, hh = s.height / 2
      frameRect = {
        x: s.x + hw - (hw * cos - hh * sin),
        y: s.y + hh - (hw * sin + hh * cos),
        width: s.width, height: s.height,
      }
    } else {
      frameRect = { x: s.x, y: s.y, width: s.width, height: s.height }
    }
    clipShape = s.kind === 'rect'
      ? { kind: 'rect', ...(s.cornerRadius ? { cornerRadius: s.cornerRadius } : {}) }
      : { kind: 'ellipse' }
    fillValue = s.fill
    stroke = s.stroke
    strokeWidth = s.strokeWidth
    rotation = s.rotation
  } else if (obj.type === 'path') {
    const p = obj as PathObject
    if (!p.closed) return null // no-op for open paths
    const bbox = computePathBBox(p.anchors, true)
    frameRect = { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height }
    clipShape = { kind: 'path', anchors: normalizeAnchors(p.anchors, bbox) }
    fillValue = p.fill
    stroke = p.stroke
    strokeWidth = p.strokeWidth
    rotation = p.rotation
  } else {
    return null
  }

  if (frameRect.width < MIN_FRAME_SIZE || frameRect.height < MIN_FRAME_SIZE) return null

  return buildEmptyFrameImage(id, {
    rect: frameRect,
    scope: obj.scope,
    rotation,
    opacity: obj.opacity,
    visible: obj.visible,
    locked: obj.locked,
    zIndex: obj.zIndex,
    pinnedFrame: obj.pinnedFrame,
    parentGroupId: obj.parentGroupId,
    name: obj.name,
    clipShape,
    fill: normalizeFill(fillValue),
    frameStroke: stroke,
    frameStrokeWidth: strokeWidth,
    effects: obj.effects,
  })
}

/** Build the filled frame that results from dropping `media` into `frame`.
 *  Cover-fits the media to the frame and carries clip/fill/stroke/rotation and
 *  adjustments across an image↔video type change. Pure. */
function buildFilledFrame(
  frame: ImageObject | VideoObject,
  id: string,
  media: InsertMedia,
): ImageObject | VideoObject {
  const cover = fitCover(media.naturalWidth, media.naturalHeight, frame.frameWidth, frame.frameHeight)

  if (media.kind === 'image') {
    const base = frame.type === 'image' ? (frame as ImageObject) : frameToEmptyImage(frame, id)
    return {
      ...base,
      isEmpty: false,
      src: media.src,
      originalSrc: undefined,
      backgroundRemoved: false,
      naturalWidth: media.naturalWidth,
      naturalHeight: media.naturalHeight,
      contentOffsetX: cover.contentOffsetX,
      contentOffsetY: cover.contentOffsetY,
      contentWidth: cover.contentWidth,
      contentHeight: cover.contentHeight,
      contentEditMode: false,
      clipEditMode: false,
    }
  }

  return {
    id,
    type: 'video',
    scope: frame.scope,
    pinnedFrame: frame.pinnedFrame,
    parentGroupId: frame.parentGroupId,
    name: media.name ?? frame.name,
    filePath: media.filePath,
    muted: false,
    naturalWidth: media.naturalWidth,
    naturalHeight: media.naturalHeight,
    naturalDuration: media.naturalDuration,
    frameX: frame.frameX, frameY: frame.frameY,
    frameWidth: frame.frameWidth, frameHeight: frame.frameHeight,
    x: frame.x, y: frame.y, width: frame.width, height: frame.height,
    contentOffsetX: cover.contentOffsetX,
    contentOffsetY: cover.contentOffsetY,
    contentWidth: cover.contentWidth,
    contentHeight: cover.contentHeight,
    contentEditMode: false,
    clipEditMode: false,
    clipShape: frame.clipShape,
    fill: frame.fill,
    frameStroke: frame.frameStroke,
    frameStrokeWidth: frame.frameStrokeWidth,
    rotation: frame.rotation,
    scaleX: 1, scaleY: 1,
    opacity: frame.opacity,
    visible: frame.visible,
    locked: frame.locked,
    zIndex: frame.zIndex,
    effects: frame.effects,
    // Carry photo adjustments across the swap (VideoSection composes the same
    // AdjustmentsSection) — mirrors the image branch, which inherits them via
    // the `...base` spread.
    adjustments: frame.adjustments,
  }
}

/** Build the ShapeObject/PathObject a media frame collapses back into. The inverse
 *  of buildFrameFromShape: preserves geometry, clip silhouette, fill and stroke, and
 *  bakes frame rotation into path anchors. Drops any media. Pure. */
function buildShapeFromFrame(f: ImageObject | VideoObject, id: string): CanvasObject {
      const clip: ClipShape = f.clipShape ?? { kind: 'rect' }
      // Straight pass-through so a gradient survives shape→frame→shape.
      // denormalizeFill collapses a solid back to its bare colour string — the
      // canonical ShapeObject/PathObject form — which is what makes the
      // round-trip value-identical for every project that has no gradient.
      const fillValue = denormalizeFill(f.fill) ?? '#ffffff'
      const stroke = f.frameStroke ?? '#000000'
      const strokeWidth = f.frameStrokeWidth ?? 0

      const common = {
        id,
        scope: f.scope,
        pinnedFrame: f.pinnedFrame,
        parentGroupId: f.parentGroupId,
        name: f.name,
        rotation: f.rotation,
        scaleX: 1,
        scaleY: 1,
        opacity: f.opacity,
        visible: f.visible,
        locked: f.locked,
        zIndex: f.zIndex,
        effects: f.effects,
      }

      let replacement: CanvasObject
      if (clip.kind === 'path') {
        // Pivot rule: the frame Group rotates about its top-left origin (frameX/frameY).
        // PathObjects always carry rotation: 0 with rotation baked into the anchors
        // (CanvasPathNode applies no rotation prop). So denormalize to frame-local px,
        // then rotate every point + handle about the frame origin and emit rotation: 0
        // — otherwise the frame's rotation would be silently dropped on conversion.
        const rad = (f.rotation * Math.PI) / 180
        const cos = Math.cos(rad), sin = Math.sin(rad)
        const denorm = denormalizeAnchors(clip.anchors, f.frameWidth, f.frameHeight).map((a) => ({
          x: f.frameX + a.x * cos - a.y * sin,
          y: f.frameY + a.x * sin + a.y * cos,
          handleIn: { dx: a.handleIn.dx * cos - a.handleIn.dy * sin, dy: a.handleIn.dx * sin + a.handleIn.dy * cos },
          handleOut: { dx: a.handleOut.dx * cos - a.handleOut.dy * sin, dy: a.handleOut.dx * sin + a.handleOut.dy * cos },
        }))
        const bbox = computePathBBox(denorm, true)
        replacement = {
          ...common,
          rotation: 0,
          type: 'path',
          anchors: denorm,
          closed: true,
          fill: fillValue,
          stroke,
          strokeWidth,
          pathEditMode: false,
          x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height,
        } as PathObject
      } else {
        // Rect keeps the frame's top-left origin (same pivot). A Konva Ellipse rotates
        // about its center, so offset its origin — inverse of convertShapeToFrame.
        let sx = f.frameX, sy = f.frameY
        if (clip.kind === 'ellipse' && f.rotation) {
          const rad = (f.rotation * Math.PI) / 180
          const cos = Math.cos(rad), sin = Math.sin(rad)
          const hw = f.frameWidth / 2, hh = f.frameHeight / 2
          sx = f.frameX - hw + (hw * cos - hh * sin)
          sy = f.frameY - hh + (hw * sin + hh * cos)
        }
        replacement = {
          ...common,
          type: 'shape',
          kind: clip.kind === 'ellipse' ? 'ellipse' : 'rect',
          fill: fillValue,
          stroke,
          strokeWidth,
          ...(clip.kind === 'rect' && clip.cornerRadius ? { cornerRadius: clip.cornerRadius } : {}),
          x: sx, y: sy, width: f.frameWidth, height: f.frameHeight,
        } as ShapeObject
      }
  return replacement
}

/** Clear clipEditMode on any image/video EXCEPT `keepId` (the object the
 *  selection is moving to). Returns a partial state patch to merge inside an
 *  existing set() — never a standalone set / history push — or null when nothing
 *  changed. Only touches clipEditMode; contentEditMode is left untouched. */
function clearClipEditExcept(
  state: { objects: Record<string, CanvasObject>; _openEditModeCount: number },
  keepId: string | null,
): { objects: Record<string, CanvasObject>; _openEditModeCount: number } | null {
  let changed = false
  let cleared = 0
  const updated: Record<string, CanvasObject> = {}
  for (const [oid, obj] of Object.entries(state.objects)) {
    if (
      oid !== keepId &&
      (obj.type === 'image' || obj.type === 'video') &&
      (obj as ImageObject | VideoObject).clipEditMode
    ) {
      updated[oid] = { ...obj, clipEditMode: false } as CanvasObject
      changed = true
      cleared++
    } else {
      updated[oid] = obj
    }
  }
  if (!changed) return null
  return { objects: updated, _openEditModeCount: Math.max(0, state._openEditModeCount - cleared) }
}

// 'grid' arms the grid-template picker in the toolbar; the canvas itself
// treats it like 'select' until a template is placed.
export type ActiveTool = 'select' | 'text' | 'shape' | 'pen' | 'grid' | 'guideline'

export const PLATFORM_PRESETS: Record<Platform, Array<{ ratio: FrameRatio; label: string; width: number; height: number }>> = {
  instagram: [
    { ratio: 'square',   label: '1:1',  width: 1080, height: 1080 },
    { ratio: 'portrait', label: '4:5',  width: 1080, height: 1350 },
  ],
  tiktok: [
    { ratio: 'story',    label: '9:16', width: 1080, height: 1920 },
    { ratio: 'square',   label: '1:1',  width: 1080, height: 1080 },
  ],
  facebook: [
    { ratio: 'square',    label: '1:1',  width: 1080, height: 1080 },
    { ratio: 'portrait',  label: '4:5',  width: 1080, height: 1350 },
    { ratio: 'landscape', label: '16:9', width: 1080, height: 608  },
  ],
  threads: [
    { ratio: 'square',   label: '1:1',  width: 1080, height: 1080 },
    { ratio: 'portrait', label: '4:5',  width: 1080, height: 1350 },
  ],
  custom: [
    { ratio: 'custom', label: 'Custom', width: 1080, height: 1080 },
  ],
}

/** What the New Document screen picks. Declared canvas-side (not in src/ui) so
 *  the store never has to import from the UI layer. */
export interface NewProjectSpec {
  platform: Platform
  ratio: FrameRatio
  width: number
  height: number
  frameCount: number
}

type HistorySnapshot = Pick<
  CanvasState,
  'objects' | 'objectOrder' | 'ratio' | 'frameWidth' | 'frameHeight' | 'frames' | 'backgroundColor' | 'frameCount'
>

const MAX_HISTORY = 50

/** Exported so src/io/projectFile.ts can build a brand-new project payload with
 *  the same frame shape `newProject` will apply — the file on disk and the store
 *  must not describe the same new document differently. */
export function makeFrames(count: number): Frame[] {
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    label: `Slide ${i + 1}`,
    backgroundColor: null,
  }))
}

function getObjectBBox(obj: CanvasObject): { x: number; y: number; width: number; height: number } {
  if (obj.type === 'guideline') return { x: obj.x, y: obj.y, width: 0, height: 0 }
  if (obj.type === 'image') {
    const img = obj as ImageObject
    return { x: img.frameX, y: img.frameY, width: img.frameWidth, height: img.frameHeight }
  }
  return { x: obj.x, y: obj.y, width: obj.width, height: obj.height }
}

// ---------------------------------------------------------------------------
// Repositioning / cloning
// ---------------------------------------------------------------------------
// The ONLY place that knows how to move an object to a new top-left. Image and
// video carry frameX/frameY alongside x/y and both must move together; line and
// arrow additionally carry a second endpoint that has to travel by the same
// delta. This was hand-written per call site, and the copies had drifted — the
// duplicate paths moved a *video*'s x/y without its frameX/frameY, which is the
// pair the node actually renders from.

/** Move `obj` so its top-left lands on `pos`, keeping every mirrored field in sync. */
function repositionObject(obj: CanvasObject, pos: { x: number; y: number }): CanvasObject {
  const dx = pos.x - obj.x
  const dy = pos.y - obj.y
  if (obj.type === 'image' || obj.type === 'video') {
    const media = obj as ImageObject | VideoObject
    return {
      ...media,
      frameX: media.frameX + dx,
      frameY: media.frameY + dy,
      x: pos.x,
      y: pos.y,
    }
  }
  if (obj.type === 'shape') {
    const s = obj as ShapeObject
    if ((s.kind === 'line' || s.kind === 'arrow') && s.x2 !== undefined) {
      return {
        ...s,
        x: pos.x,
        y: pos.y,
        x2: s.x2 + dx,
        y2: (s.y2 ?? s.y) + dy,
      } as CanvasObject
    }
  }
  return { ...obj, x: pos.x, y: pos.y } as CanvasObject
}

/** A fresh-id copy of `obj` placed at `pos`. Edit modes are cleared — a clone
 *  must never inherit an open content/clip editor from its source. */
function cloneObjectAt(
  obj: CanvasObject,
  newId: string,
  pos: { x: number; y: number },
): CanvasObject {
  const moved = repositionObject(obj, pos)
  const clone = { ...moved, id: newId, name: undefined } as CanvasObject
  if (clone.type === 'image' || clone.type === 'video') {
    return { ...clone, contentEditMode: false, clipEditMode: false } as CanvasObject
  }
  if (clone.type === 'path') {
    return { ...clone, pathEditMode: false } as CanvasObject
  }
  return clone
}

/** Seed the src vault for a cloned image so undo/redo can restore its bitmap. */
function vaultWithClone(
  vault: Map<string, { src: string; originalSrc?: string }>,
  clone: CanvasObject,
): Map<string, { src: string; originalSrc?: string }> {
  if (clone.type !== 'image') return vault
  const img = clone as ImageObject
  if (!img.src) return vault
  const next = new Map(vault)
  next.set(img.id, { src: img.src, originalSrc: img.originalSrc })
  return next
}

// ---------------------------------------------------------------------------
// Opt #2 helper — edit-mode detection for a single object
// ---------------------------------------------------------------------------
function isInEditMode(obj: CanvasObject): boolean {
  if (obj.type === 'image') return !!(obj as ImageObject).contentEditMode || !!(obj as ImageObject).clipEditMode
  if (obj.type === 'video') return !!(obj as VideoObject).contentEditMode || !!(obj as VideoObject).clipEditMode
  if (obj.type === 'path') return !!(obj as PathObject).pathEditMode
  return false
}

// ---------------------------------------------------------------------------
// Opt #1 helper — re-inject src/originalSrc into snapshot objects after undo/redo.
// NOTE: this means background-removal src changes are not undoable at the pixel
// level — the vault always holds the current (newest) src. Acceptable because
// background removal is not yet wired to the history system.
// ---------------------------------------------------------------------------
// Reinjected copies are cached by snapshot-object identity, revalidated against
// the current vault src — snapshot objects in past[]/future[] are frozen, so
// repeated undo/redo over the same snapshot reuses the same live copy.
const reinjectedCache = new WeakMap<
  CanvasObject,
  { src: string; originalSrc?: string; result: CanvasObject }
>()

function reinjectSrc(
  objects: Record<string, CanvasObject>,
  vault: Map<string, { src: string; originalSrc?: string }>
): Record<string, CanvasObject> {
  const result: Record<string, CanvasObject> = {}
  for (const [id, obj] of Object.entries(objects)) {
    // Empty frames had src === '' for real at this point in history — the vault
    // entry belongs to a later/earlier filled state, not to this snapshot.
    if (obj.type === 'image' && !(obj as ImageObject).isEmpty) {
      const v = vault.get(id)
      if (v) {
        const cached = reinjectedCache.get(obj)
        if (cached && cached.src === v.src && cached.originalSrc === v.originalSrc) {
          result[id] = cached.result
        } else {
          const reinjected = { ...obj, src: v.src, originalSrc: v.originalSrc } as CanvasObject
          reinjectedCache.set(obj, { src: v.src, originalSrc: v.originalSrc, result: reinjected })
          result[id] = reinjected
        }
        continue
      }
    }
    result[id] = obj
  }
  return result
}

interface CanvasState {
  objects: Record<string, CanvasObject>
  objectOrder: string[]
  selectedId: string | null
  selectedIds: string[]
  anchorId: string | null
  frameCount: number
  platform: Platform
  ratio: FrameRatio
  frameWidth: number
  frameHeight: number
  frames: Frame[]
  backgroundColor: string
  activeTool: ActiveTool
  guidelineOrientation: 'horizontal' | 'vertical'
  guidelinesVisible: boolean
  resizeMode: 'advanced' | 'auto'
  setResizeMode: (mode: 'advanced' | 'auto') => void
  snapEnabled: boolean
  toggleSnap: () => void
  /** Id of the path currently being drawn with the pen tool, or null. Transient —
   *  not persisted, not in history. Lets CanvasPathNode suppress the transform box
   *  on a path the user hasn't finished drawing yet. */
  penDrawingId: string | null
  setPenDrawingId: (id: string | null) => void
  adjustmentsBypass: boolean
  setAdjustmentsBypass: (v: boolean) => void
  toggleAdjustmentsBypass: () => void
  previewMode: boolean
  /** Transient: keyboard-shortcut cheatsheet overlay (not persisted). */
  shortcutOverlayOpen: boolean
  previewFrame: number        // 0-based index of frame shown in preview
  togglePreviewMode: () => void
  setShortcutOverlayOpen: (v: boolean) => void
  setPreviewFrame: (n: number) => void
  past: HistorySnapshot[]
  future: HistorySnapshot[]
  // Volatile UI state — NOT in HistorySnapshot
  contextMenu: { x: number; y: number; targetId: string | null } | null
  activeShapeKind: ShapeKind
  /** Id of the TextObject currently open for inline rich-text editing */
  textEditingId: string | null
  /** Character-index selection range within the editing text ([start, end) half-open) */
  textSelection: { start: number; end: number } | null
  /** Callback set by the active CanvasTextNode; PropertiesPanel calls it on mousedown
   *  to snapshot the live browser selection before focus can move away. */
  captureTextSelection: (() => void) | null
  setActiveShapeKind: (kind: ShapeKind) => void
  setTextEditing: (id: string | null) => void
  setTextSelection: (range: { start: number; end: number } | null) => void
  setCaptureTextSelection: (fn: (() => void) | null) => void
  loadProject: (project: CarouselProject) => void
  /** Reset to a blank document with the given size/frame settings. Mirrors
   *  loadProject's reset block — every field loadProject clears is cleared here
   *  too, or the new document inherits debris from the previous one. */
  newProject: (spec: NewProjectSpec) => void
  // actions
  addObject: (obj: CanvasObject) => void
  updateObject: (id: string, patch: Partial<CanvasObject>) => void
  updateObjects: (patches: Record<string, Partial<CanvasObject>>) => void
  commitUpdate: (id: string, patch: Partial<CanvasObject>) => void
  removeObject: (id: string) => void
  setSelected: (id: string | null) => void
  addToSelection: (id: string) => void
  setSelectedIds: (ids: string[]) => void
  setAnchor: (id: string | null) => void
  commitMultipleUpdates: (patches: Record<string, Partial<CanvasObject>>) => void
  removeMultipleObjects: (ids: string[]) => void
  setFrameCount: (n: number) => void
  setActiveTool: (tool: ActiveTool) => void
  setGuidelineOrientation: (orientation: 'horizontal' | 'vertical') => void
  toggleGuidelinesVisible: () => void
  reorderObjects: (fromId: string, toId: string, side: 'before' | 'after') => void
  toggleLock: (id: string) => void
  alignObjects: (anchor: 'left' | 'right' | 'top' | 'bottom' | 'centerH' | 'centerV') => void
  distributeObjects: (axis: 'horizontal' | 'vertical') => void
  setRatio: (r: FrameRatio, width: number, height: number) => void
  setPlatform: (p: Platform) => void
  setFrameBackground: (frameIndex: number, color: string | null) => void
  reorderFrames: (fromIndex: number, toIndex: number) => void
  setCanvasBackground: (color: string) => void
  undo: () => void
  redo: () => void
  clearContentEditMode: () => void
  clearPathEditMode: () => void
  /** Clear clip-shape edit mode on all media frames. */
  clearClipEditMode: () => void
  /** Enter clip-shape edit mode on one frame; clears contentEditMode everywhere. */
  enterClipEditMode: (id: string) => void
  // --- Media-frame conversions (all id-preserving, one history entry each) ---
  /** Same-id object swap; preserves objectOrder position, parentGroupId, srcVault. */
  swapObjectPreservingId: (id: string, replacement: CanvasObject) => void
  /** rect/ellipse shape or closed path → empty media frame (same id). No-op otherwise. */
  convertShapeToFrame: (id: string) => void
  /** Media/empty frame → ShapeObject or PathObject (same id). Drops media. */
  convertFrameToShape: (id: string) => void
  /** Drop image/video media into an empty (or existing) frame. */
  insertMediaIntoFrame: (id: string, media: InsertMedia) => void
  /** Convert a shape/path to a frame AND fill it, as ONE history entry. Accepts an
   *  existing frame too, so callers never need to branch on the target's type.
   *  Returns false when the target can't hold media (line/arrow, open path,
   *  degenerate bbox) so drop handlers can fall back to standalone placement. */
  insertMediaIntoShape: (id: string, media: InsertMedia) => boolean
  /** Clear a frame's media back to an empty ImageObject, keeping frame geometry/clip/fill. */
  removeMediaFromFrame: (id: string) => void
  /** Transient toolbar UI flags — not stored in history */
  showFrameSettings: boolean
  setShowFrameSettings: (v: boolean | ((prev: boolean) => boolean)) => void
  exportOpen: boolean
  setExportOpen: (v: boolean | ((prev: boolean) => boolean)) => void
  moveObject: (id: string, dx: number, dy: number) => void
  setContextMenu: (state: { x: number; y: number; targetId: string | null } | null) => void
  selectAll: () => void
  bringForward: (id: string) => void
  sendBackward: (id: string) => void
  bringToFront: (id: string) => void
  sendToBack: (id: string) => void
  duplicateObject: (id: string, offsetX?: number, offsetY?: number) => void
  duplicateObjectAtOrigin: (
    id: string,
    originPos: { x: number; y: number } | { frameX: number; frameY: number },
    finalPos: { x: number; y: number } | { frameX: number; frameY: number },
  ) => void
  /** Insert copies of `objects` centred on `target`. Ids are regenerated and
   *  group/child links remapped within the pasted set; one history entry for the
   *  whole paste, and the result becomes the selection. */
  pasteObjects: (objects: CanvasObject[], target: { x: number; y: number }) => void
  addGrid: (template: GridTemplate, canvasX: number, canvasY: number) => void
  disconnectGridCell: (cellId: string) => void
  /** Transient — captures pre-drag object state so commitUpdate can save the correct pre-drag snapshot. Not in history. */
  _dragStartObjects: Record<string, CanvasObject> | null
  /** Call onMouseDown before any updateObject drag calls. commitUpdate will use this snapshot for the history entry. */
  startDrag: () => void
  commitDraggedState: () => void
  /** Transient — set of VideoObject ids currently playing. Not in history. */
  videoPlayingIds: Set<string>
  /** Toggle play/pause for a video object. */
  toggleVideoPlay: (id: string) => void
  // ---------------------------------------------------------------------------
  // Opt #1: src vault — keeps base64 data URLs out of history snapshots.
  // NOT in HistorySnapshot — intentionally excluded from past[]/future[].
  // ---------------------------------------------------------------------------
  _srcVault: Map<string, { src: string; originalSrc?: string }>
  // ---------------------------------------------------------------------------
  // Opt #2: count of objects currently in any edit mode — allows
  // normalizeObjectsForSnapshot to skip the edit-mode loop when zero.
  // NOT in HistorySnapshot — intentionally excluded from past[]/future[].
  // ---------------------------------------------------------------------------
  _openEditModeCount: number
}

// ---------------------------------------------------------------------------
// Opt #2: normalizeObjectsForSnapshot with fast path when no edit modes open.
// Also strips src/originalSrc from ImageObjects (Opt #1).
// Opt #3: normalized image copies are cached by live-object identity — objects
// are replaced immutably on update, so an unchanged image reuses the same
// stripped copy across every history push instead of re-allocating per commit.
// Consecutive snapshots then share object references (less GC + memory).
// ---------------------------------------------------------------------------
const normalizedImageCache = new WeakMap<CanvasObject, CanvasObject>()

function normalizeObjectsForSnapshot(
  objects: Record<string, CanvasObject>,
  hasOpenEditModes: boolean
): Record<string, CanvasObject> {
  let changed = false
  const result: Record<string, CanvasObject> = {}
  for (const [id, obj] of Object.entries(objects)) {
    if (obj.type === 'image') {
      const img = obj as ImageObject
      const clearModes = hasOpenEditModes && (img.contentEditMode || img.clipEditMode)
      // src is always non-empty on live objects, so images always need a stripped copy
      if (clearModes) {
        // Rare path (edit mode open during commit) — don't pollute the cache,
        // the object will be replaced when the mode closes anyway.
        result[id] = {
          ...img,
          contentEditMode: false,
          clipEditMode: false,
          src: '',
          originalSrc: undefined,
        } as CanvasObject
      } else {
        let norm = normalizedImageCache.get(obj)
        if (!norm) {
          norm = { ...img, src: '', originalSrc: undefined } as CanvasObject
          normalizedImageCache.set(obj, norm)
        }
        result[id] = norm
      }
      changed = true
    } else if (obj.type === 'video') {
      const vid = obj as VideoObject
      if (hasOpenEditModes && (vid.contentEditMode || vid.clipEditMode)) {
        result[id] = { ...vid, contentEditMode: false, clipEditMode: false } as CanvasObject
        changed = true
        continue
      }
      result[id] = obj
    } else if (obj.type === 'path') {
      const p = obj as PathObject
      if (hasOpenEditModes && p.pathEditMode) {
        result[id] = { ...p, pathEditMode: false } as CanvasObject
        changed = true
        continue
      }
      result[id] = obj
    } else {
      result[id] = obj
    }
  }
  return changed ? result : objects
}

export const useCanvasStore = create<CanvasState>((set) => {
  function pushHistoryFrom(
    state: Pick<CanvasState, 'objects' | 'objectOrder' | 'ratio' | 'frameWidth' | 'frameHeight' | 'frames' | 'backgroundColor' | 'frameCount' | 'past' | '_openEditModeCount'>
  ): HistorySnapshot[] {
    const snapshot: HistorySnapshot = {
      objects: normalizeObjectsForSnapshot(state.objects, state._openEditModeCount > 0),
      objectOrder: state.objectOrder,
      ratio: state.ratio,
      frameWidth: state.frameWidth,
      frameHeight: state.frameHeight,
      frames: state.frames,
      backgroundColor: state.backgroundColor,
      frameCount: state.frameCount,
    }
    const trimmed =
      state.past.length >= MAX_HISTORY
        ? state.past.slice(state.past.length - MAX_HISTORY + 1)
        : state.past
    return [...trimmed, snapshot]
  }

  // Remove `cellId` from its parent grid group's childIds. Mutates `objects`,
  // which must already be a fresh copy. Returns the group id when that was the
  // group's last cell and the group has been deleted — a grid owning nothing is
  // an orphan the user can't select, move or refill, so it must not survive.
  //
  // Every path that takes a cell out of a grid goes through here. Skipping it is
  // what left a dangling child id and a permanently unrecoverable slot (#62).
  function detachCellFromParent(
    objects: Record<string, CanvasObject>,
    cellId: string,
    parentGroupId: string,
  ): string | null {
    const parent = objects[parentGroupId] as GroupObject | undefined
    if (!parent) return null
    const childIds = parent.childIds.filter((cid) => cid !== cellId)
    if (childIds.length === 0) {
      delete objects[parentGroupId]
      return parentGroupId
    }
    objects[parentGroupId] = { ...parent, childIds }
    return null
  }

  // Expand a delete set to include every descendant of any group in it.
  //
  // Deleting a group must take its cells with it. A cell left behind keeps a
  // parentGroupId pointing at an object that no longer exists, and since a cell
  // only listens while its grid is *entered* (CanvasImageNode), those orphans are
  // permanently unselectable — visible debris the user cannot remove. Keeping a
  // cell is what "Disconnect from grid" is for; it detaches first, then the cell
  // is an ordinary object.
  function withGroupDescendants(
    objects: Record<string, CanvasObject>,
    ids: Iterable<string>,
  ): Set<string> {
    const out = new Set<string>()
    const queue = [...ids]
    while (queue.length > 0) {
      const id = queue.pop()!
      if (out.has(id)) continue
      out.add(id)
      const obj = objects[id]
      // Nested groups are not built today, but the traversal costs nothing and
      // makes this correct if they ever are.
      if (obj?.type === 'group') queue.push(...obj.childIds)
    }
    return out
  }

  // Id-preserving object swap: replaces state.objects[id] with `replacement`
  // (forced to the same id), keeping the object's objectOrder position and
  // parentGroupId, updating _srcVault and _openEditModeCount. Returns a state
  // patch, or null when the id is absent. One history entry.
  function idPreservingSwapState(
    state: CanvasState,
    id: string,
    replacement: CanvasObject,
  ): Partial<CanvasState> | null {
    const old = state.objects[id]
    if (!old) return null
    const next = {
      ...replacement,
      id,
      ...(old.parentGroupId ? { parentGroupId: old.parentGroupId } : {}),
    } as CanvasObject

    // srcVault: register src for image replacements. When the replacement has
    // no src (empty frame, shape conversion), KEEP the old entry — undo restores
    // the pre-swap snapshot and reinjectSrc needs the vault to repopulate src.
    let nextVault = state._srcVault
    if (next.type === 'image' && (next as ImageObject).src) {
      const img = next as ImageObject
      nextVault = new Map(state._srcVault)
      nextVault.set(id, { src: img.src, originalSrc: img.originalSrc })
    }

    const wasOpen = isInEditMode(old)
    const isOpen = isInEditMode(next)
    const countDelta = (!wasOpen && isOpen) ? 1 : (wasOpen && !isOpen) ? -1 : 0

    return {
      past: pushHistoryFrom(state),
      future: [],
      objects: { ...state.objects, [id]: next },
      _srcVault: nextVault,
      _openEditModeCount: state._openEditModeCount + countDelta,
    }
  }

  return {
    objects: {},
    objectOrder: [],
    selectedId: null,
    selectedIds: [],
    anchorId: null,
    frameCount: 2,
    platform: 'instagram',
    ratio: 'square',
    frameWidth: 1080,
    frameHeight: 1080,
    frames: makeFrames(2),
    backgroundColor: '#ffffff',
    activeTool: 'select',
    guidelineOrientation: 'horizontal',
    guidelinesVisible: true,
    resizeMode: 'auto',
    snapEnabled: true,
    penDrawingId: null,
    adjustmentsBypass: false,
    previewMode: false,
    shortcutOverlayOpen: false,
    previewFrame: 0,
    past: [],
    future: [],
    contextMenu: null,
    activeShapeKind: 'rect',
    textEditingId: null,
    textSelection: null,
    captureTextSelection: null,
    showFrameSettings: false,
    exportOpen: false,
    _dragStartObjects: null,
    videoPlayingIds: new Set<string>(),
    _srcVault: new Map(),
    _openEditModeCount: 0,

    addObject: (obj) => {
      let normalized = obj
      if (obj.type === 'shape') {
        const s = obj as ShapeObject
        if ((s.kind === 'line' || s.kind === 'arrow') && s.x2 === undefined) {
          normalized = { ...s, x2: s.x + s.width, y2: s.y + s.height } as CanvasObject
        }
      }
      return set((state) => {
        // Opt #1: seed vault for new image objects
        let nextVault = state._srcVault
        if (normalized.type === 'image') {
          const img = normalized as ImageObject
          if (img.src) {
            nextVault = new Map(state._srcVault)
            nextVault.set(img.id, { src: img.src, originalSrc: img.originalSrc })
          }
        }
        return {
          past: pushHistoryFrom(state),
          future: [],
          objects: { ...state.objects, [normalized.id]: normalized },
          objectOrder: [...state.objectOrder, normalized.id],
          _srcVault: nextVault,
        }
      })
    },

    updateObject: (id, patch) =>
      set((state) => {
        const existing = state.objects[id]
        if (!existing) return state
        const newObj = { ...existing, ...patch } as CanvasObject
        // Opt #2: track edit mode count delta
        const wasOpen = isInEditMode(existing)
        const isOpen = isInEditMode(newObj)
        const countDelta = (!wasOpen && isOpen) ? 1 : (wasOpen && !isOpen) ? -1 : 0
        return {
          objects: {
            ...state.objects,
            [id]: newObj,
          },
          _openEditModeCount: state._openEditModeCount + countDelta,
        }
      }),

    updateObjects: (patches) =>
      set((state) => {
        const updatedObjects = { ...state.objects }
        let countDelta = 0
        for (const [id, patch] of Object.entries(patches)) {
          const existing = state.objects[id]
          if (!existing) continue
          const newObj = { ...existing, ...patch } as CanvasObject
          updatedObjects[id] = newObj
          const wasOpen = isInEditMode(existing)
          const isOpen = isInEditMode(newObj)
          countDelta += (!wasOpen && isOpen) ? 1 : (wasOpen && !isOpen) ? -1 : 0
        }
        return { objects: updatedObjects, _openEditModeCount: state._openEditModeCount + countDelta }
      }),

    commitUpdate: (id, patch) =>
      set((state) => {
        const existing = state.objects[id]
        if (!existing) return state
        // Use pre-drag snapshot when available so undo reaches the state before the drag started,
        // not the live-preview-mutated state that updateObject left behind.
        const snapshotObjects = state._dragStartObjects ?? state.objects
        const newObj = { ...existing, ...patch } as CanvasObject

        // Opt #1: update vault if src/originalSrc changed
        let nextVault = state._srcVault
        if (newObj.type === 'image') {
          const p = patch as Partial<ImageObject>
          if (p.src !== undefined || p.originalSrc !== undefined) {
            nextVault = new Map(state._srcVault)
            const img = newObj as ImageObject
            nextVault.set(id, { src: img.src, originalSrc: img.originalSrc })
          }
        }

        // Opt #2: track edit mode count delta
        const wasOpen = isInEditMode(existing)
        const isOpen = isInEditMode(newObj)
        const countDelta = (!wasOpen && isOpen) ? 1 : (wasOpen && !isOpen) ? -1 : 0

        return {
          past: pushHistoryFrom({ ...state, objects: snapshotObjects }),
          future: [],
          _dragStartObjects: null,
          objects: {
            ...state.objects,
            [id]: newObj,
          },
          _srcVault: nextVault,
          _openEditModeCount: state._openEditModeCount + countDelta,
        }
      }),

    startDrag: () =>
      set((state) => ({ _dragStartObjects: state.objects })),

    commitDraggedState: () =>
      set((state) => ({
        past: pushHistoryFrom({ ...state, objects: state._dragStartObjects ?? state.objects }),
        future: [],
        _dragStartObjects: null,
      })),

    removeObject: (id) =>
      set((state) => {
        const existing = state.objects[id]
        // Grid cells with media: restore to empty placeholder instead of deleting,
        // so the cell slot stays in the grid and can be refilled.
        if (existing?.parentGroupId && existing.type === 'image' && !(existing as ImageObject).isEmpty) {
          const cell = existing as ImageObject
          const placeholder = frameToEmptyImage(cell, id)
          let nextVault = state._srcVault
          if (state._srcVault.has(id)) {
            nextVault = new Map(state._srcVault)
            nextVault.delete(id)
          }
          return {
            past: pushHistoryFrom(state),
            future: [],
            objects: { ...state.objects, [id]: placeholder },
            selectedId: state.selectedId === id ? null : state.selectedId,
            selectedIds: state.selectedIds.filter((sid) => sid !== id),
            _srcVault: nextVault,
            _openEditModeCount: state._openEditModeCount - (isInEditMode(cell) ? 1 : 0),
          }
        }
        // Video grid cells: restore to empty image placeholder
        if (existing?.parentGroupId && existing.type === 'video') {
          const cell = existing as VideoObject
          const placeholder = frameToEmptyImage(cell, id)
          return {
            past: pushHistoryFrom(state),
            future: [],
            objects: { ...state.objects, [id]: placeholder },
            selectedId: state.selectedId === id ? null : state.selectedId,
            selectedIds: state.selectedIds.filter((sid) => sid !== id),
            _openEditModeCount: state._openEditModeCount - (isInEditMode(cell) ? 1 : 0),
          }
        }
        const rest = { ...state.objects }
        // Deleting a grid takes its cells with it — see withGroupDescendants.
        const removedIds = withGroupDescendants(state.objects, [id])
        for (const rid of removedIds) delete rest[rid]
        // An ALREADY-EMPTY cell reaches here: both interceptions above require media.
        // Deleting it without detaching would leave its id dangling in the parent's
        // childIds and the slot unrecoverable (#62).
        const emptiedGroupId = existing?.parentGroupId
          ? detachCellFromParent(rest, id, existing.parentGroupId)
          : null
        if (emptiedGroupId) removedIds.add(emptiedGroupId)
        // Opt #1: remove from vault — only for the object actually targeted.
        // Cells swept up by a group delete KEEP their vault entries, or undo would
        // bring the grid back with every image blank (reinjectSrc reads the vault).
        let nextVault = state._srcVault
        if (state._srcVault.has(id)) {
          nextVault = new Map(state._srcVault)
          nextVault.delete(id)
        }
        // Opt #2: decrement count for every removed object in edit mode
        const removedInEditMode = [...removedIds]
          .filter((rid) => state.objects[rid] && isInEditMode(state.objects[rid])).length
        return {
          past: pushHistoryFrom(state),
          future: [],
          objects: rest,
          objectOrder: state.objectOrder.filter((oid) => !removedIds.has(oid)),
          selectedId: removedIds.has(state.selectedId ?? '') ? null : state.selectedId,
          selectedIds: state.selectedIds.filter((sid) => !removedIds.has(sid)),
          anchorId: removedIds.has(state.anchorId ?? '') ? null : state.anchorId,
          _srcVault: nextVault,
          _openEditModeCount: state._openEditModeCount - removedInEditMode,
        }
      }),

    setSelected: (id) =>
      set((state) => ({
        // Moving selection to a different object ends any lingering clip-edit session.
        ...(clearClipEditExcept(state, id) ?? {}),
        selectedId: id,
        selectedIds: id !== null ? [id] : [],
        anchorId: null,
      })),

    addToSelection: (id) =>
      set((state) => {
        const already = state.selectedIds.includes(id)
        if (already) {
          const newIds = state.selectedIds.filter((sid) => sid !== id)
          return {
            ...(clearClipEditExcept(state, id) ?? {}),
            selectedIds: newIds,
            selectedId: newIds.length > 0 ? newIds[newIds.length - 1] : null,
            anchorId: state.anchorId === id ? null : state.anchorId,
          }
        }
        return {
          ...(clearClipEditExcept(state, id) ?? {}),
          selectedIds: [...state.selectedIds, id],
          // Set selectedId when coming from empty selection so properties panel shows something
          selectedId: state.selectedId ?? id,
        }
      }),

    setSelectedIds: (ids) =>
      set((state) => ({
        ...(clearClipEditExcept(state, ids.length > 0 ? ids[ids.length - 1] : null) ?? {}),
        selectedIds: ids,
        selectedId: ids.length > 0 ? ids[ids.length - 1] : null,
        anchorId: null,
      })),

    setAnchor: (id) =>
      set((state) => {
        if (id === null) return { anchorId: null }
        if (!state.selectedIds.includes(id)) return state
        return { anchorId: id }
      }),

    commitMultipleUpdates: (patches) =>
      set((state) => {
        const updatedObjects = { ...state.objects }
        let nextVault = state._srcVault
        let countDelta = 0
        for (const [id, patch] of Object.entries(patches)) {
          const existing = state.objects[id]
          if (!existing) continue
          const newObj = { ...existing, ...patch } as CanvasObject
          updatedObjects[id] = newObj

          // Opt #1: update vault for any image with changed src
          if (newObj.type === 'image') {
            const p = patch as Partial<ImageObject>
            if (p.src !== undefined || p.originalSrc !== undefined) {
              if (nextVault === state._srcVault) nextVault = new Map(state._srcVault)
              const img = newObj as ImageObject
              nextVault.set(id, { src: img.src, originalSrc: img.originalSrc })
            }
          }

          // Opt #2: accumulate edit mode count delta
          const wasOpen = isInEditMode(existing)
          const isOpen = isInEditMode(newObj)
          countDelta += (!wasOpen && isOpen) ? 1 : (wasOpen && !isOpen) ? -1 : 0
        }
        return {
          past: pushHistoryFrom(state),
          future: [],
          objects: updatedObjects,
          _srcVault: nextVault,
          _openEditModeCount: state._openEditModeCount + countDelta,
        }
      }),

    removeMultipleObjects: (ids) =>
      set((state) => {
        // Same rule as removeObject: a group in the selection takes its cells with it.
        const targetedIds = new Set(ids)
        const idSet = withGroupDescendants(state.objects, ids)
        const updatedObjects = { ...state.objects }
        // Opt #1 + #2: process removals
        let nextVault = state._srcVault
        let editModeRemoved = 0
        for (const id of idSet) {
          const obj = state.objects[id]
          if (obj) {
            if (isInEditMode(obj)) editModeRemoved++
          }
          delete updatedObjects[id]
          // Vault entries are dropped only for explicitly targeted ids — cells swept
          // up by a group delete keep theirs so undo can reinject their media.
          if (targetedIds.has(id) && state._srcVault.has(id)) {
            if (nextVault === state._srcVault) nextVault = new Map(state._srcVault)
            nextVault.delete(id)
          }
        }
        return {
          past: pushHistoryFrom(state),
          future: [],
          objects: updatedObjects,
          objectOrder: state.objectOrder.filter((oid) => !idSet.has(oid)),
          selectedId: idSet.has(state.selectedId ?? '') ? null : state.selectedId,
          selectedIds: state.selectedIds.filter((sid) => !idSet.has(sid)),
          anchorId: idSet.has(state.anchorId ?? '') ? null : state.anchorId,
          _srcVault: nextVault,
          _openEditModeCount: state._openEditModeCount - editModeRemoved,
        }
      }),

    setFrameCount: (n) =>
      set((state) => {
        // No upper bound — frame count is uncapped; `|| 1` also absorbs NaN/fractional input.
        const clamped = Math.max(1, Math.floor(n) || 1)
        const current = state.frames
        let frames: Frame[]
        if (clamped > current.length) {
          frames = [
            ...current,
            ...Array.from({ length: clamped - current.length }, (_, i) => ({
              index: current.length + i,
              label: `Slide ${current.length + i + 1}`,
              backgroundColor: null,
            })),
          ]
        } else {
          frames = current.slice(0, clamped)
        }
        return { past: pushHistoryFrom(state), future: [], frameCount: clamped, frames }
      }),

    setActiveTool: (tool) => set({ activeTool: tool }),
    setGuidelineOrientation: (orientation) => set({ guidelineOrientation: orientation }),
    toggleGuidelinesVisible: () => set((s) => ({ guidelinesVisible: !s.guidelinesVisible })),

    setResizeMode: (mode) => set({ resizeMode: mode }),

    toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),
    setPenDrawingId: (id) => set({ penDrawingId: id }),
    setAdjustmentsBypass: (v) => set({ adjustmentsBypass: v }),
    toggleAdjustmentsBypass: () => set((s) => ({ adjustmentsBypass: !s.adjustmentsBypass })),
    togglePreviewMode: () => set((s) => ({ previewMode: !s.previewMode, previewFrame: 0 })),
    setShortcutOverlayOpen: (v) => set({ shortcutOverlayOpen: v }),
    setPreviewFrame: (n) => set({ previewFrame: n }),

    reorderObjects: (fromId, toId, side) =>
      set((state) => {
        const order = [...state.objectOrder]
        const fromIndex = order.indexOf(fromId)
        if (fromIndex === -1) return state
        order.splice(fromIndex, 1)
        const toIndex = order.indexOf(toId)
        if (toIndex === -1) return state
        // Panel is reversed from objectOrder, so:
        // 'before' in panel (insert above target visually) = insert AFTER toId in objectOrder
        // 'after' in panel (insert below target visually) = insert BEFORE toId in objectOrder
        const insertAt = side === 'before' ? toIndex + 1 : toIndex
        order.splice(insertAt, 0, fromId)
        return { past: pushHistoryFrom(state), future: [], objectOrder: order }
      }),

    toggleLock: (id) =>
      set((state) => {
        const obj = state.objects[id]
        if (!obj) return state
        return {
          past: pushHistoryFrom(state),
          future: [],
          objects: {
            ...state.objects,
            [id]: { ...obj, locked: !obj.locked } as CanvasObject,
          },
        }
      }),

    alignObjects: (anchor) =>
      set((state) => {
        const ids = state.selectedIds
        if (ids.length < 2) return state

        const bboxes = ids
          .map((id) => state.objects[id])
          .filter((obj): obj is CanvasObject => obj !== undefined)
          .map((obj) => getObjectBBox(obj))

        if (bboxes.length < 2) return state

        // When anchor object is set, align TO its bbox; otherwise use collective bbox
        let refMinX: number, refMinY: number, refMaxX: number, refMaxY: number, refCenterX: number, refCenterY: number
        if (state.anchorId && state.selectedIds.includes(state.anchorId)) {
          const anchorObj = state.objects[state.anchorId]
          if (anchorObj) {
            const ab = getObjectBBox(anchorObj)
            refMinX = ab.x
            refMinY = ab.y
            refMaxX = ab.x + ab.width
            refMaxY = ab.y + ab.height
            refCenterX = ab.x + ab.width / 2
            refCenterY = ab.y + ab.height / 2
          } else {
            refMinX = Math.min(...bboxes.map((b) => b.x))
            refMinY = Math.min(...bboxes.map((b) => b.y))
            refMaxX = Math.max(...bboxes.map((b) => b.x + b.width))
            refMaxY = Math.max(...bboxes.map((b) => b.y + b.height))
            refCenterX = (refMinX + refMaxX) / 2
            refCenterY = (refMinY + refMaxY) / 2
          }
        } else {
          refMinX = Math.min(...bboxes.map((b) => b.x))
          refMinY = Math.min(...bboxes.map((b) => b.y))
          refMaxX = Math.max(...bboxes.map((b) => b.x + b.width))
          refMaxY = Math.max(...bboxes.map((b) => b.y + b.height))
          refCenterX = (refMinX + refMaxX) / 2
          refCenterY = (refMinY + refMaxY) / 2
        }

        const updatedObjects = { ...state.objects }
        for (const id of ids) {
          // Anchor object does not move when anchoring to it
          if (state.anchorId && id === state.anchorId) continue

          const obj = state.objects[id]
          if (!obj) continue
          const bbox = getObjectBBox(obj)

          let dx = 0
          let dy = 0
          switch (anchor) {
            case 'left':
              dx = refMinX - bbox.x
              break
            case 'right':
              dx = refMaxX - (bbox.x + bbox.width)
              break
            case 'top':
              dy = refMinY - bbox.y
              break
            case 'bottom':
              dy = refMaxY - (bbox.y + bbox.height)
              break
            case 'centerH':
              dx = refCenterX - (bbox.x + bbox.width / 2)
              break
            case 'centerV':
              dy = refCenterY - (bbox.y + bbox.height / 2)
              break
          }

          if (dx === 0 && dy === 0) continue

          if (obj.type === 'image') {
            const img = obj as ImageObject
            updatedObjects[id] = {
              ...img,
              frameX: img.frameX + dx,
              frameY: img.frameY + dy,
              x: img.x + dx,
              y: img.y + dy,
            }
          } else {
            updatedObjects[id] = { ...obj, x: obj.x + dx, y: obj.y + dy }
          }
        }

        return {
          past: pushHistoryFrom(state),
          future: [],
          objects: updatedObjects,
        }
      }),

    distributeObjects: (axis) =>
      set((state) => {
        const ids = state.selectedIds
        if (ids.length < 2) return state

        const items = ids
          .map((id) => {
            const obj = state.objects[id]
            if (!obj) return null
            return { id, obj, bbox: getObjectBBox(obj) }
          })
          .filter((item): item is { id: string; obj: CanvasObject; bbox: ReturnType<typeof getObjectBBox> } => item !== null)

        if (items.length < 2) return state

        const updatedObjects = { ...state.objects }

        if (axis === 'horizontal') {
          items.sort((a, b) => a.bbox.x + a.bbox.width / 2 - (b.bbox.x + b.bbox.width / 2))
          const firstCenter = items[0].bbox.x + items[0].bbox.width / 2
          const lastCenter = items[items.length - 1].bbox.x + items[items.length - 1].bbox.width / 2
          const spacing = (lastCenter - firstCenter) / (items.length - 1)

          for (let i = 1; i < items.length - 1; i++) {
            const { id, obj, bbox } = items[i]
            const targetCenterX = firstCenter + spacing * i
            const dx = targetCenterX - (bbox.x + bbox.width / 2)
            if (obj.type === 'image') {
              const img = obj as ImageObject
              updatedObjects[id] = { ...img, frameX: img.frameX + dx, x: img.x + dx }
            } else {
              updatedObjects[id] = { ...obj, x: obj.x + dx }
            }
          }
        } else {
          items.sort((a, b) => a.bbox.y + a.bbox.height / 2 - (b.bbox.y + b.bbox.height / 2))
          const firstCenter = items[0].bbox.y + items[0].bbox.height / 2
          const lastCenter = items[items.length - 1].bbox.y + items[items.length - 1].bbox.height / 2
          const spacing = (lastCenter - firstCenter) / (items.length - 1)

          for (let i = 1; i < items.length - 1; i++) {
            const { id, obj, bbox } = items[i]
            const targetCenterY = firstCenter + spacing * i
            const dy = targetCenterY - (bbox.y + bbox.height / 2)
            if (obj.type === 'image') {
              const img = obj as ImageObject
              updatedObjects[id] = { ...img, frameY: img.frameY + dy, y: img.y + dy }
            } else {
              updatedObjects[id] = { ...obj, y: obj.y + dy }
            }
          }
        }

        return {
          past: pushHistoryFrom(state),
          future: [],
          objects: updatedObjects,
        }
      }),

    setRatio: (r, width, height) =>
      set((state) => ({
        past: pushHistoryFrom(state),
        future: [],
        ratio: r,
        frameWidth: width,
        frameHeight: height,
      })),

    setPlatform: (p) =>
      set((state) => {
        const first = PLATFORM_PRESETS[p][0]
        return {
          past: pushHistoryFrom(state),
          future: [],
          platform: p,
          ratio: first.ratio,
          frameWidth: first.width,
          frameHeight: first.height,
        }
      }),

    setFrameBackground: (frameIndex, color) =>
      set((state) => {
        const frames = state.frames.map((f) =>
          f.index === frameIndex ? { ...f, backgroundColor: color } : f
        )
        return {
          past: pushHistoryFrom(state),
          future: [],
          frames,
        }
      }),

    reorderFrames: (fromIndex, toIndex) => {
      if (fromIndex === toIndex) return
      set((state) => {
        const { objects, frames, frameWidth } = state

        const newFrames = [...frames]
        const [moved] = newFrames.splice(fromIndex, 1)
        newFrames.splice(toIndex, 0, moved)
        const reindexedFrames = newFrames.map((f, i) => ({ ...f, index: i }))

        const slotShift = (slot: number): number => {
          if (slot === fromIndex) return toIndex
          if (fromIndex < toIndex && slot > fromIndex && slot <= toIndex) return slot - 1
          if (fromIndex > toIndex && slot >= toIndex && slot < fromIndex) return slot + 1
          return slot
        }

        const patches: Record<string, Partial<CanvasObject>> = {}
        for (const obj of Object.values(objects)) {
          if (obj.locked) continue
          if (obj.type === 'guideline') {
            const g = obj as GuidelineObject
            if (g.frameIndex === -1 || g.spanAllFrames) continue
            const newSlot = slotShift(g.frameIndex)
            if (newSlot === g.frameIndex) continue
            const delta = newSlot - g.frameIndex
            patches[obj.id] = {
              pinnedFrame: newSlot,
              frameIndex: newSlot,
              ...(g.orientation === 'vertical'
                ? { position: g.position + delta * frameWidth, x: g.x + delta * frameWidth }
                : {}),
            }
            continue
          }
          const bbox = getObjectBBox(obj)
          const oldSlot = Math.floor((bbox.x + bbox.width / 2) / frameWidth)
          if (oldSlot < 0 || oldSlot >= frames.length) continue
          const newSlot = slotShift(oldSlot)
          if (newSlot === oldSlot) continue
          const delta = newSlot - oldSlot
          if (obj.type === 'image' || obj.type === 'video') {
            const img = obj as ImageObject | VideoObject
            patches[obj.id] = {
              frameX: img.frameX + delta * frameWidth,
              x: img.x + delta * frameWidth,
            }
          } else {
            patches[obj.id] = { x: obj.x + delta * frameWidth }
          }
        }

        const newObjects = { ...objects }
        for (const [id, patch] of Object.entries(patches)) {
          newObjects[id] = { ...newObjects[id], ...patch } as CanvasObject
        }

        return {
          past: pushHistoryFrom(state),
          future: [],
          frames: reindexedFrames,
          objects: newObjects,
        }
      })
    },

    setCanvasBackground: (color) =>
      set((state) => ({
        past: pushHistoryFrom(state),
        future: [],
        backgroundColor: color,
      })),

    undo: () =>
      set((state) => {
        if (state.past.length === 0) return state
        const previous = state.past[state.past.length - 1]
        const newPast = state.past.slice(0, state.past.length - 1)
        const currentSnapshot: HistorySnapshot = {
          // Snapshot current objects with src stripped (consistent with how we push to past)
          objects: normalizeObjectsForSnapshot(state.objects, state._openEditModeCount > 0),
          objectOrder: state.objectOrder,
          ratio: state.ratio,
          frameWidth: state.frameWidth,
          frameHeight: state.frameHeight,
          frames: state.frames,
          backgroundColor: state.backgroundColor,
          frameCount: state.frameCount,
        }
        return {
          past: newPast,
          future: [currentSnapshot, ...state.future],
          // Opt #1: reinject current src from vault into restored snapshot.
          // Background-removal src changes are intentionally non-undoable at pixel level.
          objects: reinjectSrc(previous.objects, state._srcVault),
          objectOrder: previous.objectOrder,
          ratio: previous.ratio,
          frameWidth: previous.frameWidth,
          frameHeight: previous.frameHeight,
          frames: previous.frames,
          backgroundColor: previous.backgroundColor,
          frameCount: previous.frameCount,
          // Opt #2: all edit modes are cleared on undo (snapshots store mode=false)
          _openEditModeCount: 0,
        }
      }),

    redo: () =>
      set((state) => {
        if (state.future.length === 0) return state
        const next = state.future[0]
        const newFuture = state.future.slice(1)
        const currentSnapshot: HistorySnapshot = {
          // Snapshot current objects with src stripped
          objects: normalizeObjectsForSnapshot(state.objects, state._openEditModeCount > 0),
          objectOrder: state.objectOrder,
          ratio: state.ratio,
          frameWidth: state.frameWidth,
          frameHeight: state.frameHeight,
          frames: state.frames,
          backgroundColor: state.backgroundColor,
          frameCount: state.frameCount,
        }
        return {
          past: [...state.past, currentSnapshot],
          future: newFuture,
          // Opt #1: reinject current src from vault into restored snapshot.
          // Background-removal src changes are intentionally non-undoable at pixel level.
          objects: reinjectSrc(next.objects, state._srcVault),
          objectOrder: next.objectOrder,
          ratio: next.ratio,
          frameWidth: next.frameWidth,
          frameHeight: next.frameHeight,
          frames: next.frames,
          backgroundColor: next.backgroundColor,
          frameCount: next.frameCount,
          // Opt #2: all edit modes are cleared on redo (snapshots store mode=false)
          _openEditModeCount: 0,
        }
      }),

    clearContentEditMode: () =>
      set((state) => {
        const updated: Record<string, CanvasObject> = {}
        let changed = false
        for (const [id, obj] of Object.entries(state.objects)) {
          if (obj.type === 'image' && obj.contentEditMode) {
            updated[id] = { ...obj, contentEditMode: false }
            changed = true
          } else {
            updated[id] = obj
          }
        }
        if (!changed) return {}
        return { objects: updated, _openEditModeCount: 0 }
      }),

    clearPathEditMode: () =>
      set((state) => {
        const updated: Record<string, CanvasObject> = {}
        let changed = false
        for (const [id, obj] of Object.entries(state.objects)) {
          if (obj.type === 'path' && (obj as PathObject).pathEditMode) {
            updated[id] = { ...obj, pathEditMode: false } as CanvasObject
            changed = true
          } else {
            updated[id] = obj
          }
        }
        if (!changed) return {}
        return { objects: updated, _openEditModeCount: 0 }
      }),

    clearClipEditMode: () =>
      set((state) => {
        const updated: Record<string, CanvasObject> = {}
        // Count what we actually close and decrement by that. Zeroing the counter
        // outright would also discard a contentEditMode open on another object.
        let cleared = 0
        let changed = false
        for (const [id, obj] of Object.entries(state.objects)) {
          if ((obj.type === 'image' || obj.type === 'video') && (obj as ImageObject | VideoObject).clipEditMode) {
            const next = { ...obj, clipEditMode: false } as CanvasObject
            updated[id] = next
            changed = true
            // Only decrement for objects that leave edit mode entirely — an object
            // with contentEditMode still set is still open.
            if (!isInEditMode(next)) cleared++
          } else {
            updated[id] = obj
          }
        }
        if (!changed) return {}
        return {
          objects: updated,
          _openEditModeCount: Math.max(0, state._openEditModeCount - cleared),
        }
      }),

    enterClipEditMode: (id) =>
      set((state) => {
        const updated: Record<string, CanvasObject> = {}
        for (const [oid, obj] of Object.entries(state.objects)) {
          if (obj.type === 'image' || obj.type === 'video') {
            updated[oid] = {
              ...obj,
              contentEditMode: false,
              clipEditMode: oid === id,
            } as CanvasObject
          } else {
            updated[oid] = obj
          }
        }
        // Exactly one object is now in clipEditMode
        return { objects: updated, _openEditModeCount: 1 }
      }),

    swapObjectPreservingId: (id, replacement) =>
      set((state) => idPreservingSwapState(state, id, replacement) ?? state),

    convertShapeToFrame: (id) =>
      set((state) => {
        const obj = state.objects[id]
        if (!obj) return state
        const frame = buildFrameFromShape(obj, id)
        if (!frame) return state
        return idPreservingSwapState(state, id, frame) ?? state
      }),

    convertFrameToShape: (id) =>
      set((state) => {
        const obj = state.objects[id]
        if (!obj || (obj.type !== 'image' && obj.type !== 'video')) return state
        const replacement = buildShapeFromFrame(obj as ImageObject | VideoObject, id)
        return idPreservingSwapState(state, id, replacement) ?? state
      }),

    insertMediaIntoFrame: (id, media) =>
      set((state) => {
        const obj = state.objects[id]
        if (!obj || (obj.type !== 'image' && obj.type !== 'video')) return state
        const filled = buildFilledFrame(obj as ImageObject | VideoObject, id, media)
        return idPreservingSwapState(state, id, filled) ?? state
      }),

    // Convert a shape/path into a media frame AND fill it in a single set(), so the
    // whole gesture is one undo step. Doing it as two actions leaves a bare empty
    // frame where the user's shape was after one Cmd+Z.
    insertMediaIntoShape: (id, media) => {
      let inserted = false
      set((state) => {
        const obj = state.objects[id]
        if (!obj) return state
        const frame =
          obj.type === 'image' || obj.type === 'video'
            ? (obj as ImageObject | VideoObject)
            : buildFrameFromShape(obj, id)
        if (!frame) return state
        const patch = idPreservingSwapState(state, id, buildFilledFrame(frame, id, media))
        if (!patch) return state
        inserted = true
        return patch
      })
      return inserted
    },

    removeMediaFromFrame: (id) =>
      set((state) => {
        const obj = state.objects[id]
        if (!obj || (obj.type !== 'image' && obj.type !== 'video')) return state
        const frame = obj as ImageObject | VideoObject
        // A standalone frame with no media IS a shape — collapsing to one keeps a
        // single empty state (and a single "+ Image / + Video" UI) instead of two
        // near-identical ones. Grid cells are the exception: a cell must stay an
        // isEmpty frame or the grid loses the slot.
        const replacement = frame.parentGroupId
          ? frameToEmptyImage(frame, id)
          : buildShapeFromFrame(frame, id)
        return idPreservingSwapState(state, id, replacement) ?? state
      }),

    setShowFrameSettings: (v) => set((state) => ({ showFrameSettings: typeof v === 'function' ? v(state.showFrameSettings) : v })),
    setExportOpen: (v) => set((state) => ({ exportOpen: typeof v === 'function' ? v(state.exportOpen) : v })),

    toggleVideoPlay: (id) =>
      set((state) => {
        const next = new Set(state.videoPlayingIds)
        if (next.has(id)) {
          next.delete(id)
        } else {
          next.add(id)
        }
        return { videoPlayingIds: next }
      }),

    moveObject: (id, dx, dy) =>
      set((state) => {
        const obj = state.objects[id]
        if (!obj) return state
        let moved: CanvasObject
        if (obj.type === 'shape') {
          const s = obj as ShapeObject
          moved = { ...s, x: s.x + dx, y: s.y + dy,
            ...(s.x2 !== undefined ? { x2: s.x2 + dx, y2: (s.y2 ?? s.y) + dy } : {}) } as CanvasObject
        } else if (obj.type === 'path') {
          const p = obj as PathObject
          moved = { ...p, x: p.x + dx, y: p.y + dy,
            anchors: p.anchors.map((a) => ({ ...a, x: a.x + dx, y: a.y + dy })) } as CanvasObject
        } else if (obj.type === 'image') {
          const img = obj as ImageObject
          moved = { ...img, x: img.x + dx, y: img.y + dy,
            frameX: img.frameX + dx, frameY: img.frameY + dy } as CanvasObject
        } else {
          moved = { ...obj, x: obj.x + dx, y: obj.y + dy } as CanvasObject
        }
        return {
          past: pushHistoryFrom(state),
          future: [],
          objects: { ...state.objects, [id]: moved },
        }
      }),

    setContextMenu: (menuState) => set({ contextMenu: menuState }),

    setActiveShapeKind: (kind) => set({ activeShapeKind: kind }),

    setTextEditing: (id) => set({ textEditingId: id, textSelection: null }),

    setTextSelection: (range) => set({ textSelection: range }),

    setCaptureTextSelection: (fn) => set({ captureTextSelection: fn }),

    loadProject: (project) =>
      set(() => {
        // Migrate old TextObjects that used a flat `text` field instead of `spans`
        const migratedObjects: Record<string, CanvasObject> = {}
        for (const [id, obj] of Object.entries(project.objects)) {
          if (obj.type === 'text') {
            const t = obj as TextObject & { text?: string }
            if (!t.spans || t.spans.length === 0) {
              migratedObjects[id] = {
                ...t,
                spans: [{ text: t.text ?? '' }],
              } as TextObject
            } else {
              migratedObjects[id] = obj
            }
          } else if (obj.type === 'image') {
            // Strip legacy mask fields (deleted in the media-frame migration).
            const { mask: _mask, maskEditMode: _maskEdit, ...img } =
              obj as ImageObject & { mask?: unknown; maskEditMode?: boolean }
            migratedObjects[id] = {
              ...img,
              clipEditMode: false,
            } as ImageObject
          } else if (obj.type === 'video') {
            const { mask: _mask, maskEditMode: _maskEdit, ...vid } =
              obj as VideoObject & { mask?: unknown; maskEditMode?: boolean }
            migratedObjects[id] = {
              ...vid,
              clipEditMode: false,
            } as VideoObject
          } else {
            migratedObjects[id] = obj
          }
        }
        // Opt #1: rebuild vault from loaded objects
        const nextVault = new Map<string, { src: string; originalSrc?: string }>()
        for (const [id, obj] of Object.entries(migratedObjects)) {
          if (obj.type === 'image') {
            const img = obj as ImageObject
            if (img.src) nextVault.set(id, { src: img.src, originalSrc: img.originalSrc })
          }
        }
        return {
          objects: migratedObjects,
          objectOrder: project.objectOrder,
          frameCount: project.frameCount,
          platform: project.platform ?? 'instagram',
          ratio: project.ratio,
          frameWidth: project.dimensions.width,
          frameHeight: project.dimensions.height,
          frames: project.frames,
          backgroundColor: project.backgroundColor,
          selectedId: null,
          selectedIds: [],
          anchorId: null,
          contextMenu: null,
          activeTool: 'select',
          textEditingId: null,
          textSelection: null,
          past: [],
          future: [],
          _srcVault: nextVault,
          _openEditModeCount: 0,
        }
      }),

    newProject: (spec) =>
      set(() => ({
        objects: {},
        objectOrder: [],
        frameCount: spec.frameCount,
        platform: spec.platform,
        ratio: spec.ratio,
        frameWidth: spec.width,
        frameHeight: spec.height,
        frames: makeFrames(spec.frameCount),
        backgroundColor: '#ffffff',
        selectedId: null,
        selectedIds: [],
        anchorId: null,
        contextMenu: null,
        activeTool: 'select',
        penDrawingId: null,
        textEditingId: null,
        textSelection: null,
        past: [],
        future: [],
        _dragStartObjects: null,
        _srcVault: new Map(),
        _openEditModeCount: 0,
      })),

    selectAll: () =>
      set((state) => {
        const ids = state.objectOrder.filter((id) => {
          const obj = state.objects[id]
          return obj && obj.visible && !obj.locked
        })
        return {
          selectedIds: ids,
          selectedId: ids.length > 0 ? ids[ids.length - 1] : null,
          anchorId: null,
        }
      }),

    bringForward: (id) =>
      set((state) => {
        const order = [...state.objectOrder]
        const idx = order.indexOf(id)
        if (idx === -1 || idx === order.length - 1) return state
        // Swap with next
        const temp = order[idx + 1]
        order[idx + 1] = order[idx]
        order[idx] = temp
        return {
          past: pushHistoryFrom(state),
          future: [],
          objectOrder: order,
        }
      }),

    sendBackward: (id) =>
      set((state) => {
        const order = [...state.objectOrder]
        const idx = order.indexOf(id)
        if (idx === -1 || idx === 0) return state
        // Swap with previous
        const temp = order[idx - 1]
        order[idx - 1] = order[idx]
        order[idx] = temp
        return {
          past: pushHistoryFrom(state),
          future: [],
          objectOrder: order,
        }
      }),

    bringToFront: (id) =>
      set((state) => {
        const order = [...state.objectOrder]
        const idx = order.indexOf(id)
        if (idx === -1 || idx === order.length - 1) return state
        order.splice(idx, 1)
        order.push(id)
        return {
          past: pushHistoryFrom(state),
          future: [],
          objectOrder: order,
        }
      }),

    sendToBack: (id) =>
      set((state) => {
        const order = [...state.objectOrder]
        const idx = order.indexOf(id)
        if (idx === -1 || idx === 0) return state
        order.splice(idx, 1)
        order.unshift(id)
        return {
          past: pushHistoryFrom(state),
          future: [],
          objectOrder: order,
        }
      }),

    duplicateObject: (id, offsetX = 10, offsetY = 10) =>
      set((state) => {
        const obj = state.objects[id]
        if (!obj) return state
        const newId = crypto.randomUUID()
        const duplicate = cloneObjectAt(obj, newId, {
          x: obj.x + offsetX,
          y: obj.y + offsetY,
        })
        // Insert duplicate right after the source in objectOrder
        const srcIdx = state.objectOrder.indexOf(id)
        const newOrder = [...state.objectOrder]
        newOrder.splice(srcIdx + 1, 0, newId)

        const nextVault = vaultWithClone(state._srcVault, duplicate)

        return {
          past: pushHistoryFrom(state),
          future: [],
          objects: { ...state.objects, [newId]: duplicate },
          objectOrder: newOrder,
          _srcVault: nextVault,
        }
      }),

    duplicateObjectAtOrigin: (id, originPos, finalPos) =>
      set((state) => {
        const obj = state.objects[id]
        if (!obj) return state
        const newId = crypto.randomUUID()

        // Callers pass frame coords for media and base coords for everything
        // else; the two are mirrored, so normalize to one point either way.
        const toPoint = (
          p: { x: number; y: number } | { frameX: number; frameY: number },
        ): { x: number; y: number } =>
          'frameX' in p ? { x: p.frameX, y: p.frameY } : p

        const clone = cloneObjectAt(obj, newId, toPoint(originPos))
        const updatedSource = repositionObject(obj, toPoint(finalPos))

        // Insert clone right before the source in objectOrder
        const srcIdx = state.objectOrder.indexOf(id)
        const newOrder = [...state.objectOrder]
        newOrder.splice(srcIdx, 0, newId)

        const nextVault = vaultWithClone(state._srcVault, clone)

        return {
          past: pushHistoryFrom(state),
          future: [],
          objects: {
            ...state.objects,
            [id]: updatedSource,
            [newId]: clone,
          },
          objectOrder: newOrder,
          _srcVault: nextVault,
        }
      }),

    pasteObjects: (incoming, target) =>
      set((state) => {
        if (incoming.length === 0) return state

        // Centre the pasted set's bounding box on the target point, so a
        // multi-object paste keeps its internal arrangement.
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        for (const obj of incoming) {
          const b = getObjectBBox(obj)
          minX = Math.min(minX, b.x)
          minY = Math.min(minY, b.y)
          maxX = Math.max(maxX, b.x + b.width)
          maxY = Math.max(maxY, b.y + b.height)
        }
        const dx = target.x - (minX + maxX) / 2
        const dy = target.y - (minY + maxY) / 2

        // Two passes: assign every new id first, so a group's childIds and a
        // cell's parentGroupId can be remapped to ids that all exist. A link
        // pointing outside the pasted set is dropped rather than left dangling —
        // a cell whose group was not copied would otherwise be unselectable.
        const idMap = new Map<string, string>()
        for (const obj of incoming) idMap.set(obj.id, crypto.randomUUID())

        const pasted: Record<string, CanvasObject> = {}
        const newIds: string[] = []
        let nextVault = state._srcVault

        for (const obj of incoming) {
          const newId = idMap.get(obj.id)!
          let clone = cloneObjectAt(obj, newId, { x: obj.x + dx, y: obj.y + dy })
          if (clone.type === 'group') {
            const group = clone as GroupObject
            clone = {
              ...group,
              childIds: group.childIds.map((c) => idMap.get(c)).filter((c): c is string => !!c),
            }
          }
          if (clone.parentGroupId) {
            clone = { ...clone, parentGroupId: idMap.get(clone.parentGroupId) } as CanvasObject
          }
          clone = { ...clone, zIndex: state.objectOrder.length + newIds.length } as CanvasObject
          nextVault = vaultWithClone(nextVault, clone)
          pasted[newId] = clone
          newIds.push(newId)
        }

        return {
          past: pushHistoryFrom(state),
          future: [],
          objects: { ...state.objects, ...pasted },
          objectOrder: [...state.objectOrder, ...newIds],
          _srcVault: nextVault,
          selectedId: newIds.length === 1 ? newIds[0] : null,
          selectedIds: newIds,
          anchorId: null,
        }
      }),

    addGrid: (template, canvasX, canvasY) =>
      set((state) => {
        const { frameWidth, frameHeight } = state
        const groupW = frameWidth
        const groupH = frameHeight
        const gap = 8
        const cells = template.cells(groupW, groupH, gap)

        const groupId = crypto.randomUUID()
        const cellIds = cells.map(() => crypto.randomUUID())

        const group: GroupObject = {
          id: groupId,
          type: 'group',
          childIds: cellIds,
          isGrid: true,
          gridGap: gap,
          gridTemplateId: template.id,
          x: canvasX,
          y: canvasY,
          width: groupW,
          height: groupH,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          opacity: 1,
          visible: true,
          locked: false,
          scope: 'global',
          zIndex: 0,
        }

        const cellsById: Record<string, CanvasObject> = {}
        cells.forEach((cell, i) => {
          const cellId = cellIds[i]
          cellsById[cellId] = makeEmptyCell(cellId, groupId, {
            x: canvasX + cell.x,
            y: canvasY + cell.y,
            w: cell.w,
            h: cell.h,
          }, { clipShape: template.cellClipShape })
        })

        // isEmpty cells have no src — no vault entries needed
        return {
          past: pushHistoryFrom(state),
          future: [],
          objects: { ...state.objects, [groupId]: group, ...cellsById },
          objectOrder: [...state.objectOrder, groupId, ...cellIds],
        }
      }),

    disconnectGridCell: (cellId) =>
      set((state) => {
        const cell = state.objects[cellId]
        if (!cell?.parentGroupId) return state

        const updatedObjects = { ...state.objects }
        const emptiedGroupId = detachCellFromParent(updatedObjects, cellId, cell.parentGroupId)

        // A standalone object with no media IS a shape — there is exactly ONE empty
        // state. Leaving a disconnected empty cell as an isEmpty frame would create
        // the second one, complete with a floating "+ image / + video" CTA where the
        // user expects a shape.
        //
        // Built inline rather than through swapObjectPreservingId: that helper
        // deliberately re-attaches parentGroupId from the OLD object, which is the
        // exact field disconnect exists to clear — layering it on top would silently
        // re-parent the cell. Doing both here also keeps disconnect one undo step.
        const replacement = isEmptyFrame(cell) ? buildShapeFromFrame(cell, cellId) : cell
        updatedObjects[cellId] = { ...replacement, parentGroupId: undefined }

        const countDelta =
          (isInEditMode(cell) ? 1 : 0) - (isInEditMode(updatedObjects[cellId]) ? 1 : 0)

        return {
          past: pushHistoryFrom(state),
          future: [],
          objects: updatedObjects,
          ...(emptiedGroupId
            ? {
                objectOrder: state.objectOrder.filter((oid) => oid !== emptiedGroupId),
                selectedId: state.selectedId === emptiedGroupId ? null : state.selectedId,
                selectedIds: state.selectedIds.filter((sid) => sid !== emptiedGroupId),
                anchorId: state.anchorId === emptiedGroupId ? null : state.anchorId,
              }
            : {}),
          _openEditModeCount: state._openEditModeCount - countDelta,
        }
      }),
  }
})
