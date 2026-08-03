import React, { useRef, useEffect, useMemo } from 'react'
import {
  Path as KonvaPath,
  Circle as KonvaCircle,
  Line as KonvaLine,
  Transformer,
} from 'react-konva'
import type Konva from 'konva'
import type { PathObject, AnchorPoint, CanvasObject } from '@/types/canvas'
import { useCanvasStore } from './useCanvasStore'
import { makeCanvasNode } from './makeCanvasNode'
import { useSnapGuides } from './useSnapGuides'
import type { SnapGuide } from './useSnapGuides'
import { axisLock } from './constants'
import { useViewportStore, selectScale } from './useViewportStore'
import { buildEffectFilters } from './effects/buildEffectFilters'

// ---------------------------------------------------------------------------
// Path utilities — exported for use in CarouselStage pen tool
// ---------------------------------------------------------------------------

export function anchorsToPathData(anchors: AnchorPoint[], closed: boolean): string {
  if (anchors.length < 2) return ''
  const first = anchors[0]
  let d = `M ${first.x} ${first.y}`

  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i]
    const b = anchors[i + 1]
    const outZero = a.handleOut.dx === 0 && a.handleOut.dy === 0
    const inZero = b.handleIn.dx === 0 && b.handleIn.dy === 0
    if (outZero && inZero) {
      d += ` L ${b.x} ${b.y}`
    } else {
      d += ` C ${a.x + a.handleOut.dx} ${a.y + a.handleOut.dy} ${b.x + b.handleIn.dx} ${b.y + b.handleIn.dy} ${b.x} ${b.y}`
    }
  }

  if (closed && anchors.length >= 2) {
    const a = anchors[anchors.length - 1]
    const b = anchors[0]
    const outZero = a.handleOut.dx === 0 && a.handleOut.dy === 0
    const inZero = b.handleIn.dx === 0 && b.handleIn.dy === 0
    if (outZero && inZero) {
      d += ' Z'
    } else {
      d += ` C ${a.x + a.handleOut.dx} ${a.y + a.handleOut.dy} ${b.x + b.handleIn.dx} ${b.y + b.handleIn.dy} ${b.x} ${b.y} Z`
    }
  }

  return d
}

export function computePathBBox(anchors: AnchorPoint[], closed = false): { x: number; y: number; width: number; height: number } {
  if (anchors.length === 0) return { x: 0, y: 0, width: 0, height: 0 }
  if (anchors.length === 1) return { x: anchors[0].x, y: anchors[0].y, width: 0, height: 0 }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

  function expand(x: number, y: number): void {
    if (x < minX) minX = x; if (x > maxX) maxX = x
    if (y < minY) minY = y; if (y > maxY) maxY = y
  }

  function cubicExtrema(p0: number, p1: number, p2: number, p3: number): number[] {
    const a = -3 * p0 + 9 * p1 - 9 * p2 + 3 * p3
    const b = 6 * p0 - 12 * p1 + 6 * p2
    const c = -3 * p0 + 3 * p1
    const ts: number[] = []
    if (Math.abs(a) < 1e-10) {
      if (Math.abs(b) > 1e-10) { const t = -c / b; if (t > 0 && t < 1) ts.push(t) }
    } else {
      const disc = b * b - 4 * a * c
      if (disc >= 0) {
        const sq = Math.sqrt(disc)
        const t1 = (-b + sq) / (2 * a); if (t1 > 0 && t1 < 1) ts.push(t1)
        const t2 = (-b - sq) / (2 * a); if (t2 > 0 && t2 < 1) ts.push(t2)
      }
    }
    return ts
  }

  function evalCubic(p0: number, p1: number, p2: number, p3: number, t: number): number {
    const mt = 1 - t
    return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3
  }

  function expandSegment(a: AnchorPoint, b: AnchorPoint): void {
    expand(a.x, a.y); expand(b.x, b.y)
    const c1x = a.x + a.handleOut.dx; const c1y = a.y + a.handleOut.dy
    const c2x = b.x + b.handleIn.dx; const c2y = b.y + b.handleIn.dy
    for (const t of cubicExtrema(a.x, c1x, c2x, b.x))
      expand(evalCubic(a.x, c1x, c2x, b.x, t), evalCubic(a.y, c1y, c2y, b.y, t))
    for (const t of cubicExtrema(a.y, c1y, c2y, b.y))
      expand(evalCubic(a.x, c1x, c2x, b.x, t), evalCubic(a.y, c1y, c2y, b.y, t))
  }

  for (let i = 0; i < anchors.length - 1; i++) expandSegment(anchors[i], anchors[i + 1])
  if (closed && anchors.length > 2) expandSegment(anchors[anchors.length - 1], anchors[0])

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CanvasPathNodeProps {
  id: string
  onGuidesChange: (guides: SnapGuide[]) => void
  nodeRef?: React.RefObject<Konva.Node>
}

interface CanvasPathNodeInnerProps extends CanvasPathNodeProps {
  obj: PathObject
}

function CanvasPathNodeInner({ id, obj, onGuidesChange, nodeRef }: CanvasPathNodeInnerProps): React.ReactElement {
  const isSelected = useCanvasStore((s) => s.selectedId === id)
  const pathRef = useRef<Konva.Path>(null)
  const transformerRef = useRef<Konva.Transformer>(null)

  const updateObject = useCanvasStore((s) => s.updateObject)
  const commitUpdate = useCanvasStore((s) => s.commitUpdate)
  const selectedIds = useCanvasStore((s) => s.selectedIds)
  const addToSelection = useCanvasStore((s) => s.addToSelection)
  const anchorId = useCanvasStore((s) => s.anchorId)
  const setAnchor = useCanvasStore((s) => s.setAnchor)

  const isInMultiSelectMode = selectedIds.length > 1
  const isAnchor = anchorId === id
  // The pen tool selects the path as soon as the first anchor lands, but a path
  // that's still being drawn has nothing meaningful to transform — the box would
  // wrap a shape the user hasn't finished. Anchors stay visible.
  const isDrawing = useCanvasStore((s) => s.penDrawingId === id)
  const setContextMenu = useCanvasStore((s) => s.setContextMenu)
  const { computeSnapResize, startSnapSession, endSnapSession } = useSnapGuides()
  const snapEnabled = useCanvasStore((s) => s.snapEnabled)
  const scale = useViewportStore(selectScale)
  // pan is read via getState() inside the transform callback (issue #59, Phase
  // 1a) — subscribing here re-rendered every path on every pan pointermove.
  const pendingGuidesRef = useRef<SnapGuide[]>([])

  const altHeldRef = useRef(false)
  const dragStartRef = useRef<{ anchors: AnchorPoint[] } | null>(null)

  // Track Alt key for independent handle dragging
  useEffect(() => {
    const onDown = (e: KeyboardEvent): void => { altHeldRef.current = e.altKey }
    const onUp = (e: KeyboardEvent): void => { altHeldRef.current = e.altKey }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [])

  const effectFilters = useMemo(() => buildEffectFilters(obj.effects), [obj.effects])

  // Sync nodeRef so CarouselStage group transformer can attach to this Konva node
  useEffect(() => {
    if (nodeRef) {
      (nodeRef as React.MutableRefObject<Konva.Node | null>).current = pathRef.current
    }
  })

  useEffect(() => {
    const node = pathRef.current
    if (!node) return
    if (effectFilters.length > 0) {
      node.cache()
      node.getLayer()?.batchDraw()
    } else {
      node.clearCache()
      node.getLayer()?.batchDraw()
    }
  }, [effectFilters])

  // Wire transformer — full resize + rotation; suppress in multi-select mode
  useEffect(() => {
    const tr = transformerRef.current
    const node = pathRef.current
    if (!tr || !node) return
    if (isInMultiSelectMode) {
      tr.nodes([])
      tr.getLayer()?.draw()
      return
    }
    if (isSelected && !obj.pathEditMode && !obj.locked && !isDrawing) {
      tr.nodes([node])
      tr.enabledAnchors([
        'top-left', 'top-center', 'top-right', 'middle-right',
        'bottom-right', 'bottom-center', 'bottom-left', 'middle-left',
      ])
      tr.keepRatio(true)
      tr.rotateEnabled(true)
      tr.getLayer()?.batchDraw()
    } else {
      tr.nodes([])
      tr.getLayer()?.draw()
    }
  }, [isSelected, isInMultiSelectMode, obj.pathEditMode, obj.locked, isDrawing])

  function handleClick(e: Konva.KonvaEventObject<MouseEvent>): void {
    if (e.evt.shiftKey) {
      addToSelection(obj.id)
    } else if (isInMultiSelectMode && selectedIds.includes(obj.id)) {
      setAnchor(anchorId === obj.id ? null : obj.id)
    } else {
      useCanvasStore.getState().setSelected(id)
    }
  }

  function handleDblClick(): void {
    if (obj.locked) return
    commitUpdate(obj.id, { pathEditMode: true } as Partial<PathObject> as Partial<CanvasObject>)
  }

  function handleContextMenu(e: Konva.KonvaEventObject<PointerEvent>): void {
    e.evt.preventDefault()
    e.cancelBubble = true
    if (!isSelected) useCanvasStore.getState().setSelected(id)
    setContextMenu({ x: e.evt.clientX, y: e.evt.clientY, targetId: obj.id })
  }

  // --- Body drag (non-edit mode and edit mode) ---
  // KonvaPath sits at (0,0) — coordinates are baked into the SVG path data.
  // node.x()/y() gives cumulative drag offset; we reset to 0 each frame.

  function handleDragStart(): void {
    dragStartRef.current = { anchors: obj.anchors.map((a) => ({ ...a })) }
  }

  function handleDragMove(e: Konva.KonvaEventObject<DragEvent>): void {
    const node = e.target as Konva.Path
    let dx = node.x(); let dy = node.y()
    if (!dragStartRef.current) return
    if (e.evt.shiftKey) {
      const locked = axisLock(dx, dy)
      dx = locked.dx; dy = locked.dy
    }
    const newAnchors = dragStartRef.current.anchors.map((a) => ({ ...a, x: a.x + dx, y: a.y + dy }))
    const bbox = computePathBBox(newAnchors)
    node.x(0); node.y(0)
    updateObject(obj.id, {
      anchors: newAnchors,
      x: bbox.x, y: bbox.y,
      width: bbox.width, height: bbox.height,
    } as Partial<PathObject> as Partial<CanvasObject>)
  }

  function handleDragEnd(e: Konva.KonvaEventObject<DragEvent>): void {
    onGuidesChange([])
    const node = e.target as Konva.Path
    node.x(0); node.y(0)
    dragStartRef.current = null
    const bbox = computePathBBox(obj.anchors)
    commitUpdate(obj.id, {
      anchors: obj.anchors,
      x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height,
    } as Partial<PathObject> as Partial<CanvasObject>)
  }

  // --- Anchor drag (edit mode) ---

  function handleAnchorDragMove(idx: number, e: Konva.KonvaEventObject<DragEvent>): void {
    const node = e.target as Konva.Circle
    const nx = node.x(); const ny = node.y()
    const newAnchors = obj.anchors.map((a, i) => i === idx ? { ...a, x: nx, y: ny } : a)
    const bbox = computePathBBox(newAnchors)
    updateObject(obj.id, {
      anchors: newAnchors, x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height,
    } as Partial<PathObject> as Partial<CanvasObject>)
  }

  function handleAnchorDragEnd(idx: number, e: Konva.KonvaEventObject<DragEvent>): void {
    const node = e.target as Konva.Circle
    const nx = node.x(); const ny = node.y()
    const newAnchors = obj.anchors.map((a, i) => i === idx ? { ...a, x: nx, y: ny } : a)
    const bbox = computePathBBox(newAnchors)
    commitUpdate(obj.id, {
      anchors: newAnchors, x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height,
    } as Partial<PathObject> as Partial<CanvasObject>)
  }

  function handleAnchorDblClick(idx: number): void {
    const anchor = obj.anchors[idx]
    const hasHandles =
      anchor.handleIn.dx !== 0 || anchor.handleIn.dy !== 0 ||
      anchor.handleOut.dx !== 0 || anchor.handleOut.dy !== 0

    let newAnchors: AnchorPoint[]

    if (hasHandles) {
      newAnchors = obj.anchors.map((a, i) =>
        i === idx ? { ...a, handleIn: { dx: 0, dy: 0 }, handleOut: { dx: 0, dy: 0 } } : a
      )
    } else {
      const total = obj.anchors.length
      const prevIdx = obj.closed ? (idx - 1 + total) % total : idx > 0 ? idx - 1 : idx + 1
      const nextIdx = obj.closed ? (idx + 1) % total : idx < total - 1 ? idx + 1 : idx - 1
      const prev = obj.anchors[prevIdx]
      const next = obj.anchors[nextIdx]
      const tx = next.x - prev.x
      const ty = next.y - prev.y
      const len = Math.sqrt(tx * tx + ty * ty)
      const HANDLE_LEN = 30
      const hdx = len > 0.001 ? (tx / len) * HANDLE_LEN : HANDLE_LEN
      const hdy = len > 0.001 ? (ty / len) * HANDLE_LEN : 0
      newAnchors = obj.anchors.map((a, i) =>
        i === idx ? { ...a, handleOut: { dx: hdx, dy: hdy }, handleIn: { dx: -hdx, dy: -hdy } } : a
      )
    }

    const bbox = computePathBBox(newAnchors)
    commitUpdate(obj.id, {
      anchors: newAnchors,
      x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height,
    } as Partial<PathObject> as Partial<CanvasObject>)
  }

  // --- Handle drag (edit mode) ---

  function handleHandleDragMove(idx: number, side: 'in' | 'out', e: Konva.KonvaEventObject<DragEvent>): void {
    const node = e.target as Konva.Circle
    const nx = node.x(); const ny = node.y()
    const anchor = obj.anchors[idx]
    const dx = nx - anchor.x; const dy = ny - anchor.y
    const newAnchors = obj.anchors.map((a, i) => {
      if (i !== idx) return a
      if (side === 'in') {
        return {
          ...a,
          handleIn: { dx, dy },
          handleOut: altHeldRef.current ? a.handleOut : { dx: -dx, dy: -dy },
        }
      } else {
        return {
          ...a,
          handleOut: { dx, dy },
          handleIn: altHeldRef.current ? a.handleIn : { dx: -dx, dy: -dy },
        }
      }
    })
    const bbox = computePathBBox(newAnchors)
    updateObject(obj.id, {
      anchors: newAnchors, x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height,
    } as Partial<PathObject> as Partial<CanvasObject>)
  }

  function handleHandleDragEnd(idx: number, side: 'in' | 'out', e: Konva.KonvaEventObject<DragEvent>): void {
    const node = e.target as Konva.Circle
    const nx = node.x(); const ny = node.y()
    const anchor = obj.anchors[idx]
    const dx = nx - anchor.x; const dy = ny - anchor.y
    const newAnchors = obj.anchors.map((a, i) => {
      if (i !== idx) return a
      if (side === 'in') {
        return {
          ...a,
          handleIn: { dx, dy },
          handleOut: altHeldRef.current ? a.handleOut : { dx: -dx, dy: -dy },
        }
      } else {
        return {
          ...a,
          handleOut: { dx, dy },
          handleIn: altHeldRef.current ? a.handleIn : { dx: -dx, dy: -dy },
        }
      }
    })
    const bbox = computePathBBox(newAnchors)
    commitUpdate(obj.id, {
      anchors: newAnchors, x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height,
    } as Partial<PathObject> as Partial<CanvasObject>)
  }

  // --- Transform end: bake affine matrix into anchor coordinates ---
  // The Transformer accumulates scale + rotation on the KonvaPath node.
  // On commit, we apply node.getTransform() to every anchor point and handle,
  // then reset the node back to x=0, y=0, scale=1, rotation=0 so that anchor
  // coords remain the single source of truth (as they are during drag/edit).

  function handleTransformEnd(): void {
    endSnapSession()
    const node = pathRef.current
    if (!node) return
    const t = node.getTransform()
    const origin = t.point({ x: 0, y: 0 })
    const newAnchors = obj.anchors.map((a) => {
      const pt = t.point({ x: a.x, y: a.y })
      const hi = t.point({ x: a.handleIn.dx, y: a.handleIn.dy })
      const ho = t.point({ x: a.handleOut.dx, y: a.handleOut.dy })
      return {
        ...a,
        x: pt.x, y: pt.y,
        handleIn: { dx: hi.x - origin.x, dy: hi.y - origin.y },
        handleOut: { dx: ho.x - origin.x, dy: ho.y - origin.y },
      }
    })
    node.x(0); node.y(0); node.scaleX(1); node.scaleY(1); node.rotation(0)
    const bbox = computePathBBox(newAnchors)
    onGuidesChange([])
    commitUpdate(obj.id, {
      anchors: newAnchors,
      x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height,
      rotation: 0,
    } as Partial<PathObject> as Partial<CanvasObject>)
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const pathData = anchorsToPathData(obj.anchors, obj.closed)
  const isInMultiSelect = isInMultiSelectMode && selectedIds.includes(obj.id)

  if (!obj.pathEditMode) {
    return (
      <>
        {isInMultiSelect && (
          <KonvaPath
            data={pathData}
            fill="transparent"
            stroke={isAnchor ? '#f5a623' : '#f94608'}
            strokeWidth={isAnchor ? 2 : 1}
            strokeScaleEnabled={false}
            perfectDrawEnabled={false}
            listening={false}
          />
        )}
        <KonvaPath
          ref={pathRef}
          data={pathData}
          fill={obj.fill}
          stroke={obj.stroke}
          strokeWidth={obj.strokeWidth}
          strokeScaleEnabled={false}
          opacity={obj.opacity}
          perfectDrawEnabled={false}
          filters={effectFilters}
          draggable={!obj.locked && !isInMultiSelectMode}
          onClick={handleClick}
          onTap={() => useCanvasStore.getState().setSelected(id)}
          onDblClick={handleDblClick}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onContextMenu={handleContextMenu}
        />
        <Transformer
          ref={transformerRef}
          keepRatio={true}
          rotationSnaps={snapEnabled ? [0, 45, 90, 135, 180, 225, 270, 315] : []}
          rotationSnapTolerance={8}
          onTransformStart={() => startSnapSession(obj.id)}
          onTransformEnd={handleTransformEnd}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 5 || newBox.height < 5) return oldBox
            const { panX, panY } = useViewportStore.getState()
            const anchor = transformerRef.current?.getActiveAnchor() ?? ''
            if (anchor === 'rotater') return newBox
            if (Math.abs(newBox.rotation ?? 0) > 0.01 || !anchor) return newBox
            const logicalBox = {
              x: (newBox.x - panX) / scale,
              y: (newBox.y - panY) / scale,
              width: newBox.width / scale,
              height: newBox.height / scale,
            }
            const { box: snapped, guides } = computeSnapResize(
              logicalBox, anchor, obj.id, 8 / scale, true,
            )
            pendingGuidesRef.current = guides
            return {
              x: snapped.x * scale + panX,
              y: snapped.y * scale + panY,
              width: snapped.width * scale,
              height: snapped.height * scale,
              rotation: newBox.rotation,
            }
          }}
        />
      </>
    )
  }

  // Edit mode — show anchor points and bezier handles
  return (
    <>
      {/* Draggable path visual in edit mode */}
      <KonvaPath
        ref={pathRef}
        data={pathData}
        fill={obj.fill}
        stroke={obj.stroke}
        strokeWidth={obj.strokeWidth}
        strokeScaleEnabled={false}
        opacity={obj.opacity}
        perfectDrawEnabled={false}
        filters={effectFilters}
        draggable={!obj.locked}
        onClick={handleClick}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
      />

      {obj.anchors.map((anchor, idx) => {
        const hasIn = anchor.handleIn.dx !== 0 || anchor.handleIn.dy !== 0
        const hasOut = anchor.handleOut.dx !== 0 || anchor.handleOut.dy !== 0
        return (
          <React.Fragment key={idx}>
            {hasIn && (
              <KonvaLine
                points={[anchor.x + anchor.handleIn.dx, anchor.y + anchor.handleIn.dy, anchor.x, anchor.y]}
                stroke="#f94608" strokeWidth={1} strokeScaleEnabled={false}
                dash={[3, 2]} listening={false} perfectDrawEnabled={false}
              />
            )}
            {hasOut && (
              <KonvaLine
                points={[anchor.x, anchor.y, anchor.x + anchor.handleOut.dx, anchor.y + anchor.handleOut.dy]}
                stroke="#f94608" strokeWidth={1} strokeScaleEnabled={false}
                dash={[3, 2]} listening={false} perfectDrawEnabled={false}
              />
            )}
            {hasIn && (
              <KonvaCircle
                x={anchor.x + anchor.handleIn.dx} y={anchor.y + anchor.handleIn.dy}
                radius={6} fill="#fff" stroke="#f94608" strokeWidth={1.5}
                draggable
                onDragMove={(e) => handleHandleDragMove(idx, 'in', e)}
                onDragEnd={(e) => handleHandleDragEnd(idx, 'in', e)}
              />
            )}
            {hasOut && (
              <KonvaCircle
                x={anchor.x + anchor.handleOut.dx} y={anchor.y + anchor.handleOut.dy}
                radius={6} fill="#fff" stroke="#f94608" strokeWidth={1.5}
                draggable
                onDragMove={(e) => handleHandleDragMove(idx, 'out', e)}
                onDragEnd={(e) => handleHandleDragEnd(idx, 'out', e)}
              />
            )}
            <KonvaCircle
              x={anchor.x} y={anchor.y}
              radius={7}
              fill={hasIn || hasOut ? '#4488ff' : '#fff'}
              stroke="#f94608" strokeWidth={2}
              draggable
              onDragMove={(e) => handleAnchorDragMove(idx, e)}
              onDragEnd={(e) => handleAnchorDragEnd(idx, e)}
              onDblClick={() => handleAnchorDblClick(idx)}
            />
          </React.Fragment>
        )
      })}
    </>
  )
}

export const CanvasPathNode = makeCanvasNode<PathObject, CanvasPathNodeProps>(CanvasPathNodeInner, 'path')
