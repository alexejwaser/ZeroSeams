import { create } from 'zustand'
import type { CanvasObject, ImageObject, ShapeObject, PathObject, ShapeKind, TextObject, MaskData, VideoObject } from '@/types/canvas'
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
  if (obj.type === 'image') {
    const img = obj as ImageObject
    return { x: img.frameX, y: img.frameY, width: img.frameWidth, height: img.frameHeight }
  }
  return { x: obj.x, y: obj.y, width: obj.width, height: obj.height }
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
  activeTool: 'select' | 'text' | 'shape' | 'pen'
  resizeMode: 'advanced' | 'auto'
  setResizeMode: (mode: 'advanced' | 'auto') => void
  snapEnabled: boolean
  toggleSnap: () => void
  adjustmentsBypass: boolean
  setAdjustmentsBypass: (v: boolean) => void
  toggleAdjustmentsBypass: () => void
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
  commitUpdate: (id: string, patch: Partial<CanvasObject>) => void
  removeObject: (id: string) => void
  setSelected: (id: string | null) => void
  addToSelection: (id: string) => void
  setSelectedIds: (ids: string[]) => void
  setAnchor: (id: string | null) => void
  commitMultipleUpdates: (patches: Record<string, Partial<CanvasObject>>) => void
  removeMultipleObjects: (ids: string[]) => void
  setFrameCount: (n: number) => void
  setActiveTool: (tool: 'select' | 'text' | 'shape' | 'pen') => void
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
  /** Transient — captures pre-drag object state so commitUpdate can save the correct pre-drag snapshot. Not in history. */
  _dragStartObjects: Record<string, CanvasObject> | null
  /** Call onMouseDown before any updateObject drag calls. commitUpdate will use this snapshot for the history entry. */
  startDrag: () => void
  /** Transient — set of VideoObject ids currently playing. Not in history. */
  videoPlayingIds: Set<string>
  /** Toggle play/pause for a video object. */
  toggleVideoPlay: (id: string) => void
}

function normalizeObjectsForSnapshot(objects: Record<string, CanvasObject>): Record<string, CanvasObject> {
  let changed = false
  const result: Record<string, CanvasObject> = {}
  for (const [id, obj] of Object.entries(objects)) {
    if (obj.type === 'image') {
      const img = obj as ImageObject
      if (img.contentEditMode || img.maskEditMode) {
        result[id] = { ...img, contentEditMode: false, maskEditMode: false }
        changed = true
        continue
      }
    } else if (obj.type === 'video') {
      const vid = obj as VideoObject
      if (vid.contentEditMode || vid.maskEditMode) {
        result[id] = { ...vid, contentEditMode: false, maskEditMode: false }
        changed = true
        continue
      }
    } else if (obj.type === 'path') {
      const p = obj as PathObject
      if (p.pathEditMode) {
        result[id] = { ...p, pathEditMode: false }
        changed = true
        continue
      }
    }
    result[id] = obj
  }
  return changed ? result : objects
}

export const useCanvasStore = create<CanvasState>((set) => {
  function pushHistoryFrom(
    state: Pick<CanvasState, 'objects' | 'objectOrder' | 'ratio' | 'frameWidth' | 'frameHeight' | 'frames' | 'backgroundColor' | 'frameCount' | 'past'>
  ): HistorySnapshot[] {
    const snapshot: HistorySnapshot = {
      objects: normalizeObjectsForSnapshot(state.objects),
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
    resizeMode: 'auto',
    snapEnabled: true,
    adjustmentsBypass: false,
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

    addObject: (obj) => {
      let normalized = obj
      if (obj.type === 'shape') {
        const s = obj as ShapeObject
        if ((s.kind === 'line' || s.kind === 'arrow') && s.x2 === undefined) {
          normalized = { ...s, x2: s.x + s.width, y2: s.y + s.height } as CanvasObject
        }
      }
      return set((state) => ({
        past: pushHistoryFrom(state),
        future: [],
        objects: { ...state.objects, [normalized.id]: normalized },
        objectOrder: [...state.objectOrder, normalized.id],
      }))
    },

    updateObject: (id, patch) =>
      set((state) => {
        const existing = state.objects[id]
        if (!existing) return state
        return {
          objects: {
            ...state.objects,
            [id]: { ...existing, ...patch } as CanvasObject,
          },
        }
      }),

    commitUpdate: (id, patch) =>
      set((state) => {
        const existing = state.objects[id]
        if (!existing) return state
        // Use pre-drag snapshot when available so undo reaches the state before the drag started,
        // not the live-preview-mutated state that updateObject left behind.
        const snapshotObjects = state._dragStartObjects ?? state.objects
        return {
          past: pushHistoryFrom({ ...state, objects: snapshotObjects }),
          future: [],
          _dragStartObjects: null,
          objects: {
            ...state.objects,
            [id]: { ...existing, ...patch } as CanvasObject,
          },
        }
      }),

    startDrag: () =>
      set((state) => ({ _dragStartObjects: state.objects })),

    removeObject: (id) =>
      set((state) => {
        const { [id]: _removed, ...rest } = state.objects
        return {
          past: pushHistoryFrom(state),
          future: [],
          objects: rest,
          objectOrder: state.objectOrder.filter((oid) => oid !== id),
          selectedId: state.selectedId === id ? null : state.selectedId,
          selectedIds: state.selectedIds.filter((sid) => sid !== id),
          anchorId: state.anchorId === id ? null : state.anchorId,
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
        for (const [id, patch] of Object.entries(patches)) {
          const existing = state.objects[id]
          if (!existing) continue
          updatedObjects[id] = { ...existing, ...patch } as CanvasObject
        }
        return { past: pushHistoryFrom(state), future: [], objects: updatedObjects }
      }),

    removeMultipleObjects: (ids) =>
      set((state) => {
        const idSet = new Set(ids)
        const updatedObjects = { ...state.objects }
        for (const id of ids) {
          delete updatedObjects[id]
        }
        return {
          past: pushHistoryFrom(state),
          future: [],
          objects: updatedObjects,
          objectOrder: state.objectOrder.filter((oid) => !idSet.has(oid)),
          selectedId: idSet.has(state.selectedId ?? '') ? null : state.selectedId,
          selectedIds: state.selectedIds.filter((sid) => !idSet.has(sid)),
          anchorId: idSet.has(state.anchorId ?? '') ? null : state.anchorId,
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

    setResizeMode: (mode) => set({ resizeMode: mode }),

    toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),
    setAdjustmentsBypass: (v) => set({ adjustmentsBypass: v }),
    toggleAdjustmentsBypass: () => set((s) => ({ adjustmentsBypass: !s.adjustmentsBypass })),

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
          objects: state.objects,
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
          objects: previous.objects,
          objectOrder: previous.objectOrder,
          ratio: previous.ratio,
          frameWidth: previous.frameWidth,
          frameHeight: previous.frameHeight,
          frames: previous.frames,
          backgroundColor: previous.backgroundColor,
          frameCount: previous.frameCount,
        }
      }),

    redo: () =>
      set((state) => {
        if (state.future.length === 0) return state
        const next = state.future[0]
        const newFuture = state.future.slice(1)
        const currentSnapshot: HistorySnapshot = {
          objects: state.objects,
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
          objects: next.objects,
          objectOrder: next.objectOrder,
          ratio: next.ratio,
          frameWidth: next.frameWidth,
          frameHeight: next.frameHeight,
          frames: next.frames,
          backgroundColor: next.backgroundColor,
          frameCount: next.frameCount,
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
        return { objects: updated, maskDrawMode: null }
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
        return { objects: updated, maskDrawMode: null }
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
        return { objects: updated, maskDrawMode: null }
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
        return { objects: updated, maskDrawMode: null }
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
        return { objects: updated, maskDrawMode: { id, tool } }
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
        return {
          past: pushHistoryFrom(state),
          future: [],
          objects: { ...state.objects, [newId]: duplicate },
          objectOrder: newOrder,
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

        return {
          past: pushHistoryFrom(state),
          future: [],
          objects: {
            ...state.objects,
            [id]: updatedSource,
            [newId]: clone,
          },
          objectOrder: newOrder,
        }
      }),
  }
})
