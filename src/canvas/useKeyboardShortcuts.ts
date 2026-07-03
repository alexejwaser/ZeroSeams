import { useEffect, useRef } from 'react'
import { useCanvasStore } from './useCanvasStore'
import { useViewportStore } from './useViewportStore'
import { useSaveStatusStore } from '@/ui/useSaveStatusStore'
import type { CarouselProject } from '@/types/project'
import type { ImageObject, PathObject, ShapeObject } from '@/types/canvas'
import { computePathBBox } from './CanvasPathNode'
import { relativizeVideoObjects } from './pathUtils'

function buildProjectSnapshot(
  state: ReturnType<typeof useCanvasStore.getState>,
  saveStore: ReturnType<typeof useSaveStatusStore.getState>,
): CarouselProject {
  return {
    id: saveStore.projectId,
    name: saveStore.projectName,
    platform: state.platform,
    ratio: state.ratio,
    dimensions: { width: state.frameWidth, height: state.frameHeight },
    frameCount: state.frameCount,
    frames: state.frames,
    backgroundColor: state.backgroundColor,
    objects: relativizeVideoObjects(state.objects, saveStore.currentFilePath),
    objectOrder: state.objectOrder,
    createdAt: saveStore.createdAt,
    updatedAt: new Date().toISOString(),
    version: 1,
  }
}

export function useKeyboardShortcuts(): void {
  const setActiveTool = useCanvasStore((s) => s.setActiveTool)
  const setSelected = useCanvasStore((s) => s.setSelected)
  const clearContentEditMode = useCanvasStore((s) => s.clearContentEditMode)
  const clearPathEditMode = useCanvasStore((s) => s.clearPathEditMode)
  const clearMaskDrawMode = useCanvasStore((s) => s.clearMaskDrawMode)
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
        if (e.key === 'm') {
          const s = useCanvasStore.getState()
          if (s.maskModeActive) {
            s.setMaskModeActive(false)
            s.setSelected(null)
            s.setActiveTool('select')
          }
          return
        }
        if (e.key === '\\') { setAdjustmentsBypass(true); return }
      }

      if (e.key === 'Escape') {
        // If context menu is open, let it handle its own Escape — don't clear selection
        if (useCanvasStore.getState().contextMenu !== null) return
        // If mask draw is active, cancel draw without deselecting the image
        if (useCanvasStore.getState().maskDrawMode !== null) {
          clearMaskDrawMode()
          return
        }
        // Cancel guideline placement without touching selection
        if (useCanvasStore.getState().activeTool === 'guideline') {
          setActiveTool('select')
          return
        }
        setSelected(null)
        clearContentEditMode()
        clearPathEditMode()
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
          const { zoom, setZoom } = useViewportStore.getState()
          setZoom(Math.min(8, zoom * 1.25))
          return
        }
        if (e.key === '-') {
          e.preventDefault()
          const { zoom, setZoom } = useViewportStore.getState()
          setZoom(Math.max(0.1, zoom * 0.8))
          return
        }
        if (e.key === '0') {
          e.preventDefault()
          useViewportStore.getState().resetViewport()
          return
        }

        if (e.key === 's' && !e.shiftKey) {
          e.preventDefault()
          const saveStore = useSaveStatusStore.getState()
          const currentState = useCanvasStore.getState()
          const project = buildProjectSnapshot(currentState, saveStore)
          if (saveStore.currentFilePath) {
            window.electronAPI.saveProject(saveStore.currentFilePath, JSON.stringify(project))
              .then(() => { /* status handled by autosave */ })
              .catch(() => {})
          } else {
            window.electronAPI.saveProjectAs(JSON.stringify(project))
              .then((result: { success: boolean; filePath?: string; error?: string }) => {
                if (result.success && result.filePath) {
                  saveStore.setCurrentFilePath(result.filePath)
                }
              })
              .catch(() => {})
          }
          return
        }

        if (e.key === 's' && e.shiftKey) {
          e.preventDefault()
          const saveStore = useSaveStatusStore.getState()
          const currentState = useCanvasStore.getState()
          const project = buildProjectSnapshot(currentState, saveStore)
          window.electronAPI.saveProjectAs(JSON.stringify(project))
            .then((result: { success: boolean; filePath?: string; error?: string }) => {
              if (result.success && result.filePath) {
                saveStore.setCurrentFilePath(result.filePath)
              }
            })
            .catch(() => {})
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
    clearMaskDrawMode,
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
