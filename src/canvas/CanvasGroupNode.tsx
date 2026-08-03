import React, { useRef, useCallback } from 'react'
import Konva from 'konva'
import { Rect, Transformer } from 'react-konva'
import { useCanvasStore } from './useCanvasStore'
import { useViewportStore, selectScale } from './useViewportStore'
import type { GroupObject, ImageObject } from '@/types/canvas'
import type { SnapGuide } from './useSnapGuides'
import { useSnapGuides } from './useSnapGuides'
import { computeGridChildPatches } from './gridTemplates'
import { isPointInClipShape } from './frameClip'

// Returns the childId whose frame bounds contain the given logical canvas point.
function hitTestCell(
  obj: GroupObject,
  logicalX: number,
  logicalY: number,
): string | undefined {
  const state = useCanvasStore.getState()
  return obj.childIds.find((cid) => {
    const cell = state.objects[cid] as ImageObject | undefined
    if (!cell) return false
    const inBox =
      logicalX >= cell.frameX &&
      logicalX <= cell.frameX + cell.frameWidth &&
      logicalY >= cell.frameY &&
      logicalY <= cell.frameY + cell.frameHeight
    // Follow the clip too, or the excluded corner of an ellipse cell enters a
    // cell whose visible pixels belong to its neighbour.
    return inBox && isPointInClipShape(
      cell.clipShape, cell.frameWidth, cell.frameHeight,
      logicalX - cell.frameX, logicalY - cell.frameY,
    )
  })
}

interface CanvasGroupNodeProps {
  id: string
  onGuidesChange: (guides: SnapGuide[]) => void
}

// Outer: fast null guard matching CanvasImageNode pattern.
export function CanvasGroupNode({ id, onGuidesChange }: CanvasGroupNodeProps) {
  const obj = useCanvasStore((s) => s.objects[id] as GroupObject | undefined)
  if (!obj || !obj.visible || obj.type !== 'group') return null
  return <CanvasGroupNodeInner id={id} onGuidesChange={onGuidesChange} />
}

const CanvasGroupNodeInner = React.memo(function CanvasGroupNodeInner({ id, onGuidesChange }: CanvasGroupNodeProps) {
  const obj = useCanvasStore((s) => s.objects[id] as GroupObject | undefined)
  const commitMultipleUpdates = useCanvasStore((s) => s.commitMultipleUpdates)
  const updateObjects = useCanvasStore((s) => s.updateObjects)
  const snapEnabled = useCanvasStore((s) => s.snapEnabled)
  const isSelected = useCanvasStore((s) => s.selectedId === id)
  const setSelected = useCanvasStore((s) => s.setSelected)
  const setContextMenu = useCanvasStore((s) => s.setContextMenu)
  const panX = useViewportStore((s) => s.panX)
  const panY = useViewportStore((s) => s.panY)
  const viewScale = useViewportStore(selectScale)

  // True when any child cell is individually selected (user has "entered" the grid).
  // In that state the group rect steps back (listening=false) so the cell's own
  // transformer and drag handles take over without interference.
  // Re-read the group inside the selector rather than closing over `obj`. Zustand
  // selectors run on every store notification, BEFORE React can unmount this node —
  // so when the group leaves the store (undo of addGrid, group deletion) a closed-over
  // `obj.childIds` throws past the Outer's null guard and into the ErrorBoundary.
  const isCellSelected = useCanvasStore((s) => {
    const g = s.objects[id] as GroupObject | undefined
    return g ? g.childIds.includes(s.selectedId ?? '') : false
  })

  const { computeSnap, computeSnapResize, startSnapSession, endSnapSession } = useSnapGuides()

  const rectRef = useRef<Konva.Rect>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const dragStartXRef = useRef(0)
  const dragStartYRef = useRef(0)
  const pendingGuidesRef = useRef<SnapGuide[]>([])

  // Wire / unwire transformer whenever selection changes.
  React.useEffect(() => {
    const tr = trRef.current
    const rect = rectRef.current
    if (!tr) return
    if (isSelected && rect) {
      tr.nodes([rect])
    } else {
      tr.nodes([])
    }
    tr.getLayer()?.batchDraw()
  }, [isSelected])

  // Thin binding over the shared pure relayout in gridTemplates.ts — the Properties
  // panel gap slider calls the same function, so cell geometry has one definition.
  const buildChildPatches = useCallback((
    newX: number, newY: number, newW: number, newH: number,
    refitContent: boolean,
  ): Record<string, Partial<ImageObject>> => {
    if (!obj) return {}
    return computeGridChildPatches(
      obj,
      useCanvasStore.getState().objects,
      { x: newX, y: newY, width: newW, height: newH },
      refitContent,
    )
  }, [obj])

  // Drag start: capture pre-drag position for axis-lock and snap session.
  const handleDragStart = useCallback(() => {
    if (!obj) return
    dragStartXRef.current = obj.x
    dragStartYRef.current = obj.y
    startSnapSession(id)
  }, [obj, id, startSnapSession])

  // Drag move: apply snap, update guides, shift children live (no history).
  const handleDragMove = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    if (!obj) return
    const node = e.target as Konva.Rect
    const rawX = node.x()
    const rawY = node.y()

    const { x: snappedX, y: snappedY, guides } = computeSnap(
      { x: rawX, y: rawY, width: obj.width, height: obj.height },
      id,
    )

    node.x(snappedX)
    node.y(snappedY)
    onGuidesChange(guides)

    // Live-update children without pushing history.
    const childPatches = buildChildPatches(snappedX, snappedY, obj.width, obj.height, false)
    if (Object.keys(childPatches).length > 0) {
      updateObjects(childPatches)
    }
  }, [obj, id, computeSnap, onGuidesChange, buildChildPatches, updateObjects])

  // Drag end: commit group + child positions to history.
  const handleDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    endSnapSession()
    onGuidesChange([])
    if (!obj) return
    const node = e.target
    const newX = node.x()
    const newY = node.y()
    const childPatches = buildChildPatches(newX, newY, obj.width, obj.height, false)
    commitMultipleUpdates({ [id]: { x: newX, y: newY }, ...childPatches })
  }, [id, obj, buildChildPatches, commitMultipleUpdates, endSnapSession, onGuidesChange])

  // Live transform: recompute children each frame as the handle moves.
  const handleTransform = useCallback(() => {
    const node = rectRef.current
    if (!node) return
    const newW = node.width() * node.scaleX()
    const newH = node.height() * node.scaleY()
    const newX = node.x()
    const newY = node.y()
    onGuidesChange(pendingGuidesRef.current)
    // Refit content live so the handles preview the real result. Safe to run every
    // frame because the refit derives from naturalWidth/Height, not from the previous
    // frame's output — the old proportional scaling compounded, which is why this
    // used to skip content entirely (#69).
    const childPatches = buildChildPatches(newX, newY, newW, newH, true)
    if (Object.keys(childPatches).length > 0) {
      updateObjects(childPatches)
    }
  }, [buildChildPatches, updateObjects, onGuidesChange])

  // Transform end: bake scale to 1, commit to history with content scaling.
  const handleTransformEnd = useCallback(() => {
    endSnapSession()
    onGuidesChange([])
    const node = rectRef.current
    if (!node) return
    const newW = node.width() * node.scaleX()
    const newH = node.height() * node.scaleY()
    const newX = node.x()
    const newY = node.y()
    const newRot = node.rotation()
    node.scaleX(1)
    node.scaleY(1)

    const childPatches = buildChildPatches(newX, newY, newW, newH, true)
    commitMultipleUpdates({
      [id]: { x: newX, y: newY, width: newW, height: newH, rotation: newRot },
      ...childPatches,
    })
  }, [id, buildChildPatches, commitMultipleUpdates, endSnapSession, onGuidesChange])

  // Inner needs its own guard, not just Outer's: React re-renders this component
  // with the group already gone from the store (undo of addGrid, group deletion)
  // before Outer's null check unmounts it. Degrade to blank rather than throwing
  // into the ErrorBoundary — same contract as makeCanvasNode's type-mismatch guard.
  // Placed after every hook so hook order stays stable.
  if (!obj) return null

  return (
    <>
      {/*
        Transparent hit rect — sole interaction target for the whole group.
        Children render via CarouselStage's object-type switch; this node
        handles group-level drag, resize, and snap only.
      */}
      <Rect
        ref={rectRef}
        name="grid-hit"
        x={obj.x}
        y={obj.y}
        width={obj.width}
        height={obj.height}
        fill="transparent"
        stroke={isSelected && !isCellSelected ? '#f94608' : 'transparent'}
        strokeWidth={isSelected && !isCellSelected ? 1 : 0}
        strokeScaleEnabled={false}
        // Stop listening when a child cell is entered — let cell's own handlers take over
        listening={!obj.locked && !isCellSelected}
        draggable={!obj.locked && !isCellSelected}
        rotation={obj.rotation ?? 0}
        onClick={() => setSelected(id)}
        onTap={() => setSelected(id)}
        onDblClick={(e) => {
          // Double-click enters the group: find which cell was hit and select it
          const stage = e.target.getStage()
          if (!stage) return
          const pos = stage.getPointerPosition()
          if (!pos) return
          const scale = viewScale
          const logicalX = (pos.x - panX) / scale
          const logicalY = (pos.y - panY) / scale
          const hitCell = hitTestCell(obj, logicalX, logicalY)
          if (hitCell) setSelected(hitCell)
        }}
        onContextMenu={(e) => {
          // Without this the event reaches the stage and opens the canvas
          // Add/Remove Frame menu instead — a grid had no object menu at all,
          // which only became reachable once cells stopped listening by default.
          e.evt.preventDefault()
          e.cancelBubble = true
          if (!isSelected) setSelected(id)
          setContextMenu({ x: e.evt.clientX, y: e.evt.clientY, targetId: id })
        }}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          keepRatio={false}
          rotationSnaps={snapEnabled ? [0, 45, 90, 135, 180, 225, 270, 315] : []}
          rotationSnapTolerance={8}
          borderStroke="#f94608"
          anchorStroke="#f94608"
          anchorFill="#fff"
          anchorSize={8}
          onTransformStart={() => startSnapSession(id)}
          onTransform={handleTransform}
          onTransformEnd={handleTransformEnd}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 5 || newBox.height < 5) return oldBox

            const anchor = trRef.current?.getActiveAnchor() ?? ''
            if (anchor === 'rotater' || Math.abs(newBox.rotation ?? 0) > 0.01 || !anchor) {
              pendingGuidesRef.current = []
              return newBox
            }

            const scale = viewScale
            const logicalThreshold = 8 / scale
            const logicalBox = {
              x: (newBox.x - panX) / scale,
              y: (newBox.y - panY) / scale,
              width: newBox.width / scale,
              height: newBox.height / scale,
            }
            const { box: snappedLogical, guides } = computeSnapResize(
              logicalBox,
              anchor,
              id,
              logicalThreshold,
            )
            pendingGuidesRef.current = guides
            return {
              x: snappedLogical.x * scale + panX,
              y: snappedLogical.y * scale + panY,
              width: snappedLogical.width * scale,
              height: snappedLogical.height * scale,
              rotation: newBox.rotation,
            }
          }}
        />
      )}
    </>
  )
})
