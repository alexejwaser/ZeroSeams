import React from 'react'
import { clamp as clampVal } from '@/utils/color'

export interface NumericInputProps {
  value: number | undefined
  onCommit: (value: number) => void
  onChange?: (value: number) => void
  min?: number
  max?: number
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

export function NumericInput({
  value,
  onCommit,
  onChange,
  min,
  max,
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

  function commit(input: string): void {
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
    color: value === undefined && draft === null ? 'var(--text-muted)' : 'var(--text-primary)',
    fontSize: 12,
    fontFamily: 'var(--font)',
    padding: '0 6px',
    textAlign: align,
    outline: 'none',
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
