// In-app clipboard for canvas objects (⌘C / ⌘X → ⌘V), plus the copy/cut actions
// that fill it. The event wiring lives in useClipboard.ts; the context menu calls
// these directly.
//
// Module-level rather than store state, for the same reason swatches live outside
// useCanvasStore: the clipboard must never enter the undo stack. Cutting objects
// and then undoing the cut should restore them without also emptying the
// clipboard, and a copy must survive any number of undos.
//
// Holds detached deep copies. Storing references would let a later edit — or an
// undo that replaces the object — mutate what a pending paste is about to insert.

import type { CanvasObject } from '@/types/canvas'
import { useCanvasStore } from './useCanvasStore'

let clipboard: CanvasObject[] = []

export function getObjectClipboard(): CanvasObject[] {
  return clipboard.map((o) => structuredClone(o))
}

export function hasObjectClipboard(): boolean {
  return clipboard.length > 0
}

/** Expand ids to include group descendants — a copied grid must bring its cells,
 *  or the paste produces a group whose childIds point at nothing. */
function withDescendants(ids: string[]): string[] {
  const { objects } = useCanvasStore.getState()
  const out = new Set<string>()
  const queue = [...ids]
  while (queue.length > 0) {
    const id = queue.pop()!
    if (out.has(id)) continue
    out.add(id)
    const obj = objects[id]
    if (obj?.type === 'group') queue.push(...obj.childIds)
  }
  return [...out].filter((id) => objects[id])
}

/** Ids the clipboard actions operate on when none are given: the multi-selection
 *  if there is one, else the single selection. */
export function currentSelectionIds(): string[] {
  const { selectedIds, selectedId } = useCanvasStore.getState()
  if (selectedIds.length > 0) return selectedIds
  return selectedId ? [selectedId] : []
}

/** Returns false when there was nothing to copy, so callers can leave the
 *  keystroke to the platform instead of swallowing it. */
export function copyObjects(ids: string[] = currentSelectionIds()): boolean {
  const expanded = withDescendants(ids)
  if (expanded.length === 0) return false
  const { objects } = useCanvasStore.getState()
  clipboard = expanded.map((id) => structuredClone(objects[id]))
  return true
}

export function cutObjects(ids: string[] = currentSelectionIds()): boolean {
  if (!copyObjects(ids)) return false
  // Remove the ids the caller named, not the expanded set — removeMultipleObjects
  // does its own descendant expansion, and deleting a cell directly would take
  // the "restore an empty frame" path instead of removing the grid.
  useCanvasStore.getState().removeMultipleObjects(ids)
  return true
}
