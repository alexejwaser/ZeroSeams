import React, { useEffect, useRef, useState } from 'react'
import { useCanvasStore } from '@/canvas/useCanvasStore'
import { getStageInstance } from '@/canvas/CarouselStage'
import { exportMixedFrames } from '@/canvas/exportFrames'
import { useSaveStatusStore, type SaveStatus } from './useSaveStatusStore'
import type { CarouselProject } from '@/types/project'
import type { ShapeKind } from '@/types/canvas'
import { relativizeVideoObjects, resolveVideoObjects } from '@/canvas/pathUtils'
import {
  MousePointer2, Type, Square, Circle, Minus, PenTool,
  Undo2, Redo2, FolderOpen, Save, ImageDown,
  ChevronDown, Plus, LayoutTemplate, Check, AlertTriangle, Film,
} from 'lucide-react'
import Tooltip from './Tooltip'
import { iconBtnStyle } from './iconBtnStyle'
import { FrameSettingsPopover } from './FrameSettingsPopover'
import { useExportStore } from './useExportStore'

type ActiveTool = 'select' | 'text' | 'shape' | 'pen'

const CROP_ICON = (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M3 1v7h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M1 3h7v7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const AUTOFILL_ICON = (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <rect x="1" y="1" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
    <rect x="3.5" y="3.5" width="5" height="5" rx="0.5" fill="currentColor"/>
  </svg>
)

const SNAP_ICON = (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ display: 'block' }}>
    <circle cx="6.5" cy="6.5" r="2" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M6.5 1v2M6.5 10v2M1 6.5h2M10 6.5h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

function SaveStatusPill({ status }: { status: SaveStatus }): React.ReactElement | null {
  if (status === 'idle') return null

  const config: Record<Exclude<SaveStatus, 'idle'>, { icon: React.ReactElement; text: string; color: string }> = {
    saving: { icon: <span/>, text: 'Saving…', color: '#aaa' },
    saved: { icon: <Check size={12} strokeWidth={1.5}/>, text: ' Saved', color: '#4c4' },
    error: { icon: <AlertTriangle size={12} strokeWidth={1.5}/>, text: ' Save failed', color: '#f55' },
  }

  const { icon, text, color } = config[status as Exclude<SaveStatus, 'idle'>]

  return (
    <span
      style={{
        fontSize: 12,
        color,
        whiteSpace: 'nowrap',
        userSelect: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 3,
      }}
    >
      {icon}{text}
    </span>
  )
}

const divider = (
  <div style={{ width: 1, height: 20, background: '#3a3a3a', margin: '0 6px' }} />
)

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      resolve(dataUrl.split(',')[1])
    }
    reader.onerror = () => reject(new Error('FileReader failed'))
    reader.readAsDataURL(blob)
  })
}

export function Toolbar(): React.ReactElement {
  const activeTool = useCanvasStore((s) => s.activeTool)
  const setActiveTool = useCanvasStore((s) => s.setActiveTool)
  const frameCount = useCanvasStore((s) => s.frameCount)
  const setFrameCount = useCanvasStore((s) => s.setFrameCount)
  const past = useCanvasStore((s) => s.past)
  const future = useCanvasStore((s) => s.future)
  const undo = useCanvasStore((s) => s.undo)
  const redo = useCanvasStore((s) => s.redo)
  const saveStatus = useSaveStatusStore((s) => s.status)
  const frameWidth = useCanvasStore((s) => s.frameWidth)
  const frameHeight = useCanvasStore((s) => s.frameHeight)
  const resizeMode = useCanvasStore((s) => s.resizeMode)
  const setResizeMode = useCanvasStore((s) => s.setResizeMode)
  const snapEnabled = useCanvasStore((s) => s.snapEnabled)
  const toggleSnap = useCanvasStore((s) => s.toggleSnap)
  const loadProject = useCanvasStore((s) => s.loadProject)
  const activeShapeKind = useCanvasStore((s) => s.activeShapeKind)
  const setActiveShapeKind = useCanvasStore((s) => s.setActiveShapeKind)
  const setProjectMeta = useSaveStatusStore((s) => s.setProjectMeta)
  const projectName = useSaveStatusStore((s) => s.projectName)
  const setCurrentFilePath = useSaveStatusStore((s) => s.setCurrentFilePath)
  const selectedId = useCanvasStore((s) => s.selectedId)
  const objects = useCanvasStore((s) => s.objects)
  const setSelected = useCanvasStore((s) => s.setSelected)
  const maskModeActive = useCanvasStore((s) => s.maskModeActive)
  const setMaskModeActive = useCanvasStore((s) => s.setMaskModeActive)
  const addObject = useCanvasStore((s) => s.addObject)
  const objectOrder = useCanvasStore((s) => s.objectOrder)

  const selectedObj = selectedId != null ? objects[selectedId] : undefined

  const [exportOpen, setExportOpen] = useState(false)
  const [exportMode, setExportMode] = useState<'all' | 'single' | 'range'>('all')
  const [exportSingle, setExportSingle] = useState(1)
  const [exportFrom, setExportFrom] = useState(1)
  const [exportTo, setExportTo] = useState(frameCount)
  const exporting = useExportStore((s) => s.exporting)
  const exportStatus = useExportStore((s) => s.exportStatus)
  const { setExporting, setExportStatus, reset: resetExport } = useExportStore.getState()
  const [recentOpen, setRecentOpen] = useState(false)
  const [recentFiles, setRecentFiles] = useState<Array<{ name: string; path: string; modifiedAt: string }>>([])
  const [loadingProject, setLoadingProject] = useState(false)
  const [saveMenuOpen, setSaveMenuOpen] = useState(false)
  const [showFrameSettings, setShowFrameSettings] = useState(false)

  const exportWrapperRef = useRef<HTMLDivElement>(null)
  const recentWrapperRef = useRef<HTMLDivElement>(null)

  // Keep exportTo in sync when frameCount changes
  useEffect(() => {
    setExportTo(frameCount)
  }, [frameCount])

  // Dismiss export panel on outside click
  useEffect(() => {
    if (!exportOpen) return

    function handleMouseDown(e: MouseEvent): void {
      if (exportWrapperRef.current != null && !exportWrapperRef.current.contains(e.target as Node)) {
        setExportOpen(false)
      }
    }

    document.addEventListener('mousedown', handleMouseDown)
    return () => { document.removeEventListener('mousedown', handleMouseDown) }
  }, [exportOpen])

  // Dismiss recent panel on outside click
  useEffect(() => {
    if (!recentOpen) return
    function handleMouseDown(e: MouseEvent): void {
      if (recentWrapperRef.current != null && !recentWrapperRef.current.contains(e.target as Node)) {
        setRecentOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => { document.removeEventListener('mousedown', handleMouseDown) }
  }, [recentOpen])

  // Dismiss save menu on outside click
  useEffect(() => {
    if (!saveMenuOpen) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-save-menu]')) setSaveMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [saveMenuOpen])

  async function handleExportAction(): Promise<void> {
    const stage = getStageInstance()
    if (!stage) return

    let start: number
    let end: number

    if (exportMode === 'all') {
      start = 0
      end = frameCount - 1
    } else if (exportMode === 'single') {
      start = exportSingle - 1
      end = exportSingle - 1
    } else {
      start = exportFrom - 1
      end = exportTo - 1
    }

    setExporting(true)
    setExportStatus('Exporting…')
    useExportStore.setState({ cancelRequested: false })
    void window.electronAPI.clearExportLog()
    try {
      const currentObjects = useCanvasStore.getState().objects
      const results = await exportMixedFrames(
        stage, currentObjects, frameCount, frameWidth, frameHeight, start, end,
        setExportStatus,
        () => useExportStore.getState().cancelRequested,
      )
      for (const result of results) {
        const frameNum = result.frameIndex + 1
        const base64 = await blobToBase64(result.blob)
        if (result.type === 'mp4') {
          const filename = `frame-${frameNum}.mp4`
          const saveResult = await window.electronAPI.saveVideoFile(filename, base64)
          console.log(`[export] ${filename}: ${saveResult.success ? 'saved' : 'ERROR: ' + saveResult.error}`)
        } else {
          const filename = `frame-${frameNum}.png`
          const saveResult = await window.electronAPI.saveFile(filename, base64)
          console.log(`[export] ${filename}: ${saveResult.success ? 'saved' : 'ERROR: ' + saveResult.error}`)
        }
      }
    } catch (err) {
      const msg = String(err)
      if (!msg.includes('cancelled')) {
        console.error('[export] failed:', err)
        alert(`Export failed: ${msg}`)
      }
    } finally {
      resetExport()
      setExportOpen(false)
    }
  }

  async function handleOpen(): Promise<void> {
    setLoadingProject(true)
    try {
      const result = await window.electronAPI.openProject()
      if (!result.success || result.json == null) return
      const project = JSON.parse(result.json) as CarouselProject
      if (result.filePath) {
        project.objects = resolveVideoObjects(project.objects, result.filePath)
      }
      loadProject(project)
      const filename = project.name.toLowerCase().replace(/\s+/g, '-')
      setProjectMeta(project.id, project.name, filename, project.createdAt)
      setCurrentFilePath(result.filePath ?? null)
    } catch (err) {
      console.error('[open]', err)
    } finally {
      setLoadingProject(false)
      setRecentOpen(false)
    }
  }

  async function handleRecentToggle(): Promise<void> {
    if (!recentOpen) {
      const result = await window.electronAPI.listRecentProjects()
      setRecentFiles(result.files)
    }
    setRecentOpen((v) => !v)
  }

  function handleToolClick(tool: ActiveTool): void {
    setActiveTool(tool)
  }

  function handleMinus(): void {
    setFrameCount(frameCount - 1)
  }

  function handlePlus(): void {
    setFrameCount(frameCount + 1)
  }

  function buildProjectJson(): string {
    const state = useCanvasStore.getState()
    const saveStore = useSaveStatusStore.getState()
    const project: CarouselProject = {
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
    return JSON.stringify(project)
  }

  async function handleAddVideo(): Promise<void> {
    const result = await window.electronAPI.openVideoFile()
    if (result.canceled || !result.filePath) return
    const filePath = result.filePath
    const rawName = filePath.split('/').pop()?.replace(/\.[^.]+$/, '') ?? 'video'

    await new Promise<void>((resolve) => {
      const vid = document.createElement('video')
      vid.preload = 'metadata'
      const onMeta = () => {
        // durationchange fires after loadedmetadata when duration becomes finite
        if (!isFinite(vid.duration) || vid.duration <= 0) return
        vid.removeEventListener('durationchange', onMeta)
        const MAX_SIZE = 600
        const scale = Math.min(1, MAX_SIZE / Math.max(vid.videoWidth, vid.videoHeight))
        const w = Math.round(vid.videoWidth * scale)
        const h = Math.round(vid.videoHeight * scale)
        const fx = frameWidth / 2 - w / 2
        const fy = frameHeight / 2 - h / 2
        vid.src = ''
        addObject({
          id: crypto.randomUUID(),
          type: 'video',
          scope: 'global',
          name: rawName,
          filePath,
          muted: false,
          naturalWidth: vid.videoWidth,
          naturalHeight: vid.videoHeight,
          naturalDuration: vid.duration,
          frameX: fx, frameY: fy,
          frameWidth: w, frameHeight: h,
          contentOffsetX: 0, contentOffsetY: 0,
          contentWidth: w, contentHeight: h,
          contentEditMode: false,
          x: fx, y: fy, width: w, height: h,
          rotation: 0, scaleX: 1, scaleY: 1,
          opacity: 1, visible: true, locked: false,
          zIndex: objectOrder.length,
        })
        resolve()
      }
      vid.addEventListener('durationchange', onMeta)
      vid.onerror = () => resolve()
      vid.src = `zeroseams-media://localhost${filePath}`
    })
  }

  const undoDisabled = past.length === 0
  const redoDisabled = future.length === 0

  const segmentButtonStyle = (active: boolean): React.CSSProperties => ({
    padding: '3px 10px',
    height: 24,
    background: active ? '#0af' : 'transparent',
    color: active ? '#fff' : '#aaa',
    border: 'none',
    borderRadius: 3,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: active ? 'bold' : 'normal',
    transition: 'background 0.15s, color 0.15s',
    whiteSpace: 'nowrap' as const,
  })

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        height: 40,
        background: '#2a2a2a',
        borderBottom: '1px solid #333',
        flexShrink: 0,
        boxSizing: 'border-box',
      }}
    >
      {/* Left: title */}
      <div
        style={{
          paddingLeft: 16,
          color: '#fff',
          fontSize: 16,
          fontWeight: 'bold',
          whiteSpace: 'nowrap',
          flex: '0 0 auto',
        }}
      >
        {`Zero Seams${projectName !== 'Untitled Project' ? ` — ${projectName}` : ''}`}
      </div>

      {/* Open button + recent projects */}
      <div ref={recentWrapperRef} style={{ position: 'relative', display: 'flex', marginLeft: 12, flex: '0 0 auto' }}>
        <Tooltip label="Open" shortcut="⌘O">
          <button
            onClick={() => { void handleOpen() }}
            disabled={loadingProject}
            style={{
              width: 30,
              height: 30,
              background: '#333',
              color: loadingProject ? '#555' : '#fff',
              border: 'none',
              borderRadius: '4px 0 0 4px',
              cursor: loadingProject ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: loadingProject ? 0.5 : 1,
              borderRight: '1px solid #555',
            }}
          >
            <FolderOpen size={15} />
          </button>
        </Tooltip>
        <Tooltip label="Recent projects">
          <button
            onClick={() => { void handleRecentToggle() }}
            style={{
              padding: '4px 6px',
              height: 30,
              background: recentOpen ? '#555' : '#333',
              color: '#aaa',
              border: 'none',
              borderRadius: '0 4px 4px 0',
              cursor: 'pointer',
              fontSize: 11,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ChevronDown size={12} strokeWidth={1.5}/>
          </button>
        </Tooltip>

        {recentOpen && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              zIndex: 1001,
              marginTop: 6,
              background: '#1e1e1e',
              border: '1px solid #3a3a3a',
              borderRadius: 8,
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
              padding: '4px 0',
              minWidth: 260,
            }}
          >
            {recentFiles.length === 0 ? (
              <div style={{ padding: '8px 14px', color: '#555', fontSize: 12 }}>No recent projects</div>
            ) : (
              recentFiles.map((file) => (
                <div
                  key={file.path}
                  title={file.path}
                  onClick={() => { void handleOpen() }}
                  style={{
                    padding: '7px 14px',
                    cursor: 'pointer',
                    borderBottom: '1px solid #2a2a2a',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#2a2a2a' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                >
                  <div style={{ color: '#e0e0e0', fontSize: 13, fontWeight: 'bold' }}>{file.name}</div>
                  <div style={{ color: '#666', fontSize: 11 }}>
                    {new Date(file.modifiedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Save split-button */}
      <div data-save-menu style={{ position: 'relative', display: 'flex', marginLeft: 6, flex: '0 0 auto' }}>
        <Tooltip label="Save" shortcut="⌘S">
          <button
            onClick={() => {
              const saveStore = useSaveStatusStore.getState()
              const json = buildProjectJson()
              if (saveStore.currentFilePath) {
                window.electronAPI.saveProject(saveStore.currentFilePath, json)
                  .catch((err: unknown) => console.error('[ZeroSeams] Save failed:', err))
              } else {
                window.electronAPI.saveProjectAs(json)
                  .then((result: { success: boolean; filePath?: string; error?: string }) => {
                    if (result.success && result.filePath) {
                      useSaveStatusStore.getState().setCurrentFilePath(result.filePath)
                    }
                  })
                  .catch((err: unknown) => console.error('[ZeroSeams] Save failed:', err))
              }
            }}
            style={{
              padding: '4px 10px',
              height: 30,
              background: '#333',
              color: '#fff',
              border: 'none',
              borderRight: '1px solid #555',
              borderRadius: '4px 0 0 4px',
              cursor: 'pointer',
              fontSize: 13,
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Save size={14} style={{ marginRight: 5 }} />
            Save
          </button>
        </Tooltip>
        <Tooltip label="Save options">
          <button
            onClick={() => setSaveMenuOpen(v => !v)}
            style={{
              padding: '4px 6px',
              height: 30,
              background: saveMenuOpen ? '#555' : '#333',
              color: '#aaa',
              border: 'none',
              borderRadius: '0 4px 4px 0',
              cursor: 'pointer',
              fontSize: 11,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ChevronDown size={12} strokeWidth={1.5}/>
          </button>
        </Tooltip>
        {saveMenuOpen && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 6,
            background: '#1e1e1e',
            border: '1px solid #3a3a3a',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            zIndex: 1000,
            minWidth: 160,
            padding: '4px 0',
          }}>
            <button
              onClick={() => {
                setSaveMenuOpen(false)
                const json = buildProjectJson()
                window.electronAPI.saveProjectAs(json)
                  .then((result: { success: boolean; filePath?: string; error?: string }) => {
                    if (result.success && result.filePath) {
                      useSaveStatusStore.getState().setCurrentFilePath(result.filePath)
                    }
                  })
                  .catch((err: unknown) => console.error('[ZeroSeams] Save As failed:', err))
              }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                background: 'none', border: 'none', color: '#e0e0e0',
                fontSize: 13, padding: '7px 14px', cursor: 'pointer',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#2a2a2a')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              Save As…
            </button>
            <button
              onClick={() => {
                setSaveMenuOpen(false)
                const json = buildProjectJson()
                window.electronAPI.saveProjectCopy(json)
                  .catch((err: unknown) => console.error('[ZeroSeams] Save a Copy failed:', err))
              }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                background: 'none', border: 'none', color: '#e0e0e0',
                fontSize: 13, padding: '7px 14px', cursor: 'pointer',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#2a2a2a')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              Save a Copy…
            </button>
          </div>
        )}
      </div>

      <SaveStatusPill status={saveStatus} />

      {/* Center: tool groups */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {/* Group 1 — History */}
        <Tooltip label="Undo" shortcut="⌘Z">
          <button onClick={undo} disabled={undoDisabled} style={iconBtnStyle(false, undoDisabled)}>
            <Undo2 size={15} />
          </button>
        </Tooltip>
        <Tooltip label="Redo" shortcut="⌘⇧Z">
          <button onClick={redo} disabled={redoDisabled} style={iconBtnStyle(false, redoDisabled)}>
            <Redo2 size={15} />
          </button>
        </Tooltip>

        {divider}

        {/* Group 2 — Selection */}
        <Tooltip label="Select" shortcut="V">
          <button
            onClick={() => handleToolClick('select')}
            style={iconBtnStyle(activeTool === 'select')}
          >
            <MousePointer2 size={15} />
          </button>
        </Tooltip>

        <Tooltip label="Snap" shortcut="S" description="Snap to guides and objects">
          <button
            onClick={toggleSnap}
            aria-pressed={snapEnabled}
            style={{
              width: 30,
              height: 30,
              background: snapEnabled ? '#0af' : '#333',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s',
            }}
          >
            {SNAP_ICON}
          </button>
        </Tooltip>

        <div style={{ display: 'flex', alignItems: 'center', background: '#222', border: '1px solid #444', borderRadius: 4, padding: 2, gap: 2 }}>
          <Tooltip label="Crop mode" description="Frame clips content">
            <button
              onClick={() => setResizeMode('advanced')}
              style={segmentButtonStyle(resizeMode === 'advanced')}
            >{CROP_ICON}</button>
          </Tooltip>
          <Tooltip label="Auto-fill mode" description="Content fills frame on resize">
            <button
              onClick={() => setResizeMode('auto')}
              style={segmentButtonStyle(resizeMode === 'auto')}
            >{AUTOFILL_ICON}</button>
          </Tooltip>
        </div>

        {divider}

        {/* Group 3 — Create */}
        <Tooltip label="Text" shortcut="T">
          <button
            onClick={() => handleToolClick('text')}
            style={iconBtnStyle(activeTool === 'text')}
          >
            <Type size={15} />
          </button>
        </Tooltip>

        <Tooltip label="Shape" shortcut="R">
          <button
            onClick={() => handleToolClick('shape')}
            style={iconBtnStyle(activeTool === 'shape')}
          >
            {activeShapeKind === 'ellipse'
              ? <Circle size={15} />
              : activeShapeKind === 'line'
              ? <Minus size={15} />
              : <Square size={15} />}
          </button>
        </Tooltip>

        <Tooltip label="Pen" shortcut="P">
          <button
            onClick={() => handleToolClick('pen')}
            style={iconBtnStyle(activeTool === 'pen')}
          >
            <PenTool size={15} />
          </button>
        </Tooltip>

        <Tooltip label="Add video">
          <button
            onClick={() => { void handleAddVideo() }}
            style={iconBtnStyle(false)}
          >
            <Film size={15} />
          </button>
        </Tooltip>

        {selectedObj?.type === 'image' && (
          <Tooltip label="Mask mode" description="Next stroke becomes a mask">
            <button
              style={iconBtnStyle(maskModeActive)}
              title="Mask mode — next stroke becomes a mask"
              onClick={() => {
                setMaskModeActive(false)
                setSelected(null)
                setActiveTool('select')
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="12" cy="12" r="5.8" fill="currentColor" stroke="none"/>
              </svg>
            </button>
          </Tooltip>
        )}

        {activeTool === 'shape' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              background: '#222',
              borderRadius: 4,
              padding: '2px',
              border: '1px solid #444',
              marginLeft: 4,
            }}
          >
            {(['rect', 'ellipse', 'line'] as ShapeKind[]).map((kind) => (
              <Tooltip
                key={kind}
                label={kind === 'rect' ? 'Rectangle' : kind === 'ellipse' ? 'Ellipse' : 'Line'}
              >
                <button
                  onClick={() => { setActiveShapeKind(kind) }}
                  style={segmentButtonStyle(activeShapeKind === kind)}
                >
                  {kind === 'rect'
                    ? <Square size={13} strokeWidth={1.5}/>
                    : kind === 'ellipse'
                    ? <Circle size={13} strokeWidth={1.5}/>
                    : <Minus size={13} strokeWidth={1.5}/>}
                </button>
              </Tooltip>
            ))}
          </div>
        )}

        {divider}

        {/* Group 4 — Frame Settings */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowFrameSettings(v => !v)}
            style={{
              ...iconBtnStyle(showFrameSettings),
              width: 'auto',
              padding: '0 10px',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
            title="Frame Settings"
          >
            <LayoutTemplate size={15} strokeWidth={1.5}/>
            <span style={{ fontSize: 12 }}>Frame Settings</span>
          </button>
          {showFrameSettings && <FrameSettingsPopover onClose={() => setShowFrameSettings(false)}/>}
        </div>

        {divider}

        {/* Group 5 — Frame count */}
        <span style={{ color: '#aaa', fontSize: 13 }}>Frames:</span>
        <Tooltip label="Remove frame">
          <button
            onClick={handleMinus}
            disabled={frameCount <= 1}
            style={{
              width: 24,
              height: 24,
              background: '#333',
              color: frameCount <= 1 ? '#555' : '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: frameCount <= 1 ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Minus size={13} strokeWidth={1.5}/>
          </button>
        </Tooltip>
        <span
          style={{
            color: '#fff',
            fontSize: 14,
            fontWeight: 'bold',
            minWidth: 16,
            textAlign: 'center',
          }}
        >
          {frameCount}
        </span>
        <Tooltip label="Add frame">
          <button
            onClick={handlePlus}
            disabled={frameCount >= 10}
            style={{
              width: 24,
              height: 24,
              background: '#333',
              color: frameCount >= 10 ? '#555' : '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: frameCount >= 10 ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Plus size={13} strokeWidth={1.5}/>
          </button>
        </Tooltip>

        {divider}

        {/* Group 6 — Export */}
        <div ref={exportWrapperRef} style={{ position: 'relative' }}>
          <Tooltip label="Export">
            <button
              onClick={() => { setExportOpen((v) => !v) }}
              style={{
                padding: '4px 10px',
                height: 30,
                background: exportOpen ? '#0af' : '#333',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 13,
                transition: 'background 0.15s',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <ImageDown size={14} />
              Export
            </button>
          </Tooltip>

          {exportOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                zIndex: 1000,
                marginTop: 6,
                background: '#1e1e1e',
                border: '1px solid #3a3a3a',
                borderRadius: 8,
                boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                padding: '12px',
                minWidth: 220,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {/* Mode segmented control */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  background: '#222',
                  borderRadius: 4,
                  padding: '2px',
                  border: '1px solid #444',
                }}
              >
                {(['all', 'single', 'range'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setExportMode(mode)}
                    style={segmentButtonStyle(exportMode === mode)}
                  >
                    {mode === 'all' ? 'All' : mode === 'single' ? 'Single' : 'Range'}
                  </button>
                ))}
              </div>

              {exportMode === 'single' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ color: '#aaa', fontSize: 12 }}>Frame</label>
                  <input
                    type="number"
                    min={1}
                    max={frameCount}
                    value={exportSingle}
                    onChange={(e) => setExportSingle(Number(e.target.value))}
                    style={{
                      width: 48,
                      height: 24,
                      background: '#333',
                      color: '#fff',
                      border: '1px solid #444',
                      borderRadius: 3,
                      fontSize: 12,
                      textAlign: 'center',
                      padding: '0 4px',
                    }}
                  />
                </div>
              )}

              {exportMode === 'range' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ color: '#aaa', fontSize: 12 }}>From</label>
                  <input
                    type="number"
                    min={1}
                    max={frameCount}
                    value={exportFrom}
                    onChange={(e) => setExportFrom(Number(e.target.value))}
                    style={{
                      width: 48,
                      height: 24,
                      background: '#333',
                      color: '#fff',
                      border: '1px solid #444',
                      borderRadius: 3,
                      fontSize: 12,
                      textAlign: 'center',
                      padding: '0 4px',
                    }}
                  />
                  <label style={{ color: '#aaa', fontSize: 12 }}>To</label>
                  <input
                    type="number"
                    min={1}
                    max={frameCount}
                    value={exportTo}
                    onChange={(e) => setExportTo(Number(e.target.value))}
                    style={{
                      width: 48,
                      height: 24,
                      background: '#333',
                      color: '#fff',
                      border: '1px solid #444',
                      borderRadius: 3,
                      fontSize: 12,
                      textAlign: 'center',
                      padding: '0 4px',
                    }}
                  />
                </div>
              )}

              <button
                onClick={() => { void handleExportAction() }}
                disabled={exporting}
                style={{
                  height: 32,
                  background: exporting ? '#555' : '#0af',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  cursor: exporting ? 'default' : 'pointer',
                  fontSize: 13,
                  fontWeight: 'bold',
                }}
              >
                {exporting ? (exportStatus || 'Exporting…') : 'Export Frames'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
