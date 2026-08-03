import './ui/theme.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { CarouselStage } from '@/canvas'
import { TitleBar, ToolBar, LayerPanel, PropertiesPanel, ContextMenu } from '@/ui'
import { NewDocumentScreen, type NewDocumentSpec, type RecentFile } from '@/ui/NewDocumentScreen'
import { useExportStore, useSaveStatusStore } from '@/store'
import {
  cancelNewDocument, createNew, initFileBridges, openFromDialog, openPath, restoreLastFile,
} from '@/io/fileManager'
import { PreviewShell } from '@/ui/preview/PreviewShell'
import { ShortcutOverlay } from '@/ui/ShortcutOverlay'
import { CanvasHud } from '@/ui/CanvasHud'
import { AIProvider } from '@/ai'

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, fontFamily: 'system-ui', color: '#111' }}>
          <h2 style={{ marginTop: 0 }}>Something went wrong</h2>
          <pre style={{ fontSize: 12, color: '#666', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {this.state.error.message}
            {'\n'}
            {this.state.error.stack}
          </pre>
          <button
            onClick={() => { window.location.reload() }}
            style={{ marginTop: 16, padding: '8px 20px', cursor: 'pointer', borderRadius: 6, border: '1px solid #ccc' }}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

/**
 * Container for the New Document screen: owns every store/IPC touch so the
 * screen itself stays presentational.
 *
 * Startup order matters. A file handed over by the OS wins, then the session's
 * last file, and only if neither restores does the screen appear — restoring a
 * document must never flash a "pick a document" prompt at the user.
 */
function NewDocumentGate(): React.ReactElement | null {
  const documentReady = useSaveStatusStore((s) => s.documentReady)
  const hasOpenDocument = useSaveStatusStore((s) => s.currentFilePath !== null)
  const [defaultFolder, setDefaultFolder] = React.useState('')
  const [recentFiles, setRecentFiles] = React.useState<RecentFile[]>([])
  const [creating, setCreating] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [booting, setBooting] = React.useState(true)

  React.useEffect(() => {
    const teardown = initFileBridges()
    void (async () => {
      const pending = await window.electronAPI.takePendingOpenFile()
      const opened = pending.filePath
        ? (await openPath(pending.filePath)).success
        : false
      if (!opened) await restoreLastFile()
      setBooting(false)
    })()
    return teardown
  }, [])

  // Only fetched while the screen is actually up — no cost on the normal path.
  React.useEffect(() => {
    if (documentReady || booting) return
    void window.electronAPI.getDefaultProjectDir().then((r) => { setDefaultFolder(r.folderPath) })
    void window.electronAPI.listRecentProjects().then((r) => { setRecentFiles(r.files) })
    setError(null)
  }, [documentReady, booting])

  React.useEffect(() => {
    if (documentReady || booting) return
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') cancelNewDocument()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => { window.removeEventListener('keydown', onKeyDown) }
  }, [documentReady, booting])

  if (documentReady || booting) return null

  return (
    <NewDocumentScreen
      defaultFolder={defaultFolder}
      recentFiles={recentFiles}
      creating={creating}
      error={error}
      onCreate={(spec: NewDocumentSpec) => {
        setCreating(true)
        setError(null)
        void createNew(spec)
          .then((r) => { if (!r.success) setError(r.error ?? 'Could not create the document.') })
          .finally(() => { setCreating(false) })
      }}
      onChooseFolder={async () => {
        const r = await window.electronAPI.showFolderDialog({
          title: 'Choose where to save the document',
          defaultPath: defaultFolder || undefined,
        })
        return r.cancelled || !r.folderPath ? null : r.folderPath
      }}
      onOpen={() => {
        void openFromDialog().then((r) => { if (!r.success && r.error) setError(r.error) })
      }}
      onOpenPath={(path) => {
        void openPath(path).then((r) => { if (!r.success && r.error) setError(r.error) })
      }}
      onCancel={hasOpenDocument ? () => { cancelNewDocument() } : undefined}
    />
  )
}

function App(): React.ReactElement {
  const exporting = useExportStore((s) => s.exporting)
  const exportStatus = useExportStore((s) => s.exportStatus)
  const requestCancel = useExportStore((s) => s.requestCancel)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'var(--bg-base)',
        fontFamily: 'var(--font)',
        overflow: 'hidden',
      }}
    >
      {/* Title bar — full width */}
      <TitleBar />

      {/* Middle row: center column fills full width */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
        }}
      >
        {/* Center column: toolbar + canvas + floating panels */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Floating sidebars — position themselves absolutely */}
          <LayerPanel />
          <PropertiesPanel />

          {/* Tool bar — drawing tools only */}
          <ToolBar />

          {/* Canvas area */}
          <div
            style={{
              flex: 1,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'stretch',
              padding: 0,
              background: 'var(--bg-canvas)',
              boxSizing: 'border-box',
              position: 'relative',
              zIndex: 0,
            }}
          >
            <CarouselStage />

            {exporting && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0,0,0,0.6)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 16,
                  zIndex: 500,
                }}
              >
                <div style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 600 }}>
                  {exportStatus || 'Exporting…'}
                </div>
                <button
                  onClick={requestCancel}
                  style={{
                    padding: '6px 18px',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--stroke)',
                    borderRadius: 999,
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Root level, not inside the canvas area: that div is `position:relative;
          zIndex:0`, which opens a stacking context the HUD could never escape —
          it painted under the panels no matter how high its own z-index went. */}
      <CanvasHud />

      {/* Full-screen overlays at root level so they paint above panels/toolbar */}
      <NewDocumentGate />
      <PreviewShell />
      <ShortcutOverlay />
      {/* Portal-based context menu — renders to document.body */}
      <ContextMenu />
    </div>
  )
}

// Expose internals for Playwright tests (Electron is always a trusted desktop env).
// Not dev-gated: the E2E scripts run against a production `npm run build`, where
// import.meta.env.DEV is false — a dev gate would gate the tests out of existence.
// Each global lists its consumer so this surface stays auditable.
//   __canvasStore__     — every script in scripts/
//   __viewportStore__   — (reserved; no current consumer)
//   __saveStatusStore__ — test-save-path.mjs
import('./canvas/useCanvasStore').then(m => { (window as any).__canvasStore__ = m.useCanvasStore })
import('./canvas/useViewportStore').then(m => { (window as any).__viewportStore__ = m.useViewportStore })
import('./store/useSaveStatusStore').then(m => { (window as any).__saveStatusStore__ = m.useSaveStatusStore })
//   __getStage__ / __exportFrames__ / __exportMixedFrames__ / __videoRegistry__
//     — test-frame-render-export.mjs; the stage is what makes pixel assertions
//       possible (stage.toCanvas() → getImageData), and calling exportFrames
//       directly skips the folder-dialog IPC that lives in Toolbar.tsx.
import('./canvas/CarouselStage').then(m => { (window as any).__getStage__ = m.getStageInstance })
import('./canvas/exportFrames').then(m => {
  ;(window as any).__exportFrames__ = m.exportFrames
  ;(window as any).__exportMixedFrames__ = m.exportMixedFrames
})
import('./canvas/videoElementRegistry').then(m => { (window as any).__videoRegistry__ = m.videoElementRegistry })
//   __computeGridChildPatches__ — test-frame-render-export.mjs; the single source of
//     truth for grid cell geometry, shared by CanvasGroupNode and the gap slider.
import('./canvas/gridTemplates').then(m => { (window as any).__computeGridChildPatches__ = m.computeGridChildPatches })

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element not found')
ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AIProvider>
        <App />
      </AIProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
