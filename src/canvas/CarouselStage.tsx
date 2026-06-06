import React, { useRef, useEffect, useState } from 'react'
import { Stage, Layer, Rect as KonvaRect, Line as KonvaLine, Circle as KonvaCircle, Path as KonvaPath, Ellipse as KonvaEllipse, Transformer } from 'react-konva'
import type Konva from 'konva'
import type { ImageObject, TextObject, ShapeObject, PathObject, AnchorPoint, CanvasObject } from '@/types/canvas'
import type { ShapeKind } from '@/types/canvas'
import { CANVAS_SCALE, axisLock } from './constants'
import { useCanvasStore } from './useCanvasStore'
import { useViewportStore } from './useViewportStore'
import { FrameGuides } from './FrameGuides'
import { CanvasImageNode } from './CanvasImageNode'
import { CanvasTextNode } from './CanvasTextNode'
import { CanvasShapeNode } from './CanvasShapeNode'
import { CanvasPathNode, computePathBBox, anchorsToPathData } from './CanvasPathNode'
import { SnapGuides } from './SnapGuides'
import { useSnapGuides } from './useSnapGuides'
import type { SnapGuide } from './useSnapGuides'
import { useImageDrop } from './useImageDrop'
import { useVideoDrop } from './useVideoDrop'
import { CanvasVideoNode } from './CanvasVideoNode'
import { useAutosave } from './useAutosave'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'
import { useThumbnailGenerator } from './useThumbnailStore'
import '@/canvas/effects'
import { ColorInput } from '@/ui/ColorInput'
import { CanvasGroupNode } from './CanvasGroupNode'
import { GridCellOverlay } from './GridCellOverlay'
import { CanvasGuidelineNode } from './CanvasGuidelineNode'
export { exportFrames } from './exportFrames'

// Module-level mutable reference so external callers can access the stage
// instance without prop drilling (used by useCarouselExport / getStageInstance).
let _stageInstance: Konva.Stage | null = null

export function getStageInstance(): Konva.Stage | null {
  return _stageInstance
}

interface FrameDragState {
  fromIndex: number
  startClientX: number
  currentClientX: number
  containerLeft: number // viewport X of the container at drag start
}

// Returns how many slots frame i should shift during a reorder preview.
function frameSlotOffset(i: number, from: number, to: number): number {
  if (i === from) return 0
  if (from < to && i > from && i <= to) return -1
  if (from > to && i >= to && i < from) return +1
  return 0
}

export function CarouselStage(): React.ReactElement {
  const stageRef = useRef<Konva.Stage>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const objectOrder = useCanvasStore((s) => s.objectOrder)
  const selectedId = useCanvasStore((s) => s.selectedId)
  const selectedIds = useCanvasStore((s) => s.selectedIds)
  const setSelected = useCanvasStore((s) => s.setSelected)
  const setSelectedIds = useCanvasStore((s) => s.setSelectedIds)
  const commitMultipleUpdates = useCanvasStore((s) => s.commitMultipleUpdates)
  const frameCount = useCanvasStore((s) => s.frameCount)
  const frameWidth = useCanvasStore((s) => s.frameWidth)
  const frameHeight = useCanvasStore((s) => s.frameHeight)
  const frames = useCanvasStore((s) => s.frames)
  const backgroundColor = useCanvasStore((s) => s.backgroundColor)
  const addObject = useCanvasStore((s) => s.addObject)
  const updateObject = useCanvasStore((s) => s.updateObject)
  const commitUpdate = useCanvasStore((s) => s.commitUpdate)
  const removeObject = useCanvasStore((s) => s.removeObject)
  const activeTool = useCanvasStore((s) => s.activeTool)
  const setActiveTool = useCanvasStore((s) => s.setActiveTool)
  const clearContentEditMode = useCanvasStore((s) => s.clearContentEditMode)
  const clearPathEditMode = useCanvasStore((s) => s.clearPathEditMode)
  const clearMaskEditMode = useCanvasStore((s) => s.clearMaskEditMode)
  const maskDrawMode = useCanvasStore((s) => s.maskDrawMode)
  const clearMaskDrawMode = useCanvasStore((s) => s.clearMaskDrawMode)
  const setContextMenu = useCanvasStore((s) => s.setContextMenu)
  const activeShapeKind = useCanvasStore((s) => s.activeShapeKind)
  const snapEnabled = useCanvasStore((s) => s.snapEnabled)
  const maskModeActive = useCanvasStore((s) => s.maskModeActive)
  const enterMaskDrawMode = useCanvasStore((s) => s.enterMaskDrawMode)
  const setFrameBackground = useCanvasStore((s) => s.setFrameBackground)
  const previewMode = useCanvasStore((s) => s.previewMode)
  const guidelineOrientation = useCanvasStore((s) => s.guidelineOrientation)
  const setGuidelineOrientation = useCanvasStore((s) => s.setGuidelineOrientation)

  // Viewport store
  const zoom = useViewportStore((s) => s.zoom)
  const panX = useViewportStore((s) => s.panX)
  const panY = useViewportStore((s) => s.panY)
  const setZoom = useViewportStore((s) => s.setZoom)
  const setPan = useViewportStore((s) => s.setPan)

  // --- Group transformer + marquee ---
  const groupTransformerRef = useRef<Konva.Transformer>(null)
  const groupTransformerDragStartRef = useRef<{ x: number; y: number } | null>(null)
  const shiftHeldRef = useRef(false)
  const nodeRefMapRef = useRef<Map<string, React.RefObject<Konva.Node>>>(new Map())
  const syncRefMapRef = useRef<Map<string, React.MutableRefObject<(() => void) | null>>>(new Map())
  const syncGroupRefMapRef = useRef<Map<string, React.MutableRefObject<(() => void) | null>>>(new Map())
  const [marquee, setMarquee] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null)
  const marqueeCurrentRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null)
  const isMarqueeActiveRef = useRef(false)
  const multiSelectDragStartRef = useRef<{
    x: number
    y: number
    positions: Map<string, { x: number; y: number }>
  } | null>(null)
  const multiSelectDragActiveRef = useRef(false)

  // --- Frame reorder drag state ---
  const frameDragRef = useRef<FrameDragState | null>(null)
  const [frameDrag, setFrameDrag] = useState<FrameDragState | null>(null)
  const [framePreviews, setFramePreviews] = useState<string[] | null>(null)

  function getOrCreateNodeRef(id: string): React.RefObject<Konva.Node> {
    const map = nodeRefMapRef.current
    if (!map.has(id)) map.set(id, React.createRef<Konva.Node>())
    return map.get(id)!
  }

  function getOrCreateSyncRef(id: string): React.MutableRefObject<(() => void) | null> {
    const map = syncRefMapRef.current
    if (!map.has(id)) map.set(id, { current: null })
    return map.get(id)!
  }

  function getOrCreateSyncGroupRef(id: string): React.MutableRefObject<(() => void) | null> {
    const map = syncGroupRefMapRef.current
    if (!map.has(id)) map.set(id, { current: null })
    return map.get(id)!
  }

  const { computeSnapGroup, computeSnapResizeGroup, snapRotation, startSnapSession, endSnapSession } = useSnapGuides()
  const pendingGroupGuidesRef = useRef<SnapGuide[]>([])

  function getGroupBBox(ids: string[]): { x: number; y: number; width: number; height: number } | null {
    const objs = useCanvasStore.getState().objects
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const id of ids) {
      const node = nodeRefMapRef.current.get(id)?.current
      const obj = objs[id]
      if (!node || !obj) continue
      const x = obj.type === 'path' ? obj.x + node.x() : node.x()
      const y = obj.type === 'path' ? obj.y + node.y() : node.y()
      const w = obj.type === 'image' ? (obj as ImageObject).frameWidth : obj.width
      const h = obj.type === 'image' ? (obj as ImageObject).frameHeight : obj.height
      minX = Math.min(minX, x); minY = Math.min(minY, y)
      maxX = Math.max(maxX, x + w); maxY = Math.max(maxY, y + h)
    }
    return minX === Infinity ? null : { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
  }

  const [activeGuides, setActiveGuides] = useState<SnapGuide[]>([])
  const [previewShape, setPreviewShape] = useState<{
    kind: ShapeKind
    x: number
    y: number
    width: number
    height: number
    x2?: number
    y2?: number
  } | null>(null)
  const drawStartRef = useRef<{ x: number; y: number; id: string } | null>(null)

  // Pen tool state — in-progress path ID is tracked via ref; anchors live in store
  const currentPenPathIdRef = useRef<string | null>(null)
  const [penCursorPos, setPenCursorPos] = useState<{ x: number; y: number } | null>(null)
  const penMouseDownPosRef = useRef<{ x: number; y: number } | null>(null)
  const penDragRef = useRef<{ dx: number; dy: number } | null>(null)

  // Mask draw state — all positions in canvas coords
  const maskDrawStartRef = useRef<{ x: number; y: number } | null>(null)
  const [maskPenAnchors, setMaskPenAnchors] = useState<AnchorPoint[]>([])
  const maskPenDownRef = useRef<{ x: number; y: number } | null>(null)
  const maskPenDragRef = useRef<{ dx: number; dy: number } | null>(null)
  const [maskCursorPos, setMaskCursorPos] = useState<{ x: number; y: number } | null>(null)
  const [guidelinePreview, setGuidelinePreview] = useState<number | null>(null)

  // Container size (for Stage width/height)
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })

  // Pan state
  const isPanningRef = useRef(false)
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
  const [isSpacePanning, setIsSpacePanning] = useState(false)
  const [groupTransformKey, setGroupTransformKey] = useState(0)
  const spacePanActiveRef = useRef(false)

  useImageDrop(containerRef)
  useVideoDrop(containerRef)
  useAutosave()
  useKeyboardShortcuts()
  useThumbnailGenerator()

  useEffect(() => {
    _stageInstance = stageRef.current
    return () => {
      _stageInstance = null
    }
  }, [])

  // ResizeObserver — keep containerSize in sync with the actual DOM size
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setContainerSize({ width, height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Track Shift key state for group transformer axis lock (dragBoundFunc has no event access)
  useEffect(() => {
    const onDown = (e: KeyboardEvent): void => { if (e.shiftKey) shiftHeldRef.current = true }
    const onUp = (e: KeyboardEvent): void => { if (!e.shiftKey) shiftHeldRef.current = false }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [])

  // Space key — pan mode
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (
        e.code === 'Space' &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !(e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        e.preventDefault()
        spacePanActiveRef.current = true
        setIsSpacePanning(true)
      }
    }
    function onKeyUp(e: KeyboardEvent): void {
      if (e.code === 'Space') {
        spacePanActiveRef.current = false
        setIsSpacePanning(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  // Mask draw mode: reset local state when mode is cleared
  useEffect(() => {
    if (maskDrawMode === null) {
      setMaskPenAnchors([])
      setMaskCursorPos(null)
      maskDrawStartRef.current = null
      maskPenDownRef.current = null
      maskPenDragRef.current = null
    }
  }, [maskDrawMode])

  // Clear guideline placement preview when tool changes away
  useEffect(() => {
    if (activeTool !== 'guideline') setGuidelinePreview(null)
  }, [activeTool])

  // Pen tool: Escape commits the open path (not closed)
  useEffect(() => {
    if (activeTool !== 'pen') return
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') commitPenPath(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool])

  // When switching away from pen tool mid-drawing, commit the in-progress path
  useEffect(() => {
    if (activeTool === 'pen') return
    const pathId = currentPenPathIdRef.current
    if (!pathId) return
    currentPenPathIdRef.current = null
    setPenCursorPos(null)
    const currentPath = useCanvasStore.getState().objects[pathId] as PathObject | undefined
    if (!currentPath) return
    if (currentPath.anchors.length < 2) {
      removeObject(pathId)
      setSelected(null)
      return
    }
    const bbox = computePathBBox(currentPath.anchors)
    commitUpdate(pathId, {
      closed: false, fill: 'transparent', pathEditMode: false,
      x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height,
    } as Partial<PathObject> as Partial<CanvasObject>)
  }, [activeTool]) // intentionally only activeTool in deps

  function commitPenPath(closed: boolean): void {
    const pathId = currentPenPathIdRef.current
    currentPenPathIdRef.current = null
    setPenCursorPos(null)

    if (pathId === null) return

    const currentPath = useCanvasStore.getState().objects[pathId] as PathObject | undefined
    if (!currentPath) return

    if (currentPath.anchors.length < 2) {
      // Not enough anchors — remove the stub path
      removeObject(pathId)
      setSelected(null)
      return
    }

    const bbox = computePathBBox(currentPath.anchors)
    commitUpdate(pathId, {
      closed,
      fill: closed ? 'rgba(68,136,255,0.2)' : 'transparent',
      pathEditMode: closed,   // auto-enter edit mode only when closed (Escape = false)
      x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height,
    } as Partial<PathObject> as Partial<CanvasObject>)

    setActiveTool('select')
  }

  function toContentSpace(cx: number, cy: number, imgId: string): { x: number; y: number } {
    const img = useCanvasStore.getState().objects[imgId] as ImageObject | undefined
    if (!img) return { x: cx, y: cy }
    return { x: cx - img.frameX - img.contentOffsetX, y: cy - img.frameY - img.contentOffsetY }
  }

  function commitMaskDraw(anchors: AnchorPoint[]): void {
    if (!maskDrawMode) return
    const kind = maskDrawMode.tool
    commitUpdate(maskDrawMode.id, { mask: { anchors, feather: 0, inverted: false, visible: true, kind } } as Partial<CanvasObject>)
    clearMaskDrawMode()
  }

  // --- Group transformer wiring ---
  useEffect(() => {
    const tr = groupTransformerRef.current
    if (!tr) return
    if (selectedIds.length > 1) {
      const nodes: Konva.Node[] = []
      for (const id of selectedIds) {
        const node = nodeRefMapRef.current.get(id)?.current
        if (node) nodes.push(node)
      }
      tr.nodes(nodes)
    } else {
      tr.nodes([])
    }
    tr.getLayer()?.batchDraw()
  }, [selectedIds, groupTransformKey])

  // Clean up dead node refs when objects are removed
  useEffect(() => {
    const currentIds = new Set(objectOrder)
    for (const id of nodeRefMapRef.current.keys()) {
      if (!currentIds.has(id)) nodeRefMapRef.current.delete(id)
    }
    for (const id of syncRefMapRef.current.keys()) {
      if (!currentIds.has(id)) syncRefMapRef.current.delete(id)
    }
    for (const id of syncGroupRefMapRef.current.keys()) {
      if (!currentIds.has(id)) syncGroupRefMapRef.current.delete(id)
    }
  }, [objectOrder])

  function getObjectBBoxForMarquee(obj: CanvasObject): { x: number; y: number; width: number; height: number } {
    if (obj.type === 'image') {
      const img = obj as ImageObject
      return { x: img.frameX, y: img.frameY, width: img.frameWidth, height: img.frameHeight }
    }
    if (obj.type === 'path') {
      return computePathBBox((obj as PathObject).anchors)
    }
    return { x: obj.x, y: obj.y, width: obj.width, height: obj.height }
  }

  function rectsOverlap(
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number },
  ): boolean {
    return !(a.x + a.width < b.x || b.x + b.width < a.x || a.y + a.height < b.y || b.y + b.height < a.y)
  }

  function handleGroupTransformEnd(): void {
    const tr = groupTransformerRef.current
    if (!tr) return
    endSnapSession()
    // Detach immediately so the transformer cannot adjust node positions in response
    // to scale-baking or to React re-rendering updated width/height props.
    tr.nodes([])
    const patches: Record<string, Partial<CanvasObject>> = {}
    const currentSelectedIds = useCanvasStore.getState().selectedIds
    const currentObjects = useCanvasStore.getState().objects
    for (const id of currentSelectedIds) {
      const ref = nodeRefMapRef.current.get(id)
      const node = ref?.current
      if (!node) continue
      const obj = currentObjects[id]
      if (!obj) continue
      const newX = node.x()
      const newY = node.y()
      const newScaleX = node.scaleX()
      const newScaleY = node.scaleY()
      const newRotation = snapRotation(node.rotation())
      if (obj.type === 'image') {
        const img = obj as ImageObject
        const newFW = img.frameWidth * newScaleX
        const newFH = img.frameHeight * newScaleY
        node.scaleX(1); node.scaleY(1)
        patches[id] = {
          frameX: newX, frameY: newY, x: newX, y: newY,
          frameWidth: newFW, frameHeight: newFH, width: newFW, height: newFH,
          rotation: newRotation,
          contentOffsetX: img.contentOffsetX * newScaleX,
          contentOffsetY: img.contentOffsetY * newScaleY,
          contentWidth: img.contentWidth * newScaleX,
          contentHeight: img.contentHeight * newScaleY,
        }
      } else if (obj.type === 'path') {
        const p = obj as PathObject
        const dx = node.x(); const dy = node.y()
        node.x(0); node.y(0)
        node.scaleX(1); node.scaleY(1)
        const newAnchors = p.anchors.map((a) => ({ ...a, x: a.x + dx, y: a.y + dy }))
        const bbox = computePathBBox(newAnchors)
        patches[id] = { anchors: newAnchors, x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height, rotation: newRotation }
      } else if (obj.type === 'text') {
        const absWidth = obj.width * newScaleX
        const absHeight = obj.height * newScaleY
        node.scaleX(1); node.scaleY(1)
        patches[id] = { x: newX, y: newY, width: absWidth, height: absHeight, rotation: newRotation, scaleX: 1, scaleY: 1 }
      } else if (obj.type === 'shape') {
        const s = obj as ShapeObject
        if (s.kind === 'ellipse') {
          const el = node as Konva.Ellipse
          const w = el.radiusX() * 2 * newScaleX
          const h = el.radiusY() * 2 * newScaleY
          node.scaleX(1); node.scaleY(1)
          patches[id] = { x: newX - w / 2, y: newY - h / 2, width: w, height: h, rotation: newRotation, scaleX: 1, scaleY: 1 }
        } else {
          const w = obj.width * newScaleX
          const h = obj.height * newScaleY
          node.scaleX(1); node.scaleY(1)
          patches[id] = { x: newX, y: newY, width: w, height: h, rotation: newRotation, scaleX: 1, scaleY: 1 }
        }
      }
    }
    commitMultipleUpdates(patches)
    requestAnimationFrame(() => setGroupTransformKey(k => k + 1))
    setActiveGuides([])
  }

  function handleGroupDragEnd(): void {
    endSnapSession()
    const currentSelectedIds = useCanvasStore.getState().selectedIds
    const currentObjects = useCanvasStore.getState().objects
    const patches: Record<string, Partial<CanvasObject>> = {}
    for (const id of currentSelectedIds) {
      const ref = nodeRefMapRef.current.get(id)
      const node = ref?.current
      if (!node) continue
      const obj = currentObjects[id]
      if (!obj) continue
      if (obj.type === 'image') {
        patches[id] = { frameX: node.x(), frameY: node.y(), x: node.x(), y: node.y() }
      } else if (obj.type === 'path') {
        const p = obj as PathObject
        const dx = node.x(); const dy = node.y()
        node.x(0); node.y(0)
        const newAnchors = p.anchors.map((a) => ({ ...a, x: a.x + dx, y: a.y + dy }))
        const bbox = computePathBBox(newAnchors)
        patches[id] = { anchors: newAnchors, x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height }
      } else {
        patches[id] = { x: node.x(), y: node.y() }
      }
    }
    commitMultipleUpdates(patches)
    setGroupTransformKey(k => k + 1)
    setActiveGuides([])
  }

  // Sync image visual groups (groupRef) to their frame rects during live group transform/drag.
  // Required because nodeRef now points to frameRectRef; the visual group must be driven manually.
  // Also emits pending snap guides computed in boundBoxFunc (resize) or computed inline (drag).
  function handleGroupTransformLive(): void {
    const ids = useCanvasStore.getState().selectedIds
    for (const id of ids) {
      const groupSyncFn = syncGroupRefMapRef.current.get(id)?.current
      if (groupSyncFn) groupSyncFn()
      else syncRefMapRef.current.get(id)?.current?.()
    }
    setActiveGuides(pendingGroupGuidesRef.current)
  }

  function handleGroupDragLive(): void {
    const ids = useCanvasStore.getState().selectedIds
    for (const id of ids) {
      const groupSyncFn = syncGroupRefMapRef.current.get(id)?.current
      if (groupSyncFn) groupSyncFn()
      else syncRefMapRef.current.get(id)?.current?.()
    }

    const groupBox = getGroupBBox(ids)
    if (!groupBox) return
    const { x: sx, y: sy, guides } = computeSnapGroup(groupBox, ids)
    const dx = sx - groupBox.x
    const dy = sy - groupBox.y
    if (dx !== 0 || dy !== 0) {
      for (const id of ids) {
        const node = nodeRefMapRef.current.get(id)?.current
        if (node) { node.x(node.x() + dx); node.y(node.y() + dy) }
      }
      for (const id of ids) {
        const groupSyncFn = syncGroupRefMapRef.current.get(id)?.current
        if (groupSyncFn) groupSyncFn()
        else syncRefMapRef.current.get(id)?.current?.()
      }
      groupTransformerRef.current?.getLayer()?.batchDraw()
    }
    setActiveGuides(guides)
  }

  // --- Wheel: non-passive native listener to prevent browser scroll during zoom ---
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    function onWheel(e: WheelEvent): void {
      e.preventDefault()
      const { zoom, panX, panY } = useViewportStore.getState()

      if (e.ctrlKey) {
        // Pinch-to-zoom (macOS reports pinch as ctrlKey+wheel) or Ctrl+scroll
        const rect = el!.getBoundingClientRect()
        const factor = e.deltaY < 0 ? 1.03 : 1 / 1.03
        const newZoom = Math.max(0.1, Math.min(8, zoom * factor))
        const mouseX = e.clientX - rect.left
        const mouseY = e.clientY - rect.top
        const canvasX = (mouseX - panX) / (CANVAS_SCALE * zoom)
        const canvasY = (mouseY - panY) / (CANVAS_SCALE * zoom)
        useViewportStore.getState().setZoom(newZoom)
        useViewportStore.getState().setPan(
          mouseX - canvasX * CANVAS_SCALE * newZoom,
          mouseY - canvasY * CANVAS_SCALE * newZoom,
        )
      } else {
        // Two-finger scroll (trackpad) or plain mouse wheel → pan
        useViewportStore.getState().setPan(panX - e.deltaX, panY - e.deltaY)
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, []) // empty deps — containerRef.current is stable

  // --- Pan handlers: middle mouse or space+left ---
  function handleContainerMouseDown(e: React.MouseEvent<HTMLDivElement>): void {
    if (e.button === 1 || (e.button === 0 && spacePanActiveRef.current)) {
      e.preventDefault()
      isPanningRef.current = true
      panStartRef.current = { x: e.clientX, y: e.clientY, panX, panY }
    }
  }

  function handleContainerMouseMove(e: React.MouseEvent<HTMLDivElement>): void {
    if (!isPanningRef.current) return
    const dx = e.clientX - panStartRef.current.x
    const dy = e.clientY - panStartRef.current.y
    setPan(panStartRef.current.panX + dx, panStartRef.current.panY + dy)
  }

  function handleContainerMouseUp(): void {
    isPanningRef.current = false
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        cursor: frameDrag ? 'grabbing'
          : isSpacePanning ? 'grab'
          : maskDrawMode ? 'crosshair'
          : activeTool === 'text' ? 'text'
          : (activeTool === 'shape' || activeTool === 'pen' || activeTool === 'guideline') ? 'crosshair'
          : 'default',
      }}
      onMouseDown={handleContainerMouseDown}
      onMouseMove={handleContainerMouseMove}
      onMouseUp={handleContainerMouseUp}
      onMouseLeave={handleContainerMouseUp}
      onPointerMove={(e) => {
        const cur = frameDragRef.current
        if (!cur) return
        const next = { ...cur, currentClientX: e.clientX }
        frameDragRef.current = next
        setFrameDrag(next)
      }}
      onPointerUp={(e) => {
        const cur = frameDragRef.current
        if (!cur) return
        stageRef.current?.container().style.removeProperty('opacity')
        const toIndex = Math.max(0, Math.min(frameCount - 1,
          Math.round((e.clientX - cur.containerLeft - panX) / (CANVAS_SCALE * zoom) / frameWidth)
        ))
        if (toIndex !== cur.fromIndex) {
          useCanvasStore.getState().reorderFrames(cur.fromIndex, toIndex)
        }
        frameDragRef.current = null
        setFrameDrag(null)
        setFramePreviews(null)
      }}
      onPointerLeave={() => {
        if (!frameDragRef.current) return
        stageRef.current?.container().style.removeProperty('opacity')
        frameDragRef.current = null
        setFrameDrag(null)
        setFramePreviews(null)
      }}
    >
      {/* Frame labels + colour swatches — follow the canvas viewport */}
      {!previewMode && (() => {
        const previewTo = frameDrag
          ? Math.max(0, Math.min(frameCount - 1,
              Math.round((frameDrag.currentClientX - frameDrag.containerLeft - panX) / (CANVAS_SCALE * zoom) / frameWidth)
            ))
          : null
        const labelTop = Math.max(4, panY - 22)
        const dispW = frameWidth * CANVAS_SCALE * zoom
        const dispH = frameHeight * CANVAS_SCALE * zoom

        return (
          <>
            {/* Dragged frame: combined label pill + full frame preview, follows cursor */}
            {frameDrag && (
              <div
                style={{
                  position: 'absolute',
                  left: panX + frameDrag.fromIndex * frameWidth * (CANVAS_SCALE * zoom) + (frameDrag.currentClientX - frameDrag.startClientX),
                  top: labelTop,
                  zIndex: 100,
                  pointerEvents: 'none',
                  filter: 'drop-shadow(0 10px 28px rgba(0,0,0,0.2))',
                  willChange: 'left',
                }}
              >
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--bg-panel)', borderRadius: 8, padding: '3px 8px 3px 4px', border: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1, padding: '0 2px', userSelect: 'none' }}>⣿</span>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: frames[frameDrag.fromIndex]?.backgroundColor ?? backgroundColor, border: '1.5px solid var(--stroke)', flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font)', whiteSpace: 'nowrap', userSelect: 'none' }}>Frame {frameDrag.fromIndex + 1}</span>
                </div>
                {framePreviews && (
                  <img src={framePreviews[frameDrag.fromIndex]} draggable={false} style={{ display: 'block', width: dispW, height: dispH, userSelect: 'none' }} />
                )}
              </div>
            )}
            {/* Per-frame label pills + animated preview overlays */}
            {Array.from({ length: frameCount }).map((_, i) => {
              const frameColor = frames[i]?.backgroundColor ?? null
              const displayColor = frameColor ?? backgroundColor
              const labelX = panX + i * frameWidth * (CANVAS_SCALE * zoom)
              const isDragging = frameDrag?.fromIndex === i
              const txPx = (frameDrag && previewTo !== null)
                ? frameSlotOffset(i, frameDrag.fromIndex, previewTo) * frameWidth * (CANVAS_SCALE * zoom)
                : 0
              const animTransition = (frameDrag && !isDragging) ? 'transform 0.18s cubic-bezier(0.25,0.46,0.45,0.94)' : 'none'

              return (
                <React.Fragment key={i}>
                  {/* Frame preview overlay (animates to make space; hidden for dragged frame) */}
                  {framePreviews && !isDragging && (
                    <img
                      src={framePreviews[i]}
                      draggable={false}
                      style={{
                        position: 'absolute',
                        left: labelX,
                        top: panY,
                        width: dispW,
                        height: dispH,
                        zIndex: 30,
                        pointerEvents: 'none',
                        transform: `translateX(${txPx}px)`,
                        transition: animTransition,
                        userSelect: 'none',
                      }}
                    />
                  )}
                  {/* Label pill */}
                  <div
                    style={{
                      position: 'absolute',
                      left: labelX,
                      top: labelTop,
                      zIndex: 40,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      pointerEvents: isDragging ? 'none' : 'auto',
                      opacity: isDragging ? 0 : 1,
                      transform: `translateX(${txPx}px)`,
                      transition: animTransition,
                    }}
                  >
                    <span
                      style={{ cursor: frameDrag ? 'grabbing' : 'grab', color: 'var(--text-muted)', fontSize: 12, lineHeight: 1, padding: '0 2px', userSelect: 'none' }}
                      onPointerDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        const containerLeft = containerRef.current?.getBoundingClientRect().left ?? 0
                        const state: FrameDragState = { fromIndex: i, startClientX: e.clientX, currentClientX: e.clientX, containerLeft }
                        frameDragRef.current = state
                        setFrameDrag(state)

                        // Defer canvas capture to the next frame to avoid any
                        // stage resize/redraw interfering with the pointer event.
                        const captureFromIndex = i
                        requestAnimationFrame(() => {
                          if (frameDragRef.current?.fromIndex !== captureFromIndex) return
                          const stage = stageRef.current
                          if (!stage) return
                          stage.container().style.opacity = '0'
                          const origW = stage.width(), origH = stage.height()
                          const origSX = stage.scaleX(), origSY = stage.scaleY()
                          const origX = stage.x(), origY = stage.y()
                          stage.width(frameCount * frameWidth)
                          stage.height(frameHeight)
                          stage.scaleX(1); stage.scaleY(1)
                          stage.x(0); stage.y(0)
                          const guidesLyr = stage.findOne<Konva.Layer>('.guides')
                          const glOverlay = stage.findOne<Konva.Layer>('.guideline-overlay')
                          const divLyr = stage.findOne<Konva.Layer>('.frame-dividers')
                          const txfmrs = stage.find<Konva.Transformer>('Transformer')
                          guidesLyr?.hide(); glOverlay?.hide(); divLyr?.hide()
                          txfmrs.forEach(t => t.hide())
                          stage.draw()
                          const full = stage.toCanvas({ pixelRatio: 0.5 })
                          const capW = Math.round(full.width / frameCount)
                          const capH = full.height
                          const previews = Array.from({ length: frameCount }, (_, idx) => {
                            const c = document.createElement('canvas')
                            c.width = capW; c.height = capH
                            c.getContext('2d')!.drawImage(full, idx * capW, 0, capW, capH, 0, 0, capW, capH)
                            return c.toDataURL()
                          })
                          guidesLyr?.show(); glOverlay?.show(); divLyr?.show()
                          txfmrs.forEach(t => t.show())
                          stage.width(origW); stage.height(origH)
                          stage.scaleX(origSX); stage.scaleY(origSY)
                          stage.x(origX); stage.y(origY)
                          stage.draw()
                          setFramePreviews(previews)
                        })
                      }}
                    >
                      ⣿
                    </span>
                    <ColorInput
                      value={displayColor}
                      onChange={c => setFrameBackground(i, c)}
                      size={14}
                      fixed
                    />
                    {frameColor && (
                      <button
                        onClick={e => { e.stopPropagation(); setFrameBackground(i, null) }}
                        title="Reset to canvas background"
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, fontSize: 13, lineHeight: 1, display: 'flex', alignItems: 'center' }}
                      >
                        ×
                      </button>
                    )}
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font)', whiteSpace: 'nowrap', userSelect: 'none' }}>
                      Frame {i + 1}
                    </span>
                  </div>
                </React.Fragment>
              )
            })}
          </>
        )
      })()}
      <Stage
        ref={stageRef}
        width={containerSize.width}
        height={containerSize.height}
        x={panX}
        y={panY}
        scaleX={CANVAS_SCALE * zoom}
        scaleY={CANVAS_SCALE * zoom}
        onMouseDown={(e) => {
          // Block Stage events when panning
          if (isPanningRef.current) return
          if (e.evt.button === 1) return  // middle mouse belongs to container-level pan

          // --- Guideline placement ---
          if (activeTool === 'guideline') {
            if (e.evt.button !== 0) return  // right-click cancels via onContextMenu, don't place
            const stage = e.target.getStage()
            if (!stage) return
            const pos = stage.getRelativePointerPosition()
            if (!pos) return
            const frameIndex = Math.floor(pos.x / frameWidth)
            const clampedFrameIndex = Math.max(0, Math.min(frameCount - 1, frameIndex))
            const newId = crypto.randomUUID()
            addObject({
              id: newId,
              type: 'guideline',
              orientation: guidelineOrientation,
              position: guidelineOrientation === 'horizontal' ? pos.y : pos.x,
              frameIndex: clampedFrameIndex,
              spanAllFrames: false,
              scope: 'pinned',
              pinnedFrame: clampedFrameIndex,
              x: guidelineOrientation === 'horizontal' ? 0 : pos.x,
              y: guidelineOrientation === 'horizontal' ? pos.y : 0,
              width: guidelineOrientation === 'horizontal' ? frameWidth : 0,
              height: guidelineOrientation === 'horizontal' ? 0 : frameHeight,
              rotation: 0,
              scaleX: 1,
              scaleY: 1,
              opacity: 1,
              visible: true,
              locked: false,
              zIndex: objectOrder.length,
            } as CanvasObject)
            setGuidelinePreview(null)
            setActiveTool('select')
            return
          }

          // --- Mask draw mode ---
          if (maskDrawMode !== null) {
            const stage = e.target.getStage()
            if (!stage) return
            const pos = stage.getRelativePointerPosition()
            if (!pos) return
            const cx = pos.x; const cy = pos.y
            if (maskDrawMode.tool === 'rect' || maskDrawMode.tool === 'ellipse') {
              maskDrawStartRef.current = { x: cx, y: cy }
            } else {
              maskPenDownRef.current = { x: cx, y: cy }; maskPenDragRef.current = null
            }
            return
          }

          // --- Pen tool ---
          if (activeTool === 'pen') {
            if (maskModeActive && selectedId && useCanvasStore.getState().objects[selectedId]?.type === 'image') {
              enterMaskDrawMode(selectedId, 'pen')
              return
            }
            if (e.target !== e.target.getStage()) return
            const stage = e.target.getStage()
            if (!stage) return
            const pos = stage.getRelativePointerPosition()
            if (!pos) return
            penMouseDownPosRef.current = { x: pos.x, y: pos.y }
            penDragRef.current = null
            return
          }

          // Multi-select drag: record initial node positions when clicking a canvas object
          if (selectedIds.length > 1 && activeTool === 'select' && e.target !== e.target.getStage() && e.evt.button === 0) {
            // Skip if clicking on the group transformer itself (resize/rotate handles)
            let isTransformerClick = false
            let cur: Konva.Node | null = e.target as Konva.Node
            while (cur) {
              if (cur === groupTransformerRef.current) { isTransformerClick = true; break }
              cur = cur.parent as Konva.Node | null
            }
            if (!isTransformerClick) {
              const stage = e.target.getStage()
              const pos = stage?.getRelativePointerPosition()
              if (pos) {
                const positions = new Map<string, { x: number; y: number }>()
                for (const id of useCanvasStore.getState().selectedIds) {
                  const node = nodeRefMapRef.current.get(id)?.current
                  if (node) positions.set(id, { x: node.x(), y: node.y() })
                }
                multiSelectDragStartRef.current = { x: pos.x, y: pos.y, positions }
                multiSelectDragActiveRef.current = false
              }
            }
          }

          // Shape tool mask interception — must be before the stage-click gate so clicks
          // on the selected image are captured even though e.target !== stage.
          if (activeTool === 'shape' && maskModeActive && selectedId && useCanvasStore.getState().objects[selectedId]?.type === 'image' &&
              (activeShapeKind === 'rect' || activeShapeKind === 'ellipse')) {
            const stage = e.target.getStage()
            const pos = stage?.getRelativePointerPosition()
            if (pos) {
              enterMaskDrawMode(selectedId, activeShapeKind as 'rect' | 'ellipse')
              maskDrawStartRef.current = { x: pos.x, y: pos.y }
            }
            return
          }

          if (e.target !== e.target.getStage()) return

          if (activeTool === 'text') {
            const stage = e.target.getStage()
            if (!stage) return
            const pos = stage.getRelativePointerPosition()
            if (!pos) return
            const canvasX = pos.x
            const canvasY = pos.y
            const newId = crypto.randomUUID()
            addObject({
              id: newId,
              type: 'text',
              scope: 'global',
              spans: [{ text: 'Double-click to edit' }],
              fontFamily: 'sans-serif',
              fontSize: 48,
              fontStyle: 'normal',
              align: 'left',
              fill: '#000000',
              letterSpacing: 0,
              lineHeight: 1.2,
              x: canvasX,
              y: canvasY,
              width: 400,
              height: 60,
              rotation: 0,
              scaleX: 1,
              scaleY: 1,
              opacity: 1,
              visible: true,
              locked: false,
              zIndex: objectOrder.length,
            } as TextObject as CanvasObject)
            setSelected(newId)
            setActiveTool('select')
          } else if (activeTool === 'shape') {
            if (e.target !== e.target.getStage()) return
            const stage = e.target.getStage()
            if (!stage) return
            const pos = stage.getRelativePointerPosition()
            if (!pos) return
            const canvasX = pos.x
            const canvasY = pos.y
            const newId = crypto.randomUUID()
            drawStartRef.current = { x: canvasX, y: canvasY, id: newId }
            setPreviewShape({ kind: activeShapeKind, x: canvasX, y: canvasY, width: 1, height: 1 })
          } else {
            // Start marquee selection — defer clearing selection to mouseup
            const stage = e.target.getStage()
            if (stage) {
              const pos = stage.getRelativePointerPosition()
              if (pos) {
                marqueeStartRef.current = { x: pos.x, y: pos.y }
                marqueeCurrentRef.current = { x: pos.x, y: pos.y, width: 0, height: 0 }
                isMarqueeActiveRef.current = true
                setMarquee({ x: pos.x, y: pos.y, width: 0, height: 0 })
                clearContentEditMode()
                clearPathEditMode()
                clearMaskEditMode()
                setActiveGuides([])
              }
            }
          }
        }}
        onMouseMove={(e) => {
          // Block Stage events when panning
          if (isPanningRef.current) return

          // Multi-select drag: imperatively move all selected nodes together
          if (multiSelectDragStartRef.current) {
            const stage = stageRef.current
            const pos = stage?.getRelativePointerPosition()
            if (pos) {
              let dx = pos.x - multiSelectDragStartRef.current.x
              let dy = pos.y - multiSelectDragStartRef.current.y
              if (e.evt.shiftKey) {
                const locked = axisLock(dx, dy)
                dx = locked.dx; dy = locked.dy
              }
              if (Math.sqrt(dx * dx + dy * dy) > 3) {
                multiSelectDragActiveRef.current = true
                const objs = useCanvasStore.getState().objects
                const ids = useCanvasStore.getState().selectedIds

                // Compute proposed group bbox to snap it
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
                for (const [id, initPos] of multiSelectDragStartRef.current.positions) {
                  const obj = objs[id]
                  if (!obj) continue
                  const x = obj.type === 'path' ? obj.x + initPos.x + dx : initPos.x + dx
                  const y = obj.type === 'path' ? obj.y + initPos.y + dy : initPos.y + dy
                  const w = obj.type === 'image' ? (obj as ImageObject).frameWidth : obj.width
                  const h = obj.type === 'image' ? (obj as ImageObject).frameHeight : obj.height
                  minX = Math.min(minX, x); minY = Math.min(minY, y)
                  maxX = Math.max(maxX, x + w); maxY = Math.max(maxY, y + h)
                }
                const { x: sx, y: sy, guides } = computeSnapGroup(
                  { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
                  ids,
                )
                const snapDx = sx - minX
                const snapDy = sy - minY

                for (const [id, initPos] of multiSelectDragStartRef.current.positions) {
                  const node = nodeRefMapRef.current.get(id)?.current
                  if (node) {
                    node.x(initPos.x + dx + snapDx)
                    node.y(initPos.y + dy + snapDy)
                    syncRefMapRef.current.get(id)?.current?.()
                  }
                }
                setActiveGuides(guides)
                groupTransformerRef.current?.getLayer()?.batchDraw()
              }
            }
            return  // skip marquee and snap-guide updates during multi-drag (prevents React re-renders from overriding imperative positions)
          }

          // --- Marquee selection drag ---
          if (isMarqueeActiveRef.current && marqueeStartRef.current) {
            const stage = e.target.getStage()
            if (stage) {
              const pos = stage.getRelativePointerPosition()
              if (pos) {
                const start = marqueeStartRef.current
                const x = Math.min(start.x, pos.x)
                const y = Math.min(start.y, pos.y)
                const width = Math.abs(pos.x - start.x)
                const height = Math.abs(pos.y - start.y)
                marqueeCurrentRef.current = { x, y, width, height }
                setMarquee({ x, y, width, height })
              }
            }
            return
          }

          // --- Mask draw mode cursor tracking ---
          if (maskDrawMode !== null) {
            const stage = e.target.getStage()
            if (!stage) return
            const pos = stage.getRelativePointerPosition()
            if (!pos) return
            const cx = pos.x; const cy = pos.y
            setMaskCursorPos({ x: cx, y: cy })
            if (maskDrawMode.tool === 'pen' && maskPenDownRef.current) {
              maskPenDragRef.current = { dx: cx - maskPenDownRef.current.x, dy: cy - maskPenDownRef.current.y }
            }
            return
          }

          // --- Pen tool cursor tracking ---
          if (activeTool === 'pen') {
            const stage = e.target.getStage()
            if (!stage) return
            const pos = stage.getRelativePointerPosition()
            if (!pos) return
            const cx = pos.x; const cy = pos.y
            setPenCursorPos({ x: cx, y: cy })
            if (penMouseDownPosRef.current) {
              penDragRef.current = {
                dx: cx - penMouseDownPosRef.current.x,
                dy: cy - penMouseDownPosRef.current.y,
              }
            }
            return
          }

          // --- Guideline placement preview ---
          if (activeTool === 'guideline') {
            const stage = e.target.getStage()
            if (!stage) return
            const pos = stage.getRelativePointerPosition()
            if (!pos) return
            if (guidelineOrientation === 'horizontal') {
              setGuidelinePreview(pos.y)
            } else {
              setGuidelinePreview(pos.x)
            }
            return
          }

          if (!drawStartRef.current || previewShape === null) return
          const stage = e.target.getStage()
          if (!stage) return
          const pos = stage.getRelativePointerPosition()
          if (!pos) return
          const curX = pos.x
          const curY = pos.y

          // Lines and arrows track both endpoints, not a normalised bounding box
          if (activeShapeKind === 'line' || activeShapeKind === 'arrow') {
            setPreviewShape((prev) =>
              prev === null ? null : {
                kind: prev.kind,
                x: drawStartRef.current!.x,
                y: drawStartRef.current!.y,
                width: curX - drawStartRef.current!.x,
                height: curY - drawStartRef.current!.y,
                x2: curX,
                y2: curY,
              }
            )
          } else {
            const x = Math.min(drawStartRef.current.x, curX)
            const y = Math.min(drawStartRef.current.y, curY)
            const width = Math.max(1, Math.abs(curX - drawStartRef.current.x))
            const height = Math.max(1, Math.abs(curY - drawStartRef.current.y))
            setPreviewShape((prev) => prev === null ? null : { kind: prev.kind, x, y, width, height })
          }
        }}
        onMouseUp={(e) => {
          // Block Stage events when panning
          if (isPanningRef.current) return

          // Multi-select drag commit
          if (multiSelectDragStartRef.current) {
            if (multiSelectDragActiveRef.current) {
              const currentSelectedIds = useCanvasStore.getState().selectedIds
              const currentObjects = useCanvasStore.getState().objects
              const patches: Record<string, Partial<CanvasObject>> = {}
              for (const id of currentSelectedIds) {
                const node = nodeRefMapRef.current.get(id)?.current
                if (!node) continue
                const obj = currentObjects[id]
                if (!obj) continue
                if (obj.type === 'image') {
                  patches[id] = { frameX: node.x(), frameY: node.y(), x: node.x(), y: node.y() }
                } else if (obj.type === 'path') {
                  const p = obj as PathObject
                  const dx = node.x(); const dy = node.y()
                  node.x(0); node.y(0)
                  const newAnchors = p.anchors.map((a) => ({ ...a, x: a.x + dx, y: a.y + dy }))
                  const bbox = computePathBBox(newAnchors)
                  patches[id] = { anchors: newAnchors, x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height }
                } else {
                  patches[id] = { x: node.x(), y: node.y() }
                }
              }
              commitMultipleUpdates(patches)
              setGroupTransformKey(k => k + 1)
              setActiveGuides([])
            }
            multiSelectDragStartRef.current = null
            multiSelectDragActiveRef.current = false
            return
          }

          // --- Marquee selection finalize ---
          if (isMarqueeActiveRef.current) {
            isMarqueeActiveRef.current = false
            const rect = marqueeCurrentRef.current
            marqueeStartRef.current = null
            marqueeCurrentRef.current = null
            setMarquee(null)
            if (rect !== null && (rect.width >= 5 || rect.height >= 5)) {
              const overlapping: string[] = []
              const currentObjects = useCanvasStore.getState().objects
              for (const id of objectOrder) {
                const obj = currentObjects[id]
                if (!obj || !obj.visible || obj.locked) continue
                const bbox = getObjectBBoxForMarquee(obj)
                if (rectsOverlap(rect, bbox)) overlapping.push(id)
              }
              if (e.evt.shiftKey) {
                const current = useCanvasStore.getState().selectedIds
                const merged = Array.from(new Set([...current, ...overlapping]))
                setSelectedIds(merged)
              } else {
                setSelectedIds(overlapping)
              }
            } else {
              // Misclick — clear selection
              setSelected(null)
              setSelectedIds([])
            }
            return
          }

          // --- Mask draw mode: place shape or anchor ---
          if (maskDrawMode !== null) {
            const stage = stageRef.current
            if (!stage) return
            const pos = stage.getRelativePointerPosition()
            if (!pos) return
            const cx = pos.x; const cy = pos.y
            const { id, tool } = maskDrawMode

            if (tool === 'rect' || tool === 'ellipse') {
              const start = maskDrawStartRef.current; maskDrawStartRef.current = null
              if (!start) return
              const x1 = Math.min(start.x, cx); const y1 = Math.min(start.y, cy)
              const x2 = Math.max(start.x, cx); const y2 = Math.max(start.y, cy)
              if (x2 - x1 < 5 || y2 - y1 < 5) return

              if (tool === 'rect') {
                const corners = [{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }]
                commitMaskDraw(corners.map(c => ({ ...toContentSpace(c.x, c.y, id), handleIn: { dx: 0, dy: 0 }, handleOut: { dx: 0, dy: 0 } })))
              } else {
                const K = 0.5523
                const ecx = (x1 + x2) / 2; const ecy = (y1 + y2) / 2
                const rx = (x2 - x1) / 2; const ry = (y2 - y1) / 2
                const ellipseAnchors: AnchorPoint[] = [
                  { x: ecx,      y: ecy - ry, handleIn: { dx: -K * rx, dy: 0 },  handleOut: { dx: K * rx, dy: 0 } },
                  { x: ecx + rx, y: ecy,      handleIn: { dx: 0, dy: -K * ry },  handleOut: { dx: 0, dy: K * ry } },
                  { x: ecx,      y: ecy + ry, handleIn: { dx: K * rx, dy: 0 },   handleOut: { dx: -K * rx, dy: 0 } },
                  { x: ecx - rx, y: ecy,      handleIn: { dx: 0, dy: K * ry },   handleOut: { dx: 0, dy: -K * ry } },
                ]
                commitMaskDraw(ellipseAnchors.map(a => { const cs = toContentSpace(a.x, a.y, id); return { ...a, x: cs.x, y: cs.y } }))
              }
              return
            }

            // Pen tool
            const downPos = maskPenDownRef.current; maskPenDownRef.current = null
            if (!downPos) return
            const drag = maskPenDragRef.current; maskPenDragRef.current = null
            const isDrag = drag !== null && Math.hypot(drag.dx, drag.dy) > 3
            const newAnchor: AnchorPoint = isDrag
              ? { x: downPos.x, y: downPos.y, handleIn: { dx: -drag!.dx, dy: -drag!.dy }, handleOut: { dx: drag!.dx, dy: drag!.dy } }
              : { x: downPos.x, y: downPos.y, handleIn: { dx: 0, dy: 0 }, handleOut: { dx: 0, dy: 0 } }

            if (maskPenAnchors.length >= 3) {
              const first = maskPenAnchors[0]
              if (Math.hypot(cx - first.x, cy - first.y) < 12) {
                commitMaskDraw(maskPenAnchors.map(a => { const cs = toContentSpace(a.x, a.y, id); return { ...a, x: cs.x, y: cs.y } }))
                setMaskPenAnchors([])
                return
              }
            }
            setMaskPenAnchors(prev => [...prev, newAnchor])
            return
          }

          // --- Pen tool: place anchor ---
          if (activeTool === 'pen') {
            const stage = stageRef.current
            if (!stage) return
            const pos = stage.getRelativePointerPosition()
            const downPos = penMouseDownPosRef.current
            penMouseDownPosRef.current = null
            if (!pos || !downPos) return

            const cx = pos.x
            const cy = pos.y

            const drag = penDragRef.current
            penDragRef.current = null
            const isDrag = drag !== null && Math.hypot(drag.dx, drag.dy) > 3

            const newAnchor: AnchorPoint = isDrag
              ? {
                  x: downPos.x, y: downPos.y,
                  handleIn: { dx: -drag!.dx, dy: -drag!.dy },
                  handleOut: { dx: drag!.dx, dy: drag!.dy },
                }
              : { x: downPos.x, y: downPos.y, handleIn: { dx: 0, dy: 0 }, handleOut: { dx: 0, dy: 0 } }

            const pathId = currentPenPathIdRef.current

            if (pathId === null) {
              // First anchor — create path in store immediately
              const newId = crypto.randomUUID()
              addObject({
                id: newId, type: 'path', scope: 'global',
                anchors: [newAnchor],
                closed: false,
                fill: 'transparent', stroke: '#4488ff', strokeWidth: 2,
                pathEditMode: false,
                x: newAnchor.x, y: newAnchor.y, width: 0, height: 0,
                rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, locked: false,
                zIndex: objectOrder.length,
              } as PathObject as CanvasObject)
              setSelected(newId)
              currentPenPathIdRef.current = newId
            } else {
              // Subsequent anchor — get current path from store and append
              const currentPath = useCanvasStore.getState().objects[pathId] as PathObject | undefined
              if (!currentPath) { currentPenPathIdRef.current = null; return }

              // Check: clicking near first anchor closes the path
              if (currentPath.anchors.length >= 2) {
                const first = currentPath.anchors[0]
                if (Math.hypot(cx - first.x, cy - first.y) < 12) {
                  commitPenPath(true)
                  return
                }
              }

              const newAnchors = [...currentPath.anchors, newAnchor]
              const bbox = computePathBBox(newAnchors)
              updateObject(pathId, {
                anchors: newAnchors,
                x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height,
              } as Partial<PathObject> as Partial<CanvasObject>)
            }
            return
          }

          const drawStart = drawStartRef.current
          const preview = previewShape
          drawStartRef.current = null
          setPreviewShape(null)
          if (!drawStart || !preview) return
          // Discard misclicks (tiny drag)
          if (preview.width < 5 && preview.height < 5) return

          const isLineKind = preview.kind === 'line' || preview.kind === 'arrow'
          const finalX2 = isLineKind ? (preview.x2 ?? preview.x + preview.width) : undefined
          const finalY2 = isLineKind ? (preview.y2 ?? preview.y + preview.height) : undefined

          addObject({
            id: drawStart.id,
            type: 'shape',
            kind: preview.kind,
            scope: 'global',
            x: preview.x,
            y: preview.y,
            width: isLineKind ? Math.abs((finalX2 ?? 0) - preview.x) : preview.width,
            height: isLineKind ? Math.abs((finalY2 ?? 0) - preview.y) : preview.height,
            ...(isLineKind ? { x2: finalX2, y2: finalY2 } : {}),
            rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, locked: false,
            zIndex: objectOrder.length, fill: '#4488ff', stroke: 'transparent', strokeWidth: 0, cornerRadius: 0,
          })
          setSelected(drawStart.id)
          setActiveTool('select')
        }}
        onContextMenu={(e) => {
          e.evt.preventDefault()
          if (activeTool === 'guideline') {
            setActiveTool('select')
            return
          }
          setContextMenu({ x: e.evt.clientX, y: e.evt.clientY, targetId: null })
        }}
      >
        {/* Layer 0: background fills — never hidden during export */}
        <Layer name="background" listening={false}>
          {Array.from({ length: frameCount }, (_, i) => {
            const fill = frames[i]?.backgroundColor ?? backgroundColor
            return (
              <KonvaRect
                key={`bg-${i}`}
                x={i * frameWidth}
                y={0}
                width={frameWidth}
                height={frameHeight}
                fill={fill}
              />
            )
          })}
        </Layer>

        {/* Layer 1: frame guides — hidden during export */}
        <Layer name="guides" listening={false}>
          <FrameGuides
            frameCount={frameCount}
            frameHeight={frameHeight}
          />
        </Layer>

        {/* Layer 2: objects */}
        <Layer name="objects">
          {objectOrder.map((id) => {
            const type = useCanvasStore.getState().objects[id]?.type
            if (type === 'image') {
              return (
                <CanvasImageNode
                  key={id}
                  id={id}
                  onGuidesChange={setActiveGuides}
                  nodeRef={getOrCreateNodeRef(id)}
                  syncRef={getOrCreateSyncRef(id)}
                  syncGroupRef={getOrCreateSyncGroupRef(id)}
                />
              )
            }
            if (type === 'text') {
              return (
                <CanvasTextNode
                  key={id}
                  id={id}
                  onGuidesChange={setActiveGuides}
                  nodeRef={getOrCreateNodeRef(id)}
                />
              )
            }
            if (type === 'shape') {
              return (
                <CanvasShapeNode
                  key={id}
                  id={id}
                  onGuidesChange={setActiveGuides}
                  nodeRef={getOrCreateNodeRef(id)}
                />
              )
            }
            if (type === 'path') {
              return (
                <CanvasPathNode
                  key={id}
                  id={id}
                  onGuidesChange={setActiveGuides}
                  nodeRef={getOrCreateNodeRef(id)}
                />
              )
            }
            if (type === 'video') {
              return (
                <CanvasVideoNode
                  key={id}
                  id={id}
                  onGuidesChange={setActiveGuides}
                  nodeRef={getOrCreateNodeRef(id)}
                />
              )
            }
            if (type === 'group') {
              return <CanvasGroupNode key={id} id={id} onGuidesChange={setActiveGuides} />
            }
            return null
          })}

          {/* Group transformer — active when 2+ objects are selected */}
          <Transformer
            ref={groupTransformerRef}
            keepRatio={true}
            draggable
            rotationSnaps={snapEnabled ? [0, 45, 90, 135, 180, 225, 270, 315] : []}
            rotationSnapTolerance={8}
            borderStroke="#f94608"
            borderStrokeWidth={1.5}
            anchorFill="#fff"
            anchorStroke="#f94608"
            anchorSize={8}
            onTransformEnd={handleGroupTransformEnd}
            onTransformStart={() => startSnapSession(useCanvasStore.getState().selectedIds)}
            onDragStart={() => {
              startSnapSession(useCanvasStore.getState().selectedIds)
              const tr = groupTransformerRef.current
              if (tr) groupTransformerDragStartRef.current = { x: tr.x(), y: tr.y() }
            }}
            onDragEnd={handleGroupDragEnd}
            onTransform={handleGroupTransformLive}
            onDragMove={handleGroupDragLive}
            dragBoundFunc={(pos) => {
              const start = groupTransformerDragStartRef.current
              if (!start || !shiftHeldRef.current) return pos
              const { dx, dy } = axisLock(pos.x - start.x, pos.y - start.y)
              return { x: start.x + dx, y: start.y + dy }
            }}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 5 || newBox.height < 5) return oldBox
              const anchor = groupTransformerRef.current?.getActiveAnchor() ?? ''
              const rotation = newBox.rotation ?? 0
              if (anchor === 'rotater') {
                pendingGroupGuidesRef.current = []
                return newBox
              }
              if (Math.abs(rotation) > 0.01 || !anchor) {
                pendingGroupGuidesRef.current = []
                return newBox
              }
              const ids = useCanvasStore.getState().selectedIds
              const scale = CANVAS_SCALE * zoom
              const screenThreshold = 8
              const logicalThreshold = screenThreshold / scale
              const logicalBox = {
                x: (newBox.x - panX) / scale,
                y: (newBox.y - panY) / scale,
                width: newBox.width / scale,
                height: newBox.height / scale,
              }
              const { box: snappedLogical, guides } = computeSnapResizeGroup(
                logicalBox,
                anchor,
                ids,
                logicalThreshold,
                true,
              )
              const snapped = {
                x: snappedLogical.x * scale + panX,
                y: snappedLogical.y * scale + panY,
                width: snappedLogical.width * scale,
                height: snappedLogical.height * scale,
              }
              pendingGroupGuidesRef.current = guides
              return { ...snapped, rotation: newBox.rotation }
            }}
          />

          {/* Marquee selection rectangle */}
          {marquee !== null && (
            <KonvaRect
              x={marquee.x}
              y={marquee.y}
              width={marquee.width}
              height={marquee.height}
              fill="rgba(0,150,255,0.08)"
              stroke="#f94608"
              strokeWidth={1}
              strokeScaleEnabled={false}
              dash={[6, 4]}
              listening={false}
              perfectDrawEnabled={false}
            />
          )}

          {/* Shape draw preview */}
          {previewShape !== null && (previewShape.kind === 'line' || previewShape.kind === 'arrow') && (
            <KonvaLine
              points={[
                previewShape.x, previewShape.y,
                previewShape.x2 ?? previewShape.x + previewShape.width,
                previewShape.y2 ?? previewShape.y + previewShape.height,
              ]}
              stroke="#4488ff"
              strokeWidth={2}
              strokeScaleEnabled={false}
              dash={[6, 4]}
              listening={false}
              perfectDrawEnabled={false}
            />
          )}
          {previewShape !== null && previewShape.kind !== 'line' && previewShape.kind !== 'arrow' && (
            <KonvaRect
              x={previewShape.x}
              y={previewShape.y}
              width={previewShape.width}
              height={previewShape.height}
              fill="rgba(68, 136, 255, 0.15)"
              stroke="#4488ff"
              strokeWidth={1}
              strokeScaleEnabled={false}
              dash={[6, 4]}
              listening={false}
              perfectDrawEnabled={false}
            />
          )}

          {/* Mask draw preview overlay */}
          {maskDrawMode && maskCursorPos && (() => {
            const { tool } = maskDrawMode
            const start = maskDrawStartRef.current

            if (tool === 'rect' && start) {
              const x = Math.min(start.x, maskCursorPos.x); const y = Math.min(start.y, maskCursorPos.y)
              const w = Math.abs(maskCursorPos.x - start.x); const h = Math.abs(maskCursorPos.y - start.y)
              return <KonvaRect x={x} y={y} width={w} height={h}
                stroke="#f94608" strokeWidth={1} strokeScaleEnabled={false}
                dash={[4, 3]} fill="rgba(0,170,255,0.08)" listening={false} />
            }

            if (tool === 'ellipse' && start) {
              const x = Math.min(start.x, maskCursorPos.x); const y = Math.min(start.y, maskCursorPos.y)
              const w = Math.abs(maskCursorPos.x - start.x); const h = Math.abs(maskCursorPos.y - start.y)
              return <KonvaEllipse x={x + w / 2} y={y + h / 2} radiusX={w / 2} radiusY={h / 2}
                stroke="#f94608" strokeWidth={1} strokeScaleEnabled={false}
                dash={[4, 3]} fill="rgba(0,170,255,0.08)" listening={false} />
            }

            if (tool === 'pen' && maskPenAnchors.length > 0) {
              const lastAnchor = maskPenAnchors[maskPenAnchors.length - 1]
              const drag = maskPenDragRef.current
              const downPos = maskPenDownRef.current
              const isDragging = downPos !== null && drag !== null && Math.hypot(drag.dx, drag.dy) > 3
              const ghostX = isDragging ? downPos!.x : maskCursorPos.x
              const ghostY = isDragging ? downPos!.y : maskCursorPos.y
              const ghostAnchor: AnchorPoint = {
                x: ghostX, y: ghostY,
                handleIn: isDragging ? { dx: -drag!.dx, dy: -drag!.dy } : { dx: 0, dy: 0 },
                handleOut: isDragging ? { dx: drag!.dx, dy: drag!.dy } : { dx: 0, dy: 0 },
              }
              const previewData = anchorsToPathData([lastAnchor, ghostAnchor], false)
              const placedData = maskPenAnchors.length >= 2 ? anchorsToPathData(maskPenAnchors, false) : null
              const isNearFirst = maskPenAnchors.length >= 3 &&
                Math.hypot(maskCursorPos.x - maskPenAnchors[0].x, maskCursorPos.y - maskPenAnchors[0].y) < 12
              return (
                <>
                  {placedData && <KonvaPath data={placedData} fill="transparent" stroke="#f94608"
                    strokeWidth={1} strokeScaleEnabled={false} listening={false} perfectDrawEnabled={false} />}
                  {previewData && <KonvaPath data={previewData} fill="transparent" stroke="#f94608"
                    strokeWidth={1} strokeScaleEnabled={false} dash={[4, 3]} listening={false} perfectDrawEnabled={false} />}
                  {isDragging && <>
                    <KonvaLine points={[ghostX - drag!.dx, ghostY - drag!.dy, ghostX + drag!.dx, ghostY + drag!.dy]}
                      stroke="#f94608" strokeWidth={1} strokeScaleEnabled={false} dash={[3, 2]} listening={false} />
                    <KonvaCircle x={ghostX - drag!.dx} y={ghostY - drag!.dy} radius={6} fill="#fff" stroke="#f94608" strokeWidth={1.5} listening={false} />
                    <KonvaCircle x={ghostX + drag!.dx} y={ghostY + drag!.dy} radius={6} fill="#fff" stroke="#f94608" strokeWidth={1.5} listening={false} />
                  </>}
                  {maskPenAnchors.map((a, i) => (
                    <KonvaCircle key={i} x={a.x} y={a.y}
                      radius={7}
                      fill={i === 0 && isNearFirst ? '#ff4488' : '#f94608'}
                      stroke="#fff" strokeWidth={1.5} listening={false} />
                  ))}
                </>
              )
            }
            return null
          })()}

          {/* Pen tool preview overlay */}
          {activeTool === 'pen' && penCursorPos && (() => {
            const pathId = currentPenPathIdRef.current
            const currentPenPath = pathId ? (useCanvasStore.getState().objects[pathId] as PathObject | undefined) : undefined
            const penAnchors = currentPenPath?.anchors ?? []
            if (penAnchors.length === 0) return null

            const lastAnchor = penAnchors[penAnchors.length - 1]
            // During drag: anchor lands at mousedown pos; cursor is the handle endpoint.
            // During hover: anchor ghost is at cursor with no handles.
            const drag = penDragRef.current
            const downPos = penMouseDownPosRef.current
            const isDragging = downPos !== null && drag !== null && Math.hypot(drag.dx, drag.dy) > 3
            const ghostX = isDragging ? downPos!.x : penCursorPos.x
            const ghostY = isDragging ? downPos!.y : penCursorPos.y
            const ghostAnchor: AnchorPoint = {
              x: ghostX, y: ghostY,
              handleIn: isDragging ? { dx: -drag!.dx, dy: -drag!.dy } : { dx: 0, dy: 0 },
              handleOut: isDragging ? { dx: drag!.dx, dy: drag!.dy } : { dx: 0, dy: 0 },
            }
            const previewData = anchorsToPathData([lastAnchor, ghostAnchor], false)
            const isNearFirst = penAnchors.length >= 2 &&
              Math.hypot(penCursorPos.x - penAnchors[0].x, penCursorPos.y - penAnchors[0].y) < 12

            return (
              <>
                {/* Bezier curve preview from last anchor to ghost anchor */}
                {previewData && (
                  <KonvaPath
                    data={previewData}
                    fill="transparent"
                    stroke="#4488ff"
                    strokeWidth={1}
                    strokeScaleEnabled={false}
                    dash={[4, 3]}
                    listening={false}
                    perfectDrawEnabled={false}
                  />
                )}
                {/* Handle arm: from mirrored handle through anchor to cursor */}
                {isDragging && (
                  <>
                    <KonvaLine
                      points={[
                        ghostX - drag!.dx, ghostY - drag!.dy,
                        ghostX + drag!.dx, ghostY + drag!.dy,
                      ]}
                      stroke="#f94608" strokeWidth={1} strokeScaleEnabled={false}
                      dash={[3, 2]} listening={false} perfectDrawEnabled={false}
                    />
                    <KonvaCircle
                      x={ghostX - drag!.dx} y={ghostY - drag!.dy}
                      radius={3} fill="#fff" stroke="#f94608" strokeWidth={1.5} listening={false}
                    />
                    <KonvaCircle
                      x={ghostX + drag!.dx} y={ghostY + drag!.dy}
                      radius={3} fill="#fff" stroke="#f94608" strokeWidth={1.5} listening={false}
                    />
                  </>
                )}
                {/* Anchor dots for all placed points */}
                {penAnchors.map((a, i) => (
                  <KonvaCircle
                    key={i}
                    x={a.x} y={a.y}
                    radius={i === 0 && penAnchors.length >= 2 ? 7 : 5}
                    fill={i === 0 && isNearFirst ? '#ff4488' : '#4488ff'}
                    stroke="#fff"
                    strokeWidth={1.5}
                    listening={false}
                  />
                ))}
              </>
            )
          })()}
        </Layer>

        {/* Layer 3: guideline overlay — above all media, hidden during export */}
        <Layer name="guideline-overlay" listening={activeTool === 'guideline' ? false : undefined}>
          {objectOrder
            .filter((id) => useCanvasStore.getState().objects[id]?.type === 'guideline')
            .map((id) => (
              <CanvasGuidelineNode key={id} id={id} />
            ))
          }
          {activeTool === 'guideline' && guidelinePreview !== null && (
            <KonvaLine
              points={
                guidelineOrientation === 'horizontal'
                  ? [0, guidelinePreview, frameWidth * frameCount, guidelinePreview]
                  : [guidelinePreview, 0, guidelinePreview, frameHeight]
              }
              stroke="#4A90E2"
              strokeWidth={1}
              strokeScaleEnabled={false}
              dash={[8, 6]}
              listening={false}
              opacity={0.6}
              perfectDrawEnabled={false}
            />
          )}
        </Layer>

        {/* Layer 4: frame divider lines — always on top of all media */}
        <Layer name="frame-dividers" listening={false}>
          {Array.from({ length: frameCount - 1 }, (_, i) => {
            const x = (i + 1) * frameWidth
            return (
              <React.Fragment key={`divider-${i}`}>
                <KonvaLine points={[x, 0, x, frameHeight]} stroke="rgba(0,0,0,0.45)" strokeWidth={3} perfectDrawEnabled={false} />
                <KonvaLine points={[x, 0, x, frameHeight]} stroke="rgba(255,255,255,0.9)" strokeWidth={1} perfectDrawEnabled={false} />
              </React.Fragment>
            )
          })}
        </Layer>

        {/* Layer 4: snap guide lines (non-listening) */}
        <Layer name="snap-guides" listening={false}>
          <SnapGuides
            guides={activeGuides}
            totalWidth={frameCount * frameWidth}
            totalHeight={frameHeight}
          />
        </Layer>
      </Stage>

      {/* Empty grid cell +image/+video buttons — rendered after Stage so they sit above the canvas */}
      <GridCellOverlay />

      {/* Zoom indicator badge */}
      <div style={{
        position: 'absolute',
        bottom: 12,
        left: 12,
        background: 'rgba(0,0,0,0.5)',
        color: '#aaa',
        fontSize: 11,
        padding: '2px 8px',
        borderRadius: 4,
        pointerEvents: 'none',
        userSelect: 'none',
        zIndex: 10,
      }}>
        {Math.round(CANVAS_SCALE * zoom * 100)}%
      </div>
    </div>
  )
}
