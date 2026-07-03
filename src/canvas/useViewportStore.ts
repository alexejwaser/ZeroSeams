import { create } from 'zustand'
import { CANVAS_SCALE } from './constants'

interface ViewportState {
  zoom: number
  panX: number
  panY: number
  setZoom: (zoom: number) => void
  setPan: (x: number, y: number) => void
  resetViewport: () => void
}

export const useViewportStore = create<ViewportState>((set) => ({
  zoom: 1.0,
  panX: 0,
  panY: 0,
  setZoom: (zoom) => set({ zoom }),
  setPan: (panX, panY) => set({ panX, panY }),
  resetViewport: () => set({ zoom: 1.0, panX: 0, panY: 0 }),
}))

/** Effective stage display scale for a given zoom level. */
export const scaleForZoom = (zoom: number): number => CANVAS_SCALE * zoom

/** Selector: subscribe to the effective display scale instead of raw zoom. */
export const selectScale = (s: ViewportState): number => scaleForZoom(s.zoom)

/** Non-hook accessor for event handlers: current effective display scale. */
export const getCanvasScale = (): number => scaleForZoom(useViewportStore.getState().zoom)
