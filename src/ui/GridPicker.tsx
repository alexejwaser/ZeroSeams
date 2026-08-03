import React, { useEffect, useRef, useState } from 'react'
import { GridTemplate, GRID_TEMPLATES } from '@/canvas/gridTemplates'

interface GridPickerProps {
  anchorEl: HTMLElement | null
  onClose: () => void
  onSelect: (template: GridTemplate) => void
}

export function GridPicker({ anchorEl, onClose, onSelect }: GridPickerProps): React.ReactElement | null {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  // Compute position when anchorEl changes
  useEffect(() => {
    if (!anchorEl) {
      setPos(null)
      return
    }
    const rect = anchorEl.getBoundingClientRect()
    const popoverW = 340
    const popoverH = Math.min(680, window.innerHeight - 80) // 6 rows of thumbnails

    let top = rect.bottom + 6
    let left = rect.left

    // Flip above anchor if not enough space below
    if (top + popoverH > window.innerHeight - 8) {
      top = rect.top - popoverH - 6
    }
    // Clamp vertically
    if (top < 8) top = 8

    // Clamp horizontally so it doesn't overflow right edge
    if (left + popoverW > window.innerWidth - 8) {
      left = window.innerWidth - popoverW - 8
    }
    if (left < 8) left = 8

    setPos({ top, left })
  }, [anchorEl])

  // Outside-click to close
  useEffect(() => {
    if (!anchorEl) return
    const anchor = anchorEl
    function handleMouseDown(e: MouseEvent): void {
      if (
        popoverRef.current != null &&
        !popoverRef.current.contains(e.target as Node) &&
        e.target !== anchor &&
        !anchor.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => { document.removeEventListener('mousedown', handleMouseDown) }
  }, [anchorEl, onClose])

  if (!anchorEl || !pos) return null

  return (
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        zIndex: 2000,
        background: 'var(--bg-panel)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
        padding: 12,
        width: 340,
        boxSizing: 'border-box',
        fontFamily: 'var(--font)',
        maxHeight: 'calc(100vh - 80px)',
        overflowY: 'auto',
      }}
    >
      {/* Title */}
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: 10,
          position: 'sticky',
          top: 0,
          background: 'var(--bg-panel)',
          paddingBottom: 4,
        }}
      >
        Grid
      </div>

      {/* 4-column grid of thumbnails */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 8,
        }}
      >
        {GRID_TEMPLATES.map((template) => {
          const isSelected = selectedId === template.id
          // Get cell rects for 64×64 thumbnail (with 2px gap)
          const cells = template.cells(64, 64, 2)

          return (
            <button
              key={template.id}
              onClick={() => {
                setSelectedId(template.id)
                onSelect(template)
                onClose()
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                background: 'none',
                border: `2px solid ${isSelected ? '#f94608' : 'transparent'}`,
                borderRadius: 8,
                padding: 4,
                cursor: 'pointer',
              }}
            >
              {/* SVG thumbnail */}
              <svg
                width={72}
                height={72}
                viewBox="0 0 72 72"
                style={{
                  display: 'block',
                  borderRadius: 4,
                  background: '#ffffff',
                  border: '1px solid #e8e0d5',
                }}
              >
                {/* White background */}
                <rect x={0} y={0} width={72} height={72} fill="#ffffff" />
                {/* Offset cells to be centered in the 72×72 SVG (cells are 64×64, so +4 each axis) */}
                {cells.map((cell, i) => (
                  <rect
                    key={i}
                    x={cell.x + 4}
                    y={cell.y + 4}
                    width={cell.w}
                    height={cell.h}
                    // rx/ry at half the size renders the rect as the ellipse the
                    // template's cellClipShape will actually produce.
                    rx={template.cellClipShape?.kind === 'ellipse' ? cell.w / 2 : undefined}
                    ry={template.cellClipShape?.kind === 'ellipse' ? cell.h / 2 : undefined}
                    fill="#f5ede2"
                    stroke="#d4ccc2"
                    strokeWidth={1}
                  />
                ))}
              </svg>

              {/* Label */}
              <span
                style={{
                  fontSize: 9,
                  color: '#aaaaaa',
                  textAlign: 'center',
                  lineHeight: 1.2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '100%',
                }}
              >
                {template.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
