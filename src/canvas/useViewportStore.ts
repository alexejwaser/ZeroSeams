import { create } from 'zustand'
import { CANVAS_SCALE } from './constants'

export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 8

interface ViewportState {
  zoom: number
  panX: number
  panY: number
  setZoom: (zoom: number) => void
  zoomIn: () => void
  zoomOut: () => void
  setPan: (x: number, y: number) => void
  resetViewport: () => void
}

export const useViewportStore = create<ViewportState>((set) => ({
  zoom: 1.0,
  panX: 0,
  panY: 0,
  setZoom: (zoom) => set({ zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)) }),
  zoomIn: () => set((s) => ({ zoom: Math.min(MAX_ZOOM, s.zoom * 1.25) })),
  zoomOut: () => set((s) => ({ zoom: Math.max(MIN_ZOOM, s.zoom * 0.8) })),
  setPan: (panX, panY) => set({ panX, panY }),
  resetViewport: () => set({ zoom: 1.0, panX: 0, panY: 0 }),
}))

/** Effective stage display scale for a given zoom level. */
export const scaleForZoom = (zoom: number): number => CANVAS_SCALE * zoom

/** Selector: subscribe to the effective display scale instead of raw zoom. */
export const selectScale = (s: ViewportState): number => scaleForZoom(s.zoom)

/** Non-hook accessor for event handlers: current effective display scale. */
export const getCanvasScale = (): number => scaleForZoom(useViewportStore.getState().zoom)
