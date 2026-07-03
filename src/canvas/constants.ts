export const CANVAS_SCALE = 0.5 // display scale so it fits on screen
export const SNAP_THRESHOLD = 8  // canvas pixels within which a snap activates

/** Constrain a drag delta to the nearest cardinal or 45° diagonal axis. */
export function axisLock(dx: number, dy: number): { dx: number; dy: number } {
  if (dx === 0 && dy === 0) return { dx, dy }
  const angle = Math.abs(Math.atan2(dy, dx))
  if (angle < Math.PI / 8 || angle > 7 * Math.PI / 8) return { dx, dy: 0 }
  if (Math.abs(angle - Math.PI / 2) < Math.PI / 8) return { dx: 0, dy }
  const len = (Math.abs(dx) + Math.abs(dy)) / 2
  return { dx: Math.sign(dx) * len, dy: Math.sign(dy) * len }
}
