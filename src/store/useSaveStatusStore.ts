import { create } from 'zustand'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface SaveStatusState {
  status: SaveStatus
  /** Unsaved canvas changes since the last successful save/autosave. */
  dirty: boolean
  lastSavedAt: string | null
  projectId: string
  projectName: string
  projectFilename: string
  createdAt: string
  currentFilePath: string | null
  autosaveFilePath: string | null
  setStatus: (status: SaveStatus) => void
  setDirty: (dirty: boolean) => void
  setLastSavedAt: (at: string) => void
  setProjectMeta: (id: string, name: string, filename: string, createdAt: string) => void
  setCurrentFilePath: (path: string | null) => void
  setAutosaveFilePath: (path: string | null) => void
}

export const useSaveStatusStore = create<SaveStatusState>((set) => ({
  status: 'idle',
  dirty: false,
  lastSavedAt: null,
  projectId: crypto.randomUUID(),
  projectName: 'Untitled Project',
  projectFilename: 'untitled',
  createdAt: new Date().toISOString(),
  currentFilePath: null,
  autosaveFilePath: null,
  setStatus: (status) => set({ status }),
  setDirty: (dirty) => set({ dirty }),
  setLastSavedAt: (at) => set({ lastSavedAt: at }),
  setProjectMeta: (id, name, filename, createdAt) => set({ projectId: id, projectName: name, projectFilename: filename, createdAt }),
  setCurrentFilePath: (path) => set({ currentFilePath: path }),
  setAutosaveFilePath: (path) => set({ autosaveFilePath: path }),
}))

let idleTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Drive the SaveStatusPill through saving → saved/error around any save
 * promise (manual ⌘S, Save menu, autosave). Clears the dirty flag and
 * records lastSavedAt on success; 'saved' auto-fades to idle after 3s.
 */
export async function trackSave<T>(save: () => Promise<T>): Promise<T> {
  const store = useSaveStatusStore.getState()
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null }
  store.setStatus('saving')
  try {
    const result = await save()
    // Electron save APIs resolve { success:false } when the user cancels the
    // native dialog — that's neither saved nor an error.
    const r = result as { success?: boolean; error?: string } | undefined
    if (r != null && r.success === false) {
      useSaveStatusStore.getState().setStatus(r.error ? 'error' : 'idle')
      return result
    }
    const s = useSaveStatusStore.getState()
    s.setStatus('saved')
    s.setDirty(false)
    s.setLastSavedAt(new Date().toISOString())
    idleTimer = setTimeout(() => { useSaveStatusStore.getState().setStatus('idle') }, 3000)
    return result
  } catch (err) {
    useSaveStatusStore.getState().setStatus('error')
    throw err
  }
}
