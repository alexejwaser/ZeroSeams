import { create } from 'zustand'
import type { CanvasObject, ImageObject, GroupObject, ShapeObject, PathObject, ShapeKind, TextObject, MaskData, VideoObject, GuidelineObject } from '@/types/canvas'
import type { GridTemplate } from './gridTemplates'
import type { Frame, FrameRatio, Platform, CarouselProject } from '@/types/project'

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

type HistorySnapshot = Pick<
  CanvasState,
  'objects' | 'objectOrder' | 'ratio' | 'frameWidth' | 'frameHeight' | 'frames' | 'backgroundColor' | 'frameCount'
>

const MAX_HISTORY = 50

function makeFrames(count: number): Frame[] {
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
// Opt #2 helper — edit-mode detection for a single object
// ---------------------------------------------------------------------------
function isInEditMode(obj: CanvasObject): boolean {
  if (obj.type === 'image') return !!(obj as ImageObject).contentEditMode || !!(obj as ImageObject).maskEditMode
  if (obj.type === 'video') return !!(obj as VideoObject).contentEditMode || !!(obj as VideoObject).maskEditMode
  if (obj.type === 'path') return !!(obj as PathObject).pathEditMode
  return false
}

// ---------------------------------------------------------------------------
// Opt #1 helper — re-inject src/originalSrc into snapshot objects after undo/redo.
// NOTE: this means background-removal src changes are not undoable at the pixel
// level — the vault always holds the current (newest) src. Acceptable because
// background removal is not yet wired to the history system.
// ---------------------------------------------------------------------------
function reinjectSrc(
  objects: Record<string, CanvasObject>,
  vault: Map<string, { src: string; originalSrc?: string }>
): Record<string, CanvasObject> {
  const result: Record<string, CanvasObject> = {}
  for (const [id, obj] of Object.entries(objects)) {
    if (obj.type === 'image') {
      const v = vault.get(id)
      if (v) {
        result[id] = { ...obj, src: v.src, originalSrc: v.originalSrc } as CanvasObject
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
  activeTool: 'select' | 'text' | 'shape' | 'pen' | 'guideline'
  guidelineOrientation: 'horizontal' | 'vertical'
  guidelinesVisible: boolean
  resizeMode: 'advanced' | 'auto'
  setResizeMode: (mode: 'advanced' | 'auto') => void
  snapEnabled: boolean
  toggleSnap: () => void
  adjustmentsBypass: boolean
  setAdjustmentsBypass: (v: boolean) => void
  toggleAdjustmentsBypass: () => void
  previewMode: boolean
  previewFrame: number        // 0-based index of frame shown in preview
  togglePreviewMode: () => void
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
  setActiveTool: (tool: 'select' | 'text' | 'shape' | 'pen' | 'guideline') => void
  setGuidelineOrientation: (orientation: 'horizontal' | 'vertical') => void
  toggleGuidelinesVisible: () => void
  reorderObjects: (fromId: string, toId: string, side: 'before' | 'after') => void
  toggleLock: (id: string) => void
  alignObjects: (anchor: 'left' | 'right' | 'top' | 'bottom' | 'centerH' | 'centerV') => void
  distributeObjects: (axis: 'horizontal' | 'vertical') => void
  setRatio: (r: FrameRatio, width: number, height: number) => void
  setPlatform: (p: Platform) => void
  setFrameBackground: (frameIndex: number, color: string | null) => void
  setCanvasBackground: (color: string) => void
  undo: () => void
  redo: () => void
  clearContentEditMode: () => void
  clearPathEditMode: () => void
  clearMaskEditMode: () => void
  enterMaskEditMode: (id: string) => void
  maskDrawMode: { id: string; tool: 'pen' | 'rect' | 'ellipse' } | null
  enterMaskDrawMode: (id: string, tool: 'pen' | 'rect' | 'ellipse') => void
  clearMaskDrawMode: () => void
  /** Transient flag — true when the selected object is an image (enables mask-draw interception). Not stored in history. */
  maskModeActive: boolean
  setMaskModeActive: (v: boolean) => void
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
  addGrid: (template: GridTemplate, canvasX: number, canvasY: number) => void
  replaceGridCell: (cellId: string, replacement: CanvasObject) => void
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
// ---------------------------------------------------------------------------
function normalizeObjectsForSnapshot(
  objects: Record<string, CanvasObject>,
  hasOpenEditModes: boolean
): Record<string, CanvasObject> {
  let changed = false
  const result: Record<string, CanvasObject> = {}
  for (const [id, obj] of Object.entries(objects)) {
    if (obj.type === 'image') {
      const img = obj as ImageObject
      const clearModes = hasOpenEditModes && (img.contentEditMode || img.maskEditMode)
      // src is always non-empty on live objects, so this branch always fires for images
      result[id] = {
        ...img,
        contentEditMode: clearModes ? false : img.contentEditMode,
        maskEditMode: clearModes ? false : img.maskEditMode,
        src: '',
        originalSrc: undefined,
      } as CanvasObject
      changed = true
    } else if (obj.type === 'video') {
      const vid = obj as VideoObject
      if (hasOpenEditModes && (vid.contentEditMode || vid.maskEditMode)) {
        result[id] = { ...vid, contentEditMode: false, maskEditMode: false } as CanvasObject
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
    adjustmentsBypass: false,
    previewMode: false,
    previewFrame: 0,
    past: [],
    future: [],
    contextMenu: null,
    activeShapeKind: 'rect',
    textEditingId: null,
    textSelection: null,
    captureTextSelection: null,
    maskDrawMode: null,
    maskModeActive: false,
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
          const placeholder: ImageObject = {
            ...cell,
            isEmpty: true,
            src: '',
            naturalWidth: 0, naturalHeight: 0,
            contentWidth: 0, contentHeight: 0,
            contentOffsetX: 0, contentOffsetY: 0,
            contentEditMode: false,
            maskEditMode: false,
            adjustments: undefined,
            mask: undefined,
          }
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
          const placeholder: ImageObject = {
            id: cell.id,
            type: 'image',
            isEmpty: true,
            parentGroupId: cell.parentGroupId,
            src: '',
            frameX: cell.frameX, frameY: cell.frameY,
            frameWidth: cell.frameWidth, frameHeight: cell.frameHeight,
            x: cell.x, y: cell.y, width: cell.width, height: cell.height,
            naturalWidth: 0, naturalHeight: 0,
            contentWidth: 0, contentHeight: 0,
            contentOffsetX: 0, contentOffsetY: 0,
            contentEditMode: false, maskEditMode: false,
            backgroundRemoved: false,
            rotation: cell.rotation, scaleX: cell.scaleX, scaleY: cell.scaleY,
            opacity: cell.opacity, visible: cell.visible, locked: cell.locked,
            scope: cell.scope, zIndex: cell.zIndex,
          }
          return {
            past: pushHistoryFrom(state),
            future: [],
            objects: { ...state.objects, [id]: placeholder },
            selectedId: state.selectedId === id ? null : state.selectedId,
            selectedIds: state.selectedIds.filter((sid) => sid !== id),
            _openEditModeCount: state._openEditModeCount - (isInEditMode(cell) ? 1 : 0),
          }
        }
        const { [id]: _removed, ...rest } = state.objects
        // Opt #1: remove from vault
        let nextVault = state._srcVault
        if (state._srcVault.has(id)) {
          nextVault = new Map(state._srcVault)
          nextVault.delete(id)
        }
        // Opt #2: decrement count if removed object was in edit mode
        const removedInEditMode = existing ? isInEditMode(existing) : false
        return {
          past: pushHistoryFrom(state),
          future: [],
          objects: rest,
          objectOrder: state.objectOrder.filter((oid) => oid !== id),
          selectedId: state.selectedId === id ? null : state.selectedId,
          selectedIds: state.selectedIds.filter((sid) => sid !== id),
          anchorId: state.anchorId === id ? null : state.anchorId,
          _srcVault: nextVault,
          _openEditModeCount: state._openEditModeCount - (removedInEditMode ? 1 : 0),
        }
      }),

    setSelected: (id) =>
      set((state) => ({
        selectedId: id,
        selectedIds: id !== null ? [id] : [],
        anchorId: null,
        maskModeActive: id !== null && state.objects[id]?.type === 'image',
      })),

    addToSelection: (id) =>
      set((state) => {
        const already = state.selectedIds.includes(id)
        if (already) {
          const newIds = state.selectedIds.filter((sid) => sid !== id)
          return {
            selectedIds: newIds,
            selectedId: newIds.length > 0 ? newIds[newIds.length - 1] : null,
            anchorId: state.anchorId === id ? null : state.anchorId,
          }
        }
        return {
          selectedIds: [...state.selectedIds, id],
          // Set selectedId when coming from empty selection so properties panel shows something
          selectedId: state.selectedId ?? id,
        }
      }),

    setSelectedIds: (ids) =>
      set({
        selectedIds: ids,
        selectedId: ids.length > 0 ? ids[ids.length - 1] : null,
        anchorId: null,
      }),

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
        const idSet = new Set(ids)
        const updatedObjects = { ...state.objects }
        // Opt #1 + #2: process removals
        let nextVault = state._srcVault
        let editModeRemoved = 0
        for (const id of ids) {
          const obj = state.objects[id]
          if (obj) {
            if (isInEditMode(obj)) editModeRemoved++
          }
          delete updatedObjects[id]
          if (state._srcVault.has(id)) {
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
        const clamped = Math.max(1, Math.min(10, n))
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
    setAdjustmentsBypass: (v) => set({ adjustmentsBypass: v }),
    toggleAdjustmentsBypass: () => set((s) => ({ adjustmentsBypass: !s.adjustmentsBypass })),
    togglePreviewMode: () => set((s) => ({ previewMode: !s.previewMode, previewFrame: 0 })),
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
        if (!changed) return { maskDrawMode: null }
        return { objects: updated, maskDrawMode: null, _openEditModeCount: 0 }
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
        if (!changed) return { maskDrawMode: null }
        return { objects: updated, maskDrawMode: null, _openEditModeCount: 0 }
      }),

    clearMaskEditMode: () =>
      set((state) => {
        const updated: Record<string, CanvasObject> = {}
        let changed = false
        for (const [id, obj] of Object.entries(state.objects)) {
          if ((obj.type === 'image' || obj.type === 'video') && (obj as ImageObject | VideoObject).maskEditMode) {
            updated[id] = { ...obj, maskEditMode: false } as CanvasObject
            changed = true
          } else {
            updated[id] = obj
          }
        }
        if (!changed) return { maskDrawMode: null }
        return { objects: updated, maskDrawMode: null, _openEditModeCount: 0 }
      }),

    enterMaskEditMode: (id) =>
      set((state) => {
        const updated: Record<string, CanvasObject> = {}
        for (const [oid, obj] of Object.entries(state.objects)) {
          if (obj.type === 'image' || obj.type === 'video') {
            updated[oid] = {
              ...obj,
              contentEditMode: false,
              maskEditMode: oid === id,
            } as CanvasObject
          } else {
            updated[oid] = obj
          }
        }
        // Exactly one object is now in maskEditMode
        return { objects: updated, maskDrawMode: null, _openEditModeCount: 1 }
      }),

    enterMaskDrawMode: (id, tool) =>
      set((state) => {
        const updated: Record<string, CanvasObject> = {}
        for (const [oid, obj] of Object.entries(state.objects)) {
          if (obj.type === 'image' || obj.type === 'video') {
            updated[oid] = { ...obj, contentEditMode: false, maskEditMode: false } as CanvasObject
          } else if (obj.type === 'path') {
            updated[oid] = { ...(obj as PathObject), pathEditMode: false } as CanvasObject
          } else {
            updated[oid] = obj
          }
        }
        return { objects: updated, maskDrawMode: { id, tool }, _openEditModeCount: 0 }
      }),

    clearMaskDrawMode: () => set({ maskDrawMode: null }),

    setMaskModeActive: (v) => set({ maskModeActive: v }),

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
            const img = obj as ImageObject & { maskEditMode?: boolean }
            migratedObjects[id] = {
              ...img,
              maskEditMode: img.maskEditMode ?? false,
            } as ImageObject
          } else if (obj.type === 'video') {
            const vid = obj as VideoObject
            migratedObjects[id] = {
              ...vid,
              maskEditMode: vid.maskEditMode ?? false,
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
        let duplicate: CanvasObject
        if (obj.type === 'image') {
          const img = obj as ImageObject
          duplicate = {
            ...img,
            id: newId,
            name: undefined,
            contentEditMode: false,
            maskEditMode: false,
            frameX: img.frameX + offsetX,
            frameY: img.frameY + offsetY,
            x: img.x + offsetX,
            y: img.y + offsetY,
          }
        } else {
          duplicate = {
            ...obj,
            id: newId,
            name: undefined,
            x: obj.x + offsetX,
            y: obj.y + offsetY,
          } as CanvasObject
          if (obj.type === 'shape') {
            const s = obj as ShapeObject
            if ((s.kind === 'line' || s.kind === 'arrow') && s.x2 !== undefined) {
              duplicate = { ...duplicate, x2: s.x2 + offsetX, y2: (s.y2 ?? s.y) + offsetY } as CanvasObject
            }
          }
        }
        // Insert duplicate right after the source in objectOrder
        const srcIdx = state.objectOrder.indexOf(id)
        const newOrder = [...state.objectOrder]
        newOrder.splice(srcIdx + 1, 0, newId)

        // Opt #1: seed vault for duplicated image
        let nextVault = state._srcVault
        if (duplicate.type === 'image') {
          const img = duplicate as ImageObject
          if (img.src) {
            nextVault = new Map(state._srcVault)
            nextVault.set(newId, { src: img.src, originalSrc: img.originalSrc })
          }
        }

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

        // Build the clone that stays at originPos
        let clone: CanvasObject
        if (obj.type === 'image') {
          const img = obj as ImageObject
          const op = originPos as { frameX: number; frameY: number }
          clone = {
            ...img,
            id: newId,
            name: undefined,
            contentEditMode: false,
            maskEditMode: false,
            frameX: op.frameX,
            frameY: op.frameY,
            x: op.frameX,
            y: op.frameY,
          }
        } else {
          const op = originPos as { x: number; y: number }
          clone = {
            ...obj,
            id: newId,
            name: undefined,
            x: op.x,
            y: op.y,
          } as CanvasObject
        }

        // Update the source object to finalPos
        let updatedSource: CanvasObject
        if (obj.type === 'image') {
          const img = obj as ImageObject
          const fp = finalPos as { frameX: number; frameY: number }
          updatedSource = {
            ...img,
            frameX: fp.frameX,
            frameY: fp.frameY,
            x: fp.frameX,
            y: fp.frameY,
          }
        } else {
          const fp = finalPos as { x: number; y: number }
          updatedSource = {
            ...obj,
            x: fp.x,
            y: fp.y,
          } as CanvasObject
        }

        // Insert clone right before the source in objectOrder
        const srcIdx = state.objectOrder.indexOf(id)
        const newOrder = [...state.objectOrder]
        newOrder.splice(srcIdx, 0, newId)

        // Opt #1: seed vault for cloned image
        let nextVault = state._srcVault
        if (clone.type === 'image') {
          const img = clone as ImageObject
          if (img.src) {
            nextVault = new Map(state._srcVault)
            nextVault.set(newId, { src: img.src, originalSrc: img.originalSrc })
          }
        }

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
          const img: ImageObject = {
            id: cellId,
            type: 'image',
            isEmpty: true,
            parentGroupId: groupId,
            src: '',
            backgroundRemoved: false,
            frameX: canvasX + cell.x,
            frameY: canvasY + cell.y,
            frameWidth: cell.w,
            frameHeight: cell.h,
            x: canvasX + cell.x,
            y: canvasY + cell.y,
            width: cell.w,
            height: cell.h,
            contentOffsetX: 0,
            contentOffsetY: 0,
            contentWidth: 0,
            contentHeight: 0,
            naturalWidth: 0,
            naturalHeight: 0,
            contentEditMode: false,
            maskEditMode: false,
            rotation: 0,
            opacity: 1,
            visible: true,
            locked: false,
            scaleX: 1,
            scaleY: 1,
            scope: 'global',
            zIndex: 0,
          }
          cellsById[cellId] = img
        })

        // isEmpty cells have no src — no vault entries needed
        return {
          past: pushHistoryFrom(state),
          future: [],
          objects: { ...state.objects, [groupId]: group, ...cellsById },
          objectOrder: [...state.objectOrder, groupId, ...cellIds],
        }
      }),

    replaceGridCell: (cellId, replacement) =>
      set((state) => {
        // Find the parent group that owns this cell
        const parentGroup = Object.values(state.objects).find(
          (o) => o.type === 'group' && (o as GroupObject).childIds.includes(cellId),
        ) as GroupObject | undefined

        // Propagate parentGroupId from the old cell so filled cells still route clicks to group
        const oldCell = state.objects[cellId]
        const parentGroupId = (oldCell as ImageObject | undefined)?.parentGroupId ?? parentGroup?.id
        const replacementWithParent: CanvasObject =
          parentGroupId ? { ...replacement, parentGroupId } as CanvasObject : replacement

        const updatedObjects = { ...state.objects }
        delete updatedObjects[cellId]
        updatedObjects[replacementWithParent.id] = replacementWithParent

        // Splice the new id into the parent group's childIds at the same position
        if (parentGroup) {
          const idx = parentGroup.childIds.indexOf(cellId)
          const newChildIds = [...parentGroup.childIds]
          newChildIds[idx] = replacementWithParent.id
          updatedObjects[parentGroup.id] = { ...parentGroup, childIds: newChildIds }
        }

        // Replace cellId with replacementWithParent.id in objectOrder
        const newOrder = state.objectOrder.map((id) => (id === cellId ? replacementWithParent.id : id))

        // Update src vault for image replacements (keeps base64 out of history snapshots)
        let nextVault = state._srcVault
        if (replacementWithParent.type === 'image') {
          const img = replacementWithParent as ImageObject
          nextVault = new Map(state._srcVault)
          nextVault.set(replacementWithParent.id, { src: img.src, originalSrc: img.originalSrc })
        }

        return {
          past: pushHistoryFrom(state),
          future: [],
          objects: updatedObjects,
          objectOrder: newOrder,
          _srcVault: nextVault,
        }
      }),

    disconnectGridCell: (cellId) =>
      set((state) => {
        const cell = state.objects[cellId]
        if (!cell?.parentGroupId) return state

        const parentGroup = state.objects[cell.parentGroupId] as GroupObject | undefined
        const updatedObjects = { ...state.objects }

        // Remove cell from parent group's childIds
        if (parentGroup) {
          updatedObjects[parentGroup.id] = {
            ...parentGroup,
            childIds: parentGroup.childIds.filter((cid) => cid !== cellId),
          }
        }

        // Clear parentGroupId on the cell so it becomes a standalone object
        updatedObjects[cellId] = { ...cell, parentGroupId: undefined }

        return {
          past: pushHistoryFrom(state),
          future: [],
          objects: updatedObjects,
        }
      }),
  }
})
