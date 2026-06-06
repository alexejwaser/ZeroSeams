import './ui/theme.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { CarouselStage } from '@/canvas'
import { TitleBar, ToolBar, LayerPanel, PropertiesPanel, ContextMenu } from '@/ui'
import { useExportStore } from '@/ui/useExportStore'
import { PreviewShell } from '@/ui/preview/PreviewShell'
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

      {/* Full-screen overlays at root level so they paint above panels/toolbar */}
      <PreviewShell />
      {/* Portal-based context menu — renders to document.body */}
      <ContextMenu />
    </div>
  )
}

// Expose stores for Playwright tests (Electron is always a trusted desktop env)
import('./canvas/useCanvasStore').then(m => { (window as any).__canvasStore__ = m.useCanvasStore })
import('./canvas/useViewportStore').then(m => { (window as any).__viewportStore__ = m.useViewportStore })
import('./ui/useSaveStatusStore').then(m => { (window as any).__saveStatusStore__ = m.useSaveStatusStore })

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
