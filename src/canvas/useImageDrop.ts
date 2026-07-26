import { useEffect } from 'react'
import type React from 'react'
import { useCanvasStore } from './useCanvasStore'
import { useViewportStore, getCanvasScale } from './useViewportStore'
import { findDropTargetId } from './geometry'

export function useImageDrop(containerRef: React.RefObject<HTMLDivElement>): void {
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
      const { panX, panY } = useViewportStore.getState()
      const scale = getCanvasScale()
      const canvasX = (e.clientX - rect.left - panX) / scale
      const canvasY = (e.clientY - rect.top - panY) / scale

      const files = Array.from(e.dataTransfer?.files ?? [])

      // Drop-on-shape: if the drop point lands on an empty frame or a fillable
      // shape/closed-path, insert the media there instead of adding standalone.
      const { objects, objectOrder: order } = useCanvasStore.getState()
      const targetId = findDropTargetId(canvasX, canvasY, objects, order)

      const videoFiles = files.filter((f) => f.type.startsWith('video/'))

      if (targetId) {
        // Video wins on frames: if the drop contains ANY video, let useVideoDrop
        // own the target insertion. Bail before the image target-insert branch so
        // the two hooks never both write to the same frame (last-write-wins race).
        if (videoFiles.length > 0) return

        const imageFile = files.find((f) => f.type.startsWith('image/'))
        if (imageFile) {
          const reader = new FileReader()
          reader.onload = (readerEvent) => {
            const dataUrl = readerEvent.target?.result
            if (typeof dataUrl !== 'string') return
            const img = new Image()
            img.onload = () => {
              const store = useCanvasStore.getState()
              const t = store.objects[targetId]
              if (!t) return
              if (t.type === 'shape' || t.type === 'path') store.convertShapeToFrame(targetId)
              useCanvasStore.getState().insertMediaIntoFrame(targetId, {
                kind: 'image',
                src: dataUrl,
                naturalWidth: img.naturalWidth,
                naturalHeight: img.naturalHeight,
              })
            }
            img.src = dataUrl
          }
          reader.readAsDataURL(imageFile)
          return
        }
      }

      if (videoFiles.length > 0) {
        videoFiles.forEach((videoFile, index) => {
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
            const frameX = canvasX - w / 2 + index * 30
            const frameY = canvasY - h / 2 + index * 30
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
        })
        return
      }

      const imageFiles = files.filter((f) => f.type.startsWith('image/'))
      if (imageFiles.length === 0) return

      imageFiles.forEach((imageFile, index) => {
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

            const frameX = canvasX - w / 2 + index * 30
            const frameY = canvasY - h / 2 + index * 30

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
      })
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
