import React from 'react'
import type { ClipShape } from '@/types/canvas'
import { useCanvasStore } from '@/canvas/useCanvasStore'
import { clipShapeToAnchors } from '@/canvas/frameClip'
import Tooltip from '../Tooltip'
import { sectionLabelStyle } from './shared'

// ---------------------------------------------------------------------------
// AddClipRow — the entry point that turns a plain image/video into a media
// frame by giving it a clip.
//
// isFrameObject is deliberately narrow: an image with no clip and no isEmpty is
// genuinely not a frame yet, so FrameSection stays hidden for it. Rather than
// widening the predicate (which would put clip/fill/stroke UI on every image
// ever dropped), this is the explicit action that makes the object qualify —
// after which FrameSection appears on the next render.
//
// Mirrors the dashed "Media Frame" box PropertiesPanel already shows for a
// shape that canBecomeFrame().
// ---------------------------------------------------------------------------

const ctaButtonStyle: React.CSSProperties = {
  flex: 1,
  height: 28,
  background: '#ffffff',
  color: '#555555',
  border: '1px solid #d4ccc2',
  borderRadius: 999,
  cursor: 'pointer',
  fontSize: 12,
}

const OPTIONS: Array<{ kind: ClipShape['kind']; label: string; description: string }> = [
  { kind: 'rect', label: 'Rect', description: 'Clip to a rectangle you can round' },
  { kind: 'ellipse', label: 'Ellipse', description: 'Clip to an ellipse filling the frame' },
  { kind: 'path', label: 'Path', description: 'Clip to editable anchors' },
]

export function AddClipRow({ objectId }: { objectId: string }): React.ReactElement {
  function addClip(kind: ClipShape['kind']): void {
    const clipShape: ClipShape =
      kind === 'ellipse' ? { kind: 'ellipse' }
      : kind === 'path' ? { kind: 'path', anchors: clipShapeToAnchors(undefined) }
      : { kind: 'rect' }
    useCanvasStore.getState().commitUpdate(objectId, { clipShape })
    if (kind === 'path') useCanvasStore.getState().enterClipEditMode(objectId)
  }

  return (
    <div style={{ marginTop: 4, marginBottom: 8, padding: 8, border: '1px dashed #d4ccc2', borderRadius: 12 }}>
      <div style={sectionLabelStyle}>Clip Shape</div>
      <div style={{ display: 'flex', gap: 6 }}>
        {OPTIONS.map(({ kind, label, description }) => (
          <Tooltip key={kind} label={label} description={description}>
            <button style={ctaButtonStyle} onClick={() => addClip(kind)}>{label}</button>
          </Tooltip>
        ))}
      </div>
    </div>
  )
}
