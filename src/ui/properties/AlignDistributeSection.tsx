import React from 'react'
import Tooltip from '../Tooltip'

import { sectionLabelStyle, alignButtonStyle, distributeButtonStyle } from './shared'


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

export function AlignDistributeSection({
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

