export const CANVAS_SCALE = 0.5 // display scale so it fits on screen
export const SNAP_THRESHOLD = 8  // canvas pixels within which a snap activates

// ── Canvas chrome colours ───────────────────────────────────────────────────
// Konva takes literal colour strings, so it can't read the CSS custom
// properties in theme.css. These are the same values as `--accent` /
// `--accent-gold`; change them together or a selected object's handles stop
// matching the panel that edits it.
/** Selection borders, transformer anchors, pen/clip anchors, object snap guides. */
export const ACCENT = '#d63a05'
/** Multi-select anchor object — the alignment reference. */
export const ACCENT_GOLD = '#f5a623'
/** Frame-edge snap guides, kept deliberately distinct from object snaps. */
export const SNAP_GUIDE_FRAME = '#ff3b5c'
/** Ruler guidelines. Blue on purpose — they are scaffolding, not selection. */
export const GUIDELINE = '#4a90e2'
export const GUIDELINE_SELECTED = '#2171c7'

/** Constrain a drag delta to the nearest cardinal or 45° diagonal axis. */
export function axisLock(dx: number, dy: number): { dx: number; dy: number } {
  if (dx === 0 && dy === 0) return { dx, dy }
  const angle = Math.abs(Math.atan2(dy, dx))
  if (angle < Math.PI / 8 || angle > 7 * Math.PI / 8) return { dx, dy: 0 }
  if (Math.abs(angle - Math.PI / 2) < Math.PI / 8) return { dx: 0, dy }
  const len = (Math.abs(dx) + Math.abs(dy)) / 2
  return { dx: Math.sign(dx) * len, dy: Math.sign(dy) * len }
}
