import React, { useCallback } from 'react'
import { useCanvasStore } from './useCanvasStore'
import { useViewportStore, selectScale } from './useViewportStore'
import type { ImageObject, VideoObject } from '../types/canvas'

/**
 * HTML overlay that renders "+ image" / "+ video" buttons centred over every
 * empty grid cell (ImageObject with isEmpty === true).
 *
 * Coordinate system: identical to the frame-labels strip in CarouselStage —
 * absolute-positioned inside the `position: relative` container div, using
 *   left = panX + cell.frameX * scale
 *   top  = panY + cell.frameY * scale
 */
export function GridCellOverlay() {
  const objects = useCanvasStore((s) => s.objects)
  const objectOrder = useCanvasStore((s) => s.objectOrder)
  const panX = useViewportStore((s) => s.panX)
  const panY = useViewportStore((s) => s.panY)
  const scale = useViewportStore(selectScale)

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

  const handleFillVideo = useCallback(async (cellId: string) => {
    const result = await window.electronAPI.openVideoFile()
    if (result.canceled || !result.filePath) return

    const frame = useCanvasStore.getState().objects[cellId] as ImageObject | undefined
    if (!frame) return

    const filePath = result.filePath
    const rawName = filePath.split('/').pop()?.replace(/\.[^.]+$/, '') ?? 'video'

    await new Promise<void>((resolve) => {
      const vid = document.createElement('video')
      vid.preload = 'metadata'
      const onMeta = () => {
        if (!isFinite(vid.duration) || vid.duration <= 0) return
        vid.removeEventListener('durationchange', onMeta)

        // Cover-fit video into the cell frame
        const s = Math.max(frame.frameWidth / vid.videoWidth, frame.frameHeight / vid.videoHeight)
        const cw = vid.videoWidth * s
        const ch = vid.videoHeight * s

        const videoObj: VideoObject = {
          id: crypto.randomUUID(),
          type: 'video',
          scope: 'global',
          name: rawName,
          filePath,
          muted: false,
          naturalWidth: vid.videoWidth,
          naturalHeight: vid.videoHeight,
          naturalDuration: vid.duration,
          frameX: frame.frameX,
          frameY: frame.frameY,
          frameWidth: frame.frameWidth,
          frameHeight: frame.frameHeight,
          contentOffsetX: (frame.frameWidth - cw) / 2,
          contentOffsetY: (frame.frameHeight - ch) / 2,
          contentWidth: cw,
          contentHeight: ch,
          contentEditMode: false,
          x: frame.frameX,
          y: frame.frameY,
          width: frame.frameWidth,
          height: frame.frameHeight,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          opacity: 1,
          visible: true,
          locked: false,
          zIndex: frame.zIndex,
        }

        vid.src = ''
        useCanvasStore.getState().replaceGridCell(cellId, videoObj)
        resolve()
      }
      vid.addEventListener('durationchange', onMeta)
      vid.onerror = () => resolve()
      vid.src = `zeroseams-media://localhost${filePath}`
    })
  }, [])

  const emptyCells = objectOrder
    .map((id) => objects[id])
    .filter((obj): obj is ImageObject =>
      obj?.type === 'image' && (obj as ImageObject).isEmpty === true,
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
              // Container is transparent to pointer events — only the buttons intercept.
              // This lets single-clicks on empty cell space pass through to the Konva group hit rect.
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
