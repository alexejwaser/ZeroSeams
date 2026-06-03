import { useEffect } from 'react'
import type React from 'react'
import { useCanvasStore } from './useCanvasStore'

export function useImageDrop(containerRef: React.RefObject<HTMLDivElement>): void {
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

      const files = Array.from(e.dataTransfer?.files ?? [])

      const videoFile = files.find((f) => f.type.startsWith('video/'))
      if (videoFile) {
        const filePath = (videoFile as File & { path: string }).path
        if (!filePath) return
        const rawName = videoFile.name.replace(/\.[^.]+$/, '')

        const vid = document.createElement('video')
        vid.preload = 'metadata'
        const onMeta = () => {
          // durationchange fires when duration becomes finite; loadedmetadata can still be NaN
          if (!isFinite(vid.duration) || vid.duration <= 0) return
          vid.removeEventListener('durationchange', onMeta)
          const MAX_SIZE = 600
          const scale = Math.min(1, MAX_SIZE / Math.max(vid.videoWidth, vid.videoHeight))
          const w = Math.round(vid.videoWidth * scale)
          const h = Math.round(vid.videoHeight * scale)
          const frameX = frameWidth / 2 - w / 2
          const frameY = frameHeight / 2 - h / 2
          vid.src = ''

          addObject({
            id: crypto.randomUUID(),
            type: 'video',
            scope: 'global',
            name: rawName,
            filePath,
            muted: false,
            naturalWidth: vid.videoWidth,
            naturalHeight: vid.videoHeight,
            naturalDuration: vid.duration,
            frameX,
            frameY,
            frameWidth: w,
            frameHeight: h,
            contentOffsetX: 0,
            contentOffsetY: 0,
            contentWidth: w,
            contentHeight: h,
            contentEditMode: false,
            x: frameX,
            y: frameY,
            width: w,
            height: h,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            opacity: 1,
            visible: true,
            locked: false,
            zIndex: objectOrder.length,
          })
        }
        vid.addEventListener('durationchange', onMeta)
        vid.onerror = () => vid.removeEventListener('durationchange', onMeta)
        vid.src = `zeroseams-media://localhost${filePath}`
        return
      }

      const imageFile = files.find((f) => f.type.startsWith('image/'))
      if (!imageFile) return

      const rawName = imageFile.name.replace(/\.[^.]+$/, '')

      const reader = new FileReader()
      reader.onload = (readerEvent) => {
        const dataUrl = readerEvent.target?.result
        if (typeof dataUrl !== 'string') return

        // Load image to get natural dimensions before creating the object
        const img = new Image()
        img.onload = () => {
          const MAX_SIZE = 600
          const scale = Math.min(1, MAX_SIZE / Math.max(img.naturalWidth, img.naturalHeight))
          const w = Math.round(img.naturalWidth * scale)
          const h = Math.round(img.naturalHeight * scale)

          const frameX = frameWidth / 2 - w / 2
          const frameY = frameHeight / 2 - h / 2

          addObject({
            id: crypto.randomUUID(),
            type: 'image',
            scope: 'global',
            name: rawName,
            src: dataUrl,
            backgroundRemoved: false,
            frameX,
            frameY,
            frameWidth: w,
            frameHeight: h,
            contentOffsetX: 0,
            contentOffsetY: 0,
            contentWidth: w,
            contentHeight: h,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            contentEditMode: false,
            maskEditMode: false,
            // keep in sync with frame for compatibility
            x: frameX,
            y: frameY,
            width: w,
            height: h,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            opacity: 1,
            visible: true,
            locked: false,
            zIndex: objectOrder.length,
          })
        }
        img.src = dataUrl
      }
      reader.readAsDataURL(imageFile)
    }

    container.addEventListener('dragover', handleDragOver)
    container.addEventListener('drop', handleDrop)

    return () => {
      container.removeEventListener('dragover', handleDragOver)
      container.removeEventListener('drop', handleDrop)
    }
    // objectOrder.length changes as objects are added; re-register to capture latest zIndex
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, addObject, objectOrder.length, frameWidth, frameHeight])
}
