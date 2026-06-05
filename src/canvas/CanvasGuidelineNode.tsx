import React from 'react'
import { Line as KonvaLine } from 'react-konva'
import type Konva from 'konva'
import type { GuidelineObject } from '@/types/canvas'
import { useCanvasStore } from './useCanvasStore'
import { useSnapGuides } from './useSnapGuides'

interface Props {
  id: string
}

interface InnerProps {
  id: string
  obj: GuidelineObject
}

function CanvasGuidelineNodeInner({ id, obj }: InnerProps): React.ReactElement | null {
  const isSelected = useCanvasStore((s) => s.selectedId === id)
  const updateObject = useCanvasStore((s) => s.updateObject)
  const commitUpdate = useCanvasStore((s) => s.commitUpdate)
  const startDrag = useCanvasStore((s) => s.startDrag)
  const setSelected = useCanvasStore((s) => s.setSelected)
  const frameWidth = useCanvasStore((s) => s.frameWidth)
  const frameHeight = useCanvasStore((s) => s.frameHeight)
  const frameCount = useCanvasStore((s) => s.frameCount)
  const { computeSnap, startSnapSession, endSnapSession } = useSnapGuides()

  const totalWidth = frameWidth * frameCount

  // Position encoded in node x/y so node.y() == obj.position during drag.
  // Points are relative to node origin (always start at 0 on the position axis).
  // This avoids the double-speed bug: updateObject sets position = node.y/x,
  // React re-renders with the same value — no compounding offset.
  const nodeX = obj.orientation === 'horizontal'
    ? (obj.spanAllFrames ? 0 : obj.frameIndex * frameWidth)
    : obj.position
  const nodeY = obj.orientation === 'horizontal' ? obj.position : 0

  const linePoints = obj.orientation === 'horizontal'
    ? [0, 0, obj.spanAllFrames ? totalWidth : frameWidth, 0]
    : [0, 0, 0, frameHeight]

  // fixedX/fixedY are the axes that must not move during drag
  const fixedX = obj.orientation === 'horizontal'
    ? (obj.spanAllFrames ? 0 : obj.frameIndex * frameWidth)
    : undefined
  const fixedY = obj.orientation === 'vertical' ? 0 : undefined

  return (
    <KonvaLine
      x={nodeX}
      y={nodeY}
      points={linePoints}
      stroke={isSelected ? '#2171c7' : '#4A90E2'}
      strokeWidth={isSelected ? 2 : 1}
      strokeScaleEnabled={false}
      dash={[8, 6]}
      listening={!obj.locked}
      draggable={!obj.locked}
      hitStrokeWidth={12}
      perfectDrawEnabled={false}
      onMouseEnter={(e) => {
        const container = e.target.getStage()?.container()
        if (container) container.style.cursor = obj.orientation === 'horizontal' ? 'ns-resize' : 'ew-resize'
      }}
      onMouseLeave={(e) => {
        const container = e.target.getStage()?.container()
        if (container) container.style.cursor = ''
      }}
      onClick={() => {
        if (!obj.locked) setSelected(id)
      }}
      onDragStart={() => {
        startDrag()
        startSnapSession(id)
        setSelected(id)
      }}
      onDragMove={(e) => {
        const node = e.target as Konva.Node
        if (obj.orientation === 'horizontal') {
          // Enforce x stays on its axis
          if (fixedX !== undefined) node.x(fixedX)
          const { y: snappedY } = computeSnap(
            { x: 0, y: node.y(), width: totalWidth, height: 0 },
            id,
          )
          node.y(snappedY)
          updateObject(id, { position: snappedY })
        } else {
          // Enforce y stays at 0
          if (fixedY !== undefined) node.y(fixedY)
          const { x: snappedX } = computeSnap(
            { x: node.x(), y: 0, width: 0, height: frameHeight },
            id,
          )
          node.x(snappedX)
          updateObject(id, { position: snappedX })
        }
      }}
      onDragEnd={(e) => {
        const node = e.target as Konva.Node
        const finalPosition = obj.orientation === 'horizontal' ? node.y() : node.x()
        commitUpdate(id, { position: finalPosition })
        endSnapSession()
      }}
    />
  )
}

function CanvasGuidelineNodeOuter({ id }: Props): React.ReactElement | null {
  const obj = useCanvasStore((s) => s.objects[id] as GuidelineObject | undefined)
  const guidelinesVisible = useCanvasStore((s) => s.guidelinesVisible)
  if (!obj || obj.type !== 'guideline') return null
  if (!obj.visible || !guidelinesVisible) return null
  return <CanvasGuidelineNodeInner id={id} obj={obj} />
}

export const CanvasGuidelineNode = React.memo(CanvasGuidelineNodeOuter)
