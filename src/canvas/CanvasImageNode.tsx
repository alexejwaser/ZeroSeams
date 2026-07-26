import React, { useRef, useEffect, useMemo } from 'react'
import { Group, Image as KonvaImage, Rect, Path as KonvaPath, Transformer } from 'react-konva'
import useImage from 'use-image'
import type Konva from 'konva'
import type { ImageObject } from '@/types/canvas'
import { useCanvasStore } from './useCanvasStore'
import { makeCanvasNode } from './makeCanvasNode'
import { useSnapGuides } from './useSnapGuides'
import type { SnapGuide } from './useSnapGuides'
import { axisLock } from './constants'
import { useViewportStore, selectScale } from './useViewportStore'
import { buildFilterPipeline } from './adjustments/pipeline'
import { DEFAULT_ADJUSTMENTS } from '@/types/canvas'
import { buildEffectFilters } from './effects/buildEffectFilters'
import { fitCover } from './geometry'
import { buildClipFunc, clipShapeToPathData, isPlainRectClip, EMPTY_FRAME_ICON_PATH } from './frameClip'
import { ClipEditOverlay } from './ClipEditOverlay'

const EMPTY_FRAME_FILL = '#d9d2c7'

interface CanvasImageNodeProps {
  id: string
  onGuidesChange: (guides: SnapGuide[]) => void
  nodeRef?: React.RefObject<Konva.Node>
  syncRef?: React.MutableRefObject<(() => void) | null>
  syncGroupRef?: React.MutableRefObject<(() => void) | null>
}

interface CanvasImageNodeInnerProps extends CanvasImageNodeProps {
  obj: ImageObject
}

function CanvasImageNodeInner({ id, obj, onGuidesChange, nodeRef, syncRef, syncGroupRef }: CanvasImageNodeInnerProps): React.ReactElement | null {
  const isSelected = useCanvasStore((s) => s.selectedId === id)
  const adjustmentsBypass = useCanvasStore((s) => s.adjustmentsBypass)
  const [loadedImage] = useImage(obj.src)

  // Hold the last successfully loaded HTMLImageElement so the component never
  // returns null during the brief loading gap when src changes (e.g. after
  // background removal). Without this, useImage briefly returns undefined →
  // component unmounts → Konva destroys and recreates the node → visible
  // position/size jump even though the store values are untouched.
  const stableImageRef = useRef<HTMLImageElement | undefined>(undefined)
  if (loadedImage !== undefined) {
    stableImageRef.current = loadedImage
  }
  const image = stableImageRef.current

  const frameRectRef = useRef<Konva.Rect>(null)
  const groupRef = useRef<Konva.Group>(null)
  const innerGroupRef = useRef<Konva.Group>(null)
  const imageRef = useRef<Konva.Image>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  // Tracks CMD key only — SHIFT is handled natively by Konva Transformer:
  // with keepRatio=false as base, holding Shift toggles it to true automatically.
  const cmdHeldRef = useRef(false)
  // Guides computed in boundBoxFunc, emitted after syncGroupOnTransform so that
  // the onGuidesChange state update doesn't fire mid-sync and reset the clip.
  const pendingGuidesRef = useRef<SnapGuide[]>([])
  // Tracks mousedown position to distinguish a quick click from a drag in multi-select mode
  const rectMouseDownPosRef = useRef<{ x: number; y: number } | null>(null)

  // Alt (option) key tracking for duplicate-on-drag
  const altHeldRef = useRef(false)
  const dragStartFrameXRef = useRef(0)
  const dragStartFrameYRef = useRef(0)
  const contentDragStartRef = useRef<{ x: number; y: number } | null>(null)
  const pendingDuplicateRef = useRef(false)

  const commitUpdate = useCanvasStore((s) => s.commitUpdate)
  const selectedIds = useCanvasStore((s) => s.selectedIds)
  const addToSelection = useCanvasStore((s) => s.addToSelection)
  const anchorId = useCanvasStore((s) => s.anchorId)
  const setAnchor = useCanvasStore((s) => s.setAnchor)
  const duplicateObjectAtOrigin = useCanvasStore((s) => s.duplicateObjectAtOrigin)
  const setContextMenu = useCanvasStore((s) => s.setContextMenu)
  const resizeMode = useCanvasStore((s) => s.resizeMode)
  const scale = useViewportStore(selectScale)
  const panX = useViewportStore((s) => s.panX)
  const panY = useViewportStore((s) => s.panY)

  const isInMultiSelectMode = selectedIds.length > 1
  const isAnchor = anchorId === id
  // For grid cells: single-click selects the parent group; double-click enters the cell
  const isParentGroupSelected = useCanvasStore(
    (s) => obj.parentGroupId != null && s.selectedId === obj.parentGroupId,
  )
  const isGridCell = obj.parentGroupId != null
  const { computeSnap, computeSnapResize, snapRotation, startSnapSession, endSnapSession } = useSnapGuides()
  const snapEnabled = useCanvasStore((s) => s.snapEnabled)

  // Memoized so React-Konva sees the same object reference between renders while
  // the frame dimensions are unchanged. Without this, every re-render (e.g. from
  // setActiveGuides state updates) creates a new clip object, React-Konva detects
  // a "change" and resets the Konva clip back to stored dimensions — overwriting
  // the live scaled clip set imperatively in syncGroupOnTransform, causing flicker.
  const groupClip = useMemo(
    () => ({ x: 0, y: 0, width: obj.frameWidth, height: obj.frameHeight }),
    [obj.frameWidth, obj.frameHeight],
  )

  // --- Media-frame clip geometry ---
  // Plain rect / absent clip keeps the zero-cost `clip` rect prop. Ellipse/path
  // (and rounded-rect) use a traced clipFunc that Konva prefers over `clip`.
  const plainRect = isPlainRectClip(obj.clipShape)
  const clipFunc = useMemo(
    () => (plainRect || !obj.clipShape ? undefined : buildClipFunc(obj.clipShape, obj.frameWidth, obj.frameHeight)),
    [plainRect, obj.clipShape, obj.frameWidth, obj.frameHeight],
  )
  // Custom hitFunc so clicks outside a non-rect shape pass through.
  const hitFunc = useMemo(() => {
    if (plainRect || !obj.clipShape) return undefined
    const trace = buildClipFunc(obj.clipShape, obj.frameWidth, obj.frameHeight)
    return (ctx: Konva.Context, shape: Konva.Shape): void => {
      ctx.beginPath()
      trace(ctx)
      ctx.closePath()
      ctx.fillStrokeShape(shape)
    }
  }, [plainRect, obj.clipShape, obj.frameWidth, obj.frameHeight])
  // Frame stroke outline (non-clipped sibling on top).
  const frameStrokeData = useMemo(
    () => (obj.frameStroke && obj.frameStrokeWidth
      ? clipShapeToPathData(obj.clipShape ?? { kind: 'rect' }, obj.frameWidth, obj.frameHeight)
      : ''),
    [obj.frameStroke, obj.frameStrokeWidth, obj.clipShape, obj.frameWidth, obj.frameHeight],
  )
  const fillRectRef = useRef<Konva.Rect>(null)
  const frameStrokeRef = useRef<Konva.Path>(null)

  // Imperatively track clip/fill/stroke to a live frame size during transforms.
  function syncFrameDecor(width: number, height: number): void {
    const group = groupRef.current
    if (group && !plainRect && obj.clipShape) {
      group.clipFunc(buildClipFunc(obj.clipShape, width, height))
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
    () => buildEffectFilters(obj.effects),
    [obj.effects],
  )
  const allFilters = useMemo(
    () => [...filterPipeline, ...effectFilters],
    [filterPipeline, effectFilters],
  )
  // Manage the imageRef cache for filter rendering.
  useEffect(() => {
    const img = imageRef.current
    if (!img) return
    if (allFilters.length > 0) {
      img.cache()
      img.getLayer()?.batchDraw()
    } else {
      img.clearCache()
      img.getLayer()?.batchDraw()
    }
  }, [allFilters, loadedImage, obj.contentWidth, obj.contentHeight, obj.src])

  // Sync nodeRef to frameRectRef so the group transformer uses frame bounds (not content extent).
  // Also expose syncGroupOnTransform so CarouselStage can drive live visual sync during group transforms.
  useEffect(() => {
    if (nodeRef) {
      (nodeRef as React.MutableRefObject<Konva.Node | null>).current = frameRectRef.current
    }
    if (syncRef) {
      syncRef.current = syncGroupOnTransform
    }
    if (syncGroupRef) {
      syncGroupRef.current = () => syncGroupOnTransform(true)
    }
  })

  useEffect(() => {
    const tr = transformerRef.current
    const frameRect = frameRectRef.current
    const img = imageRef.current
    // Empty frames have no image node; the frame Rect is still a valid transform target.
    if (!tr || !frameRect) return

    if (isInMultiSelectMode && !obj.contentEditMode) {
      tr.nodes([])
      tr.getLayer()?.draw()
      return
    }

    if (isSelected) {
      if (obj.contentEditMode && img) {
        tr.nodes([img])
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
  }, [isSelected, isInMultiSelectMode, obj.contentEditMode, obj.locked, loadedImage])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Meta') cmdHeldRef.current = true
    }
    function onKeyUp(e: KeyboardEvent): void {
      if (e.key === 'Meta') cmdHeldRef.current = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  useEffect(() => {
    const onDown = (e: KeyboardEvent): void => { if (e.altKey) altHeldRef.current = true }
    const onUp = (e: KeyboardEvent): void => { if (!e.altKey) altHeldRef.current = false }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [])

  // Syncs clip group during transform (resize/rotate). During resize, the frame
  // origin may shift (top/left handle drag), so compensate to keep the content
  // fixed in canvas space. During pure rotation, no compensation is needed.
  // NOTE: does not call onGuidesChange — guides are emitted by the onTransform
  // handler after this runs, from pendingGuidesRef set by boundBoxFunc.
  function syncGroupOnTransform(isGroupTransform = false): void {
    const rect = frameRectRef.current
    const group = groupRef.current
    const img = imageRef.current
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

    if (img) {
      if (isGroupTransform) {
        // Group scale: content follows frame proportionally — never crops, ignores resizeMode
        const scaleX = newWidth / obj.frameWidth
        const scaleY = newHeight / obj.frameHeight
        if (inner) { inner.x(0); inner.y(0) }
        img.x(obj.contentOffsetX * scaleX)
        img.y(obj.contentOffsetY * scaleY)
        img.width(obj.contentWidth * scaleX)
        img.height(obj.contentHeight * scaleY)
      } else if (cmdHeldRef.current && !isPureRotation) {
        // CMD+SHIFT: scale content proportionally alongside the frame (live preview).
        if (inner) { inner.x(0); inner.y(0) }
        const scaleX = newWidth / obj.frameWidth
        const scaleY = newHeight / obj.frameHeight
        const scale = (scaleX + scaleY) / 2
        img.x(obj.contentOffsetX * scale)
        img.y(obj.contentOffsetY * scale)
        img.width(obj.contentWidth * scale)
        img.height(obj.contentHeight * scale)
      } else if (isPureRotation) {
        // Pure rotation: content offset is relative to the group and co-rotates
        // with it — no adjustment needed.
        if (inner) { inner.x(0); inner.y(0) }
        img.x(obj.contentOffsetX)
        img.y(obj.contentOffsetY)
      } else if (resizeMode === 'auto') {
        const cover = fitCover(obj.contentWidth, obj.contentHeight, newWidth, newHeight)
        if (inner) { inner.x(0); inner.y(0) }
        img.x(cover.contentOffsetX)
        img.y(cover.contentOffsetY)
        img.width(cover.contentWidth)
        img.height(cover.contentHeight)
      } else {
        // Normal resize: keep image at its stored offset and shift the inner group
        // instead, so both stay fixed in canvas space:
        // group.x + inner.x + img.x = rect.x + (frameX-rect.x) + offsetX = frameX+offsetX ✓
        img.x(obj.contentOffsetX)
        img.y(obj.contentOffsetY)
        if (inner) {
          inner.x(obj.frameX - rect.x())
          inner.y(obj.frameY - rect.y())
        }
      }
    }

    group.getLayer()?.batchDraw()
  }

  function handleDblClick(): void {
    // Empty frames have no content to edit — double-click is a no-op.
    if (obj.isEmpty) return
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

    // Sync group to snapped position
    const group = groupRef.current
    if (group) {
      group.x(snappedX)
      group.y(snappedY)
      group.rotation(rect.rotation())
      group.clip({ x: 0, y: 0, width: obj.frameWidth, height: obj.frameHeight })
      // Frame size is unchanged during a drag — only reposition the stroke overlay.
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

    // Bake scale back into width/height so future transforms start clean.
    rect.width(newFrameWidth)
    rect.height(newFrameHeight)
    rect.scaleX(1)
    rect.scaleY(1)

    const group = groupRef.current
    if (group) {
      group.clip({ x: 0, y: 0, width: newFrameWidth, height: newFrameHeight })
    }
    syncFrameDecor(newFrameWidth, newFrameHeight)

    // Reset inner group position (was shifted imperatively during live preview).
    // Pre-apply the compensated image position so Konva draws correctly before
    // the React re-render propagates the new contentOffset prop.
    const inner = innerGroupRef.current
    const img = imageRef.current
    if (inner) { inner.x(0); inner.y(0) }

    onGuidesChange([])

    // Read CMD from both the ref and the native event (belt-and-suspenders:
    // the ref may have been cleared early if the key was released before mouseup).
    const nativeEvent = e.evt as MouseEvent | TouchEvent
    const cmdFromEvent = 'metaKey' in nativeEvent && (nativeEvent as MouseEvent).metaKey
    const isPropMode = cmdHeldRef.current || cmdFromEvent

    if (isPropMode && !isPureRotation) {
      const scaleX = newFrameWidth / obj.frameWidth
      const scaleY = newFrameHeight / obj.frameHeight
      const scale = (scaleX + scaleY) / 2
      commitUpdate(obj.id, {
        frameX: newFrameX,
        frameY: newFrameY,
        frameWidth: newFrameWidth,
        frameHeight: newFrameHeight,
        rotation: newRotation,
        x: newFrameX,
        y: newFrameY,
        width: newFrameWidth,
        height: newFrameHeight,
        contentOffsetX: obj.contentOffsetX * scale,
        contentOffsetY: obj.contentOffsetY * scale,
        contentWidth: obj.contentWidth * scale,
        contentHeight: obj.contentHeight * scale,
      })
    } else if (isPureRotation) {
      // Pure rotation: content offsets are relative to the group and co-rotate —
      // they must not be adjusted.
      commitUpdate(obj.id, {
        frameX: newFrameX,
        frameY: newFrameY,
        frameWidth: newFrameWidth,
        frameHeight: newFrameHeight,
        rotation: newRotation,
        x: newFrameX,
        y: newFrameY,
        width: newFrameWidth,
        height: newFrameHeight,
        contentOffsetX: obj.contentOffsetX,
        contentOffsetY: obj.contentOffsetY,
      })
    } else if (resizeMode === 'auto') {
      const cover = fitCover(obj.contentWidth, obj.contentHeight, newFrameWidth, newFrameHeight)
      if (img) { img.x(cover.contentOffsetX); img.y(cover.contentOffsetY); img.width(cover.contentWidth); img.height(cover.contentHeight) }
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
      // Pre-apply so Konva renders correctly before the React re-render
      if (img) { img.x(newContentOffsetX); img.y(newContentOffsetY) }
      commitUpdate(obj.id, {
        frameX: newFrameX,
        frameY: newFrameY,
        frameWidth: newFrameWidth,
        frameHeight: newFrameHeight,
        rotation: newRotation,
        x: newFrameX,
        y: newFrameY,
        width: newFrameWidth,
        height: newFrameHeight,
        // When the frame origin shifts (top/left handle), contentOffset adjusts
        // so the image stays at the same canvas position after commit.
        contentOffsetX: newContentOffsetX,
        contentOffsetY: newContentOffsetY,
      })
    }
  }

  // Content drag with frame-edge snapping. Content coords are frame-local (the
  // node lives inside the clip group at frameX/frameY, inner group at 0,0), so
  // convert local→absolute for snap, then back. Skipped under rotation, where
  // simple additive conversion would be wrong.
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
    if (obj.rotation) { onGuidesChange([]); return }
    const { x: sx, y: sy, guides } = computeSnap(
      { x: obj.frameX + nx, y: obj.frameY + ny, width: obj.contentWidth, height: obj.contentHeight },
      obj.id,
    )
    node.x(sx - obj.frameX)
    node.y(sy - obj.frameY)
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
    const img = imageRef.current
    if (!img) return
    const newContentOffsetX = img.x()
    const newContentOffsetY = img.y()
    const newContentWidth = obj.contentWidth * img.scaleX()
    const newContentHeight = obj.contentHeight * img.scaleY()
    img.scaleX(1)
    img.scaleY(1)
    commitUpdate(obj.id, {
      contentOffsetX: newContentOffsetX,
      contentOffsetY: newContentOffsetY,
      contentWidth: newContentWidth,
      contentHeight: newContentHeight,
    })
  }

  const emptyFill = obj.fill?.color ?? EMPTY_FRAME_FILL
  const emptyIconSize = Math.min(obj.frameWidth, obj.frameHeight) * 0.18
  const emptyIconScale = emptyIconSize / 24
  // Centered image-icon hint painted on empty frames — shared by the grid-cell
  // early return and the interactive standalone path (rendered in place of the image).
  const emptyIcon = (
    <KonvaPath
      x={(obj.frameWidth - emptyIconSize) / 2}
      y={(obj.frameHeight - emptyIconSize) / 2}
      scaleX={emptyIconScale} scaleY={emptyIconScale}
      data={EMPTY_FRAME_ICON_PATH}
      stroke="#a89f92" strokeWidth={2} strokeScaleEnabled={false}
      listening={false} perfectDrawEnabled={false}
    />
  )

  // Grid cells stay non-interactive: the parent group's hit rect owns interaction,
  // so the empty cell only paints its placeholder. Standalone empty frames fall
  // through to the full interactive machinery below (frame Rect + Transformer).
  if (obj.isEmpty && isGridCell) {
    return (
      <>
        <Group
          x={obj.frameX} y={obj.frameY} rotation={obj.rotation}
          clip={groupClip} clipFunc={clipFunc}
          listening={false}
        >
          <Rect x={0} y={0} width={obj.frameWidth} height={obj.frameHeight} fill={emptyFill} listening={false} />
          {emptyIcon}
        </Group>
        {frameStrokeData ? (
          <KonvaPath
            x={obj.frameX} y={obj.frameY} rotation={obj.rotation}
            data={frameStrokeData}
            stroke={obj.frameStroke} strokeWidth={obj.frameStrokeWidth}
            strokeScaleEnabled={false} listening={false} perfectDrawEnabled={false}
          />
        ) : null}
      </>
    )
  }

  // Non-empty frames need a decoded bitmap; empty standalone frames render without one.
  if (!obj.isEmpty && !image) return null

  const isInMultiSelect = isInMultiSelectMode && selectedIds.includes(obj.id)

  return (
    <>
      {/* Visual clip container — purely for rendering, not for interaction in frame mode.
          clipFunc (ellipse/path/rounded-rect) takes precedence over the `clip` rect;
          when undefined Konva falls back to the zero-cost rect clip. */}
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
        {obj.isEmpty ? (
          // Empty standalone frame: placeholder fill (tracked via fillRectRef so it
          // follows live frame resizes) + centered icon, in place of the bitmap.
          <>
            <Rect
              ref={fillRectRef}
              x={0} y={0}
              width={obj.frameWidth} height={obj.frameHeight}
              fill={emptyFill}
              listening={false}
            />
            {emptyIcon}
          </>
        ) : (
          <>
            {obj.fill ? (
              <Rect
                ref={fillRectRef}
                x={0} y={0}
                width={obj.frameWidth} height={obj.frameHeight}
                fill={obj.fill.color}
                listening={false}
              />
            ) : null}
            <Group ref={innerGroupRef}>
              <KonvaImage
                ref={imageRef}
                // Non-null: the `!obj.isEmpty && !image` guard above returned null already.
                image={image!}
                x={obj.contentOffsetX}
                y={obj.contentOffsetY}
                width={obj.contentWidth}
                height={obj.contentHeight}
                draggable={obj.contentEditMode && !obj.locked}
                onClick={() => { if (obj.contentEditMode) useCanvasStore.getState().setSelected(id) }}
                onTap={() => { if (obj.contentEditMode) useCanvasStore.getState().setSelected(id) }}
                onDragStart={() => {
                  contentDragStartRef.current = { x: obj.contentOffsetX, y: obj.contentOffsetY }
                  startSnapSession(obj.id, { contentMode: true })
                }}
                onDragMove={handleContentDragMove}
                onDragEnd={(e) => { endSnapSession(); onGuidesChange([]); handleContentDragEnd(e) }}
                filters={allFilters}
                onTransformEnd={handleContentTransformEnd}
              />
            </Group>
          </>
        )}
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
        listening={
          !obj.contentEditMode &&
          // When a grid cell's parent group is selected (but this cell isn't entered yet),
          // pass all events through to the group's hit rect underneath.
          !(isGridCell && isParentGroupSelected && !isSelected)
        }
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
              // Suppress anchor-setting if the mouse moved significantly (was a drag)
              if (rectMouseDownPosRef.current) {
                const dx = e.evt.clientX - rectMouseDownPosRef.current.x
                const dy = e.evt.clientY - rectMouseDownPosRef.current.y
                rectMouseDownPosRef.current = null
                if (Math.sqrt(dx * dx + dy * dy) > 3) return
              }
              setAnchor(anchorId === obj.id ? null : obj.id)
            } else if (isGridCell && !isParentGroupSelected && !isSelected && obj.parentGroupId) {
              // Single click on a grid cell when group isn't yet selected → select the group
              useCanvasStore.getState().setSelected(obj.parentGroupId)
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
          // Group transformer drives sync via syncGroupRef during multi-select; skip single-object path.
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

          const screenThreshold = 8
          const logicalThreshold = screenThreshold / scale
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

export const CanvasImageNode = makeCanvasNode<ImageObject, CanvasImageNodeProps>(CanvasImageNodeInner)
