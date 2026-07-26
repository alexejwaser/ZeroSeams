import React, { useEffect } from 'react'
import { useCanvasStore } from '@/canvas/useCanvasStore'
import { usePerfStore, togglePerfHud, setPerfVisibleCount } from '@/canvas/perfMonitor'

/**
 * Dev-only render-performance overlay (issue #59, Phase 0). Bottom-left so it
 * never collides with CanvasHud (bottom-right). Summoned with ⌥⇧P; renders
 * nothing when disabled. Numbers come from usePerfStore (Konva draw
 * instrumentation) plus the live object count from the canvas store.
 */
export function PerfHud(): React.ReactElement | null {
  const enabled = usePerfStore((s) => s.enabled)
  const fps = usePerfStore((s) => s.fps)
  const drawMs = usePerfStore((s) => s.drawMs)
  const peakMs = usePerfStore((s) => s.peakMs)
  const drawsPerSec = usePerfStore((s) => s.drawsPerSec)
  const visibleCount = usePerfStore((s) => s.visibleCount)
  const objectCount = useCanvasStore((s) => Object.keys(s.objects).length)

  // ⌥⇧P toggles the HUD. Listener is always registered so it can be summoned
  // even while disabled. Uses e.code (layout-independent) since Alt+Shift on
  // macOS produces a special character rather than "P".
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      const active = document.activeElement
      if (active instanceof HTMLInputElement) return
      if (active instanceof HTMLTextAreaElement) return
      if (active instanceof HTMLElement && active.isContentEditable) return
      if (e.altKey && e.shiftKey && e.code === 'KeyP') {
        e.preventDefault()
        togglePerfHud()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Until Phase 1a wires real viewport culling, "visible" == total objects.
  useEffect(() => {
    if (enabled) setPerfVisibleCount(objectCount)
  }, [enabled, objectCount])

  if (!enabled) return null

  return (
    <div
      style={{
        position: 'absolute',
        left: 16,
        bottom: 16,
        zIndex: 15,
        display: 'grid',
        gridTemplateColumns: 'auto auto',
        columnGap: 12,
        rowGap: 2,
        background: 'var(--bg-surface)',
        border: '1px solid var(--stroke)',
        borderRadius: 12,
        padding: '8px 12px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
        fontSize: 11,
        fontFamily: 'var(--font)',
        color: 'var(--text-secondary)',
        fontVariantNumeric: 'tabular-nums',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      <Row label="FPS" value={String(fps)} />
      <Row label="draw ms" value={drawMs.toFixed(2)} />
      <Row label="peak ms" value={peakMs.toFixed(2)} />
      <Row label="draws/s" value={String(drawsPerSec)} />
      <Row label="objects" value={`${visibleCount} / ${objectCount}`} />
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ textAlign: 'right', color: 'var(--text-primary)' }}>{value}</span>
    </>
  )
}
