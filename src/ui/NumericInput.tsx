import React from 'react'
import { clamp as clampVal } from '@/utils/color'

export interface NumericInputProps {
  value: number | undefined
  onCommit: (value: number) => void
  onChange?: (value: number) => void
  min?: number
  max?: number
  /** Arrow-key and scrub increment. Shift multiplies it by 10, Alt by 0.1. */
  step?: number
  width?: number
  align?: 'left' | 'center' | 'right'
  disabled?: boolean
  decimals?: number
  style?: React.CSSProperties
  onDoubleClick?: () => void
  /**
   * Unit affix rendered inside the field, left of the value (`°`, `%`, `px`…).
   * It doubles as the scrub grip — drag it horizontally to change the value.
   */
  unit?: string
  /** Same slot as `unit`, for a glyph instead of a word. Wins when both are set. */
  icon?: React.ReactNode
  /** Accessible name. The visible label normally sits outside the field. */
  label?: string
  /**
   * Fires once, on the first value change of a scrub — never on a bare click.
   * Wire it to the store's `startDrag` so the whole gesture is one undo step.
   */
  onScrubStart?: () => void
  /** Fires once when the scrub gesture ends, after the commit. */
  onScrubEnd?: () => void
  /** Pointer travel, in px, per `step`. */
  scrubPixelsPerStep?: number
}

/** Screen readers say "80 percent"; "80 %" comes out as "80" on most engines. */
const UNIT_WORDS: Record<string, string> = {
  '°': 'degrees',
  '%': 'percent',
  px: 'pixels',
  s: 'seconds',
  '×': 'times',
  EV: 'EV',
}

function parseExpr(input: string, current: number): number | null {
  const s = input.trim()
  if (!s) return null

  const direct = Number(s)
  if (!isNaN(direct)) return direct

  // Relative: +N or -N applied to current value
  const rel = s.match(/^([+\-])\s*(\d+(?:\.\d*)?)$/)
  if (rel) {
    const delta = parseFloat(rel[1] + rel[2])
    if (!isNaN(delta)) return current + delta
  }

  // Binary expression: A op B
  const bin = s.match(/^(-?\d+(?:\.\d*)?)\s*([+\-\*\/])\s*(\d+(?:\.\d*)?)$/)
  if (bin) {
    const a = parseFloat(bin[1])
    const op = bin[2]
    const b = parseFloat(bin[3])
    if (!isNaN(a) && !isNaN(b)) {
      if (op === '+') return a + b
      if (op === '-') return a - b
      if (op === '*') return a * b
      if (op === '/' && b !== 0) return a / b
    }
  }

  return null
}

function formatVal(value: number, decimals?: number): string {
  if (decimals !== undefined) return value.toFixed(decimals)
  return String(value)
}

/** Keeps 0.1 + 0.2 from surfacing as 0.30000000000000004 in a visible field. */
function tidy(value: number): number {
  return Math.round(value * 1e6) / 1e6
}

export function NumericInput({
  value,
  onCommit,
  onChange,
  min,
  max,
  step = 1,
  width,
  align = 'right',
  disabled = false,
  decimals,
  style,
  onDoubleClick,
  unit,
  icon,
  label,
  onScrubStart,
  onScrubEnd,
  scrubPixelsPerStep = 2,
}: NumericInputProps): React.ReactElement {
  const [draft, setDraft] = React.useState<string | null>(null)
  const isFocusedRef = React.useRef(false)
  const committedRef = React.useRef<number | undefined>(value)

  React.useEffect(() => {
    committedRef.current = value
    if (!isFocusedRef.current) setDraft(null)
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  // A held arrow key repeats ~30×/s, and onCommit pushes a history entry, so
  // committing per keypress would bury the previous value under a wall of undo
  // steps. Preview live, then commit once the burst settles.
  const stepCommitRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  // Held in a ref so the unmount cleanup runs the *current* pending commit
  // rather than the one captured on first render.
  const pendingStepRef = React.useRef<(() => void) | null>(null)

  function cancelStep(): void {
    if (stepCommitRef.current != null) clearTimeout(stepCommitRef.current)
    stepCommitRef.current = null
    pendingStepRef.current = null
  }

  /** Land a pending arrow-key burst NOW. Used before a scrub takes over so the
   *  two never interleave — the stepped value becomes its own history entry
   *  before the scrub snapshots, instead of firing mid-gesture. */
  function flushStep(): void {
    if (stepCommitRef.current != null) clearTimeout(stepCommitRef.current)
    stepCommitRef.current = null
    const run = pendingStepRef.current
    pendingStepRef.current = null
    run?.()
  }

  function stepLive(next: number): void {
    onChange?.(next)
    cancelStep()
    pendingStepRef.current = () => { onCommit(next) }
    stepCommitRef.current = setTimeout(() => {
      stepCommitRef.current = null
      const run = pendingStepRef.current
      pendingStepRef.current = null
      run?.()
    }, 350)
  }

  React.useEffect(() => {
    // Unmounting mid-burst must still land the value — dropping it would
    // silently revert everything the user just stepped through.
    return () => {
      if (stepCommitRef.current != null) clearTimeout(stepCommitRef.current)
      pendingStepRef.current?.()
      pendingStepRef.current = null
    }
  }, [])

  // ── Drag-to-scrub on the unit/icon affix ──────────────────────────────────
  // The whole gesture is ONE undo step: onScrubStart snapshots, every move goes
  // through onChange (no history), and the single onCommit lands on release.
  const [scrubValue, setScrubValue] = React.useState<number | null>(null)
  const scrubRef = React.useRef<{
    pointerId: number
    startX: number
    startValue: number
    last: number
    moved: boolean
  } | null>(null)

  function handleScrubDown(e: React.PointerEvent<HTMLSpanElement>): void {
    if (disabled) return
    flushStep()
    // Without this the affix steals focus from the input, whose blur handler
    // would commit the draft in the middle of the gesture.
    e.preventDefault()
    const start = committedRef.current ?? value ?? 0
    scrubRef.current = { pointerId: e.pointerId, startX: e.clientX, startValue: start, last: start, moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handleScrubMove(e: React.PointerEvent<HTMLSpanElement>): void {
    const st = scrubRef.current
    if (st === null) return
    // Same modifiers as the arrow keys, so keyboard and pointer agree.
    const effStep = step * (e.shiftKey ? 10 : e.altKey ? 0.1 : 1)
    const steps = Math.round((e.clientX - st.startX) / scrubPixelsPerStep)
    const next = clampVal(tidy(st.startValue + steps * effStep), min, max)
    if (next === st.last) return
    // Deferred to the first real change: a bare click on the affix then costs
    // nothing, instead of arming a drag snapshot and pushing an empty undo step.
    if (!st.moved) { st.moved = true; onScrubStart?.() }
    st.last = next
    setScrubValue(next)
    onChange?.(next)
  }

  function handleScrubUp(e: React.PointerEvent<HTMLSpanElement>): void {
    const st = scrubRef.current
    if (st === null) return
    scrubRef.current = null
    if (e.currentTarget.hasPointerCapture(st.pointerId)) {
      e.currentTarget.releasePointerCapture(st.pointerId)
    }
    setScrubValue(null)
    if (st.moved) {
      committedRef.current = st.last
      onCommit(st.last)
      onScrubEnd?.()
    }
  }

  // True once typing has emitted a live onChange that no commit has closed yet.
  // Escape has to put that preview back, otherwise "revert" leaves the store on
  // the abandoned value with only the visible text restored.
  const liveDirtyRef = React.useRef(false)
  const escapingRef = React.useRef(false)

  function commit(input: string): void {
    // The blur/Enter commit below supersedes any pending step, so drop it
    // instead of flushing and pushing two identical history entries.
    cancelStep()
    liveDirtyRef.current = false
    const current = committedRef.current ?? 0
    let result = parseExpr(input, current)
    if (result === null) {
      setDraft(null)
      return
    }
    result = clampVal(result, min, max)
    committedRef.current = result
    onCommit(result)
    setDraft(null)
  }

  const displayValue =
    scrubValue !== null
      ? formatVal(scrubValue, decimals)
      : draft !== null
      ? draft
      : value === undefined
      ? ''
      : formatVal(value, decimals)

  const affix = icon ?? (unit !== undefined && unit !== '' ? unit : null)
  const ariaNow = scrubValue ?? value
  const unitWord = unit !== undefined ? (UNIT_WORDS[unit] ?? unit) : undefined
  const valueText =
    ariaNow === undefined
      ? 'mixed'
      : unitWord !== undefined
      ? `${formatVal(ariaNow, decimals)} ${unitWord}`
      : formatVal(ariaNow, decimals)

  return (
    <div
      className="zs-num"
      {...(disabled ? { 'data-disabled': '' } : {})}
      onDoubleClick={onDoubleClick}
      style={{
        opacity: disabled ? 0.4 : 1,
        ...(width !== undefined ? { width } : {}),
        ...style,
      }}
    >
      {affix !== null && (
        <span
          className="zs-num-unit"
          aria-hidden="true"
          onPointerDown={handleScrubDown}
          onPointerMove={handleScrubMove}
          onPointerUp={handleScrubUp}
          onPointerCancel={handleScrubUp}
        >
          {affix}
        </span>
      )}
      <input
        className="zs-num-input"
        type="text"
        inputMode="decimal"
        role="spinbutton"
        aria-label={label}
        aria-valuenow={ariaNow}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuetext={valueText}
        value={displayValue}
        placeholder={value === undefined && draft === null ? '—' : undefined}
        disabled={disabled}
        style={{
          textAlign: align,
          color: value === undefined && draft === null && scrubValue === null
            ? 'var(--text-tertiary)'
            : 'var(--text-primary)',
        }}
        onFocus={e => {
          isFocusedRef.current = true
          e.target.select()
        }}
        onBlur={e => {
          isFocusedRef.current = false
          if (escapingRef.current) { escapingRef.current = false; return }
          commit(e.target.value)
        }}
        onChange={e => {
          const s = e.target.value
          setDraft(s)
          if (onChange) {
            const direct = Number(s)
            if (!isNaN(direct) && s.trim() !== '') {
              liveDirtyRef.current = true
              onChange(clampVal(direct, min, max))
            }
          }
        }}
        onKeyDown={e => {
          // Arrow stepping is table stakes for a design tool's numeric fields, and
          // it works off the draft so repeated presses accumulate without a commit
          // round-trip. Shift/Alt mirror the scrub modifiers exactly.
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            const base = parseExpr(
              (e.target as HTMLInputElement).value,
              committedRef.current ?? 0,
            ) ?? committedRef.current ?? 0
            const mult = e.shiftKey ? 10 : e.altKey ? 0.1 : 1
            const delta = (e.key === 'ArrowUp' ? 1 : -1) * step * mult
            const next = clampVal(tidy(base + delta), min, max)
            committedRef.current = next
            setDraft(formatVal(next, decimals))
            stepLive(next)
            return
          }
          if (e.key === 'Enter') {
            e.preventDefault()
            commit((e.target as HTMLInputElement).value)
            ;(e.target as HTMLInputElement).blur()
          }
          if (e.key === 'Escape') {
            e.preventDefault()
            cancelStep()
            isFocusedRef.current = false
            // blur() below fires onBlur synchronously, before React has flushed
            // setDraft(null) — so the DOM still holds the abandoned text and the
            // blur handler would commit the very value Escape is discarding.
            escapingRef.current = true
            if (liveDirtyRef.current) {
              liveDirtyRef.current = false
              onChange?.(committedRef.current ?? 0)
            }
            setDraft(null)
            ;(e.target as HTMLInputElement).blur()
          }
        }}
      />
      {/* Pointer scrubbing moves the value without any keyboard event, so the
          spinbutton's own value change is never announced — this is. */}
      <span className="zs-visually-hidden" aria-live="polite">
        {scrubValue !== null ? valueText : ''}
      </span>
    </div>
  )
}
