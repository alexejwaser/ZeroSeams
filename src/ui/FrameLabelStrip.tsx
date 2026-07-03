import React from 'react'
import type { Frame, FrameDragState } from '@/types/project'
import { ColorInput } from './ColorInput'
import Tooltip from './Tooltip'

// Returns how many slots frame i should shift during a reorder preview.
function frameSlotOffset(i: number, from: number, to: number): number {
  if (i === from) return 0
  if (from < to && i > from && i <= to) return -1
  if (from > to && i >= to && i < from) return +1
  return 0
}

interface FrameLabelStripProps {
  frames: Frame[]
  frameCount: number
  frameWidth: number
  frameHeight: number
  backgroundColor: string
  panX: number
  panY: number
  scale: number
  frameDrag: FrameDragState | null
  framePreviews: string[] | null
  setFrameBackground: (index: number, color: string | null) => void
  /** Starts the frame-reorder drag; the owning stage keeps the drag state
   *  machine and canvas preview capture. Must be attached via onPointerDown
   *  on the grip only — the container div owns move/up (see CLAUDE.md
   *  "Frame Reordering"). */
  onGripPointerDown: (index: number, e: React.PointerEvent<HTMLSpanElement>) => void
}

/**
 * HTML overlay strip above the canvas: per-frame label pill (drag grip,
 * color swatch, reset, "Frame N") plus the animated frame previews shown
 * during a reorder drag. Positioning follows the canvas viewport via
 * panX/panY/scale; pills animate with translateX (ColorInput therefore
 * needs `fixed` — a transform ancestor breaks position:fixed).
 */
export function FrameLabelStrip({
  frames,
  frameCount,
  frameWidth,
  frameHeight,
  backgroundColor,
  panX,
  panY,
  scale,
  frameDrag,
  framePreviews,
  setFrameBackground,
  onGripPointerDown,
}: FrameLabelStripProps): React.ReactElement {
  const previewTo = frameDrag
    ? Math.max(0, Math.min(frameCount - 1,
        Math.round((frameDrag.currentClientX - frameDrag.containerLeft - panX) / scale / frameWidth)
      ))
    : null
  const labelTop = Math.max(4, panY - 22)
  const dispW = frameWidth * scale
  const dispH = frameHeight * scale

  return (
    <>
      {/* Dragged frame: combined label pill + full frame preview, follows cursor */}
      {frameDrag && (
        <div
          style={{
            position: 'absolute',
            left: panX + frameDrag.fromIndex * frameWidth * scale + (frameDrag.currentClientX - frameDrag.startClientX),
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
        const labelX = panX + i * frameWidth * scale
        const isDragging = frameDrag?.fromIndex === i
        const txPx = (frameDrag && previewTo !== null)
          ? frameSlotOffset(i, frameDrag.fromIndex, previewTo) * frameWidth * scale
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
              <Tooltip label="Drag to reorder frame">
                <span
                  style={{ cursor: frameDrag ? 'grabbing' : 'grab', color: 'var(--text-muted)', fontSize: 12, lineHeight: 1, padding: '0 2px', userSelect: 'none' }}
                  onPointerDown={(e) => { onGripPointerDown(i, e) }}
                >
                  ⣿
                </span>
              </Tooltip>
              <ColorInput
                value={displayColor}
                onChange={c => setFrameBackground(i, c)}
                size={14}
                fixed
              />
              {frameColor && (
                <Tooltip label="Reset to canvas background">
                  <button
                    onClick={e => { e.stopPropagation(); setFrameBackground(i, null) }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, fontSize: 13, lineHeight: 1, display: 'flex', alignItems: 'center' }}
                  >
                    ×
                  </button>
                </Tooltip>
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
}
