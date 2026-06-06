import { useEffect } from 'react'
import type React from 'react'
import { useCanvasStore } from './useCanvasStore'
import { useViewportStore } from './useViewportStore'
import { CANVAS_SCALE } from './constants'

interface ElectronFile extends File {
  readonly path: string
}

export function useVideoDrop(containerRef: React.RefObject<HTMLDivElement>): void {
  const addObject = useCanvasStore((s) => s.addObject)
  const objectOrder = useCanvasStore((s) => s.objectOrder)
  const frameWidth = useCanvasStore((s) => s.frameWidth)
  const frameHeight = useCanvasStore((s) => s.frameHeight)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    function handleDragOver(e: DragEvent): void {
      if (!e.dataTransfer?.types.includes('Files')) return
      e.preventDefault()
      e.stopPropagation()
    }

    function handleDrop(e: DragEvent): void {
      if (!e.dataTransfer?.types.includes('Files')) return
      e.preventDefault()
      e.stopPropagation()

      // Capture drop coordinates synchronously before any async work
      const rect = containerRef.current!.getBoundingClientRect()
      const { panX, panY, zoom } = useViewportStore.getState()
      const canvasX = (e.clientX - rect.left - panX) / (CANVAS_SCALE * zoom)
      const canvasY = (e.clientY - rect.top - panY) / (CANVAS_SCALE * zoom)

      const ACCEPTED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v']
      const ACCEPTED_EXTS = ['.mp4', '.mov', '.webm', '.m4v']
      const videoFiles = Array.from(e.dataTransfer?.files ?? []).filter(
        (f) =>
          ACCEPTED_TYPES.includes(f.type) ||
          ACCEPTED_EXTS.some((ext) => f.name.toLowerCase().endsWith(ext)),
      ) as ElectronFile[]
      if (videoFiles.length === 0) return

      videoFiles.forEach((file, index) => {
        const rawName = file.name.replace(/\.[^.]+$/, '')
        const absolutePath = file.path

        const vid = document.createElement('video')
        vid.preload = 'metadata'
        vid.onloadedmetadata = () => {
          const w = vid.videoWidth
          const h = vid.videoHeight
          const dur = vid.duration
          URL.revokeObjectURL(vid.src)

          const MAX_SIZE = 600
          const scale = Math.min(1, MAX_SIZE / Math.max(w, h))
          const frameW = Math.round(w * scale)
          const frameH = Math.round(h * scale)

          const frameX = canvasX - frameW / 2 + index * 30
          const frameY = canvasY - frameH / 2 + index * 30

          addObject({
            id: crypto.randomUUID(),
            type: 'video',
            scope: 'global',
            name: rawName,
            filePath: absolutePath,
            relativeFilePath: undefined,
            muted: false,
            naturalWidth: w,
            naturalHeight: h,
            naturalDuration: dur,
            frameX,
            frameY,
            frameWidth: frameW,
            frameHeight: frameH,
            contentOffsetX: 0,
            contentOffsetY: 0,
            contentWidth: frameW,
            contentHeight: frameH,
            contentEditMode: false,
            x: frameX,
            y: frameY,
            width: frameW,
            height: frameH,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            opacity: 1,
            visible: true,
            locked: false,
            zIndex: objectOrder.length,
          })
        }
        vid.src = URL.createObjectURL(file)
      })
    }

    container.addEventListener('dragover', handleDragOver)
    container.addEventListener('drop', handleDrop)

    return () => {
      container.removeEventListener('dragover', handleDragOver)
      container.removeEventListener('drop', handleDrop)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, addObject, objectOrder.length, frameWidth, frameHeight])
}
