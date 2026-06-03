import React, { useRef, useEffect, useState, useMemo } from 'react'
import { Group, Image as KonvaImage, Rect, Transformer, Shape, Circle, Line } from 'react-konva'
import type Konva from 'konva'
import type { VideoObject, AnchorPoint } from '@/types/canvas'
import { DEFAULT_ADJUSTMENTS } from '@/types/canvas'
import { useCanvasStore } from './useCanvasStore'
import { useSnapGuides } from './useSnapGuides'
import type { SnapGuide } from './useSnapGuides'
import { CANVAS_SCALE, axisLock } from './constants'
import { useViewportStore } from './useViewportStore'
import { registerVideoElement, unregisterVideoElement } from './videoElementRegistry'
import { anchorsToPathData } from './CanvasPathNode'
import { buildFilterPipeline } from './adjustments/pipeline'
import { buildEffectFilters } from './effects/buildEffectFilters'

interface CanvasVideoNodeProps {
  id: string
  onGuidesChange: (guides: SnapGuide[]) => void
  nodeRef?: React.RefObject<Konva.Node>
}

interface CanvasVideoNodeInnerProps extends CanvasVideoNodeProps {
  obj: VideoObject
}

function CanvasVideoNodeInner({ id, obj, onGuidesChange, nodeRef }: CanvasVideoNodeInnerProps): React.ReactElement | null {
  const isSelected = useCanvasStore((s) => s.selectedId === id)
  const isPlaying = useCanvasStore((s) => s.videoPlayingIds.has(id))
  const toggleVideoPlay = useCanvasStore((s) => s.toggleVideoPlay)
  const commitUpdate = useCanvasStore((s) => s.commitUpdate)
  const updateObject = useCanvasStore((s) => s.updateObject)
  const selectedIds = useCanvasStore((s) => s.selectedIds)
  const addToSelection = useCanvasStore((s) => s.addToSelection)
  const anchorId = useCanvasStore((s) => s.anchorId)
  const setAnchor = useCanvasStore((s) => s.setAnchor)
  const duplicateObjectAtOrigin = useCanvasStore((s) => s.duplicateObjectAtOrigin)
  const setContextMenu = useCanvasStore((s) => s.setContextMenu)
  const resizeMode = useCanvasStore((s) => s.resizeMode)
  const maskDrawMode = useCanvasStore((s) => s.maskDrawMode)
  const isDrawTarget = maskDrawMode?.id === id
  const maskModeActive = useCanvasStore((s) => s.maskModeActive)
  const adjustmentsBypass = useCanvasStore((s) => s.adjustmentsBypass)
  const activeTool = useCanvasStore((s) => s.activeTool)
  const { zoom, panX, panY } = useViewportStore((s) => ({ zoom: s.zoom, panX: s.panX, panY: s.panY }))
  const snapEnabled = useCanvasStore((s) => s.snapEnabled)

  const isInMultiSelectMode = selectedIds.length > 1
  const isAnchor = anchorId === id
  const { computeSnap, computeSnapResize, snapRotation } = useSnapGuides()

  const frameRectRef = useRef<Konva.Rect>(null)
  const groupRef = useRef<Konva.Group>(null)
  const innerGroupRef = useRef<Konva.Group>(null)
  const videoImageRef = useRef<Konva.Image>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const maskEditRectRef = useRef<Konva.Rect>(null)
  const maskEditTransformerRef = useRef<Konva.Transformer>(null)
  const cmdHeldRef = useRef(false)
  const pendingGuidesRef = useRef<SnapGuide[]>([])
  const rectMouseDownPosRef = useRef<{ x: number; y: number } | null>(null)
  const altHeldRef = useRef(false)
  const dragStartFrameXRef = useRef(0)
  const dragStartFrameYRef = useRef(0)
  const contentDragStartRef = useRef<{ x: number; y: number } | null>(null)
  const pendingDuplicateRef = useRef(false)
  const rafRef = useRef<number | null>(null)
  // Stores active mask cache bounds so the RAF tick can re-cache each frame.
  // null when no mask is active (caching disabled).
  const innerCacheBoundsRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null)
  // Countdown (seconds) before playback starts after a play command — drives start offset.
  const startOffsetRemainingRef = useRef(0)
  // Timestamp of the last RAF tick for delta-time calculation.
  const lastTickTimeRef = useRef<number | null>(null)
  // Last video.currentTime at which cache() ran — skip re-cache when frame unchanged.
  const lastCachedTimeRef = useRef<number>(-1)

  // The video element is created imperatively and passed as Konva image source.
  // videoEl state triggers a re-render so KonvaImage picks up the element after
  // it fires loadeddata.
  const videoElRef = useRef<HTMLVideoElement | null>(null)
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null)

  // Create video element and keep it in sync with obj.filePath.
  useEffect(() => {
    const vid = document.createElement('video')
    vid.autoplay = false
    vid.loop = true
    vid.playsInline = true
    vid.muted = true
    vid.crossOrigin = 'anonymous'
    videoElRef.current = vid

    function onLoaded(): void {
      // Always seek — even to 0. Chromium only decodes a displayable frame for
      // drawImage() once currentTime has been explicitly assigned (canplay alone
      // is not sufficient in some Electron builds).
      vid.currentTime = obj.posterFrame ?? obj.trimStart ?? 0
      setVideoEl(vid)
      registerVideoElement(id, vid)
      // Do not auto-play — playback is gated on videoPlayingIds in a separate effect.
    }
    // canplay fires when the browser has decoded at least one frame and can start playing.
    // loadedmetadata only guarantees readyState=1 (no pixel data) — drawImage paints nothing.
    vid.addEventListener('canplay', onLoaded, { once: true })
    vid.addEventListener('error', () => {
      console.error('[CanvasVideoNode] video load error', vid.error?.message, 'src:', vid.src)
    }, { once: true })
    // Use localhost as an explicit host — Chromium with standard: true normalizes
    // triple-slash URLs (zeroseams-media:///path) by treating the first path segment
    // as hostname, which drops and lowercases it. localhost avoids that.
    vid.src = `zeroseams-media://localhost${obj.filePath}`
    vid.load()

    return () => {
      vid.pause()
      vid.src = ''
      unregisterVideoElement(id)
      videoElRef.current = null
      setVideoEl(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, obj.filePath])

  // RAF loop — keeps Konva repainting, enforces trim boundaries, and handles start offset.
  useEffect(() => {
    if (!videoEl) return

    function tick(now: number): void {
      // Start-offset countdown: hold poster frame until delay elapses, then play.
      if (startOffsetRemainingRef.current > 0) {
        const last = lastTickTimeRef.current ?? now
        const delta = (now - last) / 1000
        lastTickTimeRef.current = now
        startOffsetRemainingRef.current = Math.max(0, startOffsetRemainingRef.current - delta)
        if (startOffsetRemainingRef.current <= 0) {
          videoEl.play().catch((e: unknown) => {
            console.warn('[CanvasVideoNode] play() after offset rejected:', e)
          })
        }
        const layer = groupRef.current?.getLayer()
        if (layer) layer.batchDraw()
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      lastTickTimeRef.current = now

      const end = obj.trimEnd ?? obj.naturalDuration
      const start = obj.trimStart ?? 0
      if (videoEl!.currentTime >= end) {
        videoEl!.currentTime = start
        if (!(obj.loop ?? true)) {
          videoEl!.pause()
          // Seek to poster frame when stopped
          videoEl!.currentTime = obj.posterFrame ?? start
          // Sync store so the play button reflects paused state
          const store = useCanvasStore.getState()
          if (store.videoPlayingIds.has(id)) store.toggleVideoPlay(id)
        }
      }
      // Re-cache only when a new video frame has been decoded — skips redundant
      // cache() calls at 60fps when the video is paused or running below 60fps.
      const currentTime = videoEl.currentTime
      const frameChanged = currentTime !== lastCachedTimeRef.current
      if (frameChanged) {
        lastCachedTimeRef.current = currentTime
        const bounds = innerCacheBoundsRef.current
        if (bounds) {
          if (allFiltersRef.current.length > 0) videoImageRef.current?.cache()
          innerGroupRef.current?.cache(bounds)
        } else if (allFiltersRef.current.length > 0) {
          videoImageRef.current?.cache()
        }
      }
      const layer = groupRef.current?.getLayer()
      if (layer && frameChanged) layer.batchDraw()
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
    // obj.trimStart/End/loop/naturalDuration intentionally omitted — tick reads
    // obj via closure from the outer component render, which re-runs this effect
    // whenever videoEl changes. Trim re-seek is handled by a separate effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoEl])

  // Play/pause gating — drive the video element from the store flag.
  useEffect(() => {
    if (!videoEl) return
    if (isPlaying) {
      const delay = obj.startOffset ?? 0
      if (delay > 0) {
        // Hold at poster frame during the delay; RAF loop will call play() once elapsed.
        videoEl.currentTime = obj.posterFrame ?? obj.trimStart ?? 0
        startOffsetRemainingRef.current = delay
        lastTickTimeRef.current = null
      } else {
        startOffsetRemainingRef.current = 0
        videoEl.play().catch((e: unknown) => {
          console.warn('[CanvasVideoNode] play() rejected:', e)
        })
      }
    } else {
      startOffsetRemainingRef.current = 0
      videoEl.pause()
      // Return to poster frame when stopped
      videoEl.currentTime = obj.posterFrame ?? obj.trimStart ?? 0
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, videoEl])

  // Re-seek when trim points change — clamp current time into the new range.
  useEffect(() => {
    if (!videoEl) return
    const start = obj.trimStart ?? 0
    const end = obj.trimEnd ?? obj.naturalDuration
    if (videoEl.currentTime < start || videoEl.currentTime > end) {
      videoEl.currentTime = start
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obj.trimStart, obj.trimEnd])

  const groupClip = useMemo(
    () => ({ x: 0, y: 0, width: obj.frameWidth, height: obj.frameHeight }),
    [obj.frameWidth, obj.frameHeight],
  )

  const filterPipeline = useMemo(
    () => adjustmentsBypass ? [] : buildFilterPipeline(obj.adjustments ?? DEFAULT_ADJUSTMENTS),
    [obj.adjustments, adjustmentsBypass],
  )
  const effectFilters = useMemo(
    () => buildEffectFilters(obj.effects),
    [obj.effects],
  )
  const allFilters = useMemo(
    () => [...filterPipeline, ...effectFilters],
    [filterPipeline, effectFilters],
  )
  // Stable ref so the RAF tick can read the current filter list without being
  // in its dependency array (the tick is only re-registered when videoEl changes).
  const allFiltersRef = useRef(allFilters)
  useEffect(() => { allFiltersRef.current = allFilters }, [allFilters])

  // Build the mask shape's sceneFunc whenever mask data or content dimensions change.
  // The function draws the mask into the inner group's cached canvas using destination-in
  // composite — white pixels = keep video, transparent = erase video.
  const maskSceneFunc = useMemo((): ((ctx: Konva.Context) => void) | undefined => {
    if (!obj.mask || !obj.mask.visible || obj.mask.anchors.length < 3) return undefined
    const { anchors, feather, inverted } = obj.mask
    const ox = obj.contentOffsetX
    const oy = obj.contentOffsetY
    const cw = obj.contentWidth
    const ch = obj.contentHeight
    // Translate anchors from content space to inner-group local space
    const shiftedAnchors = anchors.map((a) => ({ ...a, x: a.x + ox, y: a.y + oy }))
    const pathData = anchorsToPathData(shiftedAnchors, true)

    return (ctx: Konva.Context): void => {
      const native = ctx._context as CanvasRenderingContext2D
      if (!pathData) return
      if (inverted) {
        // Fill content rect white (destination-in keeps video pixels there)
        native.fillStyle = 'white'
        native.fillRect(ox, oy, cw, ch)
        // Cut hole for the mask path using destination-out + optional blur
        const prevGco = native.globalCompositeOperation
        native.globalCompositeOperation = 'destination-out'
        if (feather > 0) native.filter = `blur(${feather}px)`
        native.fillStyle = 'white'
        native.fill(new Path2D(pathData))
        if (feather > 0) native.filter = 'none'
        native.globalCompositeOperation = prevGco
      } else {
        if (feather > 0) native.filter = `blur(${feather}px)`
        native.fillStyle = 'white'
        native.fill(new Path2D(pathData))
        if (feather > 0) native.filter = 'none'
      }
    }
  }, [obj.mask, obj.contentOffsetX, obj.contentOffsetY, obj.contentWidth, obj.contentHeight])

  // Manage the inner group's cache for mask compositing.
  // innerCacheBoundsRef is kept in sync so the RAF tick can re-cache each frame.
  useEffect(() => {
    const inner = innerGroupRef.current
    if (!inner) return
    if (obj.mask && obj.mask.visible && obj.mask.anchors.length >= 3) {
      const feather = obj.mask.feather
      const buf = Math.max(feather, 0) + 2
      const bounds = {
        x: obj.contentOffsetX - buf,
        y: obj.contentOffsetY - buf,
        width: obj.contentWidth + buf * 2,
        height: obj.contentHeight + buf * 2,
      }
      innerCacheBoundsRef.current = bounds
      inner.cache(bounds)
      inner.getLayer()?.batchDraw()
    } else {
      innerCacheBoundsRef.current = null
      inner.clearCache()
      inner.getLayer()?.batchDraw()
    }
  }, [obj.mask, obj.contentOffsetX, obj.contentOffsetY, obj.contentWidth, obj.contentHeight, videoEl])

  // When filters change, reset the RAF frame-guard so the next tick re-caches
  // even if the video is paused (currentTime unchanged). When all filters are
  // removed, clear the cache immediately so the node reverts to live rendering.
  useEffect(() => {
    if (allFilters.length === 0) {
      videoImageRef.current?.clearCache()
      videoImageRef.current?.getLayer()?.batchDraw()
    } else {
      lastCachedTimeRef.current = -1
    }
  }, [allFilters])

  // Wire mask-edit Transformer to its target Rect when entering edit mode for rect/ellipse masks.
  useEffect(() => {
    const kind = obj.mask?.kind
    if (!obj.maskEditMode || (kind !== 'rect' && kind !== 'ellipse')) return
    const r = maskEditRectRef.current
    const tr = maskEditTransformerRef.current
    if (!r || !tr) return
    tr.nodes([r])
    tr.getLayer()?.batchDraw()
  }, [obj.maskEditMode, obj.mask?.kind, obj.mask?.anchors])

  // Wire transformer to its target.
  useEffect(() => {
    const tr = transformerRef.current
    const frameRect = frameRectRef.current
    const imgNode = videoImageRef.current
    if (!tr || !frameRect) return

    if (isInMultiSelectMode && !obj.contentEditMode) {
      tr.nodes([])
      tr.getLayer()?.draw()
      return
    }

    if (isSelected && !obj.maskEditMode && !isDrawTarget) {
      if (obj.contentEditMode && imgNode) {
        tr.nodes([imgNode])
        tr.borderStroke('#f94608')
        tr.enabledAnchors(['top-left', 'top-center', 'top-right', 'middle-right', 'bottom-right', 'bottom-center', 'bottom-left', 'middle-left'])
        tr.rotateEnabled(true)
      } else if (obj.locked) {
        tr.nodes([frameRect])
        tr.borderStroke('#f94608')
        tr.enabledAnchors([])
        tr.rotateEnabled(false)
      } else {
        tr.nodes([frameRect])
        tr.borderStroke('#f94608')
        tr.enabledAnchors(['top-left', 'top-center', 'top-right', 'middle-right', 'bottom-right', 'bottom-center', 'bottom-left', 'middle-left'])
        tr.rotateEnabled(true)
      }
      tr.getLayer()?.batchDraw()
    } else {
      tr.nodes([])
      tr.getLayer()?.draw()
    }
  }, [isSelected, isInMultiSelectMode, obj.contentEditMode, obj.maskEditMode, obj.locked, videoEl, isDrawTarget, maskDrawMode])

  // Sync nodeRef to frameRectRef for group transformer bbox.
  useEffect(() => {
    if (nodeRef) {
      (nodeRef as React.MutableRefObject<Konva.Node | null>).current = frameRectRef.current
    }
  })

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Meta') cmdHeldRef.current = true
      if (e.altKey) altHeldRef.current = true
    }
    function onKeyUp(e: KeyboardEvent): void {
      if (e.key === 'Meta') cmdHeldRef.current = false
      if (!e.altKey) altHeldRef.current = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  function syncGroupOnTransform(isGroupTransform = false): void {
    const rect = frameRectRef.current
    const group = groupRef.current
    const imgNode = videoImageRef.current
    const inner = innerGroupRef.current
    if (!rect || !group) return

    const newWidth = rect.width() * rect.scaleX()
    const newHeight = rect.height() * rect.scaleY()
    const isPureRotation = Math.abs(rect.scaleX() - 1) < 0.001 && Math.abs(rect.scaleY() - 1) < 0.001

    group.x(rect.x())
    group.y(rect.y())
    group.rotation(rect.rotation())
    group.clip({ x: 0, y: 0, width: newWidth, height: newHeight })

    if (imgNode) {
      if (isGroupTransform) {
        const scaleX = newWidth / obj.frameWidth
        const scaleY = newHeight / obj.frameHeight
        if (inner) { inner.x(0); inner.y(0) }
        imgNode.x(obj.contentOffsetX * scaleX)
        imgNode.y(obj.contentOffsetY * scaleY)
        imgNode.width(obj.contentWidth * scaleX)
        imgNode.height(obj.contentHeight * scaleY)
      } else if (cmdHeldRef.current && !isPureRotation) {
        const scaleX = newWidth / obj.frameWidth
        const scaleY = newHeight / obj.frameHeight
        const scale = (scaleX + scaleY) / 2
        if (inner) { inner.x(0); inner.y(0) }
        imgNode.x(obj.contentOffsetX * scale)
        imgNode.y(obj.contentOffsetY * scale)
        imgNode.width(obj.contentWidth * scale)
        imgNode.height(obj.contentHeight * scale)
      } else if (isPureRotation) {
        if (inner) { inner.x(0); inner.y(0) }
        imgNode.x(obj.contentOffsetX)
        imgNode.y(obj.contentOffsetY)
      } else if (resizeMode === 'auto') {
        const aspect = obj.contentWidth / obj.contentHeight
        const fAspect = newWidth / newHeight
        let cW: number, cH: number
        if (aspect > fAspect) { cH = newHeight; cW = cH * aspect }
        else { cW = newWidth; cH = cW / aspect }
        if (inner) { inner.x(0); inner.y(0) }
        imgNode.x((newWidth - cW) / 2)
        imgNode.y((newHeight - cH) / 2)
        imgNode.width(cW)
        imgNode.height(cH)
      } else {
        // Normal resize: keep image at its stored offset and shift the inner group
        // instead. When a mask is present the inner group is cached — moving imgNode.x
        // alone would leave the cached bitmap (video + mask) stationary while only
        // the uncached video node moves, causing the mask to drift. Shifting the
        // entire inner group moves the cached bitmap as a unit.
        imgNode.x(obj.contentOffsetX)
        imgNode.y(obj.contentOffsetY)
        if (inner) {
          inner.x(obj.frameX - rect.x())
          inner.y(obj.frameY - rect.y())
        }
      }
    }

    group.getLayer()?.batchDraw()
  }

  function handleDblClick(): void {
    if (!obj.locked) commitUpdate(obj.id, { contentEditMode: true })
  }

  function handleFrameDragMove(e: Konva.KonvaEventObject<DragEvent>): void {
    const rect = e.target as Konva.Rect
    let rawX = rect.x()
    let rawY = rect.y()

    if (e.evt.shiftKey) {
      const { dx, dy } = axisLock(rawX - dragStartFrameXRef.current, rawY - dragStartFrameYRef.current)
      rawX = dragStartFrameXRef.current + dx
      rawY = dragStartFrameYRef.current + dy
      rect.x(rawX)
      rect.y(rawY)
    }

    const { x: snappedX, y: snappedY, guides } = computeSnap(
      { x: rawX, y: rawY, width: obj.frameWidth, height: obj.frameHeight },
      obj.id,
    )

    rect.x(snappedX)
    rect.y(snappedY)
    onGuidesChange(guides)

    const group = groupRef.current
    if (group) {
      group.x(snappedX)
      group.y(snappedY)
      group.rotation(rect.rotation())
      group.clip({ x: 0, y: 0, width: obj.frameWidth, height: obj.frameHeight })
      group.getLayer()?.batchDraw()
    }

    if (altHeldRef.current && !pendingDuplicateRef.current) {
      pendingDuplicateRef.current = true
    }
  }

  function handleFrameDragEnd(e: Konva.KonvaEventObject<DragEvent>): void {
    const newX = e.target.x()
    const newY = e.target.y()
    onGuidesChange([])
    if (pendingDuplicateRef.current) {
      const originPos = { frameX: dragStartFrameXRef.current, frameY: dragStartFrameYRef.current }
      const finalPos = { frameX: newX, frameY: newY }
      duplicateObjectAtOrigin(obj.id, originPos, finalPos)
      pendingDuplicateRef.current = false
    } else {
      commitUpdate(obj.id, { frameX: newX, frameY: newY, x: newX, y: newY })
    }
  }

  function handleFrameTransformEnd(e: Konva.KonvaEventObject<Event>): void {
    const rect = frameRectRef.current
    if (!rect) return

    const isPureRotation = Math.abs(rect.scaleX() - 1) < 0.001 && Math.abs(rect.scaleY() - 1) < 0.001

    const newFrameX = rect.x()
    const newFrameY = rect.y()
    const newFrameWidth = rect.width() * rect.scaleX()
    const newFrameHeight = rect.height() * rect.scaleY()
    const newRotation = snapRotation(rect.rotation())

    rect.width(newFrameWidth)
    rect.height(newFrameHeight)
    rect.scaleX(1)
    rect.scaleY(1)

    const group = groupRef.current
    if (group) {
      group.clip({ x: 0, y: 0, width: newFrameWidth, height: newFrameHeight })
    }

    const inner = innerGroupRef.current
    if (inner) { inner.x(0); inner.y(0) }

    const imgNode = videoImageRef.current

    onGuidesChange([])

    const nativeEvent = e.evt as MouseEvent | TouchEvent
    const cmdFromEvent = 'metaKey' in nativeEvent && (nativeEvent as MouseEvent).metaKey
    const isPropMode = cmdHeldRef.current || cmdFromEvent

    if (isPropMode && !isPureRotation) {
      const scaleX = newFrameWidth / obj.frameWidth
      const scaleY = newFrameHeight / obj.frameHeight
      const scale = (scaleX + scaleY) / 2
      commitUpdate(obj.id, {
        frameX: newFrameX, frameY: newFrameY,
        frameWidth: newFrameWidth, frameHeight: newFrameHeight,
        rotation: newRotation, x: newFrameX, y: newFrameY,
        width: newFrameWidth, height: newFrameHeight,
        contentOffsetX: obj.contentOffsetX * scale,
        contentOffsetY: obj.contentOffsetY * scale,
        contentWidth: obj.contentWidth * scale,
        contentHeight: obj.contentHeight * scale,
      })
    } else if (isPureRotation) {
      commitUpdate(obj.id, {
        frameX: newFrameX, frameY: newFrameY,
        frameWidth: newFrameWidth, frameHeight: newFrameHeight,
        rotation: newRotation, x: newFrameX, y: newFrameY,
        width: newFrameWidth, height: newFrameHeight,
        contentOffsetX: obj.contentOffsetX,
        contentOffsetY: obj.contentOffsetY,
      })
    } else if (resizeMode === 'auto') {
      const aspect = obj.contentWidth / obj.contentHeight
      const fAspect = newFrameWidth / newFrameHeight
      let cW: number, cH: number
      if (aspect > fAspect) { cH = newFrameHeight; cW = cH * aspect }
      else { cW = newFrameWidth; cH = cW / aspect }
      const offsetX = (newFrameWidth - cW) / 2
      const offsetY = (newFrameHeight - cH) / 2
      if (imgNode) { imgNode.x(offsetX); imgNode.y(offsetY); imgNode.width(cW); imgNode.height(cH) }
      commitUpdate(obj.id, {
        frameX: newFrameX, frameY: newFrameY,
        frameWidth: newFrameWidth, frameHeight: newFrameHeight,
        rotation: newRotation, x: newFrameX, y: newFrameY,
        width: newFrameWidth, height: newFrameHeight,
        contentOffsetX: offsetX, contentOffsetY: offsetY,
        contentWidth: cW, contentHeight: cH,
      })
    } else {
      const newContentOffsetX = obj.contentOffsetX + (obj.frameX - newFrameX)
      const newContentOffsetY = obj.contentOffsetY + (obj.frameY - newFrameY)
      if (imgNode) { imgNode.x(newContentOffsetX); imgNode.y(newContentOffsetY) }
      commitUpdate(obj.id, {
        frameX: newFrameX, frameY: newFrameY,
        frameWidth: newFrameWidth, frameHeight: newFrameHeight,
        rotation: newRotation, x: newFrameX, y: newFrameY,
        width: newFrameWidth, height: newFrameHeight,
        contentOffsetX: newContentOffsetX,
        contentOffsetY: newContentOffsetY,
      })
    }
  }

  function handleContentDragEnd(e: Konva.KonvaEventObject<DragEvent>): void {
    commitUpdate(obj.id, {
      contentOffsetX: e.target.x(),
      contentOffsetY: e.target.y(),
    })
  }

  function handleContentTransformEnd(): void {
    const imgNode = videoImageRef.current
    if (!imgNode) return
    const newContentOffsetX = imgNode.x()
    const newContentOffsetY = imgNode.y()
    const newContentWidth = obj.contentWidth * imgNode.scaleX()
    const newContentHeight = obj.contentHeight * imgNode.scaleY()
    imgNode.scaleX(1)
    imgNode.scaleY(1)
    commitUpdate(obj.id, {
      contentOffsetX: newContentOffsetX,
      contentOffsetY: newContentOffsetY,
      contentWidth: newContentWidth,
      contentHeight: newContentHeight,
    })
  }

  // Don't render until video element is ready.
  if (!videoEl) return null

  const isInMultiSelect = isInMultiSelectMode && selectedIds.includes(obj.id)

  return (
    <>
      <Group
        ref={groupRef}
        x={obj.frameX}
        y={obj.frameY}
        clip={groupClip}
        rotation={obj.rotation}
        opacity={(obj.maskEditMode || isDrawTarget) ? obj.opacity * 0.5 : obj.opacity}
        listening={obj.contentEditMode && !isDrawTarget}
      >
        {/* Inner group: cached when a mask is active to enable destination-in compositing */}
        <Group ref={innerGroupRef}>
          <KonvaImage
            ref={videoImageRef}
            image={videoEl}
            x={obj.contentOffsetX}
            y={obj.contentOffsetY}
            width={obj.contentWidth}
            height={obj.contentHeight}
            filters={allFilters.length > 0 ? allFilters : undefined}
            draggable={obj.contentEditMode && !obj.locked}
            onClick={() => { if (obj.contentEditMode) useCanvasStore.getState().setSelected(id) }}
            onTap={() => { if (obj.contentEditMode) useCanvasStore.getState().setSelected(id) }}
            onDragStart={() => {
              contentDragStartRef.current = { x: obj.contentOffsetX, y: obj.contentOffsetY }
            }}
            onDragMove={(e) => {
              const node = e.target as Konva.Image
              const start = contentDragStartRef.current
              if (e.evt.shiftKey && start) {
                const { dx, dy } = axisLock(node.x() - start.x, node.y() - start.y)
                node.x(start.x + dx)
                node.y(start.y + dy)
              }
            }}
            onDragEnd={handleContentDragEnd}
            onTransformEnd={handleContentTransformEnd}
          />
          {maskSceneFunc !== undefined && (
            <Shape
              sceneFunc={maskSceneFunc}
              globalCompositeOperation="destination-in"
              listening={false}
            />
          )}
        </Group>
      </Group>

      {/* Mask edit overlay — Transformer-based for rect/ellipse, anchor circles for pen */}
      {obj.maskEditMode && obj.mask && (() => {
        const mask = obj.mask!
        const kind = mask.kind

        if (kind === 'rect' || kind === 'ellipse') {
          const axs = mask.anchors.map(a => a.x + obj.contentOffsetX)
          const ays = mask.anchors.map(a => a.y + obj.contentOffsetY)
          const bboxX = Math.min(...axs)
          const bboxY = Math.min(...ays)
          const bboxW = Math.max(...axs) - bboxX
          const bboxH = Math.max(...ays) - bboxY
          return (
            <Group x={obj.frameX} y={obj.frameY} rotation={obj.rotation} listening={true}>
              <Rect
                ref={maskEditRectRef}
                x={bboxX} y={bboxY}
                width={bboxW} height={bboxH}
                fill="transparent"
                stroke="#f94608" strokeWidth={1}
                strokeScaleEnabled={false}
                dash={[4, 3]}
                draggable
                onDragEnd={() => {
                  const r = maskEditRectRef.current!
                  const dx = r.x() - bboxX
                  const dy = r.y() - bboxY
                  const newAnchors = mask.anchors.map(a => ({ ...a, x: a.x + dx, y: a.y + dy }))
                  r.position({ x: bboxX, y: bboxY })
                  commitUpdate(obj.id, { mask: { ...mask, anchors: newAnchors } })
                }}
                onTransformEnd={() => {
                  const r = maskEditRectRef.current!
                  const sx = r.scaleX(); const sy = r.scaleY()
                  const rw = bboxW * sx; const rh = bboxH * sy
                  const x1 = rw >= 0 ? r.x() : r.x() + rw
                  const y1 = rh >= 0 ? r.y() : r.y() + rh
                  const x2 = rw >= 0 ? r.x() + rw : r.x()
                  const y2 = rh >= 0 ? r.y() + rh : r.y()
                  r.scaleX(1); r.scaleY(1)
                  r.x(x1); r.y(y1); r.width(x2 - x1); r.height(y2 - y1)
                  let newAnchors: AnchorPoint[]
                  if (kind === 'ellipse') {
                    const K = 0.5523
                    const ecx = (x1 + x2) / 2 - obj.contentOffsetX
                    const ecy = (y1 + y2) / 2 - obj.contentOffsetY
                    const erx = (x2 - x1) / 2
                    const ery = (y2 - y1) / 2
                    newAnchors = [
                      { x: ecx,       y: ecy - ery, handleIn: { dx: -K*erx, dy: 0 },  handleOut: { dx: K*erx, dy: 0 } },
                      { x: ecx + erx, y: ecy,       handleIn: { dx: 0, dy: -K*ery },  handleOut: { dx: 0, dy: K*ery } },
                      { x: ecx,       y: ecy + ery, handleIn: { dx: K*erx,  dy: 0 },  handleOut: { dx: -K*erx, dy: 0 } },
                      { x: ecx - erx, y: ecy,       handleIn: { dx: 0, dy: K*ery },   handleOut: { dx: 0, dy: -K*ery } },
                    ]
                  } else {
                    newAnchors = [
                      { x: x1 - obj.contentOffsetX, y: y1 - obj.contentOffsetY, handleIn: { dx: 0, dy: 0 }, handleOut: { dx: 0, dy: 0 } },
                      { x: x2 - obj.contentOffsetX, y: y1 - obj.contentOffsetY, handleIn: { dx: 0, dy: 0 }, handleOut: { dx: 0, dy: 0 } },
                      { x: x2 - obj.contentOffsetX, y: y2 - obj.contentOffsetY, handleIn: { dx: 0, dy: 0 }, handleOut: { dx: 0, dy: 0 } },
                      { x: x1 - obj.contentOffsetX, y: y2 - obj.contentOffsetY, handleIn: { dx: 0, dy: 0 }, handleOut: { dx: 0, dy: 0 } },
                    ]
                  }
                  commitUpdate(obj.id, { mask: { ...mask, anchors: newAnchors } })
                }}
              />
              <Transformer
                ref={maskEditTransformerRef}
                rotateEnabled={false}
                keepRatio={false}
                boundBoxFunc={(oldBox, newBox) => (newBox.width < 5 || newBox.height < 5 ? oldBox : newBox)}
              />
            </Group>
          )
        }

        // pen (or legacy masks without a kind): individual anchor circles
        return (
          <Group x={obj.frameX} y={obj.frameY} rotation={obj.rotation} listening={true}>
            {mask.anchors.map((anchor, i) => {
              const ax = obj.contentOffsetX + anchor.x
              const ay = obj.contentOffsetY + anchor.y
              const hix = ax + anchor.handleIn.dx
              const hiy = ay + anchor.handleIn.dy
              const hox = ax + anchor.handleOut.dx
              const hoy = ay + anchor.handleOut.dy
              const hasHandleIn = anchor.handleIn.dx !== 0 || anchor.handleIn.dy !== 0
              const hasHandleOut = anchor.handleOut.dx !== 0 || anchor.handleOut.dy !== 0
              return (
                <React.Fragment key={i}>
                  {hasHandleIn && (
                    <>
                      <Line points={[ax, ay, hix, hiy]} stroke="#f94608" strokeWidth={1} listening={false} />
                      <Circle
                        x={hix} y={hiy} radius={6}
                        fill="#fff" stroke="#f94608" strokeWidth={1}
                        draggable
                        onDragMove={(e) => {
                          const n = e.target as Konva.Circle
                          const newAnchors = mask.anchors.map((a, j) =>
                            j === i ? { ...a, handleIn: { dx: n.x() - ax, dy: n.y() - ay } } : a
                          )
                          updateObject(obj.id, { mask: { ...mask, anchors: newAnchors } })
                        }}
                        onDragEnd={(e) => {
                          const n = e.target as Konva.Circle
                          const newAnchors = mask.anchors.map((a, j) =>
                            j === i ? { ...a, handleIn: { dx: n.x() - ax, dy: n.y() - ay } } : a
                          )
                          commitUpdate(obj.id, { mask: { ...mask, anchors: newAnchors } })
                        }}
                      />
                    </>
                  )}
                  {hasHandleOut && (
                    <>
                      <Line points={[ax, ay, hox, hoy]} stroke="#f94608" strokeWidth={1} listening={false} />
                      <Circle
                        x={hox} y={hoy} radius={6}
                        fill="#fff" stroke="#f94608" strokeWidth={1}
                        draggable
                        onDragMove={(e) => {
                          const n = e.target as Konva.Circle
                          const newAnchors = mask.anchors.map((a, j) =>
                            j === i ? { ...a, handleOut: { dx: n.x() - ax, dy: n.y() - ay } } : a
                          )
                          updateObject(obj.id, { mask: { ...mask, anchors: newAnchors } })
                        }}
                        onDragEnd={(e) => {
                          const n = e.target as Konva.Circle
                          const newAnchors = mask.anchors.map((a, j) =>
                            j === i ? { ...a, handleOut: { dx: n.x() - ax, dy: n.y() - ay } } : a
                          )
                          commitUpdate(obj.id, { mask: { ...mask, anchors: newAnchors } })
                        }}
                      />
                    </>
                  )}
                  <Circle
                    x={ax} y={ay} radius={7}
                    fill="#f94608" stroke="#fff" strokeWidth={1.5}
                    draggable
                    onDragMove={(e) => {
                      const n = e.target as Konva.Circle
                      const newAnchors = mask.anchors.map((a, j) =>
                        j === i ? { ...a, x: n.x() - obj.contentOffsetX, y: n.y() - obj.contentOffsetY } : a
                      )
                      updateObject(obj.id, { mask: { ...mask, anchors: newAnchors } })
                    }}
                    onDragEnd={(e) => {
                      const n = e.target as Konva.Circle
                      const newAnchors = mask.anchors.map((a, j) =>
                        j === i ? { ...a, x: n.x() - obj.contentOffsetX, y: n.y() - obj.contentOffsetY } : a
                      )
                      commitUpdate(obj.id, { mask: { ...mask, anchors: newAnchors } })
                    }}
                    onDblClick={() => {
                      const hasHandles =
                        anchor.handleIn.dx !== 0 || anchor.handleIn.dy !== 0 ||
                        anchor.handleOut.dx !== 0 || anchor.handleOut.dy !== 0
                      let newAnchors: AnchorPoint[]
                      if (hasHandles) {
                        newAnchors = mask.anchors.map((a, j) =>
                          j === i ? { ...a, handleIn: { dx: 0, dy: 0 }, handleOut: { dx: 0, dy: 0 } } : a
                        )
                      } else {
                        const total = mask.anchors.length
                        const prevIdx = (i - 1 + total) % total
                        const nextIdx = (i + 1) % total
                        const prev = mask.anchors[prevIdx]
                        const next = mask.anchors[nextIdx]
                        const tx = next.x - prev.x
                        const ty = next.y - prev.y
                        const len = Math.sqrt(tx * tx + ty * ty)
                        const HANDLE_LEN = 30
                        const hdx = len > 0.001 ? (tx / len) * HANDLE_LEN : HANDLE_LEN
                        const hdy = len > 0.001 ? (ty / len) * HANDLE_LEN : 0
                        newAnchors = mask.anchors.map((a, j) =>
                          j === i ? { ...a, handleOut: { dx: hdx, dy: hdy }, handleIn: { dx: -hdx, dy: -hdy } } : a
                        )
                      }
                      commitUpdate(obj.id, { mask: { ...mask, anchors: newAnchors } })
                    }}
                  />
                </React.Fragment>
              )
            })}
          </Group>
        )
      })()}

      {/* Invisible frame rect — sole interaction/transform target in frame mode. */}
      <Rect
        ref={frameRectRef}
        x={obj.frameX}
        y={obj.frameY}
        width={obj.frameWidth}
        height={obj.frameHeight}
        rotation={obj.rotation}
        fill="transparent"
        stroke={isAnchor && isInMultiSelect ? '#f5a623' : '#f94608'}
        strokeWidth={isAnchor && isInMultiSelect ? 2 : 1}
        strokeEnabled={obj.contentEditMode || isInMultiSelect}
        strokeScaleEnabled={false}
        perfectDrawEnabled={false}
        draggable={!obj.locked && !obj.contentEditMode && !obj.maskEditMode && !isDrawTarget && !isInMultiSelectMode && !(maskModeActive && isSelected && (activeTool === 'shape' || activeTool === 'pen'))}
        listening={!obj.contentEditMode && !obj.maskEditMode && !isDrawTarget}
        onMouseDown={(e) => {
          if (isInMultiSelectMode) {
            rectMouseDownPosRef.current = { x: e.evt.clientX, y: e.evt.clientY }
          }
        }}
        onClick={(e) => {
          if (!obj.contentEditMode && !obj.maskEditMode && !isDrawTarget) {
            if (e.evt.shiftKey) {
              addToSelection(obj.id)
            } else if (isInMultiSelectMode && selectedIds.includes(obj.id)) {
              if (rectMouseDownPosRef.current) {
                const dx = e.evt.clientX - rectMouseDownPosRef.current.x
                const dy = e.evt.clientY - rectMouseDownPosRef.current.y
                rectMouseDownPosRef.current = null
                if (Math.sqrt(dx * dx + dy * dy) > 3) return
              }
              setAnchor(anchorId === obj.id ? null : obj.id)
            } else {
              useCanvasStore.getState().setSelected(id)
            }
          }
        }}
        onTap={() => { if (!obj.contentEditMode && !obj.maskEditMode) useCanvasStore.getState().setSelected(id) }}
        onDblClick={handleDblClick}
        onDblTap={handleDblClick}
        onDragStart={() => {
          dragStartFrameXRef.current = obj.frameX
          dragStartFrameYRef.current = obj.frameY
          pendingDuplicateRef.current = false
        }}
        onDragMove={handleFrameDragMove}
        onDragEnd={handleFrameDragEnd}
        onTransform={() => {
          if (isInMultiSelectMode) return
          syncGroupOnTransform()
          onGuidesChange(pendingGuidesRef.current)
        }}
        onTransformEnd={handleFrameTransformEnd}
        onContextMenu={(e) => {
          e.evt.preventDefault()
          e.cancelBubble = true
          if (!isSelected) useCanvasStore.getState().setSelected(id)
          setContextMenu({ x: e.evt.clientX, y: e.evt.clientY, targetId: obj.id })
        }}
      />

      <Transformer
        ref={transformerRef}
        keepRatio={false}
        rotationSnaps={snapEnabled ? [0, 45, 90, 135, 180, 225, 270, 315] : []}
        rotationSnapTolerance={8}
        boundBoxFunc={(oldBox, newBox) => {
          if (newBox.width < 5 || newBox.height < 5) return oldBox

          const rotation = newBox.rotation ?? 0
          const anchor = transformerRef.current?.getActiveAnchor() ?? ''

          if (anchor === 'rotater') {
            pendingGuidesRef.current = []
            return newBox
          }

          if (Math.abs(rotation) > 0.01 || !anchor) {
            pendingGuidesRef.current = []
            return newBox
          }

          const scale = CANVAS_SCALE * zoom
          const logicalThreshold = 8 / scale
          const logicalBox = {
            x: (newBox.x - panX) / scale,
            y: (newBox.y - panY) / scale,
            width: newBox.width / scale,
            height: newBox.height / scale,
          }
          const { box: snappedLogical, guides } = computeSnapResize(
            logicalBox,
            anchor,
            obj.id,
            logicalThreshold,
          )
          const snapped = {
            x: snappedLogical.x * scale + panX,
            y: snappedLogical.y * scale + panY,
            width: snappedLogical.width * scale,
            height: snappedLogical.height * scale,
          }
          pendingGuidesRef.current = guides
          return { ...snapped, rotation: newBox.rotation }
        }}
      />
    </>
  )
}

function CanvasVideoNodeOuter(props: CanvasVideoNodeProps): React.ReactElement | null {
  const obj = useCanvasStore((s) => s.objects[props.id] as VideoObject | undefined)
  if (!obj || !obj.visible) return null
  return <CanvasVideoNodeInner {...props} obj={obj} />
}

export const CanvasVideoNode = React.memo(CanvasVideoNodeOuter)
