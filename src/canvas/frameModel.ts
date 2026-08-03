/**
 * The object model behind media frames: what an *empty* frame is made of, and how
 * to recognise one.
 *
 * This file is the single source of truth for both. Before it existed, the empty
 * ImageObject field list was hand-written in three places (frameToEmptyImage,
 * buildFrameFromShape, addGrid's cell builder) and the "is this a frame?" predicate
 * in five — and they had already drifted apart from each other.
 *
 * Deliberately a leaf: type-only imports, no store, no React, no clip geometry. It
 * sits next to frameClip.ts rather than inside it because that file is about clip
 * *geometry* while this one is about object *identity*.
 */
import type {
  CanvasObject,
  CanvasObjectScope,
  ClipShape,
  Fill,
  ImageObject,
  LayerEffect,
  VideoObject,
} from '@/types/canvas'

/** Paint of a grid cell awaiting media. Also the fallback fill in CanvasImageNode. */
export const EMPTY_FRAME_FILL = '#d9d2c7'

/** Everything an empty media frame needs beyond the constant defaults. */
export interface EmptyFrameSpec {
  rect: { x: number; y: number; width: number; height: number }
  scope: CanvasObjectScope
  rotation: number
  opacity: number
  visible: boolean
  locked: boolean
  zIndex: number
  pinnedFrame?: number
  parentGroupId?: string
  name?: string
  clipShape?: ClipShape
  fill?: Fill
  frameStroke?: string
  frameStrokeWidth?: number
  effects?: LayerEffect[]
}

/**
 * THE field list for an empty ImageObject. Every other builder here delegates to it,
 * so a new field on the empty-frame shape is added in exactly one place.
 *
 * scaleX/scaleY are forced to 1: transforms are always baked into the frame rect, so
 * a non-1 scale on a placeholder is stale state, never intent.
 */
export function buildEmptyFrameImage(id: string, spec: EmptyFrameSpec): ImageObject {
  const { rect } = spec
  return {
    id,
    type: 'image',
    scope: spec.scope,
    pinnedFrame: spec.pinnedFrame,
    parentGroupId: spec.parentGroupId,
    name: spec.name,
    isEmpty: true,
    src: '',
    backgroundRemoved: false,
    frameX: rect.x, frameY: rect.y,
    frameWidth: rect.width, frameHeight: rect.height,
    x: rect.x, y: rect.y, width: rect.width, height: rect.height,
    contentOffsetX: 0, contentOffsetY: 0,
    contentWidth: 0, contentHeight: 0,
    naturalWidth: 0, naturalHeight: 0,
    contentEditMode: false,
    clipEditMode: false,
    clipShape: spec.clipShape,
    fill: spec.fill,
    frameStroke: spec.frameStroke,
    frameStrokeWidth: spec.frameStrokeWidth,
    rotation: spec.rotation,
    scaleX: 1, scaleY: 1,
    opacity: spec.opacity,
    visible: spec.visible,
    locked: spec.locked,
    zIndex: spec.zIndex,
    effects: spec.effects,
  }
}

/** Clear the media from `f`, keeping its geometry, clip, fill, stroke and metadata.
 *  Used when emptying a frame back to a placeholder (removeMediaFromFrame, and
 *  removeObject on a grid cell). */
export function frameToEmptyImage(f: ImageObject | VideoObject, id: string): ImageObject {
  return buildEmptyFrameImage(id, {
    rect: { x: f.frameX, y: f.frameY, width: f.frameWidth, height: f.frameHeight },
    scope: f.scope,
    rotation: f.rotation,
    opacity: f.opacity,
    visible: f.visible,
    locked: f.locked,
    zIndex: f.zIndex,
    pinnedFrame: f.pinnedFrame,
    parentGroupId: f.parentGroupId,
    name: f.name,
    clipShape: f.clipShape,
    fill: f.fill,
    frameStroke: f.frameStroke,
    frameStrokeWidth: f.frameStrokeWidth,
    effects: f.effects,
  })
}

/** A fresh grid cell. Structurally identical to frameToEmptyImage's output by
 *  construction — that equivalence is what lets a cell round-trip through fill/empty
 *  without changing shape. */
export function makeEmptyCell(
  id: string,
  groupId: string,
  rect: { x: number; y: number; w: number; h: number },
  opts?: { clipShape?: ClipShape; fill?: Fill },
): ImageObject {
  return buildEmptyFrameImage(id, {
    rect: { x: rect.x, y: rect.y, width: rect.w, height: rect.h },
    scope: 'global',
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    zIndex: 0,
    parentGroupId: groupId,
    clipShape: opts?.clipShape,
    fill: opts?.fill ?? { type: 'solid', color: EMPTY_FRAME_FILL },
  })
}

/**
 * Has frame identity — an image/video that owns clip/fill/stroke state, or is a
 * placeholder awaiting media. This is the "show the Frame section / offer frame
 * actions" predicate.
 *
 * Deliberately distinct from isEmptyFrame: a filled, clipped image is a frame but
 * not empty, and collapsing the two is the wrong kind of unification.
 */
export function isFrameObject(
  o: CanvasObject | null | undefined,
): o is ImageObject | VideoObject {
  if (o == null || (o.type !== 'image' && o.type !== 'video')) return false
  return o.clipShape != null || (o.type === 'image' && o.isEmpty === true)
}

/** Is a placeholder awaiting media. Since standalone empty frames collapse to shapes,
 *  in practice an empty frame is always a grid cell. */
export function isEmptyFrame(o: CanvasObject | null | undefined): o is ImageObject {
  return o?.type === 'image' && o.isEmpty === true
}

/** Is owned by a grid group — drives click routing and the keep-the-slot delete path. */
export function isGridCell(o: CanvasObject | null | undefined): boolean {
  return o?.parentGroupId != null
}
