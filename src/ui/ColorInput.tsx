import React from 'react'
import { createPortal } from 'react-dom'
import { HexColorPicker } from 'react-colorful'
import { Pipette, Plus, X } from 'lucide-react'
import Tooltip from './Tooltip'
import { useSwatchStore } from '@/store'
import { clamp, hexToRgb, rgbToHex, hexToHsl, hslToHex } from '@/utils/color'
import './ColorInput.css'

// ─── Recent colors (localStorage) ────────────────────────────────────────────

const STORAGE_KEY = 'zeroseams:recentColors'
const MAX_RECENT = 5

function loadRecentColors(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw != null ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function pushRecentColor(hex: string): string[] {
  const prev = loadRecentColors()
  const updated = [hex, ...prev.filter(c => c !== hex)].slice(0, MAX_RECENT)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  return updated
}

// ─── Color conversions ────────────────────────────────────────────────────────

function normalizeHex(input: string): string | null {
  const clean = input.replace(/^#/, '').toLowerCase()
  return /^[0-9a-f]{6}$/.test(clean) ? `#${clean}` : null
}

function clampInt(v: number, lo = 0, hi = 255): number {
  return clamp(Math.round(v), lo, hi)
}

// ─── Popover placement ────────────────────────────────────────────────────────

/** The popover has a fixed width but a *variable* height — the swatch grid
 *  grows a row per six saved colours. Height is therefore measured after mount
 *  (see the layout effect in useColorPopover) and never assumed. */
const POPOVER_WIDTH = 236
/** Only used for the very first frame, before the real height is known; the
 *  layout effect corrects the position before the browser paints. */
const POPOVER_HEIGHT_ESTIMATE = 380
const VIEWPORT_MARGIN = 8
const ANCHOR_GAP = 6

/** `below`/`above` are the y coordinates the popover's top / bottom edge should
 *  take when it opens downward / flips upward. Both are precomputed at open
 *  time so the flip decision doesn't need the trigger element again. */
interface PopoverAnchor {
  below: number
  above: number
  left: number
}

function placePopover(anchor: PopoverAnchor, height: number): { top: number; left: number } {
  let top = anchor.below
  // Flip above the trigger when the real height doesn't fit below it…
  if (top + height > window.innerHeight - VIEWPORT_MARGIN) top = anchor.above - height
  // …and if it doesn't fit above either, pin to the bottom edge.
  if (top + height > window.innerHeight - VIEWPORT_MARGIN) {
    top = window.innerHeight - height - VIEWPORT_MARGIN
  }
  if (top < VIEWPORT_MARGIN) top = VIEWPORT_MARGIN

  let left = anchor.left
  if (left + POPOVER_WIDTH > window.innerWidth - VIEWPORT_MARGIN) {
    left = window.innerWidth - POPOVER_WIDTH - VIEWPORT_MARGIN
  }
  if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN

  return { top, left }
}

// ─── Shared popover hook ──────────────────────────────────────────────────────

type ColorMode = 'hex' | 'rgb' | 'hsl'

interface UseColorPopoverOptions {
  value: string
  onChange: (color: string) => void
  onCommit?: () => void
  popoverAnchorFn?: () => { top: number; left: number }
}

function useColorPopover({ value, onChange, onCommit, popoverAnchorFn }: UseColorPopoverOptions) {
  const [open, setOpen] = React.useState(false)
  const [mode, setMode] = React.useState<ColorMode>('hex')
  const [hexText, setHexText] = React.useState(value)
  const [rgbDraft, setRgbDraft] = React.useState({ r: '0', g: '0', b: '0' })
  const [hslDraft, setHslDraft] = React.useState({ h: '0', s: '0', l: '0' })
  const [recentColors, setRecentColors] = React.useState<string[]>([])
  const popoverRef = React.useRef<HTMLDivElement>(null)
  const hexInputRef = React.useRef<HTMLInputElement>(null)
  const swatchRef = React.useRef<HTMLButtonElement>(null)
  const anchorRef = React.useRef<PopoverAnchor | null>(null)
  const [popoverPos, setPopoverPos] = React.useState<{ top: number; left: number } | null>(null)

  // sync draft fields when value changes externally
  React.useEffect(() => {
    setHexText(value)
    const [r, g, b] = hexToRgb(value)
    setRgbDraft({ r: String(r), g: String(g), b: String(b) })
    const hsl = hexToHsl(value)
    setHslDraft({ h: String(hsl.h), s: String(hsl.s), l: String(hsl.l) })
  }, [value])

  // autofocus + select-all on open
  React.useEffect(() => {
    if (open && mode === 'hex') {
      hexInputRef.current?.focus()
      hexInputRef.current?.select()
    }
  }, [open, mode])

  // outside-click close
  React.useEffect(() => {
    if (!open) return
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node
      if (
        popoverRef.current != null && !popoverRef.current.contains(target) &&
        swatchRef.current != null && !swatchRef.current.contains(target)
      ) {
        doClose(value)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => { document.removeEventListener('mousedown', handleMouseDown) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, value])

  function doClose(finalValue: string) {
    const updated = pushRecentColor(finalValue)
    setRecentColors(updated)
    onCommit?.()
    setOpen(false)
  }

  function handleOpen(_fixed: boolean) {
    let anchor: PopoverAnchor | null = null

    if (popoverAnchorFn) {
      const pos = popoverAnchorFn()
      // A caller-supplied anchor is already the final top-left; flipping it
      // means putting the popover's bottom edge on that same y.
      anchor = { below: pos.top, above: pos.top, left: pos.left }
    } else if (swatchRef.current != null) {
      const rect = swatchRef.current.getBoundingClientRect()
      anchor = { below: rect.bottom + ANCHOR_GAP, above: rect.top - ANCHOR_GAP, left: rect.left }
    }

    anchorRef.current = anchor
    if (anchor != null) {
      // Optimistic — corrected against the measured height before paint.
      setPopoverPos(placePopover(anchor, POPOVER_HEIGHT_ESTIMATE))
    }
    setRecentColors(loadRecentColors())
    setOpen(true)
  }

  // Correct the position against the popover's *actual* height. The swatch grid
  // makes that height variable (a row per six colours, plus the empty state), so
  // any hardcoded constant flips the wrong way near a screen edge. Runs before
  // paint; the ResizeObserver keeps it right when the grid grows or the scope
  // segment switches to a longer palette while the popover is open.
  React.useLayoutEffect(() => {
    if (!open) return
    const el = popoverRef.current
    const anchor = anchorRef.current
    if (el == null || anchor == null) return

    const reposition = () => {
      const height = el.getBoundingClientRect().height
      if (height === 0) return
      const next = placePopover(anchor, height)
      setPopoverPos(prev =>
        prev != null && prev.top === next.top && prev.left === next.left ? prev : next,
      )
    }

    reposition()
    const ro = new ResizeObserver(reposition)
    ro.observe(el)
    return () => { ro.disconnect() }
  }, [open])

  function handleClose() {
    doClose(value)
  }

  function commitHex() {
    const normalized = normalizeHex(hexText)
    if (normalized != null) {
      onChange(normalized)
      const updated = pushRecentColor(normalized)
      setRecentColors(updated)
      onCommit?.()
    } else {
      setHexText(value)
    }
  }

  function commitRgb() {
    const r = clampInt(Number(rgbDraft.r))
    const g = clampInt(Number(rgbDraft.g))
    const b = clampInt(Number(rgbDraft.b))
    const hex = rgbToHex(r, g, b)
    setRgbDraft({ r: String(r), g: String(g), b: String(b) })
    onChange(hex)
    const updated = pushRecentColor(hex)
    setRecentColors(updated)
    onCommit?.()
  }

  function commitHsl() {
    const h = clampInt(Number(hslDraft.h), 0, 360)
    const s = clampInt(Number(hslDraft.s), 0, 100)
    const l = clampInt(Number(hslDraft.l), 0, 100)
    const hex = hslToHex(h, s, l)
    setHslDraft({ h: String(h), s: String(s), l: String(l) })
    onChange(hex)
    const updated = pushRecentColor(hex)
    setRecentColors(updated)
    onCommit?.()
  }

  async function openEyedropper() {
    if (!('EyeDropper' in window)) return
    try {
      // Close popover so the dropper overlay works unobstructed
      setOpen(false)
      const dropper = new (window as unknown as { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper()
      const result = await dropper.open()
      const hex = result.sRGBHex.toLowerCase()
      onChange(hex)
      const updated = pushRecentColor(hex)
      setRecentColors(updated)
      onCommit?.()
    } catch {
      // user cancelled — reopen picker
      setOpen(true)
    }
  }

  return {
    open, mode, setMode,
    hexText, setHexText,
    rgbDraft, setRgbDraft,
    hslDraft, setHslDraft,
    recentColors,
    popoverRef, hexInputRef, swatchRef,
    popoverPos,
    handleOpen, handleClose, doClose,
    commitHex, commitRgb, commitHsl,
    openEyedropper,
  }
}

// ─── Swatches ─────────────────────────────────────────────────────────────────

const SCOPES = [
  { key: 'file', label: 'File', description: 'Saved inside this project file' },
  { key: 'global', label: 'Global', description: 'Shared by every project on this machine' },
] as const

/** Saved-colour palettes, File or Global. Mounted only while the popover is
 *  open, which is what makes the loadGlobal() effect below a per-open lazy
 *  read rather than app-start work. */
function SwatchesSection({ value, onPick }: { value: string; onPick: (color: string) => void }) {
  const scope = useSwatchStore(s => s.scope)
  const setScope = useSwatchStore(s => s.setScope)
  const swatches = useSwatchStore(s => (s.scope === 'file' ? s.file : s.global))
  const addSwatch = useSwatchStore(s => s.addSwatch)
  const removeSwatch = useSwatchStore(s => s.removeSwatch)

  React.useEffect(() => { void useSwatchStore.getState().loadGlobal() }, [])

  const normalized = value.trim().toLowerCase()
  const alreadySaved = swatches.some(s => s.color.trim().toLowerCase() === normalized)

  return (
    <>
      <div className="zs-swatch-header">
        <span className="zs-swatch-title">Swatches</span>
        <div className="zs-scope-seg">
          {SCOPES.map(s => (
            <Tooltip key={s.key} label={s.label} description={s.description}>
              <button
                className="zs-scope-btn"
                data-active={scope === s.key}
                aria-pressed={scope === s.key}
                // mousedown + preventDefault, like the mode buttons: a plain
                // click would blur the hex input first and commit a half-typed
                // value before this handler ever runs.
                onMouseDown={e => { e.preventDefault(); setScope(s.key) }}
              >
                {s.label}
              </button>
            </Tooltip>
          ))}
        </div>
      </div>

      {swatches.length === 0 && <span className="zs-swatch-empty">No swatches yet</span>}

      <div className="zs-swatch-grid">
        {swatches.map(sw => (
          <div key={sw.id} className="zs-swatch-cell">
            <Tooltip
              label={sw.name != null && sw.name !== '' ? sw.name : sw.color.toUpperCase()}
              description={sw.name != null && sw.name !== '' ? sw.color.toUpperCase() : undefined}
            >
              <button
                className="zs-swatch-tile"
                style={{ background: sw.color }}
                aria-label={`Apply ${sw.name != null && sw.name !== '' ? sw.name : sw.color}`}
                onMouseDown={e => { e.preventDefault(); onPick(sw.color) }}
                // The pick lives on mousedown, so Enter/Space needs its own path.
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(sw.color) }
                }}
              />
            </Tooltip>
            <Tooltip label="Remove swatch">
              <button
                className="zs-swatch-remove"
                aria-label={`Remove ${sw.color}`}
                onMouseDown={e => { e.preventDefault(); e.stopPropagation(); removeSwatch(sw.id) }}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); removeSwatch(sw.id) }
                }}
              >
                <X size={9} strokeWidth={3} />
              </button>
            </Tooltip>
          </div>
        ))}

        <Tooltip
          label={alreadySaved ? 'Already saved' : 'Save color'}
          description={alreadySaved ? undefined : `Add ${value.toUpperCase()} to ${scope === 'file' ? 'this file' : 'the global palette'}`}
        >
          <button
            className="zs-swatch-add"
            disabled={alreadySaved}
            aria-label="Save current color as a swatch"
            onMouseDown={e => { e.preventDefault(); if (!alreadySaved) addSwatch(value) }}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addSwatch(value) }
            }}
          >
            <Plus size={11} strokeWidth={2.5} />
          </button>
        </Tooltip>
      </div>
    </>
  )
}

// ─── Popover component ────────────────────────────────────────────────────────

interface PopoverProps {
  value: string
  open: boolean
  fixed: boolean
  popoverPos: { top: number; left: number } | null
  mode: ColorMode
  setMode: (m: ColorMode) => void
  hexText: string
  setHexText: (s: string) => void
  rgbDraft: { r: string; g: string; b: string }
  setRgbDraft: (d: { r: string; g: string; b: string }) => void
  hslDraft: { h: string; s: string; l: string }
  setHslDraft: (d: { h: string; s: string; l: string }) => void
  recentColors: string[]
  popoverRef: React.RefObject<HTMLDivElement>
  hexInputRef: React.RefObject<HTMLInputElement>
  onPickerChange: (color: string) => void
  commitHex: () => void
  commitRgb: () => void
  commitHsl: () => void
  /** Apply a saved colour (swatch or recent) and close. */
  onPickColor: (color: string) => void
  onClose: () => void
  onEyedropper: () => void
}

function ColorPopover({
  value, open, fixed, popoverPos,
  mode, setMode,
  hexText, setHexText,
  rgbDraft, setRgbDraft,
  hslDraft, setHslDraft,
  recentColors,
  popoverRef, hexInputRef,
  onPickerChange, commitHex, commitRgb, commitHsl,
  onPickColor, onClose, onEyedropper,
}: PopoverProps) {
  if (!open) return null

  const posStyle: React.CSSProperties = popoverPos != null
    ? { position: 'fixed', top: popoverPos.top, left: popoverPos.left }
    : { position: 'absolute', top: '100%', left: 0, marginTop: 6 }

  // When fixed=true, portal into document.body so ancestor CSS transforms
  // (e.g. translateX on label pills) don't create a new containing block
  // that breaks position:fixed coordinates.
  const wrap = (el: React.ReactElement) => fixed ? createPortal(el, document.body) : el

  const inputBase: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    background: 'var(--bg-surface)',
    border: '1px solid var(--stroke)',
    borderRadius: 6,
    color: 'var(--text-primary)',
    fontSize: 12,
    fontFamily: 'var(--font)',
    padding: '5px 8px',
  }

  return wrap(
    <div
      ref={popoverRef}
      // Class carries no styling — it's the handle tests use to find the
      // popover and assert its measured on-screen position.
      className="zs-color-popover"
      style={{
        ...posStyle,
        zIndex: 2000,
        width: POPOVER_WIDTH,
        background: 'var(--bg-panel)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        boxShadow: '0 8px 28px rgba(0,0,0,0.13)',
        paddingBottom: 12,
      }}
    >
      {/* Saturation / hue picker — clipped to top corners */}
      <div
        className="zs-color-picker"
        style={{ borderRadius: '14px 14px 0 0', overflow: 'hidden', marginBottom: 2 }}
      >
        <HexColorPicker color={value.toLowerCase()} onChange={onPickerChange} />
      </div>

      {/* Mode toggle + eyedropper */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px 4px' }}>
        <Tooltip label="Eyedropper" description="Pick color from screen">
          <button
            className={`zs-eyedropper-btn${'EyeDropper' in window ? '' : ' unavailable'}`}
            onMouseDown={e => { e.preventDefault(); onEyedropper() }}
          >
            <Pipette size={14} />
          </button>
        </Tooltip>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {(['hex', 'rgb', 'hsl'] as ColorMode[]).map(m => (
            <button
              key={m}
              className={`zs-mode-btn${mode === m ? ' active' : ''}`}
              onMouseDown={e => { e.preventDefault(); setMode(m) }}
            >
              {m.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Hex input */}
      {mode === 'hex' && (
        <div style={{ padding: '0 12px' }}>
          <input
            ref={hexInputRef}
            type="text"
            value={hexText}
            onChange={e => { setHexText(e.target.value) }}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); commitHex() }
              if (e.key === 'Escape') { onClose() }
            }}
            onBlur={commitHex}
            placeholder="#rrggbb"
            style={inputBase}
          />
        </div>
      )}

      {/* RGB inputs */}
      {mode === 'rgb' && (
        <div className="zs-channel-row">
          {(['r', 'g', 'b'] as const).map(ch => (
            <div key={ch} className="zs-channel-wrap">
              <input
                type="number"
                min={0}
                max={255}
                className="zs-channel-input"
                value={rgbDraft[ch]}
                onChange={e => { setRgbDraft({ ...rgbDraft, [ch]: e.target.value }) }}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitRgb()
                  if (e.key === 'Escape') onClose()
                }}
                onBlur={commitRgb}
              />
              <span className="zs-channel-label">{ch.toUpperCase()}</span>
            </div>
          ))}
        </div>
      )}

      {/* HSL inputs */}
      {mode === 'hsl' && (
        <div className="zs-channel-row">
          {([
            { key: 'h', label: 'H', max: 360 },
            { key: 's', label: 'S', max: 100 },
            { key: 'l', label: 'L', max: 100 },
          ] as const).map(({ key, label, max }) => (
            <div key={key} className="zs-channel-wrap">
              <input
                type="number"
                min={0}
                max={max}
                className="zs-channel-input"
                value={hslDraft[key]}
                onChange={e => { setHslDraft({ ...hslDraft, [key]: e.target.value }) }}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitHsl()
                  if (e.key === 'Escape') onClose()
                }}
                onBlur={commitHsl}
              />
              <span className="zs-channel-label">{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Saved swatches (persistent) — distinct from Recent (an MRU log) */}
      <SwatchesSection value={value} onPick={onPickColor} />

      {/* Recent colors */}
      <span className="zs-recent-label">Recent</span>
      <div style={{ display: 'flex', gap: 6, padding: '0 12px' }}>
        {Array.from({ length: MAX_RECENT }).map((_, i) => {
          const c = recentColors[i]
          return (
            <button
              key={i}
              onMouseDown={c != null ? e => { e.preventDefault(); onPickColor(c) } : undefined}
              style={{
                width: 20, height: 20,
                borderRadius: 999,
                background: c ?? 'var(--bg-canvas)',
                border: `2px solid ${c != null ? 'transparent' : 'var(--border)'}`,
                padding: 0,
                cursor: c != null ? 'pointer' : 'default',
                flexShrink: 0,
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

// ─── ColorInput ───────────────────────────────────────────────────────────────

export interface ColorInputProps {
  value: string
  onChange: (color: string) => void
  onCommit?: () => void
  size?: number
  fixed?: boolean
  popoverAnchorFn?: () => { top: number; left: number }
}

export function ColorInput({ value, onChange, onCommit, size = 20, fixed = false, popoverAnchorFn }: ColorInputProps) {
  const popover = useColorPopover({ value, onChange, onCommit, popoverAnchorFn })

  function handlePickColor(color: string) {
    onChange(color)
    popover.doClose(color)
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        ref={popover.swatchRef}
        className="zs-color-trigger"
        onClick={() => { popover.open ? popover.handleClose() : popover.handleOpen(fixed) }}
        style={{
          width: size, height: size,
          borderRadius: 999,
          background: value,
          border: '2px solid var(--border)',
          cursor: 'pointer',
          padding: 0,
          flexShrink: 0,
          display: 'block',
        }}
      />
      <ColorPopover
        value={value}
        open={popover.open}
        fixed={fixed}
        popoverPos={popover.popoverPos}
        mode={popover.mode}
        setMode={popover.setMode}
        hexText={popover.hexText}
        setHexText={popover.setHexText}
        rgbDraft={popover.rgbDraft}
        setRgbDraft={popover.setRgbDraft}
        hslDraft={popover.hslDraft}
        setHslDraft={popover.setHslDraft}
        recentColors={popover.recentColors}
        popoverRef={popover.popoverRef}
        hexInputRef={popover.hexInputRef}
        onPickerChange={color => { onChange(color) }}
        commitHex={popover.commitHex}
        commitRgb={popover.commitRgb}
        commitHsl={popover.commitHsl}
        onPickColor={handlePickColor}
        onClose={popover.handleClose}
        onEyedropper={popover.openEyedropper}
      />
    </div>
  )
}

// ─── MixedColorInput ──────────────────────────────────────────────────────────

export interface MixedColorInputProps {
  value: string | undefined
  onChange: (color: string) => void
  onCommit?: () => void
  size?: number
  fixed?: boolean
}

export function MixedColorInput({ value, onChange, onCommit, size = 20, fixed = false }: MixedColorInputProps) {
  const effectiveValue = value ?? '#808080'
  const popover = useColorPopover({ value: effectiveValue, onChange, onCommit })
  const isMixed = value == null

  function handlePickColor(color: string) {
    onChange(color)
    popover.doClose(color)
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        ref={popover.swatchRef}
        className="zs-color-trigger"
        onClick={() => { popover.open ? popover.handleClose() : popover.handleOpen(fixed) }}
        style={{
          width: size, height: size,
          borderRadius: 999,
          background: isMixed ? '#808080' : value,
          opacity: isMixed ? 0.5 : 1,
          border: '2px solid var(--border)',
          cursor: 'pointer',
          padding: 0,
          flexShrink: 0,
          display: 'block',
          position: 'relative',
        }}
      >
        {isMixed && (
          <span style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 10, fontWeight: 700, lineHeight: 1,
            pointerEvents: 'none',
          }}>—</span>
        )}
      </button>
      <ColorPopover
        value={effectiveValue}
        open={popover.open}
        fixed={fixed}
        popoverPos={popover.popoverPos}
        mode={popover.mode}
        setMode={popover.setMode}
        hexText={isMixed && !popover.open ? '' : popover.hexText}
        setHexText={popover.setHexText}
        rgbDraft={popover.rgbDraft}
        setRgbDraft={popover.setRgbDraft}
        hslDraft={popover.hslDraft}
        setHslDraft={popover.setHslDraft}
        recentColors={popover.recentColors}
        popoverRef={popover.popoverRef}
        hexInputRef={popover.hexInputRef}
        onPickerChange={color => { onChange(color) }}
        commitHex={popover.commitHex}
        commitRgb={popover.commitRgb}
        commitHsl={popover.commitHsl}
        onPickColor={handlePickColor}
        onClose={popover.handleClose}
        onEyedropper={popover.openEyedropper}
      />
    </div>
  )
}
