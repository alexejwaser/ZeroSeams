import React from 'react'
import { ACCENT, SNAP_GUIDE_FRAME } from './constants'
import { Line } from 'react-konva'
import type { SnapGuide } from './useSnapGuides'

interface SnapGuidesProps {
  guides: SnapGuide[]
  totalWidth: number
  totalHeight: number
}

export function SnapGuides({ guides, totalWidth, totalHeight }: SnapGuidesProps): React.ReactElement {
  return (
    <>
      {guides.map((guide, index) => {
        const color = guide.kind === 'frame' ? SNAP_GUIDE_FRAME : ACCENT
        if (guide.orientation === 'h') {
          return (
            <Line
              key={`guide-h-${index}`}
              points={[0, guide.position, totalWidth, guide.position]}
              stroke={color}
              strokeWidth={1}
              strokeScaleEnabled={false}
              perfectDrawEnabled={false}
              listening={false}
            />
          )
        }
        return (
          <Line
            key={`guide-v-${index}`}
            points={[guide.position, 0, guide.position, totalHeight]}
            stroke={color}
            strokeWidth={1}
            strokeScaleEnabled={false}
            perfectDrawEnabled={false}
            listening={false}
          />
        )
      })}
    </>
  )
}
