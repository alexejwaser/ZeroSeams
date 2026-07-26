// CanvasObject — every element that lives on the carousel canvas.
// Agents must use this interface; never use `any` for canvas objects.

export type CanvasObjectType = 'image' | 'text' | 'shape' | 'group' | 'path' | 'video' | 'guideline'

export type CanvasObjectScope =
  | 'global'   // spans the full canvas freely
  | 'pinned'   // locked to a specific frame index

export interface BaseCanvasObject {
  /** Unique stable identifier (nanoid / uuid) */
  id: string
  type: CanvasObjectType
  scope: CanvasObjectScope

  /** Only set when scope === 'pinned'. Zero-based frame index. */
  pinnedFrame?: number

  // --- Transform ---
  x: number
  y: number
  width: number
  height: number
  rotation: number   // degrees
  scaleX: number
  scaleY: number

  // --- Appearance ---
  opacity: number    // 0–1
  visible: boolean
  locked: boolean
  zIndex: number

  // --- Metadata ---
  name?: string
  /** Set on cells created by addGrid — routes single-click to the parent group */
  parentGroupId?: string

  // --- Layer effects (non-destructive, applied via effects framework) ---
  effects?: LayerEffect[]
}

/** Universal fill for media frames. Gradient will be added later as
 *  another union member — always switch on fill.type. */
export type Fill = { type: 'solid'; color: string }

/** Clip geometry of a media frame. Path anchors are NORMALIZED:
 *  x/y and handle dx/dy in 0–1 units of frameWidth/frameHeight.
 *  Normalized coords mean NO transform ever rewrites the clip. */
export type ClipShape =
  | { kind: 'rect'; cornerRadius?: number }  // cornerRadius in canvas px
  | { kind: 'ellipse' }
  | { kind: 'path'; anchors: AnchorPoint[] } // always closed

export interface ImageObject extends BaseCanvasObject {
  type: 'image'
  /** Data URL or resolved file path (after IPC load) */
  src: string
  /** When true, cell has no media yet — renders placeholder */
  isEmpty?: boolean
  /** True when background has been removed (AI-processed copy) */
  backgroundRemoved: boolean
  /** Original src before any AI processing */
  originalSrc?: string

  // Note: x/y/width/height from BaseCanvasObject are kept in sync with
  // frameX/frameY/frameWidth/frameHeight for compatibility with shared code
  // (export, layer panel, etc.). Always read/write the frame fields below
  // when working with image-specific layout logic.

  // --- Frame (clipping viewport — single-click selects/moves this) ---
  frameX: number
  frameY: number
  frameWidth: number
  frameHeight: number

  // --- Content (image inside the frame) ---
  contentOffsetX: number
  contentOffsetY: number
  contentWidth: number
  contentHeight: number
  /** Intrinsic pixel dimensions of the original image bitmap */
  naturalWidth: number
  naturalHeight: number

  // --- Edit mode ---
  /** When true, transformer targets the image content rather than the frame */
  contentEditMode: boolean
  /** When true, the clip-shape anchor overlay is shown and editable */
  clipEditMode?: boolean

  // --- Media frame (InDesign-style shape-based frame) ---
  /** Clip geometry; absent = plain rect frame */
  clipShape?: ClipShape
  /** Fill painted inside the clip behind media; sole paint when isEmpty */
  fill?: Fill
  /** Frame border stroke color */
  frameStroke?: string
  /** Frame border stroke width (canvas px) */
  frameStrokeWidth?: number

  // --- Photo adjustments (non-destructive, applied via Konva filter pipeline) ---
  adjustments?: PhotoAdjustments
}

/** Lightroom-style non-destructive scalar adjustments for image objects. */
export interface PhotoAdjustments {
  // Light
  exposure: number      // –5 … +5, default 0
  contrast: number      // –100 … +100, default 0
  highlights: number    // –100 … +100, default 0
  shadows: number       // –100 … +100, default 0
  whites: number        // –100 … +100, default 0
  blacks: number        // –100 … +100, default 0
  // Color
  temperature: number   // –100 … +100, default 0 (relative shift)
  tint: number          // –100 … +100, default 0
  saturation: number    // –100 … +100, default 0
  vibrance: number      // –100 … +100, default 0
  // Detail
  clarity: number       // –100 … +100, default 0
  dehaze: number        // –100 … +100, default 0
}

export const DEFAULT_ADJUSTMENTS: PhotoAdjustments = {
  exposure: 0, contrast: 0, highlights: 0, shadows: 0,
  whites: 0, blacks: 0, temperature: 0, tint: 0,
  saturation: 0, vibrance: 0, clarity: 0, dehaze: 0,
}

/** A single non-destructive layer effect applied via the effects framework. */
export interface LayerEffect {
  id: string
  type: string
  enabled: boolean
  params: Record<string, number | string | boolean>
}

export type FontStyle = 'normal' | 'bold' | 'italic' | 'bold italic'

/** Per-character style overrides — undefined fields inherit from TextObject layer defaults */
export interface TextSpanStyle {
  fontFamily?: string
  fontSize?: number
  fontStyle?: FontStyle
  fill?: string
  letterSpacing?: number
}

/** A contiguous run of text with optional style overrides */
export interface TextSpan {
  text: string
  style?: TextSpanStyle
}

export interface TextObject extends BaseCanvasObject {
  type: 'text'
  // Layer-level defaults — apply when a span has no override for that property
  fontFamily: string
  fontSize: number
  fontStyle: FontStyle
  align: 'left' | 'center' | 'right'
  fill: string
  letterSpacing: number
  lineHeight: number
  // Span model — replaces the old flat `text` string.
  // Full text = spans.map(s => s.text).join('')
  // Old projects saved with a flat `text` field load as a single span (migration in store).
  spans: TextSpan[]
}

export type ShapeKind = 'rect' | 'ellipse' | 'line' | 'arrow'

export interface ShapeObject extends BaseCanvasObject {
  type: 'shape'
  kind: ShapeKind
  fill: string
  stroke: string
  strokeWidth: number
  cornerRadius?: number   // rect only
  x2?: number             // second endpoint, absolute canvas x (line/arrow only)
  y2?: number             // second endpoint, absolute canvas y (line/arrow only)
}

export interface AnchorPoint {
  x: number
  y: number
  handleIn: { dx: number; dy: number }   // relative to anchor; (0,0) = sharp corner
  handleOut: { dx: number; dy: number }  // relative to anchor; (0,0) = sharp corner
}

export interface PathObject extends BaseCanvasObject {
  type: 'path'
  anchors: AnchorPoint[]
  closed: boolean
  fill: string
  stroke: string
  strokeWidth: number
  pathEditMode: boolean
}

export interface GroupObject extends BaseCanvasObject {
  type: 'group'
  childIds: string[]
  /** When true, this group was created by the grid layout engine */
  isGrid?: boolean
  /** Gap in canvas pixels between grid cells */
  gridGap?: number
  /** References the GridTemplate.id used to build this group */
  gridTemplateId?: string
}

export interface VideoObject extends BaseCanvasObject {
  type: 'video'
  /** Absolute path at runtime; converted to relativeFilePath on save */
  filePath: string
  /** Path relative to the .zeroseams file; used for project portability */
  relativeFilePath?: string
  /** Whether audio is muted on export */
  muted: boolean
  /** Intrinsic pixel dimensions of the video */
  naturalWidth: number
  naturalHeight: number
  /** Video duration in seconds */
  naturalDuration: number

  // x/y/width/height from BaseCanvasObject kept in sync with frame fields
  frameX: number
  frameY: number
  frameWidth: number
  frameHeight: number

  contentOffsetX: number
  contentOffsetY: number
  contentWidth: number
  contentHeight: number

  /** When true, transformer targets content inside the frame rather than the frame itself */
  contentEditMode: boolean

  // --- Trim / clip ---
  /** Playback start point in seconds (default 0) */
  trimStart?: number
  /** Playback end point in seconds (default naturalDuration) */
  trimEnd?: number

  // --- Playback ---
  /** Whether playback loops when trimEnd is reached (default true) */
  loop?: boolean
  /** Per-object audio volume for export (0–1, default 1). Canvas preview is always muted. */
  volume?: number
  /** Which frame to show when not playing (seconds). Defaults to trimStart when unset. */
  posterFrame?: number
  /** Seconds to hold the poster frame before playback begins (canvas preview only). */
  startOffset?: number

  // --- Photo adjustments (non-destructive, applied via Konva filter pipeline) ---
  adjustments?: PhotoAdjustments

  // --- Media frame (InDesign-style shape-based frame; mirrors ImageObject) ---
  /** Clip geometry; absent = plain rect frame */
  clipShape?: ClipShape
  /** Fill painted inside the clip behind media */
  fill?: Fill
  /** Frame border stroke color */
  frameStroke?: string
  /** Frame border stroke width (canvas px) */
  frameStrokeWidth?: number
  /** When true, the clip-shape anchor overlay is shown and editable */
  clipEditMode?: boolean
}

/** FFmpeg encoding settings used by the video export pipeline. */
export interface VideoExportSettings {
  videoCodec: 'libx264' | 'libx265'
  /** CRF quality (0–51, lower = better; 23 is FFmpeg default for H.264) */
  crf: number
  audioCodec: 'aac' | 'libmp3lame'
  /** Audio bitrate in kbps */
  audioBitrate: number
  /** Output frame rate; 'source' preserves the captured sequence FPS */
  frameRate: 'source' | 24 | 30 | 60
}

export const DEFAULT_VIDEO_EXPORT_SETTINGS: VideoExportSettings = {
  videoCodec: 'libx264',
  crf: 23,
  audioCodec: 'aac',
  audioBitrate: 128,
  frameRate: 'source',
}

export type ImageFormat = 'png' | 'jpeg' | 'tiff'

export interface ImageExportSettings {
  format: ImageFormat
  /** 0–100; used for JPEG and TIFF */
  quality: number
  /** Optional KB cap; JPEG only — encoder reduces quality until under budget */
  maxFileSizeKB?: number
}

export const DEFAULT_IMAGE_EXPORT_SETTINGS: ImageExportSettings = {
  format: 'png',
  quality: 90,
}

export type ExportResult =
  | { frameIndex: number; type: 'png' | 'jpeg' | 'tiff'; blob: Blob; extension: string }
  | { frameIndex: number; type: 'mp4'; blob: Blob; extension: string }

export interface GuidelineObject extends BaseCanvasObject {
  type: 'guideline'
  orientation: 'horizontal' | 'vertical'
  /** y-coordinate for horizontal, x-coordinate for vertical, in canvas coords */
  position: number
  /** Frame index this guideline belongs to. -1 means global (spanAllFrames). */
  frameIndex: number
  spanAllFrames: boolean
}

export type CanvasObject = ImageObject | TextObject | ShapeObject | GroupObject | PathObject | VideoObject | GuidelineObject
