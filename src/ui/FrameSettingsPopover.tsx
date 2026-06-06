import React, { useEffect, useRef, useState } from 'react'
import { useCanvasStore, PLATFORM_PRESETS } from '@/canvas/useCanvasStore'
import type { FrameRatio, Platform } from '@/types/project'
import { ColorInput } from './ColorInput'
import { NumericInput } from './NumericInput'

interface FrameSettingsPopoverProps {
  onClose: () => void
}

const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  threads: 'Threads',
  custom: 'Custom',
}

const PLATFORMS: Platform[] = ['instagram', 'tiktok', 'facebook', 'threads', 'custom']

function segmentButtonStyle(active: boolean): React.CSSProperties {
  return {
    padding: '3px 10px',
    height: 24,
    background: active ? '#f94608' : '#ffffff',
    color: active ? '#ffffff' : '#555555',
    border: active ? 'none' : '1px solid #d4ccc2',
    borderRadius: 999,
    cursor: 'pointer',
    fontSize: 12,
    fontFamily: 'var(--font)',
    fontWeight: active ? 'bold' : 'normal',
    transition: 'background 0.15s, color 0.15s',
    whiteSpace: 'nowrap' as const,
  }
}


const labelStyle: React.CSSProperties = {
  color: '#555555',
  fontSize: 11,
  fontFamily: 'var(--font)',
  fontWeight: 'bold',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  marginBottom: 6,
  marginTop: 12,
}

export function FrameSettingsPopover({ onClose }: FrameSettingsPopoverProps): React.ReactElement {
  const platform = useCanvasStore((s) => s.platform)
  const setPlatform = useCanvasStore((s) => s.setPlatform)
  const ratio = useCanvasStore((s) => s.ratio)
  const setRatio = useCanvasStore((s) => s.setRatio)
  const frameWidth = useCanvasStore((s) => s.frameWidth)
  const frameHeight = useCanvasStore((s) => s.frameHeight)
  const backgroundColor = useCanvasStore((s) => s.backgroundColor)
  const setCanvasBackground = useCanvasStore((s) => s.setCanvasBackground)

  const [customW, setCustomW] = useState(frameWidth)
  const [customH, setCustomH] = useState(frameHeight)

  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setCustomW(frameWidth)
    setCustomH(frameHeight)
  }, [frameWidth, frameHeight])

  useEffect(() => {
    function handleMouseDown(e: MouseEvent): void {
      if (popoverRef.current != null && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => { document.removeEventListener('mousedown', handleMouseDown) }
  }, [onClose])

  const presets = PLATFORM_PRESETS[platform]

  return (
    <div
      ref={popoverRef}
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        zIndex: 1000,
        marginTop: 6,
        background: '#ffffff',
        border: '1px solid #e8e0d5',
        borderRadius: 16,
        padding: 16,
        boxShadow: '0 8px 28px rgba(0,0,0,0.13)',
        minWidth: 240,
      }}
    >
      <div style={{ ...labelStyle, marginTop: 0 }}>Platform</div>
      <select
        value={platform}
        onChange={(e) => { setPlatform(e.target.value as Platform) }}
        style={{
          width: '100%',
          height: 28,
          background: '#ffffff',
          color: '#111111',
          border: '1px solid #d4ccc2',
          borderRadius: 6,
          fontSize: 12,
          fontFamily: 'var(--font)',
          padding: '0 6px',
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        {PLATFORMS.map((p) => (
          <option key={p} value={p}>
            {PLATFORM_LABELS[p]}
          </option>
        ))}
      </select>

      <div style={labelStyle}>Ratio</div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          background: '#ffffff',
          borderRadius: 999,
          padding: '2px',
          border: '1px solid #d4ccc2',
        }}
      >
        {presets.map((preset) => (
          <button
            key={preset.ratio}
            onClick={() => { setRatio(preset.ratio as FrameRatio, preset.width, preset.height) }}
            style={segmentButtonStyle(ratio === preset.ratio)}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 11, color: '#aaaaaa', fontFamily: 'var(--font)', marginTop: 5 }}>
        {frameWidth} × {frameHeight} px
      </div>

      {platform === 'custom' && (
        <>
          <div style={labelStyle}>Dimensions</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <NumericInput
              value={customW}
              min={100} max={8000}
              width={56} align="center"
              onChange={setCustomW}
              onCommit={w => {
                setCustomW(w)
                setRatio('custom', w, customH)
              }}
            />
            <span style={{ color: '#aaaaaa', fontSize: 12 }}>×</span>
            <NumericInput
              value={customH}
              min={100} max={8000}
              width={56} align="center"
              onChange={setCustomH}
              onCommit={h => {
                setCustomH(h)
                setRatio('custom', customW, h)
              }}
            />
          </div>
        </>
      )}

      <div style={{ height: 1, background: '#e8e0d5', margin: '12px 0 0' }} />

      <div style={{ ...labelStyle, marginTop: 12 }}>Background</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <ColorInput value={backgroundColor} onChange={setCanvasBackground} />
      </div>
    </div>
  )
}
