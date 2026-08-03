import type { CanvasObject, Swatch } from './canvas'

// CarouselProject — the top-level save/load unit for a Zero Seams project.

export type Platform = 'instagram' | 'tiktok' | 'facebook' | 'threads' | 'custom'

export type FrameRatio = 'square' | 'portrait' | 'story' | 'landscape' | 'custom'

/** Pixel dimensions of a single frame */
export interface FrameDimensions {
  width: number
  height: number
}

/** One Instagram slide in the carousel */
export interface Frame {
  /** Zero-based index in the carousel sequence */
  index: number
  /** Human-readable label, e.g. "Slide 1" */
  label: string
  /** Per-frame background color override (inherits project default if null) */
  backgroundColor: string | null
}

/** Transient state of a frame-reorder drag (owned by CarouselStage,
 *  rendered by FrameLabelStrip). */
export interface FrameDragState {
  fromIndex: number
  startClientX: number
  currentClientX: number
  containerLeft: number // viewport X of the container at drag start
}

export interface CarouselProject {
  id: string
  name: string

  /** On-disk shape version (see SCHEMA_VERSION in src/io/projectFile.ts).
   *  Optional: files written before it existed simply lack it. */
  schemaVersion?: number

  // --- Canvas layout ---
  platform?: Platform
  ratio: FrameRatio
  dimensions: FrameDimensions
  frameCount: number
  frames: Frame[]

  /** Background color for the entire canvas */
  backgroundColor: string

  // --- Objects ---
  /** All canvas objects keyed by id for O(1) lookup */
  objects: Record<string, CanvasObject>
  /** Render order (bottom → top) */
  objectOrder: string[]

  /** Colour swatches that travel with this project (the "File" scope in the
   *  colour picker). The "Global" scope lives in userData, not here. */
  swatches?: Swatch[]

  // --- History ---
  createdAt: string   // ISO 8601
  updatedAt: string   // ISO 8601
  version: number     // incremented on every save
}
