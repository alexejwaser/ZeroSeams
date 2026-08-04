// Clipboard support: ⌘C / ⌘X on canvas objects, and ⌘V for both canvas objects
// and external media (screenshots, files copied in Finder).
//
// Why ClipboardEvent listeners rather than keydowns in useKeyboardShortcuts:
// all three are native menu accelerators ({ role: 'copy' | 'cut' | 'paste' } in
// the Edit menu), and macOS consumes an accelerator before the document sees the
// keystroke — a keydown handler would simply never run. This is the same
// shadowing that forces ⌘Z/⌘A through handleMenuAction.
//
// The clipboard roles differ from those, though: instead of being swallowed, each
// dispatches its command to the focused webContents, which fires a real
// `copy`/`cut`/`paste` ClipboardEvent in the renderer. Listening for the event is
// therefore both reliable and free of a menu round-trip. It also keeps text
// fields working — the guard below returns early and the default DOM behaviour
// takes over.

import { useEffect } from 'react'
import { useCanvasStore } from './useCanvasStore'
import { copyObjects, cutObjects, getObjectClipboard } from './objectClipboard'
import { buildImageObject, buildVideoObject, defaultDropPoint } from './mediaPlacement'
import { loadVideoMetadata } from './videoMetadata'

/** True when focus is somewhere that owns its own clipboard behaviour. */
function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
}

function readImageFile(file: File): Promise<{ src: string; naturalWidth: number; naturalHeight: number } | null> {
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

export function useClipboard(): void {
  useEffect(() => {
    function handleCopy(e: ClipboardEvent): void {
      if (isTextEntry(e.target)) return
      // Never hijack a real text selection (e.g. text selected in a panel).
      if (!window.getSelection()?.isCollapsed) return
      if (copyObjects()) e.preventDefault()
    }

    function handleCut(e: ClipboardEvent): void {
      if (isTextEntry(e.target)) return
      if (!window.getSelection()?.isCollapsed) return
      if (cutObjects()) e.preventDefault()
    }

    function handlePaste(e: ClipboardEvent): void {
      if (isTextEntry(e.target)) return
      const data = e.clipboardData
      if (!data) return

      // External media wins over the in-app clipboard: if the user copied a file
      // or a screenshot after copying objects, that is the newer intent.
      const files = Array.from(data.files)
      const imageFile = files.find((f) => f.type.startsWith('image/'))
      const videoFile = files.find((f) => f.type.startsWith('video/'))

      if (imageFile || videoFile) {
        e.preventDefault()
        // Resolve the path synchronously — the File does not survive an await.
        const videoPath = videoFile ? window.electronAPI?.getPathForFile(videoFile) ?? '' : ''
        void pasteMedia(imageFile, videoFile, videoPath)
        return
      }

      const objects = getObjectClipboard()
      if (objects.length === 0) return
      e.preventDefault()
      useCanvasStore.getState().pasteObjects(objects, defaultDropPoint())
    }

    async function pasteMedia(
      imageFile: File | undefined,
      videoFile: File | undefined,
      videoPath: string,
    ): Promise<void> {
      const at = defaultDropPoint()
      if (imageFile) {
        const meta = await readImageFile(imageFile)
        if (meta) {
          useCanvasStore.getState().addObject(
            buildImageObject({ ...meta, name: imageFile.name.replace(/\.[^.]+$/, ''), at }),
          )
        }
      }
      if (videoFile) {
        // A clipboard bitmap has no on-disk path, and a video object without one
        // renders nothing while still occupying a layer row.
        if (!videoPath) {
          console.error('[useClipboard] no filesystem path for pasted video', videoFile.name)
          return
        }
        const objectUrl = URL.createObjectURL(videoFile)
        let meta
        try {
          meta = await loadVideoMetadata(objectUrl)
        } finally {
          URL.revokeObjectURL(objectUrl)
        }
        if (!meta) return
        useCanvasStore.getState().addObject(
          buildVideoObject({
            filePath: videoPath,
            name: videoFile.name.replace(/\.[^.]+$/, ''),
            at,
            ...meta,
          }),
        )
      }
    }

    document.addEventListener('copy', handleCopy)
    document.addEventListener('cut', handleCut)
    document.addEventListener('paste', handlePaste)
    return () => {
      document.removeEventListener('copy', handleCopy)
      document.removeEventListener('cut', handleCut)
      document.removeEventListener('paste', handlePaste)
    }
  }, [])
}
