import React, { useEffect, useState, useRef } from 'react'
import { useCanvasStore } from '@/canvas/useCanvasStore'
import { useThumbnailStore } from '@/canvas/useThumbnailStore'
import { useAI } from '@/ai'
import { useAIStore } from '@/ai'
import { useExternalEdit } from '@/canvas/useExternalEdit'
import { useSaveStatusStore } from '@/store'
import type { BackgroundRemovalOperation } from '@/types/ai'
import type { ImageObject, TextObject, ShapeObject, PathObject, VideoObject, GroupObject, GuidelineObject, CanvasObject } from '@/types/canvas'
import { GRID_TEMPLATES } from '@/canvas/gridTemplates'
import Tooltip from './Tooltip'
import { iconBtnStyle } from './iconBtnStyle'
import { PenTool, Square, Circle, Trash2, Pencil, Eye, EyeOff } from 'lucide-react'
import './adjustments.css'
import { ColorInput } from './ColorInput'
import { NumericInput } from './NumericInput'

import { rotateAroundCenter } from '@/canvas/geometry'

import { NumberField, sectionLabelStyle } from './properties/shared'
import { AlignDistributeSection } from './properties/AlignDistributeSection'
import { TextSection } from './properties/TextSection'
import { EffectsSection } from './properties/EffectsSection'
import { AdjustmentsSection } from './properties/AdjustmentsSection'
import { VideoSection } from './properties/VideoSection'

// ---------------------------------------------------------------------------
// CanvasSection — shown when nothing is selected
// ---------------------------------------------------------------------------

function CanvasSection(): React.ReactElement {
  return (
    <div style={{ padding: '12px 12px 0', color: '#555555', fontSize: 12 }}>
      Select an object to see its properties, or open Frame Settings to configure the canvas.
    </div>
  )
}


// ---------------------------------------------------------------------------
// PropertiesPanel (root export)
// ---------------------------------------------------------------------------

export function PropertiesPanel(): React.ReactElement {
  const objects = useCanvasStore((s) => s.objects)
  const selectedId = useCanvasStore((s) => s.selectedId)
  const selectedIds = useCanvasStore((s) => s.selectedIds)
  const updateObject = useCanvasStore((s) => s.updateObject)
  const commitUpdate = useCanvasStore((s) => s.commitUpdate)
  const startDrag = useCanvasStore((s) => s.startDrag)
  const adjustmentsBypass = useCanvasStore((s) => s.adjustmentsBypass)
  const toggleAdjustmentsBypass = useCanvasStore((s) => s.toggleAdjustmentsBypass)
  const enterMaskEditMode = useCanvasStore((s) => s.enterMaskEditMode)
  const maskDrawMode = useCanvasStore((s) => s.maskDrawMode)
  const enterMaskDrawMode = useCanvasStore((s) => s.enterMaskDrawMode)
  const clearMaskDrawMode = useCanvasStore((s) => s.clearMaskDrawMode)
  const alignObjects = useCanvasStore((s) => s.alignObjects)
  const anchorId = useCanvasStore((s) => s.anchorId)
  const setAnchor = useCanvasStore((s) => s.setAnchor)

  const thumbnails = useThumbnailStore((s) => s.thumbnails)
  const distributeObjects = useCanvasStore((s) => s.distributeObjects)
  const textEditingId = useCanvasStore((s) => s.textEditingId)
  const textSelection = useCanvasStore((s) => s.textSelection)
  const captureTextSelection = useCanvasStore((s) => s.captureTextSelection)

  const { removeBg } = useAI()
  const operations = useAIStore((s) => s.operations)
  const clearOperation = useAIStore((s) => s.clearOperation)

  const { editExternally, stopEditing, activeObjectId } = useExternalEdit()
  const currentFilePath = useSaveStatusStore((s) => s.currentFilePath)
  const autosaveFilePath = useSaveStatusStore((s) => s.autosaveFilePath)
  const effectiveFilePath = currentFilePath ?? autosaveFilePath
  const [externalEditor, setExternalEditor] = useState<ExternalEditor | null>(null)

  const [panelHeight, setPanelHeight] = useState<number | 'auto'>('auto')
  const innerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!innerRef.current) return
    const ro = new ResizeObserver(([entry]) => setPanelHeight(entry.contentRect.height))
    ro.observe(innerRef.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    void window.electronAPI.getExternalEditor().then(setExternalEditor)
  }, [])

  async function pickNewEditor(): Promise<void> {
    const editor = await window.electronAPI.setExternalEditor()
    if (editor) setExternalEditor(editor)
  }

  const selectedObj = selectedId !== null ? objects[selectedId] : null
  const isImage = selectedObj?.type === 'image'
  const isText = selectedObj?.type === 'text'
  const isShape = selectedObj?.type === 'shape'
  const isPath = selectedObj?.type === 'path'
  const isVideo = selectedObj?.type === 'video'
  const isGroup = selectedObj?.type === 'group'
  const isGuideline = selectedObj?.type === 'guideline'
  const isMultiSelect = selectedIds.length > 1
  const isNoneSelected = selectedId === null && selectedIds.length === 0

  const activeBgOp: BackgroundRemovalOperation | undefined = selectedId
    ? (Object.values(operations).find(
        (op) => op.type === 'background-removal' && op.targetObjectId === selectedId
      ) as BackgroundRemovalOperation | undefined)
    : undefined

  React.useEffect(() => {
    if (activeBgOp?.status === 'done') {
      const t = setTimeout(() => clearOperation(activeBgOp.id), 2000)
      return () => clearTimeout(t)
    }
    return undefined
  }, [activeBgOp?.status, activeBgOp?.id, clearOperation])

  function patch(partial: Parameters<typeof updateObject>[1]): void {
    if (!selectedId) return
    updateObject(selectedId, partial)
  }

  function handleRemoveBg(): void {
    if (selectedId) void removeBg(selectedId)
  }

  // When a text layer is in inline edit mode, prevent non-input mouse clicks in this
  // panel from stealing focus away from the contenteditable. Buttons, toggles, color
  // swatches, and label clicks all go through here. Actual <input> and <select> elements
  // are exempt so they can still receive keyboard focus when needed (e.g. font-size field).
  function handlePanelMouseDown(e: React.MouseEvent): void {
    if (!textEditingId) return
    // Snapshot the live browser selection NOW — before focus can move away
    // from the contenteditable (either via preventDefault below or by focusing an input).
    captureTextSelection?.()
    const target = e.target as HTMLElement
    const needsKeyboardFocus =
      target instanceof HTMLInputElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLTextAreaElement
    if (!needsKeyboardFocus) {
      e.preventDefault()
    }
  }

  return (
    <div
      id="properties-panel"
      onMouseDown={handlePanelMouseDown}
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        zIndex: 20,
        width: 300,
        boxSizing: 'border-box',
        background: 'var(--bg-panel)',
        borderLeft: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
        borderRadius: '0 0 16px 16px',
        overflow: 'hidden',
        height: panelHeight,
        transition: 'height 120ms ease-out',
      }}
    >
      <div
        ref={innerRef}
        style={{ maxHeight: 'calc(100vh - 52px)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
        className="panel-scroll"
      >
      {/* Title */}
      <div
        style={{
          padding: '12px 12px 8px',
          color: '#111111',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          fontFamily: 'var(--font)',
          borderBottom: '1px solid #e8e0d5',
          position: 'sticky',
          top: 0,
          background: 'var(--bg-panel)',
          zIndex: 1,
        }}
      >
        Properties
      </div>

      {/* Body */}
      <div
        style={{
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          paddingBottom: 16,
          paddingRight: 4,
        }}
      >
        {/* Multi-select: align/distribute */}
        {isMultiSelect && (
          <AlignDistributeSection
            selectedCount={selectedIds.length}
            selectedIds={selectedIds}
            objects={objects}
            anchorId={anchorId}
            onAlign={alignObjects}
            onDistribute={distributeObjects}
            onSetAnchor={setAnchor}
          />
        )}

        {/* Nothing selected: canvas properties */}
        {isNoneSelected && (
          <CanvasSection />
        )}

        {/* Single object selected: per-object properties */}
        {!isMultiSelect && selectedObj !== null && !isImage && !isText && !isShape && !isPath && !isVideo && !isGroup && !isGuideline && (
          <div
            style={{
              padding: '20px 12px',
              color: '#555555',
              fontSize: 13,
            }}
          >
            No properties
          </div>
        )}

        {/* Video object */}
        {!isMultiSelect && selectedObj !== null && isVideo && selectedId !== null && (
          <>
            <VideoSection
              videoObj={selectedObj as VideoObject}
              selectedId={selectedId}
              onStartDrag={startDrag}
              onUpdate={updateObject}
              onCommit={commitUpdate}
            />
            {selectedObj.parentGroupId && (
              <div style={{ padding: '0 12px 12px' }}>
                <button
                  onClick={() => useCanvasStore.getState().disconnectGridCell(selectedId)}
                  style={{
                    width: '100%',
                    padding: '6px 0',
                    background: 'none',
                    border: '1px solid var(--stroke)',
                    borderRadius: 6,
                    fontSize: 11,
                    fontFamily: 'var(--font)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  Disconnect from grid
                </button>
              </div>
            )}
          </>
        )}

        {/* Text object */}
        {!isMultiSelect && selectedObj !== null && isText && selectedId !== null && (
          <>
            <TextSection
              textObj={selectedObj as TextObject}
              selectedId={selectedId}
              textEditingId={textEditingId}
              textSelection={textSelection}
              onStartDrag={startDrag}
              onUpdate={updateObject}
              onCommit={commitUpdate}
            />
            <div style={{ padding: '0 12px' }}>
              <EffectsSection
                effects={(selectedObj as TextObject).effects}
                onUpdate={(fx) => updateObject(selectedId, { effects: fx })}
                onCommit={(fx) => commitUpdate(selectedId, { effects: fx })}
              />
            </div>
          </>
        )}

        {/* Shape object */}
        {!isMultiSelect && selectedObj !== null && isShape && (() => {
          const shapeObj = selectedObj as ShapeObject
          return (
            <div style={{ padding: '12px 12px 0' }}>
              {/* Rotation slider + numeric input */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <label style={{ color: '#555555', fontSize: 12, width: 64, flexShrink: 0 }}>Rotation</label>
                <input
                  type="range" min={-360} max={360} step={1}
                  value={Math.round(shapeObj.rotation ?? 0)}
                  onMouseDown={startDrag}
                  onChange={e => {
                    const newRot = Number(e.target.value)
                    if (shapeObj.kind === 'ellipse') {
                      updateObject(shapeObj.id, { rotation: newRot })
                    } else {
                      updateObject(shapeObj.id, rotateAroundCenter(
                        shapeObj.x, shapeObj.y, shapeObj.width, shapeObj.height,
                        shapeObj.rotation ?? 0, newRot,
                      ))
                    }
                  }}
                  onMouseUp={e => {
                    const newRot = Number((e.target as HTMLInputElement).value)
                    if (shapeObj.kind === 'ellipse') {
                      commitUpdate(shapeObj.id, { rotation: newRot })
                    } else {
                      commitUpdate(shapeObj.id, rotateAroundCenter(
                        shapeObj.x, shapeObj.y, shapeObj.width, shapeObj.height,
                        shapeObj.rotation ?? 0, newRot,
                      ))
                    }
                  }}
                  style={{ flex: 1 }}
                />
                <NumericInput
                  value={Math.round(shapeObj.rotation ?? 0)}
                  min={-360} max={360}
                  width={48}
                  onCommit={newRot => {
                    if (shapeObj.kind === 'ellipse') {
                      commitUpdate(shapeObj.id, { rotation: newRot })
                    } else {
                      commitUpdate(shapeObj.id, rotateAroundCenter(
                        shapeObj.x, shapeObj.y, shapeObj.width, shapeObj.height,
                        shapeObj.rotation ?? 0, newRot,
                      ))
                    }
                  }}
                />
              </div>
              {/* Opacity slider + numeric input */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <label style={{ color: '#555555', fontSize: 12, width: 64, flexShrink: 0 }}>Opacity</label>
                <input
                  type="range" min={0} max={100} step={1}
                  value={Math.round((shapeObj.opacity ?? 1) * 100)}
                  onMouseDown={startDrag}
                  onChange={e => patch({ opacity: Number(e.target.value) / 100 })}
                  onMouseUp={e => commitUpdate(shapeObj.id, { opacity: Number((e.target as HTMLInputElement).value) / 100 })}
                  style={{ flex: 1 }}
                />
                <NumericInput
                  value={Math.round((shapeObj.opacity ?? 1) * 100)}
                  min={0} max={100}
                  width={44}
                  onCommit={v => commitUpdate(shapeObj.id, { opacity: v / 100 })}
                />
              </div>
              <div style={sectionLabelStyle}>Fill</div>
              <ColorInput value={shapeObj.fill || '#000000'} onChange={(color) => { commitUpdate(shapeObj.id, { fill: color }) }} fixed />
              <div style={sectionLabelStyle}>Stroke</div>
              <ColorInput value={shapeObj.stroke || '#000000'} onChange={(color) => { commitUpdate(shapeObj.id, { stroke: color }) }} fixed />
              <NumberField label="Stroke W." value={shapeObj.strokeWidth} min={0} step={0.5} onChange={(val) => { commitUpdate(shapeObj.id, { strokeWidth: val }) }} />
              {shapeObj.kind === 'rect' && (
                <NumberField label="Corner R." value={shapeObj.cornerRadius ?? 0} min={0} onChange={(val) => { commitUpdate(shapeObj.id, { cornerRadius: val }) }} />
              )}
              <EffectsSection
                effects={shapeObj.effects}
                onUpdate={(fx) => updateObject(shapeObj.id, { effects: fx })}
                onCommit={(fx) => commitUpdate(shapeObj.id, { effects: fx })}
              />
            </div>
          )
        })()}

        {/* Path object */}
        {!isMultiSelect && selectedObj !== null && isPath && (() => {
          const pathObj = selectedObj as PathObject
          return (
            <div style={{ padding: '12px 12px 0' }}>
              {pathObj.pathEditMode && (
                <div style={{
                  background: 'rgba(249,70,8,0.08)',
                  border: '1px solid #f94608',
                  borderRadius: 8,
                  padding: '6px 8px',
                  marginBottom: 8,
                  color: '#f94608',
                  fontSize: 11,
                }}>
                  Path edit mode — drag anchors and handles
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <label style={{ color: '#555555', fontSize: 12, width: 64, flexShrink: 0 }}>Opacity</label>
                <input
                  type="range" min={0} max={100} step={1}
                  value={Math.round((pathObj.opacity ?? 1) * 100)}
                  onMouseDown={startDrag}
                  onChange={e => patch({ opacity: Number(e.target.value) / 100 })}
                  onMouseUp={e => commitUpdate(pathObj.id, { opacity: Number((e.target as HTMLInputElement).value) / 100 })}
                  style={{ flex: 1 }}
                />
                <span style={{ minWidth: 32, textAlign: 'right', fontSize: 11, color: '#555555' }}>
                  {Math.round((pathObj.opacity ?? 1) * 100)}%
                </span>
              </div>
              <div style={sectionLabelStyle}>Fill</div>
              <ColorInput
                value={pathObj.fill || '#000000'}
                onChange={(color) => { commitUpdate(pathObj.id, { fill: color }) }}
                fixed
              />
              <div style={sectionLabelStyle}>Stroke</div>
              <ColorInput
                value={pathObj.stroke || '#000000'}
                onChange={(color) => { commitUpdate(pathObj.id, { stroke: color }) }}
                fixed
              />
              <NumberField
                label="Stroke W."
                value={pathObj.strokeWidth}
                min={0}
                step={0.5}
                onChange={(val) => { commitUpdate(pathObj.id, { strokeWidth: val }) }}
              />
              <EffectsSection
                effects={pathObj.effects}
                onUpdate={(fx) => updateObject(pathObj.id, { effects: fx })}
                onCommit={(fx) => commitUpdate(pathObj.id, { effects: fx })}
              />
            </div>
          )
        })()}


        {/* Group object (grid) */}
        {!isMultiSelect && selectedObj !== null && isGroup && (() => {
          const group = selectedObj as GroupObject
          if (!group.isGrid) return null
          return (
            <div style={{ padding: '0 16px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Grid
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 32 }}>Gap</span>
                <input
                  type="range"
                  min={0} max={40} step={1}
                  value={group.gridGap ?? 8}
                  onMouseDown={() => startDrag()}
                  onChange={e => {
                    const newGap = Number(e.target.value)
                    updateObject(group.id, { gridGap: newGap })
                    const template = GRID_TEMPLATES.find(t => t.id === group.gridTemplateId)
                    if (template) {
                      const cells = template.cells(group.width, group.height, newGap)
                      group.childIds.forEach((childId, i) => {
                        const cell = cells[i]
                        if (!cell) return
                        const child = useCanvasStore.getState().objects[childId]
                        if (!child) return
                        updateObject(childId, {
                          frameX: group.x + cell.x, frameY: group.y + cell.y,
                          frameWidth: cell.w, frameHeight: cell.h,
                          x: group.x + cell.x, y: group.y + cell.y,
                          width: cell.w, height: cell.h,
                        } as Partial<CanvasObject>)
                      })
                    }
                  }}
                  onMouseUp={() => commitUpdate(group.id, {})}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 24, textAlign: 'right' }}>
                  {group.gridGap ?? 8}
                </span>
              </div>
            </div>
          )
        })()}

        {/* Guideline object */}
        {!isMultiSelect && selectedObj !== null && isGuideline && (() => {
          const g = selectedObj as GuidelineObject
          return (
            <div style={{ padding: '12px 12px 0' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Guideline
              </div>
              <NumberField
                label={g.orientation === 'horizontal' ? 'Y Position' : 'X Position'}
                value={Math.round(g.position)}
                step={1}
                onChange={(val) => commitUpdate(g.id, { position: val })}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <label style={{ color: '#555555', fontSize: 12, width: 64, flexShrink: 0 }}>Orientation</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['horizontal', 'vertical'] as const).map((o) => (
                    <button
                      key={o}
                      onClick={() => commitUpdate(g.id, { orientation: o })}
                      style={{
                        padding: '2px 8px',
                        fontSize: 11,
                        borderRadius: 6,
                        border: '1px solid',
                        borderColor: g.orientation === o ? '#f94608' : '#d4ccc2',
                        background: g.orientation === o ? '#f94608' : '#ffffff',
                        color: g.orientation === o ? '#ffffff' : '#555555',
                        cursor: 'pointer',
                      }}
                    >
                      {o === 'horizontal' ? 'H' : 'V'}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <label style={{ color: '#555555', fontSize: 12, width: 64, flexShrink: 0 }}>All frames</label>
                <input
                  type="checkbox"
                  checked={g.spanAllFrames}
                  onChange={(e) => commitUpdate(g.id, {
                    spanAllFrames: e.target.checked,
                    frameIndex: e.target.checked ? -1 : Math.max(0, g.frameIndex),
                  })}
                />
              </div>
            </div>
          )
        })()}

        {/* Image object */}
        {!isMultiSelect && selectedObj !== null && isImage && (() => {
          const imgObj = selectedObj as ImageObject
          const isContentMode = imgObj.contentEditMode === true

          if (!isContentMode) {
            // FRAME MODE
            return (
              <div style={{ padding: '12px 12px 0' }}>
                {/* Rotation slider + numeric input */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <label style={{ color: '#555555', fontSize: 12, width: 64, flexShrink: 0 }}>Rotation</label>
                  <input
                    type="range" min={-360} max={360} step={1}
                    value={Math.round(imgObj.rotation ?? 0)}
                    onMouseDown={startDrag}
                    onChange={e => {
                      const newRot = Number(e.target.value)
                      const { x: fx, y: fy, rotation } = rotateAroundCenter(
                        imgObj.frameX, imgObj.frameY, imgObj.frameWidth, imgObj.frameHeight,
                        imgObj.rotation ?? 0, newRot,
                      )
                      updateObject(imgObj.id, { rotation, frameX: fx, frameY: fy, x: fx, y: fy })
                    }}
                    onMouseUp={e => {
                      const newRot = Number((e.target as HTMLInputElement).value)
                      const { x: fx, y: fy, rotation } = rotateAroundCenter(
                        imgObj.frameX, imgObj.frameY, imgObj.frameWidth, imgObj.frameHeight,
                        imgObj.rotation ?? 0, newRot,
                      )
                      commitUpdate(imgObj.id, { rotation, frameX: fx, frameY: fy, x: fx, y: fy })
                    }}
                    style={{ flex: 1 }}
                  />
                  <NumericInput
                    value={Math.round(imgObj.rotation ?? 0)}
                    min={-360} max={360}
                    width={48}
                    onCommit={newRot => {
                      const { x: fx, y: fy, rotation } = rotateAroundCenter(
                        imgObj.frameX, imgObj.frameY, imgObj.frameWidth, imgObj.frameHeight,
                        imgObj.rotation ?? 0, newRot,
                      )
                      commitUpdate(imgObj.id, { rotation, frameX: fx, frameY: fy, x: fx, y: fy })
                    }}
                  />
                </div>
                {/* Opacity slider + numeric input */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <label style={{ color: '#555555', fontSize: 12, width: 64, flexShrink: 0 }}>Opacity</label>
                  <input
                    type="range" min={0} max={100} step={1}
                    value={Math.round((imgObj.opacity ?? 1) * 100)}
                    onMouseDown={startDrag}
                    onChange={e => patch({ opacity: Number(e.target.value) / 100 })}
                    onMouseUp={e => commitUpdate(imgObj.id, { opacity: Number((e.target as HTMLInputElement).value) / 100 })}
                    style={{ flex: 1 }}
                  />
                  <NumericInput
                    value={Math.round((imgObj.opacity ?? 1) * 100)}
                    min={0} max={100}
                    width={44}
                    onCommit={v => commitUpdate(imgObj.id, { opacity: v / 100 })}
                  />
                </div>
                {(imgObj as ImageObject).isEmpty && (
                  <div style={{ padding: '4px 0 8px', color: 'var(--text-muted)', fontSize: 12, fontStyle: 'italic' }}>
                    No media — click + to add
                  </div>
                )}
                {imgObj.parentGroupId && (
                  <div style={{ marginTop: 8, marginBottom: 4 }}>
                    <button
                      onClick={() => useCanvasStore.getState().disconnectGridCell(imgObj.id)}
                      style={{
                        width: '100%',
                        padding: '6px 0',
                        background: 'none',
                        border: '1px solid var(--stroke)',
                        borderRadius: 6,
                        fontSize: 11,
                        fontFamily: 'var(--font)',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      Disconnect from grid
                    </button>
                  </div>
                )}
                <div style={{ color: '#555555', fontSize: 11, marginTop: 8, marginBottom: 8 }}>
                  Double-click image to edit content
                </div>

                {/* Mask section */}
                <div style={{ borderTop: '1px solid #e8e0d5', paddingTop: 10, marginTop: 4, marginBottom: 10 }}>
                  <div style={{ color: '#555555', fontSize: 9, fontWeight: 700, letterSpacing: '1.5px',
                    textTransform: 'uppercase' as const, fontFamily: 'var(--font)', marginBottom: 8 }}>Mask</div>

                  {imgObj.maskEditMode ? (
                    /* Mask edit mode active banner */
                    <div style={{
                      background: 'rgba(82,183,136,0.1)',
                      border: '1px solid #52b788',
                      borderRadius: 8,
                      padding: '6px 10px',
                      marginBottom: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}>
                      <span style={{ color: '#2d6a4f', fontSize: 11 }}>Editing mask path</span>
                      <button
                        onClick={() => {
                          if (selectedId) commitUpdate(selectedId, { maskEditMode: false })
                        }}
                        style={{
                          background: '#2d6a4f',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 999,
                          padding: '2px 8px',
                          cursor: 'pointer',
                          fontSize: 11,
                        }}
                      >
                        Done
                      </button>
                    </div>
                  ) : imgObj.mask == null ? (
                    /* No mask — draw mode picker or active draw banner */
                    maskDrawMode?.id === selectedId ? (
                      /* Draw in progress for this image */
                      <div>
                        <div style={{ color: '#f94608', fontSize: 11, marginBottom: 8 }}>
                          Drawing {maskDrawMode.tool} mask —{' '}
                          {maskDrawMode.tool === 'pen'
                            ? 'click to add points, close path to finish'
                            : 'drag to define shape'}
                        </div>
                        <button
                          onClick={() => clearMaskDrawMode()}
                          style={{
                            width: '100%',
                            height: 28,
                            background: 'rgba(249,70,8,0.08)',
                            color: '#f94608',
                            border: '1px solid #f94608',
                            borderRadius: 999,
                            cursor: 'pointer',
                            fontSize: 12,
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      /* Tool picker — icon-only buttons */
                      <div>
                        <div style={{ color: '#555555', fontSize: 11, marginBottom: 6 }}>Add mask:</div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Tooltip label="Pen mask">
                            <button
                              onClick={() => { if (selectedId) enterMaskDrawMode(selectedId, 'pen') }}
                              style={iconBtnStyle()}
                            >
                              <PenTool size={14} />
                            </button>
                          </Tooltip>
                          <Tooltip label="Rectangle mask">
                            <button
                              onClick={() => { if (selectedId) enterMaskDrawMode(selectedId, 'rect') }}
                              style={iconBtnStyle()}
                            >
                              <Square size={14} />
                            </button>
                          </Tooltip>
                          <Tooltip label="Oval mask">
                            <button
                              onClick={() => { if (selectedId) enterMaskDrawMode(selectedId, 'ellipse') }}
                              style={iconBtnStyle()}
                            >
                              <Circle size={14} />
                            </button>
                          </Tooltip>
                        </div>
                      </div>
                    )
                  ) : (
                    /* Mask controls */
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        {thumbnails[`${selectedId}__mask`] != null && (
                          <div style={{
                            width: 36, height: 36, flexShrink: 0, borderRadius: 6,
                            overflow: 'hidden', border: '1px solid #d4ccc2', background: '#f5ede2',
                          }}>
                            <img
                              src={thumbnails[`${selectedId}__mask`]}
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                              alt="mask"
                              draggable={false}
                            />
                          </div>
                        )}
                        <Tooltip label="Edit mask">
                          <button
                            onClick={() => { if (selectedId) enterMaskEditMode(selectedId) }}
                            style={{ ...iconBtnStyle(), flex: 1, width: 'auto' }}
                          >
                            <Pencil size={14} />
                          </button>
                        </Tooltip>
                        <Tooltip label={imgObj.mask.visible ? 'Hide mask' : 'Show mask'}>
                          <button
                            onClick={() => {
                              if (selectedId) commitUpdate(selectedId, { mask: { ...imgObj.mask!, visible: !imgObj.mask!.visible } })
                            }}
                            style={iconBtnStyle()}
                          >
                            {imgObj.mask.visible
                              ? <Eye size={14} />
                              : <EyeOff size={14} />}
                          </button>
                        </Tooltip>
                        <Tooltip label="Delete mask">
                          <button
                            onClick={() => {
                              if (selectedId) commitUpdate(selectedId, { mask: undefined })
                            }}
                            style={iconBtnStyle()}
                          >
                            <Trash2 size={14} />
                          </button>
                        </Tooltip>
                      </div>

                      {/* Feather */}
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                        <label style={{ color: '#555555', fontSize: 12, width: 64, flexShrink: 0 }}>Feather</label>
                        <input
                          type="range"
                          min={0}
                          max={50}
                          step={1}
                          value={imgObj.mask.feather}
                          onMouseDown={startDrag}
                          onChange={(e) => {
                            if (!selectedId) return
                            updateObject(selectedId, { mask: { ...imgObj.mask!, feather: Number(e.target.value) } })
                          }}
                          onMouseUp={(e) => {
                            if (!selectedId) return
                            commitUpdate(selectedId, { mask: { ...imgObj.mask!, feather: Number((e.target as HTMLInputElement).value) } })
                          }}
                          style={{ flex: 1 }}
                        />
                        <span style={{ color: '#111111', fontSize: 12, width: 24, textAlign: 'right' }}>
                          {imgObj.mask.feather}
                        </span>
                      </div>

                      {/* Invert */}
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                        <label style={{ color: '#555555', fontSize: 12, width: 64, flexShrink: 0 }}>Invert</label>
                        <input
                          type="checkbox"
                          checked={imgObj.mask.inverted}
                          onChange={() => {
                            if (selectedId) commitUpdate(selectedId, { mask: { ...imgObj.mask!, inverted: !imgObj.mask!.inverted } })
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>
                {!(imgObj as ImageObject).isEmpty && (
                  <>
                    <AdjustmentsSection
                      imgObj={imgObj}
                      selectedId={selectedId!}
                      bypass={adjustmentsBypass}
                      onToggleBypass={toggleAdjustmentsBypass}
                      onStartDrag={startDrag}
                      onUpdate={(adj) => updateObject(selectedId!, { adjustments: adj })}
                      onCommit={(adj) => commitUpdate(selectedId!, { adjustments: adj })}
                    />
                    <EffectsSection
                      effects={imgObj.effects}
                      onUpdate={(fx) => updateObject(selectedId!, { effects: fx })}
                      onCommit={(fx) => commitUpdate(selectedId!, { effects: fx })}
                    />
                  </>
                )}
              </div>
            )
          }

          // CONTENT EDIT MODE
          return (
            <div style={{ padding: '12px 12px 0' }}>
              {/* Orange banner — full bleed */}
              <div style={{
                marginLeft: -12,
                marginRight: -12,
                marginTop: -12,
                marginBottom: 12,
                padding: '6px 12px',
                background: '#ff7043',
                color: '#fff',
                fontSize: 12,
                fontWeight: 'bold',
              }}>
                Content Edit Mode
              </div>

              <div style={{ color: '#555555', fontSize: 9, fontWeight: 700, letterSpacing: '1.5px',
                textTransform: 'uppercase' as const, fontFamily: 'var(--font)', marginBottom: 6 }}>Content</div>
              <NumberField
                label="Offset X"
                value={imgObj.contentOffsetX}
                onChange={(val) => patch({ contentOffsetX: val })}
              />
              <NumberField
                label="Offset Y"
                value={imgObj.contentOffsetY}
                onChange={(val) => patch({ contentOffsetY: val })}
              />
              <NumberField
                label="Width"
                value={imgObj.contentWidth}
                min={1}
                onChange={(val) => patch({ contentWidth: val })}
              />
              <NumberField
                label="Height"
                value={imgObj.contentHeight}
                min={1}
                onChange={(val) => patch({ contentHeight: val })}
              />

              <Tooltip label="Reset aspect ratio">
                <button
                  onClick={() => {
                    if (!selectedId || !imgObj.naturalWidth || !imgObj.naturalHeight) return
                    const aspect = imgObj.naturalWidth / imgObj.naturalHeight
                    commitUpdate(selectedId, { contentHeight: Math.round(imgObj.contentWidth / aspect) })
                  }}
                  style={{
                    width: '100%', height: 30,
                    background: '#ffffff', color: '#555555',
                    border: '1px solid #d4ccc2', borderRadius: 999,
                    cursor: 'pointer', fontSize: 12, marginBottom: 6,
                  }}
                >
                  Reset Aspect Ratio
                </button>
              </Tooltip>

              <Tooltip label="Fit frame to content">
                <button
                  onClick={() => {
                    if (!selectedId) return
                    const theta = imgObj.rotation * (Math.PI / 180)
                    const cosTheta = Math.cos(theta)
                    const sinTheta = Math.sin(theta)
                    const newFrameX =
                      imgObj.frameX +
                      imgObj.contentOffsetX * cosTheta -
                      imgObj.contentOffsetY * sinTheta
                    const newFrameY =
                      imgObj.frameY +
                      imgObj.contentOffsetX * sinTheta +
                      imgObj.contentOffsetY * cosTheta
                    commitUpdate(selectedId, {
                      frameX: newFrameX,
                      frameY: newFrameY,
                      x: newFrameX,
                      y: newFrameY,
                      frameWidth: imgObj.contentWidth,
                      frameHeight: imgObj.contentHeight,
                      width: imgObj.contentWidth,
                      height: imgObj.contentHeight,
                      contentOffsetX: 0,
                      contentOffsetY: 0,
                    })
                  }}
                  style={{
                    width: '100%',
                    height: 30,
                    background: '#ffffff',
                    color: '#555555',
                    border: '1px solid #d4ccc2',
                    borderRadius: 999,
                    cursor: 'pointer',
                    fontSize: 12,
                    marginBottom: 6,
                  }}
                >
                  Fit frame to content
                </button>
              </Tooltip>

              <Tooltip label="Fill frame with content">
                <button
                  onClick={() => {
                    const scale = Math.max(
                      imgObj.frameWidth / imgObj.contentWidth,
                      imgObj.frameHeight / imgObj.contentHeight
                    )
                    const newW = imgObj.contentWidth * scale
                    const newH = imgObj.contentHeight * scale
                    patch({
                      contentWidth: newW,
                      contentHeight: newH,
                      contentOffsetX: (imgObj.frameWidth - newW) / 2,
                      contentOffsetY: (imgObj.frameHeight - newH) / 2,
                    })
                  }}
                  style={{
                    width: '100%',
                    height: 30,
                    background: '#ffffff',
                    color: '#555555',
                    border: '1px solid #d4ccc2',
                    borderRadius: 999,
                    cursor: 'pointer',
                    fontSize: 12,
                    marginBottom: 6,
                  }}
                >
                  Fill frame with content
                </button>
              </Tooltip>

              <div style={{ color: '#aaaaaa', fontSize: 11, marginTop: 8, marginBottom: 8 }}>
                Click outside to exit content mode
              </div>
            </div>
          )
        })()}

        {/* AI Tools section — only when an image is selected (not multi-select) */}
        {!isMultiSelect && isImage && selectedObj !== null && (
          <div
            style={{
              padding: 12,
              borderTop: '1px solid #e8e0d5',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                color: '#555555',
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                fontFamily: 'var(--font)',
                marginBottom: 8,
              }}
            >
              AI Tools
            </div>
            {activeBgOp?.status === 'running' && (
              <div style={{ background: '#f5ede2', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ color: '#555555', fontSize: 12, marginBottom: 6 }}>
                  Removing background… {activeBgOp.progress}%
                </div>
                <div style={{ background: '#e8e0d5', borderRadius: 3, height: 6, overflow: 'hidden' }}>
                  <div
                    style={{
                      background: '#f94608',
                      width: `${activeBgOp.progress}%`,
                      height: '100%',
                      transition: 'width 0.2s',
                    }}
                  />
                </div>
              </div>
            )}
            {activeBgOp?.status === 'done' && (
              <div style={{ color: '#4f4', fontSize: 13 }}>Background removed</div>
            )}
            {activeBgOp?.status === 'error' && (
              <div style={{ color: '#f44', fontSize: 12 }}>{activeBgOp.error}</div>
            )}
            {(!activeBgOp || activeBgOp.status === 'idle') && (
              <Tooltip label="Remove background" description="AI-powered, runs on device">
                <button
                  onClick={handleRemoveBg}
                  style={{
                    width: '100%',
                    height: 32,
                    background: '#f94608',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 999,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 'bold',
                  }}
                >
                  Remove BG
                </button>
              </Tooltip>
            )}
          </div>
        )}

        {/* External Editor section — images only */}
        {!isMultiSelect && isImage && selectedId !== null && (
          <div
            style={{
              padding: 12,
              borderTop: '1px solid #e8e0d5',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                color: '#555555',
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                fontFamily: 'var(--font)',
                marginBottom: 8,
              }}
            >
              External Editor
            </div>
            <div style={{ color: '#aaaaaa', fontSize: 11, marginBottom: 6 }}>
              {externalEditor ? `Default: ${externalEditor.name}` : 'No default editor set'}
            </div>
            {activeObjectId === selectedId ? (
              <>
                <div style={{ color: '#2d6a4f', fontSize: 12, marginBottom: 6 }}>
                  Watching for changes…
                </div>
                <Tooltip label="Stop watching">
                  <button
                    onClick={() => { void stopEditing(selectedId) }}
                    style={{
                      width: '100%',
                      height: 28,
                      background: '#ffffff',
                      color: '#555555',
                      border: '1px solid #d4ccc2',
                      borderRadius: 999,
                      cursor: 'pointer',
                      fontSize: 12,
                    }}
                  >
                    Stop Watching
                  </button>
                </Tooltip>
              </>
            ) : (
              <div style={{ display: 'flex', gap: 6 }}>
                <Tooltip label="Edit externally">
                  <button
                    onClick={() => { void editExternally(selectedId, effectiveFilePath) }}
                    style={{
                      flex: 1,
                      height: 32,
                      background: '#f94608',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 999,
                      cursor: 'pointer',
                      fontSize: 13,
                    }}
                  >
                    {externalEditor != null ? `Edit in ${externalEditor.name}` : 'Edit Externally'}
                  </button>
                </Tooltip>
                {externalEditor != null && (
                  <Tooltip label="Change editor">
                    <button
                      onClick={() => { void pickNewEditor() }}
                      style={{
                        height: 32,
                        padding: '0 10px',
                        background: '#ffffff',
                        color: '#555555',
                        border: '1px solid #d4ccc2',
                        borderRadius: 999,
                        cursor: 'pointer',
                        fontSize: 11,
                      }}
                    >
                      Change
                    </button>
                  </Tooltip>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
