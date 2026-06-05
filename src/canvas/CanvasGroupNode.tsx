import React, { useRef, useCallback } from 'react'
import Konva from 'konva'
import { Rect, Transformer } from 'react-konva'
import { useCanvasStore } from './useCanvasStore'
import { useViewportStore } from './useViewportStore'
import type { GroupObject, ImageObject } from '../types/canvas'
import type { SnapGuide } from './useSnapGuides'
import { useSnapGuides } from './useSnapGuides'
import { GRID_TEMPLATES } from './gridTemplates'
import { CANVAS_SCALE } from './constants'

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
    return (
      logicalX >= cell.frameX &&
      logicalX <= cell.frameX + cell.frameWidth &&
      logicalY >= cell.frameY &&
      logicalY <= cell.frameY + cell.frameHeight
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
  const obj = useCanvasStore((s) => s.objects[id] as GroupObject)
  const commitUpdate = useCanvasStore((s) => s.commitUpdate)
  const commitMultipleUpdates = useCanvasStore((s) => s.commitMultipleUpdates)
  const updateObjects = useCanvasStore((s) => s.updateObjects)
  const snapEnabled = useCanvasStore((s) => s.snapEnabled)
  const isSelected = useCanvasStore((s) => s.selectedId === id)
  const setSelected = useCanvasStore((s) => s.setSelected)
  const panX = useViewportStore((s) => s.panX)
  const panY = useViewportStore((s) => s.panY)
  const zoom = useViewportStore((s) => s.zoom)

  // True when any child cell is individually selected (user has "entered" the grid).
  // In that state the group rect steps back (listening=false) so the cell's own
  // transformer and drag handles take over without interference.
  const isCellSelected = useCanvasStore((s) => obj.childIds.includes(s.selectedId ?? ''))

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

  // Recompute child frame positions from template for a given group W/H/X/Y.
  // Returns a patches record suitable for updateObjects / commitMultipleUpdates.
  const buildChildPatches = useCallback((
    newX: number, newY: number, newW: number, newH: number,
    includeContentScale: boolean,
  ): Record<string, Partial<ImageObject>> => {
    const patches: Record<string, Partial<ImageObject>> = {}
    if (!obj.isGrid || !obj.gridTemplateId) return patches

    const template = GRID_TEMPLATES.find((t) => t.id === obj.gridTemplateId)
    if (!template) return patches

    const gap = obj.gridGap ?? 8
    const cells = template.cells(newW, newH, gap)
    const scaleX = obj.width > 0 ? newW / obj.width : 1
    const scaleY = obj.height > 0 ? newH / obj.height : 1

    obj.childIds.forEach((childId, i) => {
      const cell = cells[i]
      if (!cell) return
      const child = useCanvasStore.getState().objects[childId] as ImageObject | undefined
      if (!child) return
      const patch: Partial<ImageObject> = {
        frameX: newX + cell.x,
        frameY: newY + cell.y,
        frameWidth: cell.w,
        frameHeight: cell.h,
        x: newX + cell.x,
        y: newY + cell.y,
        width: cell.w,
        height: cell.h,
      }
      if (includeContentScale) {
        patch.contentWidth = child.contentWidth * scaleX
        patch.contentHeight = child.contentHeight * scaleY
        patch.contentOffsetX = child.contentOffsetX * scaleX
        patch.contentOffsetY = child.contentOffsetY * scaleY
      }
      patches[childId] = patch
    })
    return patches
  }, [obj])

  // Drag start: capture pre-drag position for axis-lock and snap session.
  const handleDragStart = useCallback(() => {
    dragStartXRef.current = obj.x
    dragStartYRef.current = obj.y
    startSnapSession(id)
  }, [obj.x, obj.y, id, startSnapSession])

  // Drag move: apply snap, update guides, shift children live (no history).
  const handleDragMove = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
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
    const childPatches = buildChildPatches(newX, newY, newW, newH, false)
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

  return (
    <>
      {/*
        Transparent hit rect — sole interaction target for the whole group.
        Children render via CarouselStage's object-type switch; this node
        handles group-level drag, resize, and snap only.
      */}
      <Rect
        ref={rectRef}
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
          const scale = CANVAS_SCALE * zoom
          const logicalX = (pos.x - panX) / scale
          const logicalY = (pos.y - panY) / scale
          const hitCell = hitTestCell(obj, logicalX, logicalY)
          if (hitCell) setSelected(hitCell)
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

            const scale = CANVAS_SCALE * zoom
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
