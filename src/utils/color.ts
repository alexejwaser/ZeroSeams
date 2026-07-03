// Shared color-conversion and clamp helpers. Domain-neutral: importable from
// canvas/, ui/, and ai/ alike; must never import from those domains.
//
// All functions are pure and module-level — pipeline.ts calls the HSL pair
// inside per-pixel LUT builds, so no per-call closure allocation beyond the
// existing hue() helper.

export function clamp(v: number, min?: number, max?: number): number {
  if (min !== undefined && v < min) return min
  if (max !== undefined && v > max) return max
  return v
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0'))
      .join('')
  )
}

/** r/g/b in 0–255 → h/s/l normalized to 0–1. */
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
  else if (max === gn) h = ((bn - rn) / d + 2) / 6
  else h = ((rn - gn) / d + 4) / 6
  return [h, s, l]
}

/** h/s/l normalized to 0–1 → r/g/b rounded to 0–255. */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255)
    return [v, v, v]
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  function hue(t: number): number {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  return [
    Math.round(hue(h + 1 / 3) * 255),
    Math.round(hue(h) * 255),
    Math.round(hue(h - 1 / 3) * 255),
  ]
}

/** hex → h in degrees, s/l in percent, all rounded — UI display form. */
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const [r, g, b] = hexToRgb(hex)
  const [h, s, l] = rgbToHsl(r, g, b)
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
}

/** h in degrees, s/l in percent → hex. */
export function hslToHex(h: number, s: number, l: number): string {
  const hn = (((h % 360) + 360) % 360) / 360
  const [r, g, b] = hslToRgb(hn, s / 100, l / 100)
  return rgbToHex(r, g, b)
}
