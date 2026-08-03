import React, { useRef, useEffect } from 'react'
import { ACCENT } from './constants'
import { Group, Path as KonvaPath, Circle as KonvaCircle, Line as KonvaLine } from 'react-konva'
import type Konva from 'konva'
import type { AnchorPoint, CanvasObject, ClipShape } from '@/types/canvas'
import { useCanvasStore } from './useCanvasStore'
import { anchorsToPathData } from './CanvasPathNode'
import { denormalizeAnchors } from './frameClip'

// ---------------------------------------------------------------------------
// ClipEditOverlay — draggable anchor + bezier-handle overlay for PATH clips.
// Adapted from CanvasPathNode's pathEditMode overlay. Rendered by both
// CanvasImageNode and CanvasVideoNode only while obj.clipEditMode is true and
// the clip is a path (rect/ellipse clips edit via the UI cornerRadius slider).
//
// Coordinates: clip anchors are stored NORMALIZED (0–1 of frame size). This
// overlay lives inside a Group at (frameX, frameY, rotation), so children draw
// in frame-local pixels (= denormalized). On drag we read node-local px and
// normalize at the write boundary. Snap is DISABLED (same rule as pen anchors).
// One history entry per gesture: updateObject live, commitUpdate on release.
// ---------------------------------------------------------------------------

interface ClipEditOverlayProps {
  id: string
  clipShape: Extract<ClipShape, { kind: 'path' }>
  frameX: number
  frameY: number
  frameWidth: number
  frameHeight: number
  rotation: number
}

export function ClipEditOverlay({
  id, clipShape, frameX, frameY, frameWidth, frameHeight, rotation,
}: ClipEditOverlayProps): React.ReactElement {
  const updateObject = useCanvasStore((s) => s.updateObject)
  const commitUpdate = useCanvasStore((s) => s.commitUpdate)
  const altHeldRef = useRef(false)

  useEffect(() => {
    const onDown = (e: KeyboardEvent): void => { altHeldRef.current = e.altKey }
    const onUp = (e: KeyboardEvent): void => { altHeldRef.current = e.altKey }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [])

  const norm = clipShape.anchors
  // Frame-local pixel anchors for rendering.
  const local = denormalizeAnchors(norm, frameWidth, frameHeight)
  const pathData = anchorsToPathData(local, true)

  function writeAnchors(next: AnchorPoint[], commit: boolean): void {
    const patch = { clipShape: { kind: 'path', anchors: next } } as Partial<CanvasObject>
    if (commit) commitUpdate(id, patch)
    else updateObject(id, patch)
  }

  // --- Anchor drag (px → normalized) ---
  function anchorDrag(idx: number, e: Konva.KonvaEventObject<DragEvent>, commit: boolean): void {
    const node = e.target as Konva.Circle
    const nx = node.x() / (frameWidth || 1)
    const ny = node.y() / (frameHeight || 1)
    const next = norm.map((a, i) => (i === idx ? { ...a, x: nx, y: ny } : a))
    writeAnchors(next, commit)
  }

  // --- Handle drag: node-local px → normalized dx/dy relative to anchor ---
  function handleDrag(idx: number, side: 'in' | 'out', e: Konva.KonvaEventObject<DragEvent>, commit: boolean): void {
    const node = e.target as Konva.Circle
    const a = local[idx]
    const dxPx = node.x() - a.x
    const dyPx = node.y() - a.y
    const dx = dxPx / (frameWidth || 1)
    const dy = dyPx / (frameHeight || 1)
    const next = norm.map((anchor, i) => {
      if (i !== idx) return anchor
      if (side === 'in') {
        return {
          ...anchor,
          handleIn: { dx, dy },
          handleOut: altHeldRef.current ? anchor.handleOut : { dx: -dx, dy: -dy },
        }
      }
      return {
        ...anchor,
        handleOut: { dx, dy },
        handleIn: altHeldRef.current ? anchor.handleIn : { dx: -dx, dy: -dy },
      }
    })
    writeAnchors(next, commit)
  }

  // Double-click an anchor: toggle sharp corner ⟷ smooth (mirrored handles).
  function anchorDblClick(idx: number): void {
    const a = norm[idx]
    const hasHandles =
      a.handleIn.dx !== 0 || a.handleIn.dy !== 0 || a.handleOut.dx !== 0 || a.handleOut.dy !== 0
    let next: AnchorPoint[]
    if (hasHandles) {
      next = norm.map((anchor, i) =>
        i === idx ? { ...anchor, handleIn: { dx: 0, dy: 0 }, handleOut: { dx: 0, dy: 0 } } : anchor,
      )
    } else {
      const total = norm.length
      const prev = norm[(idx - 1 + total) % total]
      const nxt = norm[(idx + 1) % total]
      const tx = nxt.x - prev.x
      const ty = nxt.y - prev.y
      const len = Math.sqrt(tx * tx + ty * ty)
      // ~30px handle expressed in normalized units of the larger frame axis.
      const HANDLE = 30 / Math.max(frameWidth, frameHeight, 1)
      const hdx = len > 1e-4 ? (tx / len) * HANDLE : HANDLE
      const hdy = len > 1e-4 ? (ty / len) * HANDLE : 0
      next = norm.map((anchor, i) =>
        i === idx ? { ...anchor, handleOut: { dx: hdx, dy: hdy }, handleIn: { dx: -hdx, dy: -hdy } } : anchor,
      )
    }
    writeAnchors(next, true)
  }

  return (
    <Group x={frameX} y={frameY} rotation={rotation}>
      {/* Clip outline for visibility while editing */}
      <KonvaPath
        data={pathData}
        stroke={ACCENT}
        strokeWidth={1}
        strokeScaleEnabled={false}
        listening={false}
        perfectDrawEnabled={false}
      />
      {local.map((a, idx) => {
        const hasIn = a.handleIn.dx !== 0 || a.handleIn.dy !== 0
        const hasOut = a.handleOut.dx !== 0 || a.handleOut.dy !== 0
        return (
          <React.Fragment key={idx}>
            {hasIn && (
              <KonvaLine
                points={[a.x + a.handleIn.dx, a.y + a.handleIn.dy, a.x, a.y]}
                stroke={ACCENT} strokeWidth={1} strokeScaleEnabled={false}
                dash={[3, 2]} listening={false} perfectDrawEnabled={false}
              />
            )}
            {hasOut && (
              <KonvaLine
                points={[a.x, a.y, a.x + a.handleOut.dx, a.y + a.handleOut.dy]}
                stroke={ACCENT} strokeWidth={1} strokeScaleEnabled={false}
                dash={[3, 2]} listening={false} perfectDrawEnabled={false}
              />
            )}
            {hasIn && (
              <KonvaCircle
                x={a.x + a.handleIn.dx} y={a.y + a.handleIn.dy}
                radius={6} fill="#fff" stroke={ACCENT} strokeWidth={1.5}
                draggable
                onDragMove={(e) => handleDrag(idx, 'in', e, false)}
                onDragEnd={(e) => handleDrag(idx, 'in', e, true)}
              />
            )}
            {hasOut && (
              <KonvaCircle
                x={a.x + a.handleOut.dx} y={a.y + a.handleOut.dy}
                radius={6} fill="#fff" stroke={ACCENT} strokeWidth={1.5}
                draggable
                onDragMove={(e) => handleDrag(idx, 'out', e, false)}
                onDragEnd={(e) => handleDrag(idx, 'out', e, true)}
              />
            )}
            <KonvaCircle
              x={a.x} y={a.y}
              radius={7}
              fill={hasIn || hasOut ? '#4488ff' : '#fff'}
              stroke={ACCENT} strokeWidth={2}
              draggable
              onDragMove={(e) => anchorDrag(idx, e, false)}
              onDragEnd={(e) => anchorDrag(idx, e, true)}
              onDblClick={() => anchorDblClick(idx)}
            />
          </React.Fragment>
        )
      })}
    </Group>
  )
}
