import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useCanvasStore } from '@/canvas/useCanvasStore'
import { getStageInstance } from '@/canvas/CarouselStage'
import { exportMixedFrames } from '@/canvas/exportFrames'
import { useSaveStatusStore, type SaveStatus } from './useSaveStatusStore'
import type { CarouselProject } from '@/types/project'
import type { ShapeKind, VideoExportSettings, ImageExportSettings, ImageFormat } from '@/types/canvas'
import { DEFAULT_VIDEO_EXPORT_SETTINGS, DEFAULT_IMAGE_EXPORT_SETTINGS } from '@/types/canvas'
import { relativizeVideoObjects, resolveVideoObjects } from '@/canvas/pathUtils'
import {
  MousePointer2, Type, Square, Circle, Minus, PenTool,
  Undo2, Redo2, FolderOpen, Save, ImageDown,
  ChevronDown, ChevronUp, Plus, LayoutTemplate, Check, AlertTriangle, Film, Eye, EyeOff,
} from 'lucide-react'
import Tooltip from './Tooltip'
import type { Platform } from '@/types/project'

// ── Video export preset definitions ────────────────────────────────────────
const VIDEO_PRESETS = {
  draft:    { crf: 32, audioBitrate: 128, label: 'Draft',        hint: 'Smallest file' },
  balanced: { crf: 23, audioBitrate: 192, label: 'Balanced',     hint: 'Good quality' },
  high:     { crf: 18, audioBitrate: 256, label: 'High Quality', hint: 'Largest file' },
} as const

const PLATFORM_RECOMMENDED: Partial<Record<Platform, 'draft' | 'balanced' | 'high'>> = {
  instagram: 'balanced',
  threads:   'balanced',
  facebook:  'balanced',
  tiktok:    'high',
}

type PresetKey = 'draft' | 'balanced' | 'high'
import { iconBtnStyle } from './iconBtnStyle'
import { FrameSettingsPopover } from './FrameSettingsPopover'
import { useExportStore } from './useExportStore'
import { GridPicker } from './GridPicker'
import type { GridTemplate } from '../canvas/gridTemplates'

type ActiveTool = 'select' | 'text' | 'shape' | 'pen' | 'grid' | 'guideline'

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
    saving: { icon: <span/>, text: 'Saving…', color: '#aaaaaa' },
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
  <div style={{ width: 1, height: 20, background: '#d4ccc2', margin: '0 6px' }} />
)

function ToolGroup({ label, style, children }: {
  label: string
  style?: React.CSSProperties
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6, ...style }}>
      <span style={{
        position: 'absolute', top: -13, left: 0,
        fontSize: 9, fontWeight: 500, color: '#b0a89e',
        letterSpacing: '0.03em', textTransform: 'uppercase',
        pointerEvents: 'none', userSelect: 'none', lineHeight: 1, whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
      {children}
    </div>
  )
}

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

// ── buildProjectJson — module-level so both TitleBar and ToolBar can call it ──
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

// ── VideoExportSettingsPanel ────────────────────────────────────────────────
interface VideoExportSettingsPanelProps {
  platform: Platform
  tab: 'simple' | 'advanced'
  onTabChange: (t: 'simple' | 'advanced') => void
  preset: PresetKey
  onPresetChange: (k: PresetKey) => void
  settings: VideoExportSettings
  onSettingsChange: React.Dispatch<React.SetStateAction<VideoExportSettings>>
  videoSettingsBtnStyle: (active: boolean) => React.CSSProperties
}

function VideoExportSettingsPanel({
  platform, tab, onTabChange, preset, onPresetChange,
  settings, onSettingsChange, videoSettingsBtnStyle,
}: VideoExportSettingsPanelProps): React.ReactElement {
  const recommended = PLATFORM_RECOMMENDED[platform] ?? 'balanced'
  const platformLabel = platform.charAt(0).toUpperCase() + platform.slice(1)

  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, height: 24,
    background: active ? '#f94608' : 'none',
    color: active ? '#fff' : '#555555',
    border: 'none', borderRadius: 3, cursor: 'pointer',
    fontSize: 11, fontWeight: active ? 'bold' : 'normal',
  })

  const rowLabelStyle: React.CSSProperties = {
    color: '#555555', fontSize: 11, fontWeight: 'bold',
    letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap',
  }

  const numFieldStyle: React.CSSProperties = {
    width: 52, height: 24, background: '#ffffff', color: '#333333',
    border: '1px solid #d4ccc2', borderRadius: 6, fontSize: 12,
    textAlign: 'center', padding: '0 4px',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Tab strip */}
      <div style={{ display: 'flex', gap: 2, background: '#f5ede2', borderRadius: 6, padding: 2 }}>
        <button style={tabBtnStyle(tab === 'simple')} onClick={() => onTabChange('simple')}>Simple</button>
        <button style={tabBtnStyle(tab === 'advanced')} onClick={() => onTabChange('advanced')}>Advanced</button>
      </div>

      {tab === 'simple' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {(['draft', 'balanced', 'high'] as const).map((key) => {
            const p = VIDEO_PRESETS[key]
            const isActive = preset === key
            const isRecommended = key === recommended
            return (
              <button
                key={key}
                onClick={() => onPresetChange(key)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '6px 10px',
                  background: isActive ? '#fff4f0' : '#ffffff',
                  border: `1px solid ${isActive ? '#f94608' : '#d4ccc2'}`,
                  borderRadius: 6, cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ color: isActive ? '#f94608' : '#333333', fontSize: 12, fontWeight: 'bold' }}>{p.label}</span>
                  <span style={{ color: '#aaaaaa', fontSize: 10 }}>{p.hint}</span>
                </div>
                {isRecommended && (
                  <span style={{
                    fontSize: 9, color: isActive ? '#f94608' : '#555555',
                    border: `1px solid ${isActive ? '#f94608' : '#d4ccc2'}`,
                    borderRadius: 3, padding: '1px 4px', whiteSpace: 'nowrap',
                  }}>
                    {platformLabel}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Codec */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={rowLabelStyle}>Codec</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => onSettingsChange((s) => ({ ...s, videoCodec: 'libx264' }))} style={videoSettingsBtnStyle(settings.videoCodec === 'libx264')}>H.264</button>
              <button onClick={() => onSettingsChange((s) => ({ ...s, videoCodec: 'libx265' }))} style={videoSettingsBtnStyle(settings.videoCodec === 'libx265')}>H.265</button>
            </div>
          </div>
          {/* Quality — right = better quality, maps to lower CRF */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={rowLabelStyle}>Quality</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
              <input
                type="range" min={0} max={51} step={1}
                value={51 - settings.crf}
                onChange={(e) => onSettingsChange((s) => ({ ...s, crf: 51 - Number(e.target.value) }))}
                style={{ flex: 1, accentColor: '#f94608', cursor: 'pointer' }}
              />
              <span style={{ color: '#555555', fontSize: 11, minWidth: 36, textAlign: 'right' }}>CRF {settings.crf}</span>
            </div>
          </div>
          {/* Audio */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={rowLabelStyle}>Audio</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="number" min={32} max={320} value={settings.audioBitrate}
                onChange={(e) => onSettingsChange((s) => ({ ...s, audioBitrate: Number(e.target.value) }))}
                style={numFieldStyle}
              />
              <span style={{ color: '#aaaaaa', fontSize: 11 }}>kbps</span>
            </div>
          </div>
          {/* Frame rate */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={rowLabelStyle}>FPS</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['source', 24, 30, 60] as const).map((fps) => (
                <button key={String(fps)} onClick={() => onSettingsChange((s) => ({ ...s, frameRate: fps }))} style={videoSettingsBtnStyle(settings.frameRate === fps)}>
                  {fps === 'source' ? 'Source' : String(fps)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── TitleBar ────────────────────────────────────────────────────────────────
export function TitleBar(): React.ReactElement {
  const past = useCanvasStore((s) => s.past)
  const future = useCanvasStore((s) => s.future)
  const undo = useCanvasStore((s) => s.undo)
  const redo = useCanvasStore((s) => s.redo)
  const loadProject = useCanvasStore((s) => s.loadProject)
  const saveStatus = useSaveStatusStore((s) => s.status)
  const setProjectMeta = useSaveStatusStore((s) => s.setProjectMeta)
  const projectName = useSaveStatusStore((s) => s.projectName)
  const setCurrentFilePath = useSaveStatusStore((s) => s.setCurrentFilePath)

  const [loadingProject, setLoadingProject] = useState(false)
  const [recentOpen, setRecentOpen] = useState(false)
  const [recentFiles, setRecentFiles] = useState<Array<{ name: string; path: string; modifiedAt: string }>>([])
  const [saveMenuOpen, setSaveMenuOpen] = useState(false)

  const frameCount = useCanvasStore((s) => s.frameCount)
  const setFrameCount = useCanvasStore((s) => s.setFrameCount)
  const frameWidth = useCanvasStore((s) => s.frameWidth)
  const frameHeight = useCanvasStore((s) => s.frameHeight)
  const platform = useCanvasStore((s) => s.platform)
  const previewMode = useCanvasStore((s) => s.previewMode)
  const togglePreviewMode = useCanvasStore((s) => s.togglePreviewMode)
  const objects = useCanvasStore((s) => s.objects)

  const showFrameSettings = useCanvasStore((s) => s.showFrameSettings)
  const setShowFrameSettings = useCanvasStore((s) => s.setShowFrameSettings)
  const exportOpen = useCanvasStore((s) => s.exportOpen)
  const setExportOpen = useCanvasStore((s) => s.setExportOpen)
  const [exportMode, setExportMode] = useState<'all' | 'single' | 'range'>('all')
  const [exportSingle, setExportSingle] = useState(1)
  const [exportFrom, setExportFrom] = useState(1)
  const [exportTo, setExportTo] = useState(frameCount)
  const [exportSettings, setExportSettings] = useState<VideoExportSettings>({ ...DEFAULT_VIDEO_EXPORT_SETTINGS })
  const [showVideoSettings, setShowVideoSettings] = useState(false)
  const [videoSettingsTab, setVideoSettingsTab] = useState<'simple' | 'advanced'>('simple')
  const [selectedPreset, setSelectedPreset] = useState<'draft' | 'balanced' | 'high'>('balanced')
  const [filenameTemplate, setFilenameTemplate] = useState('frame_{frame}')
  const [imageSettings, setImageSettings] = useState<ImageExportSettings>({ ...DEFAULT_IMAGE_EXPORT_SETTINGS })
  const [exportPixelRatio, setExportPixelRatio] = useState<1 | 2 | 3>(2)
  const [maxFileSizeUnit, setMaxFileSizeUnit] = useState<'KB' | 'MB'>('KB')
  const exporting = useExportStore((s) => s.exporting)
  const exportStatus = useExportStore((s) => s.exportStatus)

  const recentWrapperRef = useRef<HTMLDivElement>(null)
  const exportWrapperRef = useRef<HTMLDivElement>(null)

  const undoDisabled = past.length === 0
  const redoDisabled = future.length === 0

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

  const hasVideoInRange = useMemo(() => {
    const start = exportMode === 'single' ? exportSingle - 1 : exportMode === 'range' ? exportFrom - 1 : 0
    const end = exportMode === 'single' ? exportSingle - 1 : exportMode === 'range' ? exportTo - 1 : frameCount - 1
    return Object.values(objects).some((obj) => {
      if (obj.type !== 'video' || !obj.visible) return false
      const frameLeft = start * frameWidth
      const frameRight = (end + 1) * frameWidth
      return obj.x < frameRight && obj.x + obj.width > frameLeft
    })
  }, [objects, exportMode, exportSingle, exportFrom, exportTo, frameCount, frameWidth])

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

    const { setExporting, setExportStatus, reset: resetExport } = useExportStore.getState()
    setExporting(true)
    setExportStatus('Exporting…')
    useExportStore.setState({ cancelRequested: false })
    void window.electronAPI.clearExportLog()
    try {
      // Pick a folder once — replaces per-frame save dialogs
      const { folderPath, cancelled } = await window.electronAPI.showFolderDialog()
      if (cancelled || !folderPath) {
        return
      }

      const storeObjects = useCanvasStore.getState().objects
      const results = await exportMixedFrames(
        stage, storeObjects, frameCount, frameWidth, frameHeight, start, end,
        setExportStatus,
        () => useExportStore.getState().cancelRequested,
        exportSettings,
        imageSettings,
        exportPixelRatio,
      )

      // Write each result to the selected folder
      for (const result of results) {
        const frameNum = result.frameIndex + 1
        const filename = filenameTemplate.replace('{frame}', String(frameNum)) + '.' + result.extension
        const base64 = await blobToBase64(result.blob)
        const writeResult = await window.electronAPI.writeFileToFolder(folderPath, filename, base64)
        console.log(`[export] ${filename}: ${writeResult.success ? 'saved' : 'ERROR: ' + writeResult.error}`)
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

  function handleMinus(): void {
    setFrameCount(frameCount - 1)
  }

  function handlePlus(): void {
    setFrameCount(frameCount + 1)
  }

  const videoSettingsBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '0 8px',
    height: 24,
    background: active ? '#f94608' : '#ffffff',
    color: active ? '#fff' : '#555555',
    border: `1px solid ${active ? '#f94608' : '#d4ccc2'}`,
    borderRadius: 999,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: active ? 'bold' : 'normal',
    transition: 'background 0.15s, color 0.15s',
    whiteSpace: 'nowrap' as const,
  })

  const titleBarSegmentButtonStyle = (active: boolean): React.CSSProperties => ({
    padding: '3px 10px',
    height: 24,
    background: active ? '#f94608' : 'transparent',
    color: active ? '#fff' : '#555555',
    border: 'none',
    borderRadius: 999,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: active ? 'bold' : 'normal',
    transition: 'background 0.15s, color 0.15s',
    whiteSpace: 'nowrap' as const,
  })

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

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 52,
        padding: '0 20px',
        gap: 8,
        background: 'var(--bg-base)',
        borderBottom: '1px solid var(--border)',
        boxSizing: 'border-box',
        fontFamily: 'var(--font)',
        flexShrink: 0,
      }}
    >
      {/* App title */}
      <div
        style={{
          paddingLeft: 0,
          color: '#111111',
          fontSize: 16,
          fontWeight: 'bold',
          whiteSpace: 'nowrap',
          flex: '0 0 auto',
          fontFamily: 'var(--font)',
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
              background: '#ffffff',
              color: loadingProject ? '#aaaaaa' : '#555555',
              border: '1px solid #d4ccc2',
              borderRight: 'none',
              borderRadius: '999px 0 0 999px',
              cursor: loadingProject ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: loadingProject ? 0.5 : 1,
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
              background: recentOpen ? '#f5ede2' : '#ffffff',
              color: '#555555',
              border: '1px solid #d4ccc2',
              borderRadius: '0 999px 999px 0',
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
              background: '#ffffff',
              border: '1px solid #e8e0d5',
              borderRadius: 12,
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              padding: '4px 0',
              minWidth: 260,
            }}
          >
            {recentFiles.length === 0 ? (
              <div style={{ padding: '8px 14px', color: '#aaaaaa', fontSize: 12 }}>No recent projects</div>
            ) : (
              recentFiles.map((file) => (
                <div
                  key={file.path}
                  title={file.path}
                  onClick={() => { void handleOpen() }}
                  style={{
                    padding: '7px 14px',
                    cursor: 'pointer',
                    borderBottom: '1px solid #e8e0d5',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#f5ede2' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                >
                  <div style={{ color: '#111111', fontSize: 13, fontWeight: 'bold' }}>{file.name}</div>
                  <div style={{ color: '#aaaaaa', fontSize: 11 }}>
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
              background: '#ffffff',
              color: '#333333',
              border: '1px solid #d4ccc2',
              borderRight: 'none',
              borderRadius: '999px 0 0 999px',
              cursor: 'pointer',
              fontSize: 13,
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              fontFamily: 'var(--font)',
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
              background: saveMenuOpen ? '#f5ede2' : '#ffffff',
              color: '#555555',
              border: '1px solid #d4ccc2',
              borderRadius: '0 999px 999px 0',
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
            background: '#ffffff',
            border: '1px solid #e8e0d5',
            borderRadius: 12,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
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
                background: 'none', border: 'none', color: '#333333',
                fontSize: 13, padding: '7px 14px', cursor: 'pointer',
                fontFamily: 'var(--font)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f5ede2')}
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
                background: 'none', border: 'none', color: '#333333',
                fontSize: 13, padding: '7px 14px', cursor: 'pointer',
                fontFamily: 'var(--font)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f5ede2')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              Save a Copy…
            </button>
          </div>
        )}
      </div>

      <SaveStatusPill status={saveStatus} />

      <div style={{ flex: 1 }} />

      {/* Frame Settings */}
      <div style={{ position: 'relative' }}>
        <Tooltip label="Frame Settings" shortcut="F">
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
          >
            <LayoutTemplate size={15} strokeWidth={1.5}/>
            <span style={{ fontSize: 12, fontFamily: 'var(--font)' }}>Frame Settings</span>
          </button>
        </Tooltip>
        {showFrameSettings && <FrameSettingsPopover onClose={() => setShowFrameSettings(false)}/>}
      </div>

      {divider}

      {/* Frame count */}
      <span style={{ color: '#555555', fontSize: 13, fontFamily: 'var(--font)' }}>Frames:</span>
      <div style={{ display: 'flex', alignItems: 'center', background: '#ffffff', border: '1px solid #d4ccc2', borderRadius: 999, padding: '2px 6px', gap: 4 }}>
        <Tooltip label="Remove frame" shortcut="⌘←">
          <button
            onClick={handleMinus}
            disabled={frameCount <= 1}
            style={{
              width: 20,
              height: 20,
              background: 'none',
              color: frameCount <= 1 ? '#aaaaaa' : '#555555',
              border: 'none',
              borderRadius: 999,
              cursor: frameCount <= 1 ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            <Minus size={13} strokeWidth={1.5}/>
          </button>
        </Tooltip>
        <span
          style={{
            color: '#111111',
            fontSize: 14,
            fontWeight: 'bold',
            minWidth: 16,
            textAlign: 'center',
            fontFamily: 'var(--font)',
          }}
        >
          {frameCount}
        </span>
        <Tooltip label="Add frame" shortcut="⌘→">
          <button
            onClick={handlePlus}
            disabled={frameCount >= 10}
            style={{
              width: 20,
              height: 20,
              background: 'none',
              color: frameCount >= 10 ? '#aaaaaa' : '#555555',
              border: 'none',
              borderRadius: 999,
              cursor: frameCount >= 10 ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            <Plus size={13} strokeWidth={1.5}/>
          </button>
        </Tooltip>
      </div>

      {divider}

      {/* Preview button */}
      <Tooltip label="Preview" shortcut="⌘⇧P" description="Preview carousel in platform mockup">
        <button
          onClick={togglePreviewMode}
          disabled={platform === 'custom'}
          aria-pressed={previewMode}
          style={iconBtnStyle(previewMode, platform === 'custom')}
        >
          <Eye size={15} />
        </button>
      </Tooltip>

      {/* Export */}
      <div ref={exportWrapperRef} style={{ position: 'relative' }}>
        <Tooltip label="Export" shortcut="⌘E">
          <button
            className="btn-raised"
            onClick={() => { setExportOpen((v) => !v) }}
            style={{
              padding: '5px 14px',
              background: '#f94608',
              color: '#fff',
              border: '1px solid #000000',
              borderRadius: 999,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontFamily: 'var(--font)',
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
              background: 'var(--bg-panel)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              padding: '12px',
              minWidth: 220,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              fontFamily: 'var(--font)',
            }}
          >
            {/* Mode segmented control */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                background: 'var(--bg-panel)',
                borderRadius: 999,
                padding: '2px',
                border: '1px solid var(--border)',
              }}
            >
              {(['all', 'single', 'range'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setExportMode(mode)}
                  style={titleBarSegmentButtonStyle(exportMode === mode)}
                >
                  {mode === 'all' ? 'All' : mode === 'single' ? 'Single' : 'Range'}
                </button>
              ))}
            </div>

            {exportMode === 'single' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ color: 'var(--text-secondary)', fontSize: 12, fontFamily: 'var(--font)' }}>Frame</label>
                <input
                  type="number"
                  min={1}
                  max={frameCount}
                  value={exportSingle}
                  onChange={(e) => setExportSingle(Number(e.target.value))}
                  style={{
                    width: 48,
                    height: 24,
                    background: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--stroke)',
                    borderRadius: 6,
                    fontSize: 12,
                    fontFamily: 'var(--font)',
                    textAlign: 'center',
                    padding: '0 4px',
                  }}
                />
              </div>
            )}

            {exportMode === 'range' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ color: 'var(--text-secondary)', fontSize: 12, fontFamily: 'var(--font)' }}>From</label>
                <input
                  type="number"
                  min={1}
                  max={frameCount}
                  value={exportFrom}
                  onChange={(e) => setExportFrom(Number(e.target.value))}
                  style={{
                    width: 48,
                    height: 24,
                    background: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--stroke)',
                    borderRadius: 6,
                    fontSize: 12,
                    fontFamily: 'var(--font)',
                    textAlign: 'center',
                    padding: '0 4px',
                  }}
                />
                <label style={{ color: 'var(--text-secondary)', fontSize: 12, fontFamily: 'var(--font)' }}>To</label>
                <input
                  type="number"
                  min={1}
                  max={frameCount}
                  value={exportTo}
                  onChange={(e) => setExportTo(Number(e.target.value))}
                  style={{
                    width: 48,
                    height: 24,
                    background: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--stroke)',
                    borderRadius: 6,
                    fontSize: 12,
                    fontFamily: 'var(--font)',
                    textAlign: 'center',
                    padding: '0 4px',
                  }}
                />
              </div>
            )}

            {/* ── Filename template ─────────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font)' }}>
                Filename
              </label>
              <input
                type="text"
                value={filenameTemplate}
                onChange={e => setFilenameTemplate(e.target.value)}
                placeholder="frame_{frame}"
                style={{
                  fontFamily: 'var(--font)',
                  fontSize: 12,
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  padding: '4px 8px',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              />
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font)' }}>
                Preview: {filenameTemplate.replace('{frame}', '1')}.{imageSettings.format === 'jpeg' ? 'jpg' : imageSettings.format === 'tiff' ? 'tif' : 'png'}
              </span>
            </div>

            {/* ── Format selector ───────────────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font)' }}>
                Format
              </label>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['png', 'jpeg', 'tiff'] as ImageFormat[]).map(fmt => (
                  <button
                    key={fmt}
                    onClick={() => setImageSettings(s => ({ ...s, format: fmt }))}
                    style={{
                      fontFamily: 'var(--font)',
                      fontSize: 12,
                      borderRadius: 999,
                      border: imageSettings.format === fmt ? '1.5px solid var(--accent)' : '1px solid var(--stroke)',
                      padding: '3px 10px',
                      background: imageSettings.format === fmt ? 'var(--accent)' : 'var(--bg-surface)',
                      color: imageSettings.format === fmt ? '#fff' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      textTransform: 'uppercase' as const,
                    }}
                  >
                    {fmt === 'jpeg' ? 'JPG' : fmt.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Quality slider (JPEG and TIFF only) ───────────────────────── */}
            {imageSettings.format !== 'png' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font)' }}>
                  Quality: {imageSettings.quality}%
                </label>
                <input
                  type="range"
                  min={0} max={100}
                  value={imageSettings.quality}
                  onChange={e => setImageSettings(s => ({ ...s, quality: Number(e.target.value) }))}
                />
              </div>
            )}

            {/* ── Max file size (JPEG only) ──────────────────────────────────── */}
            {imageSettings.format === 'jpeg' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font)' }}>
                  Max file size <span style={{ color: 'var(--text-muted)' }}>(optional)</span>
                </label>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input
                    type="number"
                    min={1}
                    placeholder="—"
                    value={imageSettings.maxFileSizeKB ?? ''}
                    onChange={e => {
                      const v = e.target.value === '' ? undefined : Number(e.target.value)
                      const kb = v === undefined ? undefined : maxFileSizeUnit === 'MB' ? v * 1024 : v
                      setImageSettings(s => ({ ...s, maxFileSizeKB: kb }))
                    }}
                    style={{
                      fontFamily: 'var(--font)',
                      fontSize: 12,
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      padding: '4px 8px',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      width: 70,
                      outline: 'none',
                    }}
                  />
                  <select
                    value={maxFileSizeUnit}
                    onChange={e => setMaxFileSizeUnit(e.target.value as 'KB' | 'MB')}
                    style={{
                      fontFamily: 'var(--font)',
                      fontSize: 12,
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      padding: '4px 6px',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-secondary)',
                      outline: 'none',
                    }}
                  >
                    <option value="KB">KB</option>
                    <option value="MB">MB</option>
                  </select>
                </div>
              </div>
            )}

            {/* ── Resolution ────────────────────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font)' }}>
                Resolution
              </label>
              <div style={{ display: 'flex', gap: 4 }}>
                {([1, 2, 3] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => setExportPixelRatio(r)}
                    style={{
                      fontFamily: 'var(--font)',
                      fontSize: 12,
                      borderRadius: 999,
                      border: exportPixelRatio === r ? '1.5px solid var(--accent)' : '1px solid var(--stroke)',
                      padding: '3px 10px',
                      background: exportPixelRatio === r ? 'var(--accent)' : 'var(--bg-surface)',
                      color: exportPixelRatio === r ? '#fff' : 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    {r}×
                  </button>
                ))}
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font)' }}>
                {frameWidth * exportPixelRatio} × {frameHeight * exportPixelRatio} px
              </span>
            </div>

            {hasVideoInRange && (
              <div
                style={{
                  borderTop: '1px solid var(--border)',
                  paddingTop: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <button
                  onClick={() => setShowVideoSettings((v) => !v)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  <span
                    style={{
                      color: 'var(--text-secondary)',
                      fontSize: 11,
                      fontWeight: 'bold',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      fontFamily: 'var(--font)',
                    }}
                  >
                    Video Settings
                  </span>
                  {showVideoSettings
                    ? <ChevronUp size={13} style={{ color: 'var(--text-muted)' }} strokeWidth={1.5}/>
                    : <ChevronDown size={13} style={{ color: 'var(--text-muted)' }} strokeWidth={1.5}/>}
                </button>

                {showVideoSettings && (
                  <VideoExportSettingsPanel
                    platform={platform}
                    tab={videoSettingsTab}
                    onTabChange={setVideoSettingsTab}
                    preset={selectedPreset}
                    onPresetChange={(key) => {
                      setSelectedPreset(key)
                      setExportSettings((s) => ({
                        ...s,
                        crf: VIDEO_PRESETS[key].crf,
                        audioBitrate: VIDEO_PRESETS[key].audioBitrate,
                      }))
                    }}
                    settings={exportSettings}
                    onSettingsChange={setExportSettings}
                    videoSettingsBtnStyle={videoSettingsBtnStyle}
                  />
                )}
              </div>
            )}

            <button
              className={exporting ? '' : 'btn-raised'}
              onClick={() => { void handleExportAction() }}
              disabled={exporting}
              style={{
                height: 32,
                background: exporting ? 'var(--text-muted)' : 'var(--accent)',
                color: 'var(--bg-surface)',
                border: exporting ? 'none' : '1px solid #000000',
                borderRadius: 999,
                cursor: exporting ? 'default' : 'pointer',
                fontSize: 13,
                fontWeight: 'bold',
                fontFamily: 'var(--font)',
              }}
            >
              {exporting ? (exportStatus || 'Exporting…') : 'Export Frames'}
            </button>
          </div>
        )}
      </div>

      {divider}

      {/* Undo/Redo pill */}
      <div style={{ display: 'flex', alignItems: 'center', background: '#ffffff', border: '1px solid #d4ccc2', borderRadius: 999, padding: 3, gap: 2 }}>
        <Tooltip label="Undo" shortcut="⌘Z">
          <button onClick={undo} disabled={undoDisabled} style={{ ...iconBtnStyle(false, undoDisabled), border: 'none' }}>
            <Undo2 size={15} />
          </button>
        </Tooltip>
        <Tooltip label="Redo" shortcut="⌘⇧Z">
          <button onClick={redo} disabled={redoDisabled} style={{ ...iconBtnStyle(false, redoDisabled), border: 'none' }}>
            <Redo2 size={15} />
          </button>
        </Tooltip>
      </div>
    </div>
  )
}

// ── ToolBar ─────────────────────────────────────────────────────────────────
export function ToolBar(): React.ReactElement {
  const activeTool = useCanvasStore((s) => s.activeTool)
  const setActiveTool = useCanvasStore((s) => s.setActiveTool)
  const guidelineOrientation = useCanvasStore((s) => s.guidelineOrientation)
  const setGuidelineOrientation = useCanvasStore((s) => s.setGuidelineOrientation)
  const guidelinesVisible = useCanvasStore((s) => s.guidelinesVisible)
  const toggleGuidelinesVisible = useCanvasStore((s) => s.toggleGuidelinesVisible)
  const frameWidth = useCanvasStore((s) => s.frameWidth)
  const frameHeight = useCanvasStore((s) => s.frameHeight)
  const resizeMode = useCanvasStore((s) => s.resizeMode)
  const setResizeMode = useCanvasStore((s) => s.setResizeMode)
  const snapEnabled = useCanvasStore((s) => s.snapEnabled)
  const toggleSnap = useCanvasStore((s) => s.toggleSnap)
  const activeShapeKind = useCanvasStore((s) => s.activeShapeKind)
  const setActiveShapeKind = useCanvasStore((s) => s.setActiveShapeKind)
  const selectedId = useCanvasStore((s) => s.selectedId)
  const objects = useCanvasStore((s) => s.objects)
  const setSelected = useCanvasStore((s) => s.setSelected)
  const maskModeActive = useCanvasStore((s) => s.maskModeActive)
  const setMaskModeActive = useCanvasStore((s) => s.setMaskModeActive)
  const addObject = useCanvasStore((s) => s.addObject)
  const objectOrder = useCanvasStore((s) => s.objectOrder)

  const [gridPickerAnchor, setGridPickerAnchor] = useState<HTMLElement | null>(null)

  const selectedObj = selectedId != null ? objects[selectedId] : undefined

  function handleToolClick(tool: ActiveTool): void {
    setActiveTool(tool)
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

  async function handleAddImage(): Promise<void> {
    const result = await window.electronAPI.openImageFile()
    if (result.canceled || !result.data) return
    const img = new Image()
    img.src = result.data
    await img.decode()
    const MAX_SIZE = 600
    const scale = Math.min(1, MAX_SIZE / Math.max(img.naturalWidth, img.naturalHeight))
    const contentWidth = Math.round(img.naturalWidth * scale)
    const contentHeight = Math.round(img.naturalHeight * scale)
    const x = frameWidth / 2 - contentWidth / 2
    const y = frameHeight / 2 - contentHeight / 2
    addObject({
      id: crypto.randomUUID(), type: 'image', scope: 'global', name: 'image',
      src: result.data, backgroundRemoved: false,
      naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight,
      frameX: x, frameY: y, frameWidth: contentWidth, frameHeight: contentHeight,
      contentOffsetX: 0, contentOffsetY: 0, contentWidth, contentHeight,
      contentEditMode: false, maskEditMode: false,
      x, y, width: contentWidth, height: contentHeight,
      rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, locked: false,
      zIndex: objectOrder.length,
    })
  }

  const segmentButtonStyle = (active: boolean): React.CSSProperties => ({
    padding: '3px 10px',
    height: 24,
    background: active ? '#f94608' : 'transparent',
    color: active ? '#fff' : '#555555',
    border: 'none',
    borderRadius: 999,
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
        alignItems: 'flex-end',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        height: 62,
        padding: '0 20px 10px',
        gap: 0,
        background: 'linear-gradient(to bottom, var(--bg-base) 0%, var(--bg-base) 50%, transparent 100%)',
        boxSizing: 'border-box',
        fontFamily: 'var(--font)',
      }}
    >
      {/* ── Transform ─────────────────────────────────────────────────────────── */}
      <ToolGroup label="Transform" style={{ marginRight: 28 }}>
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
            style={iconBtnStyle(snapEnabled)}
          >
            {SNAP_ICON}
          </button>
        </Tooltip>

        <div style={{ display: 'flex', alignItems: 'center', background: '#ffffff', border: '1px solid #d4ccc2', borderRadius: 999, padding: 2, gap: 2 }}>
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
      </ToolGroup>

      {/* ── Add ───────────────────────────────────────────────────────────────── */}
      <ToolGroup label="Add" style={{ marginRight: 28 }}>
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

        <Tooltip label="Add image">
          <button
            onClick={() => { void handleAddImage() }}
            style={iconBtnStyle(false)}
          >
            <ImageDown size={15} />
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
      </ToolGroup>

      {/* ── Layout ────────────────────────────────────────────────────────────── */}
      <ToolGroup label="Layout">
        <Tooltip label="Grid">
          <button
            style={iconBtnStyle(activeTool === 'grid')}
            onClick={e => {
              setActiveTool('grid')
              setGridPickerAnchor(e.currentTarget)
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="1" width="6" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="9" y="1" width="6" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="1" y="9" width="6" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="9" y="9" width="6" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </button>
        </Tooltip>

        <Tooltip label="Guideline" shortcut="G" description="Add ruler guideline">
          <button
            onClick={() => handleToolClick('guideline')}
            style={iconBtnStyle(activeTool === 'guideline')}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <line x1="1" y1="7.5" x2="14" y2="7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 2"/>
              <line x1="7.5" y1="1" x2="7.5" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 2" opacity="0.35"/>
            </svg>
          </button>
        </Tooltip>

        <Tooltip label={guidelinesVisible ? 'Hide guidelines' : 'Show guidelines'}>
          <button
            onClick={toggleGuidelinesVisible}
            style={iconBtnStyle(!guidelinesVisible)}
          >
            {guidelinesVisible ? <Eye size={15} /> : <EyeOff size={15} />}
          </button>
        </Tooltip>
      </ToolGroup>

      {activeTool === 'guideline' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            background: '#ffffff',
            borderRadius: 999,
            padding: '2px',
            border: '1px solid #d4ccc2',
            marginLeft: 4,
          }}
        >
          <Tooltip label="Horizontal" shortcut="X">
            <button
              onClick={() => setGuidelineOrientation('horizontal')}
              style={{
                ...iconBtnStyle(guidelineOrientation === 'horizontal'),
                width: 28,
                height: 28,
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              H
            </button>
          </Tooltip>
          <Tooltip label="Vertical" shortcut="X">
            <button
              onClick={() => setGuidelineOrientation('vertical')}
              style={{
                ...iconBtnStyle(guidelineOrientation === 'vertical'),
                width: 28,
                height: 28,
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              V
            </button>
          </Tooltip>
        </div>
      )}

      {selectedObj?.type === 'image' && (
        <Tooltip label="Mask mode" shortcut="M" description="Next stroke becomes a mask">
          <button
            style={iconBtnStyle(maskModeActive)}
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

      <GridPicker
        anchorEl={gridPickerAnchor}
        onClose={() => { setGridPickerAnchor(null); setActiveTool('select') }}
        onSelect={(template: GridTemplate) => {
          const { addGrid } = useCanvasStore.getState()
          addGrid(template, 0, 0)
          setGridPickerAnchor(null)
          setActiveTool('select')
        }}
      />

      {activeTool === 'shape' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            background: '#ffffff',
            borderRadius: 999,
            padding: '2px',
            border: '1px solid #d4ccc2',
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
    </div>
  )
}
