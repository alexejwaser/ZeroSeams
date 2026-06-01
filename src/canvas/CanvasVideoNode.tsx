import React, { useRef, useEffect, useState, useMemo } from 'react'
import { Group, Image as KonvaImage, Rect, Transformer } from 'react-konva'
import type Konva from 'konva'
import type { VideoObject } from '@/types/canvas'
import { useCanvasStore } from './useCanvasStore'
import { useSnapGuides } from './useSnapGuides'
import type { SnapGuide } from './useSnapGuides'
import { CANVAS_SCALE, axisLock } from './constants'
import { useViewportStore } from './useViewportStore'
import { registerVideoElement, unregisterVideoElement } from './videoElementRegistry'

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
  const commitUpdate = useCanvasStore((s) => s.commitUpdate)
  const updateObject = useCanvasStore((s) => s.updateObject)
  const selectedIds = useCanvasStore((s) => s.selectedIds)
  const addToSelection = useCanvasStore((s) => s.addToSelection)
  const anchorId = useCanvasStore((s) => s.anchorId)
  const setAnchor = useCanvasStore((s) => s.setAnchor)
  const duplicateObjectAtOrigin = useCanvasStore((s) => s.duplicateObjectAtOrigin)
  const setContextMenu = useCanvasStore((s) => s.setContextMenu)
  const resizeMode = useCanvasStore((s) => s.resizeMode)
  const { zoom, panX, panY } = useViewportStore((s) => ({ zoom: s.zoom, panX: s.panX, panY: s.panY }))
  const snapEnabled = useCanvasStore((s) => s.snapEnabled)

  const isInMultiSelectMode = selectedIds.length > 1
  const isAnchor = anchorId === id
  const { computeSnap, computeSnapResize, snapRotation } = useSnapGuides()

  const frameRectRef = useRef<Konva.Rect>(null)
  const groupRef = useRef<Konva.Group>(null)
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
    videoElRef.current = vid

    function onLoaded(): void {
      setVideoEl(vid)
      registerVideoElement(id, vid)
      void vid.play()
    }
    vid.addEventListener('loadedmetadata', onLoaded, { once: true })
    vid.src = `zeroseams-media://${obj.filePath}`
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

  // RAF loop — keeps Konva repainting while video is playing.
  useEffect(() => {
    if (!videoEl) return

    function tick(): void {
      const layer = groupRef.current?.getLayer()
      if (layer) layer.batchDraw()
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [videoEl])

  const groupClip = useMemo(
    () => ({ x: 0, y: 0, width: obj.frameWidth, height: obj.frameHeight }),
    [obj.frameWidth, obj.frameHeight],
  )

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
        tr.borderStroke('#ff7043')
        tr.enabledAnchors(['top-left', 'top-center', 'top-right', 'middle-right', 'bottom-right', 'bottom-center', 'bottom-left', 'middle-left'])
        tr.rotateEnabled(true)
      } else if (obj.locked) {
        tr.nodes([frameRect])
        tr.borderStroke('#0096ff')
        tr.enabledAnchors([])
        tr.rotateEnabled(false)
      } else {
        tr.nodes([frameRect])
        tr.borderStroke('#0096ff')
        tr.enabledAnchors(['top-left', 'top-center', 'top-right', 'middle-right', 'bottom-right', 'bottom-center', 'bottom-left', 'middle-left'])
        tr.rotateEnabled(true)
      }
      tr.getLayer()?.batchDraw()
    } else {
      tr.nodes([])
      tr.getLayer()?.draw()
    }
  }, [isSelected, isInMultiSelectMode, obj.contentEditMode, obj.locked, videoEl])

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
        imgNode.x(obj.contentOffsetX * scaleX)
        imgNode.y(obj.contentOffsetY * scaleY)
        imgNode.width(obj.contentWidth * scaleX)
        imgNode.height(obj.contentHeight * scaleY)
      } else if (cmdHeldRef.current && !isPureRotation) {
        const scaleX = newWidth / obj.frameWidth
        const scaleY = newHeight / obj.frameHeight
        const scale = (scaleX + scaleY) / 2
        imgNode.x(obj.contentOffsetX * scale)
        imgNode.y(obj.contentOffsetY * scale)
        imgNode.width(obj.contentWidth * scale)
        imgNode.height(obj.contentHeight * scale)
      } else if (isPureRotation) {
        imgNode.x(obj.contentOffsetX)
        imgNode.y(obj.contentOffsetY)
      } else if (resizeMode === 'auto') {
        const aspect = obj.contentWidth / obj.contentHeight
        const fAspect = newWidth / newHeight
        let cW: number, cH: number
        if (aspect > fAspect) { cH = newHeight; cW = cH * aspect }
        else { cW = newWidth; cH = cW / aspect }
        imgNode.x((newWidth - cW) / 2)
        imgNode.y((newHeight - cH) / 2)
        imgNode.width(cW)
        imgNode.height(cH)
      } else {
        imgNode.x(obj.contentOffsetX)
        imgNode.y(obj.contentOffsetY)
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
        opacity={obj.opacity}
        listening={obj.contentEditMode}
      >
        <KonvaImage
          ref={videoImageRef}
          image={videoEl}
          x={obj.contentOffsetX}
          y={obj.contentOffsetY}
          width={obj.contentWidth}
          height={obj.contentHeight}
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
      </Group>

      <Rect
        ref={frameRectRef}
        x={obj.frameX}
        y={obj.frameY}
        width={obj.frameWidth}
        height={obj.frameHeight}
        rotation={obj.rotation}
        fill="transparent"
        stroke={isAnchor && isInMultiSelect ? '#f5a623' : '#0096ff'}
        strokeWidth={isAnchor && isInMultiSelect ? 2 : 1}
        strokeEnabled={obj.contentEditMode || isInMultiSelect}
        strokeScaleEnabled={false}
        perfectDrawEnabled={false}
        draggable={!obj.locked && !obj.contentEditMode && !isInMultiSelectMode}
        listening={!obj.contentEditMode}
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
