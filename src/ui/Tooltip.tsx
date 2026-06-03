import React, { useLayoutEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'

interface TooltipProps {
  label: string
  shortcut?: string
  description?: string
  children: React.ReactElement
}

// Shared module-level counter — no context provider needed.
// All Tooltip instances read/write this directly so that switching
// between triggers feels instant (delay = 0) when any tooltip is visible.
let activeTooltipCount = 0

export default function Tooltip({
  label,
  shortcut,
  description,
  children,
}: TooltipProps): JSX.Element {
  // If label is empty, render children unchanged — no tooltip behaviour.
  if (label === '') {
    return children
  }

  return (
    <TooltipInner
      label={label}
      shortcut={shortcut}
      description={description}
    >
      {children}
    </TooltipInner>
  )
}

// Inner implementation extracted so the early-return above doesn't violate
// the rules of hooks (hooks must not be called conditionally).
function TooltipInner({
  label,
  shortcut,
  description,
  children,
}: TooltipProps): JSX.Element {
  const [visible, setVisible] = useState(false)
  const [anchorPos, setAnchorPos] = useState<{ top: number; left: number } | null>(null)

  // Clamped left after measuring the pill width.
  const [clampedLeft, setClampedLeft] = useState<number | null>(null)

  const triggerRef = useRef<HTMLElement>(null)
  const pillRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function show(): void {
    if (triggerRef.current == null) return
    const rect = triggerRef.current.getBoundingClientRect()
    setAnchorPos({
      top: rect.bottom + 6,
      left: rect.left + rect.width / 2,
    })
    setClampedLeft(null)
    setVisible(true)
    activeTooltipCount += 1
  }

  function hide(): void {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (visible) {
      activeTooltipCount = Math.max(0, activeTooltipCount - 1)
    }
    setVisible(false)
    setAnchorPos(null)
    setClampedLeft(null)
  }

  function handleMouseEnter(): void {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current)
    }
    const delay = activeTooltipCount > 0 ? 0 : 400
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      show()
    }, delay)
  }

  function handleMouseLeave(): void {
    hide()
  }

  function handleMouseDown(): void {
    hide()
  }

  // Clamp the pill horizontally after it has been rendered and we can
  // measure its width — mirrors the exact pattern in ContextMenu.tsx.
  useLayoutEffect(() => {
    if (!visible || anchorPos == null || pillRef.current == null) {
      return
    }
    const pillWidth = pillRef.current.offsetWidth
    const rawLeft = anchorPos.left
    const maxLeft = window.innerWidth - 8 - pillWidth / 2
    // anchorPos.left is the centre point; translateX(-50%) shifts the pill
    // so that its centre aligns. We need to ensure right edge stays in view.
    if (rawLeft + pillWidth / 2 > window.innerWidth - 8) {
      setClampedLeft(Math.max(pillWidth / 2 + 8, maxLeft + pillWidth / 2))
    }
  }, [visible, anchorPos])

  const child = React.cloneElement(children, {
    ref: triggerRef,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onMouseDown: handleMouseDown,
  })

  if (!visible || anchorPos == null) {
    return child
  }

  const left = clampedLeft != null ? clampedLeft : anchorPos.left
  const hasDescription = description != null && description !== ''

  const pill = (
    <div
      ref={pillRef}
      style={{
        position: 'fixed',
        top: anchorPos.top,
        left,
        transform: 'translateX(-50%)',
        zIndex: 10000,
        pointerEvents: 'none',
        background: '#111111',
        color: '#ffffff',
        borderRadius: 8,
        padding: '4px 10px',
        fontSize: 12,
        fontFamily: 'var(--font)',
        maxWidth: 220,
        boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
        whiteSpace: hasDescription ? undefined : 'nowrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span>{label}</span>
        {shortcut != null && shortcut !== '' && (
          <span style={{ color: '#999', marginLeft: 6 }}>{shortcut}</span>
        )}
      </div>
      {hasDescription && (
        <div
          style={{
            color: '#aaa',
            fontWeight: 400,
            marginTop: 2,
            whiteSpace: 'normal',
            fontSize: 11,
          }}
        >
          {description}
        </div>
      )}
    </div>
  )

  return (
    <>
      {child}
      {ReactDOM.createPortal(pill, document.body)}
    </>
  )
}
