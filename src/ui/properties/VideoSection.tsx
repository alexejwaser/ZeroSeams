import React, { useEffect, useState, useRef } from 'react'
import { useCanvasStore } from '@/canvas/useCanvasStore'
import type { VideoObject } from '@/types/canvas'
import Tooltip from '../Tooltip'
import { iconBtnProps } from '../iconBtnStyle'
import { Volume2, VolumeX, Play, Pause, Repeat } from 'lucide-react'
import { videoElementRegistry } from '@/canvas/videoElementRegistry'

import { rotateAroundCenter } from '@/canvas/geometry'
import { AdjustmentsSection } from './AdjustmentsSection'
import { EffectsSection } from './EffectsSection'
import { Field, sectionLabelStyle } from './shared'


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
  color: 'var(--text-secondary)',
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

  // Rotates about the FRAME box, not the object box — the content floats inside
  // the frame, so spinning around x/y would swing the crop with it.
  function writeRotation(newRot: number, commit: boolean): void {
    const { x: fx, y: fy, rotation } = rotateAroundCenter(
      videoObj.frameX, videoObj.frameY, videoObj.frameWidth, videoObj.frameHeight,
      videoObj.rotation ?? 0, newRot,
    )
    const write = commit ? onCommit : onUpdate
    write(selectedId, { rotation, frameX: fx, frameY: fy, x: fx, y: fy })
  }

  return (
    <div style={{ padding: '12px 12px 0' }}>
      {/* Read-only info */}
      <div style={sectionLabelStyle}>Info</div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6, gap: 8 }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: 12, width: 64, flexShrink: 0 }}>Duration</span>
        <span style={{ color: 'var(--text-primary)', fontSize: 12 }}>{formatDuration(videoObj.naturalDuration)}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6, gap: 8 }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: 12, width: 64, flexShrink: 0 }}>Dimensions</span>
        <span style={{ color: 'var(--text-primary)', fontSize: 12 }}>{videoObj.naturalWidth} × {videoObj.naturalHeight}</span>
      </div>
      {fileSize != null && (
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10, gap: 8 }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 12, width: 64, flexShrink: 0 }}>File Size</span>
          <span style={{ color: 'var(--text-primary)', fontSize: 12 }}>{fileSize}</span>
        </div>
      )}

      {/* Audio: volume + mute toggle */}
      <div style={sectionLabelStyle}>Audio</div>
      <Field
        label="Volume"
        unit="%"
        marginBottom={6}
        value={Math.round((videoObj.volume ?? 1) * 100)}
        min={0} max={100}
        disabled={videoObj.muted}
        onStartDrag={onStartDrag}
        onLiveChange={v => onUpdate(selectedId, { volume: v / 100 })}
        onChange={v => onCommit(selectedId, { volume: v / 100 })}
        onReset={() => onCommit(selectedId, { volume: 1 })}
      >
        <Tooltip label={videoObj.muted ? 'Unmute' : 'Mute'}>
          <button
            {...iconBtnProps(!videoObj.muted)}
            onClick={() => onCommit(selectedId, { muted: !videoObj.muted })}
          >
            {videoObj.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
        </Tooltip>
      </Field>

      {/* Playback controls */}
      <div style={sectionLabelStyle}>Playback</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Tooltip label={isPlaying ? 'Pause' : 'Play'}>
          <button
            {...iconBtnProps(isPlaying)}
            onClick={() => toggleVideoPlay(videoObj.id)}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          </button>
        </Tooltip>
        <Tooltip label={(videoObj.loop ?? true) ? 'Loop on' : 'Loop off'}>
          <button
            {...iconBtnProps(videoObj.loop ?? true)}
            onClick={() => onCommit(selectedId, { loop: !(videoObj.loop ?? true) })}
          >
            <Repeat size={14} />
          </button>
        </Tooltip>
        <span style={{ color: 'var(--text-secondary)', fontSize: 11, marginLeft: 4 }}>
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
        <span style={{ color: 'var(--text-primary)', fontSize: 11, flex: 1 }}>
          {videoObj.posterFrame != null
            ? formatDuration(videoObj.posterFrame)
            : `Default (${formatDuration(videoObj.trimStart ?? 0)})`}
        </span>
        <Tooltip label="Set poster to current position">
          <button
            {...iconBtnProps(false, false, { fontSize: 11, padding: '2px 6px', width: 'auto' })}
            onClick={() => onCommit(selectedId, { posterFrame: currentTime })}
          >
            Set
          </button>
        </Tooltip>
        {videoObj.posterFrame != null && (
          <Tooltip label="Reset poster to trim start">
            <button
              {...iconBtnProps(false, false, { fontSize: 11, padding: '2px 6px', width: 'auto' })}
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
      <Field
        label="In"
        unit="s"
        labelWidth={32}
        marginBottom={6}
        step={0.1}
        decimals={2}
        value={videoObj.trimStart ?? 0}
        min={0} max={videoObj.naturalDuration}
        onStartDrag={onStartDrag}
        onLiveChange={v => onUpdate(selectedId, { trimStart: v })}
        onChange={v => onCommit(selectedId, { trimStart: v })}
      >
        <Tooltip label="Set In to current time">
          <button
            {...iconBtnProps(false, false, { fontSize: 11, padding: '2px 6px', width: 'auto' })}
            onClick={() => onCommit(selectedId, { trimStart: currentTime })}
          >
            Set In
          </button>
        </Tooltip>
      </Field>
      {/* Out point */}
      <Field
        label="Out"
        unit="s"
        labelWidth={32}
        marginBottom={6}
        step={0.1}
        decimals={2}
        value={videoObj.trimEnd ?? videoObj.naturalDuration}
        min={0} max={videoObj.naturalDuration}
        onStartDrag={onStartDrag}
        onLiveChange={v => onUpdate(selectedId, { trimEnd: v })}
        onChange={v => onCommit(selectedId, { trimEnd: v })}
      >
        <Tooltip label="Set Out to current time">
          <button
            {...iconBtnProps(false, false, { fontSize: 11, padding: '2px 6px', width: 'auto' })}
            onClick={() => onCommit(selectedId, { trimEnd: currentTime })}
          >
            Set Out
          </button>
        </Tooltip>
      </Field>
      {/* Reset trim */}
      <div style={{ marginBottom: 10 }}>
        <button
          {...iconBtnProps(false, false, { fontSize: 11, padding: '2px 8px', width: 'auto' })}
          onClick={() => onCommit(selectedId, { trimStart: 0, trimEnd: videoObj.naturalDuration })}
        >
          Reset Trim
        </button>
      </div>
      {/* Start delay — the unit lives inside the field now, so the trailing
          "s before play" caption that used to carry it is gone. */}
      <Field
        label="Delay"
        unit="s"
        labelWidth={32}
        marginBottom={10}
        step={0.1}
        decimals={1}
        value={videoObj.startOffset ?? 0}
        min={0} max={30}
        onStartDrag={onStartDrag}
        onLiveChange={v => onUpdate(selectedId, { startOffset: v })}
        onChange={v => onCommit(selectedId, { startOffset: v })}
      />

      <div style={sectionLabelStyle}>Transform</div>
      <Field
        label="Rotation"
        unit="°"
        value={Math.round(videoObj.rotation ?? 0)}
        min={-360} max={360}
        onStartDrag={onStartDrag}
        onLiveChange={(v) => writeRotation(v, false)}
        onChange={(v) => writeRotation(v, true)}
        onReset={() => writeRotation(0, true)}
      />
      <Field
        label="Opacity"
        unit="%"
        value={Math.round((videoObj.opacity ?? 1) * 100)}
        min={0} max={100}
        onStartDrag={onStartDrag}
        onLiveChange={v => onUpdate(selectedId, { opacity: v / 100 })}
        onChange={v => onCommit(selectedId, { opacity: v / 100 })}
        onReset={() => onCommit(selectedId, { opacity: 1 })}
      />

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

    </div>
  )
}

