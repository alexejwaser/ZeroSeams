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
  /** A real document is open. False on a cold start, while the New Document
   *  screen is up. Autosave is gated on this: it used to fire on the module
   *  defaults and silently create ~/Documents/ZeroSeams/untitled.zeroseams
   *  before the user had done anything. */
  documentReady: boolean
  /** Monotonic save counter written as CarouselProject.version. Lived as a
   *  local ref inside useAutosave, so the three save paths each reported a
   *  different number for the same document. */
  saveVersion: number
  setStatus: (status: SaveStatus) => void
  setDirty: (dirty: boolean) => void
  setLastSavedAt: (at: string) => void
  setProjectMeta: (id: string, name: string, filename: string, createdAt: string) => void
  setCurrentFilePath: (path: string | null) => void
  setAutosaveFilePath: (path: string | null) => void
  setDocumentReady: (ready: boolean) => void
  /** Increment and return the save counter. */
  nextSaveVersion: () => number
}

export const useSaveStatusStore = create<SaveStatusState>((set, get) => ({
  status: 'idle',
  dirty: false,
  lastSavedAt: null,
  projectId: crypto.randomUUID(),
  projectName: 'Untitled Project',
  projectFilename: 'untitled',
  createdAt: new Date().toISOString(),
  currentFilePath: null,
  autosaveFilePath: null,
  documentReady: false,
  saveVersion: 0,
  setStatus: (status) => set({ status }),
  setDirty: (dirty) => set({ dirty }),
  setLastSavedAt: (at) => set({ lastSavedAt: at }),
  setProjectMeta: (id, name, filename, createdAt) => set({ projectId: id, projectName: name, projectFilename: filename, createdAt }),
  setCurrentFilePath: (path) => set({ currentFilePath: path }),
  setAutosaveFilePath: (path) => set({ autosaveFilePath: path }),
  setDocumentReady: (ready) => set({ documentReady: ready }),
  nextSaveVersion: () => {
    const next = get().saveVersion + 1
    set({ saveVersion: next })
    return next
  },
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
