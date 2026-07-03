import React, { useEffect, useState, useRef } from 'react'
import { useCanvasStore } from '@/canvas/useCanvasStore'
import { useThumbnailStore } from '@/canvas/useThumbnailStore'
import type { VideoObject } from '@/types/canvas'
import Tooltip from '../Tooltip'
import { iconBtnStyle } from '../iconBtnStyle'
import { PenTool, Square, Circle, Trash2, Pencil, Eye, EyeOff, Volume2, VolumeX, Play, Pause, Repeat } from 'lucide-react'
import { videoElementRegistry } from '@/canvas/videoElementRegistry'
import { NumericInput } from '../NumericInput'

import { rotateAroundCenter } from '@/canvas/geometry'
import { AdjustmentsSection } from './AdjustmentsSection'
import { EffectsSection } from './EffectsSection'
import { sectionLabelStyle } from './shared'


// ---------------------------------------------------------------------------
// VideoSection — properties for video objects
// ---------------------------------------------------------------------------

interface VideoSectionProps {
  videoObj: VideoObject
  selectedId: string
  onStartDrag: () => void
  onUpdate: (id: string, partial: Partial<VideoObject>) => void
  onCommit: (id: string, partial: Partial<VideoObject>) => void
}

function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

const trimLabelStyle: React.CSSProperties = {
  color: '#555555',
  fontSize: 11,
  width: 32,
  flexShrink: 0,
  textTransform: 'uppercase',
  fontWeight: 700,
  letterSpacing: '1px',
}

export function VideoSection({
  videoObj,
  selectedId,
  onStartDrag,
  onUpdate,
  onCommit,
}: VideoSectionProps): React.ReactElement {
  const isPlaying = useCanvasStore((s) => s.videoPlayingIds.has(videoObj.id))
  const toggleVideoPlay = useCanvasStore((s) => s.toggleVideoPlay)
  const enterMaskEditModeV = useCanvasStore((s) => s.enterMaskEditMode)
  const maskDrawModeV = useCanvasStore((s) => s.maskDrawMode)
  const enterMaskDrawModeV = useCanvasStore((s) => s.enterMaskDrawMode)
  const clearMaskDrawModeV = useCanvasStore((s) => s.clearMaskDrawMode)
  const thumbnailsV = useThumbnailStore((s) => s.thumbnails)
  const adjustmentsBypassV = useCanvasStore((s) => s.adjustmentsBypass)
  const toggleAdjustmentsBypassV = useCanvasStore((s) => s.toggleAdjustmentsBypass)

  const [currentTime, setCurrentTime] = useState(0)
  const [fileSize, setFileSize] = useState<string | null>(null)
  const isScrubbing = useRef(false)
  useEffect(() => {
    const vid = videoElementRegistry.get(videoObj.id)
    if (!vid) return
    const intervalId = setInterval(() => {
      if (!isScrubbing.current) setCurrentTime(vid.currentTime)
    }, 100)
    return () => clearInterval(intervalId)
  }, [videoObj.id, isPlaying])
  useEffect(() => {
    if (typeof window.electronAPI.getFileSize !== 'function') return
    window.electronAPI.getFileSize(videoObj.filePath).then(({ size }) => {
      if (size === 0) { setFileSize(null); return }
      if (size >= 1024 * 1024) setFileSize(`${(size / (1024 * 1024)).toFixed(1)} MB`)
      else setFileSize(`${(size / 1024).toFixed(0)} KB`)
    }).catch(() => setFileSize(null))
  }, [videoObj.filePath])

  return (
    <div style={{ padding: '12px 12px 0' }}>
      {/* Read-only info */}
      <div style={sectionLabelStyle}>Info</div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6, gap: 8 }}>
        <span style={{ color: '#555555', fontSize: 12, width: 64, flexShrink: 0 }}>Duration</span>
        <span style={{ color: '#111111', fontSize: 12 }}>{formatDuration(videoObj.naturalDuration)}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6, gap: 8 }}>
        <span style={{ color: '#555555', fontSize: 12, width: 64, flexShrink: 0 }}>Dimensions</span>
        <span style={{ color: '#111111', fontSize: 12 }}>{videoObj.naturalWidth} × {videoObj.naturalHeight}</span>
      </div>
      {fileSize != null && (
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10, gap: 8 }}>
          <span style={{ color: '#555555', fontSize: 12, width: 64, flexShrink: 0 }}>File Size</span>
          <span style={{ color: '#111111', fontSize: 12 }}>{fileSize}</span>
        </div>
      )}

      {/* Audio: mute toggle + volume slider */}
      <div style={sectionLabelStyle}>Audio</div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6, gap: 6 }}>
        <Tooltip label={videoObj.muted ? 'Unmute' : 'Mute'}>
          <button
            style={iconBtnStyle(!videoObj.muted)}
            onClick={() => onCommit(selectedId, { muted: !videoObj.muted })}
          >
            {videoObj.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
        </Tooltip>
        <input
          type="range" min={0} max={100} step={1}
          value={Math.round((videoObj.volume ?? 1) * 100)}
          disabled={videoObj.muted}
          onMouseDown={onStartDrag}
          onChange={e => onUpdate(selectedId, { volume: Number(e.target.value) / 100 })}
          onMouseUp={e => onCommit(selectedId, { volume: Number((e.target as HTMLInputElement).value) / 100 })}
          style={{ flex: 1, opacity: videoObj.muted ? 0.35 : 1, pointerEvents: videoObj.muted ? 'none' : 'auto' }}
        />
        <NumericInput
          value={Math.round((videoObj.volume ?? 1) * 100)}
          min={0} max={100}
          width={44}
          disabled={videoObj.muted}
          onCommit={v => onCommit(selectedId, { volume: v / 100 })}
          onDoubleClick={() => onCommit(selectedId, { volume: 1 })}
          style={videoObj.muted ? { opacity: 0.35 } : undefined}
        />
      </div>

      {/* Playback controls */}
      <div style={sectionLabelStyle}>Playback</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Tooltip label={isPlaying ? 'Pause' : 'Play'}>
          <button
            style={iconBtnStyle(isPlaying)}
            onClick={() => toggleVideoPlay(videoObj.id)}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          </button>
        </Tooltip>
        <Tooltip label={(videoObj.loop ?? true) ? 'Loop on' : 'Loop off'}>
          <button
            style={iconBtnStyle(videoObj.loop ?? true)}
            onClick={() => onCommit(selectedId, { loop: !(videoObj.loop ?? true) })}
          >
            <Repeat size={14} />
          </button>
        </Tooltip>
        <span style={{ color: '#555555', fontSize: 11, marginLeft: 4 }}>
          {formatDuration(currentTime)} / {formatDuration(videoObj.naturalDuration)}
        </span>
      </div>

      {/* Scrub bar */}
      <div style={{ marginBottom: 10 }}>
        <input
          type="range"
          min={videoObj.trimStart ?? 0}
          max={videoObj.trimEnd ?? videoObj.naturalDuration}
          step={0.01}
          value={currentTime}
          style={{ width: '100%' }}
          onMouseDown={() => {
            isScrubbing.current = true
            onStartDrag()
          }}
          onChange={(e) => {
            const t = Number(e.target.value)
            const vid = videoElementRegistry.get(videoObj.id)
            if (vid) vid.currentTime = t
            setCurrentTime(t)
          }}
          onMouseUp={() => {
            isScrubbing.current = false
            onCommit(selectedId, {})
          }}
        />
      </div>

      {/* Poster frame */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span style={trimLabelStyle}>Poster</span>
        <span style={{ color: '#111111', fontSize: 11, flex: 1 }}>
          {videoObj.posterFrame != null
            ? formatDuration(videoObj.posterFrame)
            : `Default (${formatDuration(videoObj.trimStart ?? 0)})`}
        </span>
        <Tooltip label="Set poster to current position">
          <button
            style={{ ...iconBtnStyle(false), fontSize: 11, padding: '2px 6px', width: 'auto' }}
            onClick={() => onCommit(selectedId, { posterFrame: currentTime })}
          >
            Set
          </button>
        </Tooltip>
        {videoObj.posterFrame != null && (
          <Tooltip label="Reset poster to trim start">
            <button
              style={{ ...iconBtnStyle(false), fontSize: 11, padding: '2px 6px', width: 'auto' }}
              onClick={() => onCommit(selectedId, { posterFrame: undefined })}
            >
              Reset
            </button>
          </Tooltip>
        )}
      </div>

      {/* Trim section */}
      <div style={sectionLabelStyle}>Trim</div>
      {/* In point */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={trimLabelStyle}>In</span>
        <NumericInput
          value={videoObj.trimStart ?? 0}
          decimals={2}
          min={0} max={videoObj.naturalDuration}
          width={60}
          onCommit={v => onCommit(selectedId, { trimStart: v })}
        />
        <Tooltip label="Set In to current time">
          <button
            style={{ ...iconBtnStyle(false), fontSize: 11, padding: '2px 6px', width: 'auto' }}
            onClick={() => onCommit(selectedId, { trimStart: currentTime })}
          >
            Set In
          </button>
        </Tooltip>
      </div>
      {/* Out point */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={trimLabelStyle}>Out</span>
        <NumericInput
          value={videoObj.trimEnd ?? videoObj.naturalDuration}
          decimals={2}
          min={0} max={videoObj.naturalDuration}
          width={60}
          onCommit={v => onCommit(selectedId, { trimEnd: v })}
        />
        <Tooltip label="Set Out to current time">
          <button
            style={{ ...iconBtnStyle(false), fontSize: 11, padding: '2px 6px', width: 'auto' }}
            onClick={() => onCommit(selectedId, { trimEnd: currentTime })}
          >
            Set Out
          </button>
        </Tooltip>
      </div>
      {/* Reset trim */}
      <div style={{ marginBottom: 10 }}>
        <button
          style={{ ...iconBtnStyle(false), fontSize: 11, padding: '2px 8px', width: 'auto' }}
          onClick={() => onCommit(selectedId, { trimStart: 0, trimEnd: videoObj.naturalDuration })}
        >
          Reset Trim
        </button>
      </div>
      {/* Start delay */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span style={trimLabelStyle}>Delay</span>
        <NumericInput
          value={videoObj.startOffset ?? 0}
          decimals={1}
          min={0} max={30}
          width={60}
          onCommit={v => onCommit(selectedId, { startOffset: v })}
        />
        <span style={{ color: '#666', fontSize: 11 }}>s before play</span>
      </div>

      {/* Rotation slider + numeric input */}
      <div style={sectionLabelStyle}>Transform</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <label style={{ color: '#555555', fontSize: 12, width: 64, flexShrink: 0 }}>Rotation</label>
        <input
          type="range" min={-360} max={360} step={1}
          value={Math.round(videoObj.rotation ?? 0)}
          onMouseDown={onStartDrag}
          onChange={e => {
            const newRot = Number(e.target.value)
            const { x: fx, y: fy, rotation } = rotateAroundCenter(
              videoObj.frameX, videoObj.frameY, videoObj.frameWidth, videoObj.frameHeight,
              videoObj.rotation ?? 0, newRot,
            )
            onUpdate(selectedId, { rotation, frameX: fx, frameY: fy, x: fx, y: fy })
          }}
          onMouseUp={e => {
            const newRot = Number((e.target as HTMLInputElement).value)
            const { x: fx, y: fy, rotation } = rotateAroundCenter(
              videoObj.frameX, videoObj.frameY, videoObj.frameWidth, videoObj.frameHeight,
              videoObj.rotation ?? 0, newRot,
            )
            onCommit(selectedId, { rotation, frameX: fx, frameY: fy, x: fx, y: fy })
          }}
          style={{ flex: 1 }}
        />
        <NumericInput
          value={Math.round(videoObj.rotation ?? 0)}
          min={-360} max={360}
          width={48}
          onCommit={newRot => {
            const { x: fx, y: fy, rotation } = rotateAroundCenter(
              videoObj.frameX, videoObj.frameY, videoObj.frameWidth, videoObj.frameHeight,
              videoObj.rotation ?? 0, newRot,
            )
            onCommit(selectedId, { rotation, frameX: fx, frameY: fy, x: fx, y: fy })
          }}
        />
      </div>

      {/* Opacity slider + numeric input */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <label style={{ color: '#555555', fontSize: 12, width: 64, flexShrink: 0 }}>Opacity</label>
        <input
          type="range" min={0} max={100} step={1}
          value={Math.round((videoObj.opacity ?? 1) * 100)}
          onMouseDown={onStartDrag}
          onChange={e => onUpdate(selectedId, { opacity: Number(e.target.value) / 100 })}
          onMouseUp={e => onCommit(selectedId, { opacity: Number((e.target as HTMLInputElement).value) / 100 })}
          style={{ flex: 1 }}
        />
        <NumericInput
          value={Math.round((videoObj.opacity ?? 1) * 100)}
          min={0} max={100}
          width={44}
          onCommit={v => onCommit(selectedId, { opacity: v / 100 })}
        />
      </div>

      {/* Adjustments */}
      <AdjustmentsSection
        imgObj={videoObj}
        selectedId={selectedId}
        bypass={adjustmentsBypassV}
        onToggleBypass={toggleAdjustmentsBypassV}
        onStartDrag={onStartDrag}
        onUpdate={(adj) => onUpdate(selectedId, { adjustments: adj })}
        onCommit={(adj) => onCommit(selectedId, { adjustments: adj })}
      />

      {/* Effects */}
      <EffectsSection
        effects={videoObj.effects}
        onUpdate={(effects) => onUpdate(selectedId, { effects })}
        onCommit={(effects) => onCommit(selectedId, { effects })}
      />

      {/* Mask section */}
      <div style={{ borderTop: '1px solid #e8e0d5', paddingTop: 10, marginTop: 4, marginBottom: 10 }}>
        <div style={{ color: '#555555', fontSize: 9, fontWeight: 700, letterSpacing: '1.5px',
          textTransform: 'uppercase' as const, fontFamily: 'var(--font)', marginBottom: 8 }}>Mask</div>

        {videoObj.maskEditMode ? (
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
                onCommit(selectedId, { maskEditMode: false })
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
        ) : videoObj.mask == null ? (
          /* No mask — draw mode picker or active draw banner */
          maskDrawModeV?.id === selectedId ? (
            /* Draw in progress for this video */
            <div>
              <div style={{ color: '#f94608', fontSize: 11, marginBottom: 8 }}>
                Drawing {maskDrawModeV.tool} mask —{'  '}
                {maskDrawModeV.tool === 'pen'
                  ? 'click to add points, close path to finish'
                  : 'drag to define shape'}
              </div>
              <button
                onClick={() => clearMaskDrawModeV()}
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
                    onClick={() => { enterMaskDrawModeV(selectedId, 'pen') }}
                    style={iconBtnStyle()}
                  >
                    <PenTool size={14} />
                  </button>
                </Tooltip>
                <Tooltip label="Rectangle mask">
                  <button
                    onClick={() => { enterMaskDrawModeV(selectedId, 'rect') }}
                    style={iconBtnStyle()}
                  >
                    <Square size={14} />
                  </button>
                </Tooltip>
                <Tooltip label="Oval mask">
                  <button
                    onClick={() => { enterMaskDrawModeV(selectedId, 'ellipse') }}
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
              {thumbnailsV[`${selectedId}__mask`] != null && (
                <div style={{
                  width: 36, height: 36, flexShrink: 0, borderRadius: 6,
                  overflow: 'hidden', border: '1px solid #d4ccc2', background: '#f5ede2',
                }}>
                  <img
                    src={thumbnailsV[`${selectedId}__mask`]}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    alt="mask"
                    draggable={false}
                  />
                </div>
              )}
              <Tooltip label="Edit mask">
                <button
                  onClick={() => { enterMaskEditModeV(selectedId) }}
                  style={{ ...iconBtnStyle(), flex: 1, width: 'auto' }}
                >
                  <Pencil size={14} />
                </button>
              </Tooltip>
              <Tooltip label={videoObj.mask.visible ? 'Hide mask' : 'Show mask'}>
                <button
                  onClick={() => {
                    onCommit(selectedId, { mask: { ...videoObj.mask!, visible: !videoObj.mask!.visible } })
                  }}
                  style={iconBtnStyle()}
                >
                  {videoObj.mask.visible
                    ? <Eye size={14} />
                    : <EyeOff size={14} />}
                </button>
              </Tooltip>
              <Tooltip label="Delete mask">
                <button
                  onClick={() => {
                    onCommit(selectedId, { mask: undefined })
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
                value={videoObj.mask.feather}
                onMouseDown={onStartDrag}
                onChange={(e) => {
                  onUpdate(selectedId, { mask: { ...videoObj.mask!, feather: Number(e.target.value) } })
                }}
                onMouseUp={(e) => {
                  onCommit(selectedId, { mask: { ...videoObj.mask!, feather: Number((e.target as HTMLInputElement).value) } })
                }}
                style={{ flex: 1 }}
              />
              <span style={{ color: '#111111', fontSize: 12, width: 24, textAlign: 'right' }}>
                {videoObj.mask.feather}
              </span>
            </div>

            {/* Invert */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8 }}>
              <label style={{ color: '#555555', fontSize: 12, width: 64, flexShrink: 0 }}>Invert</label>
              <input
                type="checkbox"
                checked={videoObj.mask.inverted}
                onChange={() => {
                  onCommit(selectedId, { mask: { ...videoObj.mask!, inverted: !videoObj.mask!.inverted } })
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

