import React from 'react'
import { NumericInput } from '../NumericInput'



// ---------------------------------------------------------------------------
// NumberField — normal (always has a value)
// ---------------------------------------------------------------------------

export interface NumberFieldProps {
  label: string
  value: number
  step?: number
  min?: number
  max?: number
  onChange: (val: number) => void
}

export function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: NumberFieldProps): React.ReactElement {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8 }}>
      <label style={{ color: '#555555', fontSize: 12, width: 64, flexShrink: 0 }}>
        {label}
      </label>
      <NumericInput
        value={value}
        min={min}
        max={max}
        align="left"
        style={{ flex: 1 }}
        onCommit={onChange}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// MixedNumberField — for per-span properties that may be mixed across selection
// ---------------------------------------------------------------------------

export interface MixedNumberFieldProps {
  label: string
  value: number | undefined   // undefined = mixed
  step?: number
  min?: number
  max?: number
  onChange: (val: number) => void
}

export function MixedNumberField({
  label,
  value,
  min,
  max,
  onChange,
}: MixedNumberFieldProps): React.ReactElement {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8 }}>
      <label style={{ color: '#555555', fontSize: 12, width: 64, flexShrink: 0 }}>
        {label}
      </label>
      <NumericInput
        value={value}
        min={min}
        max={max}
        align="left"
        style={{ flex: 1 }}
        onCommit={onChange}
      />
    </div>
  )
}


// ---------------------------------------------------------------------------
// Shared style constants
// ---------------------------------------------------------------------------

export const sectionLabelStyle: React.CSSProperties = {
  color: '#555555',
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
  background: active ? '#f94608' : '#ffffff',
  color: active ? '#ffffff' : '#555555',
  border: active ? 'none' : '1px solid #d4ccc2',
  borderRadius: 999,
  cursor: 'pointer',
  fontSize: 12,
  padding: '0 4px',
})

export const distributeButtonStyle = (disabled: boolean): React.CSSProperties => ({
  flex: 1,
  height: 28,
  background: '#ffffff',
  color: disabled ? '#aaaaaa' : '#555555',
  border: '1px solid #d4ccc2',
  borderRadius: 999,
  cursor: disabled ? 'default' : 'pointer',
  fontSize: 12,
  opacity: disabled ? 0.45 : 1,
})

