import React, { useRef, useState } from 'react'
import { useCanvasStore } from '@/canvas/useCanvasStore'
import { useThumbnailStore } from '@/canvas/useThumbnailStore'
import type { CanvasObject, CanvasObjectType, GroupObject, ImageObject, VideoObject } from '@/types/canvas'
import Tooltip from './Tooltip'
import { iconBtnStyle } from './iconBtnStyle'
import { Link2, Star, Lock, LockOpen, Eye, EyeOff, Volume2, VolumeX, ChevronDown, ChevronRight } from 'lucide-react'

function typeLabel(type: CanvasObjectType): string {
  switch (type) {
    case 'image': return 'Image'
    case 'text': return 'Text'
    case 'shape': return 'Shape'
    case 'group': return 'Group'
    case 'path': return 'Path'
    case 'video': return 'Video'
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
  const enterMaskEditMode = useCanvasStore((s) => s.enterMaskEditMode)

  const thumbnails = useThumbnailStore((s) => s.thumbnails)

  const dragId = useRef<string | null>(null)
  const [dropPos, setDropPos] = useState<{ id: string; side: 'before' | 'after' } | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // Reversed: top layer (last in objectOrder) appears first in list
  const reversedOrder = [...objectOrder].reverse()

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
    return `${typeLabel(obj.type)} ${originalIndex + 1}`
  }

  return (
    <div
      style={{
        width: 240,
        flexShrink: 0,
        height: '100%',
        background: 'var(--bg-panel)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
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
          flexShrink: 0,
        }}
      >
        Layers
      </div>

      {/* Scrollable list */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
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
              draggable={true}
              onClick={(e) => handleRowClick(e, id)}
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
                background: isSelected ? '#ffffff' : 'transparent',
                border: isSelected ? '1px solid #e8e0d5' : '1px solid transparent',
                borderRadius: 12,
                cursor: 'pointer',
                userSelect: 'none',
                gap: 6,
                outline: isAnchor ? '2px solid #f5a623' : 'none',
                borderTop: isDropBefore ? '2px solid #f94608' : undefined,
                borderBottom: isDropAfter ? '2px solid #f94608' : undefined,
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
                    color: '#aaaaaa',
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: 9,
                  }}
                >
                  {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                </button>
              )}
              {/* Thumbnail(s) — dual if image has a mask */}
              {obj.type === 'image' && (obj as ImageObject).mask != null ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                  {/* Image thumbnail */}
                  <div
                    onClick={(e) => { e.stopPropagation(); setSelected(id) }}
                    style={{
                      width: 24, height: 24, borderRadius: 3, overflow: 'hidden',
                      background: '#f5ede2', border: '1px solid #e8e0d5', cursor: 'pointer', flexShrink: 0,
                    }}
                  >
                    {thumbnails[id] != null ? (
                      <img src={thumbnails[id]} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} alt="" draggable={false} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: '#e8e0d5' }} />
                    )}
                  </div>
                  <span style={{ color: '#aaaaaa', fontSize: 10, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                    <Link2 size={11} strokeWidth={1.5}/>
                  </span>
                  {/* Mask thumbnail */}
                  <div
                    onClick={(e) => { e.stopPropagation(); enterMaskEditMode(id) }}
                    title="Click to edit mask"
                    style={{
                      width: 24, height: 24, borderRadius: 3, overflow: 'hidden',
                      background: '#f5ede2', border: '1px solid #e8e0d5', cursor: 'pointer', flexShrink: 0,
                    }}
                  >
                    {thumbnails[`${id}__mask`] != null ? (
                      <img src={thumbnails[`${id}__mask`]} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} alt="mask" draggable={false} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: '#e8e0d5' }} />
                    )}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    width: 26, height: 26, flexShrink: 0, borderRadius: 4,
                    overflow: 'hidden', background: '#f5ede2', border: '1px solid #e8e0d5',
                  }}
                >
                  {thumbnails[id] != null ? (
                    <img src={thumbnails[id]} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} alt="" draggable={false} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', background: '#e8e0d5' }} />
                  )}
                </div>
              )}

              {/* Name */}
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
                      color: isAnchor ? '#f5a623' : '#aaaaaa',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <Star size={13} strokeWidth={1.5} fill={isAnchor ? 'gold' : 'none'} color={isAnchor ? 'gold' : '#aaaaaa'}/>
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
                      color: (obj as VideoObject).muted ? '#f94608' : '#aaaaaa',
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
                    color: obj.locked ? '#f94608' : '#aaaaaa',
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
                    color: obj.visible ? '#f94608' : '#aaaaaa',
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
                    background: childIsSelected ? '#ffffff' : 'transparent',
                    border: childIsSelected ? '1px solid #e8e0d5' : '1px solid transparent',
                    borderRadius: 12,
                    cursor: 'pointer',
                    userSelect: 'none',
                    gap: 6,
                    outline: childIsAnchor ? '2px solid #f5a623' : 'none',
                    borderTop: childIsDropBefore ? '2px solid #f94608' : undefined,
                    borderBottom: childIsDropAfter ? '2px solid #f94608' : undefined,
                    boxSizing: 'border-box',
                    marginBottom: 2,
                  }}
                >
                  {/* Thumbnail */}
                  <div
                    style={{
                      width: 26, height: 26, flexShrink: 0, borderRadius: 4,
                      overflow: 'hidden', background: '#f5ede2', border: '1px solid #e8e0d5',
                    }}
                  >
                    {thumbnails[childId] != null ? (
                      <img src={thumbnails[childId]} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} alt="" draggable={false} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: '#e8e0d5' }} />
                    )}
                  </div>

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
                          color: childIsAnchor ? '#f5a623' : '#aaaaaa',
                          display: 'flex', alignItems: 'center',
                        }}
                      >
                        <Star size={13} strokeWidth={1.5} fill={childIsAnchor ? 'gold' : 'none'} color={childIsAnchor ? 'gold' : '#aaaaaa'}/>
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
                        color: childObj.locked ? '#f94608' : '#aaaaaa',
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
                        color: childObj.visible ? '#f94608' : '#aaaaaa',
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
  )
}
