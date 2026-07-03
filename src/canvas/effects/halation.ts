import { registerEffect } from './registry'
import type { EffectParams } from './registry'
import { hexToRgb } from '@/utils/color'

// Proper sliding-window box blur (handles edges correctly)
function boxBlurH(src: Float32Array, dst: Float32Array, width: number, height: number, r: number): void {
  const iarr = 1 / (r + r + 1)
  for (let i = 0; i < height; i++) {
    let ti = i * width
    let li = ti
    let ri = ti + r
    const fv = src[ti]
    const lv = src[ti + width - 1]
    let val = (r + 1) * fv
    for (let j = 0; j < r; j++) val += src[ti + j]
    for (let j = 0; j <= r; j++) { val += src[ri++] - fv;       dst[ti++] = val * iarr }
    for (let j = r + 1; j < width - r; j++) { val += src[ri++] - src[li++]; dst[ti++] = val * iarr }
    for (let j = width - r; j < width; j++) { val += lv - src[li++]; dst[ti++] = val * iarr }
  }
}

function boxBlurV(src: Float32Array, dst: Float32Array, width: number, height: number, r: number): void {
  const iarr = 1 / (r + r + 1)
  for (let i = 0; i < width; i++) {
    let ti = i
    let li = ti
    let ri = ti + r * width
    const fv = src[ti]
    const lv = src[ti + width * (height - 1)]
    let val = (r + 1) * fv
    for (let j = 0; j < r; j++) val += src[ti + j * width]
    for (let j = 0; j <= r; j++) {
      val += src[ri] - fv; dst[ti] = val * iarr; ri += width; ti += width
    }
    for (let j = r + 1; j < height - r; j++) {
      val += src[ri] - src[li]; dst[ti] = val * iarr; li += width; ri += width; ti += width
    }
    for (let j = height - r; j < height; j++) {
      val += lv - src[li]; dst[ti] = val * iarr; li += width; ti += width
    }
  }
}

registerEffect({
  type: 'halation',
  label: 'Halation',
  defaultParams: () => ({ color: '#ff6600', threshold: 0.7, radius: 20, opacity: 0.6 }),
  controls: [
    { key: 'color',     label: 'Color',     type: 'color' },
    { key: 'threshold', label: 'Threshold', type: 'slider', min: 0, max: 1,  step: 0.01 },
    { key: 'radius',    label: 'Radius',    type: 'slider', min: 1, max: 60, step: 1 },
    { key: 'opacity',   label: 'Opacity',   type: 'slider', min: 0, max: 1,  step: 0.01 },
  ],
  buildFilter(params: EffectParams): (imageData: ImageData) => void {
    const [cr, cg, cb] = hexToRgb(params.color as string)
    const threshold  = params.threshold as number
    const blurRadius = Math.round(params.radius  as number)
    const opacity    = params.opacity    as number

    return function halationFilter(imageData: ImageData): void {
      const { data, width, height } = imageData
      const len = width * height

      // Pass 1: extract bright luma mask — soft ramp above threshold
      const mask = new Float32Array(len)
      const invRange = 1 / Math.max(0.001, 1 - threshold)
      for (let i = 0; i < len; i++) {
        const r = data[i * 4]
        const g = data[i * 4 + 1]
        const b = data[i * 4 + 2]
        const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255
        mask[i] = luma > threshold ? (luma - threshold) * invRange : 0
      }

      // Pass 2: box blur H + V (two-pass separable, gives good spread)
      const tmp     = new Float32Array(len)
      const blurred = new Float32Array(len)
      boxBlurH(mask, tmp,     width, height, blurRadius)
      boxBlurV(tmp,  blurred, width, height, blurRadius)

      // Pass 3: screen-blend tinted glow over original
      // Tint: blurred mask × color, scaled by opacity
      const sr = cr / 255
      const sg = cg / 255
      const sb = cb / 255
      for (let i = 0; i < len; i++) {
        const w = blurred[i] * opacity
        if (w <= 0) continue
        const pi = i * 4
        // Glow layer: tinted bright, in 0–255 space
        const glowR = sr * w * 255
        const glowG = sg * w * 255
        const glowB = sb * w * 255
        // Screen blend: result = 255 - (255-src)(255-over)/255
        data[pi]     = Math.min(255, Math.round(255 - (255 - data[pi])     * (255 - glowR) / 255))
        data[pi + 1] = Math.min(255, Math.round(255 - (255 - data[pi + 1]) * (255 - glowG) / 255))
        data[pi + 2] = Math.min(255, Math.round(255 - (255 - data[pi + 2]) * (255 - glowB) / 255))
      }
    }
  },
})
