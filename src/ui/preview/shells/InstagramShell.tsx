import React from 'react'
import { registerShell } from './registry'
import type { PlatformShellProps } from './registry'

function InstagramShell({
  ratio,
  currentFrame,
  totalFrames,
  onFrameChange,
  frameDisplayWidth,
  frameDisplayHeight,
  children,
  profile,
}: PlatformShellProps): React.ReactElement {
  const username = profile?.name ?? 'zeroseams'

  if (ratio === 'story') {
    return (
      <div
        style={{
          position: 'relative',
          width: frameDisplayWidth,
          height: frameDisplayHeight,
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {children}

        {/* Top overlay: progress bars + avatar/username */}
        <div
          style={{
            position: 'absolute',
            inset: '0 0 auto 0',
            height: 40,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.4), transparent)',
            pointerEvents: 'none',
          }}
        >
          {/* Progress segments */}
          <div
            style={{
              display: 'flex',
              gap: 3,
              margin: '8px 12px 0',
            }}
          >
            {Array.from({ length: totalFrames }).map((_, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: 2,
                  borderRadius: 2,
                  background: i <= currentFrame
                    ? 'rgba(255,255,255,0.9)'
                    : 'rgba(255,255,255,0.4)',
                }}
              />
            ))}
          </div>
          {/* Avatar + username */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px 0' }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 9999,
                background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)',
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 13, fontWeight: 'bold', color: '#fff', fontFamily: 'system-ui' }}>
              {username}
            </span>
          </div>
        </div>

        {/* Bottom overlay: send message pill */}
        <div
          style={{
            position: 'absolute',
            inset: 'auto 0 0 0',
            height: 56,
            background: 'linear-gradient(to top, rgba(0,0,0,0.4), transparent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              width: '80%',
              border: '1.5px solid rgba(255,255,255,0.7)',
              borderRadius: 99,
              color: '#fff',
              padding: '8px 16px',
              fontSize: 14,
              opacity: 0.9,
              fontFamily: 'system-ui',
            }}
          >
            Send message
          </div>
        </div>
      </div>
    )
  }

  // Feed layout (square or portrait)
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 0,
        overflow: 'hidden',
        boxShadow: '0 2px 16px rgba(0,0,0,0.3)',
        width: frameDisplayWidth,
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          height: 44,
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          gap: 8,
        }}
      >
        {/* Avatar */}
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 9999,
            background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)',
            flexShrink: 0,
          }}
        />
        {/* Username */}
        <span
          style={{
            fontFamily: '"Montserrat", system-ui, sans-serif',
            fontWeight: 'bold',
            fontSize: 14,
            color: '#000',
            flex: 1,
          }}
        >
          {username}
        </span>
        {/* More icon */}
        <span style={{ fontSize: 18, color: '#262626', letterSpacing: 1 }}>···</span>
      </div>

      {/* Frame image — lineHeight:0 removes the ghost gap below inline-block img */}
      <div style={{ lineHeight: 0, flexShrink: 0, overflow: 'hidden' }}>
        {children}
      </div>

      {/* Action bar */}
      <div
        style={{
          height: 36,
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          gap: 12,
        }}
      >
        <span style={{ fontSize: 24, color: '#262626', cursor: 'pointer', lineHeight: 1 }}>&#9825;</span>
        <span style={{ fontSize: 22, color: '#262626', cursor: 'pointer', lineHeight: 1 }}>&#9993;</span>
        <span style={{ fontSize: 22, color: '#262626', cursor: 'pointer', lineHeight: 1 }}>&#10148;</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 22, color: '#262626', cursor: 'pointer', lineHeight: 1 }}>&#128278;</span>
      </div>

      {/* Dots row */}
      <div
        style={{
          height: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 12px',
          gap: 4,
        }}
      >
        {Array.from({ length: totalFrames }).map((_, i) => (
          <div
            key={i}
            onClick={() => onFrameChange(i)}
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: i === currentFrame ? '#262626' : '#ddd',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          />
        ))}
      </div>

      {/* Caption */}
      <div style={{ padding: '0 12px', fontSize: 14, color: '#262626', lineHeight: 1.4 }}>
        <span style={{ fontWeight: 'bold' }}>{username}</span>
        {' '}
        <span>Your caption goes here&hellip;</span>
      </div>

      {/* Timestamp */}
      <div style={{ padding: '4px 12px 10px', fontSize: 12, color: '#8e8e8e' }}>
        2 hours ago
      </div>
    </div>
  )
}

registerShell('instagram', InstagramShell)

export { InstagramShell }
