import React, { useRef, useState, useEffect } from 'react'
import { useCanvasStore } from '@/canvas/useCanvasStore'
import { useThumbnailStore } from '@/canvas/useThumbnailStore'
import { solidColorOf } from '@/canvas/frameClip'
import { isEmptyFrame } from '@/canvas/frameModel'
import type { CanvasObject, CanvasObjectType, GroupObject, GuidelineObject, VideoObject, ImageObject } from '@/types/canvas'
import Tooltip from './Tooltip'
import { iconBtnStyle } from './iconBtnStyle'
import { Star, Lock, LockOpen, Eye, EyeOff, Volume2, VolumeX, ChevronDown, ChevronRight, Layers } from 'lucide-react'

// Fill-color swatch + shape glyph for empty media frames — a broken <img>
// thumbnail would otherwise render since isEmpty frames have no src.
function EmptyFrameThumb({ obj }: { obj: ImageObject }): React.ReactElement {
  const fillColor = solidColorOf(obj.fill) ?? 'var(--bg-panel)'
  const kind = obj.clipShape?.kind ?? 'rect'
  return (
    <div
      style={{
        width: 26, height: 26, flexShrink: 0, borderRadius: 4,
        overflow: 'hidden', background: fillColor, border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        {kind === 'ellipse' ? (
          <ellipse cx="7" cy="7" rx="5.5" ry="4" stroke="var(--text-muted)" strokeWidth="1.2" />
        ) : kind === 'path' ? (
          <path d="M2 10 L5 3 L9 7 L12 2" stroke="var(--text-muted)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <rect x="2" y="2" width="10" height="10" rx="1.5" stroke="var(--text-muted)" strokeWidth="1.2" />
        )}
      </svg>
    </div>
  )
}

function typeLabel(type: CanvasObjectType): string {
  switch (type) {
    case 'image': return 'Image'
    case 'text': return 'Text'
    case 'shape': return 'Shape'
    case 'group': return 'Group'
    case 'path': return 'Path'
    case 'video': return 'Video'
    case 'guideline': return 'Guideline'
  }
}

export function LayerPanel(): React.ReactElement {
  const objects = useCanvasStore((s) => s.objects)
  const objectOrder = useCanvasStore((s) => s.objectOrder)
  const selectedId = useCanvasStore((s) => s.selectedId)
  const selectedIds = useCanvasStore((s) => s.selectedIds)
  const anchorId = useCanvasStore((s) => s.anchorId)
  const setSelected = useCanvasStore((s) => s.setSelected)
  const addToSelection = useCanvasStore((s) => s.addToSelection)
  const setAnchor = useCanvasStore((s) => s.setAnchor)
  const updateObject = useCanvasStore((s) => s.updateObject)
  const commitUpdate = useCanvasStore((s) => s.commitUpdate)
  const reorderObjects = useCanvasStore((s) => s.reorderObjects)
  const toggleLock = useCanvasStore((s) => s.toggleLock)

  const thumbnails = useThumbnailStore((s) => s.thumbnails)

  const dragId = useRef<string | null>(null)
  const [dropPos, setDropPos] = useState<{ id: string; side: 'before' | 'after' } | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')

  const [panelHeight, setPanelHeight] = useState<number | 'auto'>('auto')
  const innerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!innerRef.current) return
    const ro = new ResizeObserver(([entry]) => setPanelHeight(entry.contentRect.height))
    ro.observe(innerRef.current)
    return () => ro.disconnect()
  }, [])

  // Reversed: top layer (last in objectOrder) appears first in list.
  // Guidelines are managed via the toolbar eye toggle, not shown here.
  const reversedOrder = [...objectOrder].reverse().filter((id) => objects[id]?.type !== 'guideline')

  function handleRowClick(e: React.MouseEvent<HTMLDivElement>, id: string): void {
    if (e.shiftKey) {
      e.stopPropagation()
      addToSelection(id)
    } else {
      setSelected(id)
    }
  }

  function handleEyeClick(e: React.MouseEvent<HTMLButtonElement>, obj: CanvasObject): void {
    e.stopPropagation()
    updateObject(obj.id, { visible: !obj.visible })
  }

  function handleLockClick(e: React.MouseEvent<HTMLButtonElement>, id: string): void {
    e.stopPropagation()
    toggleLock(id)
  }

  function handleMuteClick(e: React.MouseEvent<HTMLButtonElement>, obj: VideoObject): void {
    e.stopPropagation()
    commitUpdate(obj.id, { muted: !obj.muted })
  }

  function getDisplayName(id: string, originalIndex: number): string {
    const obj = objects[id]
    if (!obj) return 'Unknown'
    if (obj.name) return obj.name
    if (obj.type === 'guideline') {
      const g = obj as GuidelineObject
      const orient = g.orientation === 'horizontal' ? 'Horizontal' : 'Vertical'
      return `${orient} Guideline ${originalIndex + 1}`
    }
    if (isEmptyFrame(obj)) return `Frame ${originalIndex + 1}`
    return `${typeLabel(obj.type)} ${originalIndex + 1}`
  }

  function beginRename(id: string, originalIndex: number): void {
    setRenamingId(id)
    setRenameDraft(objects[id]?.name ?? getDisplayName(id, originalIndex))
  }

  function commitRename(id: string): void {
    const trimmed = renameDraft.trim()
    // Empty input clears the custom name → falls back to "Type N".
    commitUpdate(id, { name: trimmed === '' ? undefined : trimmed })
    setRenamingId(null)
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        zIndex: 20,
        width: 240,
        boxSizing: 'border-box',
        background: 'var(--bg-panel)',
        borderRight: '1px solid var(--border)',
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
            color: 'var(--text-primary)',
            fontSize: 13,
            fontWeight: 700,
            fontFamily: 'var(--font)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            borderBottom: '1px solid var(--border)',
            position: 'sticky',
            top: 0,
            background: 'var(--bg-panel)',
            zIndex: 1,
          }}
        >
          Layers
          {selectedIds.length > 1 && (
            <span
              style={{
                marginLeft: 8,
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: 0,
                textTransform: 'none',
                color: 'var(--bg-surface)',
                background: 'var(--accent)',
                borderRadius: 999,
                padding: '2px 8px',
                verticalAlign: 'middle',
              }}
            >
              {selectedIds.length} selected
            </span>
          )}
        </div>

        {/* Scrollable list */}
        <div
          style={{
            flex: 1,
            padding: '4px 6px',
          }}
        >
          {reversedOrder.length === 0 && (
            <div
              style={{
                padding: '16px 6px',
                color: 'var(--text-muted)',
                fontSize: 12,
              }}
            >
              No layers yet
            </div>
          )}
          {(() => {
            // Build set of all group child IDs to exclude from top-level rendering
            const groupChildIds = new Set<string>()
            reversedOrder.forEach(id => {
              const o = objects[id]
              if (o?.type === 'group') {
                (o as GroupObject).childIds.forEach(cid => groupChildIds.add(cid))
              }
            })

            return reversedOrder.filter(id => !groupChildIds.has(id)).flatMap((id) => {
            const obj = objects[id]
            if (!obj) return []
            const originalIndex = objectOrder.indexOf(id)
            const isSelected = selectedIds.includes(id) || selectedId === id
            const isAnchor = anchorId === id
            const isDropBefore = dropPos?.id === id && dropPos.side === 'before'
            const isDropAfter = dropPos?.id === id && dropPos.side === 'after'
            const canBeAnchor = selectedIds.length > 1 && selectedIds.includes(id)
            const isVideo = obj.type === 'video'
            const isGroupObj = obj.type === 'group'
            const isExpanded = expandedGroups.has(id)

            const mainRow = (
              <div
                key={id}
                draggable={renamingId !== id}
                onClick={(e) => handleRowClick(e, id)}
                onDoubleClick={() => beginRename(id, originalIndex)}
                onDragStart={(e) => {
                  dragId.current = id
                  e.dataTransfer.setData('text/plain', id)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  const rect = e.currentTarget.getBoundingClientRect()
                  const side = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
                  setDropPos({ id, side })
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropPos(null)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const fromId = dragId.current ?? e.dataTransfer.getData('text/plain')
                  const side = dropPos?.id === id ? dropPos.side : 'before'
                  if (fromId && fromId !== id) reorderObjects(fromId, id, side)
                  dragId.current = null
                  setDropPos(null)
                }}
                onDragEnd={() => { dragId.current = null; setDropPos(null) }}
                style={{
                  height: 36,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 8px',
                  background: isSelected ? 'var(--bg-surface)' : 'transparent',
                  border: isSelected
                    ? (selectedIds.length > 1 && selectedIds.includes(id) ? '1px solid #f7b9a3' : '1px solid var(--border)')
                    : '1px solid transparent',
                  borderRadius: 12,
                  cursor: 'pointer',
                  userSelect: 'none',
                  gap: 6,
                  outline: isAnchor ? '2px solid var(--accent-gold)' : 'none',
                  borderTop: isDropBefore ? '2px solid var(--accent)' : undefined,
                  borderBottom: isDropAfter ? '2px solid var(--accent)' : undefined,
                  boxSizing: 'border-box',
                  marginBottom: 2,
                }}
              >
                {/* Collapse toggle for groups */}
                {isGroupObj && (
                  <button
                    draggable={false}
                    onClick={(e) => {
                      e.stopPropagation()
                      setExpandedGroups(prev => {
                        const next = new Set(prev)
                        if (next.has(id)) { next.delete(id) } else { next.add(id) }
                        return next
                      })
                    }}
                    style={{
                      flexShrink: 0,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '0 2px',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: 9,
                    }}
                  >
                    {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                  </button>
                )}
                {/* Thumbnail */}
                {isGroupObj ? (
                  <div
                    style={{
                      width: 26, height: 26, flexShrink: 0, borderRadius: 4,
                      background: 'var(--bg-panel)', border: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <Layers size={14} strokeWidth={1.5} />
                  </div>
                ) : obj.type === 'guideline' ? (
                  <div
                    style={{
                      width: 26, height: 26, flexShrink: 0, borderRadius: 4,
                      background: 'var(--bg-panel)', border: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      {(obj as GuidelineObject).orientation === 'horizontal' ? (
                        <line x1="1" y1="7" x2="13" y2="7" stroke="#4A90E2" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 2"/>
                      ) : (
                        <line x1="7" y1="1" x2="7" y2="13" stroke="#4A90E2" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 2"/>
                      )}
                    </svg>
                  </div>
                ) : isEmptyFrame(obj) ? (
                  <EmptyFrameThumb obj={obj} />
                ) : (
                  <div
                    style={{
                      width: 26, height: 26, flexShrink: 0, borderRadius: 4,
                      overflow: 'hidden', background: 'var(--bg-panel)', border: '1px solid var(--border)',
                    }}
                  >
                    {thumbnails[id] != null ? (
                      <img src={thumbnails[id]} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} alt="" draggable={false} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: 'var(--border)' }} />
                    )}
                  </div>
                )}

                {/* Name — double-click row to rename */}
                {renamingId === id ? (
                  <input
                    autoFocus
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={() => commitRename(id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); commitRename(id) }
                      if (e.key === 'Escape') { e.preventDefault(); setRenamingId(null) }
                    }}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      height: 22,
                      fontSize: 13,
                      fontFamily: 'var(--font)',
                      color: 'var(--text-primary)',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--accent)',
                      borderRadius: 6,
                      padding: '0 5px',
                      outline: 'none',
                    }}
                  />
                ) : (
                  <span
                    style={{
                      flex: 1,
                      color: obj.visible ? 'var(--text-primary)' : 'var(--text-muted)',
                      fontSize: 13,
                      fontFamily: 'var(--font)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      pointerEvents: 'none',
                    }}
                  >
                    {getDisplayName(id, originalIndex)}
                  </span>
                )}

                {/* Anchor button — visible only in multi-select mode */}
                {canBeAnchor && (
                  <Tooltip label="Set as reference">
                    <button
                      draggable={false}
                      onClick={(e) => {
                        e.stopPropagation()
                        setAnchor(isAnchor ? null : id)
                      }}
                      style={{
                        flexShrink: 0,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '0 2px',
                        fontSize: 12,
                        lineHeight: '1',
                        color: isAnchor ? 'var(--accent-gold)' : 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <Star size={13} strokeWidth={1.5} fill={isAnchor ? 'gold' : 'none'} color={isAnchor ? 'gold' : 'var(--text-muted)'}/>
                    </button>
                  </Tooltip>
                )}

                {/* Mute toggle — video rows only */}
                {isVideo && (
                  <Tooltip label={(obj as VideoObject).muted ? 'Unmute' : 'Mute'}>
                    <button
                      draggable={false}
                      onClick={(e) => handleMuteClick(e, obj as VideoObject)}
                      style={{
                        ...iconBtnStyle(false),
                        width: 22,
                        height: 22,
                        flexShrink: 0,
                        background: 'none',
                        border: 'none',
                        color: (obj as VideoObject).muted ? 'var(--accent)' : 'var(--text-muted)',
                      }}
                    >
                      {(obj as VideoObject).muted
                        ? <VolumeX size={12} strokeWidth={1.5}/>
                        : <Volume2 size={12} strokeWidth={1.5}/>}
                    </button>
                  </Tooltip>
                )}

                {/* Lock toggle */}
                <Tooltip label={obj.locked ? 'Unlock' : 'Lock'}>
                  <button
                    draggable={false}
                    onClick={(e) => handleLockClick(e, id)}
                    style={{
                      flexShrink: 0,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '0 2px',
                      fontSize: 13,
                      lineHeight: '1',
                      color: obj.locked ? 'var(--accent)' : 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {obj.locked ? <Lock size={13} strokeWidth={1.5}/> : <LockOpen size={13} strokeWidth={1.5}/>}
                  </button>
                </Tooltip>

                {/* Eye toggle */}
                <Tooltip label={obj.visible ? 'Hide layer' : 'Show layer'}>
                  <button
                    draggable={false}
                    onClick={(e) => handleEyeClick(e, obj)}
                    style={{
                      flexShrink: 0,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '0 2px',
                      fontSize: 14,
                      lineHeight: '1',
                      color: obj.visible ? 'var(--accent)' : 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {obj.visible ? <Eye size={13} strokeWidth={1.5}/> : <EyeOff size={13} strokeWidth={1.5}/>}
                  </button>
                </Tooltip>
              </div>
            )

            // Render child rows for expanded groups
            if (isGroupObj && isExpanded) {
              const groupObj = obj as GroupObject
              const childRows = groupObj.childIds.map((childId) => {
                const childObj = objects[childId]
                if (!childObj) return null
                const childOriginalIndex = objectOrder.indexOf(childId)
                const childIsSelected = selectedIds.includes(childId) || selectedId === childId
                const childIsAnchor = anchorId === childId
                const childIsDropBefore = dropPos?.id === childId && dropPos.side === 'before'
                const childIsDropAfter = dropPos?.id === childId && dropPos.side === 'after'
                const childCanBeAnchor = selectedIds.length > 1 && selectedIds.includes(childId)
                return (
                  <div
                    key={childId}
                    onClick={(e) => handleRowClick(e, childId)}
                    style={{
                      height: 36,
                      display: 'flex',
                      alignItems: 'center',
                      paddingLeft: 24,
                      paddingRight: 8,
                      background: childIsSelected ? 'var(--bg-surface)' : 'transparent',
                      border: childIsSelected ? '1px solid var(--border)' : '1px solid transparent',
                      borderRadius: 12,
                      cursor: 'pointer',
                      userSelect: 'none',
                      gap: 6,
                      outline: childIsAnchor ? '2px solid var(--accent-gold)' : 'none',
                      borderTop: childIsDropBefore ? '2px solid var(--accent)' : undefined,
                      borderBottom: childIsDropAfter ? '2px solid var(--accent)' : undefined,
                      boxSizing: 'border-box',
                      marginBottom: 2,
                    }}
                  >
                    {/* Thumbnail */}
                    {isEmptyFrame(childObj) ? (
                      <EmptyFrameThumb obj={childObj} />
                    ) : (
                      <div
                        style={{
                          width: 26, height: 26, flexShrink: 0, borderRadius: 4,
                          overflow: 'hidden', background: 'var(--bg-panel)', border: '1px solid var(--border)',
                        }}
                      >
                        {thumbnails[childId] != null ? (
                          <img src={thumbnails[childId]} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} alt="" draggable={false} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', background: 'var(--border)' }} />
                        )}
                      </div>
                    )}

                    {/* Name */}
                    <span
                      style={{
                        flex: 1,
                        color: childObj.visible ? 'var(--text-primary)' : 'var(--text-muted)',
                        fontSize: 12,
                        fontFamily: 'var(--font)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none',
                      }}
                    >
                      {getDisplayName(childId, childOriginalIndex)}
                    </span>

                    {/* Anchor button */}
                    {childCanBeAnchor && (
                      <Tooltip label="Set as reference">
                        <button
                          draggable={false}
                          onClick={(e) => {
                            e.stopPropagation()
                            setAnchor(childIsAnchor ? null : childId)
                          }}
                          style={{
                            flexShrink: 0, background: 'none', border: 'none',
                            cursor: 'pointer', padding: '0 2px', lineHeight: '1',
                            color: childIsAnchor ? 'var(--accent-gold)' : 'var(--text-muted)',
                            display: 'flex', alignItems: 'center',
                          }}
                        >
                          <Star size={13} strokeWidth={1.5} fill={childIsAnchor ? 'gold' : 'none'} color={childIsAnchor ? 'gold' : 'var(--text-muted)'}/>
                        </button>
                      </Tooltip>
                    )}

                    {/* Lock toggle */}
                    <Tooltip label={childObj.locked ? 'Unlock' : 'Lock'}>
                      <button
                        draggable={false}
                        onClick={(e) => { e.stopPropagation(); toggleLock(childId) }}
                        style={{
                          flexShrink: 0, background: 'none', border: 'none',
                          cursor: 'pointer', padding: '0 2px', lineHeight: '1',
                          color: childObj.locked ? 'var(--accent)' : 'var(--text-muted)',
                          display: 'flex', alignItems: 'center',
                        }}
                      >
                        {childObj.locked ? <Lock size={13} strokeWidth={1.5}/> : <LockOpen size={13} strokeWidth={1.5}/>}
                      </button>
                    </Tooltip>

                    {/* Eye toggle */}
                    <Tooltip label={childObj.visible ? 'Hide layer' : 'Show layer'}>
                      <button
                        draggable={false}
                        onClick={(e) => { e.stopPropagation(); updateObject(childId, { visible: !childObj.visible }) }}
                        style={{
                          flexShrink: 0, background: 'none', border: 'none',
                          cursor: 'pointer', padding: '0 2px', lineHeight: '1',
                          color: childObj.visible ? 'var(--accent)' : 'var(--text-muted)',
                          display: 'flex', alignItems: 'center',
                        }}
                      >
                        {childObj.visible ? <Eye size={13} strokeWidth={1.5}/> : <EyeOff size={13} strokeWidth={1.5}/>}
                      </button>
                    </Tooltip>
                  </div>
                )
              }).filter(Boolean)
              return [mainRow, ...childRows]
            }

            return [mainRow]
          })
          })()}
        </div>
      </div>
    </div>
  )
}
