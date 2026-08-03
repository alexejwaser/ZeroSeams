import { makeFrames, useCanvasStore, type NewProjectSpec } from '@/canvas/useCanvasStore'
import { relativizeVideoObjects, resolveVideoObjects } from '@/canvas/pathUtils'
import { useSaveStatusStore, useSwatchStore } from '@/store'
import type { CarouselProject } from '@/types/project'

/**
 * The one place a .zeroseams payload is built or applied.
 *
 * This used to live in three hand-maintained copies (Toolbar, useKeyboardShortcuts,
 * useAutosave) whose `version` values had already drifted apart. Any new field on
 * CarouselProject only has to be added here.
 */

/** Bumped when the on-disk shape changes in a way a reader must know about.
 *  Distinct from CarouselProject.version, which is only a save counter. */
export const SCHEMA_VERSION = 2

/** localStorage key holding the last-opened file, so a renderer reload
 *  (Vite HMR after sleep/wake, a renderer crash) restores the document
 *  without an IPC round-trip. */
export const LAST_FILE_KEY = 'zeroseams:lastFile'

/** Snapshot both stores into a serializable project. */
export function buildProject(): CarouselProject {
  const state = useCanvasStore.getState()
  const save = useSaveStatusStore.getState()
  return {
    id: save.projectId,
    name: save.projectName,
    schemaVersion: SCHEMA_VERSION,
    platform: state.platform,
    ratio: state.ratio,
    dimensions: { width: state.frameWidth, height: state.frameHeight },
    frameCount: state.frameCount,
    frames: state.frames,
    backgroundColor: state.backgroundColor,
    objects: relativizeVideoObjects(state.objects, save.currentFilePath),
    objectOrder: state.objectOrder,
    swatches: useSwatchStore.getState().file,
    createdAt: save.createdAt,
    updatedAt: new Date().toISOString(),
    version: save.nextSaveVersion(),
  }
}

/**
 * The payload for a document that does not exist yet.
 *
 * Deliberately pure: `createNew` writes this to disk BEFORE resetting the
 * stores, so a refused write (name already taken) leaves the open document
 * untouched. Building it from the store instead would mean wiping the current
 * document to find out the new one can't be created.
 */
export function buildNewProject(spec: NewProjectSpec, name: string): CarouselProject {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    name,
    schemaVersion: SCHEMA_VERSION,
    platform: spec.platform,
    ratio: spec.ratio,
    dimensions: { width: spec.width, height: spec.height },
    frameCount: spec.frameCount,
    frames: makeFrames(spec.frameCount),
    backgroundColor: '#ffffff',
    objects: {},
    objectOrder: [],
    swatches: [],
    createdAt: now,
    updatedAt: now,
    version: 1,
  }
}

/** The JSON written to disk by every save path. */
export function serializeProject(): string {
  return JSON.stringify(buildProject())
}

/** Filename stem used for a project — mirrors what the save dialogs default to. */
export function filenameStem(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-')
}

/**
 * Load a parsed project into the app: resolve asset paths, hydrate both stores,
 * and remember the file for the next launch. The single load path — every caller
 * (Open, Open Recent, session restore, OS file-association) goes through here so
 * they can't drift in what they forget to set.
 */
export function applyProject(project: CarouselProject, filePath: string | null): void {
  const resolved: CarouselProject = filePath
    ? { ...project, objects: resolveVideoObjects(project.objects, filePath) }
    : project

  useCanvasStore.getState().loadProject(resolved)
  // Files written before swatches existed simply lack the field. Must run
  // BEFORE setDirty(false) below — useSwatchStore arms the dirty flag on any
  // `file` change, and a load is not an edit.
  useSwatchStore.getState().setFile(resolved.swatches ?? [])

  const save = useSaveStatusStore.getState()
  save.setProjectMeta(resolved.id, resolved.name, filenameStem(resolved.name), resolved.createdAt)
  save.setCurrentFilePath(filePath)
  save.setDirty(false)
  // Every load path (Open, Recent, session restore, OS file-association) lands
  // here, so this is the one place a *loaded* document is declared ready —
  // which is also what dismisses the New Document screen and arms autosave.
  save.setDocumentReady(true)

  rememberLastFile(filePath)
}

/** Parse + apply in one step. Returns false when the payload isn't usable. */
export function applyProjectJson(json: string, filePath: string | null): boolean {
  let project: CarouselProject
  try {
    project = JSON.parse(json) as CarouselProject
  } catch {
    return false
  }
  if (project == null || typeof project !== 'object' || project.objects == null) return false
  applyProject(project, filePath)
  return true
}

/** Record (or clear) the file restored on next launch. Called on load *and* on
 *  save — a ⌘S-created file used to be forgotten because only Open wrote this. */
export function rememberLastFile(filePath: string | null): void {
  if (filePath) localStorage.setItem(LAST_FILE_KEY, filePath)
  else localStorage.removeItem(LAST_FILE_KEY)
}

export function getLastFile(): string | null {
  return localStorage.getItem(LAST_FILE_KEY)
}
