/**
 * E2E tests for the unified media-insertion paths and GH #84.
 *
 *   A. Frame math + placement — the frame-0 hardcode the toolbar used to have.
 *   B. Object builders — field completeness, since four drifted copies is what
 *      buildImageObject/buildVideoObject replaced.
 *   C. Clipboard — copy/cut/paste of canvas objects, group remapping, undo.
 *   D. #84 — a video thumbnail must stop showing the placeholder WITHOUT any
 *      history commit. The control (a placeholder present first) matters: without
 *      it the assertion passes vacuously on an already-correct thumbnail.
 *
 * Run: node scripts/test-media-insertion.mjs
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
const FIXTURE_VIDEO = path.join(ROOT, 'scripts/fixtures/solid-green-1s.mp4')
const CDP_PORT = 9231
const SHOTS = '/tmp/zeroseams-media-tests'
fs.mkdirSync(SHOTS, { recursive: true })

let passed = 0, failed = 0
const failures = []
function ok(cond, msg) {
  if (cond) { console.log(`  ✓ ${msg}`); passed++ }
  else { console.log(`  ✗ ${msg}`); failed++; failures.push(msg) }
}
function eq(a, b, msg) {
  const pass = JSON.stringify(a) === JSON.stringify(b)
  ok(pass, pass ? msg : `${msg} — got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`)
}

// ─── Launch via CDP (electron.launch + Playwright/Electron 42 target-detection bug) ──
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
await new Promise(r => setTimeout(r, 3000))

const browser = await chromium.connectOverCDP(`http://localhost:${CDP_PORT}`)
const page = browser.contexts()[0].pages()[0]
page.on('console', m => { if (m.type() === 'error') console.error(`  [renderer error] ${m.text()}`) })

const wait = (ms) => new Promise(r => setTimeout(r, ms))
const ss = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` }).then(() => console.log(`    📸 ${n}`))

async function cleanup() {
  await browser.close()
  await terminateElectron(electronProc)
}

try {
  await page.waitForSelector('canvas', { timeout: 12_000 })
  await wait(1500)

  // Fresh canvas with a known frame count for the frame-index assertions.
  await page.evaluate(() => {
    const s = window.__canvasStore__.getState()
    s.setFrameCount(4)
    for (const id of [...s.objectOrder]) s.removeObject(id)
  })
  await wait(300)

  // ── A. Frame math + placement ───────────────────────────────────────────────
  console.log('\n── A. Frame math & placement ──')
  {
    const r = await page.evaluate(() => {
      const mp = window.__mediaPlacement__
      const { frameWidth, frameHeight, frameCount } = window.__canvasStore__.getState()
      return {
        frameWidth, frameHeight, frameCount,
        atZero: mp.frameIndexAt(10),
        atTwo: mp.frameIndexAt(frameWidth * 2 + 5),
        // Exact right edge of frame 1 belongs to frame 2 (half-open interval).
        atBoundary: mp.frameIndexAt(frameWidth * 2),
        clampedLow: mp.frameIndexAt(-9999),
        clampedHigh: mp.frameIndexAt(frameWidth * 999),
        centerOfTwo: mp.frameCenter(2),
      }
    })
    eq(r.atZero, 0, 'frameIndexAt: x inside frame 0')
    eq(r.atTwo, 2, 'frameIndexAt: x inside frame 2')
    eq(r.atBoundary, 2, 'frameIndexAt: exact boundary belongs to the right-hand frame')
    eq(r.clampedLow, 0, 'frameIndexAt: negative x clamps to frame 0')
    eq(r.clampedHigh, r.frameCount - 1, 'frameIndexAt: x past the end clamps to the last frame')
    eq(r.centerOfTwo, { x: 2.5 * r.frameWidth, y: r.frameHeight / 2 }, 'frameCenter: centre of frame 2')
  }

  {
    // The frame-0 bug: with the cursor last over frame 3, a toolbar-initiated add
    // must land in frame 3, not frame 0.
    const r = await page.evaluate(() => {
      const mp = window.__mediaPlacement__
      const { frameWidth } = window.__canvasStore__.getState()
      mp.setLastPointer(frameWidth * 3 + 100, 200)
      const p = mp.defaultDropPoint()
      return { index: mp.frameIndexAt(p.x), point: p }
    })
    eq(r.index, 3, 'defaultDropPoint: honours the last cursor position (not frame 0)')
    eq(r.point, { x: r.point.x, y: 200 }, 'defaultDropPoint: returns the pointer verbatim')
  }

  // ── B. Object builders ──────────────────────────────────────────────────────
  console.log('\n── B. Object builders ──')
  {
    const r = await page.evaluate(() => {
      const mp = window.__mediaPlacement__
      // 1600x800 → longest edge fits into 600 → 600x300, centred on (1000, 500).
      const img = mp.buildImageObject({
        src: 'data:image/png;base64,x', naturalWidth: 1600, naturalHeight: 800,
        name: 'shot', at: { x: 1000, y: 500 },
      })
      const staggered = mp.buildImageObject({
        src: 'data:image/png;base64,x', naturalWidth: 1600, naturalHeight: 800,
        at: { x: 1000, y: 500 }, index: 2,
      })
      const vid = mp.buildVideoObject({
        filePath: '/tmp/x.mp4', naturalWidth: 400, naturalHeight: 400,
        naturalDuration: 3, name: 'clip', at: { x: 0, y: 0 },
      })
      return { img, staggered, vid, fit: mp.fitMediaBox(1600, 800) }
    })

    eq(r.fit, { w: 600, h: 300 }, 'fitMediaBox: scales the longest edge to 600')
    eq({ w: r.img.frameWidth, h: r.img.frameHeight }, { w: 600, h: 300 }, 'image: frame box is the fitted size')
    eq({ x: r.img.frameX, y: r.img.frameY }, { x: 700, y: 350 }, 'image: centred on the drop point')
    eq({ x: r.img.x, y: r.img.y }, { x: r.img.frameX, y: r.img.frameY }, 'image: x/y mirror frameX/frameY')
    eq({ w: r.img.width, h: r.img.height }, { w: 600, h: 300 }, 'image: width/height mirror the frame box')
    eq({ w: r.img.contentWidth, h: r.img.contentHeight }, { w: 600, h: 300 }, 'image: content fills the frame')
    eq({ nw: r.img.naturalWidth, nh: r.img.naturalHeight }, { nw: 1600, nh: 800 }, 'image: natural dims are the source bitmap')
    ok(r.img.contentOffsetX === 0 && r.img.contentOffsetY === 0, 'image: content offset starts at 0')
    ok(r.img.contentEditMode === false, 'image: does not open in content-edit mode')
    ok(r.img.visible === true && r.img.locked === false, 'image: visible and unlocked')
    ok(typeof r.img.id === 'string' && r.img.id.length > 0, 'image: gets an id')
    eq(r.img.name, 'shot', 'image: keeps the given name')

    eq(
      { x: r.staggered.frameX - r.img.frameX, y: r.staggered.frameY - r.img.frameY },
      { x: 60, y: 60 },
      'image: index 2 staggers by 2×30px so a multi-file drop does not stack',
    )

    eq({ w: r.vid.frameWidth, h: r.vid.frameHeight }, { w: 400, h: 400 }, 'video: no upscaling below the 600 cap')
    eq(r.vid.naturalDuration, 3, 'video: duration is carried through')
    eq(r.vid.filePath, '/tmp/x.mp4', 'video: filePath is carried through')
    ok(r.vid.muted === false, 'video: starts unmuted')
    ok(!('relativeFilePath' in r.vid) || r.vid.relativeFilePath === undefined,
      'video: relativeFilePath left for save-time relativization')
    eq({ x: r.vid.x, y: r.vid.y }, { x: r.vid.frameX, y: r.vid.frameY }, 'video: x/y mirror frameX/frameY')
  }

  // ── C. Clipboard ────────────────────────────────────────────────────────────
  console.log('\n── C. Clipboard ──')
  await page.evaluate(() => {
    const s = window.__canvasStore__.getState()
    for (const id of [...s.objectOrder]) s.removeObject(id)
  })
  await wait(200)

  {
    const r = await page.evaluate(() => {
      const store = window.__canvasStore__
      const clip = window.__objectClipboard__
      const mk = (id, x, y) => ({
        id, type: 'shape', kind: 'rect', scope: 'global',
        x, y, width: 100, height: 100, rotation: 0, scaleX: 1, scaleY: 1,
        opacity: 1, visible: true, locked: false, zIndex: 0, fill: '#ff0000',
      })
      store.getState().addObject(mk('a', 0, 0))
      store.getState().addObject(mk('b', 200, 0))
      store.getState().setSelected('a')
      store.getState().addToSelection('b')

      const copied = clip.copyObjects()
      const pastBefore = store.getState().past.length
      store.getState().pasteObjects(clip.getObjectClipboard(), { x: 1000, y: 1000 })
      const s = store.getState()
      const newIds = s.objectOrder.filter((id) => id !== 'a' && id !== 'b')
      const bboxes = newIds.map((id) => {
        const o = s.objects[id]
        return { x: o.x, y: o.y, w: o.width, h: o.height }
      })
      return {
        copied,
        historyDelta: s.past.length - pastBefore,
        count: newIds.length,
        newIds,
        bboxes,
        selectedIds: s.selectedIds,
        sourcesIntact: !!s.objects['a'] && !!s.objects['b'],
      }
    })
    ok(r.copied === true, 'copyObjects: reports it captured a selection')
    eq(r.count, 2, 'paste: inserts both copied objects')
    eq(r.historyDelta, 1, 'paste: is exactly ONE history entry for the whole set')
    ok(!r.newIds.includes('a') && !r.newIds.includes('b'), 'paste: pasted objects get fresh ids')
    ok(r.sourcesIntact, 'paste: leaves the source objects alone')
    eq(r.selectedIds.length, 2, 'paste: the pasted set becomes the selection')
    // Source bbox spans x 0..300, centre 150. Pasted centre must be 1000.
    {
      const minX = Math.min(...r.bboxes.map(b => b.x))
      const maxX = Math.max(...r.bboxes.map(b => b.x + b.w))
      eq((minX + maxX) / 2, 1000, 'paste: the set is centred on the target point')
      eq(maxX - minX, 300, 'paste: internal arrangement is preserved')
    }
  }

  {
    // One undo must remove the whole paste, not one object at a time.
    const r = await page.evaluate(() => {
      const store = window.__canvasStore__
      store.getState().undo()
      const s = store.getState()
      return { count: s.objectOrder.length, hasSources: !!s.objects['a'] && !!s.objects['b'] }
    })
    eq(r.count, 2, 'undo: one step removes the entire paste')
    ok(r.hasSources, 'undo: the sources survive')
  }

  {
    // Cut removes; undo brings back. The clipboard must SURVIVE the undo —
    // that is the reason it lives outside the store.
    const r = await page.evaluate(() => {
      const store = window.__canvasStore__
      const clip = window.__objectClipboard__
      store.getState().setSelected('a')
      store.getState().setSelectedIds?.(['a'])
      clip.cutObjects(['a'])
      const afterCut = !!store.getState().objects['a']
      store.getState().undo()
      return {
        afterCut,
        restored: !!store.getState().objects['a'],
        clipboardSurvivedUndo: clip.hasObjectClipboard(),
      }
    })
    ok(r.afterCut === false, 'cut: removes the object')
    ok(r.restored, 'cut: undo restores it')
    ok(r.clipboardSurvivedUndo, 'cut: the clipboard survives the undo (it is outside history)')
  }

  {
    // A copied grid must bring its cells, or the paste makes a group whose
    // childIds point at nothing.
    const r = await page.evaluate(async () => {
      const store = window.__canvasStore__
      const clip = window.__objectClipboard__
      const s0 = store.getState()
      for (const id of [...s0.objectOrder]) s0.removeObject(id)
      // Group + cells built by hand: the assertion is about id remapping on
      // paste, not about grid layout (gridTemplates has its own coverage).
      const groupId = 'g1', c1 = 'c1', c2 = 'c2'
      const cell = (id) => ({
        id, type: 'shape', kind: 'rect', scope: 'global', parentGroupId: groupId,
        x: 0, y: 0, width: 50, height: 50, rotation: 0, scaleX: 1, scaleY: 1,
        opacity: 1, visible: true, locked: false, zIndex: 0, fill: '#00ff00',
      })
      store.getState().addObject({
        id: groupId, type: 'group', childIds: [c1, c2], isGrid: true,
        scope: 'global', x: 0, y: 0, width: 100, height: 50,
        rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, locked: false, zIndex: 0,
      })
      store.getState().addObject(cell(c1))
      store.getState().addObject(cell(c2))

      clip.copyObjects([groupId])
      const captured = clip.getObjectClipboard().length
      store.getState().pasteObjects(clip.getObjectClipboard(), { x: 500, y: 500 })
      const s = store.getState()
      const newGroup = s.objectOrder
        .map((id) => s.objects[id])
        .find((o) => o.type === 'group' && o.id !== groupId)
      return {
        captured,
        childIds: newGroup?.childIds ?? [],
        childrenExist: (newGroup?.childIds ?? []).every((id) => !!s.objects[id]),
        childrenPointBack: (newGroup?.childIds ?? [])
          .every((id) => s.objects[id]?.parentGroupId === newGroup.id),
        reusedOldIds: (newGroup?.childIds ?? []).some((id) => id === c1 || id === c2),
      }
    })
    eq(r.captured, 3, 'copy: a group brings its cells (group + 2 cells)')
    eq(r.childIds.length, 2, 'paste: the pasted group keeps two children')
    ok(r.childrenExist, 'paste: every childId resolves to a real object — no dangling ids')
    ok(r.childrenPointBack, 'paste: cells point back at the NEW group')
    ok(!r.reusedOldIds, 'paste: childIds were remapped, not copied verbatim')
  }

  // ── D. #84 — video thumbnail without a history commit ───────────────────────
  console.log('\n── D. #84: video thumbnail refreshes without a history commit ──')
  {
    await page.evaluate(() => {
      const s = window.__canvasStore__.getState()
      for (const id of [...s.objectOrder]) s.removeObject(id)
    })
    await wait(200)

    const vidId = await page.evaluate((filePath) => {
      const mp = window.__mediaPlacement__
      const obj = mp.buildVideoObject({
        filePath, naturalWidth: 320, naturalHeight: 240,
        naturalDuration: 1, name: 'fixture', at: { x: 400, y: 400 },
      })
      window.__canvasStore__.getState().addObject(obj)
      return obj.id
    }, FIXTURE_VIDEO)

    // Counts the fixture's green pixels in a thumbnail data URL. The fixture is
    // solid green; the #84 placeholder is a #3a3a3a plate with a white glyph, so
    // "has green" is exactly "shows a decoded video frame".
    const greenPixels = (dataUrl) => page.evaluate(async (url) => {
      if (!url) return -1
      const img = new Image()
      img.src = url
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.width; c.height = img.height
      const ctx = c.getContext('2d')
      ctx.drawImage(img, 0, 0)
      const d = ctx.getImageData(0, 0, c.width, c.height).data
      let green = 0
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] > 0 && d[i + 1] > 100 && d[i] < 100 && d[i + 2] < 100) green++
      }
      return green
    }, dataUrl)

    const pastAtAdd = await page.evaluate(() => window.__canvasStore__.getState().past.length)

    // Wait for decode. Crucially, nothing here commits history — under the old
    // `past.length`-only sweep the row would keep the placeholder forever.
    let settled = null
    for (let i = 0; i < 40; i++) {
      await wait(250)
      settled = await page.evaluate((id) => ({
        thumb: window.__thumbnailStore__.getState().thumbnails[id] ?? null,
        past: window.__canvasStore__.getState().past.length,
        decoded: (() => {
          const el = window.__videoRegistry__.get(id)
          return !!el && el.readyState >= 2 && el.videoWidth > 0
        })(),
      }), vidId)
      if (settled.decoded && (await greenPixels(settled.thumb)) > 0) break
    }

    ok(settled.decoded, 'the fixture video actually decoded (guards a vacuous pass)')
    eq(settled.past, pastAtAdd, 'no history commit happened while the video decoded')
    ok((await greenPixels(settled.thumb)) > 0,
      'the layer thumbnail shows decoded video pixels, reached WITHOUT a history commit (#84)')

    // The mechanism itself, without the decode race: stomp the thumbnail with a
    // known-wrong bitmap, then prove regenerate(id) alone repairs it — no dirty
    // marking by the caller, no history entry, no full sweep.
    {
      const before = await page.evaluate((id) => {
        // 1×1 transparent PNG — definitively not a video frame.
        window.__thumbnailStore__.getState().setThumbnail(id, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==')
        return {
          // Re-read: the state object captured before the set is a stale snapshot.
          thumb: window.__thumbnailStore__.getState().thumbnails[id],
          past: window.__canvasStore__.getState().past.length,
        }
      }, vidId)
      ok((await greenPixels(before.thumb)) === 0, 'control: the thumbnail was stomped to a non-video bitmap')

      await page.evaluate((id) => { window.__thumbnailStore__.getState().regenerate(id) }, vidId)
      let after = null
      for (let i = 0; i < 20; i++) {
        await wait(150)
        after = await page.evaluate((id) => ({
          thumb: window.__thumbnailStore__.getState().thumbnails[id] ?? null,
          past: window.__canvasStore__.getState().past.length,
        }), vidId)
        if ((await greenPixels(after.thumb)) > 0) break
      }
      ok((await greenPixels(after.thumb)) > 0, 'regenerate(id) alone repaints the row from the live element')
      eq(after.past, before.past, 'regenerate(id) pushes no history entry')
    }

    await ss('video-thumbnail')
  }

  console.log('\n──────────────────────────────────────────────────')
  console.log(`Results: ${passed} passed, ${failed} failed`)
  if (failures.length > 0) {
    console.log('\nFailed:')
    for (const f of failures) console.log(`  ✗ ${f}`)
  }
} finally {
  await cleanup()
}

process.exit(failed > 0 ? 1 : 0)
