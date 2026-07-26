import { create } from 'zustand'
import Konva from 'konva'

/**
 * Dev-only render instrumentation for issue #59 (Phase 0).
 *
 * Real per-frame pixel work in this app funnels through Konva's
 * `Layer.prototype.drawScene` (visible canvas) and `.drawHit` (hit canvas).
 * Every pan/zoom (Stage x/y/scale changes) and every video RAF ends up there,
 * so wrapping those two methods gives an honest count + timing of actual draw
 * work — the baseline later phases (culling, video isolation, LOD) are judged
 * against.
 *
 * The wrapper fast-paths straight to the original when disabled, so there is no
 * measurable overhead when the HUD is off. Gated behind `import.meta.env.DEV`
 * AND `localStorage['zeroseams:perfHud']` so it never activates in a packaged
 * build. Toggle at runtime with ⌥⇧P (see PerfHud.tsx).
 */

const FLAG_KEY = 'zeroseams:perfHud'

function initialEnabled(): boolean {
  try {
    return import.meta.env.DEV && localStorage.getItem(FLAG_KEY) === '1'
  } catch {
    return false
  }
}

interface PerfState {
  enabled: boolean
  /** Animation frames per second (rAF cadence). */
  fps: number
  /** Rolling average scene+hit draw time per scene draw, in ms. */
  drawMs: number
  /** Longest single layer draw in the last window, in ms — isolates the heavy
   *  layer that the average dilutes across empty overlay layers. */
  peakMs: number
  /** Konva scene draws per second — climbs during pan/zoom and video playback. */
  drawsPerSec: number
  /** Objects currently drawn. Mirrors total until Phase 1a wires real culling. */
  visibleCount: number
  _set: (patch: Partial<PerfState>) => void
}

export const usePerfStore = create<PerfState>((set) => ({
  enabled: initialEnabled(),
  fps: 0,
  drawMs: 0,
  peakMs: 0,
  drawsPerSec: 0,
  visibleCount: 0,
  _set: (patch) => set(patch),
}))

// --- Konva patch -----------------------------------------------------------

let installed = false
let drawCount = 0 // scene draws since last flush
let drawTimeMs = 0 // accumulated scene+hit time since last flush
let peakMs = 0 // longest single layer draw since last flush

function patchLayerMethod(method: 'drawScene' | 'drawHit'): void {
  // Konva's typings don't expose these as writable; patch via an index cast.
  const proto = Konva.Layer.prototype as unknown as Record<string, (...args: unknown[]) => unknown>
  const original = proto[method]
  proto[method] = function patched(this: unknown, ...args: unknown[]): unknown {
    if (!usePerfStore.getState().enabled) return original.apply(this, args)
    const t0 = performance.now()
    const result = original.apply(this, args)
    const dt = performance.now() - t0
    drawTimeMs += dt
    if (dt > peakMs) peakMs = dt
    if (method === 'drawScene') drawCount++
    return result
  }
}

/** Idempotent: wraps the two Layer draw methods once. */
export function installPerfMonitor(): void {
  if (installed) return
  installed = true
  patchLayerMethod('drawScene')
  patchLayerMethod('drawHit')
}

// --- Sampler loop ----------------------------------------------------------

let rafId: number | null = null
let frameCount = 0
let windowStart = 0

function tick(now: number): void {
  if (!usePerfStore.getState().enabled) {
    rafId = null
    return
  }
  frameCount++
  if (windowStart === 0) windowStart = now
  const elapsed = now - windowStart
  if (elapsed >= 500) {
    usePerfStore.getState()._set({
      fps: Math.round((frameCount * 1000) / elapsed),
      drawsPerSec: Math.round((drawCount * 1000) / elapsed),
      drawMs: drawCount > 0 ? Math.round((drawTimeMs / drawCount) * 100) / 100 : 0,
      peakMs: Math.round(peakMs * 100) / 100,
    })
    frameCount = 0
    drawCount = 0
    drawTimeMs = 0
    peakMs = 0
    windowStart = now
  }
  rafId = requestAnimationFrame(tick)
}

function startSampler(): void {
  if (rafId != null) return
  frameCount = 0
  drawCount = 0
  drawTimeMs = 0
  windowStart = 0
  rafId = requestAnimationFrame(tick)
}

function stopSampler(): void {
  if (rafId != null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
}

// --- Public controls -------------------------------------------------------

/** Flip the HUD on/off, persist the flag, and start/stop instrumentation. */
export function togglePerfHud(): void {
  const next = !usePerfStore.getState().enabled
  usePerfStore.getState()._set({ enabled: next })
  try {
    localStorage.setItem(FLAG_KEY, next ? '1' : '0')
  } catch {
    /* localStorage unavailable — flag is transient this session */
  }
  if (next) {
    installPerfMonitor()
    startSampler()
  } else {
    stopSampler()
    usePerfStore.getState()._set({ fps: 0, drawsPerSec: 0, drawMs: 0, peakMs: 0 })
  }
}

/** Phase 1a hook: report how many objects survived viewport culling. */
export function setPerfVisibleCount(n: number): void {
  if (usePerfStore.getState().visibleCount !== n) {
    usePerfStore.getState()._set({ visibleCount: n })
  }
}

// If the flag was left on from a previous session, start immediately.
if (usePerfStore.getState().enabled) {
  installPerfMonitor()
  startSampler()
}
