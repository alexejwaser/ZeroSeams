import React, { useCallback } from 'react'
import { useCanvasStore } from './useCanvasStore'
import { useViewportStore } from './useViewportStore'
import { CANVAS_SCALE } from './constants'
import type { ImageObject } from '../types/canvas'

/**
 * HTML overlay that renders "+ image" / "+ video" buttons centred over every
 * empty grid cell (ImageObject with isEmpty === true).
 *
 * Coordinate system: identical to the frame-labels strip in CarouselStage —
 * absolute-positioned inside the `position: relative` container div, using
 *   left = panX + cell.frameX * CANVAS_SCALE * zoom
 *   top  = panY + cell.frameY * CANVAS_SCALE * zoom
 * No `position: fixed` — the container is the reference.
 */
export function GridCellOverlay() {
  const objects = useCanvasStore((s) => s.objects)
  const objectOrder = useCanvasStore((s) => s.objectOrder)
  const panX = useViewportStore((s) => s.panX)
  const panY = useViewportStore((s) => s.panY)
  const zoom = useViewportStore((s) => s.zoom)

  const handleFillImage = useCallback(async (cellId: string) => {
    const result = await window.electronAPI.openImageFile()
    if (result.canceled || !result.data) return

    const frame = useCanvasStore.getState().objects[cellId] as ImageObject | undefined
    if (!frame) return

    const img = new Image()
    img.src = result.data
    await img.decode()

    const scale = Math.max(
      frame.frameWidth / img.naturalWidth,
      frame.frameHeight / img.naturalHeight,
    )
    const cw = img.naturalWidth * scale
    const ch = img.naturalHeight * scale

    useCanvasStore.getState().commitUpdate(cellId, {
      isEmpty: false,
      src: result.data,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      contentWidth: cw,
      contentHeight: ch,
      contentOffsetX: (frame.frameWidth - cw) / 2,
      contentOffsetY: (frame.frameHeight - ch) / 2,
    } as any)
  }, [])

  // TODO: Convert the empty ImageObject cell to a VideoObject.
  // Changing `type` via commitUpdate requires store support for type mutation
  // (currently not implemented). For now this is a stub — implement alongside
  // the VideoObject cell type once the store action is available.
  const handleFillVideo = useCallback(async (_cellId: string) => {
    console.warn('[GridCellOverlay] Video cell fill not yet implemented.')
  }, [])

  const scale = CANVAS_SCALE * zoom

  const emptyCells = objectOrder
    .map((id) => objects[id])
    .filter((obj): obj is ImageObject =>
      obj?.type === 'image' && (obj as ImageObject).isEmpty === true,
    )

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {emptyCells.map((cell) => {
        const left = panX + cell.frameX * scale
        const top = panY + cell.frameY * scale
        const w = cell.frameWidth * scale
        const h = cell.frameHeight * scale

        return (
          <div
            key={cell.id}
            style={{
              position: 'absolute',
              left,
              top,
              width: w,
              height: h,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              pointerEvents: 'auto',
            }}
          >
            <button
              onClick={() => handleFillImage(cell.id)}
              style={{
                background: 'rgba(255,255,255,0.9)',
                border: '1px solid #d4ccc2',
                borderRadius: 999,
                padding: '4px 10px',
                fontSize: 11,
                fontFamily: 'var(--font)',
                color: '#111111',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              + image
            </button>
            <button
              onClick={() => handleFillVideo(cell.id)}
              style={{
                background: 'rgba(255,255,255,0.9)',
                border: '1px solid #d4ccc2',
                borderRadius: 999,
                padding: '4px 10px',
                fontSize: 11,
                fontFamily: 'var(--font)',
                color: '#111111',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              + video
            </button>
          </div>
        )
      })}
    </div>
  )
}
