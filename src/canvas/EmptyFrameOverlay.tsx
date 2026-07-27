import React, { useCallback } from 'react'
import { useCanvasStore } from './useCanvasStore'
import { useViewportStore, selectScale } from './useViewportStore'
import { loadVideoMetadataFromPath } from './videoMetadata'
import type { ImageObject } from '@/types/canvas'

/**
 * HTML overlay that renders "+ image" / "+ video" buttons centred over every
 * empty media frame (ImageObject with isEmpty === true) — grid cells and
 * standalone shape-derived frames alike. Filling routes through the frozen
 * `insertMediaIntoFrame` store action so behaviour is identical everywhere.
 *
 * Coordinate system: identical to the frame-labels strip in CarouselStage —
 * absolute-positioned inside the `position: relative` container div, using
 *   left = panX + cell.frameX * scale
 *   top  = panY + cell.frameY * scale
 *
 * pointerEvents: the container is transparent (none) so single-clicks on empty
 * cell space pass through to the Konva group hit rect; only the buttons capture.
 */
export function EmptyFrameOverlay() {
  const objects = useCanvasStore((s) => s.objects)
  const objectOrder = useCanvasStore((s) => s.objectOrder)
  const panX = useViewportStore((s) => s.panX)
  const panY = useViewportStore((s) => s.panY)
  const scale = useViewportStore(selectScale)

  const handleFillImage = useCallback(async (cellId: string) => {
    const result = await window.electronAPI.openImageFile()
    if (result.canceled || !result.data) return
    if (!useCanvasStore.getState().objects[cellId]) return

    const img = new Image()
    img.src = result.data
    await img.decode()

    useCanvasStore.getState().insertMediaIntoFrame(cellId, {
      kind: 'image',
      src: result.data,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
    })
  }, [])

  const handleFillVideo = useCallback(async (cellId: string) => {
    const result = await window.electronAPI.openVideoFile()
    if (result.canceled || !result.filePath) return
    if (!useCanvasStore.getState().objects[cellId]) return

    const filePath = result.filePath
    const rawName = filePath.split('/').pop()?.replace(/\.[^.]+$/, '') ?? 'video'

    // Real dimensions required — a 0 makes fitCover fall back to the frame size,
    // stretching the video instead of cover-cropping it.
    const meta = await loadVideoMetadataFromPath(filePath)
    if (!meta) return
    // The cell may have been deleted while metadata loaded.
    if (!useCanvasStore.getState().objects[cellId]) return

    useCanvasStore.getState().insertMediaIntoFrame(cellId, {
      kind: 'video',
      filePath,
      name: rawName,
      ...meta,
    })
  }, [])

  const emptyCells = objectOrder
    .map((id) => objects[id])
    .filter((obj): obj is ImageObject =>
      obj?.type === 'image' &&
      (obj as ImageObject).isEmpty === true &&
      // Hidden frames must not show floating +image/+video buttons.
      obj.visible !== false &&
      // The overlay is an axis-aligned HTML box; it can't track a rotated frame's
      // corners, so hide the buttons for any rotated frame (simplest v1 — the frame
      // stays fillable via drag-drop and the Properties panel).
      !obj.rotation,
    )

  const btnStyle: React.CSSProperties = {
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
    pointerEvents: 'auto',
  }

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
              pointerEvents: 'none',
            }}
          >
            <button onClick={() => { void handleFillImage(cell.id) }} style={btnStyle}>
              + image
            </button>
            <button onClick={() => { void handleFillVideo(cell.id) }} style={btnStyle}>
              + video
            </button>
          </div>
        )
      })}
    </div>
  )
}
