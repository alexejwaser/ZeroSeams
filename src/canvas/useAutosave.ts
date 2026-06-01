import { useEffect, useRef, useState } from 'react'
import { useCanvasStore } from './useCanvasStore'
import type { CarouselProject } from '@/types/project'
import { useSaveStatusStore, type SaveStatus } from '@/ui/useSaveStatusStore'
import { relativizeVideoObjects } from './pathUtils'

export function useAutosave(): { status: SaveStatus; lastSavedAt: string | null } {
  const setStoreStatus = useSaveStatusStore((s) => s.setStatus)
  const setStoreLastSavedAt = useSaveStatusStore((s) => s.setLastSavedAt)

  // Local mirror for the return value (kept in sync with the store)
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)

  // versionRef is a local increment counter — stays in the hook
  const versionRef = useRef<number>(0)
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

  useEffect(() => {
    const unsubscribe = useCanvasStore.subscribe(() => {
      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current)
      }

      debounceRef.current = setTimeout(() => {
        debounceRef.current = null

        applyStatus('saving')

        const state = useCanvasStore.getState()
        const { frameCount, objects, objectOrder } = state

        const saveStore = useSaveStatusStore.getState()

        versionRef.current += 1

        const project: CarouselProject = {
          id: saveStore.projectId,
          name: saveStore.projectName,
          platform: state.platform,
          ratio: state.ratio,
          dimensions: { width: state.frameWidth, height: state.frameHeight },
          frameCount,
          frames: state.frames,
          backgroundColor: state.backgroundColor,
          objects: relativizeVideoObjects(objects, saveStore.currentFilePath),
          objectOrder,
          createdAt: saveStore.createdAt,
          updatedAt: new Date().toISOString(),
          version: versionRef.current,
        }

        const currentFilePath = saveStore.currentFilePath
        const savePromise = currentFilePath
          ? window.electronAPI.saveProject(currentFilePath, JSON.stringify(project))
          : window.electronAPI.autosaveProject(saveStore.projectFilename, JSON.stringify(project))

        savePromise
          .then((result) => {
            if (!currentFilePath && 'filePath' in result && result.filePath) {
              useSaveStatusStore.getState().setAutosaveFilePath(result.filePath)
            }
            applyStatus('saved')
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
    })

    return () => {
      unsubscribe()
      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { status, lastSavedAt }
}
