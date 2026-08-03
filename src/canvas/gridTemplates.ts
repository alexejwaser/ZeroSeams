// Pure layout engine — no React, no store imports.
// Every cells() function computes rects proportionally from (groupW, groupH, gap).
// Zero hardcoded pixel values. The union of all cells (with gaps) exactly fills [0,0,groupW,groupH].

import type { CanvasObject, ClipShape, GroupObject, ImageObject, VideoObject } from '@/types/canvas'
import { fitCover } from './geometry'

export interface CellRect { x: number; y: number; w: number; h: number }

export interface GridTemplate {
  id: string
  label: string
  cols: number  // for SVG thumbnail aspect hints
  rows: number
  cells: (groupW: number, groupH: number, gap: number) => CellRect[]
  /** Clip applied to every cell at creation time only (addGrid → makeEmptyCell).
   *  Per-cell overrides come from the Frame section's shape picker afterwards.
   *  Deliberately one shape for the whole template: cells() keeps returning bare
   *  rects, which is what keeps computeGridChildPatches free of clip logic. */
  cellClipShape?: ClipShape
}

// ---------------------------------------------------------------------------
// Helper: uniform NxM grid
// ---------------------------------------------------------------------------
function uniformGrid(cols: number, rows: number): GridTemplate['cells'] {
  return (w, h, gap) => {
    const cellW = (w - gap * (cols - 1)) / cols
    const cellH = (h - gap * (rows - 1)) / rows
    const rects: CellRect[] = []
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        rects.push({ x: c * (cellW + gap), y: r * (cellH + gap), w: cellW, h: cellH })
    return rects
  }
}

export const GRID_TEMPLATES: GridTemplate[] = [
  // 1. vertical-2 — 2 columns, 1 row
  {
    id: 'vertical-2',
    label: '2 Columns',
    cols: 2,
    rows: 1,
    cells: uniformGrid(2, 1),
  },

  // 2. horizontal-2 — 1 column, 2 rows
  {
    id: 'horizontal-2',
    label: '2 Rows',
    cols: 1,
    rows: 2,
    cells: uniformGrid(1, 2),
  },

  // 3. vertical-3 — 3 columns, 1 row
  {
    id: 'vertical-3',
    label: '3 Columns',
    cols: 3,
    rows: 1,
    cells: uniformGrid(3, 1),
  },

  // 4. horizontal-3 — 1 column, 3 rows
  {
    id: 'horizontal-3',
    label: '3 Rows',
    cols: 1,
    rows: 3,
    cells: uniformGrid(1, 3),
  },

  // 5. top-featured — large top (60% h) + 2 equal bottom cells
  {
    id: 'top-featured',
    label: 'Top Featured',
    cols: 2,
    rows: 2,
    cells: (w, h, gap) => {
      const topH = (h - gap) * 0.6
      const botH = h - gap - topH
      const halfW = (w - gap) / 2
      return [
        { x: 0,           y: 0,          w,        h: topH },
        { x: 0,           y: topH + gap, w: halfW, h: botH },
        { x: halfW + gap, y: topH + gap, w: halfW, h: botH },
      ]
    },
  },

  // 6. bottom-featured — 2 equal top cells + large bottom (60% h)
  {
    id: 'bottom-featured',
    label: 'Bottom Featured',
    cols: 2,
    rows: 2,
    cells: (w, h, gap) => {
      const botH = (h - gap) * 0.6
      const topH = h - gap - botH
      const halfW = (w - gap) / 2
      return [
        { x: 0,           y: 0,          w: halfW, h: topH },
        { x: halfW + gap, y: 0,          w: halfW, h: topH },
        { x: 0,           y: topH + gap, w,        h: botH },
      ]
    },
  },

  // 7. left-featured — large left (60% w) + 2 equal right cells stacked
  {
    id: 'left-featured',
    label: 'Left Featured',
    cols: 2,
    rows: 2,
    cells: (w, h, gap) => {
      const leftW = (w - gap) * 0.6
      const rightW = w - gap - leftW
      const halfH = (h - gap) / 2
      return [
        { x: 0,           y: 0,           w: leftW,  h },
        { x: leftW + gap, y: 0,           w: rightW, h: halfH },
        { x: leftW + gap, y: halfH + gap, w: rightW, h: halfH },
      ]
    },
  },

  // 8. right-featured — 2 equal left cells stacked + large right (60% w)
  {
    id: 'right-featured',
    label: 'Right Featured',
    cols: 2,
    rows: 2,
    cells: (w, h, gap) => {
      const rightW = (w - gap) * 0.6
      const leftW = w - gap - rightW
      const halfH = (h - gap) / 2
      return [
        { x: 0,           y: 0,           w: leftW,  h: halfH },
        { x: 0,           y: halfH + gap, w: leftW,  h: halfH },
        { x: leftW + gap, y: 0,           w: rightW, h },
      ]
    },
  },

  // 9. asymmetric-L — big top-left (2/3 w × 2/3 h), top-right strip, bottom strip
  {
    id: 'asymmetric-L',
    label: 'Asymmetric L',
    cols: 2,
    rows: 2,
    cells: (w, h, gap) => {
      const bigW = (w - gap) * (2 / 3)
      const smallW = w - gap - bigW
      const bigH = (h - gap) * (2 / 3)
      const smallH = h - gap - bigH
      return [
        { x: 0,          y: 0,          w: bigW,   h: bigH },
        { x: bigW + gap, y: 0,          w: smallW, h: bigH },
        { x: 0,          y: bigH + gap, w,         h: smallH },
      ]
    },
  },

  // 10. asymmetric-R — big top-right, top-left strip, bottom strip (mirror of L)
  {
    id: 'asymmetric-R',
    label: 'Asymmetric R',
    cols: 2,
    rows: 2,
    cells: (w, h, gap) => {
      const bigW = (w - gap) * (2 / 3)
      const smallW = w - gap - bigW
      const bigH = (h - gap) * (2 / 3)
      const smallH = h - gap - bigH
      return [
        { x: 0,            y: 0,          w: smallW, h: bigH },
        { x: smallW + gap, y: 0,          w: bigW,   h: bigH },
        { x: 0,            y: bigH + gap, w,         h: smallH },
      ]
    },
  },

  // 11. T-split — full-width top (40% h) + 3 equal columns below
  {
    id: 'T-split',
    label: 'T Split',
    cols: 3,
    rows: 2,
    cells: (w, h, gap) => {
      const topH = (h - gap) * 0.4
      const botH = h - gap - topH
      const colW = (w - gap * 2) / 3
      return [
        { x: 0,                y: 0,          w,       h: topH },
        { x: 0,                y: topH + gap, w: colW, h: botH },
        { x: colW + gap,       y: topH + gap, w: colW, h: botH },
        { x: (colW + gap) * 2, y: topH + gap, w: colW, h: botH },
      ]
    },
  },

  // 12. L-split — full-height left (40% w) + 3 equal rows on right
  {
    id: 'L-split',
    label: 'L Split',
    cols: 2,
    rows: 3,
    cells: (w, h, gap) => {
      const leftW = (w - gap) * 0.4
      const rightW = w - gap - leftW
      const rowH = (h - gap * 2) / 3
      return [
        { x: 0,           y: 0,               w: leftW,  h },
        { x: leftW + gap, y: 0,               w: rightW, h: rowH },
        { x: leftW + gap, y: rowH + gap,       w: rightW, h: rowH },
        { x: leftW + gap, y: (rowH + gap) * 2, w: rightW, h: rowH },
      ]
    },
  },

  // 13. 2x2 — equal grid
  {
    id: '2x2',
    label: '2×2',
    cols: 2,
    rows: 2,
    cells: uniformGrid(2, 2),
  },

  // 14. 3x2 — 3 cols × 2 rows
  {
    id: '3x2',
    label: '3×2',
    cols: 3,
    rows: 2,
    cells: uniformGrid(3, 2),
  },

  // 15. 2x3 — 2 cols × 3 rows
  {
    id: '2x3',
    label: '2×3',
    cols: 2,
    rows: 3,
    cells: uniformGrid(2, 3),
  },

  // 16. 3x3 — equal grid
  {
    id: '3x3',
    label: '3×3',
    cols: 3,
    rows: 3,
    cells: uniformGrid(3, 3),
  },

  // 17. 4-strip-h — 4 equal horizontal strips
  {
    id: '4-strip-h',
    label: '4 Rows',
    cols: 1,
    rows: 4,
    cells: uniformGrid(1, 4),
  },

  // 18. 4-strip-v — 4 equal vertical strips
  {
    id: '4-strip-v',
    label: '4 Columns',
    cols: 4,
    rows: 1,
    cells: uniformGrid(4, 1),
  },

  // 19. brick-2x2 — standard 2×2 grid
  {
    id: 'brick-2x2',
    label: 'Brick 2×2',
    cols: 2,
    rows: 2,
    cells: uniformGrid(2, 2),
  },

  // 20. brick-3x2 — top full-width cell (1/3 h) + 3 equal cells below (2/3 h)
  {
    id: 'brick-3x2',
    label: 'Brick 3×2',
    cols: 3,
    rows: 2,
    cells: (w, h, gap) => {
      const topH = (h - gap) * (1 / 3)
      const botH = h - gap - topH
      const colW = (w - gap * 2) / 3
      return [
        { x: 0,                y: 0,          w,       h: topH },
        { x: 0,                y: topH + gap, w: colW, h: botH },
        { x: colW + gap,       y: topH + gap, w: colW, h: botH },
        { x: (colW + gap) * 2, y: topH + gap, w: colW, h: botH },
      ]
    },
  },

  // 21. dense-3x3 — 3×3 grid
  {
    id: 'dense-3x3',
    label: 'Dense 3×3',
    cols: 3,
    rows: 3,
    cells: uniformGrid(3, 3),
  },

  // 22. 4x3-grid — 4 cols × 3 rows
  {
    id: '4x3-grid',
    label: '4×3',
    cols: 4,
    rows: 3,
    cells: uniformGrid(4, 3),
  },

  // 23. 4x4-grid — 4 cols × 4 rows
  {
    id: '4x4-grid',
    label: '4×4',
    cols: 4,
    rows: 4,
    cells: uniformGrid(4, 4),
  },

  // 24. 5x3-grid — 5 cols × 3 rows
  {
    id: '5x3-grid',
    label: '5×3',
    cols: 5,
    rows: 3,
    cells: uniformGrid(5, 3),
  },

  // 25. circles-3 — 3 columns, ellipse-clipped cells. The only template that
  // ships a cellClipShape; without it nobody would guess cell clips exist.
  {
    id: 'circles-3',
    label: '3 Circles',
    cols: 3,
    rows: 1,
    cells: uniformGrid(3, 1),
    cellClipShape: { kind: 'ellipse' },
  },
]

/**
 * Re-derive every cell's geometry from its template for a given group box.
 *
 * Single source of truth for grid relayout — used by CanvasGroupNode (drag,
 * live transform, transform end) and by the Properties panel gap slider. Pure:
 * `objects` is passed in rather than read from the store, so this stays testable
 * and free of a store import.
 *
 * `refitContent` controls whether each cell's media is re-cover-fitted to its new
 * size. Pass true whenever the cell SIZE changes (transform, gap change); false for
 * a plain move, where refitting would discard any content offset the user set in
 * content-edit mode.
 *
 * Content is refitted via fitCover off naturalWidth/naturalHeight rather than scaled
 * by the group's width/height deltas. Two reasons (see #69): independent x/y scale
 * factors destroy the media's aspect ratio on any non-uniform resize, and scaling the
 * previous result compounds when applied per-mousemove — which is why live transform
 * previously had to skip content entirely. Deriving from the source bitmap is
 * idempotent, so it can run on every frame of the gesture.
 */
export function computeGridChildPatches(
  group: GroupObject,
  objects: Record<string, CanvasObject>,
  next: { x: number; y: number; width: number; height: number },
  refitContent: boolean,
): Record<string, Partial<ImageObject>> {
  const patches: Record<string, Partial<ImageObject>> = {}
  if (!group.isGrid || !group.gridTemplateId) return patches

  const template = GRID_TEMPLATES.find((t) => t.id === group.gridTemplateId)
  if (!template) return patches

  const cells = template.cells(next.width, next.height, group.gridGap ?? 8)

  group.childIds.forEach((childId, i) => {
    const cell = cells[i]
    if (!cell) return
    const child = objects[childId] as (ImageObject | VideoObject) | undefined
    if (!child) return

    const patch: Partial<ImageObject> = {
      frameX: next.x + cell.x,
      frameY: next.y + cell.y,
      frameWidth: cell.w,
      frameHeight: cell.h,
      x: next.x + cell.x,
      y: next.y + cell.y,
      width: cell.w,
      height: cell.h,
    }

    // Empty cells have naturalWidth 0; fitCover returns a frame-sized box for that,
    // which is exactly right for a placeholder.
    if (refitContent) {
      const cover = fitCover(child.naturalWidth, child.naturalHeight, cell.w, cell.h)
      patch.contentWidth = cover.contentWidth
      patch.contentHeight = cover.contentHeight
      patch.contentOffsetX = cover.contentOffsetX
      patch.contentOffsetY = cover.contentOffsetY
    }

    patches[childId] = patch
  })

  return patches
}
