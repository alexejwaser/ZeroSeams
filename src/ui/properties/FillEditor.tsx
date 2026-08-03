import React, { useRef, useState } from 'react'
import type { Fill, GradientStop } from '@/types/canvas'
import { normalizeFill, denormalizeFill, fillPreviewCss, DEFAULT_GRADIENT_STOPS } from '@/canvas/fill'
import Tooltip from '../Tooltip'
import { ColorInput } from '../ColorInput'
import { NumericInput } from '../NumericInput'
import { iconBtnProps } from '../iconBtnStyle'
import { Field, useScrubbedValue } from './shared'

// ---------------------------------------------------------------------------
// FillEditor — the one authoring surface for the Fill union. Used by the Frame
// section (media frames), and by the shape and path sections of the Properties
// panel. Strokes are deliberately NOT routed through it: a stroke has no
// interior to grade across, so it stays a plain ColorInput.
//
// Every write goes through the standard drag-history contract the panel already
// uses: pointerdown → onStartDrag (snapshot), live → onChange, release →
// onCommit. A single-shot edit (picking a type, deleting a stop) calls onCommit
// directly, which is one history entry.
// ---------------------------------------------------------------------------

type FillKind = 'none' | 'solid' | 'linear' | 'radial'

export interface FillEditorProps {
  /** Bare colour string (shape/path) or a Fill (frame) or absent. */
  value: string | Fill | undefined
  /** Live, no history push. */
  onChange: (next: string | Fill | undefined) => void
  /** Terminal, one history entry. */
  onCommit: (next: string | Fill | undefined) => void
  /** Snapshot pre-drag state. Omit for callers with no drag-capable control. */
  onStartDrag?: () => void
  /** When true a "None" segment is offered — frames can have no fill; a shape
   *  always paints something, so its editor hides the segment. */
  allowNone?: boolean
}

const KINDS: Array<{ kind: FillKind; label: string; description: string }> = [
  { kind: 'none', label: 'None', description: 'No fill is painted' },
  { kind: 'solid', label: 'Solid', description: 'A single flat colour' },
  { kind: 'linear', label: 'Linear', description: 'Colours graded along a straight axis' },
  { kind: 'radial', label: 'Radial', description: 'Colours graded outward from a point' },
]

const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8,
}
const labelStyle: React.CSSProperties = {
  color: 'var(--text-secondary)', fontSize: 12, width: 64, flexShrink: 0,
}

const STRIP_HEIGHT = 22
const HANDLE_SIZE = 12

/** Rounded to 4 decimals: a 0-1 offset dragged over ~200px never needs more,
 *  and it keeps project JSON from filling with float noise. */
function tidyOffset(v: number): number {
  return Math.round(Math.min(1, Math.max(0, v)) * 1e4) / 1e4
}

function kindOf(f: Fill | undefined): FillKind {
  if (!f) return 'none'
  return f.type === 'solid' ? 'solid' : f.type
}

/** Stops for a new gradient — carries a solid colour across so switching type
 *  keeps the colour the user already picked instead of resetting to grey. */
function seedStops(from: Fill | undefined): GradientStop[] {
  if (from && from.type !== 'solid') return from.stops
  const color = from?.type === 'solid' ? from.color : DEFAULT_GRADIENT_STOPS[0].color
  return [{ offset: 0, color }, { offset: 1, color: DEFAULT_GRADIENT_STOPS[1].color }]
}

export function FillEditor({
  value,
  onChange,
  onCommit,
  onStartDrag,
  allowNone = true,
}: FillEditorProps): React.ReactElement {
  const fill = normalizeFill(value)
  const kind = kindOf(fill)
  const stops = fill && fill.type !== 'solid' ? fill.stops : []
  const [activeStop, setActiveStop] = useState(0)
  const stripRef = useRef<HTMLDivElement>(null)
  // Which stop the pointer is currently dragging; null when idle.
  const draggingRef = useRef<number | null>(null)

  // These three sit in shared rows rather than their own <Field>, so they wire the
  // scrub/commit contract by hand. `withStops`/`emit` below are hoisted function
  // declarations, hence usable from here.
  const stopOffsetScrub = useScrubbedValue({
    onStartDrag,
    onLiveChange: (v) => withStops(
      stops.map((s, i) => (i === activeStop ? { ...s, offset: tidyOffset(v / 100) } : s)), false),
    onCommit: (v) => withStops(
      stops.map((s, i) => (i === activeStop ? { ...s, offset: tidyOffset(v / 100) } : s)), true),
  })
  const cxScrub = useScrubbedValue({
    onStartDrag,
    onLiveChange: (v) => { if (fill && fill.type === 'radial') emit({ ...fill, cx: v / 100 }, false) },
    onCommit: (v) => { if (fill && fill.type === 'radial') emit({ ...fill, cx: v / 100 }, true) },
  })
  const cyScrub = useScrubbedValue({
    onStartDrag,
    onLiveChange: (v) => { if (fill && fill.type === 'radial') emit({ ...fill, cy: v / 100 }, false) },
    onCommit: (v) => { if (fill && fill.type === 'radial') emit({ ...fill, cy: v / 100 }, true) },
  })

  // Solids are written back as bare strings so a shape's fill stays the plain
  // colour string it has always been — see denormalizeFill.
  function emit(next: Fill | undefined, commit: boolean): void {
    const out = denormalizeFill(next)
    if (commit) onCommit(out)
    else onChange(out)
  }

  function setKind(next: FillKind): void {
    if (next === kind) return
    if (next === 'none') { onCommit(undefined); return }
    if (next === 'solid') {
      const color = fill && fill.type !== 'solid'
        ? (fill.stops[0]?.color ?? '#000000')
        : (fill?.type === 'solid' ? fill.color : '#000000')
      emit({ type: 'solid', color }, true)
      return
    }
    const seeded = seedStops(fill)
    setActiveStop(0)
    emit(next === 'linear'
      ? { type: 'linear', angle: 0, stops: seeded }
      : { type: 'radial', cx: 0.5, cy: 0.5, r: 0.5, stops: seeded },
      true)
  }

  /** Replace the stop list, keeping the rest of the gradient untouched. */
  function withStops(next: GradientStop[], commit: boolean): void {
    if (!fill || fill.type === 'solid') return
    emit({ ...fill, stops: next }, commit)
  }

  function offsetFromClientX(clientX: number): number {
    const el = stripRef.current
    if (!el) return 0
    const r = el.getBoundingClientRect()
    return tidyOffset(r.width > 0 ? (clientX - r.left) / r.width : 0)
  }

  function handleStripPointerDown(e: React.PointerEvent<HTMLDivElement>): void {
    // Clicking bare strip adds a stop there, coloured by what the gradient
    // already paints at that position (nearest stop) so nothing jumps.
    if (!fill || fill.type === 'solid') return
    const offset = offsetFromClientX(e.clientX)
    const nearest = fill.stops.reduce((best, s) =>
      Math.abs(s.offset - offset) < Math.abs(best.offset - offset) ? s : best, fill.stops[0])
    const next = [...fill.stops, { offset, color: nearest?.color ?? '#000000' }]
      .sort((a, b) => a.offset - b.offset)
    setActiveStop(next.findIndex((s) => s.offset === offset && s.color === nearest?.color))
    withStops(next, true)
  }

  function handleHandlePointerDown(e: React.PointerEvent<HTMLDivElement>, index: number): void {
    e.stopPropagation()
    setActiveStop(index)
    draggingRef.current = index
    onStartDrag?.()
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handleHandlePointerMove(e: React.PointerEvent<HTMLDivElement>): void {
    const index = draggingRef.current
    if (index == null || !fill || fill.type === 'solid') return
    const next = fill.stops.map((s, i) =>
      i === index ? { ...s, offset: offsetFromClientX(e.clientX) } : s)
    withStops(next, false)
  }

  function handleHandlePointerUp(e: React.PointerEvent<HTMLDivElement>): void {
    const index = draggingRef.current
    if (index == null || !fill || fill.type === 'solid') return
    draggingRef.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
    const next = fill.stops.map((s, i) =>
      i === index ? { ...s, offset: offsetFromClientX(e.clientX) } : s)
    withStops(next, true)
  }

  function removeStop(index: number): void {
    // Two stops is the floor — one stop is a solid with extra machinery.
    if (!fill || fill.type === 'solid' || fill.stops.length <= 2) return
    setActiveStop(0)
    withStops(fill.stops.filter((_, i) => i !== index), true)
  }

  const isGradient = fill != null && fill.type !== 'solid'
  const shownKinds = allowNone ? KINDS : KINDS.filter((k) => k.kind !== 'none')
  const active = stops[activeStop] ?? stops[0]

  return (
    <div>
      {/* Type segment */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {shownKinds.map(({ kind: k, label, description }) => (
          <Tooltip key={k} label={label} description={description}>
            <button
              onClick={() => setKind(k)}
              {...iconBtnProps(k === kind, false, {
                flex: 1, width: 'auto', height: 26, fontSize: 11,
              })}
            >
              {label}
            </button>
          </Tooltip>
        ))}
      </div>

      {kind === 'solid' && (
        <div style={rowStyle}>
          <ColorInput
            value={fill?.type === 'solid' ? fill.color : '#000000'}
            onChange={(color) => emit({ type: 'solid', color }, true)}
            fixed
          />
          <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>
            {fill?.type === 'solid' ? fill.color : ''}
          </span>
        </div>
      )}

      {isGradient && (
        <>
          {/* Stop strip: live preview + draggable handles */}
          <div
            ref={stripRef}
            onPointerDown={handleStripPointerDown}
            style={{
              position: 'relative',
              height: STRIP_HEIGHT,
              // The strip previews the ramp itself, so it always shows a
              // left→right sweep regardless of the gradient's real angle.
              background: fillPreviewCss({ type: 'linear', angle: 0, stops }),
              border: '1px solid var(--stroke)',
              borderRadius: 6,
              cursor: 'copy',
              marginBottom: HANDLE_SIZE,
            }}
          >
            {stops.map((s, i) => (
              <div
                key={i}
                role="slider"
                tabIndex={0}
                aria-label={`Gradient stop ${i + 1}`}
                aria-valuemin={0}
                aria-valuemax={1}
                aria-valuenow={s.offset}
                onPointerDown={(e) => handleHandlePointerDown(e, i)}
                onPointerMove={handleHandlePointerMove}
                onPointerUp={handleHandlePointerUp}
                onKeyDown={(e) => {
                  const step = e.shiftKey ? 0.1 : 0.01
                  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                    e.preventDefault()
                    const delta = e.key === 'ArrowLeft' ? -step : step
                    withStops(stops.map((st, j) =>
                      j === i ? { ...st, offset: tidyOffset(st.offset + delta) } : st), true)
                  } else if (e.key === 'Backspace' || e.key === 'Delete') {
                    e.preventDefault()
                    removeStop(i)
                  }
                }}
                style={{
                  position: 'absolute',
                  left: `${s.offset * 100}%`,
                  top: STRIP_HEIGHT - 2,
                  width: HANDLE_SIZE,
                  height: HANDLE_SIZE,
                  marginLeft: -HANDLE_SIZE / 2,
                  borderRadius: 999,
                  background: s.color,
                  border: `2px solid ${i === activeStop ? 'var(--accent)' : 'var(--bg-surface)'}`,
                  boxShadow: '0 0 0 1px var(--stroke)',
                  cursor: 'ew-resize',
                  boxSizing: 'border-box',
                }}
              />
            ))}
          </div>

          {/* Selected stop: colour, offset, delete */}
          <div style={rowStyle}>
            <label style={labelStyle}>Stop</label>
            <ColorInput
              value={active?.color ?? '#000000'}
              onChange={(color) => withStops(
                stops.map((s, i) => (i === activeStop ? { ...s, color } : s)), true)}
              fixed
            />
            <NumericInput
              value={active ? Math.round(active.offset * 100) : 0}
              label="Stop position"
              unit="%"
              min={0}
              max={100}
              width={68}
              {...stopOffsetScrub}
            />
            <Tooltip
              label="Delete stop"
              description={stops.length <= 2 ? 'A gradient needs at least two stops' : undefined}
            >
              <button
                onClick={() => removeStop(activeStop)}
                disabled={stops.length <= 2}
                {...iconBtnProps(false, stops.length <= 2, { width: 24, height: 24, fontSize: 11 })}
              >
                ✕
              </button>
            </Tooltip>
          </div>

          {fill.type === 'linear' && (
            <Field
              label="Angle"
              unit="°"
              value={fill.angle}
              min={0}
              max={360}
              onStartDrag={onStartDrag}
              onLiveChange={(v) => emit({ ...fill, angle: v }, false)}
              onChange={(v) => emit({ ...fill, angle: v }, true)}
              onReset={() => emit({ ...fill, angle: 0 }, true)}
            />
          )}

          {fill.type === 'radial' && (
            <>
              {/* Normalized 0–1, shown as a percentage — the stored value never
                  becomes display px, which is what lets it survive a resize. */}
              <div style={rowStyle}>
                <label style={labelStyle}>Centre</label>
                <NumericInput
                  value={Math.round(fill.cx * 100)}
                  label="Centre X" unit="%"
                  min={-100} max={200} width={68}
                  {...cxScrub}
                />
                <NumericInput
                  value={Math.round(fill.cy * 100)}
                  label="Centre Y" unit="%"
                  min={-100} max={200} width={68}
                  {...cyScrub}
                />
              </div>
              <Field
                label="Radius"
                unit="%"
                value={Math.round(fill.r * 100)}
                min={1}
                max={200}
                onStartDrag={onStartDrag}
                onLiveChange={(v) => emit({ ...fill, r: v / 100 }, false)}
                onChange={(v) => emit({ ...fill, r: v / 100 }, true)}
              />
            </>
          )}
        </>
      )}
    </div>
  )
}
