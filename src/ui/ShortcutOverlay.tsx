import React from 'react'
import { useCanvasStore } from '@/canvas/useCanvasStore'
import { SHORTCUT_GROUPS } from './shortcuts'

/**
 * Keyboard-shortcut cheatsheet. Toggled with `?` (handled in
 * useKeyboardShortcuts) or the HUD help button; closes on Escape, `?`,
 * outside click, or the × button. Rendered at the App root like
 * PreviewShell so it paints above the panels and toolbar.
 */
export function ShortcutOverlay(): React.ReactElement | null {
  const open = useCanvasStore((s) => s.shortcutOverlayOpen)
  const setOpen = useCanvasStore((s) => s.setShortcutOverlayOpen)

  if (!open) return null

  return (
    <div
      onClick={() => { setOpen(false) }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 900,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font)',
      }}
    >
      <div
        onClick={(e) => { e.stopPropagation() }}
        className="panel-scroll"
        style={{
          background: 'var(--bg-base)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          boxShadow: '0 18px 50px rgba(0,0,0,0.25)',
          padding: '20px 26px 26px',
          width: 'min(760px, calc(100vw - 48px))',
          maxHeight: 'calc(100vh - 96px)',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            Keyboard shortcuts
          </span>
          <button
            onClick={() => { setOpen(false) }}
            aria-label="Close"
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
              padding: 4,
            }}
          >
            ×
          </button>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '18px 32px',
          }}
        >
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  color: 'var(--text-tertiary)',
                  marginBottom: 8,
                }}
              >
                {group.title}
              </div>
              {group.entries.map((entry) => (
                <div
                  key={entry.keys + entry.label}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '3px 0' }}
                >
                  <kbd
                    style={{
                      fontFamily: 'var(--font)',
                      fontSize: 11,
                      color: 'var(--text-primary)',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--stroke)',
                      borderBottomWidth: 2,
                      borderRadius: 6,
                      padding: '2px 7px',
                      whiteSpace: 'nowrap',
                      minWidth: 26,
                      textAlign: 'center',
                    }}
                  >
                    {entry.keys}
                  </kbd>
                  <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{entry.label}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
