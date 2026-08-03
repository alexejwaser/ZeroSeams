import { useCanvasStore, type NewProjectSpec } from '@/canvas/useCanvasStore'
import { useViewportStore } from '@/canvas/useViewportStore'
import { useSaveStatusStore, useSwatchStore, trackSave } from '@/store'
import {
  applyProjectJson,
  buildNewProject,
  filenameStem,
  getLastFile,
  rememberLastFile,
  serializeProject,
} from './projectFile'

/**
 * Every create / open / save the app can perform, in one place.
 *
 * The TitleBar buttons, the keyboard shortcuts, the native menu and the New
 * Document screen all call these — none of them re-implement a save. Two rules
 * hold for all of them:
 *   1. every save goes through `trackSave` (drives the SaveStatusPill, treats a
 *      cancelled dialog as idle rather than saved), and
 *   2. every save that lands a path calls `rememberLastFile`. Only Open used to
 *      do that, which is why a file first created by ⌘S was forgotten on the
 *      next launch.
 */

/** What the New Document screen collects. Structurally identical to
 *  `NewDocumentSpec` in src/ui/NewDocumentScreen.tsx — declared here so io/
 *  doesn't have to import from the UI layer. */
export interface CreateDocumentSpec extends NewProjectSpec {
  folderPath: string
  filename: string
}

export interface FileOpResult {
  success: boolean
  error?: string
}

function saveStore() {
  return useSaveStatusStore.getState()
}

/**
 * Create a document and its file. The file is written FIRST, from a payload
 * built without touching the stores: a refused write (name already taken)
 * therefore leaves the currently open document exactly as it was.
 */
export async function createNew(spec: CreateDocumentSpec): Promise<FileOpResult> {
  const name = spec.filename.trim().replace(/\.zeroseams$/i, '')
  const project = buildNewProject(spec, name)

  const result = await window.electronAPI.createProjectFile(
    spec.folderPath,
    name,
    JSON.stringify(project),
  )
  if (!result.success || !result.filePath) {
    return { success: false, error: result.error ?? 'Could not create the document.' }
  }

  useCanvasStore.getState().newProject(spec)
  useSwatchStore.getState().setFile([])

  const save = saveStore()
  save.setProjectMeta(project.id, project.name, filenameStem(project.name), project.createdAt)
  save.setCurrentFilePath(result.filePath)
  save.setDirty(false)
  save.setDocumentReady(true)
  rememberLastFile(result.filePath)

  return { success: true }
}

/** Show the New Document screen. Nothing is written and the canvas is left
 *  alone — the document is only replaced once Create succeeds. */
export function requestNewDocument(): void {
  saveStore().setDocumentReady(false)
}

/** Dismiss the New Document screen without creating anything. Only meaningful
 *  when a document is already open behind it. */
export function cancelNewDocument(): boolean {
  if (!saveStore().currentFilePath) return false
  saveStore().setDocumentReady(true)
  return true
}

export async function openFromDialog(): Promise<FileOpResult> {
  const result = await window.electronAPI.openProject()
  if (!result.success || result.json == null) {
    return { success: false, error: result.error }
  }
  // applyProject sets documentReady + lastFile for every load path.
  if (!applyProjectJson(result.json, result.filePath ?? null)) {
    return { success: false, error: 'That file isn’t a readable Zero Seams project.' }
  }
  return { success: true }
}

export async function openPath(filePath: string): Promise<FileOpResult> {
  const result = await window.electronAPI.loadFileAtPath(filePath)
  if (!result.success || result.json == null) {
    return { success: false, error: 'Could not read that file.' }
  }
  if (!applyProjectJson(result.json, result.filePath ?? filePath)) {
    return { success: false, error: 'That file isn’t a readable Zero Seams project.' }
  }
  return { success: true }
}

/** Restore the document open when the app last ran. Returns false when there
 *  is nothing to restore (or it has since been moved/deleted), which is what
 *  puts the New Document screen up on a cold start. */
export async function restoreLastFile(): Promise<boolean> {
  const lastFile = getLastFile()
  if (!lastFile) return false
  const result = await openPath(lastFile)
  if (!result.success) {
    rememberLastFile(null)
    return false
  }
  return true
}

/** ⌘S. Falls back to Save As when the document has no path yet. */
export async function save(): Promise<FileOpResult> {
  const path = saveStore().currentFilePath
  if (!path) return await saveAs()
  try {
    const result = await trackSave(() => window.electronAPI.saveProject(path, serializeProject()))
    if (!result.success) return { success: false, error: result.error }
    rememberLastFile(path)
    return { success: true }
  } catch (err) {
    console.error('[ZeroSeams] Save failed:', err)
    return { success: false, error: String(err) }
  }
}

/** ⌘⇧S. Redirects the document at the newly chosen path. */
export async function saveAs(): Promise<FileOpResult> {
  try {
    const result = await trackSave(() => window.electronAPI.saveProjectAs(serializeProject()))
    if (!result.success || !result.filePath) return { success: false, error: result.error }
    const save2 = saveStore()
    save2.setCurrentFilePath(result.filePath)
    save2.setDocumentReady(true)
    rememberLastFile(result.filePath)
    return { success: true }
  } catch (err) {
    console.error('[ZeroSeams] Save As failed:', err)
    return { success: false, error: String(err) }
  }
}

/** ⌥⇧⌘S. A copy is a side-effect-free write: it must NOT become the document,
 *  so neither currentFilePath nor lastFile move. */
export async function saveCopy(): Promise<FileOpResult> {
  try {
    const result = await trackSave(() => window.electronAPI.saveProjectCopy(serializeProject()))
    if (!result.success) return { success: false, error: result.error }
    return { success: true }
  } catch (err) {
    console.error('[ZeroSeams] Save a Copy failed:', err)
    return { success: false, error: String(err) }
  }
}

/** True when focus is somewhere text editing owns the key. The native menu's
 *  accelerators bypass useKeyboardShortcuts' own guard, so it lives here too. */
function inTextField(): boolean {
  const el = document.activeElement
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLElement && el.isContentEditable)
  )
}

/**
 * Route one native-menu command. The menu never duplicates behaviour — it
 * calls exactly what the buttons and shortcuts call.
 */
export function handleMenuAction(action: string): void {
  const canvas = useCanvasStore.getState()
  switch (action) {
    case 'new': requestNewDocument(); break
    case 'open': void openFromDialog(); break
    case 'save': void save(); break
    case 'save-as': void saveAs(); break
    case 'save-copy': void saveCopy(); break
    // Toggle, not open: ⌘E is a toggle everywhere else and the menu now owns
    // that accelerator.
    case 'export': canvas.setExportOpen((v) => !v); break
    case 'save-and-close':
      // The close guard is waiting on this: only confirm once the write landed.
      void save().then((r) => { if (r.success) void window.electronAPI.confirmClose() })
      break
    case 'undo':
      if (inTextField()) { document.execCommand('undo'); break }
      canvas.undo(); break
    case 'redo':
      if (inTextField()) { document.execCommand('redo'); break }
      canvas.redo(); break
    case 'select-all':
      if (inTextField()) { document.execCommand('selectAll'); break }
      canvas.selectAll(); break
    case 'zoom-in': useViewportStore.getState().zoomIn(); break
    case 'zoom-out': useViewportStore.getState().zoomOut(); break
    case 'zoom-reset': useViewportStore.getState().resetViewport(); break
    case 'toggle-preview':
      if (canvas.platform !== 'custom') canvas.togglePreviewMode()
      break
    default:
      console.warn('[fileManager] unhandled menu action:', action)
  }
}

/**
 * Wire the two main↔renderer bridges the file flow needs: menu commands in,
 * dirty state out. Returns a teardown. Call once, from the App root.
 */
export function initFileBridges(): () => void {
  const offMenu = window.electronAPI.onMenuAction(handleMenuAction)
  const offOpen = window.electronAPI.onOpenFilePath((filePath) => { void openPath(filePath) })

  window.electronAPI.setDirtyState(useSaveStatusStore.getState().dirty)
  let lastDirty = useSaveStatusStore.getState().dirty
  const unsubscribe = useSaveStatusStore.subscribe((state) => {
    if (state.dirty === lastDirty) return
    lastDirty = state.dirty
    window.electronAPI.setDirtyState(state.dirty)
  })

  return () => { offMenu(); offOpen(); unsubscribe() }
}
