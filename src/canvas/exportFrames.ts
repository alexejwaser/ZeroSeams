import type Konva from 'konva'
import type { CanvasObject, VideoObject, VideoExportSettings } from '../types/canvas'
import { getVideoElement } from './videoElementRegistry'
import { encodeVideoFrames, encodeVideoWithAudio } from './videoExport'

/**
 * Exports each carousel frame as a PNG Blob at 2x pixel ratio (2160×2160 for
 * 1080×1080 frames).
 *
 * Konva v9 stage.toCanvas() does not support cropping via { x, y, width, height }
 * — it always outputs the full stage canvas. The workaround:
 *   1. Temporarily set stage scale to 1 and resize to full logical dimensions.
 *   2. Call stage.toCanvas({ pixelRatio: 2 }) to get the full canvas at 2x.
 *   3. Crop each frame manually using Canvas 2D drawImage.
 *   4. Restore stage to its display state in the finally block.
 */
export async function exportFrames(
  stage: Konva.Stage,
  frameCount: number,
  frameWidth: number,
  frameHeight: number,
  startFrame = 0,
  endFrame = frameCount - 1,
): Promise<Blob[]> {
  // 1. Hide Transformer handles so selection UI is absent from export
  const transformers = stage.find<Konva.Transformer>('Transformer')
  transformers.forEach((t) => t.hide())

  // Restore text node opacity for export (nodes are kept at 0 during normal display
  // because a persistent HTML overlay handles rich-text rendering instead).
  const textNodes = stage.find<Konva.Text>('Text')
  textNodes.forEach((n) => {
    const userOpacity = n.getAttr('userOpacity') as number | undefined
    n.opacity(userOpacity ?? 1)
  })

  // 2. Hide frame guides (background rects) and divider lines
  const guidesLayer = stage.findOne<Konva.Layer>('.guides')
  if (guidesLayer) guidesLayer.hide()
  const dividersLayer = stage.findOne<Konva.Layer>('.frame-dividers')
  if (dividersLayer) dividersLayer.hide()

  // 3. Save current stage dimensions/scale/position and switch to full 1:1 resolution
  const origWidth = stage.width()
  const origHeight = stage.height()
  const origScaleX = stage.scaleX()
  const origScaleY = stage.scaleY()
  const origX = stage.x()
  const origY = stage.y()

  stage.width(frameCount * frameWidth)
  stage.height(frameHeight)
  stage.scaleX(1)
  stage.scaleY(1)
  stage.x(0)
  stage.y(0)
  stage.draw()

  const blobs: Blob[] = []

  try {
    // Render the full canvas once at 2x. stage.toCanvas({ x, y, width, height })
    // in Konva v9 does NOT crop — it always outputs the full stage dimensions.
    // Instead we export the whole thing and crop each frame manually via drawImage.
    const PIXEL_RATIO = 2
    const fullCanvas = stage.toCanvas({ pixelRatio: PIXEL_RATIO })
    // fullCanvas is now (frameCount * frameWidth * PIXEL_RATIO) × (frameHeight * PIXEL_RATIO)
    console.log('[export] fullCanvas:', fullCanvas.width, '×', fullCanvas.height)

    for (let i = startFrame; i <= endFrame; i++) {
      const cropCanvas = document.createElement('canvas')
      cropCanvas.width = frameWidth * PIXEL_RATIO
      cropCanvas.height = frameHeight * PIXEL_RATIO

      const ctx = cropCanvas.getContext('2d')
      if (!ctx) throw new Error(`Failed to get 2d context for frame ${i}`)

      ctx.drawImage(
        fullCanvas,
        i * frameWidth * PIXEL_RATIO, 0,             // source origin
        frameWidth * PIXEL_RATIO, frameHeight * PIXEL_RATIO, // source size
        0, 0,                                         // dest origin
        frameWidth * PIXEL_RATIO, frameHeight * PIXEL_RATIO, // dest size
      )

      const blob = await new Promise<Blob | null>((resolve) => {
        cropCanvas.toBlob((b) => resolve(b), 'image/png')
      })

      console.log(`[export] frame ${i}: src x=${i * frameWidth * PIXEL_RATIO} blob=${blob ? blob.size : 'NULL'}`)
      if (blob) blobs.push(blob)
    }
  } finally {
    // Restore stage to display state
    stage.width(origWidth)
    stage.height(origHeight)
    stage.scaleX(origScaleX)
    stage.scaleY(origScaleY)
    stage.x(origX)
    stage.y(origY)
    stage.draw()

    if (guidesLayer) guidesLayer.show()
    if (dividersLayer) dividersLayer.show()
    transformers.forEach((t) => t.show())
    textNodes.forEach((n) => n.opacity(0))
  }

  return blobs
}

/**
 * Saves each frame PNG to ~/Downloads via Electron IPC.
 * Anchor-click downloads are blocked by Electron's Chromium for multi-file
 * sequences — IPC + fs.writeFile is the reliable alternative.
 */
export async function downloadFrames(blobs: Blob[]): Promise<void> {
  for (let i = 0; i < blobs.length; i++) {
    const filename = `frame-${i + 1}.png`

    // Convert Blob → base64 via FileReader (handles large files safely)
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        resolve(dataUrl.split(',')[1])
      }
      reader.onerror = () => reject(new Error('FileReader failed'))
      reader.readAsDataURL(blobs[i])
    })

    const result = await window.electronAPI.saveFile(filename, base64)
    console.log(
      `[download] ${filename}: ${result.success ? 'saved to ~/Downloads' : 'ERROR: ' + result.error}`,
    )
  }
}

export type ExportResult =
  | { frameIndex: number; type: 'png'; blob: Blob }
  | { frameIndex: number; type: 'mp4'; blob: Blob }

const EXPORT_FPS = 30

async function captureVideoFrameSequence(
  stage: Konva.Stage,
  frameIndex: number,
  frameWidth: number,
  frameHeight: number,
  fps: number,
  durationSeconds: number,
  videoElements: HTMLVideoElement[],
  onFrame?: (f: number) => void,
  clipStart = 0,
): Promise<Blob[]> {
  const PIXEL_RATIO = 2
  const totalFrames = Math.ceil(durationSeconds * fps)
  const pngBlobs: Blob[] = []

  for (let f = 0; f < totalFrames; f++) {
    onFrame?.(f + 1)
    const t = clipStart + f / fps
    await Promise.all(
      videoElements.map(
        (v) =>
          new Promise<void>((resolve) => {
            v.onseeked = () => resolve()
            v.currentTime = t
          }),
      ),
    )
    stage.draw()
    const full = stage.toCanvas({ pixelRatio: PIXEL_RATIO })
    const cropCanvas = document.createElement('canvas')
    cropCanvas.width = frameWidth * PIXEL_RATIO
    cropCanvas.height = frameHeight * PIXEL_RATIO
    const ctx = cropCanvas.getContext('2d')
    if (!ctx) throw new Error(`No 2d context for video frame ${f}`)
    ctx.drawImage(
      full,
      frameIndex * frameWidth * PIXEL_RATIO, 0,
      frameWidth * PIXEL_RATIO, frameHeight * PIXEL_RATIO,
      0, 0,
      frameWidth * PIXEL_RATIO, frameHeight * PIXEL_RATIO,
    )
    const blob = await new Promise<Blob | null>((resolve) => {
      cropCanvas.toBlob((b) => resolve(b), 'image/png')
    })
    if (blob) pngBlobs.push(blob)
  }

  return pngBlobs
}

export async function exportMixedFrames(
  stage: Konva.Stage,
  objects: Record<string, CanvasObject>,
  frameCount: number,
  frameWidth: number,
  frameHeight: number,
  startFrame?: number,
  endFrame?: number,
  onStatus?: (msg: string) => void,
  isCancelled?: () => boolean,
  exportSettings?: VideoExportSettings,
): Promise<ExportResult[]> {
  const start = startFrame ?? 0
  const end = endFrame ?? frameCount - 1

  const transformers = stage.find<Konva.Transformer>('Transformer')
  transformers.forEach((t) => t.hide())
  const textNodes = stage.find<Konva.Text>('Text')
  textNodes.forEach((n) => {
    const userOpacity = n.getAttr('userOpacity') as number | undefined
    n.opacity(userOpacity ?? 1)
  })
  const guidesLayer = stage.findOne<Konva.Layer>('.guides')
  if (guidesLayer) guidesLayer.hide()
  const dividersLayer = stage.findOne<Konva.Layer>('.frame-dividers')
  if (dividersLayer) dividersLayer.hide()

  const origWidth = stage.width()
  const origHeight = stage.height()
  const origScaleX = stage.scaleX()
  const origScaleY = stage.scaleY()
  const origX = stage.x()
  const origY = stage.y()

  stage.width(frameCount * frameWidth)
  stage.height(frameHeight)
  stage.scaleX(1)
  stage.scaleY(1)
  stage.x(0)
  stage.y(0)
  stage.draw()

  const results: ExportResult[] = []

  try {
    const PIXEL_RATIO = 2

    for (let i = start; i <= end; i++) {
      if (isCancelled?.()) throw new Error('Export cancelled')
      const frameLeft = i * frameWidth
      const frameRight = (i + 1) * frameWidth

      const videoObjectsInFrame = Object.values(objects).filter(
        (obj): obj is VideoObject =>
          obj.type === 'video' &&
          obj.visible &&
          obj.frameX < frameRight &&
          obj.frameX + obj.frameWidth > frameLeft,
      )

      if (videoObjectsInFrame.length === 0) {
        // Static frame — PNG export
        const fullCanvas = stage.toCanvas({ pixelRatio: PIXEL_RATIO })
        const cropCanvas = document.createElement('canvas')
        cropCanvas.width = frameWidth * PIXEL_RATIO
        cropCanvas.height = frameHeight * PIXEL_RATIO
        const ctx = cropCanvas.getContext('2d')
        if (!ctx) throw new Error(`No 2d context for frame ${i}`)
        ctx.drawImage(
          fullCanvas,
          i * frameWidth * PIXEL_RATIO, 0,
          frameWidth * PIXEL_RATIO, frameHeight * PIXEL_RATIO,
          0, 0,
          frameWidth * PIXEL_RATIO, frameHeight * PIXEL_RATIO,
        )
        const blob = await new Promise<Blob | null>((resolve) => {
          cropCanvas.toBlob((b) => resolve(b), 'image/png')
        })
        if (blob) results.push({ frameIndex: i, type: 'png', blob })
      } else {
        // Video frame — capture frame sequence and encode to MP4
        onStatus?.(`Rendering video frame ${i + 1}…`)
        const videoEls = videoObjectsInFrame
          .map((obj) => getVideoElement(obj.id))
          .filter((el): el is HTMLVideoElement => el !== undefined)

        // Use the longest trimmed clip duration visible in this frame, respecting trimStart/trimEnd.
        const clipStarts = videoObjectsInFrame.map((obj) => obj.trimStart ?? 0)
        const clipEnds = videoObjectsInFrame.map((obj) => {
          const end = obj.trimEnd ?? obj.naturalDuration
          return isFinite(end) && end > 0 ? end : null
        })
        let clipStart = clipStarts[0] ?? 0
        let clipEnd = clipEnds[0] ?? null
        for (let k = 1; k < videoObjectsInFrame.length; k++) {
          const candidateDur = (clipEnds[k] ?? 0) - clipStarts[k]
          const currentDur = (clipEnd ?? 0) - clipStart
          if (candidateDur > currentDur) {
            clipStart = clipStarts[k]
            clipEnd = clipEnds[k]
          }
        }
        if (clipEnd === null || !isFinite(clipEnd) || clipEnd <= clipStart) {
          const liveDur = Math.max(...videoEls.map((v) => v.duration).filter(isFinite))
          clipEnd = isFinite(liveDur) && liveDur > 0 ? liveDur : clipStart + 5
        }
        const duration = clipEnd - clipStart

        // Pause all video elements during seek-based capture
        videoEls.forEach((v) => v.pause())

        const totalFramesToCapture = Math.ceil(duration * EXPORT_FPS)
        console.log(`[exportFrames] frame ${i}: capturing ${totalFramesToCapture} video frames (${duration.toFixed(2)}s @ ${EXPORT_FPS}fps, clip ${clipStart.toFixed(2)}–${clipEnd.toFixed(2)})`)
        onStatus?.(`Capturing frame ${i + 1} (0/${totalFramesToCapture})…`)

        const pngBlobs = await captureVideoFrameSequence(
          stage,
          i,
          frameWidth,
          frameHeight,
          EXPORT_FPS,
          duration,
          videoEls,
          (f) => onStatus?.(`Capturing frame ${i + 1} (${f}/${totalFramesToCapture})…`),
          clipStart,
        )
        console.log(`[exportFrames] frame ${i}: captured ${pngBlobs.length} PNG blobs`)

        // Resume playback after capture
        videoEls.forEach((v) => void v.play())

        // Find first unmuted video object to mix in audio
        const audioSource = videoObjectsInFrame.find((obj) => !obj.muted)
        let mp4Blob: Blob
        if (audioSource) {
          mp4Blob = await encodeVideoWithAudio(pngBlobs, EXPORT_FPS, frameWidth, frameHeight, audioSource.filePath, onStatus, exportSettings)
        } else {
          mp4Blob = await encodeVideoFrames(pngBlobs, EXPORT_FPS, frameWidth, frameHeight, onStatus, exportSettings)
        }
        results.push({ frameIndex: i, type: 'mp4', blob: mp4Blob })
      }
    }
  } finally {
    stage.width(origWidth)
    stage.height(origHeight)
    stage.scaleX(origScaleX)
    stage.scaleY(origScaleY)
    stage.x(origX)
    stage.y(origY)
    stage.draw()
    if (guidesLayer) guidesLayer.show()
    if (dividersLayer) dividersLayer.show()
    transformers.forEach((t) => t.show())
    textNodes.forEach((n) => n.opacity(0))
  }

  return results
}
