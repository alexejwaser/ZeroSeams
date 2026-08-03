import { useEffect, useRef, useState } from 'react'
import { useCanvasStore } from './useCanvasStore'
import { useSaveStatusStore, useSwatchStore, type SaveStatus } from '@/store'
import { serializeProject } from '@/io/projectFile'

/** The parts of the canvas store that actually end up in the file. Everything
 *  else the store holds — selection, active tool, snap toggle, preview mode,
 *  undo stacks — is session state and must not trigger a save. */
interface ContentSignature {
  objects: unknown
  objectOrder: unknown
  frames: unknown
  frameCount: number
  frameWidth: number
  frameHeight: number
  ratio: unknown
  platform: unknown
  backgroundColor: string
}

function contentSignature(s: ReturnType<typeof useCanvasStore.getState>): ContentSignature {
  return {
    objects: s.objects,
    objectOrder: s.objectOrder,
    frames: s.frames,
    frameCount: s.frameCount,
    frameWidth: s.frameWidth,
    frameHeight: s.frameHeight,
    ratio: s.ratio,
    platform: s.platform,
    backgroundColor: s.backgroundColor,
  }
}

/** Reference comparison is enough: the store replaces these immutably on every
 *  real edit (CLAUDE.md forbids mutating a CanvasObject in place). */
function contentChanged(a: ContentSignature, b: ContentSignature): boolean {
  return (
    a.objects !== b.objects ||
    a.objectOrder !== b.objectOrder ||
    a.frames !== b.frames ||
    a.frameCount !== b.frameCount ||
    a.frameWidth !== b.frameWidth ||
    a.frameHeight !== b.frameHeight ||
    a.ratio !== b.ratio ||
    a.platform !== b.platform ||
    a.backgroundColor !== b.backgroundColor
  )
}

export function useAutosave(): { status: SaveStatus; lastSavedAt: string | null } {
  const setStoreStatus = useSaveStatusStore((s) => s.setStatus)
  const setStoreLastSavedAt = useSaveStatusStore((s) => s.setLastSavedAt)

  // Local mirror for the return value (kept in sync with the store)
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep local state in sync with the shared store so callers of this hook
  // see the same values without an extra store subscription.
  function applyStatus(next: SaveStatus): void {
    setStatus(next)
    setStoreStatus(next)
  }

  function applyLastSavedAt(at: string): void {
    setLastSavedAt(at)
    setStoreLastSavedAt(at)
  }

  const lastContentRef = useRef<ContentSignature | null>(null)

  useEffect(() => {
    lastContentRef.current = contentSignature(useCanvasStore.getState())

    function markDirtyAndSchedule(): void {
      const save = useSaveStatusStore.getState()
      if (!save.dirty) save.setDirty(true)

      // No document, no file: never invent one. This is the path that used to
      // create ~/Documents/ZeroSeams/untitled.zeroseams on the first mouse move
      // after a cold start, clobbering whatever was there before.
      if (!save.documentReady || !save.currentFilePath) return

      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current)
      }

      debounceRef.current = setTimeout(() => {
        debounceRef.current = null

        const saveStore = useSaveStatusStore.getState()
        const currentFilePath = saveStore.currentFilePath
        if (!saveStore.documentReady || !currentFilePath) return

        applyStatus('saving')

        window.electronAPI.saveProject(currentFilePath, serializeProject())
          .then(() => {
            applyStatus('saved')
            useSaveStatusStore.getState().setDirty(false)
            const savedAt = new Date().toISOString()
            applyLastSavedAt(savedAt)

            setTimeout(() => {
              applyStatus('idle')
            }, 3000)
          })
          .catch(() => {
            applyStatus('error')
          })
      }, 2000)
    }

    const unsubscribeCanvas = useCanvasStore.subscribe(() => {
      // The store fires on selection, tool switches and viewport-ish flags too.
      // Treating those as edits marked the document dirty and rewrote the file
      // when nothing about it had actually changed.
      const next = contentSignature(useCanvasStore.getState())
      if (lastContentRef.current !== null && !contentChanged(lastContentRef.current, next)) return
      lastContentRef.current = next
      markDirtyAndSchedule()
    })

    // File swatches live outside useCanvasStore (they must not enter the undo
    // stack), so the canvas subscription above can't see them — without this a
    // swatch saved as the last action before quitting would be lost.
    const unsubscribeSwatches = useSwatchStore.subscribe((state, prev) => {
      if (state.file === prev.file) return
      markDirtyAndSchedule()
    })

    return () => {
      unsubscribeCanvas()
      unsubscribeSwatches()
      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { status, lastSavedAt }
}
