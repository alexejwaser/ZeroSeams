import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useCanvasStore } from '@/canvas/useCanvasStore'
import { getStageInstance } from '@/canvas/CarouselStage'
import { exportMixedFrames } from '@/canvas/exportFrames'
import { useSaveStatusStore, type SaveStatus } from '@/store'
import * as fileManager from '@/io/fileManager'
import { LAYER_PANEL_WIDTH, PROPERTIES_PANEL_WIDTH, TOOL_BAR_HEIGHT } from './panelConstants'
import type { ShapeKind, VideoExportSettings, ImageExportSettings, ImageFormat } from '@/types/canvas'
import { DEFAULT_VIDEO_EXPORT_SETTINGS, DEFAULT_IMAGE_EXPORT_SETTINGS } from '@/types/canvas'
import {
  MousePointer2, Type, Square, Circle, Minus, PenTool,
  Undo2, Redo2, FolderOpen, FilePlus, Save, ImageDown,
  ChevronDown, ChevronUp, Plus, LayoutTemplate, Check, AlertTriangle, Film, Eye, EyeOff, X,
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
import { iconBtnProps } from './iconBtnStyle'
import { FrameSettingsPopover } from './FrameSettingsPopover'
import { NumericInput } from './NumericInput'
import { useExportStore } from '@/store'
import { GridPicker } from './GridPicker'
import type { GridTemplate } from '@/canvas/gridTemplates'
import type { ActiveTool } from '@/canvas/useCanvasStore'
import { buildImageObject, buildVideoObject, defaultDropPoint } from '@/canvas/mediaPlacement'
import { loadVideoMetadataFromPath } from '@/canvas/videoMetadata'


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
    saving: { icon: <span className="save-spinner" />, text: 'Saving…', color: 'var(--text-tertiary)' },
    saved: { icon: <Check size={12} strokeWidth={1.5}/>, text: ' Saved', color: 'var(--success)' },
    error: { icon: <AlertTriangle size={12} strokeWidth={1.5}/>, text: ' Save failed', color: 'var(--danger)' },
  }

  const { icon, text, color } = config[status as Exclude<SaveStatus, 'idle'>]

  return (
    <span
      // Save state is announced rather than only shown — the pill is the only
      // feedback that a ⌘S landed, and it lives outside the focus path.
      role="status"
      aria-live="polite"
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
  <div style={{ width: 1, height: 20, background: 'var(--stroke)', margin: '0 6px' }} />
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
        fontSize: 9, fontWeight: 500, color: 'var(--text-tertiary)',
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
    background: active ? 'var(--accent)' : 'none',
    color: active ? '#fff' : 'var(--text-secondary)',
    border: 'none', borderRadius: 3, cursor: 'pointer',
    fontSize: 11, fontWeight: active ? 'bold' : 'normal',
  })

  const rowLabelStyle: React.CSSProperties = {
    color: 'var(--text-secondary)', fontSize: 11, fontWeight: 'bold',
    letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Tab strip */}
      <div style={{ display: 'flex', gap: 2, background: 'var(--bg-canvas)', borderRadius: 6, padding: 2 }}>
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
                  background: isActive ? 'var(--accent-tint)' : 'var(--bg-surface)',
                  border: `1px solid ${isActive ? 'var(--accent)' : 'var(--stroke)'}`,
                  borderRadius: 6, cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ color: isActive ? 'var(--accent)' : 'var(--text-primary)', fontSize: 12, fontWeight: 'bold' }}>{p.label}</span>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>{p.hint}</span>
                </div>
                {isRecommended && (
                  <span style={{
                    fontSize: 9, color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                    border: `1px solid ${isActive ? 'var(--accent)' : 'var(--stroke)'}`,
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
                style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
              <span style={{ color: 'var(--text-secondary)', fontSize: 11, minWidth: 36, textAlign: 'right' }}>CRF {settings.crf}</span>
            </div>
          </div>
          {/* Audio */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={rowLabelStyle}>Audio</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <NumericInput
                value={settings.audioBitrate}
                label="Audio bitrate" unit="kbps"
                min={32} max={320} step={8}
                width={96} align="right"
                onChange={v => onSettingsChange(s => ({ ...s, audioBitrate: v }))}
                onCommit={v => onSettingsChange(s => ({ ...s, audioBitrate: v }))}
              />
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
// Export dialog settings survive app restarts (format, resolution, filename…).
const EXPORT_SETTINGS_KEY = 'zeroseams:exportSettings'

interface PersistedExportSettings {
  exportMode: 'all' | 'single' | 'range'
  filenameTemplate: string
  imageSettings: ImageExportSettings
  exportPixelRatio: 1 | 2 | 3
  videoSettings: VideoExportSettings
  selectedPreset: 'draft' | 'balanced' | 'high'
  maxFileSizeUnit: 'KB' | 'MB'
}

function loadExportSettings(): Partial<PersistedExportSettings> {
  try {
    return JSON.parse(localStorage.getItem(EXPORT_SETTINGS_KEY) ?? '{}') as Partial<PersistedExportSettings>
  } catch {
    return {}
  }
}

export function TitleBar(): React.ReactElement {
  const past = useCanvasStore((s) => s.past)
  const future = useCanvasStore((s) => s.future)
  const undo = useCanvasStore((s) => s.undo)
  const redo = useCanvasStore((s) => s.redo)
  const saveStatus = useSaveStatusStore((s) => s.status)
  const projectName = useSaveStatusStore((s) => s.projectName)
  const isDirty = useSaveStatusStore((s) => s.dirty)

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
  const [persisted] = useState(loadExportSettings)
  const [exportMode, setExportMode] = useState<'all' | 'single' | 'range'>(persisted.exportMode ?? 'all')
  const [exportSingle, setExportSingle] = useState(1)
  const [exportFrom, setExportFrom] = useState(1)
  const [exportTo, setExportTo] = useState(frameCount)
  const [exportSettings, setExportSettings] = useState<VideoExportSettings>({ ...DEFAULT_VIDEO_EXPORT_SETTINGS, ...persisted.videoSettings })
  const [showVideoSettings, setShowVideoSettings] = useState(false)
  const [videoSettingsTab, setVideoSettingsTab] = useState<'simple' | 'advanced'>('simple')
  const [selectedPreset, setSelectedPreset] = useState<'draft' | 'balanced' | 'high'>(persisted.selectedPreset ?? 'balanced')
  const [filenameTemplate, setFilenameTemplate] = useState(persisted.filenameTemplate ?? 'frame_{frame}')
  const [imageSettings, setImageSettings] = useState<ImageExportSettings>({ ...DEFAULT_IMAGE_EXPORT_SETTINGS, ...persisted.imageSettings })
  const [exportPixelRatio, setExportPixelRatio] = useState<1 | 2 | 3>(persisted.exportPixelRatio ?? 2)
  const [maxFileSizeUnit, setMaxFileSizeUnit] = useState<'KB' | 'MB'>(persisted.maxFileSizeUnit ?? 'KB')
  const [exportError, setExportError] = useState<string | null>(null)
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

  // Session restore moved to NewDocumentGate (src/main.tsx): it has to win over
  // the New Document screen, so it can't run from a component that renders
  // alongside it.

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

  // Escape dismisses the export panel (matches color popover / preview shell)
  useEffect(() => {
    if (!exportOpen) return
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape' && !useExportStore.getState().exporting) setExportOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => { document.removeEventListener('keydown', handleKeyDown) }
  }, [exportOpen, setExportOpen])

  // Persist export settings so the dialog opens the way the user left it
  useEffect(() => {
    const snapshot: PersistedExportSettings = {
      exportMode, filenameTemplate, imageSettings, exportPixelRatio,
      videoSettings: exportSettings, selectedPreset, maxFileSizeUnit,
    }
    localStorage.setItem(EXPORT_SETTINGS_KEY, JSON.stringify(snapshot))
  }, [exportMode, filenameTemplate, imageSettings, exportPixelRatio, exportSettings, selectedPreset, maxFileSizeUnit])

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
    setExportError(null)
    useExportStore.setState({ cancelRequested: false })
    void window.electronAPI.clearExportLog()
    let succeeded = false
    try {
      // Pick a folder once — replaces per-frame save dialogs
      const { folderPath, cancelled } = await window.electronAPI.showFolderDialog()
      if (cancelled || !folderPath) {
        succeeded = true // user cancelled the dialog — not an error, just close
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
      const writeFailures: string[] = []
      for (const result of results) {
        const frameNum = result.frameIndex + 1
        const filename = filenameTemplate.replace('{frame}', String(frameNum)) + '.' + result.extension
        const base64 = await blobToBase64(result.blob)
        const writeResult = await window.electronAPI.writeFileToFolder(folderPath, filename, base64)
        console.log(`[export] ${filename}: ${writeResult.success ? 'saved' : 'ERROR: ' + writeResult.error}`)
        if (!writeResult.success) writeFailures.push(filename)
      }
      if (writeFailures.length > 0) {
        setExportError(`${writeFailures.length} of ${results.length} frames failed to write: ${writeFailures.slice(0, 3).join(', ')}${writeFailures.length > 3 ? '…' : ''}`)
      } else {
        succeeded = true
      }
    } catch (err) {
      const msg = String(err)
      if (!msg.includes('cancelled')) {
        console.error('[export] failed:', err)
        setExportError(`Export failed: ${msg}`)
      } else {
        succeeded = true // user-initiated cancel — close quietly
      }
    } finally {
      resetExport()
      // Keep the panel open on failure so the error banner is visible.
      if (succeeded) setExportOpen(false)
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
    background: active ? 'var(--accent)' : 'var(--bg-surface)',
    color: active ? '#fff' : 'var(--text-secondary)',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--stroke)'}`,
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
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? '#fff' : 'var(--text-secondary)',
    border: 'none',
    borderRadius: 999,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: active ? 'bold' : 'normal',
    transition: 'background 0.15s, color 0.15s',
    whiteSpace: 'nowrap' as const,
  })

  // Every file action below routes through src/io/fileManager — the same entry
  // points the native menu and the keyboard shortcuts use.
  async function handleOpen(): Promise<void> {
    setLoadingProject(true)
    try {
      await fileManager.openFromDialog()
    } finally {
      setLoadingProject(false)
      setRecentOpen(false)
    }
  }

  async function handleOpenFromPath(filePath: string): Promise<void> {
    setLoadingProject(true)
    try {
      await fileManager.openPath(filePath)
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
          color: 'var(--text-primary)',
          fontSize: 16,
          fontWeight: 'bold',
          whiteSpace: 'nowrap',
          flex: '0 0 auto',
          fontFamily: 'var(--font)',
        }}
      >
        {`Zero Seams${projectName !== 'Untitled Project' ? ` — ${projectName}` : ''}`}
        {isDirty && (
          <Tooltip label="Unsaved changes" description="Autosave runs a moment after you stop editing">
            <span
              style={{
                display: 'inline-block',
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: 'var(--accent)',
                marginLeft: 7,
                verticalAlign: 'middle',
              }}
            />
          </Tooltip>
        )}
      </div>

      {/* New document */}
      <Tooltip label="New" shortcut="⌘N" description="Pick a size and location for a new document">
        <button
          onClick={fileManager.requestNewDocument}
          {...iconBtnProps(false, false, { marginLeft: 12 })}
        >
          <FilePlus size={15} />
        </button>
      </Tooltip>

      {/* Open button + recent projects */}
      <div ref={recentWrapperRef} style={{ position: 'relative', display: 'flex', flex: '0 0 auto' }}>
        <Tooltip label="Open" shortcut="⌘O">
          <button
            onClick={() => { void handleOpen() }}
            disabled={loadingProject}
            style={{
              width: 30,
              height: 30,
              background: 'var(--bg-surface)',
              color: loadingProject ? 'var(--text-muted)' : 'var(--text-secondary)',
              border: '1px solid var(--stroke)',
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
              background: recentOpen ? 'var(--bg-panel)' : 'var(--bg-surface)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--stroke)',
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
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              padding: '4px 0',
              minWidth: 260,
            }}
          >
            {recentFiles.length === 0 ? (
              <div style={{ padding: '8px 14px', color: 'var(--text-tertiary)', fontSize: 12 }}>No recent projects</div>
            ) : (
              recentFiles.map((file) => (
                <Tooltip key={file.path} label={file.path}>
                <button
                  onClick={() => { void handleOpenFromPath(file.path) }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '7px 14px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-panel)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 'bold' }}>{file.name}</div>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>
                    {new Date(file.modifiedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </button>
                </Tooltip>
              ))
            )}
          </div>
        )}
      </div>

      {/* Save split-button */}
      <div data-save-menu style={{ position: 'relative', display: 'flex', marginLeft: 6, flex: '0 0 auto' }}>
        <Tooltip label="Save" shortcut="⌘S">
          <button
            onClick={() => { void fileManager.save() }}
            style={{
              padding: '4px 10px',
              height: 30,
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              border: '1px solid var(--stroke)',
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
              background: saveMenuOpen ? 'var(--bg-panel)' : 'var(--bg-surface)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--stroke)',
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
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            zIndex: 1000,
            minWidth: 160,
            padding: '4px 0',
          }}>
            <button
              onClick={() => {
                setSaveMenuOpen(false)
                void fileManager.saveAs()
              }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                background: 'none', border: 'none', color: 'var(--text-primary)',
                fontSize: 13, padding: '7px 14px', cursor: 'pointer',
                fontFamily: 'var(--font)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-panel)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              Save As…
            </button>
            <button
              onClick={() => {
                setSaveMenuOpen(false)
                void fileManager.saveCopy()
              }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                background: 'none', border: 'none', color: 'var(--text-primary)',
                fontSize: 13, padding: '7px 14px', cursor: 'pointer',
                fontFamily: 'var(--font)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-panel)')}
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
            {...iconBtnProps(showFrameSettings, false, {
              width: 'auto',
              padding: '0 10px',
              gap: 4,
            })}
          >
            <LayoutTemplate size={15} strokeWidth={1.5}/>
            <span style={{ fontSize: 12, fontFamily: 'var(--font)' }}>Frame Settings</span>
          </button>
        </Tooltip>
        {showFrameSettings && <FrameSettingsPopover onClose={() => setShowFrameSettings(false)}/>}
      </div>

      {divider}

      {/* Frame count */}
      <span style={{ color: 'var(--text-secondary)', fontSize: 13, fontFamily: 'var(--font)' }}>Frames:</span>
      <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-surface)', border: '1px solid var(--stroke)', borderRadius: 999, padding: '2px 6px', gap: 4 }}>
        <Tooltip label="Remove frame" shortcut="⌘←">
          <button
            onClick={handleMinus}
            disabled={frameCount <= 1}
            style={{
              width: 20,
              height: 20,
              background: 'none',
              color: frameCount <= 1 ? 'var(--text-muted)' : 'var(--text-secondary)',
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
            color: 'var(--text-primary)',
            fontSize: 14,
            fontWeight: 'bold',
            minWidth: 22,
            textAlign: 'center',
            fontFamily: 'var(--font)',
          }}
        >
          {frameCount}
        </span>
        <Tooltip label="Add frame" shortcut="⌘→">
          <button
            onClick={handlePlus}
            style={{
              width: 20,
              height: 20,
              background: 'none',
              color: 'var(--text-secondary)',
              border: 'none',
              borderRadius: 999,
              cursor: 'pointer',
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
          {...iconBtnProps(previewMode, platform === 'custom')}
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
              background: 'var(--accent)',
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
              background: 'var(--bg-surface)',
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
                background: 'var(--bg-canvas)',
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
                <NumericInput
                  value={exportSingle}
                  label="Frame to export"
                  min={1} max={frameCount}
                  width={48} align="center"
                  onChange={setExportSingle}
                  onCommit={setExportSingle}
                />
              </div>
            )}

            {exportMode === 'range' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ color: 'var(--text-secondary)', fontSize: 12, fontFamily: 'var(--font)' }}>From</label>
                <NumericInput
                  value={exportFrom}
                  label="First frame to export"
                  min={1} max={frameCount}
                  width={48} align="center"
                  onChange={setExportFrom}
                  onCommit={setExportFrom}
                />
                <label style={{ color: 'var(--text-secondary)', fontSize: 12, fontFamily: 'var(--font)' }}>To</label>
                <NumericInput
                  value={exportTo}
                  label="Last frame to export"
                  min={1} max={frameCount}
                  width={48} align="center"
                  onChange={setExportTo}
                  onCommit={setExportTo}
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
                }}
              />
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font)' }}>
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
                  Max file size <span style={{ color: 'var(--text-tertiary)' }}>(optional)</span>
                </label>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <NumericInput
                    value={imageSettings.maxFileSizeKB !== undefined
                      ? maxFileSizeUnit === 'MB'
                        ? Math.round(imageSettings.maxFileSizeKB / 1024 * 10) / 10
                        : imageSettings.maxFileSizeKB
                      : undefined}
                    label="Maximum file size"
                    min={1}
                    width={70} align="right"
                    onChange={v => {
                      const kb = maxFileSizeUnit === 'MB' ? v * 1024 : v
                      setImageSettings(s => ({ ...s, maxFileSizeKB: kb }))
                    }}
                    onCommit={v => {
                      const kb = maxFileSizeUnit === 'MB' ? v * 1024 : v
                      setImageSettings(s => ({ ...s, maxFileSizeKB: kb }))
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
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font)' }}>
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
                    ? <ChevronUp size={13} style={{ color: 'var(--text-tertiary)' }} strokeWidth={1.5}/>
                    : <ChevronDown size={13} style={{ color: 'var(--text-tertiary)' }} strokeWidth={1.5}/>}
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

            {exportError != null && (
              <div
                role="alert"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: 'var(--danger-bg)',
                  border: '1px solid var(--danger-border)',
                  color: 'var(--danger)',
                  fontSize: 12,
                  fontFamily: 'var(--font)',
                }}
              >
                <span style={{ flex: 1, wordBreak: 'break-word' }}>{exportError}</span>
                <button
                  onClick={() => { setExportError(null) }}
                  style={{
                    background: 'none', border: 'none', color: 'var(--danger)',
                    cursor: 'pointer', padding: 0, lineHeight: 0, flexShrink: 0,
                  }}
                  aria-label="Dismiss error"
                >
                  <X size={14} strokeWidth={2} />
                </button>
              </div>
            )}
            <button
              className={exporting ? '' : 'btn-raised'}
              onClick={() => { void handleExportAction() }}
              disabled={exporting}
              // Mid-export the label carries live progress ("Rendering frame 3 of 8"),
              // so it stays on the accent rather than dropping to a grey fill that
              // put white text at 2.3:1 exactly when it had the most to say.
              style={{
                height: 32,
                background: 'var(--accent)',
                color: '#fff',
                border: '1px solid #000000',
                borderRadius: 999,
                cursor: exporting ? 'default' : 'pointer',
                opacity: exporting ? 0.75 : 1,
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
      <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-surface)', border: '1px solid var(--stroke)', borderRadius: 999, padding: 3, gap: 2 }}>
        <Tooltip label="Undo" shortcut="⌘Z">
          <button onClick={undo} disabled={undoDisabled} {...iconBtnProps(false, undoDisabled, { border: 'none' })}>
            <Undo2 size={15} />
          </button>
        </Tooltip>
        <Tooltip label="Redo" shortcut="⌘⇧Z">
          <button onClick={redo} disabled={redoDisabled} {...iconBtnProps(false, redoDisabled, { border: 'none' })}>
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
  const resizeMode = useCanvasStore((s) => s.resizeMode)
  const setResizeMode = useCanvasStore((s) => s.setResizeMode)
  const snapEnabled = useCanvasStore((s) => s.snapEnabled)
  const toggleSnap = useCanvasStore((s) => s.toggleSnap)
  const activeShapeKind = useCanvasStore((s) => s.activeShapeKind)
  const setActiveShapeKind = useCanvasStore((s) => s.setActiveShapeKind)
  const addObject = useCanvasStore((s) => s.addObject)

  const [gridPickerAnchor, setGridPickerAnchor] = useState<HTMLElement | null>(null)

  function handleToolClick(tool: ActiveTool): void {
    setActiveTool(tool)
  }

  // Both add-media handlers place at defaultDropPoint() — the frame the cursor
  // was last over. They used to compute `frameWidth / 2`, i.e. always frame 0,
  // because a toolbar click carries no pointer of its own.

  async function handleAddVideo(): Promise<void> {
    const result = await window.electronAPI.openVideoFile()
    if (result.canceled || !result.filePath) return
    const filePath = result.filePath
    const name = filePath.split('/').pop()?.replace(/\.[^.]+$/, '') ?? 'video'
    // Shared loader: resolves only once BOTH duration and dimensions are valid.
    // Reading dimensions on durationchange alone yields 0×0 often enough to
    // matter, and a 0 makes fitCover stretch the video instead of cover-cropping.
    const meta = await loadVideoMetadataFromPath(filePath)
    if (!meta) return
    addObject(buildVideoObject({ filePath, name, at: defaultDropPoint(), ...meta }))
  }

  async function handleAddImage(): Promise<void> {
    const result = await window.electronAPI.openImageFile()
    if (result.canceled || !result.data) return
    const img = new Image()
    img.src = result.data
    await img.decode()
    addObject(buildImageObject({
      src: result.data,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      name: 'image',
      at: defaultDropPoint(),
    }))
  }

  const segmentButtonStyle = (active: boolean): React.CSSProperties => ({
    padding: '3px 10px',
    height: 24,
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? '#fff' : 'var(--text-secondary)',
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
        left: LAYER_PANEL_WIDTH,
        right: PROPERTIES_PANEL_WIDTH,
        zIndex: 10,
        height: TOOL_BAR_HEIGHT,
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
            {...iconBtnProps(activeTool === 'select')}
          >
            <MousePointer2 size={15} />
          </button>
        </Tooltip>

        <Tooltip label="Snap" shortcut="S" description="Snap to guides and objects">
          <button
            onClick={toggleSnap}
            aria-pressed={snapEnabled}
            {...iconBtnProps(snapEnabled)}
          >
            {SNAP_ICON}
          </button>
        </Tooltip>

        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-surface)', border: '1px solid var(--stroke)', borderRadius: 999, padding: 2, gap: 2 }}>
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
            {...iconBtnProps(activeTool === 'text')}
          >
            <Type size={15} />
          </button>
        </Tooltip>

        <Tooltip label="Shape" shortcut="R">
          <button
            onClick={() => handleToolClick('shape')}
            {...iconBtnProps(activeTool === 'shape')}
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
            {...iconBtnProps(activeTool === 'pen')}
          >
            <PenTool size={15} />
          </button>
        </Tooltip>

        <Tooltip label="Add image">
          <button
            onClick={() => { void handleAddImage() }}
            {...iconBtnProps(false)}
          >
            <ImageDown size={15} />
          </button>
        </Tooltip>

        <Tooltip label="Add video">
          <button
            onClick={() => { void handleAddVideo() }}
            {...iconBtnProps(false)}
          >
            <Film size={15} />
          </button>
        </Tooltip>
      </ToolGroup>

      {/* ── Layout ────────────────────────────────────────────────────────────── */}
      <ToolGroup label="Layout">
        <Tooltip label="Grid">
          <button
            {...iconBtnProps(activeTool === 'grid')}
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
            onClick={() => activeTool === 'guideline' ? setActiveTool('select') : handleToolClick('guideline')}
            {...iconBtnProps(activeTool === 'guideline')}
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
            {...iconBtnProps(!guidelinesVisible)}
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
            background: 'var(--bg-surface)',
            borderRadius: 999,
            padding: '2px',
            border: '1px solid var(--stroke)',
            marginLeft: 4,
          }}
        >
          <Tooltip label="Horizontal" shortcut="X">
            <button
              onClick={() => setGuidelineOrientation('horizontal')}
              {...iconBtnProps(guidelineOrientation === 'horizontal', false, {
                width: 28,
                height: 28,
                fontSize: 11,
                fontWeight: 600,
              })}
            >
              H
            </button>
          </Tooltip>
          <Tooltip label="Vertical" shortcut="X">
            <button
              onClick={() => setGuidelineOrientation('vertical')}
              {...iconBtnProps(guidelineOrientation === 'vertical', false, {
                width: 28,
                height: 28,
                fontSize: 11,
                fontWeight: 600,
              })}
            >
              V
            </button>
          </Tooltip>
        </div>
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
            background: 'var(--bg-surface)',
            borderRadius: 999,
            padding: '2px',
            border: '1px solid var(--stroke)',
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
