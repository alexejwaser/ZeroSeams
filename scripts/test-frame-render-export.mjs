/**
 * Playwright/Electron E2E test for media-frame RENDERING and EXPORT (issue #66).
 *
 * Why this exists: the store-level suite (test-undo-redo.mjs, 121 assertions) would
 * have passed even with the #65 bug, where media appeared in the layer panel but
 * never painted. That was a React dispatch issue — entirely invisible to tests that
 * only read the store. This script asserts actual pixels.
 *
 * Part 1 — pure Node: videoObjectsInFrame routing (no Electron).
 * Part 2A — rendering: the live scene graph paints each clip kind correctly.
 * Part 2B — export: exportFrames crops correctly and suppresses all selection UI.
 *
 * Out of scope: exportMixedFrames' ffmpeg.wasm encode. It needs crossOriginIsolated
 * + SharedArrayBuffer and takes tens of seconds. Video coverage here is (a) that
 * exportFrames rasterises a video frame's pixels correctly — it's format-agnostic,
 * it just captures the stage — and (b) the routing helper, unit-tested in Part 1.
 *
 * Run: node scripts/test-frame-render-export.mjs
 * Requires: npm run build first
 * Env: ZS_SKIP_VIDEO_PIXEL=1 downgrades video pixel assertions to skips (structural
 *      video assertions still run).
 */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..')
const ELECTRON_BIN = path.join(ROOT, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron')
const CDP_PORT = 9230 // distinct from test-undo-redo.mjs so both can run back-to-back
const SHOTS = '/tmp/zeroseams-frame-render-tests'
const VIDEO_FIXTURE = path.join(ROOT, 'scripts/fixtures/solid-green-1s.mp4')
const SKIP_VIDEO_PIXEL = process.env.ZS_SKIP_VIDEO_PIXEL === '1'
fs.mkdirSync(SHOTS, { recursive: true })

// ─── Test runner ─────────────────────────────────────────────────────────────
let passed = 0, failed = 0, skipped = 0
const failures = []

function ok(cond, msg) {
  if (cond) { console.log(`  ✓ ${msg}`); passed++ }
  else      { console.log(`  ✗ ${msg}`); failed++; failures.push(msg) }
}
function eq(a, b, msg) {
  const pass = a === b
  ok(pass, pass ? msg : `${msg} — got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`)
}
function skip(msg) { console.log(`  ⊘ ${msg} (skipped)`); skipped++ }

// ─── Colour assertion helpers ────────────────────────────────────────────────
// Flat PNG regions should be exact; tol absorbs any colour-profile drift.
const TOL = 12
const MEDIA   = [255, 0, 255]   // magenta fixture
const BG      = [255, 255, 255] // frame background
const EMPTY   = [217, 210, 199] // EMPTY_FRAME_FILL #d9d2c7
const ANCHOR  = [249, 70, 8]    // ClipEditOverlay #f94608
const TRANSF  = [0, 161, 255]   // Konva default Transformer anchorStroke

const hex = (rgb) => '#' + rgb.map(c => c.toString(16).padStart(2, '0')).join('')

function nearColor(actual, expected, msg, tol = TOL) {
  if (!actual) { ok(false, `${msg} — no sample returned`); return }
  const near = [0, 1, 2].every(i => Math.abs(actual[i] - expected[i]) <= tol)
  ok(near, near ? msg : `${msg} — got rgb(${actual.slice(0, 3)}), want ${hex(expected)}`)
}
function isOpaque(actual, msg) {
  eq(actual?.[3], 255, msg)
}
function absent(count, msg) {
  ok(count === 0, count === 0 ? msg : `${msg} — found ${count} matching pixels`)
}
/** Video needs a channel-dominance test: yuv420p round-trips flat colours ±10 and
 *  Chromium's video colour pipeline is not bit-exact. Still fails hard on a black
 *  frame (g ≈ 0), which is the actual bug we're guarding against. */
function dominantGreen(actual, msg) {
  if (!actual) { ok(false, `${msg} — no sample returned`); return }
  const [r, g, b] = actual
  const pass = g > 100 && r < 80 && b < 80
  ok(pass, pass ? msg : `${msg} — got rgb(${r},${g},${b}), want green-dominant`)
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 1 — pure Node: videoObjectsInFrame routing
// ══════════════════════════════════════════════════════════════════════════════
// Mirrors src/canvas/exportFrames.ts videoObjectsInFrame(). Inlined rather than
// imported because the source is TS under electron-vite; same convention as
// test-video.mjs's pathUtils.
function videoObjectsInFrame(objects, frameIndex, frameWidth) {
  const frameLeft = frameIndex * frameWidth
  const frameRight = (frameIndex + 1) * frameWidth
  return Object.values(objects).filter(
    (obj) =>
      obj.type === 'video' &&
      obj.visible &&
      obj.frameX < frameRight &&
      obj.frameX + obj.frameWidth > frameLeft,
  )
}

console.log('\n━━━ Part 1: videoObjectsInFrame (pure) ━━━\n')
{
  const FW = 1080
  const mk = (id, type, frameX, frameWidth, visible = true) =>
    ({ id, type, frameX, frameWidth, visible })

  const inside   = mk('a', 'video', 100, 400)          // wholly in frame 0
  const straddle = mk('b', 'video', 900, 400)          // spans 900–1300, frames 0 and 1
  const hidden   = mk('c', 'video', 100, 400, false)
  const image    = mk('d', 'image', 100, 400)
  const objects = { a: inside, b: straddle, c: hidden, d: image }

  const f0 = videoObjectsInFrame(objects, 0, FW).map(o => o.id).sort()
  const f1 = videoObjectsInFrame(objects, 1, FW).map(o => o.id).sort()
  const f2 = videoObjectsInFrame(objects, 2, FW).map(o => o.id).sort()

  eq(JSON.stringify(f0), JSON.stringify(['a', 'b']), 'frame 0 gets the inside + straddling videos')
  eq(JSON.stringify(f1), JSON.stringify(['b']), 'straddling video is returned for frame 1 too')
  eq(JSON.stringify(f2), JSON.stringify([]), 'frame 2 has no videos')
  ok(!f0.includes('c'), 'invisible video is excluded')
  ok(!f0.includes('d'), 'non-video object is excluded')

  // Boundary: a video ending exactly at the frame edge does not belong to the next frame
  const flush = { e: mk('e', 'video', 0, 1080) }
  eq(videoObjectsInFrame(flush, 0, FW).length, 1, 'frame-flush video belongs to frame 0')
  eq(videoObjectsInFrame(flush, 1, FW).length, 0, 'frame-flush video does not leak into frame 1')
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 2 — Electron
// ══════════════════════════════════════════════════════════════════════════════
// ─── Launch via CDP (electron.launch + Playwright 1.60/Electron 42 has target-detection bug) ──
console.log('\nLaunching app…')
const electronProc = spawn(ELECTRON_BIN, [
  `--remote-debugging-port=${CDP_PORT}`,
  path.join(ROOT, 'out/main/index.js'),
], { stdio: 'pipe' })

await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Electron DevTools port timeout')), 20_000)
  electronProc.stderr.on('data', (d) => {
    if (d.toString().includes('DevTools listening')) { clearTimeout(timer); resolve() }
  })
  electronProc.on('exit', (code) => reject(new Error(`Electron exited with code ${code}`)))
})
await new Promise(r => setTimeout(r, 3000)) // wait for renderer to load

const browser = await chromium.connectOverCDP(`http://localhost:${CDP_PORT}`)
const app = { close: async () => { await browser.close(); electronProc.kill() } }
const page = browser.contexts()[0].pages()[0]
page.on('console', m => { if (m.type() === 'error') console.error(`  [renderer error] ${m.text()}`) })

const ss   = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` }).then(() => console.log(`    📸 ${n}`))
const wait = (ms) => new Promise(r => setTimeout(r, ms))

await page.waitForSelector('canvas', { timeout: 12_000 })
await wait(1500)

const ready = await page.evaluate(() =>
  typeof window.__canvasStore__ !== 'undefined' &&
  typeof window.__getStage__ === 'function' &&
  typeof window.__exportFrames__ === 'function' &&
  typeof window.__videoRegistry__ !== 'undefined')
if (!ready) {
  console.error('FATAL: test globals not exposed on window (need __canvasStore__, __getStage__, __exportFrames__, __videoRegistry__)')
  await app.close()
  process.exit(1)
}
console.log('✓ Test globals exposed\n')

// ─── Page-side helpers ───────────────────────────────────────────────────────
await page.evaluate(() => {
  function scanFor(data, rgb, tol) {
    let count = 0
    // Step 2px in both axes — a 7px-radius anchor circle is still hit, at 1/4 the cost.
    for (let i = 0; i < data.length; i += 4 * 2) {
      if (Math.abs(data[i] - rgb[0]) <= tol &&
          Math.abs(data[i + 1] - rgb[1]) <= tol &&
          Math.abs(data[i + 2] - rgb[2]) <= tol) count++
    }
    return count
  }

  window.__zs = {
    /**
     * Render the LIVE scene graph 1:1 and sample it. Deliberately does NOT hide
     * layers or clear clip-edit mode — that's export's job, asserted separately.
     * This proves the React-built Konva nodes actually paint.
     * points: [{name, x, y}] in logical canvas coords.
     */
    sampleStage(points, pixelRatio = 1) {
      const stage = window.__getStage__()
      const s = window.__canvasStore__.getState()
      const orig = {
        w: stage.width(), h: stage.height(),
        sx: stage.scaleX(), sy: stage.scaleY(),
        x: stage.x(), y: stage.y(),
      }
      try {
        stage.width(s.frameCount * s.frameWidth)
        stage.height(s.frameHeight)
        stage.scaleX(1); stage.scaleY(1); stage.x(0); stage.y(0)
        stage.draw()
        const canvas = stage.toCanvas({ pixelRatio })
        const ctx = canvas.getContext('2d')
        const out = {}
        for (const p of points) {
          const px = Math.round(p.x * pixelRatio)
          const py = Math.round(p.y * pixelRatio)
          out[p.name] = Array.from(ctx.getImageData(px, py, 1, 1).data)
        }
        return out
      } finally {
        stage.width(orig.w); stage.height(orig.h)
        stage.scaleX(orig.sx); stage.scaleY(orig.sy)
        stage.x(orig.x); stage.y(orig.y)
        stage.draw()
      }
    },

    /**
     * Analyse exported blobs held on window.__zsBlobs.
     * points: [{name, frameIndex, x, y}] with x,y in LOGICAL canvas coords.
     * hunts:  [{name, rgb, tol}] — full-image scans, used as absence proofs.
     */
    async analyzeBlobs(points, hunts, frameWidth) {
      const results = window.__zsBlobs
      const bitmaps = []
      for (const r of results) bitmaps.push(await createImageBitmap(r.blob))

      const datas = bitmaps.map((bm) => {
        const c = document.createElement('canvas')
        c.width = bm.width; c.height = bm.height
        const cx = c.getContext('2d')
        cx.drawImage(bm, 0, 0)
        return { w: bm.width, h: bm.height, data: cx.getImageData(0, 0, bm.width, bm.height).data }
      })

      const samples = {}
      for (const p of points) {
        const d = datas[p.frameIndex]
        if (!d) { samples[p.name] = null; continue }
        // Blob i covers logical x in [i*frameWidth, (i+1)*frameWidth); scale by the
        // blob's actual pixel ratio so this stays pixelRatio-independent.
        const ratio = d.w / frameWidth
        const px = Math.round((p.x - p.frameIndex * frameWidth) * ratio)
        const py = Math.round(p.y * ratio)
        const idx = (py * d.w + px) * 4
        samples[p.name] = [d.data[idx], d.data[idx + 1], d.data[idx + 2], d.data[idx + 3]]
      }

      const huntCounts = {}
      for (const h of hunts) {
        huntCounts[h.name] = datas.reduce((sum, d) => sum + scanFor(d.data, h.rgb, h.tol ?? 24), 0)
      }

      return { dims: datas.map(d => ({ w: d.w, h: d.h })), samples, hunts: huntCounts }
    },

    /** 64×64 solid-colour PNG data URL. Built at runtime — no fixture file needed. */
    solidSrc(color) {
      const c = document.createElement('canvas')
      c.width = c.height = 64
      const x = c.getContext('2d')
      x.fillStyle = color
      x.fillRect(0, 0, 64, 64)
      return c.toDataURL('image/png')
    },

    /** 64×64 four-quadrant PNG — catches crop off-by-ones a solid colour cannot. */
    quadrantSrc() {
      const c = document.createElement('canvas')
      c.width = c.height = 64
      const x = c.getContext('2d')
      x.fillStyle = '#ff00ff'; x.fillRect(0, 0, 32, 32)   // TL magenta
      x.fillStyle = '#00ffff'; x.fillRect(32, 0, 32, 32)  // TR cyan
      x.fillStyle = '#ffff00'; x.fillRect(0, 32, 32, 32)  // BL yellow
      x.fillStyle = '#000000'; x.fillRect(32, 32, 32, 32) // BR black
      return c.toDataURL('image/png')
    },

    /**
     * Reset to a clean N-frame project.
     *
     * Blanks `objects` via setState rather than looping removeObject: removeObject
     * on a grid cell deliberately restores an empty placeholder instead of deleting
     * (the cell must keep its slot), so the loop would leave cells behind pointing
     * at a deleted group — and CanvasGroupNode would then read childIds of undefined.
     *
     * History is cleared LAST. setFrameCount pushes a history entry, so draining the
     * stack afterwards would undo the reset's own setup.
     */
    reset(frameCount) {
      const store = window.__canvasStore__
      store.setState({
        objects: {}, objectOrder: [],
        selectedId: null, selectedIds: [],
        past: [], future: [], _openEditModeCount: 0,
      })
      const gs = () => store.getState()
      gs().setFrameCount(frameCount)
      gs().setCanvasBackground('#ffffff')
      store.setState({ past: [], future: [] })
      return { frameWidth: gs().frameWidth, frameHeight: gs().frameHeight }
    },

    /** Add a filled media frame occupying the middle of carousel frame `frameIndex`. */
    addFrame({ frameIndex, frameWidth, inset = 140, size = 800, clipShape, rotation = 0, src }) {
      const gs = () => window.__canvasStore__.getState()
      const id = crypto.randomUUID()
      const fx = frameIndex * frameWidth + inset
      const fy = inset
      gs().addObject({
        id, type: 'image', scope: 'global',
        x: fx, y: fy, width: size, height: size,
        frameX: fx, frameY: fy, frameWidth: size, frameHeight: size,
        contentOffsetX: 0, contentOffsetY: 0, contentWidth: size, contentHeight: size,
        naturalWidth: 64, naturalHeight: 64,
        src, backgroundRemoved: false,
        contentEditMode: false,
        clipShape,
        opacity: 1, rotation, visible: true, locked: false, zIndex: 0,
        scaleX: 1, scaleY: 1,
      })
      return { id, fx, fy, size }
    },
  }
})

const getFrameDims = () => page.evaluate(() => {
  const s = window.__canvasStore__.getState()
  return { frameWidth: s.frameWidth, frameHeight: s.frameHeight }
})
const { frameWidth: FW, frameHeight: FH } = await getFrameDims()
console.log(`Frame dimensions: ${FW}×${FH}\n`)

const DIAMOND = [
  { x: 0.5, y: 0,   handleIn: { dx: 0, dy: 0 }, handleOut: { dx: 0, dy: 0 } },
  { x: 1,   y: 0.5, handleIn: { dx: 0, dy: 0 }, handleOut: { dx: 0, dy: 0 } },
  { x: 0.5, y: 1,   handleIn: { dx: 0, dy: 0 }, handleOut: { dx: 0, dy: 0 } },
  { x: 0,   y: 0.5, handleIn: { dx: 0, dy: 0 }, handleOut: { dx: 0, dy: 0 } },
]

// ══════════════════════════════════════════════════════════════════════════════
// PART 2A — rendering
// ══════════════════════════════════════════════════════════════════════════════
console.log('━━━ Part 2A: rendering ━━━\n')

// Cases 1-4 share one scene: an unclipped control plus three clip kinds.
// The control is load-bearing — "outside the clip is background" passes VACUOUSLY
// if the media never painted, which is exactly the #65 bug class. The control
// proves the outside-assertion has discriminating power.
{
  console.log('Cases 1-4: clip kinds (with unclipped control)')
  const layout = await page.evaluate(async ({ FW, DIAMOND }) => {
    const z = window.__zs
    z.reset(4)
    const src = z.solidSrc('#ff00ff')
    const a = z.addFrame({ frameIndex: 0, frameWidth: FW, src })                                        // plain rect (control)
    const b = z.addFrame({ frameIndex: 1, frameWidth: FW, src, clipShape: { kind: 'rect', cornerRadius: 320 } })
    const c = z.addFrame({ frameIndex: 2, frameWidth: FW, src, clipShape: { kind: 'ellipse' } })
    const d = z.addFrame({ frameIndex: 3, frameWidth: FW, src, clipShape: { kind: 'path', anchors: DIAMOND } })
    return { a, b, c, d }
  }, { FW, DIAMOND })
  await wait(600)

  // Sample points: centre (inside every clip) and a corner at 5% inset (outside
  // the ellipse, the r=320 rounded corner, and the diamond — but inside a plain rect).
  const pt = (f, fx, fy) => ({ x: f.fx + f.size * fx, y: f.fy + f.size * fy })
  const points = []
  for (const [name, f] of Object.entries(layout)) {
    points.push({ name: `${name}-centre`, ...pt(f, 0.5, 0.5) })
    points.push({ name: `${name}-corner`, ...pt(f, 0.05, 0.05) })
  }
  const s = await page.evaluate((p) => window.__zs.sampleStage(p), points)

  nearColor(s['a-centre'], MEDIA, 'plain rect frame: centre paints media')
  nearColor(s['a-corner'], MEDIA, 'plain rect frame: corner paints media (CONTROL)')
  nearColor(s['b-centre'], MEDIA, 'rounded rect: centre paints media')
  nearColor(s['b-corner'], BG,    'rounded rect: corner is clipped away')
  nearColor(s['c-centre'], MEDIA, 'ellipse: centre paints media')
  nearColor(s['c-corner'], BG,    'ellipse: corner is clipped away')
  nearColor(s['d-centre'], MEDIA, 'path (diamond): centre paints media')
  nearColor(s['d-corner'], BG,    'path (diamond): corner is clipped away')
  await ss('clip-kinds')
}

// Case 5: the one-empty-state invariant — a standalone frame with no media IS a shape.
{
  console.log('\nCase 5: standalone frame collapses to a shape')
  const r = await page.evaluate(async ({ FW }) => {
    const z = window.__zs
    const gs = () => window.__canvasStore__.getState()
    z.reset(2)
    const f = z.addFrame({ frameIndex: 0, frameWidth: FW, src: z.solidSrc('#ff00ff') })
    gs().removeMediaFromFrame(f.id)
    const obj = gs().objects[f.id]
    return { f, type: obj?.type, fill: obj?.fill }
  }, { FW })
  await wait(400)

  eq(r.type, 'shape', 'removeMediaFromFrame on a standalone frame yields a shape')
  const s = await page.evaluate((p) => window.__zs.sampleStage(p),
    [{ name: 'c', x: r.f.fx + r.f.size / 2, y: r.f.fy + r.f.size / 2 }])
  const isEmptyFill = [0, 1, 2].every(i => Math.abs(s.c[i] - EMPTY[i]) <= TOL)
  ok(!isEmptyFill, 'collapsed shape does not paint EMPTY_FRAME_FILL (it is not an empty frame)')
}

// Cases 6-7: grid cells. Cell rects are read back from the store rather than
// assumed, so this stays correct if gridTemplates' maths changes.
{
  console.log('\nCases 6-7: grid cells')
  const g = await page.evaluate(async () => {
    const z = window.__zs
    const gs = () => window.__canvasStore__.getState()
    z.reset(2)
    gs().addGrid({ id: 'vertical-2', label: '2 Columns', cols: 2, rows: 1,
      cells: (w, h, gap) => {
        const cw = (w - gap) / 2
        return [{ x: 0, y: 0, w: cw, h }, { x: cw + gap, y: 0, w: cw, h }]
      } }, 200, 200)
    const s = gs()
    const group = Object.values(s.objects).find(o => o.type === 'group' && o.isGrid)
    const cells = group.childIds.map(id => {
      const c = s.objects[id]
      return { id: c.id, isEmpty: c.isEmpty, fx: c.frameX, fy: c.frameY, fw: c.frameWidth, fh: c.frameHeight }
    })
    return { groupId: group.id, cells }
  })
  await wait(500)

  eq(g.cells.length, 2, 'grid created 2 cells')
  ok(g.cells.every(c => c.isEmpty), 'new grid cells are empty')

  const c0 = g.cells[0], c1 = g.cells[1]
  const gapX = (c0.fx + c0.fw + c1.fx) / 2 // midpoint of the inter-cell gap
  let s = await page.evaluate((p) => window.__zs.sampleStage(p), [
    { name: 'cell0', x: c0.fx + c0.fw / 2, y: c0.fy + c0.fh / 2 },
    { name: 'gap',   x: gapX,              y: c0.fy + c0.fh / 2 },
  ])
  nearColor(s.cell0, EMPTY, 'empty grid cell paints EMPTY_FRAME_FILL')
  nearColor(s.gap,   BG,    'the gap between cells shows background')

  await page.evaluate(({ id }) => {
    window.__canvasStore__.getState().insertMediaIntoFrame(id, {
      kind: 'image', src: window.__zs.solidSrc('#ff00ff'), naturalWidth: 64, naturalHeight: 64,
    })
  }, { id: c0.id })
  await wait(600)

  s = await page.evaluate((p) => window.__zs.sampleStage(p), [
    { name: 'cell0', x: c0.fx + c0.fw / 2, y: c0.fy + c0.fh / 2 },
    { name: 'cell1', x: c1.fx + c1.fw / 2, y: c1.fy + c1.fh / 2 },
    { name: 'gap',   x: gapX,              y: c0.fy + c0.fh / 2 },
  ])
  nearColor(s.cell0, MEDIA, 'filled grid cell paints media')
  nearColor(s.cell1, EMPTY, 'sibling cell stays empty')
  nearColor(s.gap,   BG,    'filled cell still clips to its slot (gap is background)')
  await ss('grid-cells')
}

// Grid relayout (#69). computeGridChildPatches is the single source of truth for
// cell geometry — shared by CanvasGroupNode's drag/transform and the gap slider — so
// it's asserted directly rather than through a gesture.
{
  console.log('\nGrid relayout: cover-fit, no distortion (#69)')
  const r = await page.evaluate(async () => {
    const z = window.__zs
    const gs = () => window.__canvasStore__.getState()
    z.reset(2)
    // 2:1 source bitmap — a square-ish cell must letterbox/crop it, never squash it.
    const c = document.createElement('canvas')
    c.width = 128; c.height = 64
    const cx = c.getContext('2d')
    cx.fillStyle = '#ff00ff'; cx.fillRect(0, 0, 128, 64)
    const src = c.toDataURL('image/png')

    gs().addGrid({
      id: 'vertical-2', label: '2 Columns', cols: 2, rows: 1,
      cells: (w, h, gap) => {
        const cw = (w - gap) / 2
        return [{ x: 0, y: 0, w: cw, h }, { x: cw + gap, y: 0, w: cw, h }]
      },
    }, 200, 200)
    const group = Object.values(gs().objects).find(o => o.type === 'group' && o.isGrid)
    const cellId = group.childIds[0]
    gs().insertMediaIntoFrame(cellId, { kind: 'image', src, naturalWidth: 128, naturalHeight: 64 })

    const objects = gs().objects
    const g = gs().objects[group.id]
    // Deliberately non-uniform: width ×2, height ×0.5. The old proportional scaling
    // multiplied content w/h by these independently and destroyed the aspect ratio.
    const next = { x: g.x, y: g.y, width: g.width * 2, height: g.height * 0.5 }

    const resized = window.__computeGridChildPatches__(g, objects, next, true)
    const moved   = window.__computeGridChildPatches__(g, objects, next, false)
    // Feed the first result back in: a compounding implementation drifts, an
    // idempotent one returns identical numbers.
    const objects2 = { ...objects, [cellId]: { ...objects[cellId], ...resized[cellId] } }
    const again = window.__computeGridChildPatches__(g, objects2, next, true)

    return {
      cellId,
      before: {
        contentWidth: objects[cellId].contentWidth,
        contentHeight: objects[cellId].contentHeight,
      },
      resized: resized[cellId],
      moved: moved[cellId],
      again: again[cellId],
    }
  })

  const aspect = r.resized.contentWidth / r.resized.contentHeight
  ok(Math.abs(aspect - 2) < 0.001,
    `grid resize preserves the 2:1 source aspect (got ${aspect.toFixed(4)})`)
  ok(r.resized.contentWidth >= r.resized.frameWidth - 0.001 &&
     r.resized.contentHeight >= r.resized.frameHeight - 0.001,
    'grid resize covers the cell (no letterbox gap)')
  eq(r.moved.contentWidth, undefined, 'a plain move does not touch content dims (preserves manual offset)')
  ok(r.moved.frameWidth > 0, 'a plain move still repositions the cell frame')
  eq(r.again.contentWidth, r.resized.contentWidth, 'relayout is idempotent (no compounding on live transform)')
  eq(r.again.contentOffsetX, r.resized.contentOffsetX, 'idempotent offsets too')
}

// Case 8: THE #65 REGRESSION GUARD. Objects change type in place via
// swapObjectPreservingId; a non-reactive dispatch leaves the old node component
// mounted rendering nothing — layer panel shows the media, canvas doesn't.
{
  console.log('\nCase 8: type-swap repaints (the #65 regression guard)')
  const r = await page.evaluate(async ({ FW }) => {
    const z = window.__zs
    const gs = () => window.__canvasStore__.getState()
    z.reset(2)
    const id = crypto.randomUUID()
    const fx = 140, fy = 140, size = 800
    gs().addObject({
      id, type: 'shape', kind: 'rect', scope: 'global',
      x: fx, y: fy, width: size, height: size,
      fill: '#0000ff', stroke: '#000000', strokeWidth: 0,
      opacity: 1, rotation: 0, visible: true, locked: false, zIndex: 0,
      scaleX: 1, scaleY: 1,
    })
    return { id, fx, fy, size }
  }, { FW })
  await wait(500)

  const centre = [{ name: 'c', x: r.fx + r.size / 2, y: r.fy + r.size / 2 }]
  let s = await page.evaluate((p) => window.__zs.sampleStage(p), centre)
  nearColor(s.c, [0, 0, 255], 'shape paints its fill before the swap')

  const inserted = await page.evaluate(({ id }) => window.__canvasStore__.getState()
    .insertMediaIntoShape(id, {
      kind: 'image', src: window.__zs.solidSrc('#ff00ff'), naturalWidth: 64, naturalHeight: 64,
    }), { id: r.id })
  await wait(700)

  ok(inserted === true, 'insertMediaIntoShape reports success')
  const after = await page.evaluate(({ id }) => window.__canvasStore__.getState().objects[id].type, { id: r.id })
  eq(after, 'image', 'object changed type in place')
  s = await page.evaluate((p) => window.__zs.sampleStage(p), centre)
  nearColor(s.c, MEDIA, 'canvas repaints as media after the in-place type swap (#65)')
  await ss('type-swap')
}

// Case 9: rotation. Only the centre — corner geometry under rotation is fiddly and
// the centre is enough to prove buildClipFunc + the rotated group pivot cooperate.
{
  console.log('\nCase 9: rotated clipped frame')
  const r = await page.evaluate(async ({ FW }) => {
    const z = window.__zs
    z.reset(2)
    return z.addFrame({ frameIndex: 0, frameWidth: FW, src: z.solidSrc('#ff00ff'),
      clipShape: { kind: 'ellipse' }, rotation: 30 })
  }, { FW })
  await wait(600)

  // Rotation is about the frame origin, so the visual centre moves — rotate the
  // local centre offset by 30° to find where it actually lands.
  const rad = 30 * Math.PI / 180
  const half = r.size / 2
  const cx = r.fx + (half * Math.cos(rad) - half * Math.sin(rad))
  const cy = r.fy + (half * Math.sin(rad) + half * Math.cos(rad))
  const s = await page.evaluate((p) => window.__zs.sampleStage(p), [{ name: 'c', x: cx, y: cy }])
  nearColor(s.c, MEDIA, 'rotated ellipse-clipped frame paints at its rotated centre')
  await ss('rotated')
}

// Case 10: degenerate frame. buildClipFunc returns undefined for a zero-size frame —
// an EMPTY clipFunc would clip the whole group away, so this asserts the neighbour
// still paints.
{
  console.log('\nCase 10: degenerate frame does not clip away its neighbours')
  const r = await page.evaluate(async ({ FW }) => {
    const z = window.__zs
    const gs = () => window.__canvasStore__.getState()
    z.reset(2)
    const src = z.solidSrc('#ff00ff')
    const bad  = z.addFrame({ frameIndex: 0, frameWidth: FW, src, clipShape: { kind: 'ellipse' } })
    const good = z.addFrame({ frameIndex: 1, frameWidth: FW, src })
    gs().commitUpdate(bad.id, { frameWidth: 0, width: 0 })
    return { bad, good }
  }, { FW })
  await wait(600)

  const s = await page.evaluate((p) => window.__zs.sampleStage(p), [
    { name: 'bad',  x: r.bad.fx + r.bad.size / 2,   y: r.bad.fy + r.bad.size / 2 },
    { name: 'good', x: r.good.fx + r.good.size / 2, y: r.good.fy + r.good.size / 2 },
  ])
  nearColor(s.bad,  BG,    'degenerate frame paints nothing')
  nearColor(s.good, MEDIA, 'neighbouring frame is unaffected (clipFunc undefined ≠ empty clip)')
  await ss('degenerate')
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 2B — export
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n━━━ Part 2B: export ━━━\n')

const videoReady = await page.evaluate(async ({ FW, DIAMOND, VIDEO_FIXTURE }) => {
  const z = window.__zs
  const gs = () => window.__canvasStore__.getState()
  z.reset(3)
  const magenta = z.solidSrc('#ff00ff')

  // frame 0 — diamond-clipped magenta (silhouette survives export?)
  const f0 = z.addFrame({ frameIndex: 0, frameWidth: FW, src: magenta, clipShape: { kind: 'path', anchors: DIAMOND } })
  // frame 1 — quadrant image, plain rect (crop maths + the CONTROL for the corner assertion)
  const f1 = z.addFrame({ frameIndex: 1, frameWidth: FW, src: z.quadrantSrc() })
  // frame 2 — video
  const f2 = z.addFrame({ frameIndex: 2, frameWidth: FW, src: magenta })
  gs().insertMediaIntoFrame(f2.id, {
    kind: 'video', filePath: VIDEO_FIXTURE,
    naturalWidth: 320, naturalHeight: 240, naturalDuration: 1,
  })
  return { f0, f1, f2 }
}, { FW, DIAMOND, VIDEO_FIXTURE })
await wait(800)

// Video decode: Chromium only presents a decodable frame once currentTime has been
// explicitly assigned (see CanvasVideoNode's canplay handler). readyState >= 2 is
// the exact precondition drawImage needs.
let videoDecoded = false
try {
  await page.waitForFunction(({ id }) => {
    const el = window.__videoRegistry__?.get(id)
    return !!el && el.readyState >= 2 && el.videoWidth > 0
  }, { id: videoReady.f2.id }, { timeout: 10_000 })
  await page.evaluate(async ({ id }) => {
    const el = window.__videoRegistry__.get(id)
    // Seek to 0.5s, not 0 — the t=0 keyframe is the one Chromium is flakiest about presenting.
    await new Promise((r) => { el.onseeked = r; el.currentTime = 0.5 })
    window.__getStage__().draw()
  }, { id: videoReady.f2.id })
  await wait(400)
  videoDecoded = true
  ok(true, 'video fixture decoded and seeked')
} catch {
  ok(false, 'video fixture decoded and seeked — timed out waiting for readyState >= 2')
}

// Arm every piece of selection UI we expect export to suppress.
await page.evaluate(({ id }) => {
  const gs = () => window.__canvasStore__.getState()
  gs().setSelected(id)
  gs().enterClipEditMode(id)
}, { id: videoReady.f0.id })
await wait(500)
await ss('pre-export-with-overlays')

const stageBefore = await page.evaluate(() => {
  const s = window.__getStage__()
  return { w: s.width(), h: s.height(), sx: s.scaleX(), sy: s.scaleY(), x: s.x(), y: s.y() }
})

const exportMeta = await page.evaluate(async ({ FW, FH }) => {
  const stage = window.__getStage__()
  window.__zsBlobs = await window.__exportFrames__(stage, 3, FW, FH)
  return window.__zsBlobs.map(r => ({ extension: r.extension, size: r.blob.size }))
}, { FW, FH })

eq(exportMeta.length, 3, 'export produced one result per frame')
ok(exportMeta.every(r => r.extension === 'png'), 'all results are png by default')
ok(exportMeta.every(r => r.size > 0), 'all blobs are non-empty')

const f0 = videoReady.f0, f1 = videoReady.f1, f2 = videoReady.f2
const pt = (name, f, idx, fx, fy) =>
  ({ name, frameIndex: idx, x: f.fx + f.size * fx, y: f.fy + f.size * fy })

const analysis = await page.evaluate(({ points, hunts, FW }) =>
  window.__zs.analyzeBlobs(points, hunts, FW), {
  FW,
  points: [
    pt('f0-centre', f0, 0, 0.5, 0.5),
    pt('f0-tl',     f0, 0, 0.05, 0.05),
    pt('f0-tr',     f0, 0, 0.95, 0.05),
    pt('f0-bl',     f0, 0, 0.05, 0.95),
    pt('f0-br',     f0, 0, 0.95, 0.95),
    pt('f1-tl',     f1, 1, 0.25, 0.25),
    pt('f1-tr',     f1, 1, 0.75, 0.25),
    pt('f1-bl',     f1, 1, 0.25, 0.75),
    pt('f1-br',     f1, 1, 0.75, 0.75),
    pt('f1-corner', f1, 1, 0.05, 0.05),
    pt('f2-centre', f2, 2, 0.5, 0.5),
  ],
  hunts: [
    { name: 'anchor',      rgb: ANCHOR, tol: 24 },
    { name: 'transformer', rgb: TRANSF, tol: 24 },
  ],
})

// 12 — dimensions
const expectedW = FW * 2, expectedH = FH * 2 // default pixelRatio = 2
ok(analysis.dims.every(d => d.w === expectedW && d.h === expectedH),
  `exported frames are ${expectedW}×${expectedH} (pixelRatio 2)`)

// 13 — clipped silhouette survives export, with the plain-rect control
const S = analysis.samples
nearColor(S['f0-centre'], MEDIA, 'export: diamond clip centre is media')
nearColor(S['f0-tl'], BG, 'export: diamond clip top-left corner is clipped')
nearColor(S['f0-tr'], BG, 'export: diamond clip top-right corner is clipped')
nearColor(S['f0-bl'], BG, 'export: diamond clip bottom-left corner is clipped')
nearColor(S['f0-br'], BG, 'export: diamond clip bottom-right corner is clipped')
isOpaque(S['f0-tl'], 'export: clipped-away pixel is opaque background, not transparent')
nearColor(S['f1-corner'], MEDIA, 'export: unclipped frame corner is media (CONTROL)')

// 14 — crop maths: quadrants must land in the right places
nearColor(S['f1-tl'], [255, 0, 255], 'export crop: top-left quadrant is magenta')
nearColor(S['f1-tr'], [0, 255, 255], 'export crop: top-right quadrant is cyan')
nearColor(S['f1-bl'], [255, 255, 0], 'export crop: bottom-left quadrant is yellow')
nearColor(S['f1-br'], [0, 0, 0],     'export crop: bottom-right quadrant is black')

// 15 — video
if (SKIP_VIDEO_PIXEL) {
  skip('export: video frame is green-dominant (ZS_SKIP_VIDEO_PIXEL=1)')
} else if (!videoDecoded) {
  ok(false, 'export: video frame is green-dominant — video never decoded')
} else {
  dominantGreen(S['f2-centre'], 'export: video frame rasterises its decoded pixels')
}

// 16-17 — absence proofs over the whole image. Far stronger than point sampling:
// #f94608 and rgb(0,161,255) are unique in the palette, so any leak is caught.
absent(analysis.hunts.anchor, 'export: no ClipEditOverlay anchors leaked in')
absent(analysis.hunts.transformer, 'export: no Transformer handles leaked in')

// 19 — stage restored. A leaked resize silently breaks the app after every export.
const stageAfter = await page.evaluate(() => {
  const s = window.__getStage__()
  return { w: s.width(), h: s.height(), sx: s.scaleX(), sy: s.scaleY(), x: s.x(), y: s.y() }
})
eq(JSON.stringify(stageAfter), JSON.stringify(stageBefore), 'stage size/scale/position restored after export')

const transformersVisible = await page.evaluate(() => {
  const ts = window.__getStage__().find('Transformer')
  return ts.length === 0 || ts.every(t => t.isVisible())
})
ok(transformersVisible, 'Transformers are visible again after export')

// 20 — the deliberate clearClipEditMode side effect
const editState = await page.evaluate(({ id }) => {
  const s = window.__canvasStore__.getState()
  return { clipEditMode: s.objects[id]?.clipEditMode, openCount: s._openEditModeCount }
}, { id: f0.id })
ok(!editState.clipEditMode, 'export cleared clipEditMode on the edited frame')
eq(editState.openCount, 0, '_openEditModeCount is 0 after export')

await ss('post-export')

// Write the actual exported PNGs to disk. The pixel assertions above are the real
// check, but a human should be able to look at the silhouette once and confirm it's
// the shape they think it is rather than a coincidence of two sampled points.
const exportedPngs = await page.evaluate(async () => {
  const out = []
  for (const r of window.__zsBlobs) {
    const buf = await r.blob.arrayBuffer()
    let bin = ''
    const bytes = new Uint8Array(buf)
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
    out.push(btoa(bin))
  }
  return out
})
exportedPngs.forEach((b64, i) => {
  fs.writeFileSync(`${SHOTS}/export-frame-${i}.png`, Buffer.from(b64, 'base64'))
})
console.log(`    💾 exported PNGs → ${SHOTS}/export-frame-{0,1,2}.png`)

// ─── Results ──────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(50))
console.log(`Results: ${passed} passed, ${failed} failed${skipped ? `, ${skipped} skipped` : ''}`)
if (failures.length > 0) {
  console.log('\nFailed:')
  failures.forEach(f => console.log(`  ✗ ${f}`))
}
console.log(`\nScreenshots: ${SHOTS}`)

await app.close()
process.exit(failed > 0 ? 1 : 0)
