import React, { useEffect, useState, useRef } from 'react'
import { useCanvasStore } from '@/canvas/useCanvasStore'
import { useThumbnailStore } from '@/canvas/useThumbnailStore'
import { useAI } from '@/ai'
import { useAIStore } from '@/ai'
import { useExternalEdit } from '@/canvas/useExternalEdit'
import { useSaveStatusStore } from './useSaveStatusStore'
import type { BackgroundRemovalOperation } from '@/types/ai'
import type { ImageObject, TextObject, ShapeObject, PathObject, VideoObject, GroupObject, FontStyle, MaskData, PhotoAdjustments, LayerEffect, CanvasObject } from '@/types/canvas'
import { DEFAULT_ADJUSTMENTS } from '@/types/canvas'
import { getAllEffectDefinitions, getEffectDefinition } from '@/canvas/effects'
import { GRID_TEMPLATES } from '../canvas/gridTemplates'
import {
  getSelectionStyle,
  applyStyleToRange,
  applyStyleToAll,
} from '@/canvas/textSpans'
import { FontPicker } from './FontPicker'
import Tooltip from './Tooltip'
import { iconBtnStyle } from './iconBtnStyle'
import { PenTool, Square, Circle, Trash2, Pencil, Eye, EyeOff, AlignLeft, AlignCenter, AlignRight, Power, Plus, X, ChevronDown, ChevronRight, Volume2, VolumeX, Play, Pause, Repeat } from 'lucide-react'
import './adjustments.css'
import { videoElementRegistry } from '@/canvas/videoElementRegistry'
import { ColorInput, MixedColorInput } from './ColorInput'

// ---------------------------------------------------------------------------
// rotateAroundCenter — pure utility
// Konva positions rects/text at top-left (x, y) and rotates around that point.
// To rotate around the visual center, compute where the center is in canvas
// space given the current rotation, then find the new top-left that keeps the
// center at that same canvas-space point with the new rotation angle.
// Ellipses are exempt: Konva renders them at their CENTER, so they already
// rotate around the center — no fix needed.
// ---------------------------------------------------------------------------

function rotateAroundCenter(
  x: number, y: number, w: number, h: number,
  oldRotDeg: number, newRotDeg: number,
): { x: number; y: number; rotation: number } {
  const oldR = (oldRotDeg * Math.PI) / 180
  const newR = (newRotDeg * Math.PI) / 180
  const hw = w / 2, hh = h / 2
  const cx = x + hw * Math.cos(oldR) - hh * Math.sin(oldR)
  const cy = y + hw * Math.sin(oldR) + hh * Math.cos(oldR)
  return {
    rotation: newRotDeg,
    x: cx - (hw * Math.cos(newR) - hh * Math.sin(newR)),
    y: cy - (hw * Math.sin(newR) + hh * Math.cos(newR)),
  }
}

// ---------------------------------------------------------------------------
// Shared inline style for the small numeric inputs next to sliders
// ---------------------------------------------------------------------------

const numInputStyle = (width: number): React.CSSProperties => ({
  width,
  fontSize: 11,
  background: '#ffffff',
  color: '#111111',
  border: '1px solid #d4ccc2',
  borderRadius: 6,
  padding: '0 4px',
  textAlign: 'right',
})

// ---------------------------------------------------------------------------
// NumberField — normal (always has a value)
// ---------------------------------------------------------------------------

interface NumberFieldProps {
  label: string
  value: number
  step?: number
  min?: number
  max?: number
  onChange: (val: number) => void
}

function NumberField({
  label,
  value,
  step = 1,
  min,
  max,
  onChange,
}: NumberFieldProps): React.ReactElement {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const parsed = parseFloat(e.target.value)
    if (!isNaN(parsed)) {
      onChange(parsed)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8,
      }}
    >
      <label
        style={{
          color: '#555555',
          fontSize: 12,
          width: 64,
          flexShrink: 0,
        }}
      >
        {label}
      </label>
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={handleChange}
        style={{
          flex: 1,
          background: '#ffffff',
          border: '1px solid #d4ccc2',
          borderRadius: 6,
          color: '#111111',
          fontSize: 13,
          padding: '3px 6px',
          boxSizing: 'border-box',
          outline: 'none',
        }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// MixedNumberField — for per-span properties that may be mixed across selection
// ---------------------------------------------------------------------------

interface MixedNumberFieldProps {
  label: string
  value: number | undefined   // undefined = mixed
  step?: number
  min?: number
  max?: number
  onChange: (val: number) => void
}

function MixedNumberField({
  label,
  value,
  step = 1,
  min,
  max,
  onChange,
}: MixedNumberFieldProps): React.ReactElement {
  const isMixed = value === undefined

  function handleChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const parsed = parseFloat(e.target.value)
    if (!isNaN(parsed)) {
      onChange(parsed)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8,
      }}
    >
      <label
        style={{
          color: '#555555',
          fontSize: 12,
          width: 64,
          flexShrink: 0,
        }}
      >
        {label}
      </label>
      <input
        type="number"
        value={isMixed ? '' : value}
        placeholder={isMixed ? '—' : undefined}
        step={step}
        min={min}
        max={max}
        onChange={handleChange}
        style={{
          flex: 1,
          background: '#ffffff',
          border: '1px solid #d4ccc2',
          borderRadius: 6,
          color: isMixed ? '#aaaaaa' : '#111111',
          fontSize: 13,
          padding: '3px 6px',
          boxSizing: 'border-box',
          outline: 'none',
        }}
      />
    </div>
  )
}


// ---------------------------------------------------------------------------
// Shared style constants
// ---------------------------------------------------------------------------

const sectionLabelStyle: React.CSSProperties = {
  color: '#555555',
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: '1.5px',
  textTransform: 'uppercase',
  fontFamily: 'var(--font)',
  marginTop: 12,
  marginBottom: 6,
}

const alignButtonStyle = (active?: boolean): React.CSSProperties => ({
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

const distributeButtonStyle = (disabled: boolean): React.CSSProperties => ({
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

// ---------------------------------------------------------------------------
// AlignDistributeSection
// ---------------------------------------------------------------------------

interface AlignDistributeSectionProps {
  selectedCount: number
  selectedIds: string[]
  objects: Record<string, import('@/types/canvas').CanvasObject>
  anchorId: string | null
  onAlign: (anchor: 'left' | 'right' | 'top' | 'bottom' | 'centerH' | 'centerV') => void
  onDistribute: (axis: 'horizontal' | 'vertical') => void
  onSetAnchor: (id: string | null) => void
}

function AlignDistributeSection({
  selectedCount,
  selectedIds,
  objects,
  anchorId,
  onAlign,
  onDistribute,
  onSetAnchor,
}: AlignDistributeSectionProps): React.ReactElement {
  const distributeDisabled = selectedCount < 3

  function getObjectLabel(id: string, idx: number): string {
    const obj = objects[id]
    if (!obj) return `Object ${idx + 1}`
    if (obj.name) return obj.name
    const typeLabel = obj.type === 'image' ? 'Image' : obj.type === 'text' ? 'Text' : obj.type === 'shape' ? 'Shape' : obj.type === 'path' ? 'Path' : obj.type === 'video' ? 'Video' : 'Object'
    return `${typeLabel} ${idx + 1}`
  }

  return (
    <div style={{ padding: '12px 12px 0' }}>
      <div style={sectionLabelStyle}>Align & Distribute</div>

      {/* Row 1: horizontal alignment */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        <Tooltip label="Align left">
          <button style={alignButtonStyle()} onClick={() => onAlign('left')}>
            Left
          </button>
        </Tooltip>
        <Tooltip label="Center horizontally">
          <button style={alignButtonStyle()} onClick={() => onAlign('centerH')}>
            Center H
          </button>
        </Tooltip>
        <Tooltip label="Align right">
          <button style={alignButtonStyle()} onClick={() => onAlign('right')}>
            Right
          </button>
        </Tooltip>
      </div>

      {/* Row 2: vertical alignment */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        <Tooltip label="Align top">
          <button style={alignButtonStyle()} onClick={() => onAlign('top')}>
            Top
          </button>
        </Tooltip>
        <Tooltip label="Center vertically">
          <button style={alignButtonStyle()} onClick={() => onAlign('centerV')}>
            Middle V
          </button>
        </Tooltip>
        <Tooltip label="Align bottom">
          <button style={alignButtonStyle()} onClick={() => onAlign('bottom')}>
            Bottom
          </button>
        </Tooltip>
      </div>

      {/* Row 3: distribute */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        <Tooltip label="Distribute horizontally">
          <button
            style={distributeButtonStyle(distributeDisabled)}
            disabled={distributeDisabled}
            onClick={() => onDistribute('horizontal')}
          >
            Distribute H
          </button>
        </Tooltip>
        <Tooltip label="Distribute vertically">
          <button
            style={distributeButtonStyle(distributeDisabled)}
            disabled={distributeDisabled}
            onClick={() => onDistribute('vertical')}
          >
            Distribute V
          </button>
        </Tooltip>
      </div>

      {/* Reference object for alignment */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ color: '#aaaaaa', fontSize: 11, marginBottom: 4 }}>Reference</div>
        <select
          value={anchorId ?? ''}
          onChange={(e) => onSetAnchor(e.target.value || null)}
          style={{
            width: '100%',
            background: '#ffffff',
            border: '1px solid #d4ccc2',
            borderRadius: 6,
            color: anchorId ? '#f5a623' : '#555555',
            fontSize: 12,
            padding: '4px 6px',
          }}
        >
          <option value="">None (bounding box)</option>
          {selectedIds.map((id, idx) => (
            <option key={id} value={id}>
              {getObjectLabel(id, idx)}{anchorId === id ? ' ★' : ''}
            </option>
          ))}
        </select>
      </div>

      <div
        style={{
          color: '#aaaaaa',
          fontSize: 11,
          marginBottom: 12,
          paddingBottom: 12,
          borderBottom: '1px solid #e8e0d5',
        }}
      >
        {selectedCount} objects selected
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CanvasSection — shown when nothing is selected
// ---------------------------------------------------------------------------

function CanvasSection(): React.ReactElement {
  return (
    <div style={{ padding: '12px 12px 0', color: '#555555', fontSize: 12 }}>
      Select an object to see its properties, or open Frame Settings to configure the canvas.
    </div>
  )
}

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

function TextSection({
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
          onChange={e => {
            const newRot = Number(e.target.value)
            const { x, y, rotation } = rotateAroundCenter(
              textObj.x, textObj.y, textObj.width, textObj.height,
              textObj.rotation ?? 0, newRot,
            )
            onCommit(selectedId, { rotation, x, y } as Partial<TextObject>)
          }}
          style={{ flex: 1 }}
        />
        <input
          type="number" min={-360} max={360} step={1}
          value={Math.round(textObj.rotation ?? 0)}
          onChange={e => {
            const newRot = Math.max(-360, Math.min(360, Number(e.target.value)))
            const { x, y, rotation } = rotateAroundCenter(
              textObj.x, textObj.y, textObj.width, textObj.height,
              textObj.rotation ?? 0, newRot,
            )
            onCommit(selectedId, { rotation, x, y } as Partial<TextObject>)
          }}
          style={numInputStyle(48)}
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
        <input
          type="number" min={0} max={100} step={1}
          value={Math.round((textObj.opacity ?? 1) * 100)}
          onChange={e => {
            const v = Math.max(0, Math.min(100, Number(e.target.value)))
            onCommit(selectedId, { opacity: v / 100 } as Partial<TextObject>)
          }}
          style={numInputStyle(44)}
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


// ---------------------------------------------------------------------------
// EffectsSection — extensible layer effects framework
// ---------------------------------------------------------------------------

interface EffectsSectionProps {
  effects: LayerEffect[] | undefined
  onUpdate: (effects: LayerEffect[]) => void
  onCommit: (effects: LayerEffect[]) => void
}

function EffectsSection({ effects, onUpdate, onCommit }: EffectsSectionProps): React.ReactElement {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const pickerRef = useRef<HTMLDivElement>(null)
  const allDefs = getAllEffectDefinitions()
  const activeEffects = effects ?? []

  useEffect(() => {
    if (!pickerOpen) return
    function handleOutside(e: MouseEvent): void {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [pickerOpen])

  function addEffect(type: string): void {
    const def = getEffectDefinition(type)
    if (!def) return
    const next: LayerEffect[] = [
      ...activeEffects,
      { id: crypto.randomUUID(), type, enabled: true, params: def.defaultParams() },
    ]
    onCommit(next)
    setPickerOpen(false)
  }

  function removeEffect(id: string): void {
    onCommit(activeEffects.filter(e => e.id !== id))
  }

  function toggleEnabled(id: string): void {
    const next = activeEffects.map(e => e.id === id ? { ...e, enabled: !e.enabled } : e)
    onCommit(next)
  }

  function updateParam(id: string, key: string, value: number | string | boolean, commit: boolean): void {
    const next = activeEffects.map(e =>
      e.id === id ? { ...e, params: { ...e.params, [key]: value } } : e,
    )
    if (commit) onCommit(next)
    else onUpdate(next)
  }

  function resetParam(id: string, key: string): void {
    const effect = activeEffects.find(e => e.id === id)
    if (!effect) return
    const def = getEffectDefinition(effect.type)
    if (!def) return
    const defaultVal = def.defaultParams()[key]
    updateParam(id, key, defaultVal, true)
  }

  return (
    <div style={{ borderTop: '1px solid #e8e0d5', paddingTop: 10, marginTop: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ ...sectionLabelStyle, marginBottom: 0 }}>Effects</div>
        <div style={{ position: 'relative' }} ref={pickerRef}>
          <button
            style={{ ...iconBtnStyle(true), width: 22, height: 22 }}
            onClick={() => setPickerOpen(v => !v)}
            title="Add effect"
          >
            <Plus size={12} />
          </button>
          {pickerOpen && (
            <div style={{
              position: 'absolute', right: 0, top: 26, zIndex: 100,
              background: '#ffffff', border: '1px solid #d4ccc2', borderRadius: 8,
              minWidth: 140, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}>
              {allDefs.map(def => (
                <button
                  key={def.type}
                  onClick={() => addEffect(def.type)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '6px 10px', background: 'none', border: 'none',
                    color: '#111111', fontSize: 12, cursor: 'pointer',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f5ede2')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  {def.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {activeEffects.length === 0 && (
        <div style={{ color: '#aaaaaa', fontSize: 11, paddingBottom: 6 }}>No effects — click + to add</div>
      )}

      {activeEffects.map(effect => {
        const def = getEffectDefinition(effect.type)
        if (!def) return null
        const isCollapsed = collapsed[effect.id] ?? false
        return (
          <div key={effect.id} style={{ marginBottom: 6, background: '#ffffff', border: '1px solid #e8e0d5', borderRadius: 8, overflow: 'hidden' }}>
            {/* Effect header row */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '4px 6px', gap: 4 }}>
              <button
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555555', padding: 0, display: 'flex', alignItems: 'center' }}
                onClick={() => setCollapsed(c => ({ ...c, [effect.id]: !isCollapsed }))}
              >
                {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
              </button>
              <span
                style={{ flex: 1, color: '#111111', fontSize: 12, cursor: 'pointer' }}
                onClick={() => setCollapsed(c => ({ ...c, [effect.id]: !isCollapsed }))}
              >
                {def.label}
              </span>
              <button
                style={{ ...iconBtnStyle(effect.enabled), width: 20, height: 20 }}
                onClick={() => toggleEnabled(effect.id)}
                title={effect.enabled ? 'Disable effect' : 'Enable effect'}
              >
                {effect.enabled ? <Eye size={11} /> : <EyeOff size={11} />}
              </button>
              <button
                style={{ ...iconBtnStyle(false), width: 20, height: 20, color: '#555555' }}
                onClick={() => removeEffect(effect.id)}
                title="Remove effect"
              >
                <X size={11} />
              </button>
            </div>

            {/* Effect controls */}
            {!isCollapsed && (
              <div style={{ padding: '2px 8px 8px', opacity: effect.enabled ? 1 : 0.4, pointerEvents: effect.enabled ? 'auto' : 'none' }}>
                {def.controls.map(ctrl => {
                  const val = effect.params[ctrl.key]
                  if (ctrl.type === 'slider') {
                    const numVal = val as number
                    const decimals = (ctrl.step ?? 1) < 1 ? 2 : 0
                    return (
                      <div key={ctrl.key} style={{ display: 'flex', alignItems: 'center', marginBottom: 5, gap: 6 }}>
                        <label
                          style={{ color: '#555555', fontSize: 11, width: 68, flexShrink: 0, cursor: 'pointer' }}
                          onDoubleClick={() => resetParam(effect.id, ctrl.key)}
                        >
                          {ctrl.label}
                        </label>
                        <input
                          type="range"
                          min={ctrl.min ?? 0}
                          max={ctrl.max ?? 1}
                          step={ctrl.step ?? 0.01}
                          value={numVal}
                          onChange={e => updateParam(effect.id, ctrl.key, Number(e.target.value), false)}
                          onMouseUp={e => updateParam(effect.id, ctrl.key, Number((e.target as HTMLInputElement).value), true)}
                          style={{ flex: 1 }}
                        />
                        <input
                          type="number"
                          min={ctrl.min ?? 0}
                          max={ctrl.max ?? 1}
                          step={ctrl.step ?? 0.01}
                          value={numVal.toFixed(decimals)}
                          onChange={e => updateParam(effect.id, ctrl.key, Number(e.target.value), false)}
                          onBlur={e => updateParam(effect.id, ctrl.key, Number(e.target.value), true)}
                          style={numInputStyle(44)}
                        />
                      </div>
                    )
                  }
                  if (ctrl.type === 'toggle') {
                    return (
                      <div key={ctrl.key} style={{ display: 'flex', alignItems: 'center', marginBottom: 5, gap: 6 }}>
                        <label style={{ color: '#555555', fontSize: 11, width: 68, flexShrink: 0 }}>{ctrl.label}</label>
                        <input
                          type="checkbox"
                          checked={val as boolean}
                          onChange={e => updateParam(effect.id, ctrl.key, e.target.checked, true)}
                        />
                      </div>
                    )
                  }
                  if (ctrl.type === 'color') {
                    return (
                      <div key={ctrl.key} style={{ display: 'flex', alignItems: 'center', marginBottom: 5, gap: 6 }}>
                        <label style={{ color: '#555555', fontSize: 11, width: 68, flexShrink: 0 }}>{ctrl.label}</label>
                        <ColorInput
                          value={val as string}
                          onChange={v => updateParam(effect.id, ctrl.key, v, false)}
                          onCommit={() => updateParam(effect.id, ctrl.key, ctrl.value as string, true)}
                        />
                      </div>
                    )
                  }
                  return null
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// AdjustmentsSection — Lightroom-style non-destructive photo adjustments
// ---------------------------------------------------------------------------

interface AdjustmentsSectionProps {
  imgObj: { adjustments?: PhotoAdjustments }
  selectedId: string
  bypass: boolean
  onToggleBypass: () => void
  onStartDrag: () => void
  onUpdate: (adj: PhotoAdjustments) => void
  onCommit: (adj: PhotoAdjustments) => void
}

const subGroupLabelStyle: React.CSSProperties = {
  color: '#aaaaaa',
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: '1px',
  textTransform: 'uppercase' as const,
  marginTop: 10,
  marginBottom: 4,
}

const TRACK_GRADIENT: Record<keyof PhotoAdjustments, string> = {
  exposure:    'linear-gradient(to right, #111 0%, #fff 100%)',
  contrast:    'linear-gradient(to right, #222 0%, #777 40%, #fff 100%)',
  highlights:  'linear-gradient(to right, #666 0%, #fff 100%)',
  shadows:     'linear-gradient(to right, #000 0%, #777 100%)',
  whites:      'linear-gradient(to right, #aaa 0%, #fff 100%)',
  blacks:      'linear-gradient(to right, #000 0%, #555 100%)',
  temperature: 'linear-gradient(to right, #4b7fc7 0%, #c47820 100%)',
  tint:        'linear-gradient(to right, #3a9a3a 0%, #c040b0 100%)',
  saturation:  'linear-gradient(to right, #808080 0%, #cc3333 100%)',
  vibrance:    'linear-gradient(to right, #808080 0%, #4488cc 100%)',
  clarity:     'linear-gradient(to right, #444 0%, #ddd 100%)',
  dehaze:      'linear-gradient(to right, #6080a8 0%, #e8c060 100%)',
}

function AdjustmentsSection({ imgObj, selectedId: _selectedId, bypass, onToggleBypass, onStartDrag, onUpdate, onCommit }: AdjustmentsSectionProps): React.ReactElement {
  const adj = imgObj.adjustments ?? DEFAULT_ADJUSTMENTS

  function makeSlider(
    label: string,
    key: keyof PhotoAdjustments,
    min: number,
    max: number,
    step: number,
  ): React.ReactElement {
    const value = adj[key]
    const decimals = step < 1 ? 1 : 0
    return (
      <div key={key} style={{ display: 'flex', alignItems: 'center', marginBottom: 6, gap: 8 }}>
        <label
          style={{ color: '#555555', fontSize: 12, width: 80, flexShrink: 0, cursor: 'pointer' }}
          onDoubleClick={() => onCommit({ ...adj, [key]: 0 })}
        >
          {label}
        </label>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          className="adj-slider"
          onMouseDown={onStartDrag}
          onChange={(e) => onUpdate({ ...adj, [key]: Number(e.target.value) })}
          onMouseUp={(e) => onCommit({ ...adj, [key]: Number((e.target as HTMLInputElement).value) })}
          onDoubleClick={() => onCommit({ ...adj, [key]: 0 })}
          style={{ flex: 1, background: TRACK_GRADIENT[key] }}
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value.toFixed(decimals)}
          onChange={(e) => onUpdate({ ...adj, [key]: Number(e.target.value) })}
          onBlur={(e) => onCommit({ ...adj, [key]: Number(e.target.value) })}
          onDoubleClick={() => onCommit({ ...adj, [key]: 0 })}
          style={numInputStyle(44)}
        />
      </div>
    )
  }

  return (
    <div style={{ borderTop: '1px solid #e8e0d5', paddingTop: 10, marginTop: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ ...sectionLabelStyle, marginBottom: 0 }}>Adjustments</div>
        <button
          style={{ ...iconBtnStyle(!bypass), width: 22, height: 22 }}
          onClick={onToggleBypass}
          title={bypass ? 'Show adjustments (\\)' : 'Bypass adjustments (\\)'}
        >
          <Power size={12} />
        </button>
      </div>

      <div style={{ opacity: bypass ? 0.35 : 1, pointerEvents: bypass ? 'none' : 'auto' }}>
      <div style={subGroupLabelStyle}>Light</div>
      {makeSlider('Exposure', 'exposure', -5, 5, 0.1)}
      {makeSlider('Contrast', 'contrast', -100, 100, 1)}
      {makeSlider('Highlights', 'highlights', -100, 100, 1)}
      {makeSlider('Shadows', 'shadows', -100, 100, 1)}
      {makeSlider('Whites', 'whites', -100, 100, 1)}
      {makeSlider('Blacks', 'blacks', -100, 100, 1)}

      <div style={subGroupLabelStyle}>Color</div>
      {makeSlider('Temperature', 'temperature', -100, 100, 1)}
      {makeSlider('Tint', 'tint', -100, 100, 1)}
      {makeSlider('Saturation', 'saturation', -100, 100, 1)}
      {makeSlider('Vibrance', 'vibrance', -100, 100, 1)}

      <div style={subGroupLabelStyle}>Detail</div>
      {makeSlider('Clarity', 'clarity', -100, 100, 1)}
      {makeSlider('Dehaze', 'dehaze', -100, 100, 1)}
      </div>

      <button
        onClick={() => onCommit(DEFAULT_ADJUSTMENTS)}
        style={{
          marginTop: 8,
          width: '100%',
          fontSize: 11,
          background: '#ffffff',
          color: '#555555',
          border: '1px solid #d4ccc2',
          borderRadius: 999,
          padding: '3px 0',
          cursor: 'pointer',
        }}
      >
        Reset All
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// VideoSection — properties for video objects
// ---------------------------------------------------------------------------

interface VideoSectionProps {
  videoObj: VideoObject
  selectedId: string
  onStartDrag: () => void
  onUpdate: (id: string, partial: Partial<VideoObject>) => void
  onCommit: (id: string, partial: Partial<VideoObject>) => void
}

function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

const trimLabelStyle: React.CSSProperties = {
  color: '#555555',
  fontSize: 11,
  width: 32,
  flexShrink: 0,
  textTransform: 'uppercase',
  fontWeight: 700,
  letterSpacing: '1px',
}

function VideoSection({
  videoObj,
  selectedId,
  onStartDrag,
  onUpdate,
  onCommit,
}: VideoSectionProps): React.ReactElement {
  const isPlaying = useCanvasStore((s) => s.videoPlayingIds.has(videoObj.id))
  const toggleVideoPlay = useCanvasStore((s) => s.toggleVideoPlay)
  const enterMaskEditModeV = useCanvasStore((s) => s.enterMaskEditMode)
  const maskDrawModeV = useCanvasStore((s) => s.maskDrawMode)
  const enterMaskDrawModeV = useCanvasStore((s) => s.enterMaskDrawMode)
  const clearMaskDrawModeV = useCanvasStore((s) => s.clearMaskDrawMode)
  const thumbnailsV = useThumbnailStore((s) => s.thumbnails)
  const adjustmentsBypassV = useCanvasStore((s) => s.adjustmentsBypass)
  const toggleAdjustmentsBypassV = useCanvasStore((s) => s.toggleAdjustmentsBypass)

  const [currentTime, setCurrentTime] = useState(0)
  const [fileSize, setFileSize] = useState<string | null>(null)
  const isScrubbing = useRef(false)
  useEffect(() => {
    const vid = videoElementRegistry.get(videoObj.id)
    if (!vid) return
    const intervalId = setInterval(() => {
      if (!isScrubbing.current) setCurrentTime(vid.currentTime)
    }, 100)
    return () => clearInterval(intervalId)
  }, [videoObj.id, isPlaying])
  useEffect(() => {
    if (typeof window.electronAPI.getFileSize !== 'function') return
    window.electronAPI.getFileSize(videoObj.filePath).then(({ size }) => {
      if (size === 0) { setFileSize(null); return }
      if (size >= 1024 * 1024) setFileSize(`${(size / (1024 * 1024)).toFixed(1)} MB`)
      else setFileSize(`${(size / 1024).toFixed(0)} KB`)
    }).catch(() => setFileSize(null))
  }, [videoObj.filePath])

  return (
    <div style={{ padding: '12px 12px 0' }}>
      {/* Read-only info */}
      <div style={sectionLabelStyle}>Info</div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6, gap: 8 }}>
        <span style={{ color: '#555555', fontSize: 12, width: 64, flexShrink: 0 }}>Duration</span>
        <span style={{ color: '#111111', fontSize: 12 }}>{formatDuration(videoObj.naturalDuration)}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6, gap: 8 }}>
        <span style={{ color: '#555555', fontSize: 12, width: 64, flexShrink: 0 }}>Dimensions</span>
        <span style={{ color: '#111111', fontSize: 12 }}>{videoObj.naturalWidth} × {videoObj.naturalHeight}</span>
      </div>
      {fileSize != null && (
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10, gap: 8 }}>
          <span style={{ color: '#555555', fontSize: 12, width: 64, flexShrink: 0 }}>File Size</span>
          <span style={{ color: '#111111', fontSize: 12 }}>{fileSize}</span>
        </div>
      )}

      {/* Audio: mute toggle + volume slider */}
      <div style={sectionLabelStyle}>Audio</div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6, gap: 6 }}>
        <Tooltip label={videoObj.muted ? 'Unmute' : 'Mute'}>
          <button
            style={iconBtnStyle(!videoObj.muted)}
            onClick={() => onCommit(selectedId, { muted: !videoObj.muted })}
          >
            {videoObj.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
        </Tooltip>
        <input
          type="range" min={0} max={100} step={1}
          value={Math.round((videoObj.volume ?? 1) * 100)}
          disabled={videoObj.muted}
          onMouseDown={onStartDrag}
          onChange={e => onUpdate(selectedId, { volume: Number(e.target.value) / 100 })}
          onMouseUp={e => onCommit(selectedId, { volume: Number((e.target as HTMLInputElement).value) / 100 })}
          style={{ flex: 1, opacity: videoObj.muted ? 0.35 : 1, pointerEvents: videoObj.muted ? 'none' : 'auto' }}
        />
        <input
          type="number" min={0} max={100} step={1}
          value={Math.round((videoObj.volume ?? 1) * 100)}
          disabled={videoObj.muted}
          onChange={e => {
            const v = Math.max(0, Math.min(100, Number(e.target.value)))
            onCommit(selectedId, { volume: v / 100 })
          }}
          onDoubleClick={() => onCommit(selectedId, { volume: 1 })}
          style={{ ...numInputStyle(44), opacity: videoObj.muted ? 0.35 : 1 }}
        />
      </div>

      {/* Playback controls */}
      <div style={sectionLabelStyle}>Playback</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Tooltip label={isPlaying ? 'Pause' : 'Play'}>
          <button
            style={iconBtnStyle(isPlaying)}
            onClick={() => toggleVideoPlay(videoObj.id)}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          </button>
        </Tooltip>
        <Tooltip label={(videoObj.loop ?? true) ? 'Loop on' : 'Loop off'}>
          <button
            style={iconBtnStyle(videoObj.loop ?? true)}
            onClick={() => onCommit(selectedId, { loop: !(videoObj.loop ?? true) })}
          >
            <Repeat size={14} />
          </button>
        </Tooltip>
        <span style={{ color: '#555555', fontSize: 11, marginLeft: 4 }}>
          {formatDuration(currentTime)} / {formatDuration(videoObj.naturalDuration)}
        </span>
      </div>

      {/* Scrub bar */}
      <div style={{ marginBottom: 10 }}>
        <input
          type="range"
          min={videoObj.trimStart ?? 0}
          max={videoObj.trimEnd ?? videoObj.naturalDuration}
          step={0.01}
          value={currentTime}
          style={{ width: '100%' }}
          onMouseDown={() => {
            isScrubbing.current = true
            onStartDrag()
          }}
          onChange={(e) => {
            const t = Number(e.target.value)
            const vid = videoElementRegistry.get(videoObj.id)
            if (vid) vid.currentTime = t
            setCurrentTime(t)
          }}
          onMouseUp={() => {
            isScrubbing.current = false
            onCommit(selectedId, {})
          }}
        />
      </div>

      {/* Poster frame */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span style={trimLabelStyle}>Poster</span>
        <span style={{ color: '#111111', fontSize: 11, flex: 1 }}>
          {videoObj.posterFrame != null
            ? formatDuration(videoObj.posterFrame)
            : `Default (${formatDuration(videoObj.trimStart ?? 0)})`}
        </span>
        <Tooltip label="Set poster to current position">
          <button
            style={{ ...iconBtnStyle(false), fontSize: 11, padding: '2px 6px', width: 'auto' }}
            onClick={() => onCommit(selectedId, { posterFrame: currentTime })}
          >
            Set
          </button>
        </Tooltip>
        {videoObj.posterFrame != null && (
          <Tooltip label="Reset poster to trim start">
            <button
              style={{ ...iconBtnStyle(false), fontSize: 11, padding: '2px 6px', width: 'auto' }}
              onClick={() => onCommit(selectedId, { posterFrame: undefined })}
            >
              Reset
            </button>
          </Tooltip>
        )}
      </div>

      {/* Trim section */}
      <div style={sectionLabelStyle}>Trim</div>
      {/* In point */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={trimLabelStyle}>In</span>
        <input
          type="number"
          min={0}
          max={videoObj.naturalDuration}
          step={0.01}
          value={(videoObj.trimStart ?? 0).toFixed(2)}
          onMouseDown={onStartDrag}
          onChange={(e) => onUpdate(selectedId, { trimStart: Number(e.target.value) })}
          onBlur={(e) => onCommit(selectedId, { trimStart: Number(e.target.value) })}
          style={numInputStyle(60)}
        />
        <Tooltip label="Set In to current time">
          <button
            style={{ ...iconBtnStyle(false), fontSize: 11, padding: '2px 6px', width: 'auto' }}
            onClick={() => onCommit(selectedId, { trimStart: currentTime })}
          >
            Set In
          </button>
        </Tooltip>
      </div>
      {/* Out point */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={trimLabelStyle}>Out</span>
        <input
          type="number"
          min={0}
          max={videoObj.naturalDuration}
          step={0.01}
          value={(videoObj.trimEnd ?? videoObj.naturalDuration).toFixed(2)}
          onMouseDown={onStartDrag}
          onChange={(e) => onUpdate(selectedId, { trimEnd: Number(e.target.value) })}
          onBlur={(e) => onCommit(selectedId, { trimEnd: Number(e.target.value) })}
          style={numInputStyle(60)}
        />
        <Tooltip label="Set Out to current time">
          <button
            style={{ ...iconBtnStyle(false), fontSize: 11, padding: '2px 6px', width: 'auto' }}
            onClick={() => onCommit(selectedId, { trimEnd: currentTime })}
          >
            Set Out
          </button>
        </Tooltip>
      </div>
      {/* Reset trim */}
      <div style={{ marginBottom: 10 }}>
        <button
          style={{ ...iconBtnStyle(false), fontSize: 11, padding: '2px 8px', width: 'auto' }}
          onClick={() => onCommit(selectedId, { trimStart: 0, trimEnd: videoObj.naturalDuration })}
        >
          Reset Trim
        </button>
      </div>
      {/* Start delay */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span style={trimLabelStyle}>Delay</span>
        <input
          type="number" min={0} max={30} step={0.1}
          value={(videoObj.startOffset ?? 0).toFixed(1)}
          onMouseDown={onStartDrag}
          onChange={e => onUpdate(selectedId, { startOffset: Math.max(0, Number(e.target.value)) })}
          onBlur={e => onCommit(selectedId, { startOffset: Math.max(0, Number(e.target.value)) })}
          style={numInputStyle(60)}
        />
        <span style={{ color: '#666', fontSize: 11 }}>s before play</span>
      </div>

      {/* Rotation slider + numeric input */}
      <div style={sectionLabelStyle}>Transform</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <label style={{ color: '#555555', fontSize: 12, width: 64, flexShrink: 0 }}>Rotation</label>
        <input
          type="range" min={-360} max={360} step={1}
          value={Math.round(videoObj.rotation ?? 0)}
          onChange={e => {
            const newRot = Number(e.target.value)
            const { x: fx, y: fy, rotation } = rotateAroundCenter(
              videoObj.frameX, videoObj.frameY, videoObj.frameWidth, videoObj.frameHeight,
              videoObj.rotation ?? 0, newRot,
            )
            onCommit(selectedId, { rotation, frameX: fx, frameY: fy, x: fx, y: fy })
          }}
          style={{ flex: 1 }}
        />
        <input
          type="number" min={-360} max={360} step={1}
          value={Math.round(videoObj.rotation ?? 0)}
          onChange={e => {
            const newRot = Math.max(-360, Math.min(360, Number(e.target.value)))
            const { x: fx, y: fy, rotation } = rotateAroundCenter(
              videoObj.frameX, videoObj.frameY, videoObj.frameWidth, videoObj.frameHeight,
              videoObj.rotation ?? 0, newRot,
            )
            onCommit(selectedId, { rotation, frameX: fx, frameY: fy, x: fx, y: fy })
          }}
          style={numInputStyle(48)}
        />
      </div>

      {/* Opacity slider + numeric input */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <label style={{ color: '#555555', fontSize: 12, width: 64, flexShrink: 0 }}>Opacity</label>
        <input
          type="range" min={0} max={100} step={1}
          value={Math.round((videoObj.opacity ?? 1) * 100)}
          onMouseDown={onStartDrag}
          onChange={e => onUpdate(selectedId, { opacity: Number(e.target.value) / 100 })}
          onMouseUp={e => onCommit(selectedId, { opacity: Number((e.target as HTMLInputElement).value) / 100 })}
          style={{ flex: 1 }}
        />
        <input
          type="number" min={0} max={100} step={1}
          value={Math.round((videoObj.opacity ?? 1) * 100)}
          onChange={e => {
            const v = Math.max(0, Math.min(100, Number(e.target.value)))
            onCommit(selectedId, { opacity: v / 100 })
          }}
          style={numInputStyle(44)}
        />
      </div>

      {/* Adjustments */}
      <AdjustmentsSection
        imgObj={videoObj}
        selectedId={selectedId}
        bypass={adjustmentsBypassV}
        onToggleBypass={toggleAdjustmentsBypassV}
        onStartDrag={onStartDrag}
        onUpdate={(adj) => onUpdate(selectedId, { adjustments: adj })}
        onCommit={(adj) => onCommit(selectedId, { adjustments: adj })}
      />

      {/* Effects */}
      <EffectsSection
        effects={videoObj.effects}
        onUpdate={(effects) => onUpdate(selectedId, { effects })}
        onCommit={(effects) => onCommit(selectedId, { effects })}
      />

      {/* Mask section */}
      <div style={{ borderTop: '1px solid #e8e0d5', paddingTop: 10, marginTop: 4, marginBottom: 10 }}>
        <div style={{ color: '#555555', fontSize: 9, fontWeight: 700, letterSpacing: '1.5px',
          textTransform: 'uppercase' as const, fontFamily: 'var(--font)', marginBottom: 8 }}>Mask</div>

        {videoObj.maskEditMode ? (
          /* Mask edit mode active banner */
          <div style={{
            background: 'rgba(82,183,136,0.1)',
            border: '1px solid #52b788',
            borderRadius: 8,
            padding: '6px 10px',
            marginBottom: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ color: '#2d6a4f', fontSize: 11 }}>Editing mask path</span>
            <button
              onClick={() => {
                onCommit(selectedId, { maskEditMode: false })
              }}
              style={{
                background: '#2d6a4f',
                color: '#fff',
                border: 'none',
                borderRadius: 999,
                padding: '2px 8px',
                cursor: 'pointer',
                fontSize: 11,
              }}
            >
              Done
            </button>
          </div>
        ) : videoObj.mask == null ? (
          /* No mask — draw mode picker or active draw banner */
          maskDrawModeV?.id === selectedId ? (
            /* Draw in progress for this video */
            <div>
              <div style={{ color: '#f94608', fontSize: 11, marginBottom: 8 }}>
                Drawing {maskDrawModeV.tool} mask —{'  '}
                {maskDrawModeV.tool === 'pen'
                  ? 'click to add points, close path to finish'
                  : 'drag to define shape'}
              </div>
              <button
                onClick={() => clearMaskDrawModeV()}
                style={{
                  width: '100%',
                  height: 28,
                  background: 'rgba(249,70,8,0.08)',
                  color: '#f94608',
                  border: '1px solid #f94608',
                  borderRadius: 999,
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            /* Tool picker — icon-only buttons */
            <div>
              <div style={{ color: '#555555', fontSize: 11, marginBottom: 6 }}>Add mask:</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Tooltip label="Pen mask">
                  <button
                    title="Pen mask"
                    onClick={() => { enterMaskDrawModeV(selectedId, 'pen') }}
                    style={iconBtnStyle()}
                  >
                    <PenTool size={14} />
                  </button>
                </Tooltip>
                <Tooltip label="Rectangle mask">
                  <button
                    title="Rectangle mask"
                    onClick={() => { enterMaskDrawModeV(selectedId, 'rect') }}
                    style={iconBtnStyle()}
                  >
                    <Square size={14} />
                  </button>
                </Tooltip>
                <Tooltip label="Oval mask">
                  <button
                    title="Oval mask"
                    onClick={() => { enterMaskDrawModeV(selectedId, 'ellipse') }}
                    style={iconBtnStyle()}
                  >
                    <Circle size={14} />
                  </button>
                </Tooltip>
              </div>
            </div>
          )
        ) : (
          /* Mask controls */
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              {thumbnailsV[`${selectedId}__mask`] != null && (
                <div style={{
                  width: 36, height: 36, flexShrink: 0, borderRadius: 6,
                  overflow: 'hidden', border: '1px solid #d4ccc2', background: '#f5ede2',
                }}>
                  <img
                    src={thumbnailsV[`${selectedId}__mask`]}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    alt="mask"
                    draggable={false}
                  />
                </div>
              )}
              <Tooltip label="Edit mask">
                <button
                  title="Edit mask"
                  onClick={() => { enterMaskEditModeV(selectedId) }}
                  style={{ ...iconBtnStyle(), flex: 1, width: 'auto' }}
                >
                  <Pencil size={14} />
                </button>
              </Tooltip>
              <Tooltip label={videoObj.mask.visible ? 'Hide mask' : 'Show mask'}>
                <button
                  title={videoObj.mask.visible ? 'Hide mask' : 'Show mask'}
                  onClick={() => {
                    onCommit(selectedId, { mask: { ...videoObj.mask!, visible: !videoObj.mask!.visible } })
                  }}
                  style={iconBtnStyle()}
                >
                  {videoObj.mask.visible
                    ? <Eye size={14} />
                    : <EyeOff size={14} />}
                </button>
              </Tooltip>
              <Tooltip label="Delete mask">
                <button
                  title="Delete mask"
                  onClick={() => {
                    onCommit(selectedId, { mask: undefined })
                  }}
                  style={iconBtnStyle()}
                >
                  <Trash2 size={14} />
                </button>
              </Tooltip>
            </div>

            {/* Feather */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8 }}>
              <label style={{ color: '#555555', fontSize: 12, width: 64, flexShrink: 0 }}>Feather</label>
              <input
                type="range"
                min={0}
                max={50}
                step={1}
                value={videoObj.mask.feather}
                onMouseDown={onStartDrag}
                onChange={(e) => {
                  onUpdate(selectedId, { mask: { ...videoObj.mask!, feather: Number(e.target.value) } })
                }}
                onMouseUp={(e) => {
                  onCommit(selectedId, { mask: { ...videoObj.mask!, feather: Number((e.target as HTMLInputElement).value) } })
                }}
                style={{ flex: 1 }}
              />
              <span style={{ color: '#111111', fontSize: 12, width: 24, textAlign: 'right' }}>
                {videoObj.mask.feather}
              </span>
            </div>

            {/* Invert */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8 }}>
              <label style={{ color: '#555555', fontSize: 12, width: 64, flexShrink: 0 }}>Invert</label>
              <input
                type="checkbox"
                checked={videoObj.mask.inverted}
                onChange={() => {
                  onCommit(selectedId, { mask: { ...videoObj.mask!, inverted: !videoObj.mask!.inverted } })
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PropertiesPanel (root export)
// ---------------------------------------------------------------------------

export function PropertiesPanel(): React.ReactElement {
  const objects = useCanvasStore((s) => s.objects)
  const selectedId = useCanvasStore((s) => s.selectedId)
  const selectedIds = useCanvasStore((s) => s.selectedIds)
  const updateObject = useCanvasStore((s) => s.updateObject)
  const commitUpdate = useCanvasStore((s) => s.commitUpdate)
  const startDrag = useCanvasStore((s) => s.startDrag)
  const adjustmentsBypass = useCanvasStore((s) => s.adjustmentsBypass)
  const toggleAdjustmentsBypass = useCanvasStore((s) => s.toggleAdjustmentsBypass)
  const enterMaskEditMode = useCanvasStore((s) => s.enterMaskEditMode)
  const maskDrawMode = useCanvasStore((s) => s.maskDrawMode)
  const enterMaskDrawMode = useCanvasStore((s) => s.enterMaskDrawMode)
  const clearMaskDrawMode = useCanvasStore((s) => s.clearMaskDrawMode)
  const alignObjects = useCanvasStore((s) => s.alignObjects)
  const anchorId = useCanvasStore((s) => s.anchorId)
  const setAnchor = useCanvasStore((s) => s.setAnchor)

  const thumbnails = useThumbnailStore((s) => s.thumbnails)
  const distributeObjects = useCanvasStore((s) => s.distributeObjects)
  const textEditingId = useCanvasStore((s) => s.textEditingId)
  const textSelection = useCanvasStore((s) => s.textSelection)
  const captureTextSelection = useCanvasStore((s) => s.captureTextSelection)

  const { removeBg } = useAI()
  const operations = useAIStore((s) => s.operations)
  const clearOperation = useAIStore((s) => s.clearOperation)

  const { editExternally, stopEditing, activeObjectId } = useExternalEdit()
  const currentFilePath = useSaveStatusStore((s) => s.currentFilePath)
  const autosaveFilePath = useSaveStatusStore((s) => s.autosaveFilePath)
  const effectiveFilePath = currentFilePath ?? autosaveFilePath
  const [externalEditor, setExternalEditor] = useState<ExternalEditor | null>(null)

  useEffect(() => {
    void window.electronAPI.getExternalEditor().then(setExternalEditor)
  }, [])

  async function pickNewEditor(): Promise<void> {
    const editor = await window.electronAPI.setExternalEditor()
    if (editor) setExternalEditor(editor)
  }

  const selectedObj = selectedId !== null ? objects[selectedId] : null
  const isImage = selectedObj?.type === 'image'
  const isText = selectedObj?.type === 'text'
  const isShape = selectedObj?.type === 'shape'
  const isPath = selectedObj?.type === 'path'
  const isVideo = selectedObj?.type === 'video'
  const isGroup = selectedObj?.type === 'group'
  const isMultiSelect = selectedIds.length > 1
  const isNoneSelected = selectedId === null && selectedIds.length === 0

  const activeBgOp: BackgroundRemovalOperation | undefined = selectedId
    ? (Object.values(operations).find(
        (op) => op.type === 'background-removal' && op.targetObjectId === selectedId
      ) as BackgroundRemovalOperation | undefined)
    : undefined

  React.useEffect(() => {
    if (activeBgOp?.status === 'done') {
      const t = setTimeout(() => clearOperation(activeBgOp.id), 2000)
      return () => clearTimeout(t)
    }
    return undefined
  }, [activeBgOp?.status, activeBgOp?.id, clearOperation])

  function patch(partial: Parameters<typeof updateObject>[1]): void {
    if (!selectedId) return
    updateObject(selectedId, partial)
  }

  function handleRemoveBg(): void {
    if (selectedId) void removeBg(selectedId)
  }

  // When a text layer is in inline edit mode, prevent non-input mouse clicks in this
  // panel from stealing focus away from the contenteditable. Buttons, toggles, color
  // swatches, and label clicks all go through here. Actual <input> and <select> elements
  // are exempt so they can still receive keyboard focus when needed (e.g. font-size field).
  function handlePanelMouseDown(e: React.MouseEvent): void {
    if (!textEditingId) return
    // Snapshot the live browser selection NOW — before focus can move away
    // from the contenteditable (either via preventDefault below or by focusing an input).
    captureTextSelection?.()
    const target = e.target as HTMLElement
    const needsKeyboardFocus =
      target instanceof HTMLInputElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLTextAreaElement
    if (!needsKeyboardFocus) {
      e.preventDefault()
    }
  }

  return (
    <div
      id="properties-panel"
      onMouseDown={handlePanelMouseDown}
      style={{
        width: 300,
        flexShrink: 0,
        height: '100%',
        background: 'var(--bg-panel)',
        borderLeft: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Title */}
      <div
        style={{
          padding: '12px 12px 8px',
          color: '#111111',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          fontFamily: 'var(--font)',
          borderBottom: '1px solid #e8e0d5',
          flexShrink: 0,
        }}
      >
        Properties
      </div>

      {/* Body */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Multi-select: align/distribute */}
        {isMultiSelect && (
          <AlignDistributeSection
            selectedCount={selectedIds.length}
            selectedIds={selectedIds}
            objects={objects}
            anchorId={anchorId}
            onAlign={alignObjects}
            onDistribute={distributeObjects}
            onSetAnchor={setAnchor}
          />
        )}

        {/* Nothing selected: canvas properties */}
        {isNoneSelected && (
          <CanvasSection />
        )}

        {/* Single object selected: per-object properties */}
        {!isMultiSelect && selectedObj !== null && !isImage && !isText && !isShape && !isPath && !isVideo && (
          <div
            style={{
              padding: '20px 12px',
              color: '#555555',
              fontSize: 13,
            }}
          >
            No properties
          </div>
        )}

        {/* Video object */}
        {!isMultiSelect && selectedObj !== null && isVideo && selectedId !== null && (
          <>
            <VideoSection
              videoObj={selectedObj as VideoObject}
              selectedId={selectedId}
              onStartDrag={startDrag}
              onUpdate={updateObject}
              onCommit={commitUpdate}
            />
            {selectedObj.parentGroupId && (
              <div style={{ padding: '0 12px 12px' }}>
                <button
                  onClick={() => useCanvasStore.getState().disconnectGridCell(selectedId)}
                  style={{
                    width: '100%',
                    padding: '6px 0',
                    background: 'none',
                    border: '1px solid var(--stroke)',
                    borderRadius: 6,
                    fontSize: 11,
                    fontFamily: 'var(--font)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  Disconnect from grid
                </button>
              </div>
            )}
          </>
        )}

        {/* Text object */}
        {!isMultiSelect && selectedObj !== null && isText && selectedId !== null && (
          <>
            <TextSection
              textObj={selectedObj as TextObject}
              selectedId={selectedId}
              textEditingId={textEditingId}
              textSelection={textSelection}
              onStartDrag={startDrag}
              onUpdate={updateObject}
              onCommit={commitUpdate}
            />
            <div style={{ padding: '0 12px' }}>
              <EffectsSection
                effects={(selectedObj as TextObject).effects}
                onUpdate={(fx) => updateObject(selectedId, { effects: fx })}
                onCommit={(fx) => commitUpdate(selectedId, { effects: fx })}
              />
            </div>
          </>
        )}

        {/* Shape object */}
        {!isMultiSelect && selectedObj !== null && isShape && (() => {
          const shapeObj = selectedObj as ShapeObject
          return (
            <div style={{ padding: '12px 12px 0' }}>
              {/* Rotation slider + numeric input */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <label style={{ color: '#555555', fontSize: 12, width: 64, flexShrink: 0 }}>Rotation</label>
                <input
                  type="range" min={-360} max={360} step={1}
                  value={Math.round(shapeObj.rotation ?? 0)}
                  onChange={e => {
                    const newRot = Number(e.target.value)
                    if (shapeObj.kind === 'ellipse') {
                      commitUpdate(shapeObj.id, { rotation: newRot })
                    } else {
                      commitUpdate(shapeObj.id, rotateAroundCenter(
                        shapeObj.x, shapeObj.y, shapeObj.width, shapeObj.height,
                        shapeObj.rotation ?? 0, newRot,
                      ))
                    }
                  }}
                  style={{ flex: 1 }}
                />
                <input
                  type="number" min={-360} max={360} step={1}
                  value={Math.round(shapeObj.rotation ?? 0)}
                  onChange={e => {
                    const newRot = Math.max(-360, Math.min(360, Number(e.target.value)))
                    if (shapeObj.kind === 'ellipse') {
                      commitUpdate(shapeObj.id, { rotation: newRot })
                    } else {
                      commitUpdate(shapeObj.id, rotateAroundCenter(
                        shapeObj.x, shapeObj.y, shapeObj.width, shapeObj.height,
                        shapeObj.rotation ?? 0, newRot,
                      ))
                    }
                  }}
                  style={numInputStyle(48)}
                />
              </div>
              {/* Opacity slider + numeric input */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <label style={{ color: '#555555', fontSize: 12, width: 64, flexShrink: 0 }}>Opacity</label>
                <input
                  type="range" min={0} max={100} step={1}
                  value={Math.round((shapeObj.opacity ?? 1) * 100)}
                  onMouseDown={startDrag}
                  onChange={e => patch({ opacity: Number(e.target.value) / 100 })}
                  onMouseUp={e => commitUpdate(shapeObj.id, { opacity: Number((e.target as HTMLInputElement).value) / 100 })}
                  style={{ flex: 1 }}
                />
                <input
                  type="number" min={0} max={100} step={1}
                  value={Math.round((shapeObj.opacity ?? 1) * 100)}
                  onChange={e => {
                    const v = Math.max(0, Math.min(100, Number(e.target.value)))
                    commitUpdate(shapeObj.id, { opacity: v / 100 })
                  }}
                  style={numInputStyle(44)}
                />
              </div>
              <div style={sectionLabelStyle}>Fill</div>
              <ColorInput value={shapeObj.fill || '#000000'} onChange={(color) => { commitUpdate(shapeObj.id, { fill: color }) }} />
              <div style={sectionLabelStyle}>Stroke</div>
              <ColorInput value={shapeObj.stroke || '#000000'} onChange={(color) => { commitUpdate(shapeObj.id, { stroke: color }) }} />
              <NumberField label="Stroke W." value={shapeObj.strokeWidth} min={0} step={0.5} onChange={(val) => { commitUpdate(shapeObj.id, { strokeWidth: val }) }} />
              {shapeObj.kind === 'rect' && (
                <NumberField label="Corner R." value={shapeObj.cornerRadius ?? 0} min={0} onChange={(val) => { commitUpdate(shapeObj.id, { cornerRadius: val }) }} />
              )}
              <EffectsSection
                effects={shapeObj.effects}
                onUpdate={(fx) => updateObject(shapeObj.id, { effects: fx })}
                onCommit={(fx) => commitUpdate(shapeObj.id, { effects: fx })}
              />
            </div>
          )
        })()}

        {/* Path object */}
        {!isMultiSelect && selectedObj !== null && isPath && (() => {
          const pathObj = selectedObj as PathObject
          return (
            <div style={{ padding: '12px 12px 0' }}>
              {pathObj.pathEditMode && (
                <div style={{
                  background: 'rgba(249,70,8,0.08)',
                  border: '1px solid #f94608',
                  borderRadius: 8,
                  padding: '6px 8px',
                  marginBottom: 8,
                  color: '#f94608',
                  fontSize: 11,
                }}>
                  Path edit mode — drag anchors and handles
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <label style={{ color: '#555555', fontSize: 12, width: 64, flexShrink: 0 }}>Opacity</label>
                <input
                  type="range" min={0} max={100} step={1}
                  value={Math.round((pathObj.opacity ?? 1) * 100)}
                  onMouseDown={startDrag}
                  onChange={e => patch({ opacity: Number(e.target.value) / 100 })}
                  onMouseUp={e => commitUpdate(pathObj.id, { opacity: Number((e.target as HTMLInputElement).value) / 100 })}
                  style={{ flex: 1 }}
                />
                <span style={{ minWidth: 32, textAlign: 'right', fontSize: 11, color: '#555555' }}>
                  {Math.round((pathObj.opacity ?? 1) * 100)}%
                </span>
              </div>
              <div style={sectionLabelStyle}>Fill</div>
              <ColorInput
                value={pathObj.fill || '#000000'}
                onChange={(color) => { commitUpdate(pathObj.id, { fill: color }) }}
              />
              <div style={sectionLabelStyle}>Stroke</div>
              <ColorInput
                value={pathObj.stroke || '#000000'}
                onChange={(color) => { commitUpdate(pathObj.id, { stroke: color }) }}
              />
              <NumberField
                label="Stroke W."
                value={pathObj.strokeWidth}
                min={0}
                step={0.5}
                onChange={(val) => { commitUpdate(pathObj.id, { strokeWidth: val }) }}
              />
              <EffectsSection
                effects={pathObj.effects}
                onUpdate={(fx) => updateObject(pathObj.id, { effects: fx })}
                onCommit={(fx) => commitUpdate(pathObj.id, { effects: fx })}
              />
            </div>
          )
        })()}


        {/* Group object (grid) */}
        {!isMultiSelect && selectedObj !== null && isGroup && (() => {
          const group = selectedObj as GroupObject
          if (!group.isGrid) return null
          return (
            <div style={{ padding: '0 16px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Grid
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 32 }}>Gap</span>
                <input
                  type="range"
                  min={0} max={40} step={1}
                  value={group.gridGap ?? 8}
                  onMouseDown={() => startDrag(group.id)}
                  onChange={e => {
                    const newGap = Number(e.target.value)
                    updateObject(group.id, { gridGap: newGap })
                    const template = GRID_TEMPLATES.find(t => t.id === group.gridTemplateId)
                    if (template) {
                      const cells = template.cells(group.width, group.height, newGap)
                      group.childIds.forEach((childId, i) => {
                        const cell = cells[i]
                        if (!cell) return
                        const child = useCanvasStore.getState().objects[childId]
                        if (!child) return
                        updateObject(childId, {
                          frameX: group.x + cell.x, frameY: group.y + cell.y,
                          frameWidth: cell.w, frameHeight: cell.h,
                          x: group.x + cell.x, y: group.y + cell.y,
                          width: cell.w, height: cell.h,
                        } as Partial<CanvasObject>)
                      })
                    }
                  }}
                  onMouseUp={() => commitUpdate(group.id, {})}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 24, textAlign: 'right' }}>
                  {group.gridGap ?? 8}
                </span>
              </div>
            </div>
          )
        })()}

        {/* Image object */}
        {!isMultiSelect && selectedObj !== null && isImage && (() => {
          const imgObj = selectedObj as ImageObject
          const isContentMode = imgObj.contentEditMode === true

          if (!isContentMode) {
            // FRAME MODE
            return (
              <div style={{ padding: '12px 12px 0' }}>
                {/* Rotation slider + numeric input */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <label style={{ color: '#555555', fontSize: 12, width: 64, flexShrink: 0 }}>Rotation</label>
                  <input
                    type="range" min={-360} max={360} step={1}
                    value={Math.round(imgObj.rotation ?? 0)}
                    onChange={e => {
                      const newRot = Number(e.target.value)
                      const { x: fx, y: fy, rotation } = rotateAroundCenter(
                        imgObj.frameX, imgObj.frameY, imgObj.frameWidth, imgObj.frameHeight,
                        imgObj.rotation ?? 0, newRot,
                      )
                      commitUpdate(imgObj.id, { rotation, frameX: fx, frameY: fy, x: fx, y: fy })
                    }}
                    style={{ flex: 1 }}
                  />
                  <input
                    type="number" min={-360} max={360} step={1}
                    value={Math.round(imgObj.rotation ?? 0)}
                    onChange={e => {
                      const newRot = Math.max(-360, Math.min(360, Number(e.target.value)))
                      const { x: fx, y: fy, rotation } = rotateAroundCenter(
                        imgObj.frameX, imgObj.frameY, imgObj.frameWidth, imgObj.frameHeight,
                        imgObj.rotation ?? 0, newRot,
                      )
                      commitUpdate(imgObj.id, { rotation, frameX: fx, frameY: fy, x: fx, y: fy })
                    }}
                    style={numInputStyle(48)}
                  />
                </div>
                {/* Opacity slider + numeric input */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <label style={{ color: '#555555', fontSize: 12, width: 64, flexShrink: 0 }}>Opacity</label>
                  <input
                    type="range" min={0} max={100} step={1}
                    value={Math.round((imgObj.opacity ?? 1) * 100)}
                    onMouseDown={startDrag}
                    onChange={e => patch({ opacity: Number(e.target.value) / 100 })}
                    onMouseUp={e => commitUpdate(imgObj.id, { opacity: Number((e.target as HTMLInputElement).value) / 100 })}
                    style={{ flex: 1 }}
                  />
                  <input
                    type="number" min={0} max={100} step={1}
                    value={Math.round((imgObj.opacity ?? 1) * 100)}
                    onChange={e => {
                      const v = Math.max(0, Math.min(100, Number(e.target.value)))
                      commitUpdate(imgObj.id, { opacity: v / 100 })
                    }}
                    style={numInputStyle(44)}
                  />
                </div>
                {(imgObj as ImageObject).isEmpty && (
                  <div style={{ padding: '4px 0 8px', color: 'var(--text-muted)', fontSize: 12, fontStyle: 'italic' }}>
                    No media — click + to add
                  </div>
                )}
                {imgObj.parentGroupId && (
                  <div style={{ marginTop: 8, marginBottom: 4 }}>
                    <button
                      onClick={() => useCanvasStore.getState().disconnectGridCell(imgObj.id)}
                      style={{
                        width: '100%',
                        padding: '6px 0',
                        background: 'none',
                        border: '1px solid var(--stroke)',
                        borderRadius: 6,
                        fontSize: 11,
                        fontFamily: 'var(--font)',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      Disconnect from grid
                    </button>
                  </div>
                )}
                <div style={{ color: '#555555', fontSize: 11, marginTop: 8, marginBottom: 8 }}>
                  Double-click image to edit content
                </div>

                {/* Mask section */}
                <div style={{ borderTop: '1px solid #e8e0d5', paddingTop: 10, marginTop: 4, marginBottom: 10 }}>
                  <div style={{ color: '#555555', fontSize: 9, fontWeight: 700, letterSpacing: '1.5px',
                    textTransform: 'uppercase' as const, fontFamily: 'var(--font)', marginBottom: 8 }}>Mask</div>

                  {imgObj.maskEditMode ? (
                    /* Mask edit mode active banner */
                    <div style={{
                      background: 'rgba(82,183,136,0.1)',
                      border: '1px solid #52b788',
                      borderRadius: 8,
                      padding: '6px 10px',
                      marginBottom: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}>
                      <span style={{ color: '#2d6a4f', fontSize: 11 }}>Editing mask path</span>
                      <button
                        onClick={() => {
                          if (selectedId) commitUpdate(selectedId, { maskEditMode: false })
                        }}
                        style={{
                          background: '#2d6a4f',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 999,
                          padding: '2px 8px',
                          cursor: 'pointer',
                          fontSize: 11,
                        }}
                      >
                        Done
                      </button>
                    </div>
                  ) : imgObj.mask == null ? (
                    /* No mask — draw mode picker or active draw banner */
                    maskDrawMode?.id === selectedId ? (
                      /* Draw in progress for this image */
                      <div>
                        <div style={{ color: '#f94608', fontSize: 11, marginBottom: 8 }}>
                          Drawing {maskDrawMode.tool} mask —{' '}
                          {maskDrawMode.tool === 'pen'
                            ? 'click to add points, close path to finish'
                            : 'drag to define shape'}
                        </div>
                        <button
                          onClick={() => clearMaskDrawMode()}
                          style={{
                            width: '100%',
                            height: 28,
                            background: 'rgba(249,70,8,0.08)',
                            color: '#f94608',
                            border: '1px solid #f94608',
                            borderRadius: 999,
                            cursor: 'pointer',
                            fontSize: 12,
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      /* Tool picker — icon-only buttons */
                      <div>
                        <div style={{ color: '#555555', fontSize: 11, marginBottom: 6 }}>Add mask:</div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Tooltip label="Pen mask">
                            <button
                              title="Pen mask"
                              onClick={() => { if (selectedId) enterMaskDrawMode(selectedId, 'pen') }}
                              style={iconBtnStyle()}
                            >
                              <PenTool size={14} />
                            </button>
                          </Tooltip>
                          <Tooltip label="Rectangle mask">
                            <button
                              title="Rectangle mask"
                              onClick={() => { if (selectedId) enterMaskDrawMode(selectedId, 'rect') }}
                              style={iconBtnStyle()}
                            >
                              <Square size={14} />
                            </button>
                          </Tooltip>
                          <Tooltip label="Oval mask">
                            <button
                              title="Oval mask"
                              onClick={() => { if (selectedId) enterMaskDrawMode(selectedId, 'ellipse') }}
                              style={iconBtnStyle()}
                            >
                              <Circle size={14} />
                            </button>
                          </Tooltip>
                        </div>
                      </div>
                    )
                  ) : (
                    /* Mask controls */
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        {thumbnails[`${selectedId}__mask`] != null && (
                          <div style={{
                            width: 36, height: 36, flexShrink: 0, borderRadius: 6,
                            overflow: 'hidden', border: '1px solid #d4ccc2', background: '#f5ede2',
                          }}>
                            <img
                              src={thumbnails[`${selectedId}__mask`]}
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                              alt="mask"
                              draggable={false}
                            />
                          </div>
                        )}
                        <Tooltip label="Edit mask">
                          <button
                            title="Edit mask"
                            onClick={() => { if (selectedId) enterMaskEditMode(selectedId) }}
                            style={{ ...iconBtnStyle(), flex: 1, width: 'auto' }}
                          >
                            <Pencil size={14} />
                          </button>
                        </Tooltip>
                        <Tooltip label={imgObj.mask.visible ? 'Hide mask' : 'Show mask'}>
                          <button
                            title={imgObj.mask.visible ? 'Hide mask' : 'Show mask'}
                            onClick={() => {
                              if (selectedId) commitUpdate(selectedId, { mask: { ...imgObj.mask!, visible: !imgObj.mask!.visible } })
                            }}
                            style={iconBtnStyle()}
                          >
                            {imgObj.mask.visible
                              ? <Eye size={14} />
                              : <EyeOff size={14} />}
                          </button>
                        </Tooltip>
                        <Tooltip label="Delete mask">
                          <button
                            title="Delete mask"
                            onClick={() => {
                              if (selectedId) commitUpdate(selectedId, { mask: undefined })
                            }}
                            style={iconBtnStyle()}
                          >
                            <Trash2 size={14} />
                          </button>
                        </Tooltip>
                      </div>

                      {/* Feather */}
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                        <label style={{ color: '#555555', fontSize: 12, width: 64, flexShrink: 0 }}>Feather</label>
                        <input
                          type="range"
                          min={0}
                          max={50}
                          step={1}
                          value={imgObj.mask.feather}
                          onMouseDown={startDrag}
                          onChange={(e) => {
                            if (!selectedId) return
                            updateObject(selectedId, { mask: { ...imgObj.mask!, feather: Number(e.target.value) } })
                          }}
                          onMouseUp={(e) => {
                            if (!selectedId) return
                            commitUpdate(selectedId, { mask: { ...imgObj.mask!, feather: Number((e.target as HTMLInputElement).value) } })
                          }}
                          style={{ flex: 1 }}
                        />
                        <span style={{ color: '#111111', fontSize: 12, width: 24, textAlign: 'right' }}>
                          {imgObj.mask.feather}
                        </span>
                      </div>

                      {/* Invert */}
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                        <label style={{ color: '#555555', fontSize: 12, width: 64, flexShrink: 0 }}>Invert</label>
                        <input
                          type="checkbox"
                          checked={imgObj.mask.inverted}
                          onChange={() => {
                            if (selectedId) commitUpdate(selectedId, { mask: { ...imgObj.mask!, inverted: !imgObj.mask!.inverted } })
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>
                {!(imgObj as ImageObject).isEmpty && (
                  <>
                    <AdjustmentsSection
                      imgObj={imgObj}
                      selectedId={selectedId!}
                      bypass={adjustmentsBypass}
                      onToggleBypass={toggleAdjustmentsBypass}
                      onStartDrag={startDrag}
                      onUpdate={(adj) => updateObject(selectedId!, { adjustments: adj })}
                      onCommit={(adj) => commitUpdate(selectedId!, { adjustments: adj })}
                    />
                    <EffectsSection
                      effects={imgObj.effects}
                      onUpdate={(fx) => updateObject(selectedId!, { effects: fx })}
                      onCommit={(fx) => commitUpdate(selectedId!, { effects: fx })}
                    />
                  </>
                )}
              </div>
            )
          }

          // CONTENT EDIT MODE
          return (
            <div style={{ padding: '12px 12px 0' }}>
              {/* Orange banner — full bleed */}
              <div style={{
                marginLeft: -12,
                marginRight: -12,
                marginTop: -12,
                marginBottom: 12,
                padding: '6px 12px',
                background: '#ff7043',
                color: '#fff',
                fontSize: 12,
                fontWeight: 'bold',
              }}>
                Content Edit Mode
              </div>

              <div style={{ color: '#555555', fontSize: 9, fontWeight: 700, letterSpacing: '1.5px',
                textTransform: 'uppercase' as const, fontFamily: 'var(--font)', marginBottom: 6 }}>Content</div>
              <NumberField
                label="Offset X"
                value={imgObj.contentOffsetX}
                onChange={(val) => patch({ contentOffsetX: val })}
              />
              <NumberField
                label="Offset Y"
                value={imgObj.contentOffsetY}
                onChange={(val) => patch({ contentOffsetY: val })}
              />
              <NumberField
                label="Width"
                value={imgObj.contentWidth}
                min={1}
                onChange={(val) => patch({ contentWidth: val })}
              />
              <NumberField
                label="Height"
                value={imgObj.contentHeight}
                min={1}
                onChange={(val) => patch({ contentHeight: val })}
              />

              <Tooltip label="Reset aspect ratio">
                <button
                  onClick={() => {
                    if (!selectedId || !imgObj.naturalWidth || !imgObj.naturalHeight) return
                    const aspect = imgObj.naturalWidth / imgObj.naturalHeight
                    commitUpdate(selectedId, { contentHeight: Math.round(imgObj.contentWidth / aspect) })
                  }}
                  style={{
                    width: '100%', height: 30,
                    background: '#ffffff', color: '#555555',
                    border: '1px solid #d4ccc2', borderRadius: 999,
                    cursor: 'pointer', fontSize: 12, marginBottom: 6,
                  }}
                >
                  Reset Aspect Ratio
                </button>
              </Tooltip>

              <Tooltip label="Fit frame to content">
                <button
                  onClick={() => {
                    if (!selectedId) return
                    const theta = imgObj.rotation * (Math.PI / 180)
                    const cosTheta = Math.cos(theta)
                    const sinTheta = Math.sin(theta)
                    const newFrameX =
                      imgObj.frameX +
                      imgObj.contentOffsetX * cosTheta -
                      imgObj.contentOffsetY * sinTheta
                    const newFrameY =
                      imgObj.frameY +
                      imgObj.contentOffsetX * sinTheta +
                      imgObj.contentOffsetY * cosTheta
                    commitUpdate(selectedId, {
                      frameX: newFrameX,
                      frameY: newFrameY,
                      x: newFrameX,
                      y: newFrameY,
                      frameWidth: imgObj.contentWidth,
                      frameHeight: imgObj.contentHeight,
                      width: imgObj.contentWidth,
                      height: imgObj.contentHeight,
                      contentOffsetX: 0,
                      contentOffsetY: 0,
                    })
                  }}
                  style={{
                    width: '100%',
                    height: 30,
                    background: '#ffffff',
                    color: '#555555',
                    border: '1px solid #d4ccc2',
                    borderRadius: 999,
                    cursor: 'pointer',
                    fontSize: 12,
                    marginBottom: 6,
                  }}
                >
                  Fit frame to content
                </button>
              </Tooltip>

              <Tooltip label="Fill frame with content">
                <button
                  onClick={() => {
                    const scale = Math.max(
                      imgObj.frameWidth / imgObj.contentWidth,
                      imgObj.frameHeight / imgObj.contentHeight
                    )
                    const newW = imgObj.contentWidth * scale
                    const newH = imgObj.contentHeight * scale
                    patch({
                      contentWidth: newW,
                      contentHeight: newH,
                      contentOffsetX: (imgObj.frameWidth - newW) / 2,
                      contentOffsetY: (imgObj.frameHeight - newH) / 2,
                    })
                  }}
                  style={{
                    width: '100%',
                    height: 30,
                    background: '#ffffff',
                    color: '#555555',
                    border: '1px solid #d4ccc2',
                    borderRadius: 999,
                    cursor: 'pointer',
                    fontSize: 12,
                    marginBottom: 6,
                  }}
                >
                  Fill frame with content
                </button>
              </Tooltip>

              <div style={{ color: '#aaaaaa', fontSize: 11, marginTop: 8, marginBottom: 8 }}>
                Click outside to exit content mode
              </div>
            </div>
          )
        })()}

        {/* Spacer pushes AI Tools to bottom */}
        <div style={{ flex: 1 }} />

        {/* AI Tools section — only when an image is selected (not multi-select) */}
        {!isMultiSelect && isImage && selectedObj !== null && (
          <div
            style={{
              padding: 12,
              borderTop: '1px solid #e8e0d5',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                color: '#555555',
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                fontFamily: 'var(--font)',
                marginBottom: 8,
              }}
            >
              AI Tools
            </div>
            {activeBgOp?.status === 'running' && (
              <div style={{ background: '#f5ede2', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ color: '#555555', fontSize: 12, marginBottom: 6 }}>
                  Removing background… {activeBgOp.progress}%
                </div>
                <div style={{ background: '#e8e0d5', borderRadius: 3, height: 6, overflow: 'hidden' }}>
                  <div
                    style={{
                      background: '#f94608',
                      width: `${activeBgOp.progress}%`,
                      height: '100%',
                      transition: 'width 0.2s',
                    }}
                  />
                </div>
              </div>
            )}
            {activeBgOp?.status === 'done' && (
              <div style={{ color: '#4f4', fontSize: 13 }}>Background removed</div>
            )}
            {activeBgOp?.status === 'error' && (
              <div style={{ color: '#f44', fontSize: 12 }}>{activeBgOp.error}</div>
            )}
            {(!activeBgOp || activeBgOp.status === 'idle') && (
              <Tooltip label="Remove background" description="AI-powered, runs on device">
                <button
                  onClick={handleRemoveBg}
                  style={{
                    width: '100%',
                    height: 32,
                    background: '#f94608',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 999,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 'bold',
                  }}
                >
                  Remove BG
                </button>
              </Tooltip>
            )}
          </div>
        )}

        {/* External Editor section — images only */}
        {!isMultiSelect && isImage && selectedId !== null && (
          <div
            style={{
              padding: 12,
              borderTop: '1px solid #e8e0d5',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                color: '#555555',
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                fontFamily: 'var(--font)',
                marginBottom: 8,
              }}
            >
              External Editor
            </div>
            <div style={{ color: '#aaaaaa', fontSize: 11, marginBottom: 6 }}>
              {externalEditor ? `Default: ${externalEditor.name}` : 'No default editor set'}
            </div>
            {activeObjectId === selectedId ? (
              <>
                <div style={{ color: '#2d6a4f', fontSize: 12, marginBottom: 6 }}>
                  Watching for changes…
                </div>
                <Tooltip label="Stop watching">
                  <button
                    onClick={() => { void stopEditing(selectedId) }}
                    style={{
                      width: '100%',
                      height: 28,
                      background: '#ffffff',
                      color: '#555555',
                      border: '1px solid #d4ccc2',
                      borderRadius: 999,
                      cursor: 'pointer',
                      fontSize: 12,
                    }}
                  >
                    Stop Watching
                  </button>
                </Tooltip>
              </>
            ) : (
              <div style={{ display: 'flex', gap: 6 }}>
                <Tooltip label="Edit externally">
                  <button
                    onClick={() => { void editExternally(selectedId, effectiveFilePath) }}
                    style={{
                      flex: 1,
                      height: 32,
                      background: '#f94608',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 999,
                      cursor: 'pointer',
                      fontSize: 13,
                    }}
                  >
                    {externalEditor != null ? `Edit in ${externalEditor.name}` : 'Edit Externally'}
                  </button>
                </Tooltip>
                {externalEditor != null && (
                  <Tooltip label="Change editor">
                    <button
                      onClick={() => { void pickNewEditor() }}
                      style={{
                        height: 32,
                        padding: '0 10px',
                        background: '#ffffff',
                        color: '#555555',
                        border: '1px solid #d4ccc2',
                        borderRadius: 999,
                        cursor: 'pointer',
                        fontSize: 11,
                      }}
                    >
                      Change
                    </button>
                  </Tooltip>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
