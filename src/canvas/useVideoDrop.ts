import { useEffect } from 'react'
import type React from 'react'
import { useCanvasStore } from './useCanvasStore'
import { useViewportStore, getCanvasScale } from './useViewportStore'
import { findDropTargetId } from './geometry'
import { loadVideoMetadata } from './videoMetadata'

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
      const { panX, panY } = useViewportStore.getState()
      const scale = getCanvasScale()
      const canvasX = (e.clientX - rect.left - panX) / scale
      const canvasY = (e.clientY - rect.top - panY) / scale

      const ACCEPTED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v']
      const ACCEPTED_EXTS = ['.mp4', '.mov', '.webm', '.m4v']
      const videoFiles = Array.from(e.dataTransfer?.files ?? []).filter(
        (f) =>
          ACCEPTED_TYPES.includes(f.type) ||
          ACCEPTED_EXTS.some((ext) => f.name.toLowerCase().endsWith(ext)),
      ) as ElectronFile[]
      if (videoFiles.length === 0) return

      // Standalone placement — also the fallback when a drop target turns out not
      // to be able to hold media (line/arrow, open path, degenerate bbox).
      function addStandaloneVideo(
        absolutePath: string, rawName: string,
        w: number, h: number, dur: number, index: number,
      ): void {
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

      // Read metadata once per file, then either fill a frame or place standalone.
      // Goes through the shared loader so dimensions are guaranteed non-zero —
      // a 0 makes fitCover stretch the video to the frame instead of cover-cropping.
      function withMetadata(
        file: ElectronFile,
        done: (w: number, h: number, dur: number) => void,
      ): void {
        const objectUrl = URL.createObjectURL(file)
        void loadVideoMetadata(objectUrl).then((meta) => {
          URL.revokeObjectURL(objectUrl)
          if (!meta) return
          done(meta.naturalWidth, meta.naturalHeight, meta.naturalDuration)
        })
      }

      // Drop-on-shape: insert the first video into an empty frame or fillable
      // shape/closed-path under the drop point instead of adding standalone.
      const { objects, objectOrder: order } = useCanvasStore.getState()
      const targetId = findDropTargetId(canvasX, canvasY, objects, order)
      if (targetId) {
        const file = videoFiles[0]
        const absolutePath = file.path
        const rawName = file.name.replace(/\.[^.]+$/, '')
        withMetadata(file, (w, h, dur) => {
          // One store call: converts the shape AND fills it, one undo step.
          const inserted = useCanvasStore.getState().insertMediaIntoShape(targetId, {
            kind: 'video',
            filePath: absolutePath,
            naturalWidth: w,
            naturalHeight: h,
            naturalDuration: dur,
            name: rawName,
          })
          // Target couldn't hold media — place it standalone rather than
          // silently dropping the file on the floor.
          if (!inserted) addStandaloneVideo(absolutePath, rawName, w, h, dur, 0)
        })
        return
      }

      videoFiles.forEach((file, index) => {
        const rawName = file.name.replace(/\.[^.]+$/, '')
        const absolutePath = file.path
        withMetadata(file, (w, h, dur) => {
          addStandaloneVideo(absolutePath, rawName, w, h, dur, index)
        })
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
