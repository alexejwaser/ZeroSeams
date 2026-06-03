import type React from 'react'

export function iconBtnStyle(active = false, disabled = false): React.CSSProperties {
  return {
    width: 30,
    height: 30,
    background: active ? '#f94608' : '#ffffff',
    color: active ? '#ffffff' : '#555555',
    border: active ? 'none' : '1px solid #d4ccc2',
    borderRadius: 999,
    cursor: disabled ? 'default' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: disabled ? 0.35 : 1,
    transition: 'background 0.15s',
  }
}
