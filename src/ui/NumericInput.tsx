import React from 'react'
import { clamp as clampVal } from '@/utils/color'

export interface NumericInputProps {
  value: number | undefined
  onCommit: (value: number) => void
  onChange?: (value: number) => void
  min?: number
  max?: number
  /** Arrow-key increment. Shift multiplies it by 10. */
  step?: number
  width?: number
  align?: 'left' | 'center' | 'right'
  disabled?: boolean
  decimals?: number
  style?: React.CSSProperties
  onDoubleClick?: () => void
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
}: NumericInputProps): React.ReactElement {
  const [draft, setDraft] = React.useState<string | null>(null)
  const [isFocused, setIsFocused] = React.useState(false)
  const isFocusedRef = React.useRef(false)
  const committedRef = React.useRef<number | undefined>(value)

  React.useEffect(() => {
    committedRef.current = value
    if (!isFocusedRef.current) setDraft(null)
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  const displayValue =
    draft !== null
      ? draft
      : value === undefined
      ? ''
      : formatVal(value, decimals)

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

  function commit(input: string): void {
    // The blur/Enter commit below supersedes any pending step, so drop it
    // instead of flushing and pushing two identical history entries.
    cancelStep()
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

  const inputStyle: React.CSSProperties = {
    height: 26,
    background: 'var(--bg-surface)',
    border: `1px solid ${isFocused ? 'var(--accent)' : 'var(--stroke)'}`,
    borderRadius: 6,
    color: value === undefined && draft === null ? 'var(--text-tertiary)' : 'var(--text-primary)',
    fontSize: 12,
    fontFamily: 'var(--font)',
    padding: '0 6px',
    textAlign: align,
    boxSizing: 'border-box',
    opacity: disabled ? 0.4 : 1,
    ...(width !== undefined ? { width } : {}),
    ...style,
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={displayValue}
      placeholder={value === undefined && draft === null ? '—' : undefined}
      disabled={disabled}
      style={inputStyle}
      onFocus={e => {
        isFocusedRef.current = true
        setIsFocused(true)
        e.target.select()
      }}
      onBlur={e => {
        isFocusedRef.current = false
        setIsFocused(false)
        commit(e.target.value)
      }}
      onChange={e => {
        const s = e.target.value
        setDraft(s)
        if (onChange) {
          const direct = Number(s)
          if (!isNaN(direct) && s.trim() !== '') {
            onChange(clampVal(direct, min, max))
          }
        }
      }}
      onKeyDown={e => {
        // Arrow stepping is table stakes for a design tool's numeric fields, and
        // it works off the draft so repeated presses accumulate without a commit
        // round-trip. Shift gives the coarse step every editor uses.
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault()
          const base = parseExpr(
            (e.target as HTMLInputElement).value,
            committedRef.current ?? 0,
          ) ?? committedRef.current ?? 0
          const delta = (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1)
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
          isFocusedRef.current = false
          setIsFocused(false)
          setDraft(null)
          ;(e.target as HTMLInputElement).blur()
        }
      }}
      onDoubleClick={onDoubleClick}
    />
  )
}
