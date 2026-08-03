import React from 'react'
import { NumericInput } from '../NumericInput'


// ---------------------------------------------------------------------------
// useScrubbedValue — the history-safe wiring for a live-previewing numeric field.
//
// One history entry per edit, whether it arrived by scrub, arrow burst, or
// typing: the FIRST live write arms the pre-edit snapshot, and the commit
// consumes it. Without the arming, a live write followed by commitUpdate would
// make commitUpdate snapshot the very state it is about to commit — undo would
// land on the edited value and appear to do nothing.
//
// Use it directly for the handful of NumericInputs that don't sit in a <Field>
// row; everything else gets it through <Field>.
// ---------------------------------------------------------------------------

export interface ScrubbedValueOptions {
  /** Terminal write — one history entry. */
  onCommit: (val: number) => void
  /** Live preview — must NOT push history. */
  onLiveChange?: (val: number) => void
  /** Snapshot pre-edit state. Wire to the store's `startDrag`. */
  onStartDrag?: () => void
}

export function useScrubbedValue({ onCommit, onLiveChange, onStartDrag }: ScrubbedValueOptions): {
  onChange?: (val: number) => void
  onCommit: (val: number) => void
  onScrubStart: () => void
} {
  const armedRef = React.useRef(false)
  function arm(): void {
    if (armedRef.current) return
    armedRef.current = true
    onStartDrag?.()
  }
  return {
    onChange: onLiveChange ? (v: number) => { arm(); onLiveChange(v) } : undefined,
    onCommit: (v: number) => { armedRef.current = false; onCommit(v) },
    onScrubStart: arm,
  }
}


// ---------------------------------------------------------------------------
// Field — the one property row: label + scrubbable numeric field.
//
// This replaced ~13 hand-copied `label + <input type="range"> + NumericInput`
// blocks. The slider is gone: dragging the unit affix inside the field does the
// same job in a third of the width, and the copies had already drifted (some
// wired onStartDrag, some didn't; two showed a read-only <span> instead of an
// editable value).
//
// History contract — the drag pattern every slider in this app follows:
//   pointerdown → onStartDrag (snapshot pre-drag state)
//   move        → onLiveChange (updateObject, no history push)
//   release     → onChange     (commitUpdate, ONE history entry)
// Omitting onLiveChange is legal; the scrub then only lands on release.
// ---------------------------------------------------------------------------

export interface FieldProps {
  label: string
  /** `undefined` renders the mixed-value placeholder. */
  value: number | undefined
  /** Unit affix shown inside the field; also the scrub grip. */
  unit?: string
  /** Glyph alternative to `unit`, same slot. */
  icon?: React.ReactNode
  step?: number
  min?: number
  max?: number
  decimals?: number
  disabled?: boolean
  /** Terminal write — one history entry. */
  onChange: (val: number) => void
  /** Live preview during a scrub — must NOT push history. */
  onLiveChange?: (val: number) => void
  /** Snapshot pre-drag state. Wire to the store's `startDrag`. */
  onStartDrag?: () => void
  /** Double-click the label or the field to reset. */
  onReset?: () => void
  /** Label column width; 64 matches the rest of the panel. */
  labelWidth?: number
  marginBottom?: number
  /** Trailing controls sharing the row (e.g. a "Set In" button). */
  children?: React.ReactNode
}

export function Field({
  label,
  value,
  unit,
  icon,
  step,
  min,
  max,
  decimals,
  disabled,
  onChange,
  onLiveChange,
  onStartDrag,
  onReset,
  labelWidth = 64,
  marginBottom = 8,
  children,
}: FieldProps): React.ReactElement {
  const scrub = useScrubbedValue({ onCommit: onChange, onLiveChange, onStartDrag })

  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom, gap: 8 }}>
      <label
        style={{
          color: 'var(--text-secondary)',
          fontSize: 12,
          width: labelWidth,
          flexShrink: 0,
          cursor: onReset ? 'pointer' : undefined,
        }}
        onDoubleClick={onReset}
      >
        {label}
      </label>
      <NumericInput
        value={value}
        label={label}
        unit={unit}
        icon={icon}
        step={step}
        min={min}
        max={max}
        decimals={decimals}
        disabled={disabled}
        style={{ flex: 1 }}
        {...scrub}
        onDoubleClick={onReset}
      />
      {children}
    </div>
  )
}


// ---------------------------------------------------------------------------
// NumberField — normal (always has a value)
// ---------------------------------------------------------------------------

export interface MixedNumberFieldProps {
  label: string
  /** `undefined` renders the mixed-value placeholder. */
  value: number | undefined
  unit?: string
  step?: number
  min?: number
  max?: number
  decimals?: number
  onChange: (val: number) => void
  onLiveChange?: (val: number) => void
  onStartDrag?: () => void
  onReset?: () => void
}

export function MixedNumberField(props: MixedNumberFieldProps): React.ReactElement {
  return <Field {...props} />
}

/**
 * Same field, narrowed to callers that always have a value. Kept as a distinct
 * export purely for that type guarantee — the two were byte-identical
 * implementations before, and `step` was silently dropped by both.
 */
export interface NumberFieldProps extends MixedNumberFieldProps {
  value: number
}

export function NumberField(props: NumberFieldProps): React.ReactElement {
  return <Field {...props} />
}


// ---------------------------------------------------------------------------
// Shared style constants
// ---------------------------------------------------------------------------

export const sectionLabelStyle: React.CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: '1.5px',
  textTransform: 'uppercase',
  fontFamily: 'var(--font)',
  marginTop: 12,
  marginBottom: 6,
}

export const alignButtonStyle = (active?: boolean): React.CSSProperties => ({
  flex: 1,
  height: 28,
  background: active ? 'var(--accent)' : 'var(--bg-surface)',
  color: active ? 'var(--bg-surface)' : 'var(--text-secondary)',
  border: active ? 'none' : '1px solid var(--stroke)',
  borderRadius: 999,
  cursor: 'pointer',
  fontSize: 12,
  padding: '0 4px',
})

export const distributeButtonStyle = (disabled: boolean): React.CSSProperties => ({
  flex: 1,
  height: 28,
  background: 'var(--bg-surface)',
  color: disabled ? 'var(--text-muted)' : 'var(--text-secondary)',
  border: '1px solid var(--stroke)',
  borderRadius: 999,
  cursor: disabled ? 'default' : 'pointer',
  fontSize: 12,
  opacity: disabled ? 0.45 : 1,
})

