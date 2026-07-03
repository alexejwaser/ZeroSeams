import React from 'react'
import type { TextObject, FontStyle } from '@/types/canvas'
import {
  getSelectionStyle,
  applyStyleToRange,
  applyStyleToAll,
} from '@/canvas/textSpans'
import { FontPicker } from '../FontPicker'
import Tooltip from '../Tooltip'
import { AlignLeft, AlignCenter, AlignRight } from 'lucide-react'
import { MixedColorInput } from '../ColorInput'
import { NumericInput } from '../NumericInput'

import { rotateAroundCenter } from '@/canvas/geometry'
import { NumberField, MixedNumberField, sectionLabelStyle } from './shared'


// ---------------------------------------------------------------------------
// TextSection — the main per-character formatting panel for text objects
// ---------------------------------------------------------------------------

interface TextSectionProps {
  textObj: TextObject
  selectedId: string
  textEditingId: string | null
  textSelection: { start: number; end: number } | null
  onStartDrag: () => void
  onUpdate: (id: string, patch: Partial<TextObject>) => void
  onCommit: (id: string, patch: Partial<TextObject>) => void
}

export function TextSection({
  textObj,
  selectedId,
  textEditingId,
  textSelection,
  onStartDrag,
  onUpdate,
  onCommit,
}: TextSectionProps): React.ReactElement {
  // Determine whether we are in span-selection mode:
  // editing this object AND a non-collapsed range is selected.
  const isInEditMode = textEditingId === selectedId
  const hasRangeSelection =
    isInEditMode &&
    textSelection !== null &&
    textSelection.start !== textSelection.end

  // Resolve the style to display. In span-selection mode: getSelectionStyle().
  // Otherwise: layer-level defaults.
  const selStyle = hasRangeSelection
    ? getSelectionStyle(textObj, textSelection!.start, textSelection!.end)
    : null

  // Helpers that return the effective value for span-selectable fields.
  // Returns `undefined` when mixed (only possible in span-selection mode).
  function effectiveFontFamily(): string | undefined {
    return hasRangeSelection ? selStyle!.fontFamily : textObj.fontFamily
  }

  function effectiveFontSize(): number | undefined {
    return hasRangeSelection ? selStyle!.fontSize : textObj.fontSize
  }

  function effectiveFontStyle(): FontStyle | undefined {
    return hasRangeSelection ? selStyle!.fontStyle : textObj.fontStyle
  }

  function effectiveFill(): string | undefined {
    return hasRangeSelection ? selStyle!.fill : textObj.fill
  }

  function effectiveLetterSpacing(): number | undefined {
    return hasRangeSelection ? selStyle!.letterSpacing : textObj.letterSpacing
  }

  // Apply a style change for a span-selectable field.
  function applySpanField(style: { fontFamily?: string; fontSize?: number; fontStyle?: FontStyle; fill?: string; letterSpacing?: number }): void {
    if (hasRangeSelection) {
      // Span-range mode: only update spans, do NOT touch layer defaults.
      const newSpans = applyStyleToRange(textObj, textSelection!.start, textSelection!.end, style)
      onCommit(selectedId, { spans: newSpans } as Partial<TextObject>)
    } else {
      // Whole-layer mode: update both layer default and all spans.
      const newSpans = applyStyleToAll(textObj, style)
      onCommit(selectedId, { ...style, spans: newSpans } as Partial<TextObject>)
    }
  }

  // Toggle bold/italic, accounting for mixed state when hasRangeSelection.
  function toggleFontStyleBit(bit: 'bold' | 'italic'): void {
    const current = effectiveFontStyle()
    // When mixed, treat as "not active" — so toggling adds the bit.
    const hasBold = current !== undefined && current.includes('bold')
    const hasItalic = current !== undefined && current.includes('italic')

    let next: FontStyle
    if (bit === 'bold') {
      next = hasBold
        ? (hasItalic ? 'italic' : 'normal')
        : (hasItalic ? 'bold italic' : 'bold')
    } else {
      next = hasItalic
        ? (hasBold ? 'bold' : 'normal')
        : (hasBold ? 'bold italic' : 'italic')
    }
    applySpanField({ fontStyle: next })
  }

  const currentFontFamily = effectiveFontFamily()
  const currentFontSize = effectiveFontSize()
  const currentFontStyle = effectiveFontStyle()
  const currentFill = effectiveFill()
  const currentLetterSpacing = effectiveLetterSpacing()

  // Bold/italic active state — false when mixed (undefined).
  const boldActive = currentFontStyle !== undefined && currentFontStyle.includes('bold')
  const italicActive = currentFontStyle !== undefined && currentFontStyle.includes('italic')

  return (
    <div style={{ padding: '12px 12px 0' }}>
      {/* Rotation slider + numeric input */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <label style={{ color: '#555555', fontSize: 12, width: 64, flexShrink: 0 }}>Rotation</label>
        <input
          type="range" min={-360} max={360} step={1}
          value={Math.round(textObj.rotation ?? 0)}
          onMouseDown={onStartDrag}
          onChange={e => {
            const newRot = Number(e.target.value)
            const { x, y, rotation } = rotateAroundCenter(
              textObj.x, textObj.y, textObj.width, textObj.height,
              textObj.rotation ?? 0, newRot,
            )
            onUpdate(selectedId, { rotation, x, y } as Partial<TextObject>)
          }}
          onMouseUp={e => {
            const newRot = Number((e.target as HTMLInputElement).value)
            const { x, y, rotation } = rotateAroundCenter(
              textObj.x, textObj.y, textObj.width, textObj.height,
              textObj.rotation ?? 0, newRot,
            )
            onCommit(selectedId, { rotation, x, y } as Partial<TextObject>)
          }}
          style={{ flex: 1 }}
        />
        <NumericInput
          value={Math.round(textObj.rotation ?? 0)}
          min={-360} max={360}
          width={48}
          onCommit={newRot => {
            const { x, y, rotation } = rotateAroundCenter(
              textObj.x, textObj.y, textObj.width, textObj.height,
              textObj.rotation ?? 0, newRot,
            )
            onCommit(selectedId, { rotation, x, y } as Partial<TextObject>)
          }}
        />
      </div>

      {/* Opacity slider + numeric input */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <label style={{ color: '#555555', fontSize: 12, width: 64, flexShrink: 0 }}>Opacity</label>
        <input
          type="range" min={0} max={100} step={1}
          value={Math.round((textObj.opacity ?? 1) * 100)}
          onMouseDown={onStartDrag}
          onChange={e => onUpdate(selectedId, { opacity: Number(e.target.value) / 100 } as Partial<TextObject>)}
          onMouseUp={e => onCommit(selectedId, { opacity: Number((e.target as HTMLInputElement).value) / 100 } as Partial<TextObject>)}
          style={{ flex: 1 }}
        />
        <NumericInput
          value={Math.round((textObj.opacity ?? 1) * 100)}
          min={0} max={100}
          width={44}
          onCommit={v => onCommit(selectedId, { opacity: v / 100 } as Partial<TextObject>)}
        />
      </div>

      {/* Inline edit mode banner / hint */}
      {isInEditMode ? (
        <div
          style={{
            background: 'rgba(249,70,8,0.08)',
            border: '1px solid #f94608',
            borderRadius: 8,
            padding: '5px 8px',
            marginTop: 10,
            marginBottom: 4,
            color: '#f94608',
            fontSize: 11,
          }}
        >
          {hasRangeSelection
            ? `Editing selection (chars ${textSelection!.start}–${textSelection!.end})`
            : 'Text edit mode — select characters to style them'}
        </div>
      ) : (
        <div
          style={{
            color: '#555555',
            fontSize: 12,
            marginTop: 10,
            marginBottom: 4,
            fontStyle: 'italic',
          }}
        >
          Double-click the text layer on the canvas to edit content.
        </div>
      )}

      {/* Font family */}
      <div style={{ ...sectionLabelStyle }}>Font</div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8 }}>
        <label style={{ color: '#555555', fontSize: 12, width: 64, flexShrink: 0 }}>Family</label>
        <FontPicker
          value={currentFontFamily}
          onChange={(family) => applySpanField({ fontFamily: family })}
        />
      </div>

      {/* Font size */}
      <MixedNumberField
        label="Size"
        value={currentFontSize}
        min={8}
        max={400}
        onChange={(val) => applySpanField({ fontSize: val })}
      />

      {/* Bold / Italic toggle */}
      <div style={{ ...sectionLabelStyle }}>Style</div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {(['bold', 'italic'] as const).map((bit) => {
          const active = bit === 'bold' ? boldActive : italicActive
          return (
            <Tooltip key={bit} label={bit === 'bold' ? 'Bold' : 'Italic'}>
              <button
                onClick={() => toggleFontStyleBit(bit)}
                style={{
                  padding: '3px 10px',
                  height: 28,
                  background: active ? '#f94608' : '#ffffff',
                  color: active ? '#ffffff' : '#555555',
                  border: active ? 'none' : '1px solid #d4ccc2',
                  borderRadius: 999,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: bit === 'bold' ? 'bold' : 'normal',
                  fontStyle: bit === 'italic' ? 'italic' : 'normal',
                }}
              >
                {bit === 'bold' ? 'B' : 'I'}
              </button>
            </Tooltip>
          )
        })}
      </div>

      {/* Alignment — always layer-level */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {(['left', 'center', 'right'] as const).map((a) => (
          <Tooltip key={a} label={a === 'left' ? 'Align left' : a === 'center' ? 'Align center' : 'Align right'}>
            <button
              onClick={() => onCommit(selectedId, { align: a } as Partial<TextObject>)}
              style={{
                padding: '3px 10px',
                height: 28,
                flex: 1,
                background: textObj.align === a ? '#f94608' : '#ffffff',
                color: textObj.align === a ? '#ffffff' : '#555555',
                border: textObj.align === a ? 'none' : '1px solid #d4ccc2',
                borderRadius: 999,
                cursor: 'pointer',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {a === 'left'
                ? <AlignLeft size={14} strokeWidth={1.5}/>
                : a === 'center'
                ? <AlignCenter size={14} strokeWidth={1.5}/>
                : <AlignRight size={14} strokeWidth={1.5}/>}
            </button>
          </Tooltip>
        ))}
      </div>

      {/* Fill color */}
      <div style={{ ...sectionLabelStyle }}>Color</div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8 }}>
        <label style={{ color: '#555555', fontSize: 12, width: 64, flexShrink: 0 }}>Fill</label>
        <div style={{ flex: 1 }}>
          <MixedColorInput
            value={currentFill}
            onChange={(color) => applySpanField({ fill: color })}
            fixed
          />
        </div>
      </div>

      {/* Spacing */}
      <div style={{ ...sectionLabelStyle }}>Spacing</div>
      <MixedNumberField
        label="Letter Sp."
        value={currentLetterSpacing}
        step={0.5}
        onChange={(val) => applySpanField({ letterSpacing: val })}
      />
      {/* Line height is always layer-level */}
      <NumberField
        label="Line H."
        value={textObj.lineHeight}
        step={0.1}
        min={0.5}
        max={4}
        onChange={(val) => onCommit(selectedId, { lineHeight: val } as Partial<TextObject>)}
      />
    </div>
  )
}


