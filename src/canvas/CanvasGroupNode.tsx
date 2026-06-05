import React, { useRef, useCallback } from 'react'
import Konva from 'konva'
import { Rect, Transformer } from 'react-konva'
import { useCanvasStore } from './useCanvasStore'
import type { GroupObject } from '../types/canvas'
import { GRID_TEMPLATES } from './gridTemplates'

// Outer component: per-object subscription pattern (matches CanvasImageNode).
// Returns null fast when the object is missing, hidden, or the wrong type so the
// inner component never runs hooks on a dead slot.
export function CanvasGroupNode({ id }: { id: string }) {
  const obj = useCanvasStore((s) => s.objects[id] as GroupObject | undefined)
  if (!obj || !obj.visible || obj.type !== 'group') return null
  return <CanvasGroupNodeInner id={id} />
}

// Inner component: subscribes only to the fields it needs, memoised so sibling
// re-renders (e.g. drag on another object) don't cascade here.
const CanvasGroupNodeInner = React.memo(function CanvasGroupNodeInner({ id }: { id: string }) {
  const obj = useCanvasStore((s) => s.objects[id] as GroupObject)
  const commitUpdate = useCanvasStore((s) => s.commitUpdate)
  const commitMultipleUpdates = useCanvasStore((s) => s.commitMultipleUpdates)
  const isSelected = useCanvasStore((s) => s.selectedId === id)
  const setSelected = useCanvasStore((s) => s.setSelected)

  const rectRef = useRef<Konva.Rect>(null)
  const trRef = useRef<Konva.Transformer>(null)

  // Wire / unwire transformer whenever selection state changes.
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

  // Drag end: update group x/y and shift every child's frame position by the same
  // delta so children stay visually pinned inside the group boundary.
  const handleDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target
    const newX = node.x()
    const newY = node.y()
    const dx = newX - obj.x
    const dy = newY - obj.y

    const patches: Record<string, any> = {
      [id]: { x: newX, y: newY },
    }

    for (const childId of obj.childIds) {
      const child = useCanvasStore.getState().objects[childId]
      if (!child || child.type !== 'image') continue
      const c = child as any
      patches[childId] = {
        frameX: c.frameX + dx,
        frameY: c.frameY + dy,
        x: child.x + dx,
        y: child.y + dy,
      }
    }

    commitMultipleUpdates(patches)
  }, [id, obj, commitMultipleUpdates])

  // Transform end: bake scale into stored dimensions.
  // For grid groups, recompute each cell rect from the template so children snap
  // proportionally to the new layout; content dimensions scale with the frame.
  const handleTransformEnd = useCallback(() => {
    const node = rectRef.current
    if (!node) return

    const newW = node.width() * node.scaleX()
    const newH = node.height() * node.scaleY()
    const newX = node.x()
    const newY = node.y()
    const newRot = node.rotation()

    // Always bake scale back to 1 so the next transform starts clean.
    node.scaleX(1)
    node.scaleY(1)

    if (!obj.isGrid || !obj.gridTemplateId) {
      // Plain (non-grid) group: just persist the new bounding box.
      commitUpdate(id, { x: newX, y: newY, width: newW, height: newH, rotation: newRot })
      return
    }

    const template = GRID_TEMPLATES.find((t) => t.id === obj.gridTemplateId)
    if (!template) {
      commitUpdate(id, { x: newX, y: newY, width: newW, height: newH, rotation: newRot })
      return
    }

    const gap = obj.gridGap ?? 8
    const cells = template.cells(newW, newH, gap)

    const patches: Record<string, any> = {
      [id]: { x: newX, y: newY, width: newW, height: newH, rotation: newRot },
    }

    const prevW = obj.width
    const prevH = obj.height

    obj.childIds.forEach((childId, i) => {
      const cell = cells[i]
      if (!cell) return
      const child = useCanvasStore.getState().objects[childId]
      if (!child || child.type !== 'image') return

      // Scale content proportionally with the group resize.
      const scaleX = prevW > 0 ? newW / prevW : 1
      const scaleY = prevH > 0 ? newH / prevH : 1
      const c = child as any
      patches[childId] = {
        frameX: newX + cell.x,
        frameY: newY + cell.y,
        frameWidth: cell.w,
        frameHeight: cell.h,
        x: newX + cell.x,
        y: newY + cell.y,
        width: cell.w,
        height: cell.h,
        contentWidth: c.contentWidth * scaleX,
        contentHeight: c.contentHeight * scaleY,
        contentOffsetX: c.contentOffsetX * scaleX,
        contentOffsetY: c.contentOffsetY * scaleY,
      }
    })

    commitMultipleUpdates(patches)
  }, [id, obj, commitUpdate, commitMultipleUpdates])

  return (
    <>
      {/*
        Transparent hit rect — sole interaction target for the whole group.
        Children (ImageObjects / VideoObjects) are rendered by CarouselStage's normal
        object-type switch; this node only handles group-level drag and resize.
      */}
      <Rect
        ref={rectRef}
        x={obj.x}
        y={obj.y}
        width={obj.width}
        height={obj.height}
        fill="transparent"
        stroke={isSelected ? '#f94608' : 'transparent'}
        strokeWidth={isSelected ? 1 : 0}
        strokeScaleEnabled={false}
        draggable={!obj.locked}
        rotation={obj.rotation ?? 0}
        onClick={() => setSelected(id)}
        onTap={() => setSelected(id)}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
        listening={!obj.locked}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          keepRatio={false}
          rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
          borderStroke="#f94608"
          anchorStroke="#f94608"
          anchorFill="#fff"
          anchorSize={8}
        />
      )}
    </>
  )
})
