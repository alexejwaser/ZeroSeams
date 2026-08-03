import { create } from 'zustand'
import type { Swatch } from '@/types/canvas'
// Imported from the module, NOT from './index' — the barrel re-exports this
// store, so going through it would close an import cycle.
import { useSaveStatusStore } from './useSaveStatusStore'

/**
 * Colour swatch palettes for the colour picker.
 *
 * Two scopes, deliberately kept apart:
 *  - `file`   travels inside the .zeroseams payload (see src/io/projectFile.ts)
 *  - `global` lives in userData/swatches.json, written through Electron IPC
 *
 * This is NOT part of useCanvasStore on purpose: swatches must never enter the
 * undo stack — undoing a shape move should not silently drop a saved colour.
 * The cost of that separation is that useAutosave (which subscribes to
 * useCanvasStore only) can't see a file-swatch edit, so the subscription at the
 * bottom of this file arms the dirty flag by hand.
 */

export type SwatchScope = 'file' | 'global'

interface SwatchState {
  /** Palette shared by every project — userData/swatches.json. */
  global: Swatch[]
  /** Palette stored in the current project file. */
  file: Swatch[]
  scope: SwatchScope
  /** True once loadGlobal() has completed at least one round-trip. */
  globalLoaded: boolean

  setScope: (scope: SwatchScope) => void
  /** Add to the *active* scope. No-op when the colour is already there. */
  addSwatch: (color: string) => void
  removeSwatch: (id: string) => void
  reorderSwatches: (from: number, to: number) => void
  renameSwatch: (id: string, name: string) => void
  /** Read userData/swatches.json. Idempotent — safe to call on every popover open. */
  loadGlobal: () => Promise<void>
  /** Replace the file palette wholesale (project load). */
  setFile: (list: Swatch[]) => void
}

function normalizeColor(color: string): string {
  return color.trim().toLowerCase()
}

function makeSwatch(color: string): Swatch {
  return { id: crypto.randomUUID(), color: normalizeColor(color) }
}

// ─── Debounced write-through to disk ──────────────────────────────────────────

const WRITE_DEBOUNCE_MS = 300
let writeTimer: ReturnType<typeof setTimeout> | null = null

/** Persist the global palette. Debounced so a burst of edits (drag-reorder,
 *  rapid deletes) costs one disk write, not one per keystroke. */
function scheduleGlobalWrite(swatches: Swatch[]): void {
  if (writeTimer != null) clearTimeout(writeTimer)
  writeTimer = setTimeout(() => {
    writeTimer = null
    void window.electronAPI?.setGlobalSwatches(swatches)
  }, WRITE_DEBOUNCE_MS)
}

// Guards a concurrent second loadGlobal() while the first is still in flight.
let loadPromise: Promise<void> | null = null

export const useSwatchStore = create<SwatchState>((set, get) => ({
  global: [],
  file: [],
  scope: 'file',
  globalLoaded: false,

  setScope: (scope) => { set({ scope }) },

  addSwatch: (color) => {
    const normalized = normalizeColor(color)
    const { scope } = get()
    const current = scope === 'file' ? get().file : get().global
    if (current.some((s) => normalizeColor(s.color) === normalized)) return
    const next = [...current, makeSwatch(normalized)]
    if (scope === 'file') set({ file: next })
    else { set({ global: next }); scheduleGlobalWrite(next) }
  },

  removeSwatch: (id) => {
    const { scope } = get()
    const current = scope === 'file' ? get().file : get().global
    const next = current.filter((s) => s.id !== id)
    if (next.length === current.length) return
    if (scope === 'file') set({ file: next })
    else { set({ global: next }); scheduleGlobalWrite(next) }
  },

  reorderSwatches: (from, to) => {
    const { scope } = get()
    const current = scope === 'file' ? get().file : get().global
    if (from === to) return
    if (from < 0 || from >= current.length || to < 0 || to >= current.length) return
    const next = [...current]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    if (scope === 'file') set({ file: next })
    else { set({ global: next }); scheduleGlobalWrite(next) }
  },

  renameSwatch: (id, name) => {
    const { scope } = get()
    const current = scope === 'file' ? get().file : get().global
    if (!current.some((s) => s.id === id)) return
    const trimmed = name.trim()
    const next = current.map((s) =>
      s.id === id ? (trimmed === '' ? { id: s.id, color: s.color } : { ...s, name: trimmed }) : s,
    )
    if (scope === 'file') set({ file: next })
    else { set({ global: next }); scheduleGlobalWrite(next) }
  },

  loadGlobal: async () => {
    if (get().globalLoaded) return
    if (loadPromise != null) return loadPromise
    const api = window.electronAPI
    if (api == null) { set({ globalLoaded: true }); return }
    loadPromise = (async () => {
      try {
        const swatches = await api.getGlobalSwatches()
        set({ global: Array.isArray(swatches) ? swatches : [], globalLoaded: true })
      } catch {
        // Missing or unreadable file — an empty palette is the correct answer,
        // and marking it loaded stops every popover open from retrying.
        set({ global: [], globalLoaded: true })
      } finally {
        loadPromise = null
      }
    })()
    return loadPromise
  },

  setFile: (list) => { set({ file: Array.isArray(list) ? list : [] }) },
}))

// useAutosave subscribes to useCanvasStore only, so a file-swatch edit would
// never mark the document dirty and would be lost on the next save. A *global*
// palette edit is not a document edit, so it deliberately doesn't arm this.
useSwatchStore.subscribe((state, prev) => {
  if (state.file !== prev.file) useSaveStatusStore.getState().setDirty(true)
})
