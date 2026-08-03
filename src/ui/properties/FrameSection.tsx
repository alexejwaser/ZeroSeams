import React from 'react'
import type { CanvasObject, ImageObject, VideoObject, ClipShape } from '@/types/canvas'
import { useCanvasStore } from '@/canvas/useCanvasStore'
import { solidColorOf } from '@/canvas/frameClip'
import { isEmptyFrame, isGridCell as isGridCellObject } from '@/canvas/frameModel'
import Tooltip from '../Tooltip'
import { ColorInput } from '../ColorInput'
import { NumericInput } from '../NumericInput'
import { iconBtnProps } from '../iconBtnStyle'
import { sectionLabelStyle } from './shared'
import { pickImageMedia, pickVideoMedia } from './mediaPickers'

// ---------------------------------------------------------------------------
// FrameSection — clip/fill/stroke + media actions for shape-based media
// frames (ImageObject/VideoObject with clipShape and/or isEmpty).
// ---------------------------------------------------------------------------

interface FrameSectionProps {
  frameObj: ImageObject | VideoObject
  selectedId: string
  onStartDrag: () => void
  onUpdate: (id: string, partial: Partial<CanvasObject>) => void
  onCommit: (id: string, partial: Partial<CanvasObject>) => void
}

const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8 }
const labelStyle: React.CSSProperties = { color: 'var(--text-secondary)', fontSize: 12, width: 64, flexShrink: 0, cursor: 'pointer' }

const buttonStyle: React.CSSProperties = {
  width: '100%',
  height: 30,
  background: 'var(--bg-surface)',
  color: 'var(--text-secondary)',
  border: '1px solid var(--stroke)',
  borderRadius: 999,
  cursor: 'pointer',
  fontSize: 12,
  marginBottom: 6,
}

const destructiveButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  color: 'var(--accent)',
}

// Rect and Ellipse only. A clip can only ever SUBTRACT area — the bitmap stops at
// the frame box — so dragging a path anchor outward produces no visible change at
// all, which made panel-driven path editing a dead end. Custom silhouettes still
// arrive the way they always did: draw a shape, then insert media into it.
// `path` remains a valid ClipShape everywhere else; it just isn't authored here.
const CLIP_KINDS: Array<{ kind: ClipShape['kind']; label: string; description: string }> = [
  { kind: 'rect', label: 'Rect', description: 'Rectangular clip, optionally rounded' },
  { kind: 'ellipse', label: 'Ellipse', description: 'Clips to an ellipse filling the frame' },
]

export function FrameSection({
  frameObj,
  selectedId,
  onStartDrag,
  onUpdate,
  onCommit,
}: FrameSectionProps): React.ReactElement {
  const clipShape = frameObj.clipShape
  const clipKind = clipShape?.kind ?? 'rect'
  const isEmpty = isEmptyFrame(frameObj)
  // Empty standalone frames no longer exist — they collapse to shapes — so an
  // isEmpty frame reaching this panel is always a grid cell.
  const isGridCell = isGridCellObject(frameObj)
  const cornerRadius = clipShape?.kind === 'rect' ? (clipShape.cornerRadius ?? 0) : 0
  const maxCorner = Math.max(0, Math.floor(Math.min(frameObj.frameWidth, frameObj.frameHeight) / 2))
  const fillColor = solidColorOf(frameObj.fill)

  function setCornerRadius(value: number, commit: boolean): void {
    const nextClip: ClipShape = value > 0 ? { kind: 'rect', cornerRadius: value } : { kind: 'rect' }
    if (commit) onCommit(selectedId, { clipShape: nextClip })
    else onUpdate(selectedId, { clipShape: nextClip })
  }

  // The single writer for clip kind. Each switch is one commitUpdate, so undo
  // steps back through shape changes — including replacing a custom path, which
  // is why doing so needs no confirmation.
  function setClipKind(kind: ClipShape['kind']): void {
    if (kind === clipKind) return
    onCommit(selectedId, { clipShape: kind === 'ellipse' ? { kind: 'ellipse' } : { kind: 'rect' } })
  }

  function setFillColor(color: string | undefined): void {
    onCommit(selectedId, { fill: color != null ? { type: 'solid', color } : undefined })
  }

  async function handleInsertImage(): Promise<void> {
    const media = await pickImageMedia()
    if (media) useCanvasStore.getState().insertMediaIntoFrame(selectedId, media)
  }

  async function handleInsertVideo(): Promise<void> {
    const media = await pickVideoMedia()
    if (media) useCanvasStore.getState().insertMediaIntoFrame(selectedId, media)
  }

  // Clears ALL the frame state, not just the clip. Dropping clipShape alone flips
  // isFrameObject false, which hides this whole section — stranding a fill and
  // stroke that would still paint but could no longer be seen or edited.
  function handleRemoveClip(): void {
    onCommit(selectedId, {
      clipShape: undefined,
      fill: undefined,
      frameStroke: undefined,
      frameStrokeWidth: undefined,
    })
  }

  function handleRemoveMedia(): void {
    useCanvasStore.getState().removeMediaFromFrame(selectedId)
  }

  return (
    <div style={{ padding: '12px 12px 0' }}>
      <div style={sectionLabelStyle}>Frame</div>

      {/* Clip kind picker */}
      <div style={rowStyle}>
        <label style={{ ...labelStyle, cursor: 'default' }}>Shape</label>
        <div style={{ display: 'flex', gap: 4, flex: 1 }}>
          {CLIP_KINDS.map(({ kind, label, description }) => (
            <Tooltip key={kind} label={label} description={description}>
              <button
                onClick={() => setClipKind(kind)}
                {...iconBtnProps(kind === clipKind, false, {
                  flex: 1,
                  width: 'auto',
                  height: 26,
                  fontSize: 11,
                })}
              >
                {label}
              </button>
            </Tooltip>
          ))}
          {/* A frame converted from a pen path carries a custom clip that neither
              button represents. Shown as a read-only chip so the state is legible
              and replacing it is still one click. */}
          {clipKind === 'path' && (
            <Tooltip label="Custom shape" description="From the shape this frame was made of. Pick Rect or Ellipse to replace it.">
              <span
                {...iconBtnProps(true, false, {
                  flex: 1, width: 'auto', height: 26, fontSize: 11,
                  cursor: 'default',
                })}
                // Borrows the active pill's look but is read-only, so it opts out
                // of the hover tint that would imply it can be clicked.
                data-disabled=""
              >
                Custom
              </span>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Rect: corner radius */}
      {clipKind === 'rect' && (
        <div style={rowStyle}>
          <label style={labelStyle} onDoubleClick={() => setCornerRadius(0, true)}>
            Corner R.
          </label>
          <input
            type="range"
            min={0}
            max={Math.max(1, maxCorner)}
            step={1}
            value={cornerRadius}
            onMouseDown={onStartDrag}
            onChange={(e) => setCornerRadius(Number(e.target.value), false)}
            onMouseUp={(e) => setCornerRadius(Number((e.target as HTMLInputElement).value), true)}
            style={{ flex: 1 }}
          />
          <NumericInput
            value={cornerRadius}
            min={0}
            max={maxCorner}
            width={48}
            onCommit={(v) => setCornerRadius(v, true)}
            onDoubleClick={() => setCornerRadius(0, true)}
          />
        </div>
      )}

      {/* Fill */}
      <div style={sectionLabelStyle}>Fill</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <ColorInput value={fillColor ?? 'var(--bg-surface)'} onChange={(color) => setFillColor(color)} fixed />
        {fillColor != null && (
          <Tooltip label="Clear fill">
            <button
              onClick={() => setFillColor(undefined)}
              style={{
                width: 20, height: 20, borderRadius: 999,
                background: 'none', border: '1px solid var(--stroke)',
                color: 'var(--text-secondary)', fontSize: 11, lineHeight: 1,
                cursor: 'pointer', padding: 0,
              }}
            >
              ✕
            </button>
          </Tooltip>
        )}
        {fillColor == null && (
          <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>None</span>
        )}
      </div>

      {/* Frame stroke */}
      <div style={sectionLabelStyle}>Frame Stroke</div>
      <div style={rowStyle}>
        <ColorInput
          value={frameObj.frameStroke ?? '#000000'}
          onChange={(color) => onCommit(selectedId, { frameStroke: color })}
          fixed
        />
        <NumericInput
          value={frameObj.frameStrokeWidth ?? 0}
          min={0}
          width={48}
          onCommit={(v) => onCommit(selectedId, { frameStrokeWidth: v })}
          onDoubleClick={() => onCommit(selectedId, { frameStrokeWidth: 0 })}
        />
      </div>

      {/* Media actions */}
      <div style={sectionLabelStyle}>Media</div>
      {isEmpty ? (
        <>
          <Tooltip label="Insert an image into this frame">
            <button style={buttonStyle} onClick={() => { void handleInsertImage() }}>
              Insert Image…
            </button>
          </Tooltip>
          <Tooltip label="Insert a video into this frame">
            <button style={buttonStyle} onClick={() => { void handleInsertVideo() }}>
              Insert Video…
            </button>
          </Tooltip>
        </>
      ) : (
        <>
          <Tooltip label="Replace with a different image">
            <button style={buttonStyle} onClick={() => { void handleInsertImage() }}>
              Replace with Image…
            </button>
          </Tooltip>
          <Tooltip label="Replace with a different video">
            <button style={buttonStyle} onClick={() => { void handleInsertVideo() }}>
              Replace with Video…
            </button>
          </Tooltip>
          {/* Standalone frames collapse back to their shape; grid cells keep the
              empty slot. There is no separate "Convert to Shape" — it was the
              same action, which left two indistinguishable empty states. */}
          <Tooltip
            label="Remove Media"
            description={isGridCell
              ? 'Empties this grid cell, keeping the slot'
              : 'Turns the frame back into a plain shape'}
          >
            <button style={destructiveButtonStyle} onClick={handleRemoveMedia}>
              Remove Media
            </button>
          </Tooltip>
          {/* The inverse of AddClipRow: back to a plain image, media intact. Not
              offered for a grid cell, whose frame identity is what holds its slot. */}
          {!isGridCell && (
            <Tooltip label="Remove Clip" description="Back to a plain, unclipped image — keeps the media">
              <button style={destructiveButtonStyle} onClick={handleRemoveClip}>
                Remove Clip
              </button>
            </Tooltip>
          )}
        </>
      )}
    </div>
  )
}
