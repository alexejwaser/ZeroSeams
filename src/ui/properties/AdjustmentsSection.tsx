import React from 'react'
import type { PhotoAdjustments } from '@/types/canvas'
import { DEFAULT_ADJUSTMENTS } from '@/types/canvas'
import Tooltip from '../Tooltip'
import { iconBtnStyle } from '../iconBtnStyle'
import { Power } from 'lucide-react'
import '../adjustments.css'
import { NumericInput } from '../NumericInput'

import { sectionLabelStyle } from './shared'


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

export function AdjustmentsSection({ imgObj, selectedId: _selectedId, bypass, onToggleBypass, onStartDrag, onUpdate, onCommit }: AdjustmentsSectionProps): React.ReactElement {
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
        <NumericInput
          value={value}
          decimals={decimals}
          min={min} max={max}
          width={44}
          onCommit={v => onCommit({ ...adj, [key]: v })}
          onDoubleClick={() => onCommit({ ...adj, [key]: 0 })}
        />
      </div>
    )
  }

  return (
    <div style={{ borderTop: '1px solid #e8e0d5', paddingTop: 10, marginTop: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ ...sectionLabelStyle, marginBottom: 0 }}>Adjustments</div>
        <Tooltip label={bypass ? 'Show adjustments' : 'Bypass adjustments'} shortcut="\">
          <button
            style={{ ...iconBtnStyle(!bypass), width: 22, height: 22 }}
            onClick={onToggleBypass}
          >
            <Power size={12} />
          </button>
        </Tooltip>
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

