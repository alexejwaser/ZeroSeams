import React from 'react'
import { useCanvasStore } from '@/canvas/useCanvasStore'
import { useViewportStore, scaleForZoom } from '@/canvas/useViewportStore'
import { getStageInstance } from '@/canvas/CarouselStage'
import Tooltip from './Tooltip'
import { LAYER_PANEL_WIDTH, PROPERTIES_PANEL_WIDTH, TOOL_BAR_HEIGHT, HUD_LANE } from './panelConstants'

const hudBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  fontSize: 13,
  lineHeight: 1,
  padding: '4px 6px',
  fontFamily: 'var(--font)',
  display: 'flex',
  alignItems: 'center',
}

/**
 * Bottom-right canvas HUD: zoom out / % (click resets) / zoom in,
 * fit-all-frames, and the shortcut-cheatsheet trigger. Zoom was previously
 * reachable only via hidden ⌘ shortcuts.
 */
export function CanvasHud(): React.ReactElement | null {
  const zoom = useViewportStore((s) => s.zoom)
  const zoomIn = useViewportStore((s) => s.zoomIn)
  const zoomOut = useViewportStore((s) => s.zoomOut)
  const resetViewport = useViewportStore((s) => s.resetViewport)
  const previewMode = useCanvasStore((s) => s.previewMode)
  const setShortcutOverlayOpen = useCanvasStore((s) => s.setShortcutOverlayOpen)

  if (previewMode) return null

  function fitAllFrames(): void {
    const container = getStageInstance()?.container()
    if (!container) return
    const { frameCount, frameWidth, frameHeight } = useCanvasStore.getState()
    const pad = 48
    // The stage container spans the whole canvas area, but the panels, toolbar and
    // this HUD float on top of it. Fitting to the raw container size centred the
    // strip underneath them; fit to the genuinely visible rectangle instead.
    const visibleLeft = LAYER_PANEL_WIDTH
    const visibleTop = TOOL_BAR_HEIGHT
    const visibleW = container.clientWidth - LAYER_PANEL_WIDTH - PROPERTIES_PANEL_WIDTH
    const visibleH = container.clientHeight - TOOL_BAR_HEIGHT - HUD_LANE
    const availW = visibleW - pad * 2
    const availH = visibleH - pad * 2
    if (availW <= 0 || availH <= 0) return
    const targetScale = Math.min(availW / (frameCount * frameWidth), availH / frameHeight)
    const newZoom = targetScale / scaleForZoom(1)
    const vp = useViewportStore.getState()
    vp.setZoom(newZoom)
    // Center the frame strip in the visible rectangle (setZoom clamps, so re-read).
    const applied = scaleForZoom(useViewportStore.getState().zoom)
    vp.setPan(
      visibleLeft + (visibleW - frameCount * frameWidth * applied) / 2,
      visibleTop + (visibleH - frameHeight * applied) / 2,
    )
  }

  return (
    <div
      style={{
        // `fixed`, not `absolute`: this renders at the App root (see main.tsx) so
        // it sits above the floating panels rather than inside the canvas area's
        // stacking context.
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        background: 'var(--bg-surface)',
        border: '1px solid var(--stroke)',
        borderRadius: 999,
        padding: '2px 6px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
      }}
    >
      <Tooltip label="Zoom out" shortcut="⌘ −">
        <button style={hudBtnStyle} onClick={zoomOut}>−</button>
      </Tooltip>
      <Tooltip label="Reset zoom & pan" shortcut="⌘ 0">
        <button
          style={{ ...hudBtnStyle, minWidth: 44, justifyContent: 'center', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}
          onClick={resetViewport}
        >
          {Math.round(zoom * 100)}%
        </button>
      </Tooltip>
      <Tooltip label="Zoom in" shortcut="⌘ +">
        <button style={hudBtnStyle} onClick={zoomIn}>+</button>
      </Tooltip>
      <span style={{ width: 1, alignSelf: 'stretch', margin: '4px 2px', background: 'var(--border)' }} />
      <Tooltip label="Fit all frames" description="Zoom so every frame is visible">
        <button style={hudBtnStyle} onClick={fitAllFrames}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3" />
            <path d="M16 3h3a2 2 0 0 1 2 2v3" />
            <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
            <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
          </svg>
        </button>
      </Tooltip>
      <Tooltip label="Keyboard shortcuts" shortcut="?">
        <button style={hudBtnStyle} onClick={() => { setShortcutOverlayOpen(true) }}>?</button>
      </Tooltip>
    </div>
  )
}
