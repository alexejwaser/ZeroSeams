/**
 * Tests for the video layer feature (GH issue #13, sprint 1).
 *
 * Two sections:
 *   Part 1 — Pure unit tests for pathUtils (relativize / resolve).
 *             Runs entirely in Node, no Electron required.
 *   Part 2 — Playwright/Electron E2E tests for VideoObject in the canvas store:
 *             add, mute toggle, undo/redo, serialization round-trip.
 *
 * Run: node scripts/test-video.mjs
 * Requires: npm run build first
 */
import { _electron as electron } from 'playwright'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import os from 'node:os'

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..')
const ELECTRON_BIN = path.join(ROOT, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron')
const SHOTS = '/tmp/zeroseams-video-tests'
fs.mkdirSync(SHOTS, { recursive: true })

// ─── Test runner ─────────────────────────────────────────────────────────────
let passed = 0, failed = 0
const failures = []

function ok(cond, msg) {
  if (cond) { console.log(`  ✓ ${msg}`); passed++ }
  else       { console.log(`  ✗ ${msg}`); failed++; failures.push(msg) }
}
function eq(a, b, msg) {
  const pass = JSON.stringify(a) === JSON.stringify(b)
  ok(pass, pass ? msg : `${msg} — got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`)
}

// ─── Part 1: pathUtils unit tests (pure Node, no Electron) ───────────────────
console.log('═══ Part 1: pathUtils unit tests ═══\n')

// Inline the same logic as src/canvas/pathUtils.ts so we can test without a build
function posixDirname(filePath) {
  const idx = filePath.lastIndexOf('/')
  return idx > 0 ? filePath.slice(0, idx) : '/'
}
function posixRelative(fromDir, toPath) {
  const from = fromDir.split('/').filter(Boolean)
  const to   = toPath.split('/').filter(Boolean)
  let i = 0
  while (i < from.length && i < to.length && from[i] === to[i]) i++
  return [...from.slice(i).map(() => '..'), ...to.slice(i)].join('/')
}
function posixResolve(dir, rel) {
  const parts = dir.split('/').filter(Boolean)
  for (const seg of rel.split('/')) {
    if (seg === '..') parts.pop()
    else if (seg !== '.') parts.push(seg)
  }
  return '/' + parts.join('/')
}
function relativizeVideoObjects(objects, projectFilePath) {
  if (!projectFilePath) return objects
  const dir = posixDirname(projectFilePath)
  const result = {}
  for (const [id, obj] of Object.entries(objects)) {
    if (obj.type === 'video') {
      result[id] = { ...obj, relativeFilePath: posixRelative(dir, obj.filePath) }
    } else {
      result[id] = obj
    }
  }
  return result
}
function resolveVideoObjects(objects, projectFilePath) {
  const dir = posixDirname(projectFilePath)
  const result = {}
  for (const [id, obj] of Object.entries(objects)) {
    if (obj.type === 'video') {
      const filePath = obj.relativeFilePath
        ? posixResolve(dir, obj.relativeFilePath)
        : obj.filePath
      result[id] = { ...obj, filePath }
    } else {
      result[id] = obj
    }
  }
  return result
}

console.log('── posixDirname ──')
eq(posixDirname('/Users/alice/Documents/proj.zeroseams'), '/Users/alice/Documents', 'dirname of file in subdir')
eq(posixDirname('/Users/alice/proj.zeroseams'), '/Users/alice', 'dirname of file at home')
eq(posixDirname('/proj.zeroseams'), '/', 'dirname of root-level file')

console.log('\n── posixRelative ──')
eq(
  posixRelative('/Users/alice/Documents/ZeroSeams', '/Users/alice/Videos/clip.mp4'),
  '../../Videos/clip.mp4',
  'relative path: sibling directory tree',
)
eq(
  posixRelative('/Users/alice/Documents/ZeroSeams', '/Users/alice/Documents/ZeroSeams/clip.mp4'),
  'clip.mp4',
  'relative path: file in same directory',
)
eq(
  posixRelative('/Users/alice/Documents/ZeroSeams', '/Users/alice/Documents/ZeroSeams/assets/clip.mp4'),
  'assets/clip.mp4',
  'relative path: file in sub-directory',
)

console.log('\n── posixResolve ──')
eq(
  posixResolve('/Users/alice/Documents/ZeroSeams', '../../Videos/clip.mp4'),
  '/Users/alice/Videos/clip.mp4',
  'resolve: dotdot traversal',
)
eq(
  posixResolve('/Users/alice/Documents/ZeroSeams', 'clip.mp4'),
  '/Users/alice/Documents/ZeroSeams/clip.mp4',
  'resolve: same-dir relative',
)
eq(
  posixResolve('/Users/alice/Documents/ZeroSeams', 'assets/clip.mp4'),
  '/Users/alice/Documents/ZeroSeams/assets/clip.mp4',
  'resolve: sub-dir relative',
)

console.log('\n── round-trip: relativize → resolve ──')
{
  const projectPath = '/Users/alice/Documents/ZeroSeams/project.zeroseams'
  const videoPath = '/Users/alice/Videos/my-clip.mp4'
  const objects = {
    'vid1': { type: 'video', id: 'vid1', filePath: videoPath, muted: false },
    'img1': { type: 'image', id: 'img1', src: 'data:...' },
  }
  const saved = relativizeVideoObjects(objects, projectPath)
  ok(saved['vid1'].relativeFilePath === '../../Videos/my-clip.mp4', `relativeFilePath set correctly (got: ${saved['vid1'].relativeFilePath})`)
  ok(saved['img1'].src === 'data:...', 'image objects untouched by relativize')

  const loaded = resolveVideoObjects(saved, projectPath)
  ok(loaded['vid1'].filePath === videoPath, `filePath resolved back to absolute (got: ${loaded['vid1'].filePath})`)
  ok(loaded['img1'].src === 'data:...', 'image objects untouched by resolve')
}

{
  // No project file path — objects returned unchanged
  const objects = { 'vid1': { type: 'video', id: 'vid1', filePath: '/some/path.mp4' } }
  const result = relativizeVideoObjects(objects, null)
  ok(!result['vid1'].relativeFilePath, 'relativize is a no-op when projectFilePath is null')
}

{
  // VideoObject with no relativeFilePath falls back to filePath
  const objects = { 'vid1': { type: 'video', id: 'vid1', filePath: '/original/path.mp4' } }
  const result = resolveVideoObjects(objects, '/some/project.zeroseams')
  ok(result['vid1'].filePath === '/original/path.mp4', 'resolve falls back to filePath when relativeFilePath is absent')
}

// ─── Part 2: Playwright/Electron E2E tests ───────────────────────────────────
console.log('\n\n═══ Part 2: Playwright/Electron E2E tests ═══\n')

console.log('Launching app…')
const app = await electron.launch({
  executablePath: ELECTRON_BIN,
  args: [path.join(ROOT, 'out/main/index.js')],
  timeout: 30_000,
})
const page = app.windows().find(w => !w.url().startsWith('devtools://')) ?? await app.firstWindow()
const errors = []
page.on('console', m => {
  if (m.type() === 'error') errors.push(m.text())
})

const ss   = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` }).then(() => console.log(`    📸 ${n}`))
const wait = (ms) => new Promise(r => setTimeout(r, ms))

await page.waitForSelector('canvas', { timeout: 15_000 })
await wait(1500)

const storeReady = await page.evaluate(() => typeof window.__canvasStore__ !== 'undefined')
if (!storeReady) {
  console.error('FATAL: __canvasStore__ not exposed. Did you build with store exposure?')
  await app.close()
  process.exit(1)
}
console.log('✓ Store exposed\n')

// Helpers
const getState = () => page.evaluate(() => {
  const s = window.__canvasStore__.getState()
  return {
    objects: s.objects,
    objectOrder: s.objectOrder,
    past: s.past.length,
    future: s.future.length,
  }
})

const makeVideoObject = (overrides = {}) => ({
  id: 'test-vid-1',
  type: 'video',
  scope: 'global',
  name: 'test-clip',
  filePath: '/tmp/test-clip.mp4',
  relativeFilePath: undefined,
  muted: false,
  naturalWidth: 1920,
  naturalHeight: 1080,
  naturalDuration: 5,
  frameX: 100,
  frameY: 100,
  frameWidth: 400,
  frameHeight: 225,
  contentOffsetX: 0,
  contentOffsetY: 0,
  contentWidth: 400,
  contentHeight: 225,
  contentEditMode: false,
  x: 100, y: 100, width: 400, height: 225,
  rotation: 0, scaleX: 1, scaleY: 1,
  opacity: 1, visible: true, locked: false, zIndex: 0,
  ...overrides,
})

// ── Scenario 1: VideoObject type is accepted by addObject ────────────────────
console.log('── Scenario 1: addObject accepts VideoObject ──')
{
  // Clear any objects first
  await page.evaluate(() => {
    const s = window.__canvasStore__.getState()
    // Reset to clean state by loading a minimal project
    s.loadProject({
      id: 'test', name: 'test', platform: 'instagram', ratio: '1:1',
      dimensions: { width: 1080, height: 1080 }, frameCount: 3,
      frames: [], backgroundColor: '#ffffff',
      objects: {}, objectOrder: [],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 1,
    })
  })

  const vidObj = makeVideoObject()
  await page.evaluate((obj) => {
    window.__canvasStore__.getState().addObject(obj)
  }, vidObj)

  const state = await getState()
  ok(state.objectOrder.includes('test-vid-1'), 'VideoObject id appears in objectOrder')
  ok(state.objects['test-vid-1'] !== undefined, 'VideoObject stored in objects map')
  ok(state.objects['test-vid-1'].type === 'video', 'object has type "video"')
  ok(state.objects['test-vid-1'].naturalDuration === 5, 'naturalDuration preserved')
  ok(state.objects['test-vid-1'].muted === false, 'muted starts false')
  ok(state.past > 0, 'addObject pushed undo history entry')
  await ss('scenario1-add-video')
}

// ── Scenario 2: Mute toggle via commitUpdate ─────────────────────────────────
console.log('\n── Scenario 2: Mute toggle via commitUpdate ──')
{
  const before = await getState()
  const historyBefore = before.past

  await page.evaluate(() => {
    window.__canvasStore__.getState().commitUpdate('test-vid-1', { muted: true })
  })

  const state = await getState()
  ok(state.objects['test-vid-1'].muted === true, 'muted toggled to true via commitUpdate')
  ok(state.past > historyBefore, 'mute toggle pushed undo history entry')
  await ss('scenario2-mute-toggle')
}

// ── Scenario 3: Undo mute toggle ─────────────────────────────────────────────
console.log('\n── Scenario 3: Undo restores muted=false ──')
{
  await page.evaluate(() => window.__canvasStore__.getState().undo())
  const state = await getState()
  ok(state.objects['test-vid-1'] !== undefined, 'VideoObject still exists after undo')
  ok(state.objects['test-vid-1'].muted === false, 'undo restored muted=false')
  await ss('scenario3-undo-mute')
}

// ── Scenario 4: Undo addObject removes VideoObject ───────────────────────────
console.log('\n── Scenario 4: Undo addObject removes VideoObject ──')
{
  await page.evaluate(() => window.__canvasStore__.getState().undo())
  const state = await getState()
  ok(!state.objectOrder.includes('test-vid-1'), 'VideoObject removed from objectOrder after undo')
  ok(state.objects['test-vid-1'] === undefined, 'VideoObject removed from objects map after undo')
  ok(state.future > 0, 'future has entries (redo available)')
  await ss('scenario4-undo-add')
}

// ── Scenario 5: Redo restores VideoObject ────────────────────────────────────
console.log('\n── Scenario 5: Redo restores VideoObject ──')
{
  await page.evaluate(() => window.__canvasStore__.getState().redo())
  const state = await getState()
  ok(state.objectOrder.includes('test-vid-1'), 'VideoObject back in objectOrder after redo')
  ok(state.objects['test-vid-1'].type === 'video', 'redo restores correct type')
  ok(state.objects['test-vid-1'].filePath === '/tmp/test-clip.mp4', 'redo restores filePath')
  await ss('scenario5-redo-add')
}

// ── Scenario 6: VideoObject selection ────────────────────────────────────────
console.log('\n── Scenario 6: setSelected works on VideoObject ──')
{
  await page.evaluate(() => {
    window.__canvasStore__.getState().setSelected('test-vid-1')
  })
  const selectedId = await page.evaluate(() => window.__canvasStore__.getState().selectedId)
  ok(selectedId === 'test-vid-1', 'VideoObject can be selected')
  await ss('scenario6-select-video')
}

// ── Scenario 7: contentEditMode toggle ───────────────────────────────────────
console.log('\n── Scenario 7: contentEditMode toggle ──')
{
  await page.evaluate(() => {
    window.__canvasStore__.getState().updateObject('test-vid-1', { contentEditMode: true })
  })
  const state = await getState()
  ok(state.objects['test-vid-1'].contentEditMode === true, 'contentEditMode can be set to true')
}

// ── Scenario 8: VideoObject visibility toggle ─────────────────────────────────
console.log('\n── Scenario 8: visibility toggle ──')
{
  await page.evaluate(() => {
    window.__canvasStore__.getState().commitUpdate('test-vid-1', { visible: false })
  })
  const state = await getState()
  ok(state.objects['test-vid-1'].visible === false, 'visible can be set to false')

  await page.evaluate(() => {
    window.__canvasStore__.getState().commitUpdate('test-vid-1', { visible: true })
  })
  const stateAfter = await getState()
  ok(stateAfter.objects['test-vid-1'].visible === true, 'visible restored to true')
}

// ── Scenario 9: Multiple VideoObjects coexist ────────────────────────────────
console.log('\n── Scenario 9: Multiple VideoObjects coexist ──')
{
  const vid2 = makeVideoObject({ id: 'test-vid-2', filePath: '/tmp/clip2.mp4', zIndex: 1 })
  await page.evaluate((obj) => {
    window.__canvasStore__.getState().addObject(obj)
  }, vid2)

  const state = await getState()
  ok(state.objectOrder.includes('test-vid-1') && state.objectOrder.includes('test-vid-2'),
    'both video objects in objectOrder')
  ok(state.objects['test-vid-1'].type === 'video' && state.objects['test-vid-2'].type === 'video',
    'both have type "video"')
  await ss('scenario9-two-videos')
}

// ── Scenario 10: removeObject works for VideoObject ─────────────────────────
console.log('\n── Scenario 10: removeObject removes VideoObject ──')
{
  await page.evaluate(() => {
    window.__canvasStore__.getState().removeObject('test-vid-2')
  })
  const state = await getState()
  ok(!state.objectOrder.includes('test-vid-2'), 'test-vid-2 removed from objectOrder')
  ok(state.objects['test-vid-2'] === undefined, 'test-vid-2 removed from objects map')
  ok(state.objectOrder.includes('test-vid-1'), 'test-vid-1 untouched')
  await ss('scenario10-remove-video')
}

// ── Scenario 11: No renderer errors throughout tests ─────────────────────────
console.log('\n── Scenario 11: No renderer errors ──')
{
  // Exclude video load errors — those are expected for fake paths used in earlier
  // scenarios (/tmp/test-clip.mp4 etc). The protocol integration is tested in Scenario 6.
  const nonProtocolErrors = errors.filter(e =>
    !e.includes('[CanvasVideoNode] video load error') &&
    (e.includes('Video') || e.includes('Cannot read') || e.includes('undefined'))
  )
  ok(nonProtocolErrors.length === 0,
    nonProtocolErrors.length === 0
      ? 'no renderer errors during video tests'
      : `renderer errors: ${nonProtocolErrors.slice(0, 3).join(' | ')}`
  )
}

// ── Scenario 6: video renders on canvas (protocol integration) ───────────────
console.log('── Scenario 6: video renders on canvas (protocol integration) ──')
{
  const testVideoPath = path.resolve(ROOT, 'testvideo.mp4')
  const videoObj = makeVideoObject({
    id: 'test-vid-render',
    name: 'render-test',
    filePath: testVideoPath,
    naturalWidth: 1920, naturalHeight: 1080,
    frameWidth: 540, frameHeight: 304,
    contentWidth: 540, contentHeight: 304,
    width: 540, height: 304,
  })
  const errorsBeforeScenario6 = errors.length
  await page.evaluate((obj) => {
    window.__canvasStore__.getState().addObject(obj)
    window.__canvasStore__.getState().setSelected(obj.id)
  }, videoObj)
  await wait(2500)
  await ss('scenario6-video-on-canvas')

  const state = await getState()
  const vid = state.objects['test-vid-render']
  ok(vid && vid.type === 'video', 'VideoObject present in store')
  ok(vid && vid.visible === true, 'VideoObject is visible')

  // Only check errors that appeared during this scenario (not fake-path errors from earlier scenarios)
  const newVideoErrors = errors.slice(errorsBeforeScenario6).filter(e => e.includes('[CanvasVideoNode] video load error'))
  ok(newVideoErrors.length === 0, `no video load errors for testvideo.mp4 (found: ${newVideoErrors.join('; ')})`)

  // Clean up
  await page.evaluate(() => {
    window.__canvasStore__.getState().removeObject('test-vid-render')
  })
}

// ─── Results ─────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`)
console.log(`Results: ${passed} passed, ${failed} failed`)
if (failures.length > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  ✗ ${f}`)
}

await app.close()
process.exit(failed > 0 ? 1 : 0)
