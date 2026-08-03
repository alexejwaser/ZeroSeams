import React, { useState, useEffect, useRef } from 'react'

const MAC_SYSTEM_FONTS = [
  'American Typewriter', 'Andale Mono', 'Arial', 'Arial Black', 'Arial Narrow',
  'Arial Rounded MT Bold', 'Arial Unicode MS', 'Avenir', 'Avenir Next',
  'Avenir Next Condensed', 'Baskerville', 'Big Caslon', 'Bodoni 72',
  'Bodoni 72 Oldstyle', 'Bodoni 72 Smallcaps', 'Bradley Hand',
  'Brush Script MT', 'Chalkboard', 'Chalkboard SE', 'Chalkduster',
  'Charter', 'Cochin', 'Comic Sans MS', 'Copperplate', 'Courier',
  'Courier New', 'DIN Alternate', 'DIN Condensed', 'Damascus',
  'DejaVu Sans', 'DejaVu Sans Mono', 'DejaVu Serif', 'Didot',
  'Futura', 'Geneva', 'Georgia', 'Gill Sans', 'Helvetica',
  'Helvetica Neue', 'Herculanum', 'Hoefler Text', 'Impact',
  'Lucida Grande', 'Marker Felt', 'Menlo', 'Monaco', 'Noteworthy',
  'Optima', 'Palatino', 'Papyrus', 'Phosphate', 'PT Mono',
  'PT Sans', 'PT Sans Caption', 'PT Sans Narrow', 'PT Serif',
  'PT Serif Caption', 'Rockwell', 'SF Mono', 'SF Pro Display',
  'SF Pro Text', 'Savoye LET', 'SignPainter', 'Skia', 'Snell Roundhand',
  'Superclarendon', 'Symbol', 'Tahoma', 'Times New Roman', 'Trattatello',
  'Trebuchet MS', 'Verdana', 'Webdings', 'Wingdings', 'Wingdings 2',
  'Wingdings 3', 'Zapf Dingbats', 'Zapfino',
]

export function FontPicker({
  value,
  onChange,
}: {
  value: string | undefined
  onChange: (family: string) => void
}): React.ReactElement {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [fonts, setFonts] = useState<string[]>([])
  const [highlightIdx, setHighlightIdx] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Enumerate system fonts via Electron IPC (app.getSystemFonts)
  useEffect(() => {
    window.electronAPI.getSystemFonts()
      .then((families: string[]) => {
        if (families && families.length > 10) {
          const sorted = [...new Set(families)].sort((a, b) => a.localeCompare(b))
          setFonts(sorted)
        } else {
          setFonts(MAC_SYSTEM_FONTS)
        }
      })
      .catch(() => {
        setFonts(MAC_SYSTEM_FONTS)
      })
  }, [])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 0)
      setHighlightIdx(0)
    }
  }, [open])

  const filtered = search
    ? fonts.filter((f) => f.toLowerCase().includes(search.toLowerCase()))
    : fonts

  // Scroll highlighted item into view
  useEffect(() => {
    if (!listRef.current) return
    const item = listRef.current.children[highlightIdx] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [highlightIdx])

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[highlightIdx]) {
        onChange(filtered[highlightIdx])
        setOpen(false)
        setSearch('')
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
      setSearch('')
    }
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>): void {
    setSearch(e.target.value)
    setHighlightIdx(0)
  }

  const displayValue = value ?? '—'

  return (
    <div ref={containerRef} style={{ position: 'relative', flex: 1 }}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          background: 'var(--bg-surface)',
          border: '1px solid var(--stroke)',
          borderRadius: 6,
          color: value ? 'var(--text-primary)' : 'var(--text-tertiary)',
          fontSize: 13,
          padding: '3px 8px',
          textAlign: 'left',
          cursor: 'pointer',
          fontFamily: value ?? 'inherit',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          boxSizing: 'border-box',
        }}
      >
        {displayValue}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 1000,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: 260,
          }}
          onKeyDown={handleKeyDown}
        >
          {/* Search input */}
          <input
            ref={searchRef}
            value={search}
            onChange={handleSearchChange}
            placeholder="Search fonts…"
            style={{
              background: 'var(--bg-panel)',
              border: 'none',
              borderBottom: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontSize: 12,
              padding: '6px 8px',
              flexShrink: 0,
            }}
          />

          {/* Font list */}
          <div
            ref={listRef}
            style={{ overflowY: 'auto', flex: 1 }}
          >
            {filtered.length === 0 && (
              <div style={{ color: 'var(--text-tertiary)', fontSize: 12, padding: '8px 10px' }}>
                No fonts found
              </div>
            )}
            {filtered.map((family, idx) => (
              <div
                key={family}
                onMouseDown={(e) => {
                  e.preventDefault()
                  onChange(family)
                  setOpen(false)
                  setSearch('')
                }}
                onMouseEnter={() => setHighlightIdx(idx)}
                style={{
                  padding: '5px 10px',
                  cursor: 'pointer',
                  background: idx === highlightIdx ? 'var(--bg-panel)' : family === value ? 'var(--accent-tint)' : 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  fontFamily: family,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {family}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
