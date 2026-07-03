import type { PhotoAdjustments } from '@/types/canvas'
import { DEFAULT_ADJUSTMENTS } from '@/types/canvas'
import { rgbToHsl, hslToRgb } from '@/utils/color'

function evict<V>(cache: Map<string, V>, max = 64): void {
  if (cache.size > max) cache.delete(cache.keys().next().value!)
}

// ---------------------------------------------------------------------------
// LUT cache
// ---------------------------------------------------------------------------

const lutCache = new Map<string, Uint8ClampedArray>()

function buildLUT(key: string, fn: (i: number) => number): Uint8ClampedArray {
  if (lutCache.has(key)) return lutCache.get(key)!
  const lut = new Uint8ClampedArray(256)
  for (let i = 0; i < 256; i++) lut[i] = Math.max(0, Math.min(255, Math.round(fn(i))))
  lutCache.set(key, lut)
  evict(lutCache)
  return lut
}

// ---------------------------------------------------------------------------
// 3D cube LUT cache — keyed "type:value", Float32Array of N³×3 values
// ---------------------------------------------------------------------------

const lut3dCache = new Map<string, Float32Array>()
const LUT3D_N = 33          // 33 grid points → step = 256/(33-1) ≈ 8
const LUT3D_STEP = 256 / (LUT3D_N - 1)

function build3DLUT(
  key: string,
  fn: (r: number, g: number, b: number) => [number, number, number]
): Float32Array {
  if (lut3dCache.has(key)) return lut3dCache.get(key)!
  const lut = new Float32Array(LUT3D_N * LUT3D_N * LUT3D_N * 3)
  for (let ri = 0; ri < LUT3D_N; ri++) {
    for (let gi = 0; gi < LUT3D_N; gi++) {
      for (let bi = 0; bi < LUT3D_N; bi++) {
        const [ro, go, bo] = fn(
          Math.min(255, ri * LUT3D_STEP),
          Math.min(255, gi * LUT3D_STEP),
          Math.min(255, bi * LUT3D_STEP)
        )
        const idx = (ri * LUT3D_N * LUT3D_N + gi * LUT3D_N + bi) * 3
        lut[idx]     = ro
        lut[idx + 1] = go
        lut[idx + 2] = bo
      }
    }
  }
  lut3dCache.set(key, lut)
  evict(lut3dCache)
  return lut
}

function sample3DLUT(lut: Float32Array, r: number, g: number, b: number): [number, number, number] {
  const rf = r / LUT3D_STEP, gf = g / LUT3D_STEP, bf = b / LUT3D_STEP
  const r0 = Math.min(LUT3D_N - 2, rf | 0), r1 = r0 + 1
  const g0 = Math.min(LUT3D_N - 2, gf | 0), g1 = g0 + 1
  const b0 = Math.min(LUT3D_N - 2, bf | 0), b1 = b0 + 1
  const fr = rf - r0, fg = gf - g0, fb = bf - b0
  const N = LUT3D_N, N2 = N * N
  // Precompute all 8 trilinear weights and base indices — no inner function.
  const w000 = (1-fr)*(1-fg)*(1-fb), w001 = (1-fr)*(1-fg)*fb
  const w010 = (1-fr)*fg*(1-fb),     w011 = (1-fr)*fg*fb
  const w100 = fr*(1-fg)*(1-fb),     w101 = fr*(1-fg)*fb
  const w110 = fr*fg*(1-fb),         w111 = fr*fg*fb
  const i000 = (r0*N2 + g0*N + b0)*3, i001 = (r0*N2 + g0*N + b1)*3
  const i010 = (r0*N2 + g1*N + b0)*3, i011 = (r0*N2 + g1*N + b1)*3
  const i100 = (r1*N2 + g0*N + b0)*3, i101 = (r1*N2 + g0*N + b1)*3
  const i110 = (r1*N2 + g1*N + b0)*3, i111 = (r1*N2 + g1*N + b1)*3
  return [
    Math.round(lut[i000]*w000 + lut[i001]*w001 + lut[i010]*w010 + lut[i011]*w011 +
               lut[i100]*w100 + lut[i101]*w101 + lut[i110]*w110 + lut[i111]*w111),
    Math.round(lut[i000+1]*w000 + lut[i001+1]*w001 + lut[i010+1]*w010 + lut[i011+1]*w011 +
               lut[i100+1]*w100 + lut[i101+1]*w101 + lut[i110+1]*w110 + lut[i111+1]*w111),
    Math.round(lut[i000+2]*w000 + lut[i001+2]*w001 + lut[i010+2]*w010 + lut[i011+2]*w011 +
               lut[i100+2]*w100 + lut[i101+2]*w101 + lut[i110+2]*w110 + lut[i111+2]*w111),
  ]
}

// ---------------------------------------------------------------------------
// 1D float LUT cache — maps luminance level (0–255) to a per-pixel scale factor
// ---------------------------------------------------------------------------

const floatLutCache = new Map<string, Float32Array>()

function buildFloatLUT(key: string, fn: (lIdx: number) => number): Float32Array {
  if (floatLutCache.has(key)) return floatLutCache.get(key)!
  const lut = new Float32Array(256)
  for (let i = 0; i < 256; i++) lut[i] = fn(i)
  floatLutCache.set(key, lut)
  evict(floatLutCache)
  return lut
}

// ---------------------------------------------------------------------------
// isAllDefault
// ---------------------------------------------------------------------------

function isAllDefault(adj: PhotoAdjustments): boolean {
  return (Object.keys(DEFAULT_ADJUSTMENTS) as Array<keyof PhotoAdjustments>).every(
    (k) => adj[k] === 0,
  )
}

// ---------------------------------------------------------------------------
// Individual filter makers
// ---------------------------------------------------------------------------

function makeExposureFilter(exposure: number): (imageData: ImageData) => void {
  // Decode sRGB gamma, apply EV gain in linear light, re-encode.
  // This matches Lightroom's perceptual exposure response — highlights are
  // protected by the gamma shoulder rather than hard-clipping.
  const gain = Math.pow(2, exposure)
  const lut = buildLUT(`exposure:${exposure}`, (i) => {
    const linear = Math.pow(i / 255, 2.2)
    const gained = Math.min(1, Math.max(0, linear * gain))
    return Math.pow(gained, 1 / 2.2) * 255
  })
  return (imageData: ImageData): void => {
    const d = imageData.data
    for (let j = 0; j < d.length; j += 4) {
      d[j]     = lut[d[j]]
      d[j + 1] = lut[d[j + 1]]
      d[j + 2] = lut[d[j + 2]]
    }
  }
}

function makeContrastFilter(contrast: number): (imageData: ImageData) => void {
  // Halved factor keeps Lightroom parity — at +100 the S-curve factor is 1.5×
  // rather than 2×, matching Lightroom's more restrained contrast response.
  const lut = buildLUT(`contrast:${contrast}`, (i) =>
    Math.round(((i / 255 - 0.5) * (1 + contrast / 200) + 0.5) * 255),
  )
  return (imageData: ImageData): void => {
    const d = imageData.data
    for (let j = 0; j < d.length; j += 4) {
      d[j]     = lut[d[j]]
      d[j + 1] = lut[d[j + 1]]
      d[j + 2] = lut[d[j + 2]]
    }
  }
}

function makeWhitesFilter(whites: number): (imageData: ImageData) => void {
  // Only affects pixels above 75% luminance; effect tapers to zero at midtones.
  const lut = buildLUT(`whites:${whites}`, (i) => {
    const t = i / 255
    if (t < 0.75) return Math.round(t * 255)
    const zone = (t - 0.75) / 0.25   // 0 at t=0.75, 1 at t=1.0
    const out = t + (whites / 100) * zone * (1 - t) * 0.7
    return Math.round(out * 255)
  })
  return (imageData: ImageData): void => {
    const d = imageData.data
    for (let j = 0; j < d.length; j += 4) {
      d[j]     = lut[d[j]]
      d[j + 1] = lut[d[j + 1]]
      d[j + 2] = lut[d[j + 2]]
    }
  }
}

function makeBlacksFilter(blacks: number): (imageData: ImageData) => void {
  // Only affects pixels below 25% luminance; effect tapers to zero at midtones.
  const lut = buildLUT(`blacks:${blacks}`, (i) => {
    const t = i / 255
    if (t > 0.25) return Math.round(t * 255)
    const zone = (0.25 - t) / 0.25   // 1 at t=0, 0 at t=0.25
    const out = t + (blacks / 100) * zone * t * 0.7
    return Math.round(out * 255)
  })
  return (imageData: ImageData): void => {
    const d = imageData.data
    for (let j = 0; j < d.length; j += 4) {
      d[j]     = lut[d[j]]
      d[j + 1] = lut[d[j + 1]]
      d[j + 2] = lut[d[j + 2]]
    }
  }
}

function makeHighlightsFilter(highlights: number): (imageData: ImageData) => void {
  // Scale factor precomputed per luminance level — avoids per-pixel float division.
  const scaleLUT = buildFloatLUT(`highlights_scale:${highlights}`, (lIdx) => {
    const L = lIdx / 255
    return 1 + (highlights / 100) * L * 0.5
  })
  return (imageData: ImageData): void => {
    const d = imageData.data
    for (let j = 0; j < d.length; j += 4) {
      const scale = scaleLUT[(77 * d[j] + 150 * d[j + 1] + 29 * d[j + 2]) >> 8]
      d[j]     = Math.max(0, Math.min(255, Math.round(d[j]     * scale)))
      d[j + 1] = Math.max(0, Math.min(255, Math.round(d[j + 1] * scale)))
      d[j + 2] = Math.max(0, Math.min(255, Math.round(d[j + 2] * scale)))
    }
  }
}

function makeShadowsFilter(shadows: number): (imageData: ImageData) => void {
  // Scale factor precomputed per luminance level — avoids per-pixel float division.
  const scaleLUT = buildFloatLUT(`shadows_scale:${shadows}`, (lIdx) => {
    const L = lIdx / 255
    return 1 + (shadows / 100) * (1 - L) * 0.5
  })
  return (imageData: ImageData): void => {
    const d = imageData.data
    for (let j = 0; j < d.length; j += 4) {
      const scale = scaleLUT[(77 * d[j] + 150 * d[j + 1] + 29 * d[j + 2]) >> 8]
      d[j]     = Math.max(0, Math.min(255, Math.round(d[j]     * scale)))
      d[j + 1] = Math.max(0, Math.min(255, Math.round(d[j + 1] * scale)))
      d[j + 2] = Math.max(0, Math.min(255, Math.round(d[j + 2] * scale)))
    }
  }
}

function makeTemperatureFilter(temperature: number): (imageData: ImageData) => void {
  const rLUT = buildLUT(`temp_r:${temperature}`, (i) => i + temperature * 0.5)
  const bLUT = buildLUT(`temp_b:${temperature}`, (i) => i - temperature * 0.5)
  return (imageData: ImageData): void => {
    const d = imageData.data
    for (let j = 0; j < d.length; j += 4) {
      d[j]     = rLUT[d[j]]
      d[j + 2] = bLUT[d[j + 2]]
    }
  }
}

function makeTintFilter(tint: number): (imageData: ImageData) => void {
  const rLUT = buildLUT(`tint_r:${tint}`, (i) => i + tint * 0.15)
  const gLUT = buildLUT(`tint_g:${tint}`, (i) => i - tint * 0.3)
  const bLUT = buildLUT(`tint_b:${tint}`, (i) => i + tint * 0.15)
  return (imageData: ImageData): void => {
    const d = imageData.data
    for (let j = 0; j < d.length; j += 4) {
      d[j]     = rLUT[d[j]]
      d[j + 1] = gLUT[d[j + 1]]
      d[j + 2] = bLUT[d[j + 2]]
    }
  }
}

function makeSaturationFilter(saturation: number): (imageData: ImageData) => void {
  const lut = build3DLUT(`sat3d:${saturation}`, (r, g, b) => {
    const [h, s, l] = rgbToHsl(r, g, b)
    const sNew = Math.max(0, Math.min(1, s * (1 + saturation / 100)))
    return hslToRgb(h, sNew, l)
  })
  return (imageData: ImageData): void => {
    const d = imageData.data
    for (let j = 0; j < d.length; j += 4) {
      const [ro, go, bo] = sample3DLUT(lut, d[j], d[j + 1], d[j + 2])
      d[j] = ro; d[j + 1] = go; d[j + 2] = bo
    }
  }
}

function makeVibranceFilter(vibrance: number): (imageData: ImageData) => void {
  const lut = build3DLUT(`vib3d:${vibrance}`, (r, g, b) => {
    const [h, s, l] = rgbToHsl(r, g, b)
    const sNew = Math.max(0, Math.min(1, s + (vibrance / 100) * (1 - s) * (1 - s)))
    return hslToRgb(h, sNew, l)
  })
  return (imageData: ImageData): void => {
    const d = imageData.data
    for (let j = 0; j < d.length; j += 4) {
      const [ro, go, bo] = sample3DLUT(lut, d[j], d[j + 1], d[j + 2])
      d[j] = ro; d[j + 1] = go; d[j + 2] = bo
    }
  }
}

function makeClarityFilter(clarity: number): (imageData: ImageData) => void {
  // 0.2 × 255 ≈ 51, 0.8 × 255 ≈ 204 — midtone range
  const scaleLUT = buildFloatLUT(`clarity_scale:${clarity}`, (lIdx) =>
    lIdx >= 51 && lIdx <= 204 ? 1 + clarity * 0.003 : 1
  )
  return (imageData: ImageData): void => {
    const d = imageData.data
    for (let j = 0; j < d.length; j += 4) {
      const scale = scaleLUT[(77 * d[j] + 150 * d[j + 1] + 29 * d[j + 2]) >> 8]
      d[j]     = Math.max(0, Math.min(255, Math.round(d[j]     * scale)))
      d[j + 1] = Math.max(0, Math.min(255, Math.round(d[j + 1] * scale)))
      d[j + 2] = Math.max(0, Math.min(255, Math.round(d[j + 2] * scale)))
    }
  }
}

function makeDehazeFilter(dehaze: number): (imageData: ImageData) => void {
  const contrastWeight = dehaze * 0.5
  const satWeight = dehaze * 0.5
  // Bake contrast S-curve + HSL saturation boost into a single 3D LUT.
  const combined3DLUT = build3DLUT(`dehaze3d:${dehaze}`, (r, g, b) => {
    const cr = Math.max(0, Math.min(255, Math.round(((r / 255 - 0.5) * (1 + contrastWeight / 100) + 0.5) * 255)))
    const cg = Math.max(0, Math.min(255, Math.round(((g / 255 - 0.5) * (1 + contrastWeight / 100) + 0.5) * 255)))
    const cb = Math.max(0, Math.min(255, Math.round(((b / 255 - 0.5) * (1 + contrastWeight / 100) + 0.5) * 255)))
    const [h, s, l] = rgbToHsl(cr, cg, cb)
    const sNew = Math.max(0, Math.min(1, s * (1 + satWeight / 100)))
    return hslToRgb(h, sNew, l)
  })
  return (imageData: ImageData): void => {
    const d = imageData.data
    for (let j = 0; j < d.length; j += 4) {
      const [ro, go, bo] = sample3DLUT(combined3DLUT, d[j], d[j + 1], d[j + 2])
      d[j] = ro; d[j + 1] = go; d[j + 2] = bo
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const pipelineCache = new Map<string, Array<(imageData: ImageData) => void>>()

function adjFingerprint(adj: PhotoAdjustments): string {
  return Object.values(adj).join(',')
}

export function buildFilterPipeline(adj: PhotoAdjustments): Array<(imageData: ImageData) => void> {
  if (isAllDefault(adj)) return []
  const key = adjFingerprint(adj)
  if (pipelineCache.has(key)) return pipelineCache.get(key)!
  const filters: Array<(imageData: ImageData) => void> = []
  if (adj.exposure !== 0)     filters.push(makeExposureFilter(adj.exposure))
  if (adj.contrast !== 0)     filters.push(makeContrastFilter(adj.contrast))
  if (adj.whites !== 0)       filters.push(makeWhitesFilter(adj.whites))
  if (adj.blacks !== 0)       filters.push(makeBlacksFilter(adj.blacks))
  if (adj.highlights !== 0)   filters.push(makeHighlightsFilter(adj.highlights))
  if (adj.shadows !== 0)      filters.push(makeShadowsFilter(adj.shadows))
  if (adj.temperature !== 0)  filters.push(makeTemperatureFilter(adj.temperature))
  if (adj.tint !== 0)         filters.push(makeTintFilter(adj.tint))
  if (adj.saturation !== 0)   filters.push(makeSaturationFilter(adj.saturation))
  if (adj.vibrance !== 0)     filters.push(makeVibranceFilter(adj.vibrance))
  if (adj.clarity !== 0)      filters.push(makeClarityFilter(adj.clarity))
  if (adj.dehaze !== 0)       filters.push(makeDehazeFilter(adj.dehaze))
  pipelineCache.set(key, filters)
  evict(pipelineCache)
  return filters
}
