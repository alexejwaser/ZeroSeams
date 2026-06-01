import { useEffect } from 'react'
import type React from 'react'
import { useCanvasStore } from './useCanvasStore'

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
      e.preventDefault()
      e.stopPropagation()
    }

    function handleDrop(e: DragEvent): void {
      e.preventDefault()
      e.stopPropagation()

      const ACCEPTED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v']
      const ACCEPTED_EXTS = ['.mp4', '.mov', '.webm', '.m4v']
      const file = Array.from(e.dataTransfer?.files ?? []).find((f) =>
        ACCEPTED_TYPES.includes(f.type) ||
        ACCEPTED_EXTS.some((ext) => f.name.toLowerCase().endsWith(ext)),
      ) as ElectronFile | undefined
      if (!file) return

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

        const frameX = frameWidth / 2 - frameW / 2
        const frameY = frameHeight / 2 - frameH / 2

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
