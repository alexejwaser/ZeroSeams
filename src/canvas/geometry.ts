// ---------------------------------------------------------------------------
// rotateAroundCenter — pure utility
// Konva positions rects/text at top-left (x, y) and rotates around that point.
// To rotate around the visual center, compute where the center is in canvas
// space given the current rotation, then find the new top-left that keeps the
// center at that same canvas-space point with the new rotation angle.
// Ellipses are exempt: Konva renders them at their CENTER, so they already
// rotate around the center — no fix needed.
// ---------------------------------------------------------------------------

export function rotateAroundCenter(
  x: number, y: number, w: number, h: number,
  oldRotDeg: number, newRotDeg: number,
): { x: number; y: number; rotation: number } {
  const oldR = (oldRotDeg * Math.PI) / 180
  const newR = (newRotDeg * Math.PI) / 180
  const hw = w / 2, hh = h / 2
  const cx = x + hw * Math.cos(oldR) - hh * Math.sin(oldR)
  const cy = y + hw * Math.sin(oldR) + hh * Math.cos(oldR)
  return {
    rotation: newRotDeg,
    x: cx - (hw * Math.cos(newR) - hh * Math.sin(newR)),
    y: cy - (hw * Math.sin(newR) + hh * Math.cos(newR)),
  }
}
