import React, { useEffect, useRef, useState, useCallback } from 'react'
import type Konva from 'konva'
import type { VideoObject } from '@/types/canvas'
import { useCanvasStore } from '@/canvas/useCanvasStore'
import { getStageInstance } from '@/canvas/CarouselStage'
import { getShell } from './shells/registry'

import './shells/InstagramShell'
import './shells/TikTokShell'
import './shells/FacebookShell'
import './shells/ThreadsShell'

// ---------------------------------------------------------------------------
// Frame capture
// ---------------------------------------------------------------------------

async function capturePreviewFrames(
  stage: Konva.Stage,
  frameCount: number,
  frameWidth: number,
  frameHeight: number,
): Promise<string[]> {
  // Exit any open clip-edit session so its ClipEditOverlay isn't captured into the
  // preview JPEGs (mirrors exportFrames.ts).
  useCanvasStore.getState().clearClipEditMode()

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

  const urls: string[] = []
  try {
    const fullCanvas = stage.toCanvas({ pixelRatio: 1 })
    for (let i = 0; i < frameCount; i++) {
      const crop = document.createElement('canvas')
      crop.width = frameWidth
      crop.height = frameHeight
      const ctx = crop.getContext('2d')
      if (ctx) ctx.drawImage(fullCanvas, i * frameWidth, 0, frameWidth, frameHeight, 0, 0, frameWidth, frameHeight)
      urls.push(crop.toDataURL('image/jpeg', 0.9))
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
  return urls
}

// ---------------------------------------------------------------------------
// Video overlay — one <video> per VideoObject visible in the frame
// ---------------------------------------------------------------------------

interface VideoOverlayItemProps {
  obj: VideoObject
  scale: number       // displayWidth / frameWidth
  frameLeft: number   // i * frameWidth (canvas x of frame's left edge)
}

function VideoOverlayItem({ obj, scale, frameLeft }: VideoOverlayItemProps): React.ReactElement {
  const videoRef = useRef<HTMLVideoElement>(null)

  // Seek to trimStart on first canplay (mirrors CanvasVideoNode behaviour)
  useEffect(() => {
    const vid = videoRef.current
    if (!vid) return
    const seekToTrim = (): void => {
      vid.currentTime = obj.trimStart ?? 0
    }
    vid.addEventListener('canplay', seekToTrim, { once: true })
    return () => vid.removeEventListener('canplay', seekToTrim)
  }, [obj.trimStart])

  // Handle trimEnd looping manually when trimEnd is set
  useEffect(() => {
    const vid = videoRef.current
    if (!vid || obj.trimEnd == null) return
    const trimEnd = obj.trimEnd
    const trimStart = obj.trimStart ?? 0
    const check = (): void => {
      if (vid.currentTime >= trimEnd) vid.currentTime = trimStart
    }
    vid.addEventListener('timeupdate', check)
    return () => vid.removeEventListener('timeupdate', check)
  }, [obj.trimStart, obj.trimEnd])

  const previewX = (obj.x - frameLeft) * scale
  const previewY = obj.y * scale
  const previewW = obj.frameWidth * scale
  const previewH = obj.frameHeight * scale

  // Content model: video bitmap is offset and scaled inside the frame (crop box)
  const cOffX = obj.contentOffsetX * scale
  const cOffY = obj.contentOffsetY * scale
  const cW = obj.contentWidth * scale
  const cH = obj.contentHeight * scale

  return (
    <div
      style={{
        position: 'absolute',
        left: previewX,
        top: previewY,
        width: previewW,
        height: previewH,
        overflow: 'hidden',
        transform: obj.rotation ? `rotate(${obj.rotation}deg)` : undefined,
        transformOrigin: 'center center',
      }}
    >
      <video
        ref={videoRef}
        src={`zeroseams-media://${obj.filePath}`}
        style={{
          position: 'absolute',
          left: cOffX,
          top: cOffY,
          width: cW,
          height: cH,
          pointerEvents: 'none',
        }}
        autoPlay
        loop={obj.trimEnd == null}   // native loop only when no trimEnd; otherwise handled above
        muted                         // always muted in preview (mirrors canvas preview)
        playsInline
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// FrameSlide — static image + live video overlays for one frame
// ---------------------------------------------------------------------------

interface FrameSlideProps {
  staticSrc: string
  displayWidth: number
  displayHeight: number
  videoObjects: VideoObject[]
  scale: number
  frameLeft: number
}

function FrameSlide({ staticSrc, displayWidth, displayHeight, videoObjects, scale, frameLeft }: FrameSlideProps): React.ReactElement {
  return (
    <div style={{ position: 'relative', width: displayWidth, height: displayHeight, flexShrink: 0 }}>
      {/* Static capture — background for all non-video layers */}
      <img
        src={staticSrc}
        width={displayWidth}
        height={displayHeight}
        draggable={false}
        style={{ display: 'block' }}
        alt=""
      />
      {/* Live video overlays */}
      {videoObjects.map((obj) => (
        <VideoOverlayItem key={obj.id} obj={obj} scale={scale} frameLeft={frameLeft} />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Swipe / navigation constants
// ---------------------------------------------------------------------------

const SWIPE_EASE = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
const SWIPE_THRESHOLD = 55

// ---------------------------------------------------------------------------
// PreviewShell — main overlay component
// ---------------------------------------------------------------------------

export function PreviewShell(): React.ReactElement | null {
  const previewMode = useCanvasStore((s) => s.previewMode)
  const platform = useCanvasStore((s) => s.platform)
  const ratio = useCanvasStore((s) => s.ratio)
  const frameCount = useCanvasStore((s) => s.frameCount)
  const frameWidth = useCanvasStore((s) => s.frameWidth)
  const frameHeight = useCanvasStore((s) => s.frameHeight)
  const previewFrame = useCanvasStore((s) => s.previewFrame)
  const setPreviewFrame = useCanvasStore((s) => s.setPreviewFrame)
  const togglePreviewMode = useCanvasStore((s) => s.togglePreviewMode)
  const objects = useCanvasStore((s) => s.objects)
  const objectOrder = useCanvasStore((s) => s.objectOrder)

  const [frameImages, setFrameImages] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(900)

  const isDraggingRef = useRef(false)
  const dragStartXRef = useRef(0)
  const [dragOffset, setDragOffset] = useState(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => setContainerWidth(entries[0].contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Capture static frames on preview open
  useEffect(() => {
    if (!previewMode) { setFrameImages([]); return }
    const stage = getStageInstance()
    if (!stage) return
    setLoading(true)
    capturePreviewFrames(stage, frameCount, frameWidth, frameHeight)
      .then((urls) => { setFrameImages(urls); setLoading(false) })
      .catch(() => setLoading(false))
  }, [previewMode, frameCount, frameWidth, frameHeight])

  // Keyboard navigation
  useEffect(() => {
    if (!previewMode) return
    const handler = (e: KeyboardEvent): void => {
      const { previewFrame: f, frameCount: n, setPreviewFrame: sp } = useCanvasStore.getState()
      if (e.key === 'ArrowRight') sp(Math.min(n - 1, f + 1))
      else if (e.key === 'ArrowLeft') sp(Math.max(0, f - 1))
      else if (e.key === 'Escape') togglePreviewMode()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [previewMode, togglePreviewMode])

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    isDraggingRef.current = true
    dragStartXRef.current = e.clientX
    setDragOffset(0)
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return
    const delta = e.clientX - dragStartXRef.current
    const { previewFrame: f, frameCount: n } = useCanvasStore.getState()
    const atEdge = (f === 0 && delta > 0) || (f === n - 1 && delta < 0)
    setDragOffset(atEdge ? delta * 0.25 : delta)
  }, [])

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false
    const delta = e.clientX - dragStartXRef.current
    const { previewFrame: f, frameCount: n, setPreviewFrame: sp } = useCanvasStore.getState()
    if (delta < -SWIPE_THRESHOLD) sp(Math.min(n - 1, f + 1))
    else if (delta > SWIPE_THRESHOLD) sp(Math.max(0, f - 1))
    setDragOffset(0)
  }, [])

  if (!previewMode) return null

  const displayWidth = Math.min(390, Math.floor(containerWidth * 0.72))
  const displayHeight = Math.round(displayWidth * frameHeight / frameWidth)
  const scale = displayWidth / frameWidth
  const ShellComponent = getShell(platform)

  // Find videos visible in each frame
  const videosByFrame: VideoObject[][] = Array.from({ length: frameCount }, (_, i) => {
    const frameLeft = i * frameWidth
    const frameRight = frameLeft + frameWidth
    return objectOrder
      .map((id) => objects[id])
      .filter((obj): obj is VideoObject =>
        obj?.type === 'video' &&
        obj.x < frameRight &&
        obj.x + obj.frameWidth > frameLeft,
      )
  })

  const frameContent = (
    <div
      style={{
        width: displayWidth,
        height: displayHeight,
        overflow: 'hidden',
        flexShrink: 0,
        userSelect: 'none',
        touchAction: 'none',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {loading ? (
        <div
          style={{
            width: displayWidth,
            height: displayHeight,
            background: '#f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ color: '#999', fontSize: 13 }}>Loading…</span>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            transform: `translateX(${-(previewFrame * displayWidth) + dragOffset}px)`,
            transition: isDraggingRef.current ? 'none' : `transform 0.32s ${SWIPE_EASE}`,
            willChange: 'transform',
          }}
        >
          {frameImages.map((src, i) => (
            <FrameSlide
              key={i}
              staticSrc={src}
              displayWidth={displayWidth}
              displayHeight={displayHeight}
              videoObjects={videosByFrame[i] ?? []}
              scale={scale}
              frameLeft={i * frameWidth}
            />
          ))}
        </div>
      )}
    </div>
  )

  const canGoPrev = previewFrame > 0
  const canGoNext = previewFrame < frameCount - 1

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <button
        onClick={togglePreviewMode}
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          zIndex: 1010,
          background: 'rgba(255,255,255,0.15)',
          border: 'none',
          color: '#fff',
          width: 28,
          height: 28,
          borderRadius: 14,
          cursor: 'pointer',
          fontSize: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        &times;
      </button>

      {canGoPrev && (
        <button
          onClick={() => setPreviewFrame(previewFrame - 1)}
          style={{
            position: 'absolute',
            left: 16,
            zIndex: 1010,
            background: 'rgba(255,255,255,0.15)',
            border: 'none',
            color: '#fff',
            width: 36,
            height: 36,
            borderRadius: 18,
            cursor: 'pointer',
            fontSize: 22,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ‹
        </button>
      )}

      {canGoNext && (
        <button
          onClick={() => setPreviewFrame(previewFrame + 1)}
          style={{
            position: 'absolute',
            right: 52,
            zIndex: 1010,
            background: 'rgba(255,255,255,0.15)',
            border: 'none',
            color: '#fff',
            width: 36,
            height: 36,
            borderRadius: 18,
            cursor: 'pointer',
            fontSize: 22,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ›
        </button>
      )}

      {ShellComponent != null ? (
        <ShellComponent
          ratio={ratio}
          currentFrame={previewFrame}
          totalFrames={frameCount}
          onFrameChange={setPreviewFrame}
          frameDisplayWidth={displayWidth}
          frameDisplayHeight={displayHeight}
          profile={{ name: 'zeroseams', verified: false }}
        >
          {frameContent}
        </ShellComponent>
      ) : (
        frameContent
      )}
    </div>
  )
}
