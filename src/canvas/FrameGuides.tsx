import React from 'react'
import { Rect, Group } from 'react-konva'
import { useCanvasStore } from './useCanvasStore'

interface FrameGuidesProps {
  frameCount: number
  frameHeight: number
}

export function FrameGuides({ frameCount, frameHeight }: FrameGuidesProps): React.ReactElement {
  const frameWidth = useCanvasStore((s) => s.frameWidth)
  const totalWidth = frameCount * frameWidth

  return (
    <Group>
      {/* Invisible outer border for reference */}
      <Rect
        x={0}
        y={0}
        width={totalWidth}
        height={frameHeight}
        fill="transparent"
        listening={false}
      />
    </Group>
  )
}
