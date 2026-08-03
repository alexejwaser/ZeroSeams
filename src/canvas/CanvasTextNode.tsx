import React, { useRef, useEffect, useMemo } from 'react'
import { Text as KonvaText, Rect, Transformer } from 'react-konva'
import type Konva from 'konva'
import type { TextObject, TextSpan, CanvasObject } from '@/types/canvas'
import { axisLock } from './constants'
import { useCanvasStore } from './useCanvasStore'
import { makeCanvasNode } from './makeCanvasNode'
import { useViewportStore, selectScale, getCanvasScale } from './useViewportStore'
import { useSnapGuides } from './useSnapGuides'
import type { SnapGuide } from './useSnapGuides'
import { spanText, resolveSpanStyle, fontStyleToCSS } from './textSpans'
import { buildEffectFilters } from './effects/buildEffectFilters'

interface CanvasTextNodeProps {
  id: string
  onGuidesChange: (guides: SnapGuide[]) => void
  nodeRef?: React.RefObject<Konva.Node>
}

interface CanvasTextNodeInnerProps extends CanvasTextNodeProps {
  obj: TextObject
}

/**
 * Compute the character offset of a DOM node + offset within the contenteditable div.
 * Walks the div's child text nodes accumulating character counts.
 */
function domOffsetToCharIndex(div: HTMLDivElement, targetNode: Node, targetOffset: number): number {
  // Element-node case: targetOffset is a child index (e.g. from selectNodeContents).
  // Sum the textContent lengths of children [0, targetOffset).
  if (targetNode.nodeType !== Node.TEXT_NODE) {
    let count = 0
    const children = Array.from(targetNode.childNodes).slice(0, targetOffset)
    for (const child of children) count += (child.textContent ?? '').length
    return count
  }
  // Text-node case: walk the div's text nodes and accumulate character counts.
  let charCount = 0
  const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node !== null) {
    if (node === targetNode) return charCount + targetOffset
    charCount += (node.textContent ?? '').length
    node = walker.nextNode()
  }
  return charCount
}

/**
 * Inverse of domOffsetToCharIndex. Finds the text node and offset within it
 * that corresponds to a character index in the contenteditable div.
 */
function charIndexToDomOffset(div: HTMLDivElement, charIndex: number): { node: Node; offset: number } {
  let remaining = charIndex
  const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT)
  let node: Node | null = walker.nextNode()
  while (node !== null) {
    const len = (node.textContent ?? '').length
    if (remaining <= len) return { node, offset: remaining }
    remaining -= len
    node = walker.nextNode()
  }
  return { node: div, offset: div.childNodes.length }
}

function CanvasTextNodeInner({ id, obj, onGuidesChange, nodeRef }: CanvasTextNodeInnerProps): React.ReactElement {
  const isSelected = useCanvasStore((s) => s.selectedId === id)
  const textRef = useRef<Konva.Text>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const editDivRef = useRef<HTMLDivElement | null>(null)
  const displayDivRef = useRef<HTMLDivElement | null>(null)
  const updateObject = useCanvasStore((s) => s.updateObject)
  const commitUpdate = useCanvasStore((s) => s.commitUpdate)
  const selectedIds = useCanvasStore((s) => s.selectedIds)
  const addToSelection = useCanvasStore((s) => s.addToSelection)
  const anchorId = useCanvasStore((s) => s.anchorId)
  const setAnchor = useCanvasStore((s) => s.setAnchor)

  const isInMultiSelectMode = selectedIds.length > 1
  const isAnchor = anchorId === id
  const duplicateObjectAtOrigin = useCanvasStore((s) => s.duplicateObjectAtOrigin)
  const setContextMenu = useCanvasStore((s) => s.setContextMenu)
  const setTextEditing = useCanvasStore((s) => s.setTextEditing)
  const setTextSelection = useCanvasStore((s) => s.setTextSelection)
  const setCaptureTextSelection = useCanvasStore((s) => s.setCaptureTextSelection)
  const textEditingId = useCanvasStore((s) => s.textEditingId)
  const scale = useViewportStore(selectScale)
  const panX = useViewportStore((s) => s.panX)
  const panY = useViewportStore((s) => s.panY)
  const { computeSnap, computeSnapResize, snapRotation } = useSnapGuides()
  const snapEnabled = useCanvasStore((s) => s.snapEnabled)
  const pendingGuidesRef = useRef<SnapGuide[]>([])

  // Alt (option) key tracking for duplicate-on-drag
  const altHeldRef = useRef(false)
  const cmdHeldRef = useRef(false)
  const dragStartXRef = useRef(0)
  const dragStartYRef = useRef(0)
  const pendingDuplicateRef = useRef(false)

  const effectFilters = useMemo(() => buildEffectFilters(obj.effects), [obj.effects])

  // Sync nodeRef so CarouselStage group transformer can attach to this Konva node
  useEffect(() => {
    if (nodeRef) {
      (nodeRef as React.MutableRefObject<Konva.Node | null>).current = textRef.current
    }
  })

  useEffect(() => {
    const node = textRef.current
    if (!node) return
    if (effectFilters.length > 0) {
      node.cache()
      node.getLayer()?.batchDraw()
    } else {
      node.clearCache()
      node.getLayer()?.batchDraw()
    }
  }, [effectFilters])

  // Wire transformer when selected; suppress when group transformer is active
  useEffect(() => {
    const tr = transformerRef.current
    const node = textRef.current
    if (!tr || !node) return
    if (isInMultiSelectMode) {
      tr.nodes([])
      tr.getLayer()?.draw()
      return
    }
    if (isSelected) {
      tr.nodes([node])
      if (obj.locked) {
        tr.enabledAnchors([])
        tr.rotateEnabled(false)
      } else {
        tr.enabledAnchors([
          'top-left', 'top-center', 'top-right',
          'middle-right', 'bottom-right', 'bottom-center',
          'bottom-left', 'middle-left',
        ])
        tr.rotateEnabled(true)
      }
      tr.getLayer()?.batchDraw()
    } else {
      tr.nodes([])
      // Use synchronous draw() when detaching so the old transformer box is
      // cleared immediately — before the newly selected transformer paints.
      tr.getLayer()?.draw()
    }
  }, [isSelected, isInMultiSelectMode, obj.locked])

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

  useEffect(() => {
    const onDown = (e: KeyboardEvent): void => { if (e.key === 'Meta') cmdHeldRef.current = true }
    const onUp = (e: KeyboardEvent): void => { if (e.key === 'Meta') cmdHeldRef.current = false }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [])

  // When the panel applies a style (which may split/merge spans), rebuild the entire
  // DOM from obj.spans and restore the browser selection from the stored range.
  useEffect(() => {
    if (textEditingId !== obj.id) return
    const div = editDivRef.current
    if (!div) return

    const { textSelection: storedSel } = useCanvasStore.getState()

    div.innerHTML = ''
    obj.spans.forEach((span, i) => {
      const resolved = resolveSpanStyle(obj, i)
      const cssFont = fontStyleToCSS(resolved.fontStyle)
      const spanEl = document.createElement('span')
      spanEl.dataset.spanIdx = String(i)
      spanEl.textContent = span.text
      const editScale = scale
      spanEl.style.fontFamily = resolved.fontFamily
      spanEl.style.fontSize = `${resolved.fontSize * editScale}px`
      spanEl.style.fontWeight = cssFont.fontWeight
      spanEl.style.fontStyle = cssFont.fontStyle
      spanEl.style.color = resolved.fill
      spanEl.style.letterSpacing = `${resolved.letterSpacing * editScale}px`
      div.appendChild(spanEl)
    })

    if (storedSel && storedSel.start !== storedSel.end) {
      const startPos = charIndexToDomOffset(div, storedSel.start)
      const endPos = charIndexToDomOffset(div, storedSel.end)
      const range = document.createRange()
      range.setStart(startPos.node, startPos.offset)
      range.setEnd(endPos.node, endPos.offset)
      const sel = window.getSelection()
      if (sel) {
        sel.removeAllRanges()
        sel.addRange(range)
      }
    }
  }, [obj.spans, obj.id, textEditingId])

  // Store obj.opacity as a Konva attribute so exportFrames can restore it for export
  useEffect(() => {
    textRef.current?.setAttr('userOpacity', obj.opacity ?? 1)
  }, [obj.opacity])

  // Create a persistent non-interactive display div to render per-span rich text.
  // The KonvaText node is kept at opacity 0 for event handling only.
  useEffect(() => {
    const div = document.createElement('div')
    div.style.position = 'fixed'
    div.style.pointerEvents = 'none'
    div.style.userSelect = 'none'
    div.style.zIndex = '50'
    div.style.whiteSpace = 'pre-wrap'
    div.style.wordWrap = 'break-word'
    div.style.padding = '0'
    div.style.margin = '0'
    div.style.overflow = 'hidden'
    div.style.transformOrigin = '0 0'
    document.body.appendChild(div)
    displayDivRef.current = div
    return () => {
      document.body.removeChild(div)
      displayDivRef.current = null
    }
  }, [])

  // Sync display div position, content, and visibility on every relevant state change.
  // Also re-runs when viewport zoom/pan changes so the overlay tracks the canvas transform.
  useEffect(() => {
    const div = displayDivRef.current
    if (!div) return

    // Hide while contenteditable edit div is active — it takes over display
    if (textEditingId === obj.id) {
      div.style.display = 'none'
      return
    }

    const node = textRef.current
    if (!node) return
    const stage = node.getStage()
    if (!stage) return

    const stageBox = stage.container().getBoundingClientRect()
    const screenX = stageBox.left + panX + obj.x * scale
    const screenY = stageBox.top + panY + obj.y * scale

    div.style.display = 'block'
    div.style.left = `${screenX}px`
    div.style.top = `${screenY}px`
    div.style.width = `${obj.width * scale}px`
    div.style.minHeight = `${obj.height * scale}px`
    div.style.lineHeight = String(obj.lineHeight)
    div.style.textAlign = obj.align
    div.style.fontFamily = obj.fontFamily
    div.style.fontSize = `${obj.fontSize * scale}px`
    div.style.color = obj.fill
    div.style.opacity = String(obj.opacity ?? 1)
    div.style.transform = obj.rotation ? `rotate(${obj.rotation}deg)` : ''

    div.innerHTML = ''
    obj.spans.forEach((span, i) => {
      const resolved = resolveSpanStyle(obj, i)
      const cssFont = fontStyleToCSS(resolved.fontStyle)
      const spanEl = document.createElement('span')
      spanEl.textContent = span.text
      spanEl.style.fontFamily = resolved.fontFamily
      spanEl.style.fontSize = `${resolved.fontSize * scale}px`
      spanEl.style.fontWeight = cssFont.fontWeight
      spanEl.style.fontStyle = cssFont.fontStyle
      spanEl.style.color = resolved.fill
      spanEl.style.letterSpacing = `${resolved.letterSpacing * scale}px`
      div.appendChild(spanEl)
    })

    // Reposition on window resize (stage bounding rect changes)
    function onResize(): void {
      const stage2 = textRef.current?.getStage()
      if (!stage2 || !div) return
      const stageBox2 = stage2.container().getBoundingClientRect()
      const { panX: px, panY: py } = useViewportStore.getState()
      const sc = getCanvasScale()
      div.style.left = `${stageBox2.left + px + obj.x * sc}px`
      div.style.top = `${stageBox2.top + py + obj.y * sc}px`
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  // panX/panY are included so pan changes trigger a reposition even when obj hasn't changed
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obj, textEditingId, scale, panX, panY])

  // Inline editing on double-click — contenteditable div overlay
  function handleDblClick(): void {
    if (obj.locked) return
    const node = textRef.current
    if (!node) return
    const stage = node.getStage()
    if (!stage) return

    // Capture as non-null const so finish() closure can reference it safely
    const textNode = node

    // Get position using explicit formula — avoids getAbsolutePosition() inaccuracies
    const stageBox = stage.container().getBoundingClientRect()
    const screenX = stageBox.left + panX + obj.x * scale
    const screenY = stageBox.top + panY + obj.y * scale

    // Hide the Konva text node
    textNode.visible(false)
    textNode.getLayer()?.batchDraw()

    // Snapshot original spans for Escape-cancel
    const originalSpans: TextSpan[] = obj.spans.map((s) => ({ ...s }))

    const editScale = scale

    // Build contenteditable div
    const div = document.createElement('div')
    div.contentEditable = 'true'
    div.spellcheck = false
    div.style.position = 'fixed'
    div.style.left = `${screenX}px`
    div.style.top = `${screenY}px`
    div.style.width = `${obj.width * editScale}px`
    div.style.minHeight = `${obj.height * editScale}px`
    div.style.whiteSpace = 'pre-wrap'
    div.style.wordWrap = 'break-word'
    div.style.lineHeight = String(obj.lineHeight)
    div.style.textAlign = obj.align
    div.style.background = 'transparent'
    div.style.border = '1px dashed #f94608'
    div.style.outline = 'none'
    div.style.padding = '0'
    div.style.margin = '0'
    div.style.overflow = 'hidden'
    div.style.zIndex = '9999'
    // Base font from layer defaults (visual reference)
    div.style.fontFamily = obj.fontFamily
    div.style.fontSize = `${obj.fontSize * editScale}px`
    div.style.color = obj.fill

    // Populate one <span> per TextSpan
    obj.spans.forEach((span, i) => {
      const resolved = resolveSpanStyle(obj, i)
      const cssFont = fontStyleToCSS(resolved.fontStyle)
      const spanEl = document.createElement('span')
      spanEl.dataset.spanIdx = String(i)
      spanEl.textContent = span.text
      spanEl.style.fontFamily = resolved.fontFamily
      spanEl.style.fontSize = `${resolved.fontSize * editScale}px`
      spanEl.style.fontWeight = cssFont.fontWeight
      spanEl.style.fontStyle = cssFont.fontStyle
      spanEl.style.color = resolved.fill
      spanEl.style.letterSpacing = `${resolved.letterSpacing * editScale}px`
      div.appendChild(spanEl)
    })

    document.body.appendChild(div)
    editDivRef.current = div
    div.focus()

    // Select all text on entry
    const range = document.createRange()
    range.selectNodeContents(div)
    const sel = window.getSelection()
    if (sel) {
      sel.removeAllRanges()
      sel.addRange(range)
    }

    setTextEditing(obj.id)

    // Sync initial "select all" directly — selectionchange may not fire synchronously
    // for programmatic selections.
    const fullText = obj.spans.map((s) => s.text).join('')
    setTextSelection({ start: 0, end: fullText.length })

    // Reads the current browser selection into Zustand. Used as the selectionchange
    // handler and also registered in the store so PropertiesPanel can call it on
    // mousedown — before focus moves away from the contenteditable.
    function captureNow(): void {
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) return
      const r = selection.getRangeAt(0)
      if (!div.contains(r.commonAncestorContainer)) return
      const s = domOffsetToCharIndex(div, r.startContainer, r.startOffset)
      const e = domOffsetToCharIndex(div, r.endContainer, r.endOffset)
      const start = Math.min(s, e)
      const end = Math.max(s, e)
      if (start === end) {
        setTextSelection(null)        // collapsed inside div = plain click / cursor move
      } else {
        setTextSelection({ start, end })
      }
    }

    // selectionchange handles ALL cases:
    //   non-collapsed in div  → store range
    //   collapsed in div      → clear range (plain click, typing, arrow keys)
    //   outside div           → do nothing (preserves value when focus moves to panel input)
    function handleSelectionChange(): void {
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) return
      const r = selection.getRangeAt(0)
      if (!div.contains(r.commonAncestorContainer)) return
      captureNow()
    }
    document.addEventListener('selectionchange', handleSelectionChange)

    // Expose captureNow so PropertiesPanel can snapshot the selection at mousedown time.
    setCaptureTextSelection(captureNow)

    let cancelled = false
    let finished = false

    function finish(): void {
      if (finished) return
      finished = true
      document.removeEventListener('mousedown', handleDocMouseDown)
      document.removeEventListener('keydown', handleDocKeyDown)
      document.removeEventListener('selectionchange', handleSelectionChange)
      setCaptureTextSelection(null)
      editDivRef.current = null

      if (cancelled) {
        document.body.removeChild(div)
        textNode.visible(true)
        textNode.getLayer()?.batchDraw()
        setTextEditing(null)
        setTextSelection(null)
        return
      }

      // The panel may have applied applyStyleToRange during this session, updating
      // obj.spans in the store. Read the freshest state for style recovery.
      const currentObj = useCanvasStore.getState().objects[obj.id] as TextObject | undefined
      const currentSpans = currentObj?.spans ?? originalSpans

      const domText = div.textContent ?? ''
      const storeText = spanText({ ...obj, spans: currentSpans })

      let finalSpans: TextSpan[]

      if (domText === storeText) {
        // Text unchanged — user only styled. Store spans are already correct.
        finalSpans = currentSpans
      } else {
        // Text was edited — reconstruct spans from DOM children.
        const rebuilt: TextSpan[] = []
        div.childNodes.forEach((child) => {
          if (child.nodeType === Node.TEXT_NODE) {
            const text = child.textContent ?? ''
            if (text.length > 0) {
              const prevSibling = child.previousSibling
              const inheritStyle = prevSibling instanceof HTMLElement
                ? currentSpans[Number(prevSibling.dataset.spanIdx ?? 0)]?.style
                : currentSpans[0]?.style
              rebuilt.push({ text, style: inheritStyle })
            }
          } else if (child.nodeType === Node.ELEMENT_NODE) {
            const el = child as HTMLElement
            const text = el.textContent ?? ''
            if (text.length === 0) return
            const idxStr = el.dataset.spanIdx
            const style = idxStr !== undefined ? currentSpans[Number(idxStr)]?.style : undefined
            rebuilt.push({ text, style })
          }
        })
        finalSpans = rebuilt.length > 0 ? rebuilt : [{ text: '' }]
      }

      document.body.removeChild(div)
      textNode.visible(true)
      textNode.getLayer()?.batchDraw()

      const finalText = finalSpans.map((s) => s.text).join('')
      const spansChanged = finalText !== storeText
        || finalSpans.length !== currentSpans.length
        || finalSpans.some((s, i) => s.text !== currentSpans[i]?.text)

      if (spansChanged) {
        commitUpdate(obj.id, { spans: finalSpans } as Partial<TextObject> as Partial<CanvasObject>)
      }

      setTextEditing(null)
      setTextSelection(null)
    }

    // Exit when the user clicks outside the editing div AND outside the properties panel.
    // Using mousedown (not blur) so panel button clicks don't end the session before
    // the panel's own click handler fires.
    function handleDocMouseDown(e: MouseEvent): void {
      const target = e.target as Node
      const panel = document.getElementById('properties-panel')
      if (div.contains(target)) return
      if (panel?.contains(target)) return
      finish()
    }
    document.addEventListener('mousedown', handleDocMouseDown)

    // Escape exits regardless of where focus is
    function handleDocKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        cancelled = true
        finish()
      }
    }
    document.addEventListener('keydown', handleDocKeyDown)
  }

  const isInMultiSelect = isInMultiSelectMode && selectedIds.includes(obj.id)

  return (
    <>
      {/* Multi-select outline rect (rendered behind text) */}
      {isInMultiSelect && (
        <Rect
          x={obj.x}
          y={obj.y}
          width={obj.width}
          height={obj.height}
          rotation={obj.rotation}
          fill="transparent"
          stroke={isAnchor ? '#f5a623' : '#f94608'}
          strokeWidth={isAnchor ? 2 : 1}
          strokeScaleEnabled={false}
          perfectDrawEnabled={false}
          listening={false}
        />
      )}

      <KonvaText
        ref={textRef}
        x={obj.x}
        y={obj.y}
        width={obj.width}
        height={obj.height}
        rotation={obj.rotation}
        scaleX={obj.scaleX}
        scaleY={obj.scaleY}
        opacity={0}
        text={spanText(obj)}
        fontFamily={obj.fontFamily}
        fontSize={obj.fontSize}
        fontStyle={obj.fontStyle}
        align={obj.align}
        fill={obj.fill}
        letterSpacing={obj.letterSpacing}
        lineHeight={obj.lineHeight}
        wrap="word"
        filters={effectFilters}
        draggable={!obj.locked && !isInMultiSelectMode}
        onClick={(e) => {
          if (e.evt.shiftKey) {
            addToSelection(obj.id)
          } else if (isInMultiSelectMode && selectedIds.includes(obj.id)) {
            setAnchor(anchorId === obj.id ? null : obj.id)
          } else {
            useCanvasStore.getState().setSelected(id)
          }
        }}
        onTap={() => useCanvasStore.getState().setSelected(id)}
        onDblClick={handleDblClick}
        onDragStart={() => {
          dragStartXRef.current = obj.x
          dragStartYRef.current = obj.y
          pendingDuplicateRef.current = false
        }}
        onDragMove={(e) => {
          const dragNode = e.target as Konva.Text
          let rawX = dragNode.x()
          let rawY = dragNode.y()

          if (e.evt.shiftKey) {
            const { dx, dy } = axisLock(rawX - dragStartXRef.current, rawY - dragStartYRef.current)
            rawX = dragStartXRef.current + dx
            rawY = dragStartYRef.current + dy
            dragNode.x(rawX)
            dragNode.y(rawY)
          }

          const { x: snappedX, y: snappedY, guides } = computeSnap(
            { x: rawX, y: rawY, width: obj.width, height: obj.height },
            obj.id,
          )

          dragNode.x(snappedX)
          dragNode.y(snappedY)
          onGuidesChange(guides)
          updateObject(obj.id, { x: snappedX, y: snappedY })

          if (altHeldRef.current && !pendingDuplicateRef.current) {
            pendingDuplicateRef.current = true
          }
        }}
        onDragEnd={(e) => {
          onGuidesChange([])
          if (pendingDuplicateRef.current) {
            const originPos = { x: dragStartXRef.current, y: dragStartYRef.current }
            const finalPos = { x: e.target.x(), y: e.target.y() }
            duplicateObjectAtOrigin(obj.id, originPos, finalPos)
            pendingDuplicateRef.current = false
          } else {
            commitUpdate(obj.id, { x: e.target.x(), y: e.target.y() })
          }
        }}
        onTransform={(e) => {
          onGuidesChange(pendingGuidesRef.current)
          const node = e.target as Konva.Text
          const absWidth = node.width() * node.scaleX()
          const absHeight = node.height() * node.scaleY()
          node.width(absWidth)
          node.height(absHeight)
          node.scaleX(1)
          node.scaleY(1)
          updateObject(obj.id, {
            x: node.x(),
            y: node.y(),
            width: absWidth,
            height: absHeight,
            scaleX: 1,
            scaleY: 1,
            rotation: node.rotation(),
          })
        }}
        onTransformEnd={(e) => {
          onGuidesChange([])
          const node = e.target as Konva.Text
          const absWidth = node.width() * node.scaleX()
          const absHeight = node.height() * node.scaleY()
          node.width(absWidth)
          node.height(absHeight)
          node.scaleX(1)
          node.scaleY(1)
          const evt = e.evt as MouseEvent
          const isPropScale = (cmdHeldRef.current || evt.metaKey) && evt.shiftKey
          if (isPropScale && obj.width > 0) {
            const newFontSize = Math.max(4, Math.round(obj.fontSize * (absWidth / obj.width)))
            commitUpdate(obj.id, {
              x: node.x(), y: node.y(),
              width: absWidth, height: absHeight,
              scaleX: 1, scaleY: 1,
              rotation: snapRotation(node.rotation()),
              fontSize: newFontSize,
            })
          } else {
            commitUpdate(obj.id, {
              x: node.x(), y: node.y(),
              width: absWidth, height: absHeight,
              scaleX: 1, scaleY: 1,
              rotation: snapRotation(node.rotation()),
            })
          }
        }}
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
        enabledAnchors={[
          'top-left', 'top-center', 'top-right',
          'middle-right', 'bottom-right', 'bottom-center',
          'bottom-left', 'middle-left',
        ]}
        boundBoxFunc={(oldBox, newBox) => {
          if (newBox.width < 20 || newBox.height < 10) return oldBox
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
            false,
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

export const CanvasTextNode = makeCanvasNode<TextObject, CanvasTextNodeProps>(CanvasTextNodeInner, 'text')
