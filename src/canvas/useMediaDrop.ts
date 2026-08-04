// The single drag-and-drop entry point for media. Replaces useImageDrop +
// useVideoDrop, which were both registered on the same container and both handled
// video: they only avoided double-adding because the image hook bailed on a falsy
// `file.path`, and that path was ALWAYS falsy (Electron 32 removed File.path).
// Fixing the path without merging the hooks would have produced two objects per
// dropped video. One listener, one classification rule, one placement path.

import { useEffect } from 'react'
import type React from 'react'
import { useCanvasStore } from './useCanvasStore'
import { useViewportStore, getCanvasScale } from './useViewportStore'
import { findDropTargetId } from './geometry'
import { loadVideoMetadata } from './videoMetadata'
import { buildImageObject, buildVideoObject, type Point } from './mediaPlacement'

// .mov routinely arrives from Finder with an empty `type`, so extension is a
// necessary second test — MIME alone silently ignored those drops.
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v']
const VIDEO_EXTS = ['.mp4', '.mov', '.webm', '.m4v']

function isVideoFile(f: File): boolean {
  return (
    VIDEO_TYPES.includes(f.type) ||
    f.type.startsWith('video/') ||
    VIDEO_EXTS.some((ext) => f.name.toLowerCase().endsWith(ext))
  )
}

function baseName(f: File): string {
  return f.name.replace(/\.[^.]+$/, '')
}

/** Read intrinsic dimensions from a blob URL — readable even when the file's
 *  on-disk path is unavailable, unlike the zeroseams-media:// protocol. */
async function readVideoMeta(
  file: File,
): Promise<{ naturalWidth: number; naturalHeight: number; naturalDuration: number } | null> {
  const objectUrl = URL.createObjectURL(file)
  try {
    return await loadVideoMetadata(objectUrl)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function readImage(file: File): Promise<{ src: string; naturalWidth: number; naturalHeight: number } | null> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onerror = () => { resolve(null) }
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result
      if (typeof dataUrl !== 'string') { resolve(null); return }
      const img = new Image()
      img.onerror = () => { resolve(null) }
      img.onload = () => {
        resolve({ src: dataUrl, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight })
      }
      img.src = dataUrl
    }
    reader.readAsDataURL(file)
  })
}

export function useMediaDrop(containerRef: React.RefObject<HTMLDivElement>): void {
  const addObject = useCanvasStore((s) => s.addObject)
  const objectOrder = useCanvasStore((s) => s.objectOrder)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Both handlers must ignore non-file drags: the frame-reorder gesture uses
    // pointer events on this same container, and swallowing them breaks it.
    function handleDragOver(e: DragEvent): void {
      if (!e.dataTransfer?.types.includes('Files')) return
      e.preventDefault()
      e.stopPropagation()
    }

    function handleDrop(e: DragEvent): void {
      if (!e.dataTransfer?.types.includes('Files')) return
      e.preventDefault()
      e.stopPropagation()

      // Capture drop coordinates synchronously — the event is gone after any await.
      const rect = containerRef.current!.getBoundingClientRect()
      const { panX, panY } = useViewportStore.getState()
      const scale = getCanvasScale()
      const at: Point = {
        x: (e.clientX - rect.left - panX) / scale,
        y: (e.clientY - rect.top - panY) / scale,
      }

      const files = Array.from(e.dataTransfer.files)
      if (files.length === 0) return

      // File objects do not survive an await, so resolve every path up front.
      const dropped = files.map((file) => ({
        file,
        isVideo: isVideoFile(file),
        // '' when the OS has no path for this File; the video branch rejects it.
        path: window.electronAPI?.getPathForFile(file) ?? '',
      }))

      const media = dropped.filter((d) => d.isVideo || d.file.type.startsWith('image/'))
      if (media.length === 0) return

      void placeAll(media, at)
    }

    /** Drop onto an empty frame / fillable shape fills it; otherwise standalone. */
    async function placeAll(
      items: Array<{ file: File; isVideo: boolean; path: string }>,
      at: Point,
    ): Promise<void> {
      const { objects, objectOrder: order } = useCanvasStore.getState()
      const targetId = findDropTargetId(at.x, at.y, objects, order)

      for (const [index, item] of items.entries()) {
        // Only the first file can claim the drop target; the rest go standalone
        // next to it rather than overwriting each other in the same frame.
        const claimTarget = index === 0 ? targetId : null
        if (item.isVideo) {
          await placeVideo(item.file, item.path, at, index, claimTarget)
        } else {
          await placeImage(item.file, at, index, claimTarget)
        }
      }
    }

    async function placeImage(
      file: File, at: Point, index: number, targetId: string | null,
    ): Promise<void> {
      const meta = await readImage(file)
      if (!meta) return
      if (targetId) {
        const inserted = useCanvasStore.getState().insertMediaIntoShape(targetId, {
          kind: 'image',
          src: meta.src,
          naturalWidth: meta.naturalWidth,
          naturalHeight: meta.naturalHeight,
        })
        if (inserted) return
        // Target could not hold media (line/arrow/open path, degenerate bbox) —
        // place standalone rather than dropping the file on the floor.
      }
      useCanvasStore.getState().addObject(
        buildImageObject({ ...meta, name: baseName(file), at, index }),
      )
    }

    async function placeVideo(
      file: File, filePath: string, at: Point, index: number, targetId: string | null,
    ): Promise<void> {
      // Without a real path the media protocol 404s and the node renders nothing
      // while still occupying a layer row — the exact failure this hook was fixed
      // for. Refuse the drop loudly instead of adding an invisible object.
      if (!filePath) {
        console.error('[useMediaDrop] no filesystem path for dropped video', file.name)
        return
      }
      const meta = await readVideoMeta(file)
      if (!meta) return
      const name = baseName(file)
      if (targetId) {
        const inserted = useCanvasStore.getState().insertMediaIntoShape(targetId, {
          kind: 'video', filePath, name, ...meta,
        })
        if (inserted) return
      }
      // The layer thumbnail lands later: CanvasVideoNode asks for a redraw once
      // its element has actually decoded and seeked (#84). Nothing to do here —
      // no element exists yet at this point.
      useCanvasStore.getState().addObject(
        buildVideoObject({ filePath, name, at, index, ...meta }),
      )
    }

    container.addEventListener('dragover', handleDragOver)
    container.addEventListener('drop', handleDrop)

    return () => {
      container.removeEventListener('dragover', handleDragOver)
      container.removeEventListener('drop', handleDrop)
    }
    // objectOrder.length changes as objects are added; re-register to capture latest zIndex
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, addObject, objectOrder.length])
}
