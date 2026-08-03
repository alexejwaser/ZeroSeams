import React from 'react'
import { NumericInput } from '../NumericInput'



// ---------------------------------------------------------------------------
// NumberField — normal (always has a value)
// ---------------------------------------------------------------------------

export interface MixedNumberFieldProps {
  label: string
  /** `undefined` renders the mixed-value placeholder. */
  value: number | undefined
  step?: number
  min?: number
  max?: number
  onChange: (val: number) => void
}

export function MixedNumberField({
  label,
  value,
  step,
  min,
  max,
  onChange,
}: MixedNumberFieldProps): React.ReactElement {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8 }}>
      <label style={{ color: 'var(--text-secondary)', fontSize: 12, width: 64, flexShrink: 0 }}>
        {label}
      </label>
      <NumericInput
        value={value}
        step={step}
        min={min}
        max={max}
        align="left"
        style={{ flex: 1 }}
        onCommit={onChange}
      />
    </div>
  )
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
  return <MixedNumberField {...props} />
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

