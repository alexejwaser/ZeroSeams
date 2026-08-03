/**
 * Playwright/Electron E2E test for undo/redo history (issue #38).
 * Tests all undo/redo-sensitive actions for correct history behavior.
 *
 * Run: node scripts/test-undo-redo.mjs
 * Requires: npm run build first
 */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import { terminateElectron } from './terminateElectron.mjs'

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..')
const ELECTRON_BIN = path.join(ROOT, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron')
const CDP_PORT = 9229
const SHOTS = '/tmp/zeroseams-undo-redo-tests'
fs.mkdirSync(SHOTS, { recursive: true })

// ─── Test runner ─────────────────────────────────────────────────────────────
let passed = 0, failed = 0
const failures = []

function ok(cond, msg) {
  if (cond) { console.log(`  ✓ ${msg}`); passed++ }
  else       { console.log(`  ✗ ${msg}`); failed++; failures.push(msg) }
}
function eq(a, b, msg) {
  const pass = a === b
  ok(pass, pass ? msg : `${msg} — got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`)
}

// ─── Launch via CDP (electron.launch + Playwright 1.60/Electron 42 has target-detection bug) ──
console.log('Launching app…')
const electronProc = spawn(ELECTRON_BIN, [
  `--remote-debugging-port=${CDP_PORT}`,
  path.join(ROOT, 'out/main/index.js'),
], { stdio: 'pipe' })

// Wait for DevTools to be ready
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Electron DevTools port timeout')), 20_000)
  electronProc.stderr.on('data', (d) => {
    if (d.toString().includes('DevTools listening')) { clearTimeout(timer); resolve() }
  })
  electronProc.on('exit', (code) => reject(new Error(`Electron exited with code ${code}`)))
})
await new Promise(r => setTimeout(r, 3000)) // wait for renderer to load

const browser = await chromium.connectOverCDP(`http://localhost:${CDP_PORT}`)
const app = {
  close: async () => { await browser.close(); await terminateElectron(electronProc) },
}
const page = browser.contexts()[0].pages()[0]
page.on('console', m => { if (m.type() === 'error') console.error(`  [renderer error] ${m.text()}`) })

const ss   = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` }).then(() => console.log(`    📸 ${n}`))
const wait = (ms) => new Promise(r => setTimeout(r, ms))

await page.waitForSelector('canvas', { timeout: 12_000 })
await wait(1500)

// ─── Store verification ───────────────────────────────────────────────────────
const storeReady = await page.evaluate(() => typeof window.__canvasStore__ !== 'undefined')
if (!storeReady) {
  console.error('FATAL: __canvasStore__ not exposed on window')
  await app.close()
  process.exit(1)
}
console.log('✓ Store exposed\n')

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getState = () => page.evaluate(() => {
  const s = window.__canvasStore__.getState()
  return {
    objects: s.objects,
    objectOrder: s.objectOrder,
    pastLen: s.past.length,
    futureLen: s.future.length,
    frameCount: s.frameCount,
    backgroundColor: s.backgroundColor,
    ratio: s.ratio,
  }
})

const undo = () => page.evaluate(() => window.__canvasStore__.getState().undo())
const redo = () => page.evaluate(() => window.__canvasStore__.getState().redo())

// Minimal 10×10 white PNG data URL (same as test-multiselect-transform.mjs)
const TEST_IMG_SRC = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FAAhKDveksOjmAAAAAElFTkSuQmCC'

const addShape = () => page.evaluate(() => {
  const id = crypto.randomUUID()
  window.__canvasStore__.getState().addObject({
    id, type: 'shape', kind: 'rect', scope: 'global',
    x: 100, y: 100, width: 100, height: 100,
    fill: '#ff0000', stroke: '#000000', strokeWidth: 1,
    opacity: 1, rotation: 0, visible: true, locked: false, zIndex: 0,
    scaleX: 1, scaleY: 1,
  })
  return id
})

const addText = () => page.evaluate(() => {
  const id = crypto.randomUUID()
  window.__canvasStore__.getState().addObject({
    id, type: 'text', scope: 'global',
    x: 200, y: 200, width: 200, height: 50,
    fontFamily: 'sans-serif', fontSize: 24, fontStyle: 'normal',
    fill: '#000000', align: 'left', letterSpacing: 0, lineHeight: 1.2,
    spans: [{ text: 'Hello' }],
    opacity: 1, rotation: 0, visible: true, locked: false, zIndex: 0,
    scaleX: 1, scaleY: 1,
  })
  return id
})

const addPath = () => page.evaluate(() => {
  const id = crypto.randomUUID()
  window.__canvasStore__.getState().addObject({
    id, type: 'path', scope: 'global',
    x: 300, y: 300, width: 100, height: 100,
    anchors: [
      { x: 300, y: 300, handleIn: { dx: 0, dy: 0 }, handleOut: { dx: 30, dy: 0 } },
      { x: 400, y: 300, handleIn: { dx: -30, dy: 0 }, handleOut: { dx: 0, dy: 0 } },
      { x: 400, y: 400, handleIn: { dx: 0, dy: -30 }, handleOut: { dx: 0, dy: 0 } },
    ],
    closed: true, fill: '#0000ff', stroke: '#000000', strokeWidth: 1,
    pathEditMode: false,
    opacity: 1, rotation: 0, visible: true, locked: false, zIndex: 0,
    scaleX: 1, scaleY: 1,
  })
  return id
})

const addImage = (src) => page.evaluate((s) => {
  const id = crypto.randomUUID()
  window.__canvasStore__.getState().addObject({
    id, type: 'image', scope: 'global',
    x: 50, y: 50, width: 200, height: 200,
    frameX: 50, frameY: 50, frameWidth: 200, frameHeight: 200,
    contentOffsetX: 0, contentOffsetY: 0, contentWidth: 200, contentHeight: 200,
    naturalWidth: 10, naturalHeight: 10,
    src: s, backgroundRemoved: false,
    contentEditMode: false,
    opacity: 1, rotation: 0, visible: true, locked: false, zIndex: 0,
    scaleX: 1, scaleY: 1,
  })
  return id
}, src)

// Select an object and wait for PropertiesPanel to render
const selectObj = (id) => page.evaluate((id) => {
  window.__canvasStore__.getState().setSelected(id)
}, id)

const pastLen = () => page.evaluate(() => window.__canvasStore__.getState().past.length)

// Drag the unit affix of the property row labelled `labelText` by `dx` pixels
// (issue #68 replaced every paired range slider with this gesture). Driven with
// the real mouse, not synthetic events: the affix calls setPointerCapture, which
// only works for a pointer the browser actually believes is down.
// Returns { downDelta, moveDelta, upDelta } — change in pastLen at each phase.
// The contract is 0 / 0 / 1: nothing on press, nothing per pixel, ONE on release.
const scrubField = async (labelText, dx) => {
  const pos = await page.evaluate((lt) => {
    const lbl = [...document.querySelectorAll('label')].find(l => l.textContent.trim() === lt)
    if (!lbl) return null
    const affix = lbl.parentElement?.querySelector('.zs-num-unit')
    if (!affix) return null
    const r = affix.getBoundingClientRect()
    if (r.width === 0) return null
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  }, labelText)
  if (!pos) return { error: `no scrub affix for "${labelText}"` }

  const before = await pastLen()
  await page.mouse.move(pos.x, pos.y)
  await page.mouse.down()
  const afterDown = await pastLen()
  for (let i = 1; i <= 5; i++) await page.mouse.move(pos.x + (dx * i) / 5, pos.y)
  const afterMoves = await pastLen()
  await page.mouse.up()
  const afterUp = await pastLen()

  return {
    downDelta: afterDown - before,
    moveDelta: afterMoves - before,
    upDelta: afterUp - before,
  }
}

// ─── Baseline: clear any leftover objects ────────────────────────────────────
await page.evaluate(() => {
  const s = window.__canvasStore__.getState()
  for (const id of [...s.objectOrder]) s.removeObject(id)
})
await wait(200)

// ── A. Object lifecycle ───────────────────────────────────────────────────────
console.log('── A. Object lifecycle ──')

{
  const s0 = await getState()
  const id = await addShape()
  const s1 = await getState()
  eq(s1.pastLen - s0.pastLen, 1, 'addObject pushes 1 history entry')
  ok(s1.objects[id] !== undefined, 'object exists after add')

  await undo()
  await wait(100)
  const s2 = await getState()
  ok(s2.objects[id] === undefined, 'undo removes added object')
  eq(s2.futureLen, 1, 'undo moves entry to future')

  await redo()
  await wait(100)
  const s3 = await getState()
  ok(s3.objects[id] !== undefined, 'redo re-adds object')

  // Delete
  await page.evaluate((id) => window.__canvasStore__.getState().removeObject(id), id)
  await wait(100)
  const s4 = await getState()
  eq(s4.pastLen - s3.pastLen, 1, 'removeObject pushes 1 history entry')
  ok(s4.objects[id] === undefined, 'object gone after delete')

  await undo()
  await wait(100)
  const s5 = await getState()
  ok(s5.objects[id] !== undefined, 'undo restores deleted object')

  // Duplicate
  await page.evaluate((id) => window.__canvasStore__.getState().duplicateObject(id), id)
  await wait(100)
  const s6 = await getState()
  eq(s6.pastLen - s5.pastLen, 1, 'duplicateObject pushes 1 history entry')
  eq(s6.objectOrder.length, s5.objectOrder.length + 1, 'duplicate added to order')

  await undo()
  await wait(100)
  const s7 = await getState()
  eq(s7.objectOrder.length, s5.objectOrder.length, 'undo removes duplicate')

  // Lock
  await page.evaluate((id) => window.__canvasStore__.getState().toggleLock(id), id)
  await wait(100)
  const s8 = await getState()
  eq(s8.pastLen - s7.pastLen, 1, 'toggleLock pushes 1 history entry')
  ok(s8.objects[id]?.locked === true, 'object is locked')

  await undo()
  await wait(100)
  const s9 = await getState()
  ok(s9.objects[id]?.locked === false, 'undo unlocks object')

  // Cleanup
  await page.evaluate((id) => window.__canvasStore__.getState().removeObject(id), id)
  await wait(100)
}

// ── B. Z-order ────────────────────────────────────────────────────────────────
console.log('\n── B. Z-order ──')

{
  const id1 = await addShape()
  const id2 = await addShape()
  await wait(100)

  const s0 = await getState()
  const orderBefore = [...s0.objectOrder]

  // bringForward
  await page.evaluate((id) => window.__canvasStore__.getState().bringForward(id), id1)
  await wait(100)
  const s1 = await getState()
  eq(s1.pastLen - s0.pastLen, 1, 'bringForward pushes 1 history entry')
  ok(s1.objectOrder.join() !== orderBefore.join(), 'order changed after bringForward')

  await undo()
  await wait(100)
  const s2 = await getState()
  eq(s2.objectOrder.join(), orderBefore.join(), 'undo reverts bringForward')

  // sendBackward
  await page.evaluate((id) => window.__canvasStore__.getState().sendBackward(id), id2)
  await wait(100)
  const s3 = await getState()
  eq(s3.pastLen - s2.pastLen, 1, 'sendBackward pushes 1 history entry')

  await undo()
  await wait(100)

  // reorderObjects (layer panel drag) — previously had no history entry
  const s4 = await getState()
  const orderBefore2 = [...s4.objectOrder]
  await page.evaluate(([from, to]) => {
    window.__canvasStore__.getState().reorderObjects(from, to, 'before')
  }, [id1, id2])
  await wait(100)
  const s5 = await getState()
  eq(s5.pastLen - s4.pastLen, 1, 'reorderObjects pushes 1 history entry')

  await undo()
  await wait(100)
  const s6 = await getState()
  eq(s6.objectOrder.join(), orderBefore2.join(), 'undo reverts layer panel reorder')

  // Cleanup
  await page.evaluate(([a, b]) => {
    const s = window.__canvasStore__.getState()
    s.removeObject(a)
    s.removeObject(b)
  }, [id1, id2])
  await wait(100)
}

// ── C. Opacity scrub ──────────────────────────────────────────────────────────
console.log('\n── C. Opacity scrub ──')

for (const [label, addFn] of [
  ['shape', addShape],
  ['text', addText],
  ['path', addPath],
  ['image', () => addImage(TEST_IMG_SRC)],
]) {
  const id = await addFn()
  await wait(100)
  await selectObj(id)
  await wait(400) // wait for PropertiesPanel to render

  const result = await scrubField('Opacity', -80)

  if (result.error) {
    ok(false, `${label}: opacity scrub affix found in PropertiesPanel — ${result.error}`)
  } else {
    eq(result.downDelta, 0, `${label}: pointerdown pushes no history (delta=${result.downDelta})`)
    eq(result.moveDelta, 0, `${label}: pointer moves don't flood history (delta=${result.moveDelta})`)
    eq(result.upDelta, 1, `${label}: release commits exactly 1 history entry (delta=${result.upDelta})`)
    const mid = await getState()
    ok((mid.objects[id]?.opacity ?? 1) < 0.95, `${label}: the scrub actually changed opacity`)
  }

  // Undo should revert opacity back to 1
  await undo()
  await wait(100)
  const s = await getState()
  const opacity = s.objects[id]?.opacity ?? -1
  ok(Math.abs(opacity - 1) < 0.01, `${label}: undo reverts opacity to 1 (got ${opacity.toFixed(2)})`)

  await page.evaluate((id) => window.__canvasStore__.getState().removeObject(id), id)
  await wait(100)
}

// ── D. Photo adjustment sliders ───────────────────────────────────────────────
console.log('\n── D. Photo adjustment sliders ──')

{
  const id = await addImage(TEST_IMG_SRC)
  await wait(100)
  await selectObj(id)
  await wait(500)

  // Simulate one drag gesture: startDrag + updateObject calls + commitUpdate.
  // Must call gs() fresh each time — Zustand set() returns a new state object,
  // a cached reference goes stale after any action call.
  const ZERO_ADJ = { exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0, temperature: 0, tint: 0, saturation: 0, vibrance: 0, clarity: 0, dehaze: 0 }

  const adjResult = await page.evaluate(([imgId, zero]) => {
    const gs = () => window.__canvasStore__.getState()
    const before = gs().past.length

    gs().startDrag()
    gs().updateObject(imgId, { adjustments: { ...zero, exposure: 1 } })
    gs().updateObject(imgId, { adjustments: { ...zero, exposure: 2 } })
    const afterUpdates = gs().past.length

    gs().commitUpdate(imgId, { adjustments: { ...zero, exposure: 2 } })
    const afterCommit = gs().past.length

    return { updateDelta: afterUpdates - before, commitDelta: afterCommit - before }
  }, [id, ZERO_ADJ])

  eq(adjResult.updateDelta, 0, 'adjustment updateObject calls don\'t flood history')
  eq(adjResult.commitDelta, 1, 'adjustment commitUpdate adds exactly 1 entry')

  // Two sequential slider gestures = 2 history entries
  const twoGestureResult = await page.evaluate(([imgId, zero]) => {
    const gs = () => window.__canvasStore__.getState()
    const before = gs().past.length
    gs().startDrag()
    gs().updateObject(imgId, { adjustments: { ...zero, exposure: 1 } })
    gs().commitUpdate(imgId, { adjustments: { ...zero, exposure: 1 } })
    gs().startDrag()
    gs().updateObject(imgId, { adjustments: { ...zero, exposure: 2 } })
    gs().commitUpdate(imgId, { adjustments: { ...zero, exposure: 2 } })
    return gs().past.length - before
  }, [id, ZERO_ADJ])
  eq(twoGestureResult, 2, 'two adjustment gestures = 2 history entries')

  // Undo steps back through pre-drag snapshots.
  // History at this point: [..., {exposure=0 from adjResult startDrag},
  //   {exposure=2 from pre-gesture1}, {exposure=1 from pre-gesture2}]
  // Current = exposure=2. Three undos reach 0.
  await undo()
  await wait(100)
  const s1 = await getState()
  eq(s1.objects[id]?.adjustments?.exposure ?? -1, 1, 'undo 1: reverts to exposure=1 (gesture2 undone)')

  await undo()
  await wait(100)
  const s2 = await getState()
  eq(s2.objects[id]?.adjustments?.exposure ?? -1, 2, 'undo 2: reverts to pre-gesture1 state (exposure=2)')

  await undo()
  await wait(100)
  const s3 = await getState()
  eq(s3.objects[id]?.adjustments?.exposure ?? 0, 0, 'undo 3: reverts to pre-adjResult state (exposure=0)')

  await page.evaluate((id) => window.__canvasStore__.getState().removeObject(id), id)
  await wait(100)
}

// ── E. Object properties ──────────────────────────────────────────────────────
console.log('\n── E. Object properties ──')

{
  const id = await addShape()
  await wait(100)

  // Fill color
  await page.evaluate((id) => window.__canvasStore__.getState().commitUpdate(id, { fill: '#00ff00' }), id)
  const s1 = await getState()
  eq(s1.objects[id]?.fill, '#00ff00', 'fill updated')
  await undo()
  await wait(100)
  const s2 = await getState()
  eq(s2.objects[id]?.fill, '#ff0000', 'undo reverts fill to original')

  // Stroke width
  await page.evaluate((id) => window.__canvasStore__.getState().commitUpdate(id, { strokeWidth: 5 }), id)
  await undo()
  await wait(100)
  const s3 = await getState()
  eq(s3.objects[id]?.strokeWidth, 1, 'undo reverts strokeWidth')

  // Corner radius
  await page.evaluate((id) => window.__canvasStore__.getState().commitUpdate(id, { cornerRadius: 12 }), id)
  await undo()
  await wait(100)
  const s4 = await getState()
  ok((s4.objects[id]?.cornerRadius ?? 0) === 0, 'undo reverts cornerRadius')

  await page.evaluate((id) => window.__canvasStore__.getState().removeObject(id), id)
  await wait(100)
}

// ── F. Media Frames (shape↔frame conversion) ─────────────────────────────────
console.log('\n── F. Media Frames ──')

{
  // F1. Shape → frame conversion: id + objectOrder position preserved,
  // undo restores the original ShapeObject (fill/stroke/strokeWidth).
  const id = await addShape()
  await wait(100)
  const s0 = await getState()
  const origIndex = s0.objectOrder.indexOf(id)
  const origFill = s0.objects[id]?.fill
  const origStroke = s0.objects[id]?.stroke
  const origStrokeWidth = s0.objects[id]?.strokeWidth

  await page.evaluate((id) => window.__canvasStore__.getState().convertShapeToFrame(id), id)
  await wait(100)
  const s1 = await getState()
  eq(s1.pastLen - s0.pastLen, 1, 'F1: convertShapeToFrame pushes exactly 1 history entry')
  eq(s1.objects[id]?.type, 'image', 'F1: converted object is type image')
  ok(s1.objects[id]?.isEmpty === true, 'F1: converted frame is empty')
  eq(s1.objects[id]?.clipShape?.kind, 'rect', 'F1: clipShape kind is rect')
  eq(s1.objectOrder.indexOf(id), origIndex, 'F1: objectOrder index unchanged')
  eq(s1.objectOrder.length, s0.objectOrder.length, 'F1: objectOrder length unchanged')

  await undo()
  await wait(100)
  const s2 = await getState()
  eq(s2.objects[id]?.type, 'shape', 'F1: undo restores ShapeObject')
  eq(s2.objects[id]?.fill, origFill, 'F1: undo restores original fill')
  eq(s2.objects[id]?.stroke, origStroke, 'F1: undo restores original stroke')
  eq(s2.objects[id]?.strokeWidth, origStrokeWidth, 'F1: undo restores original strokeWidth')

  await redo()
  await wait(100)
  const s3 = await getState()
  eq(s3.objects[id]?.type, 'image', 'F1: redo re-converts to frame')
  ok(s3.objects[id]?.isEmpty === true, 'F1: redo frame is empty')

  // F2. insertMediaIntoFrame on the (now empty) frame — cover-fit content dims,
  // undo re-empties, redo restores src via srcVault reinjection.
  await page.evaluate(([id, src]) => {
    window.__canvasStore__.getState().insertMediaIntoFrame(id, { kind: 'image', src, naturalWidth: 10, naturalHeight: 10 })
  }, [id, TEST_IMG_SRC])
  await wait(100)
  const s4 = await getState()
  eq(s4.pastLen - s3.pastLen, 1, 'F2: insertMediaIntoFrame pushes exactly 1 history entry')
  ok(s4.objects[id]?.isEmpty === false, 'F2: insertMediaIntoFrame clears isEmpty')
  eq(s4.objects[id]?.src, TEST_IMG_SRC, 'F2: src set on frame')
  ok((s4.objects[id]?.contentWidth ?? 0) > 0 && (s4.objects[id]?.contentHeight ?? 0) > 0, 'F2: cover-fit produced nonzero content dims')

  await undo()
  await wait(100)
  const s5 = await getState()
  ok(s5.objects[id]?.isEmpty === true, 'F2: undo restores empty frame')
  eq(s5.objects[id]?.src, '', 'F2: undo clears src')

  await redo()
  await wait(100)
  const s6 = await getState()
  ok(s6.objects[id]?.isEmpty === false, 'F2: redo restores media')
  eq(s6.objects[id]?.src, TEST_IMG_SRC, 'F2: redo restores src via srcVault reinjection')

  // F3. removeMediaFromFrame on a STANDALONE frame collapses it back to a shape —
  // there is only one empty state, so "remove media" and "convert to shape" are the
  // same action. (Grid cells are the exception and stay isEmpty frames.)
  // Undo restores media with src intact (validates vault-retention on removal).
  const s7 = await getState()
  const preRemoveClipKind = s7.objects[id]?.clipShape?.kind
  const preRemoveFillColor = s7.objects[id]?.fill?.color
  const preRemoveX = s7.objects[id]?.frameX
  const preRemoveW = s7.objects[id]?.frameWidth
  await page.evaluate((id) => window.__canvasStore__.getState().removeMediaFromFrame(id), id)
  await wait(100)
  const s8 = await getState()
  eq(s8.pastLen - s7.pastLen, 1, 'F3: removeMediaFromFrame pushes exactly 1 history entry')
  eq(s8.objects[id]?.type, 'shape', 'F3: standalone frame collapses back to a shape')
  eq(s8.objects[id]?.kind, preRemoveClipKind, 'F3: clip kind becomes the shape kind')
  ok(s8.objects[id]?.isEmpty === undefined, 'F3: no lingering isEmpty frame state')
  ok(s8.objects[id]?.clipShape === undefined, 'F3: no lingering clipShape')
  // ShapeObject.fill is `string | Fill`. A SOLID frame fill collapses back to
  // the bare colour string (denormalizeFill) — that canonical form is what keeps
  // a shape→frame→shape round-trip value-identical. Gradients stay Fill objects;
  // F7 covers those.
  eq(s8.objects[id]?.fill, preRemoveFillColor, 'F3: solid fill collapses back to a bare colour string')
  eq(s8.objects[id]?.x, preRemoveX, 'F3: geometry preserved (x)')
  eq(s8.objects[id]?.width, preRemoveW, 'F3: geometry preserved (width)')

  await undo()
  await wait(100)
  const s9 = await getState()
  ok(s9.objects[id]?.isEmpty === false, 'F3: undo restores media')
  eq(s9.objects[id]?.src, TEST_IMG_SRC, 'F3: undo restores src intact (srcVault retained on removal)')

  // Cleanup
  await page.evaluate((id) => window.__canvasStore__.getState().removeObject(id), id)
  await wait(100)
}

{
  // F4. Round-trip shape → frame → shape preserves geometry and style.
  const id = await addShape()
  await wait(100)
  const s0 = await getState()
  const orig = s0.objects[id]

  await page.evaluate((id) => window.__canvasStore__.getState().convertShapeToFrame(id), id)
  await wait(100)
  await page.evaluate((id) => window.__canvasStore__.getState().convertFrameToShape(id), id)
  await wait(100)
  const s1 = await getState()
  const final = s1.objects[id]

  eq(final?.type, 'shape', 'F4: round-trip ends as ShapeObject')
  ok(Math.abs((final?.x ?? 0) - orig.x) < 0.5, 'F4: x preserved within 0.5px')
  ok(Math.abs((final?.y ?? 0) - orig.y) < 0.5, 'F4: y preserved within 0.5px')
  ok(Math.abs((final?.width ?? 0) - orig.width) < 0.5, 'F4: width preserved within 0.5px')
  ok(Math.abs((final?.height ?? 0) - orig.height) < 0.5, 'F4: height preserved within 0.5px')
  eq(final?.fill, orig.fill, 'F4: fill preserved')
  eq(final?.stroke, orig.stroke, 'F4: stroke preserved')
  eq(final?.strokeWidth, orig.strokeWidth, 'F4: strokeWidth preserved')

  await page.evaluate((id) => window.__canvasStore__.getState().removeObject(id), id)
  await wait(100)
}

{
  // F5. Fill-color drag pattern on a frame object: updateObject calls during
  // the drag don't flood history, commitUpdate adds exactly 1 entry, and a
  // single undo returns to the pre-drag fill.
  const shapeId = await addShape()
  await wait(100)
  await page.evaluate((id) => window.__canvasStore__.getState().convertShapeToFrame(id), shapeId)
  await wait(100)
  const s0 = await getState()
  const preDragFill = JSON.stringify(s0.objects[shapeId]?.fill)

  const result = await page.evaluate((id) => {
    const gs = () => window.__canvasStore__.getState()
    const before = gs().past.length
    gs().startDrag()
    gs().updateObject(id, { fill: { type: 'solid', color: '#ff0000' } })
    gs().updateObject(id, { fill: { type: 'solid', color: '#00ff00' } })
    const afterUpdates = gs().past.length
    gs().commitUpdate(id, { fill: { type: 'solid', color: '#00ff00' } })
    const afterCommit = gs().past.length
    return { updateDelta: afterUpdates - before, commitDelta: afterCommit - before }
  }, shapeId)

  eq(result.updateDelta, 0, 'F5: fill updateObject calls don\'t flood history')
  eq(result.commitDelta, 1, 'F5: fill commitUpdate adds exactly 1 entry')

  const s1 = await getState()
  eq(s1.objects[shapeId]?.fill?.color, '#00ff00', 'F5: fill committed to green')

  await undo()
  await wait(100)
  const s2 = await getState()
  eq(JSON.stringify(s2.objects[shapeId]?.fill), preDragFill, 'F5: single undo returns to pre-drag fill')

  // Cleanup
  await page.evaluate((id) => {
    const gs = () => window.__canvasStore__.getState()
    while (gs().past.length > 0) gs().undo()
    gs().removeObject(id)
  }, shapeId)
  await wait(100)
}

{
  // F6. Video and image cover-fit a shape IDENTICALLY — no stretching. A landscape
  // source in a square frame must overflow horizontally and match the frame height,
  // preserving its aspect ratio. Regression guard: reading videoWidth on
  // `durationchange` (before it's populated) yields 0, and fitCover's degenerate
  // branch then returns the frame size verbatim — i.e. a stretched video.
  const shapeId = await page.evaluate(() => {
    const id = crypto.randomUUID()
    window.__canvasStore__.getState().addObject({
      id, type: 'shape', kind: 'rect', scope: 'global', name: 'sq',
      fill: '#ffffff', stroke: '#000000', strokeWidth: 0,
      x: 0, y: 0, width: 400, height: 400,
      rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, locked: false, zIndex: 0,
    })
    return id
  })
  await wait(100)

  // 1920×1080 landscape source into a 400×400 frame.
  await page.evaluate((id) => {
    window.__canvasStore__.getState().insertMediaIntoShape(id, {
      kind: 'video', filePath: '/tmp/fake.mp4', name: 'v',
      naturalWidth: 1920, naturalHeight: 1080, naturalDuration: 5,
    })
  }, shapeId)
  await wait(100)
  const v = (await getState()).objects[shapeId]
  eq(v?.type, 'video', 'F6: shape became a video frame')
  eq(v?.contentHeight, 400, 'F6: video cover-fit matches frame height')
  ok(Math.abs(v.contentWidth - (400 * 1920) / 1080) < 0.5, 'F6: video content width preserves 16:9 aspect')
  ok(v.contentWidth > 400, 'F6: video overflows the frame horizontally (cropped, not squashed)')
  ok(Math.abs(v.contentOffsetX - (400 - v.contentWidth) / 2) < 0.5, 'F6: video overflow centered')

  // Same source dims as an image must produce identical content geometry.
  await page.evaluate(([id, src]) => {
    window.__canvasStore__.getState().insertMediaIntoFrame(id, {
      kind: 'image', src, naturalWidth: 1920, naturalHeight: 1080,
    })
  }, [shapeId, TEST_IMG_SRC])
  await wait(100)
  const i = (await getState()).objects[shapeId]
  eq(i?.contentWidth, v.contentWidth, 'F6: image and video cover-fit produce identical width')
  eq(i?.contentHeight, v.contentHeight, 'F6: image and video cover-fit produce identical height')
  eq(i?.contentOffsetX, v.contentOffsetX, 'F6: image and video cover-fit produce identical offset')

  // Cleanup
  await page.evaluate((id) => {
    const gs = () => window.__canvasStore__.getState()
    while (gs().past.length > 0) gs().undo()
    gs().removeObject(id)
  }, shapeId)
  await wait(100)
}

{
  // F7. Gradient fills (#61). Fill geometry is stored NORMALIZED (angle in
  // degrees, cx/cy/r in 0–1 object units) for the same reason ClipShape anchors
  // are: display px do not survive a resize or a type conversion. These two
  // round-trips are what prove the value is never rewritten in transit.
  const LINEAR = { type: 'linear', angle: 45, stops: [{ offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' }] }
  const RADIAL = { type: 'radial', cx: 0.25, cy: 0.75, r: 0.4, stops: [{ offset: 0, color: '#00ff00' }, { offset: 0.5, color: '#ffff00' }, { offset: 1, color: '#000000' }] }

  // F7a. shape → frame → shape keeps the gradient intact.
  const id = await addShape()
  await wait(100)
  await page.evaluate(([id, fill]) => window.__canvasStore__.getState().commitUpdate(id, { fill }), [id, LINEAR])
  await wait(100)
  const g0 = await getState()
  eq(JSON.stringify(g0.objects[id]?.fill), JSON.stringify(LINEAR), 'F7a: a ShapeObject accepts a gradient Fill')

  await page.evaluate((id) => window.__canvasStore__.getState().convertShapeToFrame(id), id)
  await wait(100)
  const g1 = await getState()
  eq(g1.objects[id]?.type, 'image', 'F7a: shape converted to a frame')
  eq(JSON.stringify(g1.objects[id]?.fill), JSON.stringify(LINEAR), 'F7a: gradient survives shape → frame')

  await page.evaluate((id) => window.__canvasStore__.getState().convertFrameToShape(id), id)
  await wait(100)
  const g2 = await getState()
  eq(g2.objects[id]?.type, 'shape', 'F7a: frame converted back to a shape')
  eq(JSON.stringify(g2.objects[id]?.fill), JSON.stringify(LINEAR), 'F7a: gradient survives frame → shape')

  // F7b. A radial gradient on a frame survives a JSON save → load round-trip
  // (loadProject is the real reader used by every open path).
  await page.evaluate(([id, fill]) => {
    const gs = () => window.__canvasStore__.getState()
    gs().convertShapeToFrame(id)
    gs().commitUpdate(id, { fill })
  }, [id, RADIAL])
  await wait(100)

  const roundTripped = await page.evaluate(() => {
    const gs = () => window.__canvasStore__.getState()
    const st = gs()
    // Same shape as io/projectFile.ts buildProject(), through real JSON.
    const json = JSON.stringify({
      id: 'test', name: 'test', schemaVersion: 2,
      platform: st.platform, ratio: st.ratio,
      dimensions: { width: st.frameWidth, height: st.frameHeight },
      frameCount: st.frameCount, frames: st.frames,
      backgroundColor: st.backgroundColor,
      objects: st.objects, objectOrder: st.objectOrder,
      createdAt: '', updatedAt: '', version: 1,
    })
    gs().loadProject(JSON.parse(json))
    return true
  })
  ok(roundTripped, 'F7b: project serialized and reloaded')
  await wait(150)
  const g3 = await getState()
  eq(JSON.stringify(g3.objects[id]?.fill), JSON.stringify(RADIAL), 'F7b: radial gradient survives save → load')
  eq(g3.objects[id]?.fill?.cx, 0.25, 'F7b: cx stayed normalized 0–1 (never rewritten to display px)')
  eq(g3.objects[id]?.fill?.stops?.length, 3, 'F7b: all three stops survive')

  // F7c. A bare colour string is still legal on a shape — old projects need no
  // migration, which is the whole reason ShapeObject.fill is `string | Fill`.
  const legacyId = await page.evaluate(() => {
    const id = crypto.randomUUID()
    window.__canvasStore__.getState().addObject({
      id, type: 'shape', kind: 'rect', scope: 'global',
      x: 10, y: 10, width: 50, height: 50,
      fill: '#abcdef', stroke: '#000000', strokeWidth: 1,
      opacity: 1, rotation: 0, visible: true, locked: false, zIndex: 0,
      scaleX: 1, scaleY: 1,
    })
    return id
  })
  await wait(100)
  await page.evaluate((id) => window.__canvasStore__.getState().convertShapeToFrame(id), legacyId)
  await wait(100)
  const g4 = await getState()
  eq(g4.objects[legacyId]?.fill?.type, 'solid', 'F7c: a bare string becomes a solid Fill on the frame')
  eq(g4.objects[legacyId]?.fill?.color, '#abcdef', 'F7c: the colour is carried through unchanged')
  await page.evaluate((id) => window.__canvasStore__.getState().convertFrameToShape(id), legacyId)
  await wait(100)
  const g5 = await getState()
  eq(g5.objects[legacyId]?.fill, '#abcdef', 'F7c: and collapses back to the same bare string')

  // Cleanup — loadProject reset history, so just remove.
  await page.evaluate(([a, b]) => {
    const gs = () => window.__canvasStore__.getState()
    gs().removeObject(a)
    gs().removeObject(b)
  }, [id, legacyId])
  await wait(100)
}

// ── G. Canvas-level ───────────────────────────────────────────────────────────
console.log('\n── G. Canvas-level ──')

{
  const s0 = await getState()

  // Background color
  await page.evaluate(() => window.__canvasStore__.getState().setCanvasBackground('#123456'))
  await wait(100)
  const s1 = await getState()
  eq(s1.pastLen - s0.pastLen, 1, 'setCanvasBackground pushes 1 history entry')
  eq(s1.backgroundColor, '#123456', 'background color updated')

  await undo()
  await wait(100)
  const s2 = await getState()
  eq(s2.backgroundColor, s0.backgroundColor, 'undo reverts background color')

  // Frame count
  const origCount = s2.frameCount
  await page.evaluate(() => window.__canvasStore__.getState().setFrameCount(4))
  await wait(100)
  const s3 = await getState()
  eq(s3.pastLen - s2.pastLen, 1, 'setFrameCount pushes 1 history entry')
  eq(s3.frameCount, 4, 'frame count updated to 4')

  await undo()
  await wait(100)
  const s4 = await getState()
  eq(s4.frameCount, origCount, 'undo reverts frame count')

  // Ratio
  await page.evaluate(() => window.__canvasStore__.getState().setRatio('portrait'))
  await wait(100)
  const s5 = await getState()
  eq(s5.pastLen - s4.pastLen, 1, 'setRatio pushes 1 history entry')
  eq(s5.ratio, 'portrait', 'ratio updated')

  await undo()
  await wait(100)
  const s6 = await getState()
  eq(s6.ratio, s0.ratio, 'undo reverts ratio')
}

// ── H. Multi-select ───────────────────────────────────────────────────────────
console.log('\n── H. Multi-select ──')

{
  const id1 = await addShape()
  const id2 = await addShape()
  await wait(100)

  // Align — commitMultipleUpdates = exactly 1 history entry
  const s0 = await getState()
  await page.evaluate(([a, b]) => {
    const s = window.__canvasStore__.getState()
    s.setSelected(a)
    s.addToSelection(b)
    s.alignObjects('left')
  }, [id1, id2])
  await wait(100)
  const s1 = await getState()
  eq(s1.pastLen - s0.pastLen, 1, 'alignObjects pushes exactly 1 history entry')

  await undo()
  await wait(100)
  const s2 = await getState()
  eq(s2.objects[id1]?.x, s0.objects[id1]?.x, 'undo reverts id1 x after align')
  eq(s2.objects[id2]?.x, s0.objects[id2]?.x, 'undo reverts id2 x after align')

  // Delete multiple — exactly 1 entry
  const s3 = await getState()
  await page.evaluate(([a, b]) => window.__canvasStore__.getState().removeMultipleObjects([a, b]), [id1, id2])
  await wait(100)
  const s4 = await getState()
  eq(s4.pastLen - s3.pastLen, 1, 'removeMultipleObjects pushes exactly 1 history entry')
  ok(s4.objects[id1] === undefined && s4.objects[id2] === undefined, 'both objects deleted')

  await undo()
  await wait(100)
  const s5 = await getState()
  ok(s5.objects[id1] !== undefined && s5.objects[id2] !== undefined, 'undo restores both deleted objects')

  await page.evaluate(([a, b]) => {
    const s = window.__canvasStore__.getState()
    s.removeObject(a)
    s.removeObject(b)
  }, [id1, id2])
  await wait(100)
}

// ── I. Edge cases ─────────────────────────────────────────────────────────────
console.log('\n── I. Edge cases ──')

{
  // Undo at empty history — no crash
  // Use gs() fresh each call — stale s reference won't see past.length shrink
  await page.evaluate(() => {
    const gs = () => window.__canvasStore__.getState()
    while (gs().past.length > 0) gs().undo()
  })
  await wait(100)
  let threw = false
  try {
    await page.evaluate(() => window.__canvasStore__.getState().undo()) // should be no-op
    await wait(50)
  } catch (e) {
    threw = true
  }
  ok(!threw, 'undo at empty history does not crash')
  const s0 = await getState()
  eq(s0.pastLen, 0, 'past is empty after undo-to-limit')

  // Redo at end of future — no crash
  await page.evaluate(() => {
    const gs = () => window.__canvasStore__.getState()
    while (gs().future.length > 0) gs().redo()
  })
  await wait(100)
  threw = false
  try {
    await page.evaluate(() => window.__canvasStore__.getState().redo())
    await wait(50)
  } catch (e) {
    threw = true
  }
  ok(!threw, 'redo at empty future does not crash')

  // New action after undo clears redo stack
  const id = await addShape()
  await wait(100)
  await undo()
  await wait(100)
  const s1 = await getState()
  ok(s1.futureLen > 0, 'future has entries after undo')

  await addShape() // new action
  await wait(100)
  const s2 = await getState()
  eq(s2.futureLen, 0, 'new action clears future (redo stack)')

  // Cleanup
  await page.evaluate(() => {
    const s = window.__canvasStore__.getState()
    for (const id of [...s.objectOrder]) s.removeObject(id)
  })
  await wait(100)
}

// ── J. Rotation scrub coalescing ─────────────────────────────────────────────
console.log('\n── J. Rotation scrub coalescing ──')

{
  const id = await addShape()
  await selectObj(id)
  await wait(400)

  const result = await scrubField('Rotation', 90)

  if (result.error) {
    ok(false, `rotation scrub affix found — ${result.error}`)
  } else {
    eq(result.downDelta, 0, 'rotation pointerdown pushes no history')
    eq(result.moveDelta, 0, 'rotation pointer moves do not push history (drag pattern)')
    eq(result.upDelta, 1, 'rotation release pushes exactly 1 history entry')

    const mid = await getState()
    ok((mid.objects[id]?.rotation ?? 0) > 0, `the scrub actually rotated (got ${mid.objects[id]?.rotation})`)

    // Undo restores pre-rotation state
    const beforeUndo = await getState()
    await undo()
    await wait(100)
    const afterUndo = await getState()
    eq(afterUndo.objects[id]?.rotation ?? 0, 0, 'undo restores rotation to 0')
    eq(afterUndo.pastLen, beforeUndo.pastLen - 1, 'past shrinks by 1 after undo')
  }

  // Cleanup
  await page.evaluate((oid) => {
    const gs = () => window.__canvasStore__.getState()
    while (gs().past.length > 0) gs().undo()
    gs().removeObject(oid)
  }, id)
  await wait(100)
}

// ── K. Arrow-key nudge coalescing ─────────────────────────────────────────────
console.log('\n── K. Arrow-key nudge coalescing ──')

{
  const id = await addShape()
  await selectObj(id)
  await wait(200)

  const startX = await page.evaluate((oid) => window.__canvasStore__.getState().objects[oid]?.x ?? 0, id)
  const beforeLen = (await getState()).pastLen

  // Dispatch 5 rapid ArrowRight keypresses (no modifier = 1px each)
  await page.evaluate(() => {
    for (let i = 0; i < 5; i++) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
    }
  })
  await wait(100)

  // During debounce window: canvas updated but no history entry yet
  const duringDebounce = await getState()
  const liveX = duringDebounce.objects[id]?.x ?? startX
  ok(liveX === startX + 5, `canvas updated live during nudge burst (x = ${startX} + 5 = ${startX + 5})`)
  eq(duringDebounce.pastLen, beforeLen, 'no history entry yet during debounce window')

  // Wait for debounce to fire (300ms)
  await wait(400)
  const afterDebounce = await getState()
  eq(afterDebounce.pastLen, beforeLen + 1, '5 arrow presses coalesce into 1 history entry')

  // Undo restores to original position
  await undo()
  await wait(100)
  const afterUndo = await getState()
  eq(afterUndo.objects[id]?.x ?? -1, startX, 'undo restores object to pre-burst position')

  // Redo returns to nudged position
  await page.evaluate(() => window.__canvasStore__.getState().redo())
  await wait(100)
  const afterRedo = await getState()
  eq(afterRedo.objects[id]?.x ?? -1, startX + 5, 'redo returns object to nudged position')

  // Cleanup
  await page.evaluate((oid) => {
    const gs = () => window.__canvasStore__.getState()
    while (gs().past.length > 0) gs().undo()
    gs().removeObject(oid)
  }, id)
  await wait(100)
}

console.log('\n── L. Grid cells: the frame/cell fork ──')

// A grid cell is the ONE case that must not collapse to a shape when emptied — it
// has to keep its slot. That `parentGroupId` branch in removeMediaFromFrame is the
// only thing keeping cells and standalone frames as distinct representations, and
// it shipped with no coverage (issues #62 and #66). Section F covers the standalone
// half of the fork; this covers the cell half.

// Build a 2-cell grid and return its ids. Uses a real GRID_TEMPLATES id so
// CanvasGroupNode's template lookup still resolves on resize.
const makeGrid = () => page.evaluate(() => {
  const gs = () => window.__canvasStore__.getState()
  gs().addGrid({
    id: 'vertical-2', label: '2 Columns', cols: 2, rows: 1,
    cells: (w, h, gap) => {
      const cw = (w - gap) / 2
      return [{ x: 0, y: 0, w: cw, h }, { x: cw + gap, y: 0, w: cw, h }]
    },
  }, 200, 200)
  const s = gs()
  const group = Object.values(s.objects).find(o => o.type === 'group' && o.isGrid)
  return { groupId: group.id, cellIds: [...group.childIds] }
})

const fillCell = (id) => page.evaluate((id) => {
  window.__canvasStore__.getState().insertMediaIntoFrame(id, {
    kind: 'image', src: window.__zsImg__, naturalWidth: 10, naturalHeight: 10,
  })
}, id)

const cellInfo = (id, groupId) => page.evaluate(({ id, groupId }) => {
  const s = window.__canvasStore__.getState()
  const o = s.objects[id]
  const g = s.objects[groupId]
  return {
    exists: !!o, type: o?.type, isEmpty: o?.isEmpty, src: o?.src,
    parentGroupId: o?.parentGroupId, clipShape: o?.clipShape, fill: o?.fill,
    name: o?.name, pinnedFrame: o?.pinnedFrame, effects: o?.effects,
    rotation: o?.rotation, scaleX: o?.scaleX, originalSrc: o?.originalSrc,
    orderIndex: s.objectOrder.indexOf(id),
    groupExists: !!g, childIds: g?.childIds ? [...g.childIds] : null,
    inVault: s._srcVault.has(id),
    pastLen: s.past.length,
  }
}, { id, groupId })

await page.evaluate((src) => { window.__zsImg__ = src }, TEST_IMG_SRC)

{
  // L1 (case 21). removeMediaFromFrame on a grid cell: keeps the slot.
  const { groupId, cellIds } = await makeGrid()
  const cellId = cellIds[0]
  await page.evaluate(({ id }) => {
    // Give the cell frame-identity state so we can assert it survives the swap.
    window.__canvasStore__.getState().commitUpdate(id, {
      clipShape: { kind: 'ellipse' }, frameStroke: '#123456', frameStrokeWidth: 3,
    })
  }, { id: cellId })
  await fillCell(cellId)
  await wait(120)
  const before = await cellInfo(cellId, groupId)

  await page.evaluate((id) => window.__canvasStore__.getState().removeMediaFromFrame(id), cellId)
  await wait(120)
  const after = await cellInfo(cellId, groupId)

  eq(after.pastLen - before.pastLen, 1, 'L1: removeMediaFromFrame on a cell pushes exactly 1 history entry')
  eq(after.type, 'image', 'L1: cell stays an ImageObject (does NOT collapse to a shape)')
  eq(after.isEmpty, true, 'L1: cell is marked empty')
  eq(after.parentGroupId, groupId, 'L1: parentGroupId preserved')
  eq(after.clipShape?.kind, 'ellipse', 'L1: clipShape preserved through the swap')
  eq(after.orderIndex, before.orderIndex, 'L1: objectOrder index untouched')
  eq(JSON.stringify(after.childIds), JSON.stringify(before.childIds), 'L1: parent childIds unchanged')
  ok(after.inVault, 'L1: _srcVault entry retained (undo needs the src back)')

  await undo()
  await wait(120)
  const undone = await cellInfo(cellId, groupId)
  eq(undone.isEmpty, false, 'L1: undo restores the filled cell')
  eq(undone.src, TEST_IMG_SRC, 'L1: undo restores src via vault reinjection')

  await page.evaluate(({ groupId }) => {
    const gs = () => window.__canvasStore__.getState()
    while (gs().past.length > 0) gs().undo()
    gs().removeObject(groupId)
  }, { groupId })
  await wait(120)
}

{
  // L2 (case 23). removeObject on a FILLED image cell restores a placeholder rather
  // than deleting. Note the _srcVault asymmetry vs L1: removeObject drops the vault
  // entry, removeMediaFromFrame keeps it. Pinned here so the #62 Phase A
  // consolidation doesn't accidentally unify the two.
  const { groupId, cellIds } = await makeGrid()
  const cellId = cellIds[0]
  await fillCell(cellId)
  await wait(120)

  await page.evaluate((id) => window.__canvasStore__.getState().removeObject(id), cellId)
  await wait(120)
  const after = await cellInfo(cellId, groupId)

  ok(after.exists, 'L2: removeObject on a filled cell does not delete it')
  eq(after.type, 'image', 'L2: cell remains an ImageObject')
  eq(after.isEmpty, true, 'L2: cell becomes an empty placeholder')
  ok(after.orderIndex >= 0, 'L2: cell stays in objectOrder')
  ok(after.childIds?.includes(cellId), 'L2: cell stays in the parent childIds')
  ok(!after.inVault, 'L2: _srcVault entry dropped (differs from removeMediaFromFrame — intentional)')
  // Both pinned by #62 Phase A, which routed this branch through frameToEmptyImage:
  // the placeholder is built fresh rather than spread from the filled cell, so stale
  // transform state and the pre-AI src can't survive on an object that has no media.
  eq(after.scaleX, 1, 'L2: placeholder scaleX reset to 1 (no stale transform state)')
  ok(!after.originalSrc, 'L2: placeholder drops originalSrc')

  await page.evaluate(({ groupId }) => {
    const gs = () => window.__canvasStore__.getState()
    while (gs().past.length > 0) gs().undo()
    gs().removeObject(groupId)
  }, { groupId })
  await wait(120)
}

{
  // L3 (case 24). removeObject on a VIDEO cell converts it to an empty ImageObject.
  // The placeholder is currently hand-built and drops name/pinnedFrame/effects, which
  // frameToEmptyImage preserves — #62 Phase A routes both through the shared builder.
  const { groupId, cellIds } = await makeGrid()
  const cellId = cellIds[0]
  await page.evaluate(({ id }) => {
    const gs = () => window.__canvasStore__.getState()
    gs().commitUpdate(id, {
      name: 'My Cell', pinnedFrame: 1, clipShape: { kind: 'ellipse' },
      fill: { type: 'solid', color: '#abcdef' }, rotation: 15,
      effects: [{ id: 'fx1', type: 'shadow', enabled: true, params: {} }],
    })
    gs().insertMediaIntoFrame(id, {
      kind: 'video', filePath: '/tmp/fake.mp4',
      naturalWidth: 1920, naturalHeight: 1080, naturalDuration: 5,
    })
  }, { id: cellId })
  await wait(150)
  const filled = await cellInfo(cellId, groupId)
  eq(filled.type, 'video', 'L3: cell holds a video before removal')

  await page.evaluate((id) => window.__canvasStore__.getState().removeObject(id), cellId)
  await wait(150)
  const after = await cellInfo(cellId, groupId)

  eq(after.type, 'image', 'L3: video cell becomes an empty ImageObject (VideoObject has no isEmpty)')
  eq(after.isEmpty, true, 'L3: placeholder is empty')
  eq(after.parentGroupId, groupId, 'L3: parentGroupId preserved')
  eq(after.clipShape?.kind, 'ellipse', 'L3: clipShape carried over')
  eq(after.fill?.color, '#abcdef', 'L3: fill carried over')
  eq(after.rotation, 15, 'L3: rotation carried over')
  // #62 Phase A routed this branch through frameToEmptyImage — the hand-built
  // placeholder used to silently drop all three of these.
  eq(after.name, 'My Cell', 'L3: name carried over')
  eq(after.pinnedFrame, 1, 'L3: pinnedFrame carried over')
  eq(after.effects?.[0]?.id, 'fx1', 'L3: effects carried over')

  await page.evaluate(({ groupId }) => {
    const gs = () => window.__canvasStore__.getState()
    while (gs().past.length > 0) gs().undo()
    gs().removeObject(groupId)
  }, { groupId })
  await wait(120)
}

{
  // L4 (case 25). removeObject on an ALREADY-EMPTY cell. The interception at
  // useCanvasStore.ts:843 requires !isEmpty, so this falls through to the generic
  // delete — which strips the object but never removes its id from the parent's
  // childIds, leaving a dangling reference and an unrecoverable slot.
  const { groupId, cellIds } = await makeGrid()
  const cellId = cellIds[0]
  await wait(120)

  await page.evaluate((id) => window.__canvasStore__.getState().removeObject(id), cellId)
  await wait(120)
  const after = await cellInfo(cellId, groupId)

  ok(!after.exists, 'L4: empty cell is hard-deleted')
  // #62 Phase B: both interceptions in removeObject require media, so an empty cell
  // falls through to the generic delete. Before Phase B that left its id dangling in
  // childIds and the slot permanently unrecoverable.
  ok(!after.childIds?.includes(cellId), 'L4: deleted empty cell is also removed from parent childIds')

  await page.evaluate(({ groupId }) => {
    const gs = () => window.__canvasStore__.getState()
    while (gs().past.length > 0) gs().undo()
    gs().removeObject(groupId)
  }, { groupId })
  await wait(120)
}

{
  // L5 (case 26). disconnectGridCell on a FILLED cell — detaches, keeps the media.
  const { groupId, cellIds } = await makeGrid()
  const cellId = cellIds[0]
  await fillCell(cellId)
  await wait(120)

  await page.evaluate((id) => window.__canvasStore__.getState().disconnectGridCell(id), cellId)
  await wait(120)
  const after = await cellInfo(cellId, groupId)

  ok(after.exists, 'L5: disconnected cell still exists')
  eq(after.type, 'image', 'L5: disconnected filled cell stays an image')
  ok(!after.isEmpty, 'L5: disconnected filled cell is not marked empty')
  eq(after.src, TEST_IMG_SRC, 'L5: disconnected filled cell keeps its media')
  ok(!after.parentGroupId, 'L5: parentGroupId cleared')
  ok(!after.childIds?.includes(cellId), 'L5: removed from parent childIds')

  await page.evaluate(({ groupId, cellId }) => {
    const gs = () => window.__canvasStore__.getState()
    while (gs().past.length > 0) gs().undo()
    gs().removeObject(cellId)
    gs().removeObject(groupId)
  }, { groupId, cellId })
  await wait(120)
}

{
  // L6 (cases 27-28). disconnectGridCell on an EMPTY cell. CLAUDE.md and
  // FrameSection both assert there is exactly ONE empty state — a standalone object
  // with no media is a shape, not an empty frame. Before #62 Phase B, disconnect
  // cleared parentGroupId without collapsing, producing exactly the standalone empty
  // frame that invariant says cannot exist.
  const { groupId, cellIds } = await makeGrid()
  await wait(120)

  await page.evaluate((id) => window.__canvasStore__.getState().disconnectGridCell(id), cellIds[0])
  await wait(120)
  const after = await cellInfo(cellIds[0], groupId)

  ok(!after.parentGroupId, 'L6: parentGroupId cleared')
  ok(!after.childIds?.includes(cellIds[0]), 'L6: removed from parent childIds')
  // #62 Phase B — the one-empty-state invariant:
  eq(after.type, 'shape', 'L6: disconnected EMPTY cell collapses to a shape (one-empty-state invariant)')

  // Disconnect the last remaining cell — the group has nothing left to own.
  await page.evaluate((id) => window.__canvasStore__.getState().disconnectGridCell(id), cellIds[1])
  await wait(120)
  const emptied = await cellInfo(cellIds[1], groupId)
  ok(!emptied.groupExists, 'L6: group is removed once its last cell is disconnected')
  ok(!emptied.parentGroupId, 'L6: last cell is detached even though its group is gone')

  // Collapse + detach + group removal must be ONE undo step, or dismantling a grid
  // by hand leaves the user pressing Cmd+Z through a pile of half-states.
  await undo()
  await wait(120)
  const restored = await cellInfo(cellIds[1], groupId)
  ok(restored.groupExists, 'L6: one undo brings the group back')
  eq(restored.parentGroupId, groupId, 'L6: one undo re-parents the last cell')
  eq(restored.type, 'image', 'L6: undone cell is an empty frame again, not a shape')

  await page.evaluate(({ groupId, cellIds }) => {
    const gs = () => window.__canvasStore__.getState()
    while (gs().past.length > 0) gs().undo()
    for (const c of cellIds) gs().removeObject(c)
    gs().removeObject(groupId)
  }, { groupId, cellIds })
  await wait(120)
}

{
  // L7 (#62 Phase C3). A template may declare one clip for all its cells.
  // addGrid is the only place that applies it — and the clip then has to survive
  // the fill/empty round trip, which is frameToEmptyImage's job and was untested.
  const { groupId, cellIds } = await page.evaluate(() => {
    const gs = () => window.__canvasStore__.getState()
    gs().addGrid({
      id: 'circles-3', label: '3 Circles', cols: 3, rows: 1,
      cells: (w, h, gap) => {
        const cw = (w - gap * 2) / 3
        return [0, 1, 2].map(i => ({ x: i * (cw + gap), y: 0, w: cw, h }))
      },
      cellClipShape: { kind: 'ellipse' },
    }, 200, 200)
    const group = Object.values(gs().objects).find(o => o.type === 'group' && o.isGrid)
    return { groupId: group.id, cellIds: [...group.childIds] }
  })
  await wait(120)

  const kinds = await page.evaluate((ids) => {
    const s = window.__canvasStore__.getState()
    return ids.map(id => s.objects[id]?.clipShape?.kind)
  }, cellIds)
  ok(kinds.length === 3 && kinds.every(k => k === 'ellipse'), 'L7: every cell takes the template clip')

  await fillCell(cellIds[0])
  await wait(120)
  const filled = await cellInfo(cellIds[0], groupId)
  ok(!filled.isEmpty, 'L7: cell holds media')
  eq(filled.clipShape?.kind, 'ellipse', 'L7: filling a cell keeps its clip')

  await page.evaluate((id) => window.__canvasStore__.getState().removeMediaFromFrame(id), cellIds[0])
  await wait(120)
  const emptied = await cellInfo(cellIds[0], groupId)
  ok(emptied.isEmpty, 'L7: emptied cell keeps its slot')
  eq(emptied.clipShape?.kind, 'ellipse', 'L7: …and is still elliptical after the round trip')

  await page.evaluate(({ groupId, cellIds }) => {
    const gs = () => window.__canvasStore__.getState()
    while (gs().past.length > 0) gs().undo()
    for (const c of cellIds) gs().removeObject(c)
    gs().removeObject(groupId)
  }, { groupId, cellIds })
  await wait(120)
}

{
  // L9 (#62 Phase C3). Relayout must never touch the clip. This asserts an
  // ABSENCE — computeGridChildPatches emits geometry only — which is exactly the
  // kind of thing that rots silently, and the reason path anchors are stored
  // normalized 0–1 rather than in display px.
  const { groupId, cellIds } = await makeGrid()
  const cellId = cellIds[0]
  const anchors = [
    { x: 0.5, y: 0, handleIn: { dx: 0, dy: 0 }, handleOut: { dx: 0, dy: 0 } },
    { x: 1, y: 0.5, handleIn: { dx: 0, dy: 0 }, handleOut: { dx: 0, dy: 0 } },
    { x: 0.5, y: 1, handleIn: { dx: 0, dy: 0 }, handleOut: { dx: 0, dy: 0 } },
    { x: 0, y: 0.5, handleIn: { dx: 0, dy: 0 }, handleOut: { dx: 0, dy: 0 } },
  ]
  await page.evaluate(({ id, anchors }) => window.__canvasStore__.getState()
    .commitUpdate(id, { clipShape: { kind: 'path', anchors } }), { id: cellId, anchors })
  await wait(80)

  const result = await page.evaluate(({ groupId }) => {
    const s = window.__canvasStore__.getState()
    const group = s.objects[groupId]
    const patches = window.__computeGridChildPatches__(
      group, s.objects,
      { x: group.x, y: group.y, width: group.width * 1.7, height: group.height * 0.6 },
      true,
    )
    s.commitMultipleUpdates(patches)
    return {
      patchKeys: [...new Set(Object.values(patches).flatMap(p => Object.keys(p)))],
      anchors: window.__canvasStore__.getState().objects[group.childIds[0]]?.clipShape?.anchors,
    }
  }, { groupId })

  ok(!result.patchKeys.includes('clipShape'), 'L9: relayout emits no clipShape (geometry only)')
  eq(result.anchors?.length, 4, 'L9: the path clip survives relayout')
  ok(
    result.anchors?.every(a => a.x >= 0 && a.x <= 1 && a.y >= 0 && a.y <= 1),
    'L9: anchors stay normalized 0–1 through a non-uniform resize',
  )

  await page.evaluate(({ groupId, cellIds }) => {
    const gs = () => window.__canvasStore__.getState()
    while (gs().past.length > 0) gs().undo()
    for (const c of cellIds) gs().removeObject(c)
    gs().removeObject(groupId)
  }, { groupId, cellIds })
  await wait(120)
}

{
  // L8 (#62 Phase C). The Frame section's shape picker is a plain commitUpdate per
  // switch. That is the whole argument for replacing a custom path without a
  // confirmation dialog — so the undo step it relies on has to actually exist.
  // The picker only authors rect/ellipse, but path clips still arrive via shape
  // conversion, so the round trip below stays the behaviour that matters.
  const { groupId, cellIds } = await makeGrid()
  const cellId = cellIds[0]
  const before = await cellInfo(cellId, groupId)

  const setClip = (id, clipShape) => page.evaluate(
    ({ id, clipShape }) => window.__canvasStore__.getState().commitUpdate(id, { clipShape }),
    { id, clipShape },
  )

  await setClip(cellId, { kind: 'ellipse' })
  await wait(80)
  const ellipsed = await cellInfo(cellId, groupId)
  eq(ellipsed.clipShape?.kind, 'ellipse', 'L8: cell takes an ellipse clip')
  eq(ellipsed.pastLen, before.pastLen + 1, 'L8: a shape switch is exactly one history entry')

  await undo()
  await wait(80)
  eq((await cellInfo(cellId, groupId)).clipShape?.kind, undefined, 'L8: undo restores the previous clip kind')
  await redo()
  await wait(80)

  // rect → path → rect, then one undo must bring the anchors back. Seeded anchors
  // are normalized 0–1 (frameClip.clipShapeToAnchors); anything else would not
  // survive a frame resize.
  const seeded = await page.evaluate(() => {
    // Same seed the picker uses for an ellipse → path switch.
    const k = 0.5523 * 0.5
    return [
      { x: 0.5, y: 0, handleIn: { dx: -k, dy: 0 }, handleOut: { dx: k, dy: 0 } },
      { x: 1, y: 0.5, handleIn: { dx: 0, dy: -k }, handleOut: { dx: 0, dy: k } },
      { x: 0.5, y: 1, handleIn: { dx: k, dy: 0 }, handleOut: { dx: -k, dy: 0 } },
      { x: 0, y: 0.5, handleIn: { dx: 0, dy: k }, handleOut: { dx: 0, dy: -k } },
    ]
  })
  const afterEllipse = await cellInfo(cellId, groupId)
  await setClip(cellId, { kind: 'path', anchors: seeded })
  await wait(80)
  await setClip(cellId, { kind: 'rect' })
  await wait(80)
  const backToRect = await cellInfo(cellId, groupId)
  eq(backToRect.clipShape?.kind, 'rect', 'L8: path collapses back to rect')
  eq(backToRect.pastLen, afterEllipse.pastLen + 2, 'L8: path→rect round trip is two entries')

  await undo()
  await wait(80)
  const undone = await cellInfo(cellId, groupId)
  eq(undone.clipShape?.kind, 'path', 'L8: one undo brings the discarded path back')
  eq(undone.clipShape?.anchors?.length, 4, 'L8: …with its anchors intact')
  ok(
    undone.clipShape?.anchors?.every(a => a.x >= 0 && a.x <= 1 && a.y >= 0 && a.y <= 1),
    'L8: seeded anchors are normalized 0–1, not display px',
  )

  await page.evaluate(({ groupId, cellIds }) => {
    const gs = () => window.__canvasStore__.getState()
    while (gs().past.length > 0) gs().undo()
    for (const c of cellIds) gs().removeObject(c)
    gs().removeObject(groupId)
  }, { groupId, cellIds })
  await wait(120)
}

{
  // L10 (#62 Phase C2). A plain dropped image is not a frame — isFrameObject
  // requires a clipShape or isEmpty — so FrameSection is hidden and there was no
  // way to give it a clip at all. AddClipRow makes it qualify by *acquiring* one,
  // rather than by widening the predicate. Remove Clip is the inverse and must
  // clear the whole frame state together.
  const id = await addImage(TEST_IMG_SRC)
  await wait(120)

  const objInfo = (id) => page.evaluate((id) => {
    const s = window.__canvasStore__.getState()
    const o = s.objects[id]
    return {
      clipKind: o?.clipShape?.kind, isEmpty: o?.isEmpty,
      fill: o?.fill, frameStroke: o?.frameStroke, frameStrokeWidth: o?.frameStrokeWidth,
      pastLen: s.past.length,
    }
  }, id)

  const plain = await objInfo(id)
  // The two halves of isFrameObject, asserted directly — the script can't import it.
  ok(plain.clipKind === undefined && plain.isEmpty !== true, 'L10: a plain image is not a frame')

  await page.evaluate((id) => window.__canvasStore__.getState()
    .commitUpdate(id, { clipShape: { kind: 'ellipse' } }), id)
  await wait(80)
  const clipped = await objInfo(id)
  eq(clipped.clipKind, 'ellipse', 'L10: acquiring a clip makes it a frame')
  eq(clipped.pastLen, plain.pastLen + 1, 'L10: adding a clip is one history entry')

  // Give it fill + stroke so Remove Clip has something to strand if it clears
  // only the clip.
  await page.evaluate((id) => window.__canvasStore__.getState().commitUpdate(id, {
    fill: { type: 'solid', color: '#123456' }, frameStroke: '#ff0000', frameStrokeWidth: 3,
  }), id)
  await wait(80)
  const decorated = await objInfo(id)

  await page.evaluate((id) => window.__canvasStore__.getState().commitUpdate(id, {
    clipShape: undefined, fill: undefined, frameStroke: undefined, frameStrokeWidth: undefined,
  }), id)
  await wait(80)
  const stripped = await objInfo(id)
  ok(stripped.clipKind === undefined, 'L10: Remove Clip drops the clip')
  ok(
    stripped.fill === undefined && stripped.frameStroke === undefined && stripped.frameStrokeWidth === undefined,
    'L10: …and the fill/stroke with it, so nothing is stranded behind a hidden panel',
  )
  eq(stripped.pastLen, decorated.pastLen + 1, 'L10: Remove Clip is one history entry')

  await undo()
  await wait(80)
  const restored = await objInfo(id)
  eq(restored.clipKind, 'ellipse', 'L10: one undo restores the clip')
  eq(restored.frameStroke, '#ff0000', 'L10: …and the stroke, in the same step')

  await page.evaluate((id) => {
    const gs = () => window.__canvasStore__.getState()
    while (gs().past.length > 0) gs().undo()
    gs().removeObject(id)
  }, id)
  await wait(120)
}

{
  // L11 (#62 Phase C4). The store-level statement of "a grid cell gets no resize
  // handles": whatever a cell's geometry is, the next relayout overwrites it from
  // the template. That is why offering per-cell resize would be a control that lies.
  const { groupId, cellIds } = await makeGrid()
  const cellId = cellIds[0]

  await page.evaluate((id) => window.__canvasStore__.getState().commitUpdate(id, {
    frameWidth: 17, frameHeight: 17, width: 17, height: 17,
  }), cellId)
  await wait(80)
  const tampered = await page.evaluate((id) =>
    window.__canvasStore__.getState().objects[id].frameWidth, cellId)
  eq(tampered, 17, 'L11: a cell can be written directly (nothing blocks the field)')

  const widths = await page.evaluate(({ groupId }) => {
    const s = window.__canvasStore__.getState()
    const group = s.objects[groupId]
    const box = { x: group.x, y: group.y, width: group.width, height: group.height }
    const patches = window.__computeGridChildPatches__(group, s.objects, box, true)
    s.commitMultipleUpdates(patches)
    const after = window.__canvasStore__.getState().objects
    // Same box in, so the template width is whatever the untouched sibling has.
    return { resized: after[group.childIds[0]].frameWidth, sibling: after[group.childIds[1]].frameWidth }
  }, { groupId })

  eq(widths.resized, widths.sibling, 'L11: relayout restores the template width, discarding the per-cell one')

  await page.evaluate(({ groupId, cellIds }) => {
    const gs = () => window.__canvasStore__.getState()
    while (gs().past.length > 0) gs().undo()
    for (const c of cellIds) gs().removeObject(c)
    gs().removeObject(groupId)
  }, { groupId, cellIds })
  await wait(120)
}

{
  // L12. Deleting a grid deletes its cells. Leaving them behind stranded objects
  // whose parentGroupId pointed at a group that no longer existed — and because a
  // cell only listens while its grid is entered, those orphans were visible debris
  // the user could no longer select or delete. Keeping a cell is what
  // disconnectGridCell is for.
  const { groupId, cellIds } = await makeGrid()
  await fillCell(cellIds[0])
  await wait(120)
  const beforeLen = (await cellInfo(cellIds[0], groupId)).pastLen

  await page.evaluate((id) => window.__canvasStore__.getState().removeObject(id), groupId)
  await wait(120)

  const after = await page.evaluate(({ groupId, cellIds }) => {
    const s = window.__canvasStore__.getState()
    return {
      groupGone: !s.objects[groupId],
      cellsGone: cellIds.every(id => !s.objects[id]),
      orderClean: cellIds.every(id => !s.objectOrder.includes(id)) && !s.objectOrder.includes(groupId),
      vaultKept: cellIds.some(id => s._srcVault.has(id)),
      pastLen: s.past.length,
    }
  }, { groupId, cellIds })

  ok(after.groupGone, 'L12: the grid group is deleted')
  ok(after.cellsGone, 'L12: its cells go with it — no orphans left behind')
  ok(after.orderClean, 'L12: objectOrder has no dangling ids')
  // Opposite of the L2 policy on purpose: a cell swept up by a group delete was
  // never individually targeted, so its src is kept for undo to reinject.
  ok(after.vaultKept, 'L12: swept-up cells KEEP their _srcVault entries (undo needs them)')
  eq(after.pastLen, beforeLen + 1, 'L12: deleting a grid is ONE history entry')

  await undo()
  await wait(120)
  const restored = await page.evaluate(({ groupId, cellIds }) => {
    const s = window.__canvasStore__.getState()
    return {
      groupBack: !!s.objects[groupId],
      cellsBack: cellIds.every(id => !!s.objects[id]),
      mediaBack: s.objects[cellIds[0]]?.src === window.__zsImg__,
    }
  }, { groupId, cellIds })
  ok(restored.groupBack, 'L12: one undo brings the group back')
  ok(restored.cellsBack, 'L12: …and every cell with it')
  ok(restored.mediaBack, 'L12: …with the media reinjected from the vault')

  // removeMultipleObjects must follow the same rule, or box-selecting a grid and
  // pressing delete leaves the same debris.
  await page.evaluate((id) => window.__canvasStore__.getState().removeMultipleObjects([id]), groupId)
  await wait(120)
  const multi = await page.evaluate(({ groupId, cellIds }) => {
    const s = window.__canvasStore__.getState()
    return { groupGone: !s.objects[groupId], cellsGone: cellIds.every(id => !s.objects[id]) }
  }, { groupId, cellIds })
  ok(multi.groupGone && multi.cellsGone, 'L12: removeMultipleObjects deletes a grid whole too')

  await page.evaluate(() => {
    const gs = () => window.__canvasStore__.getState()
    while (gs().past.length > 0) gs().undo()
  })
  await wait(120)
}

// ─── Results ──────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(50))
console.log(`Results: ${passed} passed, ${failed} failed`)
if (failures.length > 0) {
  console.log('\nFailed:')
  failures.forEach(f => console.log(`  ✗ ${f}`))
}

await ss('final')
await app.close()
process.exit(failed > 0 ? 1 : 0)
