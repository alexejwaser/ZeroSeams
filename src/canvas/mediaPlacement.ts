// Shared placement + object construction for every path that adds media to the
// canvas: drag-and-drop (useMediaDrop), the toolbar Add Image/Add Video buttons,
// and clipboard paste (useClipboardPaste).
//
// Two things live here that used to be copy-pasted per entry point:
//
//  1. The frame math. `Math.floor(x / frameWidth)` is open-coded in several
//     places with three different roundings; this is the canonical containment
//     form (matching the guideline placement rule in CarouselStage). The toolbar
//     used to hardcode `frameWidth / 2` — i.e. always frame 0 — because it had no
//     cursor to derive a target from; `defaultDropPoint()` is that missing input.
//
//  2. The ImageObject/VideoObject field lists. Four hand-written copies existed
//     and had already drifted. Same rationale as buildEmptyFrameImage in
//     frameModel.ts: exactly one place knows the field list.

import type { ImageObject, VideoObject } from '@/types/canvas'
import { useCanvasStore } from './useCanvasStore'
import { useViewportStore, getCanvasScale } from './useViewportStore'
// Narrow, deliberate exception to "canvas must not import ui": panelConstants is a
// constants leaf — no store, no React, no logic — and the panels genuinely occlude
// ~540px of the stage. Ignoring them biases the fallback frame by a full frame at
// default zoom, which is the exact bug this module exists to kill.
import { LAYER_PANEL_WIDTH, PROPERTIES_PANEL_WIDTH } from '@/ui/panelConstants'

/** Longest edge of a newly placed media object, in logical canvas px. */
export const MAX_MEDIA_SIZE = 600

/** Per-file offset when a multi-file drop lands on the same point. */
export const MULTI_DROP_STAGGER = 30

export interface Point {
  x: number
  y: number
}

// ---------------------------------------------------------------------------
// Last pointer position
// ---------------------------------------------------------------------------
// Module-level rather than store state on purpose: this is written on every
// mousemove over the stage. In the store it would push a re-render per frame and
// (worse) would have to be excluded from history by hand.

let lastPointer: Point | null = null

/** Called from CarouselStage's stage mousemove with LOGICAL canvas coords. */
export function setLastPointer(x: number, y: number): void {
  lastPointer = { x, y }
}

export function getLastPointer(): Point | null {
  return lastPointer
}

// ---------------------------------------------------------------------------
// Frame math
// ---------------------------------------------------------------------------

/** Index of the frame containing `logicalX`, clamped into the existing frames. */
export function frameIndexAt(logicalX: number): number {
  const { frameWidth, frameCount } = useCanvasStore.getState()
  const raw = Math.floor(logicalX / frameWidth)
  return Math.max(0, Math.min(frameCount - 1, raw))
}

/** Center point of frame `index` in logical canvas coords. */
export function frameCenter(index: number): Point {
  const { frameWidth, frameHeight } = useCanvasStore.getState()
  return { x: (index + 0.5) * frameWidth, y: frameHeight / 2 }
}

/**
 * Where media should land when the caller has no cursor of its own — i.e. the
 * toolbar buttons and menu-driven paste.
 *
 * Prefers the last pointer position over the stage, so "click Add Video while
 * looking at frame 3" puts the video in frame 3. Falls back to the center of the
 * frame nearest the middle of the visible area when the cursor has never entered
 * the canvas (fresh window, keyboard-only).
 */
export function defaultDropPoint(): Point {
  const pointer = getLastPointer()
  if (pointer) return pointer
  return frameCenter(frameIndexAt(viewportCenterX()))
}

/**
 * Logical x at the middle of the genuinely visible canvas rectangle. The stage
 * container spans the full window width, but the two panels float on top of it —
 * measuring the raw width puts the "center" underneath them. Same visible-rect
 * derivation as CanvasHud's fit-all-frames, minus the vertical terms (we only
 * need a frame index, and frames are sliced horizontally).
 *
 * Reads window rather than the stage container to keep this module free of a
 * CarouselStage import — CarouselStage imports this one.
 */
function viewportCenterX(): number {
  const { panX } = useViewportStore.getState()
  const scale = getCanvasScale()
  const width = typeof window !== 'undefined' ? window.innerWidth : 0
  const visibleW = width - LAYER_PANEL_WIDTH - PROPERTIES_PANEL_WIDTH
  const screenCenterX = LAYER_PANEL_WIDTH + visibleW / 2
  return (screenCenterX - panX) / scale
}

// ---------------------------------------------------------------------------
// Sizing
// ---------------------------------------------------------------------------

/** Fit a bitmap's intrinsic size into MAX_MEDIA_SIZE without upscaling. */
export function fitMediaBox(naturalW: number, naturalH: number): { w: number; h: number } {
  const longest = Math.max(naturalW, naturalH)
  const fit = longest > 0 ? Math.min(1, MAX_MEDIA_SIZE / longest) : 1
  return { w: Math.round(naturalW * fit), h: Math.round(naturalH * fit) }
}

/**
 * Top-left of a `w`×`h` box centered on `at`, staggered by `index` so a
 * multi-file drop does not stack every file on the exact same pixel.
 */
function topLeftFor(at: Point, w: number, h: number, index: number): Point {
  return {
    x: at.x - w / 2 + index * MULTI_DROP_STAGGER,
    y: at.y - h / 2 + index * MULTI_DROP_STAGGER,
  }
}

// ---------------------------------------------------------------------------
// Object builders
// ---------------------------------------------------------------------------
// The ONLY place that knows the field list for a freshly added ImageObject /
// VideoObject. Note x/y/width/height are mirrored from the frame fields — shared
// code (export, layer panel, bbox) reads the base fields, media-specific layout
// reads the frame fields, and the two must agree at creation time.

export interface BuildImageArgs {
  src: string
  naturalWidth: number
  naturalHeight: number
  name?: string
  /** Center point in logical canvas coords. */
  at: Point
  /** Index within a multi-file batch; drives the stagger offset. */
  index?: number
}

export function buildImageObject(args: BuildImageArgs): ImageObject {
  const { w, h } = fitMediaBox(args.naturalWidth, args.naturalHeight)
  const { x, y } = topLeftFor(args.at, w, h, args.index ?? 0)
  return {
    id: crypto.randomUUID(),
    type: 'image',
    scope: 'global',
    name: args.name,
    src: args.src,
    backgroundRemoved: false,
    frameX: x,
    frameY: y,
    frameWidth: w,
    frameHeight: h,
    contentOffsetX: 0,
    contentOffsetY: 0,
    contentWidth: w,
    contentHeight: h,
    naturalWidth: args.naturalWidth,
    naturalHeight: args.naturalHeight,
    contentEditMode: false,
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
    visible: true,
    locked: false,
    zIndex: useCanvasStore.getState().objectOrder.length,
  }
}

export interface BuildVideoArgs {
  filePath: string
  naturalWidth: number
  naturalHeight: number
  naturalDuration: number
  name?: string
  at: Point
  index?: number
}

export function buildVideoObject(args: BuildVideoArgs): VideoObject {
  const { w, h } = fitMediaBox(args.naturalWidth, args.naturalHeight)
  const { x, y } = topLeftFor(args.at, w, h, args.index ?? 0)
  return {
    id: crypto.randomUUID(),
    type: 'video',
    scope: 'global',
    name: args.name,
    filePath: args.filePath,
    // relativeFilePath is written by relativizeVideoObjects at save time.
    muted: false,
    naturalWidth: args.naturalWidth,
    naturalHeight: args.naturalHeight,
    naturalDuration: args.naturalDuration,
    frameX: x,
    frameY: y,
    frameWidth: w,
    frameHeight: h,
    contentOffsetX: 0,
    contentOffsetY: 0,
    contentWidth: w,
    contentHeight: h,
    contentEditMode: false,
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
    visible: true,
    locked: false,
    zIndex: useCanvasStore.getState().objectOrder.length,
  }
}
