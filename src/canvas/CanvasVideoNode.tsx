import React, { useRef, useEffect, useState, useMemo } from 'react'
import { Group, Image as KonvaImage, Rect, Path as KonvaPath, Transformer } from 'react-konva'
import type Konva from 'konva'
import type { VideoObject } from '@/types/canvas'
import { DEFAULT_ADJUSTMENTS } from '@/types/canvas'
import { useCanvasStore } from './useCanvasStore'
import { makeCanvasNode } from './makeCanvasNode'
import { useSnapGuides } from './useSnapGuides'
import type { SnapGuide } from './useSnapGuides'
import { axisLock } from './constants'
import { useViewportStore, selectScale } from './useViewportStore'
import { registerVideoElement, unregisterVideoElement } from './videoElementRegistry'
import { buildFilterPipeline } from './adjustments/pipeline'
import { buildEffectFilters } from './effects/buildEffectFilters'
import { fitCover, snapRectInRotatedFrame } from './geometry'
import { buildClipFunc, clipShapeToPathData, isPlainRectClip, solidColorOf } from './frameClip'
import { ClipEditOverlay } from './ClipEditOverlay'

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
  const commitUpdate = useCanvasStore((s) => s.commitUpdate)
  const selectedIds = useCanvasStore((s) => s.selectedIds)
  const addToSelection = useCanvasStore((s) => s.addToSelection)
  const anchorId = useCanvasStore((s) => s.anchorId)
  const setAnchor = useCanvasStore((s) => s.setAnchor)
  const duplicateObjectAtOrigin = useCanvasStore((s) => s.duplicateObjectAtOrigin)
  const setContextMenu = useCanvasStore((s) => s.setContextMenu)
  const resizeMode = useCanvasStore((s) => s.resizeMode)
  const adjustmentsBypass = useCanvasStore((s) => s.adjustmentsBypass)
  const scale = useViewportStore(selectScale)
  const panX = useViewportStore((s) => s.panX)
  const panY = useViewportStore((s) => s.panY)
  const snapEnabled = useCanvasStore((s) => s.snapEnabled)

  const isInMultiSelectMode = selectedIds.length > 1
  const isAnchor = anchorId === id
  const isGridCell = obj.parentGroupId != null
  // Complement of CanvasGroupNode's `!isCellSelected` — see CanvasImageNode.
  const isGridEntered = useCanvasStore((s) => {
    const g = obj.parentGroupId != null ? s.objects[obj.parentGroupId] : undefined
    return g?.type === 'group' ? g.childIds.includes(s.selectedId ?? '') : false
  })
  const { computeSnap, computeSnapResize, snapRotation, startSnapSession, endSnapSession } = useSnapGuides()

  const frameRectRef = useRef<Konva.Rect>(null)
  const groupRef = useRef<Konva.Group>(null)
  const innerGroupRef = useRef<Konva.Group>(null)
  const videoImageRef = useRef<Konva.Image>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const cmdHeldRef = useRef(false)
  const pendingGuidesRef = useRef<SnapGuide[]>([])
  const rectMouseDownPosRef = useRef<{ x: number; y: number } | null>(null)
  const altHeldRef = useRef(false)
  const dragStartFrameXRef = useRef(0)
  const dragStartFrameYRef = useRef(0)
  const contentDragStartRef = useRef<{ x: number; y: number } | null>(null)
  const pendingDuplicateRef = useRef(false)
  const rafRef = useRef<number | null>(null)
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
    vid.addEventListener('durationchange', () => {
      if (isFinite(vid.duration) && vid.videoWidth > 0) {
        useCanvasStore.getState().updateObject(id, {
          naturalWidth: vid.videoWidth,
          naturalHeight: vid.videoHeight,
          naturalDuration: vid.duration,
        })
      }
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
    const vid = videoEl

    function tick(now: number): void {
      // Start-offset countdown: hold poster frame until delay elapses, then play.
      if (startOffsetRemainingRef.current > 0) {
        const last = lastTickTimeRef.current ?? now
        const delta = (now - last) / 1000
        lastTickTimeRef.current = now
        startOffsetRemainingRef.current = Math.max(0, startOffsetRemainingRef.current - delta)
        if (startOffsetRemainingRef.current <= 0) {
          vid.play().catch((e: unknown) => {
            console.warn('[CanvasVideoNode] play() after offset rejected:', e)
          })
        }
        const layer = groupRef.current?.getLayer()
        if (layer) layer.batchDraw()
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      lastTickTimeRef.current = now

      const end = obj.trimEnd ?? obj.naturalDuration ?? Infinity
      const start = obj.trimStart ?? 0
      if (vid.currentTime >= end) {
        vid.currentTime = start
        if (!(obj.loop ?? true)) {
          vid.pause()
          // Seek to poster frame when stopped
          vid.currentTime = obj.posterFrame ?? start
          // Sync store so the play button reflects paused state
          const store = useCanvasStore.getState()
          if (store.videoPlayingIds.has(id)) store.toggleVideoPlay(id)
        }
      }
      // Re-cache only when a new video frame has been decoded — skips redundant
      // cache() calls at 60fps when the video is paused or running below 60fps.
      const currentTime = vid.currentTime
      const frameChanged = currentTime !== lastCachedTimeRef.current
      if (frameChanged) {
        lastCachedTimeRef.current = currentTime
        if (allFiltersRef.current.length > 0) videoImageRef.current?.cache()
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

  const frameFill = solidColorOf(obj.fill)

  // --- Media-frame clip geometry (see CanvasImageNode for the full contract) ---
  const plainRect = isPlainRectClip(obj.clipShape)
  const clipFunc = useMemo(
    () => (plainRect || !obj.clipShape ? undefined : buildClipFunc(obj.clipShape, obj.frameWidth, obj.frameHeight)),
    [plainRect, obj.clipShape, obj.frameWidth, obj.frameHeight],
  )
  const hitFunc = useMemo(() => {
    if (plainRect || !obj.clipShape) return undefined
    const trace = buildClipFunc(obj.clipShape, obj.frameWidth, obj.frameHeight)
    if (!trace) return undefined
    return (ctx: Konva.Context, shape: Konva.Shape): void => {
      ctx.beginPath()
      trace(ctx)
      ctx.closePath()
      ctx.fillStrokeShape(shape)
    }
  }, [plainRect, obj.clipShape, obj.frameWidth, obj.frameHeight])
  const frameStrokeData = useMemo(
    () => (obj.frameStroke && obj.frameStrokeWidth
      ? clipShapeToPathData(obj.clipShape ?? { kind: 'rect' }, obj.frameWidth, obj.frameHeight)
      : ''),
    [obj.frameStroke, obj.frameStrokeWidth, obj.clipShape, obj.frameWidth, obj.frameHeight],
  )
  const fillRectRef = useRef<Konva.Rect>(null)
  const frameStrokeRef = useRef<Konva.Path>(null)

  function syncFrameDecor(width: number, height: number): void {
    const group = groupRef.current
    if (group && !plainRect && obj.clipShape) {
      const trace = buildClipFunc(obj.clipShape, width, height)
      if (trace) group.clipFunc(trace)
    }
    const fr = fillRectRef.current
    if (fr) { fr.width(width); fr.height(height) }
    const fs = frameStrokeRef.current
    if (fs && obj.frameStroke && obj.frameStrokeWidth) {
      fs.data(clipShapeToPathData(obj.clipShape ?? { kind: 'rect' }, width, height))
      if (group) { fs.x(group.x()); fs.y(group.y()); fs.rotation(group.rotation()) }
    }
  }

  const filterPipeline = useMemo(
    () => adjustmentsBypass ? [] : buildFilterPipeline(obj.adjustments ?? DEFAULT_ADJUSTMENTS),
    [obj.adjustments, adjustmentsBypass],
  )
  const effectFilters = useMemo(
    () => buildEffectFilters(obj.effects ?? []),
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

  // When filters change, reset the RAF frame-guard so the next tick re-caches
  // even if the video is paused (currentTime unchanged). When all filters are
  // removed, clear the cache immediately so the node reverts to live rendering.
  //
  // Content dimensions are dependencies too, and must be: `cache()` snapshots the
  // node at its CURRENT size, and Konva then draws that bitmap scaled to whatever
  // the node's box becomes. Re-fitting the content (inserting media, an auto-mode
  // frame resize, a content transform) without re-caching therefore renders the
  // video stretched. CanvasImageNode has always keyed on these — this node not
  // doing so was the one place image and video fitting diverged.
  useEffect(() => {
    const node = videoImageRef.current
    if (!node) return
    if (allFilters.length === 0) {
      node.clearCache()
      node.getLayer()?.batchDraw()
    } else {
      node.cache()
      lastCachedTimeRef.current = -1
      node.getLayer()?.batchDraw()
    }
  }, [allFilters, videoEl, obj.contentWidth, obj.contentHeight])

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

    if (isSelected) {
      if (obj.contentEditMode && imgNode) {
        tr.nodes([imgNode])
        tr.borderStroke('#f94608')
        tr.enabledAnchors(['top-left', 'top-center', 'top-right', 'middle-right', 'bottom-right', 'bottom-center', 'bottom-left', 'middle-left'])
        tr.rotateEnabled(true)
      } else if (obj.locked || isGridCell) {
        // Selection border only — cell geometry belongs to computeGridChildPatches.
        // See CanvasImageNode for the full argument.
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
  }, [isSelected, isInMultiSelectMode, obj.contentEditMode, obj.locked, isGridCell, videoEl])

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
    syncFrameDecor(newWidth, newHeight)

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
        const cover = fitCover(obj.contentWidth, obj.contentHeight, newWidth, newHeight)
        if (inner) { inner.x(0); inner.y(0) }
        imgNode.x(cover.contentOffsetX)
        imgNode.y(cover.contentOffsetY)
        imgNode.width(cover.contentWidth)
        imgNode.height(cover.contentHeight)
      } else {
        // Normal resize: keep image at its stored offset and shift the inner group
        // instead, so both stay fixed in canvas space.
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
      const fs = frameStrokeRef.current
      if (fs && obj.frameStroke && obj.frameStrokeWidth) {
        fs.x(snappedX); fs.y(snappedY); fs.rotation(rect.rotation())
      }
      group.getLayer()?.batchDraw()
    }

    if (altHeldRef.current && !pendingDuplicateRef.current) {
      pendingDuplicateRef.current = true
    }
  }

  function handleFrameDragEnd(e: Konva.KonvaEventObject<DragEvent>): void {
    endSnapSession()
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
    endSnapSession()
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
    syncFrameDecor(newFrameWidth, newFrameHeight)

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
      const cover = fitCover(obj.contentWidth, obj.contentHeight, newFrameWidth, newFrameHeight)
      if (imgNode) { imgNode.x(cover.contentOffsetX); imgNode.y(cover.contentOffsetY); imgNode.width(cover.contentWidth); imgNode.height(cover.contentHeight) }
      commitUpdate(obj.id, {
        frameX: newFrameX, frameY: newFrameY,
        frameWidth: newFrameWidth, frameHeight: newFrameHeight,
        rotation: newRotation, x: newFrameX, y: newFrameY,
        width: newFrameWidth, height: newFrameHeight,
        contentOffsetX: cover.contentOffsetX, contentOffsetY: cover.contentOffsetY,
        contentWidth: cover.contentWidth, contentHeight: cover.contentHeight,
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

  // Content drag with frame-edge snapping (see CanvasImageNode for the contract).
  function handleContentDragMove(e: Konva.KonvaEventObject<DragEvent>): void {
    const node = e.target as Konva.Image
    const start = contentDragStartRef.current
    let nx = node.x()
    let ny = node.y()
    if (e.evt.shiftKey && start) {
      const { dx, dy } = axisLock(nx - start.x, ny - start.y)
      nx = start.x + dx
      ny = start.y + dy
      node.x(nx)
      node.y(ny)
    }
    // Mirrors CanvasImageNode — see the note there on frame-local vs absolute space.
    let guides: SnapGuide[] = []
    const localSnap = snapRectInRotatedFrame(
      { x: nx, y: ny, width: obj.contentWidth, height: obj.contentHeight },
      obj.frameX, obj.frameY, obj.rotation,
      (box) => {
        const res = computeSnap(box, obj.id)
        guides = res.guides
        return res
      },
    )
    node.x(localSnap.x)
    node.y(localSnap.y)
    onGuidesChange(guides)
  }

  function handleContentDragEnd(e: Konva.KonvaEventObject<DragEvent>): void {
    commitUpdate(obj.id, {
      contentOffsetX: e.target.x(),
      contentOffsetY: e.target.y(),
    })
  }

  function handleContentTransformEnd(): void {
    endSnapSession()
    onGuidesChange([])
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
        clipFunc={clipFunc}
        rotation={obj.rotation}
        opacity={obj.opacity}
        listening={obj.contentEditMode}
      >
        {frameFill != null ? (
          <Rect
            ref={fillRectRef}
            x={0} y={0}
            width={obj.frameWidth} height={obj.frameHeight}
            fill={frameFill}
            listening={false}
          />
        ) : null}
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
              startSnapSession(obj.id, { contentMode: true })
            }}
            onDragMove={handleContentDragMove}
            onDragEnd={(e) => { endSnapSession(); onGuidesChange([]); handleContentDragEnd(e) }}
            onTransformEnd={handleContentTransformEnd}
          />
        </Group>
      </Group>

      {obj.clipEditMode && obj.clipShape?.kind === 'path' && (
        <ClipEditOverlay
          id={obj.id}
          clipShape={obj.clipShape}
          frameX={obj.frameX}
          frameY={obj.frameY}
          frameWidth={obj.frameWidth}
          frameHeight={obj.frameHeight}
          rotation={obj.rotation}
        />
      )}

      {/* Invisible frame rect — sole interaction/transform target in frame mode. */}
      <Rect
        ref={frameRectRef}
        name={`frame-rect-${id}`}
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
        hitFunc={hitFunc}
        draggable={!obj.locked && !obj.contentEditMode && !isInMultiSelectMode && !isGridCell}
        listening={!obj.contentEditMode && (!isGridCell || isGridEntered)}
        onMouseDown={(e) => {
          if (isInMultiSelectMode) {
            rectMouseDownPosRef.current = { x: e.evt.clientX, y: e.evt.clientY }
          }
        }}
        onClick={(e) => {
          if (!obj.contentEditMode) {
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
        onTap={() => { if (!obj.contentEditMode) useCanvasStore.getState().setSelected(id) }}
        onDblClick={handleDblClick}
        onDblTap={handleDblClick}
        onDragStart={() => {
          startSnapSession(obj.id)
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

      {frameStrokeData ? (
        <KonvaPath
          ref={frameStrokeRef}
          x={obj.frameX} y={obj.frameY} rotation={obj.rotation}
          data={frameStrokeData}
          stroke={obj.frameStroke} strokeWidth={obj.frameStrokeWidth}
          strokeScaleEnabled={false} listening={false} perfectDrawEnabled={false}
        />
      ) : null}

      <Transformer
        ref={transformerRef}
        keepRatio={false}
        rotationSnaps={snapEnabled ? [0, 45, 90, 135, 180, 225, 270, 315] : []}
        rotationSnapTolerance={8}
        onTransformStart={() => startSnapSession(obj.id, obj.contentEditMode ? { contentMode: true } : undefined)}
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

export const CanvasVideoNode = makeCanvasNode<VideoObject, CanvasVideoNodeProps>(CanvasVideoNodeInner, 'video')
