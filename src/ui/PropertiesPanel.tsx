import React, { useEffect, useState, useRef } from 'react'
import { useCanvasStore } from '@/canvas/useCanvasStore'
import { useAI } from '@/ai'
import { useAIStore } from '@/ai'
import { useExternalEdit } from '@/canvas/useExternalEdit'
import { useSaveStatusStore } from '@/store'
import type { BackgroundRemovalOperation } from '@/types/ai'
import type { ImageObject, TextObject, ShapeObject, PathObject, VideoObject, GroupObject, GuidelineObject, CanvasObject } from '@/types/canvas'
import { computeGridChildPatches } from '@/canvas/gridTemplates'
import Tooltip from './Tooltip'
import './adjustments.css'
import { ColorInput } from './ColorInput'

import { rotateAroundCenter, canBecomeFrame } from '@/canvas/geometry'
import { isFrameObject } from '@/canvas/frameModel'

import { Field, NumberField, sectionLabelStyle } from './properties/shared'
import { AlignDistributeSection } from './properties/AlignDistributeSection'
import { TextSection } from './properties/TextSection'
import { EffectsSection } from './properties/EffectsSection'
import { AdjustmentsSection } from './properties/AdjustmentsSection'
import { VideoSection } from './properties/VideoSection'
import { FrameSection } from './properties/FrameSection'
import { AddClipRow } from './properties/AddClipRow'
import { FillEditor } from './properties/FillEditor'
import { pickImageMedia, pickVideoMedia } from './properties/mediaPickers'
import { PROPERTIES_PANEL_WIDTH, TITLE_BAR_HEIGHT, HUD_LANE } from './panelConstants'

// Converts a rect/ellipse shape or closed path into a media frame and inserts the
// picked media. The store action does both in one set(), so this is one undo step.
async function insertMediaIntoShape(id: string, mediaKind: 'image' | 'video'): Promise<void> {
  const media = mediaKind === 'image' ? await pickImageMedia() : await pickVideoMedia()
  if (!media) return
  useCanvasStore.getState().insertMediaIntoShape(id, media)
}

const mediaFrameCtaButtonStyle: React.CSSProperties = {
  flex: 1,
  height: 28,
  background: 'var(--bg-surface)',
  color: 'var(--text-secondary)',
  border: '1px solid var(--stroke)',
  borderRadius: 999,
  cursor: 'pointer',
  fontSize: 12,
}

// ---------------------------------------------------------------------------
// CanvasSection — shown when nothing is selected
// ---------------------------------------------------------------------------

function CanvasSection(): React.ReactElement {
  return (
    <div style={{ padding: '12px 12px 0', color: 'var(--text-secondary)', fontSize: 12 }}>
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
  const alignObjects = useCanvasStore((s) => s.alignObjects)
  const anchorId = useCanvasStore((s) => s.anchorId)
  const setAnchor = useCanvasStore((s) => s.setAnchor)

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
        width: PROPERTIES_PANEL_WIDTH,
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
        // Stop short of the viewport floor: CanvasHud lives in that strip, and a
        // full-height panel buried the zoom/fit controls (#74). The panel scrolls
        // internally instead.
        style={{ maxHeight: `calc(100vh - ${TITLE_BAR_HEIGHT + HUD_LANE}px)`, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
        className="panel-scroll"
      >
      {/* Title */}
      <div
        style={{
          padding: '12px 12px 8px',
          color: 'var(--text-primary)',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          fontFamily: 'var(--font)',
          borderBottom: '1px solid var(--border)',
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
              color: 'var(--text-secondary)',
              fontSize: 13,
            }}
          >
            No properties
          </div>
        )}

        {/* Video object */}
        {!isMultiSelect && selectedObj !== null && isVideo && selectedId !== null && (
          <>
            {isFrameObject(selectedObj) ? (
              <FrameSection
                frameObj={selectedObj as VideoObject}
                selectedId={selectedId}
                onStartDrag={startDrag}
                onUpdate={updateObject}
                onCommit={commitUpdate}
              />
            ) : (
              <AddClipRow objectId={selectedId} />
            )}
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
          // An ellipse stores its own centre, so rotating it is a plain field
          // write; every other shape stores a top-left and has to be spun about
          // its centre or it swings away from the cursor.
          const writeRotation = (newRot: number, commit: boolean): void => {
            const write = commit ? commitUpdate : updateObject
            if (shapeObj.kind === 'ellipse') {
              write(shapeObj.id, { rotation: newRot })
            } else {
              write(shapeObj.id, rotateAroundCenter(
                shapeObj.x, shapeObj.y, shapeObj.width, shapeObj.height,
                shapeObj.rotation ?? 0, newRot,
              ))
            }
          }
          return (
            <div style={{ padding: '12px 12px 0' }}>
              <Field
                label="Rotation"
                unit="°"
                value={Math.round(shapeObj.rotation ?? 0)}
                min={-360} max={360}
                onStartDrag={startDrag}
                onLiveChange={(v) => writeRotation(v, false)}
                onChange={(v) => writeRotation(v, true)}
                onReset={() => writeRotation(0, true)}
              />
              <Field
                label="Opacity"
                unit="%"
                value={Math.round((shapeObj.opacity ?? 1) * 100)}
                min={0} max={100}
                onStartDrag={startDrag}
                onLiveChange={(v) => patch({ opacity: v / 100 })}
                onChange={(v) => commitUpdate(shapeObj.id, { opacity: v / 100 })}
                onReset={() => commitUpdate(shapeObj.id, { opacity: 1 })}
              />
              <div style={sectionLabelStyle}>Fill</div>
              {/* A shape always paints something, so it gets no None segment.
                  The stroke below stays a plain ColorInput — a stroke has no
                  interior for a gradient to grade across. */}
              <FillEditor
                value={shapeObj.fill}
                onStartDrag={startDrag}
                onChange={(f) => { patch({ fill: f ?? '#000000' }) }}
                onCommit={(f) => { commitUpdate(shapeObj.id, { fill: f ?? '#000000' }) }}
              />
              <div style={sectionLabelStyle}>Stroke</div>
              <ColorInput value={shapeObj.stroke || '#000000'} onChange={(color) => { commitUpdate(shapeObj.id, { stroke: color }) }} fixed />
              <NumberField
                label="Stroke W." unit="px"
                value={shapeObj.strokeWidth} min={0} step={0.5}
                onStartDrag={startDrag}
                onLiveChange={(val) => { patch({ strokeWidth: val }) }}
                onChange={(val) => { commitUpdate(shapeObj.id, { strokeWidth: val }) }}
              />
              {shapeObj.kind === 'rect' && (
                <NumberField
                  label="Corner R." unit="px"
                  value={shapeObj.cornerRadius ?? 0} min={0}
                  onStartDrag={startDrag}
                  onLiveChange={(val) => { patch({ cornerRadius: val }) }}
                  onChange={(val) => { commitUpdate(shapeObj.id, { cornerRadius: val }) }}
                  onReset={() => { commitUpdate(shapeObj.id, { cornerRadius: 0 }) }}
                />
              )}
              {canBecomeFrame(shapeObj) && (
                <div style={{ marginTop: 4, marginBottom: 8, padding: 8, border: '1px dashed var(--stroke)', borderRadius: 12 }}>
                  <div style={sectionLabelStyle}>Media Frame</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Tooltip label="Convert to a media frame and insert an image">
                      <button style={mediaFrameCtaButtonStyle} onClick={() => { void insertMediaIntoShape(shapeObj.id, 'image') }}>
                        + Image
                      </button>
                    </Tooltip>
                    <Tooltip label="Convert to a media frame and insert a video">
                      <button style={mediaFrameCtaButtonStyle} onClick={() => { void insertMediaIntoShape(shapeObj.id, 'video') }}>
                        + Video
                      </button>
                    </Tooltip>
                  </div>
                </div>
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
                  border: '1px solid var(--accent)',
                  borderRadius: 8,
                  padding: '6px 8px',
                  marginBottom: 8,
                  color: 'var(--accent)',
                  fontSize: 11,
                }}>
                  Path edit mode — drag anchors and handles
                </div>
              )}
              <Field
                label="Opacity"
                unit="%"
                value={Math.round((pathObj.opacity ?? 1) * 100)}
                min={0} max={100}
                onStartDrag={startDrag}
                onLiveChange={(v) => patch({ opacity: v / 100 })}
                onChange={(v) => commitUpdate(pathObj.id, { opacity: v / 100 })}
                onReset={() => commitUpdate(pathObj.id, { opacity: 1 })}
              />
              <div style={sectionLabelStyle}>Fill</div>
              <FillEditor
                value={pathObj.fill}
                onStartDrag={startDrag}
                onChange={(f) => { patch({ fill: f ?? '#000000' }) }}
                onCommit={(f) => { commitUpdate(pathObj.id, { fill: f ?? '#000000' }) }}
              />
              <div style={sectionLabelStyle}>Stroke</div>
              <ColorInput
                value={pathObj.stroke || '#000000'}
                onChange={(color) => { commitUpdate(pathObj.id, { stroke: color }) }}
                fixed
              />
              <NumberField
                label="Stroke W."
                unit="px"
                value={pathObj.strokeWidth}
                min={0}
                step={0.5}
                onStartDrag={startDrag}
                onLiveChange={(val) => { patch({ strokeWidth: val }) }}
                onChange={(val) => { commitUpdate(pathObj.id, { strokeWidth: val }) }}
              />
              {canBecomeFrame(pathObj) && (
                <div style={{ marginTop: 4, marginBottom: 8, padding: 8, border: '1px dashed var(--stroke)', borderRadius: 12 }}>
                  <div style={sectionLabelStyle}>Media Frame</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Tooltip label="Convert to a media frame and insert an image">
                      <button style={mediaFrameCtaButtonStyle} onClick={() => { void insertMediaIntoShape(pathObj.id, 'image') }}>
                        + Image
                      </button>
                    </Tooltip>
                    <Tooltip label="Convert to a media frame and insert a video">
                      <button style={mediaFrameCtaButtonStyle} onClick={() => { void insertMediaIntoShape(pathObj.id, 'video') }}>
                        + Video
                      </button>
                    </Tooltip>
                  </div>
                </div>
              )}
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
          const relayout = (newGap: number): void => {
            updateObject(group.id, { gridGap: newGap })
            // Same relayout CanvasGroupNode uses. refitContent: true — a gap
            // change resizes every cell, so the media has to re-cover-fit or
            // it keeps the old size inside the new box (#69).
            const patches = computeGridChildPatches(
              { ...group, gridGap: newGap },
              useCanvasStore.getState().objects,
              { x: group.x, y: group.y, width: group.width, height: group.height },
              true,
            )
            for (const [childId, childPatch] of Object.entries(patches)) {
              updateObject(childId, childPatch as Partial<CanvasObject>)
            }
          }
          return (
            <div style={{ padding: '0 16px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Grid
              </div>
              <Field
                label="Gap"
                unit="px"
                value={group.gridGap ?? 8}
                min={0} max={40}
                labelWidth={32}
                marginBottom={0}
                onStartDrag={startDrag}
                onLiveChange={relayout}
                // relayout() writes every cell; commitUpdate then closes the one
                // history entry using the snapshot Field armed on the first live
                // write. A bare `commitUpdate(group.id, {gridGap})` would miss the
                // cells, which is why the relayout runs here too.
                onChange={(v) => { relayout(v); commitUpdate(group.id, {}) }}
              />
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
                unit="px"
                value={Math.round(g.position)}
                step={1}
                onStartDrag={startDrag}
                onLiveChange={(val) => updateObject(g.id, { position: val })}
                onChange={(val) => commitUpdate(g.id, { position: val })}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <label style={{ color: 'var(--text-secondary)', fontSize: 12, width: 64, flexShrink: 0 }}>Orientation</label>
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
                        borderColor: g.orientation === o ? 'var(--accent)' : 'var(--stroke)',
                        background: g.orientation === o ? 'var(--accent)' : 'var(--bg-surface)',
                        color: g.orientation === o ? 'var(--bg-surface)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      {o === 'horizontal' ? 'H' : 'V'}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <label style={{ color: 'var(--text-secondary)', fontSize: 12, width: 64, flexShrink: 0 }}>All frames</label>
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

          // A media frame rotates about the FRAME box, not the object box — the
          // content floats inside it, so spinning around x/y would swing the crop.
          const writeImgRotation = (newRot: number, commit: boolean): void => {
            const { x: fx, y: fy, rotation } = rotateAroundCenter(
              imgObj.frameX, imgObj.frameY, imgObj.frameWidth, imgObj.frameHeight,
              imgObj.rotation ?? 0, newRot,
            )
            const write = commit ? commitUpdate : updateObject
            write(imgObj.id, { rotation, frameX: fx, frameY: fy, x: fx, y: fy })
          }

          if (!isContentMode) {
            // FRAME MODE
            return (
              <div style={{ padding: '12px 12px 0' }}>
                <Field
                  label="Rotation"
                  unit="°"
                  value={Math.round(imgObj.rotation ?? 0)}
                  min={-360} max={360}
                  onStartDrag={startDrag}
                  onLiveChange={(v) => writeImgRotation(v, false)}
                  onChange={(v) => writeImgRotation(v, true)}
                  onReset={() => writeImgRotation(0, true)}
                />
                <Field
                  label="Opacity"
                  unit="%"
                  value={Math.round((imgObj.opacity ?? 1) * 100)}
                  min={0} max={100}
                  onStartDrag={startDrag}
                  onLiveChange={(v) => patch({ opacity: v / 100 })}
                  onChange={(v) => commitUpdate(imgObj.id, { opacity: v / 100 })}
                  onReset={() => commitUpdate(imgObj.id, { opacity: 1 })}
                />
                {isFrameObject(imgObj) ? (
                  <FrameSection
                    frameObj={imgObj}
                    selectedId={selectedId!}
                    onStartDrag={startDrag}
                    onUpdate={updateObject}
                    onCommit={commitUpdate}
                  />
                ) : (
                  // isFrameObject is a type predicate, so it narrows imgObj to
                  // never here — take the id from selection instead.
                  <AddClipRow objectId={selectedId!} />
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
                <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginTop: 8, marginBottom: 8 }}>
                  Double-click image to edit content
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
                background: 'var(--accent)',
                color: '#fff',
                fontSize: 12,
                fontWeight: 'bold',
              }}>
                Content Edit Mode
              </div>

              <div style={{ color: 'var(--text-secondary)', fontSize: 9, fontWeight: 700, letterSpacing: '1.5px',
                textTransform: 'uppercase' as const, fontFamily: 'var(--font)', marginBottom: 6 }}>Content</div>
              <NumberField
                label="Offset X" unit="px"
                value={imgObj.contentOffsetX}
                onStartDrag={startDrag}
                onLiveChange={(val) => patch({ contentOffsetX: val })}
                onChange={(val) => commitUpdate(imgObj.id, { contentOffsetX: val })}
              />
              <NumberField
                label="Offset Y" unit="px"
                value={imgObj.contentOffsetY}
                onStartDrag={startDrag}
                onLiveChange={(val) => patch({ contentOffsetY: val })}
                onChange={(val) => commitUpdate(imgObj.id, { contentOffsetY: val })}
              />
              <NumberField
                label="Width" unit="px"
                value={imgObj.contentWidth}
                min={1}
                onStartDrag={startDrag}
                onLiveChange={(val) => patch({ contentWidth: val })}
                onChange={(val) => commitUpdate(imgObj.id, { contentWidth: val })}
              />
              <NumberField
                label="Height" unit="px"
                value={imgObj.contentHeight}
                min={1}
                onStartDrag={startDrag}
                onLiveChange={(val) => patch({ contentHeight: val })}
                onChange={(val) => commitUpdate(imgObj.id, { contentHeight: val })}
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
                    background: 'var(--bg-surface)', color: 'var(--text-secondary)',
                    border: '1px solid var(--stroke)', borderRadius: 999,
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
                    background: 'var(--bg-surface)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--stroke)',
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
                    background: 'var(--bg-surface)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--stroke)',
                    borderRadius: 999,
                    cursor: 'pointer',
                    fontSize: 12,
                    marginBottom: 6,
                  }}
                >
                  Fill frame with content
                </button>
              </Tooltip>

              <div style={{ color: 'var(--text-tertiary)', fontSize: 11, marginTop: 8, marginBottom: 8 }}>
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
              borderTop: '1px solid var(--border)',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                color: 'var(--text-secondary)',
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
              <div style={{ background: 'var(--bg-panel)', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 6 }}>
                  Removing background… {activeBgOp.progress}%
                </div>
                <div style={{ background: 'var(--border)', borderRadius: 3, height: 6, overflow: 'hidden' }}>
                  <div
                    style={{
                      background: 'var(--accent)',
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
                    background: 'var(--accent)',
                    color: 'var(--bg-surface)',
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
              borderTop: '1px solid var(--border)',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                color: 'var(--text-secondary)',
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
            <div style={{ color: 'var(--text-tertiary)', fontSize: 11, marginBottom: 6 }}>
              {externalEditor ? `Default: ${externalEditor.name}` : 'No default editor set'}
            </div>
            {activeObjectId === selectedId ? (
              <>
                <div style={{ color: 'var(--success)', fontSize: 12, marginBottom: 6 }}>
                  Watching for changes…
                </div>
                <Tooltip label="Stop watching">
                  <button
                    onClick={() => { void stopEditing(selectedId) }}
                    style={{
                      width: '100%',
                      height: 28,
                      background: 'var(--bg-surface)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--stroke)',
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
                      background: 'var(--accent)',
                      color: 'var(--bg-surface)',
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
                        background: 'var(--bg-surface)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--stroke)',
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
