import { useEffect, useRef } from 'react'
import { useCanvasStore } from './useCanvasStore'
import { useViewportStore } from './useViewportStore'
import * as fileManager from '@/io/fileManager'
import type { ImageObject, PathObject, ShapeObject } from '@/types/canvas'
import { computePathBBox } from './CanvasPathNode'

export function useKeyboardShortcuts(): void {
  const setActiveTool = useCanvasStore((s) => s.setActiveTool)
  const setSelected = useCanvasStore((s) => s.setSelected)
  const clearContentEditMode = useCanvasStore((s) => s.clearContentEditMode)
  const clearPathEditMode = useCanvasStore((s) => s.clearPathEditMode)
  const clearClipEditMode = useCanvasStore((s) => s.clearClipEditMode)
  const selectAll = useCanvasStore((s) => s.selectAll)
  const duplicateObject = useCanvasStore((s) => s.duplicateObject)
  const bringForward = useCanvasStore((s) => s.bringForward)
  const sendBackward = useCanvasStore((s) => s.sendBackward)
  const bringToFront = useCanvasStore((s) => s.bringToFront)
  const sendToBack = useCanvasStore((s) => s.sendToBack)
  const toggleLock = useCanvasStore((s) => s.toggleLock)
  const removeObject = useCanvasStore((s) => s.removeObject)
  const removeMultipleObjects = useCanvasStore((s) => s.removeMultipleObjects)
  const commitUpdate = useCanvasStore((s) => s.commitUpdate)
  const startDrag = useCanvasStore((s) => s.startDrag)
  const updateObject = useCanvasStore((s) => s.updateObject)
  const commitDraggedState = useCanvasStore((s) => s.commitDraggedState)
  const undo = useCanvasStore((s) => s.undo)
  const redo = useCanvasStore((s) => s.redo)
  const toggleSnap = useCanvasStore((s) => s.toggleSnap)
  const setAdjustmentsBypass = useCanvasStore((s) => s.setAdjustmentsBypass)
  const setGuidelineOrientation = useCanvasStore((s) => s.setGuidelineOrientation)

  const nudgeActive = useRef(false)
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      // Skip if focus is in an editable element
      const active = document.activeElement
      if (active instanceof HTMLInputElement) return
      if (active instanceof HTMLTextAreaElement) return
      if (active instanceof HTMLElement && active.isContentEditable) return

      // Read current state at event time (not captured in closure)
      const state = useCanvasStore.getState()
      const { selectedId, selectedIds, objects } = state

      // '?' toggles the shortcut cheatsheet (Shift+/ on most layouts)
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        const s = useCanvasStore.getState()
        s.setShortcutOverlayOpen(!s.shortcutOverlayOpen)
        return
      }

      // Tool shortcuts (no modifier)
      if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        if (e.key === 'v') {
          setActiveTool('select')
          return
        }
        if (e.key === 't') {
          setActiveTool('text')
          return
        }
        if (e.key === 'r') {
          setActiveTool('shape')
          return
        }
        if (e.key === 'p') {
          setActiveTool('pen')
          return
        }
        if (e.key === 'g') {
          setActiveTool('guideline')
          return
        }
        if (e.key === 'x' || e.key === 'Tab') {
          const currentState = useCanvasStore.getState()
          if (currentState.activeTool === 'guideline') {
            e.preventDefault()
            setGuidelineOrientation(currentState.guidelineOrientation === 'horizontal' ? 'vertical' : 'horizontal')
            return
          }
        }
        if (e.key === 's') { toggleSnap(); return }
        if (e.key === 'f') { useCanvasStore.getState().setShowFrameSettings((v) => !v); return }
        if (e.key === '\\') { setAdjustmentsBypass(true); return }
      }

      if (e.key === 'Escape') {
        // Shortcut cheatsheet swallows Escape when open
        if (useCanvasStore.getState().shortcutOverlayOpen) {
          useCanvasStore.getState().setShortcutOverlayOpen(false)
          return
        }
        // If context menu is open, let it handle its own Escape — don't clear selection
        if (useCanvasStore.getState().contextMenu !== null) return
        // Cancel guideline placement without touching selection
        if (useCanvasStore.getState().activeTool === 'guideline') {
          setActiveTool('select')
          return
        }
        setSelected(null)
        clearContentEditMode()
        clearPathEditMode()
        clearClipEditMode()
        return
      }

      // Backspace / Delete
      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (selectedIds.length > 1) {
          e.preventDefault()
          removeMultipleObjects(selectedIds)
          return
        }
        if (!selectedId) return
        e.preventDefault()
        removeObject(selectedId)
        return
      }

      // ⌘→ / ⌘← — add / remove frame (must come before nudge handler)
      if ((e.metaKey || e.ctrlKey) && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        e.preventDefault()
        const s = useCanvasStore.getState()
        if (e.key === 'ArrowRight') {
          s.setFrameCount(s.frameCount + 1)
        } else if (s.frameCount > 1) {
          s.setFrameCount(s.frameCount - 1)
        }
        return
      }

      // Arrow keys — nudge (coalesced: one history entry per burst)
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        if (selectedIds.length === 0 && !selectedId) return
        e.preventDefault()
        const delta = e.shiftKey ? 10 : 1
        const dx = e.key === 'ArrowLeft' ? -delta : e.key === 'ArrowRight' ? delta : 0
        const dy = e.key === 'ArrowUp' ? -delta : e.key === 'ArrowDown' ? delta : 0

        // Snapshot pre-burst state on the first keydown in a burst
        if (!nudgeActive.current) {
          startDrag()
          nudgeActive.current = true
        }

        // Live preview via updateObject (no history push)
        const liveObjects = useCanvasStore.getState().objects
        if (selectedIds.length > 1) {
          for (const id of selectedIds) {
            const o = liveObjects[id]
            if (!o || o.locked) continue
            if (o.type === 'image') {
              const img = o as ImageObject
              updateObject(id, { frameX: img.frameX + dx, frameY: img.frameY + dy, x: img.x + dx, y: img.y + dy })
            } else if (o.type === 'path') {
              const p = o as PathObject
              const newAnchors = p.anchors.map((a) => ({ ...a, x: a.x + dx, y: a.y + dy }))
              const bbox = computePathBBox(newAnchors)
              updateObject(id, { anchors: newAnchors, x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height })
            } else if (o.type === 'shape') {
              const s = o as ShapeObject
              if (s.kind === 'line' || s.kind === 'arrow') {
                updateObject(id, { x: s.x + dx, y: s.y + dy, x2: (s.x2 ?? s.x + s.width) + dx, y2: (s.y2 ?? s.y + s.height) + dy })
              } else {
                updateObject(id, { x: o.x + dx, y: o.y + dy })
              }
            } else {
              updateObject(id, { x: o.x + dx, y: o.y + dy })
            }
          }
        } else {
          if (!selectedId) return
          const obj = liveObjects[selectedId]
          if (!obj || obj.locked) return
          if (obj.type === 'image') {
            const img = obj as ImageObject
            updateObject(selectedId, { frameX: img.frameX + dx, frameY: img.frameY + dy, x: img.x + dx, y: img.y + dy })
          } else if (obj.type === 'shape') {
            const s = obj as ShapeObject
            if (s.kind === 'line' || s.kind === 'arrow') {
              updateObject(selectedId, { x: s.x + dx, y: s.y + dy, x2: (s.x2 ?? s.x + s.width) + dx, y2: (s.y2 ?? s.y + s.height) + dy })
            } else {
              updateObject(selectedId, { x: obj.x + dx, y: obj.y + dy })
            }
          } else if (obj.type === 'path') {
            const p = obj as PathObject
            const newAnchors = p.anchors.map((a) => ({ ...a, x: a.x + dx, y: a.y + dy }))
            const bbox = computePathBBox(newAnchors)
            updateObject(selectedId, { anchors: newAnchors, x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height })
          } else {
            updateObject(selectedId, { x: obj.x + dx, y: obj.y + dy })
          }
        }

        // Debounce: push one history entry ~300ms after the last keydown in the burst
        if (nudgeTimer.current) clearTimeout(nudgeTimer.current)
        nudgeTimer.current = setTimeout(() => {
          commitDraggedState()
          nudgeActive.current = false
        }, 300)
        return
      }

      // Meta shortcuts
      if (e.metaKey) {
        // Zoom shortcuts
        if (e.key === '=' || e.key === '+') {
          e.preventDefault()
          useViewportStore.getState().zoomIn()
          return
        }
        if (e.key === '-') {
          e.preventDefault()
          useViewportStore.getState().zoomOut()
          return
        }
        if (e.key === '0') {
          e.preventDefault()
          useViewportStore.getState().resetViewport()
          return
        }

        // File commands all delegate to src/io/fileManager — the same functions
        // the TitleBar buttons and the native menu call. (With the app menu
        // installed these accelerators are usually consumed by the menu; these
        // handlers keep the shortcuts working if a window has no menu focus.)
        if (e.key.toLowerCase() === 'n' && !e.shiftKey && !e.altKey) {
          e.preventDefault()
          fileManager.requestNewDocument()
          return
        }

        if (e.key.toLowerCase() === 'o' && !e.shiftKey && !e.altKey) {
          e.preventDefault()
          void fileManager.openFromDialog()
          return
        }

        // e.code, not e.key: with Option held macOS reports the alternate
        // character ('ß'), so a key comparison never matches ⌥⇧⌘S.
        if (e.code === 'KeyS' && e.altKey && e.shiftKey) {
          e.preventDefault()
          void fileManager.saveCopy()
          return
        }

        if (e.key.toLowerCase() === 's' && !e.shiftKey) {
          e.preventDefault()
          void fileManager.save()
          return
        }

        if (e.key.toLowerCase() === 's' && e.shiftKey) {
          e.preventDefault()
          void fileManager.saveAs()
          return
        }

        if (e.key === 'a') {
          e.preventDefault()
          selectAll()
          return
        }

        if (e.key === 'd') {
          e.preventDefault()
          if (selectedIds.length > 1) {
            for (const id of selectedIds) {
              const o = objects[id]
              if (!o || o.locked) continue
              duplicateObject(id)
            }
            return
          }
          if (!selectedId) return
          const obj = objects[selectedId]
          if (!obj || obj.locked) return
          duplicateObject(selectedId)
          return
        }

        // toLowerCase: with Shift held the browser reports 'Z', so ⌘⇧Z
        // would never match a lowercase comparison (also covers Caps Lock)
        if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
          e.preventDefault()
          undo()
          return
        }

        if (e.key.toLowerCase() === 'z' && e.shiftKey) {
          e.preventDefault()
          redo()
          return
        }

        if (e.key === 'l') {
          e.preventDefault()
          if (!selectedId) return
          toggleLock(selectedId)
          return
        }

        // Layer order — check shift first for to-front/to-back
        if (e.key === ']' && e.shiftKey) {
          e.preventDefault()
          if (!selectedId) return
          bringToFront(selectedId)
          return
        }
        if (e.key === '[' && e.shiftKey) {
          e.preventDefault()
          if (!selectedId) return
          sendToBack(selectedId)
          return
        }
        if (e.key === ']' && !e.shiftKey) {
          e.preventDefault()
          if (!selectedId) return
          bringForward(selectedId)
          return
        }
        if (e.key === '[' && !e.shiftKey) {
          e.preventDefault()
          if (!selectedId) return
          sendBackward(selectedId)
          return
        }

        if (e.key === 'e' && !e.shiftKey) {
          e.preventDefault()
          useCanvasStore.getState().setExportOpen((v) => !v)
          return
        }

        if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
          e.preventDefault()
          const { platform, togglePreviewMode } = useCanvasStore.getState()
          if (platform !== 'custom') togglePreviewMode()
          return
        }
      }
    }

    function handleKeyUp(e: KeyboardEvent): void {
      if (e.key === '\\') setAdjustmentsBypass(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [
    setActiveTool,
    setSelected,
    clearContentEditMode,
    clearPathEditMode,
    clearClipEditMode,
    selectAll,
    duplicateObject,
    bringForward,
    sendBackward,
    bringToFront,
    sendToBack,
    toggleLock,
    removeObject,
    removeMultipleObjects,
    commitUpdate,
    startDrag,
    updateObject,
    commitDraggedState,
    undo,
    redo,
    toggleSnap,
    setAdjustmentsBypass,
    setGuidelineOrientation,
  ])
}
