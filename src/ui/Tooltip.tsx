import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
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
  // Set when the trigger sits too low for the pill to fit below it.
  const [flipAbove, setFlipAbove] = useState(false)

  const triggerRef = useRef<HTMLElement>(null)
  const pillRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // `visible` is also read from the unmount cleanup, which closes over the
  // first render's value — the ref is what that path can trust.
  const visibleRef = useRef(false)
  const pillId = useId()

  function show(): void {
    if (triggerRef.current == null) return
    const rect = triggerRef.current.getBoundingClientRect()
    setAnchorPos({
      top: rect.bottom + 6,
      left: rect.left + rect.width / 2,
    })
    setClampedLeft(null)
    setFlipAbove(false)
    setVisible(true)
    if (!visibleRef.current) {
      visibleRef.current = true
      activeTooltipCount += 1
    }
  }

  function hide(): void {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (visibleRef.current) {
      visibleRef.current = false
      activeTooltipCount = Math.max(0, activeTooltipCount - 1)
    }
    setVisible(false)
    setAnchorPos(null)
    setClampedLeft(null)
    setFlipAbove(false)
  }

  // Toolbar and panel buttons swap out on selection changes, so a trigger can
  // unmount mid-hover. Without this the pending timer fires into a dead
  // component and, worse, the instance's increment is never returned —
  // activeTooltipCount ratchets up and every tooltip in the app loses its
  // 400ms delay for the rest of the session.
  useEffect(() => {
    return () => {
      if (timerRef.current != null) clearTimeout(timerRef.current)
      if (visibleRef.current) {
        visibleRef.current = false
        activeTooltipCount = Math.max(0, activeTooltipCount - 1)
      }
    }
  }, [])

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
    if (!visible || anchorPos == null || pillRef.current == null || triggerRef.current == null) {
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
    // The panels run to the bottom of the window, so their last controls had
    // their tooltips rendered off-screen entirely. Flip above the trigger.
    if (anchorPos.top + pillRef.current.offsetHeight > window.innerHeight - 8) {
      setFlipAbove(true)
    }
  }, [visible, anchorPos])

  // Almost every trigger in the app is an icon-only button, so the tooltip text
  // is the only name it has. Supply it as the accessible name unless the child
  // already carries one, and point at the live pill when it is up.
  const childProps = children.props as Record<string, unknown>
  const hasOwnName =
    childProps['aria-label'] != null || childProps['aria-labelledby'] != null

  const child = React.cloneElement(children, {
    ref: triggerRef,
    ...(hasOwnName ? {} : { 'aria-label': label }),
    ...(visible ? { 'aria-describedby': pillId } : {}),
    onMouseEnter: (e: React.MouseEvent) => {
      handleMouseEnter()
      children.props.onMouseEnter?.(e)
    },
    onMouseLeave: (e: React.MouseEvent) => {
      handleMouseLeave()
      children.props.onMouseLeave?.(e)
    },
    onMouseDown: (e: React.MouseEvent) => {
      handleMouseDown()
      children.props.onMouseDown?.(e)
    },
    // Keyboard access: focused controls reveal their tooltip (and shortcut)
    onFocus: (e: React.FocusEvent) => {
      show()
      children.props.onFocus?.(e)
    },
    onBlur: (e: React.FocusEvent) => {
      hide()
      children.props.onBlur?.(e)
    },
  })

  if (!visible || anchorPos == null) {
    return child
  }

  const left = clampedLeft != null ? clampedLeft : anchorPos.left
  const hasDescription = description != null && description !== ''

  const pill = (
    <div
      ref={pillRef}
      id={pillId}
      role="tooltip"
      style={{
        position: 'fixed',
        top: anchorPos.top,
        left,
        // Flipping shifts the pill a full height up plus the 6px gap it was
        // rendered with, landing it the same distance above the trigger.
        transform: flipAbove
          ? 'translateX(-50%) translateY(calc(-100% - 12px))'
          : 'translateX(-50%)',
        zIndex: 10000,
        pointerEvents: 'none',
        background: 'var(--bg-inverse)',
        color: 'var(--text-inverse)',
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
          <span style={{ color: 'var(--text-inverse-muted)', marginLeft: 6 }}>{shortcut}</span>
        )}
      </div>
      {hasDescription && (
        <div
          style={{
            color: 'var(--text-inverse-muted)',
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
