import React, { useMemo, useState } from 'react'
import { PLATFORM_PRESETS } from '@/canvas/useCanvasStore'
import type { FrameRatio, Platform } from '@/types/project'
import { NumericInput } from './NumericInput'
import Tooltip from './Tooltip'
import { FolderOpen, Clock, AlertTriangle } from 'lucide-react'

/**
 * The document-creation screen shown at launch and on File → New.
 *
 * Purely presentational: it never touches a store or IPC itself. The container
 * owns "what happens on Create", which is what keeps the no-file-written-until-
 * Create guarantee auditable in one place (src/io/fileManager.ts) instead of
 * being spread across a screen that also draws buttons.
 */

export interface NewDocumentSpec {
  platform: Platform
  ratio: FrameRatio
  width: number
  height: number
  frameCount: number
  folderPath: string
  filename: string
}

export interface RecentFile {
  name: string
  path: string
  modifiedAt: string
}

interface NewDocumentScreenProps {
  /** Pre-filled save location (last used, else ~/Documents/ZeroSeams). */
  defaultFolder: string
  recentFiles: RecentFile[]
  /** True while the Create write is in flight. */
  creating?: boolean
  /** Shown inline; never use alert() (CLAUDE.md). */
  error?: string | null
  onCreate: (spec: NewDocumentSpec) => void
  /** Resolves to the chosen directory, or null if the user cancelled. */
  onChooseFolder: () => Promise<string | null>
  onOpen: () => void
  onOpenPath: (path: string) => void
  /** Only supplied when there is a document to go back to — on a cold start
   *  there is nothing behind this screen, so no Cancel is offered. */
  onCancel?: () => void
}

const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  threads: 'Threads',
  custom: 'Custom',
}

const PLATFORMS: Platform[] = ['instagram', 'tiktok', 'facebook', 'threads', 'custom']

const sectionLabel: React.CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: 11,
  fontWeight: 'bold',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  marginBottom: 8,
}

const textFieldStyle: React.CSSProperties = {
  height: 30,
  background: 'var(--bg-surface)',
  border: '1px solid var(--stroke)',
  borderRadius: 6,
  color: 'var(--text-primary)',
  fontSize: 12,
  fontFamily: 'var(--font)',
  padding: '0 8px',
  boxSizing: 'border-box',
}

/** Trailing text of a path, so a long folder still reads as its destination. */
function shortenPath(p: string, max = 42): string {
  if (p.length <= max) return p
  return '…' + p.slice(p.length - max + 1)
}

/** Reject the characters that make a filename unusable on any of the three
 *  platforms, rather than letting the write fail with a raw errno. */
function filenameError(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return 'Enter a file name.'
  if (/[\\/:*?"<>|]/.test(trimmed)) return 'A file name can’t contain \\ / : * ? " < > |'
  if (trimmed.startsWith('.')) return 'A file name can’t start with a dot.'
  return null
}

export function NewDocumentScreen({
  defaultFolder,
  recentFiles,
  creating = false,
  error = null,
  onCreate,
  onChooseFolder,
  onOpen,
  onOpenPath,
  onCancel,
}: NewDocumentScreenProps): React.ReactElement {
  const [platform, setPlatform] = useState<Platform>('instagram')
  const [ratio, setRatio] = useState<FrameRatio>('square')
  const [width, setWidth] = useState(1080)
  const [height, setHeight] = useState(1080)
  const [frameCount, setFrameCount] = useState(2)
  const [filename, setFilename] = useState('Untitled')
  const [folderPath, setFolderPath] = useState(defaultFolder)

  // defaultFolder arrives asynchronously (an IPC round-trip); adopt it as long
  // as the user hasn't already picked something else.
  const [folderTouched, setFolderTouched] = useState(false)
  React.useEffect(() => {
    if (!folderTouched) setFolderPath(defaultFolder)
  }, [defaultFolder, folderTouched])

  const presets = PLATFORM_PRESETS[platform]
  const nameError = filenameError(filename)
  const canCreate = !creating && nameError === null && folderPath.trim() !== ''

  function choosePlatform(p: Platform): void {
    setPlatform(p)
    const first = PLATFORM_PRESETS[p][0]
    setRatio(first.ratio)
    setWidth(first.width)
    setHeight(first.height)
  }

  function choosePreset(preset: { ratio: FrameRatio; width: number; height: number }): void {
    setRatio(preset.ratio)
    setWidth(preset.width)
    setHeight(preset.height)
  }

  async function pickFolder(): Promise<void> {
    const chosen = await onChooseFolder()
    if (chosen) {
      setFolderTouched(true)
      setFolderPath(chosen)
    }
  }

  function submit(): void {
    if (!canCreate) return
    onCreate({ platform, ratio, width, height, frameCount, folderPath, filename: filename.trim() })
  }

  const sortedRecents = useMemo(
    () => [...recentFiles].slice(0, 6),
    [recentFiles],
  )

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        background: 'var(--bg-base)',
        fontFamily: 'var(--font)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        boxSizing: 'border-box',
        overflow: 'auto',
      }}
    >
      <div
        style={{
          width: 'min(880px, 100%)',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          boxShadow: '0 18px 48px rgba(0,0,0,0.14)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>New document</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
            Nothing is written to disk until you press Create.
          </div>
        </div>

        <div style={{ display: 'flex', minHeight: 300 }}>
          {/* Platform list */}
          <div style={{ width: 180, borderRight: '1px solid var(--border)', padding: '16px 12px', flexShrink: 0 }}>
            <div style={sectionLabel}>Platform</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {PLATFORMS.map((p) => {
                const active = p === platform
                return (
                  <button
                    key={p}
                    onClick={() => { choosePlatform(p) }}
                    style={{
                      textAlign: 'left',
                      padding: '7px 10px',
                      borderRadius: 8,
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'var(--font)',
                      fontSize: 13,
                      background: active ? 'var(--accent-tint)' : 'transparent',
                      color: active ? 'var(--accent)' : 'var(--text-secondary)',
                      fontWeight: active ? 700 : 400,
                    }}
                  >
                    {PLATFORM_LABELS[p]}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Presets + dimensions */}
          <div style={{ flex: 1, padding: '16px 20px', minWidth: 0 }}>
            <div style={sectionLabel}>Size</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {presets.map((preset) => {
                const active = ratio === preset.ratio && width === preset.width && height === preset.height
                return (
                  <button
                    key={preset.ratio + preset.label}
                    onClick={() => { choosePreset(preset) }}
                    style={{
                      width: 104,
                      padding: '12px 8px',
                      background: active ? 'var(--accent-tint)' : 'var(--bg-surface)',
                      border: `1px solid ${active ? 'var(--accent)' : 'var(--stroke)'}`,
                      borderRadius: 12,
                      cursor: 'pointer',
                      fontFamily: 'var(--font)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        display: 'block',
                        width: Math.round(34 * Math.min(1, preset.width / preset.height)),
                        height: Math.round(34 * Math.min(1, preset.height / preset.width)),
                        background: active ? 'var(--accent)' : 'var(--stroke)',
                        borderRadius: 3,
                      }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{preset.label}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                      {preset.width} × {preset.height}
                    </span>
                  </button>
                )
              })}
            </div>

            {platform === 'custom' && (
              <div style={{ marginTop: 16 }}>
                <div style={sectionLabel}>Dimensions</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <NumericInput value={width} min={100} max={8000} width={72} align="center" onCommit={setWidth} />
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>×</span>
                  <NumericInput value={height} min={100} max={8000} width={72} align="center" onCommit={setHeight} />
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>px</span>
                </div>
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <div style={sectionLabel}>Frames</div>
              <NumericInput value={frameCount} min={1} max={20} width={72} align="center" onCommit={setFrameCount} />
            </div>
          </div>

          {/* Recents */}
          {sortedRecents.length > 0 && (
            <div style={{ width: 220, borderLeft: '1px solid var(--border)', padding: '16px 12px', flexShrink: 0 }}>
              <div style={{ ...sectionLabel, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={12} /> Recent
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {sortedRecents.map((f) => (
                  <Tooltip key={f.path} label={f.path}>
                    <button
                      onClick={() => { onOpenPath(f.path) }}
                      style={{
                        textAlign: 'left',
                        padding: '6px 8px',
                        borderRadius: 8,
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        fontFamily: 'var(--font)',
                        fontSize: 12,
                        color: 'var(--text-secondary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {f.name.replace(/\.zeroseams$/, '')}
                    </button>
                  </Tooltip>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Destination + actions */}
        <div style={{ borderTop: '1px solid var(--border)', padding: '16px 24px 20px', background: 'var(--bg-panel)' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 220px', minWidth: 200 }}>
              <div style={sectionLabel}>File name</div>
              <input
                value={filename}
                onChange={(e) => { setFilename(e.target.value) }}
                onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
                aria-label="File name"
                aria-invalid={nameError !== null}
                spellCheck={false}
                style={{ ...textFieldStyle, width: '100%' }}
              />
            </div>
            <div style={{ flex: '2 1 300px', minWidth: 240 }}>
              <div style={sectionLabel}>Location</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <div
                  title={folderPath}
                  style={{
                    ...textFieldStyle,
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    alignItems: 'center',
                    color: 'var(--text-tertiary)',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {shortenPath(folderPath)}
                </div>
                <Tooltip label="Choose folder">
                  <button
                    onClick={() => { void pickFolder() }}
                    style={{
                      height: 30,
                      padding: '0 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--stroke)',
                      borderRadius: 999,
                      cursor: 'pointer',
                      fontFamily: 'var(--font)',
                      fontSize: 12,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <FolderOpen size={13} /> Browse…
                  </button>
                </Tooltip>
              </div>
            </div>
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>
            Saves as <strong style={{ color: 'var(--text-secondary)' }}>{(filename.trim() || 'Untitled')}.zeroseams</strong>
          </div>

          {(nameError !== null || error !== null) && (
            <div
              role="alert"
              style={{
                marginTop: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                background: 'var(--danger-bg)',
                border: '1px solid var(--danger-border)',
                borderRadius: 8,
                color: 'var(--danger)',
                fontSize: 12,
              }}
            >
              <AlertTriangle size={14} /> {error ?? nameError}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 16, alignItems: 'center' }}>
            <Tooltip label="Create document" shortcut="⏎">
              <button
                onClick={submit}
                disabled={!canCreate}
                style={{
                  height: 34,
                  padding: '0 22px',
                  background: canCreate ? 'var(--accent)' : 'var(--stroke)',
                  color: canCreate ? 'var(--bg-surface)' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: 999,
                  cursor: canCreate ? 'pointer' : 'default',
                  fontFamily: 'var(--font)',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
            </Tooltip>
            <Tooltip label="Open an existing project" shortcut="⌘O">
              <button
                onClick={onOpen}
                style={{
                  height: 34,
                  padding: '0 18px',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--stroke)',
                  borderRadius: 999,
                  cursor: 'pointer',
                  fontFamily: 'var(--font)',
                  fontSize: 13,
                }}
              >
                Open…
              </button>
            </Tooltip>
            {onCancel && (
              <Tooltip label="Keep working on the current document" shortcut="Esc">
                <button
                  onClick={onCancel}
                  style={{
                    height: 34,
                    padding: '0 18px',
                    background: 'transparent',
                    color: 'var(--text-tertiary)',
                    border: 'none',
                    borderRadius: 999,
                    cursor: 'pointer',
                    fontFamily: 'var(--font)',
                    fontSize: 13,
                  }}
                >
                  Cancel
                </button>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
