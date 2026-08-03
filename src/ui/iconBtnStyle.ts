import type React from 'react'

/**
 * Geometry only. Background, text colour, border and every interaction state
 * live in `.zs-icon-btn` in theme.css — call sites spread this object to
 * override width/height/padding, and an inline `background` would win over any
 * `:hover` rule, which is why 32 icon buttons had a transition and no hover.
 *
 * Prefer `iconBtnProps()`; reach for `iconBtnStyle()` directly only when you
 * need to merge extra style keys, and pass the className yourself.
 */
export function iconBtnStyle(_active = false, disabled = false): React.CSSProperties {
  return {
    width: 30,
    height: 30,
    borderRadius: 999,
    cursor: disabled ? 'default' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: disabled ? 0.35 : 1,
  }
}

export interface IconBtnProps {
  className: string
  style: React.CSSProperties
  'data-active'?: string
  'data-disabled'?: string
}

/**
 * Spread onto a `<button>`: `<button {...iconBtnProps(isActive)} …>`.
 * `extraStyle` merges over the geometry — pass it here rather than adding a
 * separate `style=` prop, which would drop the className's states on the floor.
 */
export function iconBtnProps(
  active = false,
  disabled = false,
  extraStyle?: React.CSSProperties,
): IconBtnProps {
  return {
    className: 'zs-icon-btn',
    style: { ...iconBtnStyle(active, disabled), ...extraStyle },
    ...(active ? { 'data-active': '' } : {}),
    ...(disabled ? { 'data-disabled': '' } : {}),
  }
}
