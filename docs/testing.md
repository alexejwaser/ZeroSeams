# Testing

The suite is a set of plain Node scripts driving a real Electron build over
Playwright. No test framework — each script keeps its own `passed`/`failed` counters
and exits non-zero on failure.

## Running

```sh
npm test                # build + the two reliable scripts (undo-redo, frames)
npm run test:frames     # rendering + export pixel assertions
npm run test:undo       # history, geometry, media-frame store semantics
```

Individually: `test:video`, `test:axis`, `test:multiselect`, `test:save-path`.

**A build is required first.** Every script launches `out/main/index.js`, so running
against a stale build silently tests the previous version. `npm test` does the build
for you; the individual `test:*` scripts do not.

`npm test` deliberately runs only `test:undo` and `test:frames` — see the launch
note below.

## Two launch patterns

- **CDP** (`test-undo-redo.mjs`, `test-frame-render-export.mjs`) — spawns the Electron
  binary with `--remote-debugging-port`, waits for `DevTools listening` on stderr,
  then `chromium.connectOverCDP()`. This works around a target-detection bug in
  Playwright 1.60 + Electron 42's `_electron.launch()`. **Copy this pattern for new
  scripts.**
- **`_electron.launch()`** (the other four) — hits the bug intermittently, which is
  why they're excluded from `npm test`. `test-save-path.mjs` genuinely needs it: it
  calls `app.evaluate(({ dialog }) => …)` to mock the main-process save dialog, and
  the CDP approach gives no `ElectronApplication` handle.

Each script uses its own debugging port. If a run crashes it can leave Electron
holding the port — `pkill -f "remote-debugging-port=9230"` clears it.

## The `window.__*__` contract

`src/main.tsx` exposes internals for tests. Not dev-gated: the scripts run against a
production build where `import.meta.env.DEV` is false, so a dev gate would gate the
tests out of existence. Keep this list in sync when adding to it.

| global | source | consumer |
|---|---|---|
| `__canvasStore__` | `canvas/useCanvasStore` | every script |
| `__viewportStore__` | `canvas/useViewportStore` | (reserved) |
| `__saveStatusStore__` | `store/useSaveStatusStore` | `test-save-path.mjs` |
| `__getStage__` | `canvas/CarouselStage` | `test-frame-render-export.mjs` |
| `__exportFrames__` / `__exportMixedFrames__` | `canvas/exportFrames` | `test-frame-render-export.mjs` |
| `__videoRegistry__` | `canvas/videoElementRegistry` | `test-frame-render-export.mjs` |
| `__computeGridChildPatches__` | `canvas/gridTemplates` | `test-frame-render-export.mjs` |

The stage is what makes pixel assertions possible: `stage.toCanvas()` returns a real
`HTMLCanvasElement`, so `getImageData` works inside `page.evaluate`. Calling
`exportFrames` directly also skips the folder-dialog IPC, which lives in `Toolbar.tsx`
and is not part of what these tests are checking.

## Pixel assertions (`test-frame-render-export.mjs`)

Exists because the store-level suite would have passed even with the #65 bug, where
media appeared in the layer panel but never painted.

- Image fixtures are built at runtime via `canvas.toDataURL()` — magenta `#ff00ff`,
  chosen to be distinct from the background, `EMPTY_FRAME_FILL`, the clip-anchor
  orange, and the transformer blue. The 10×10 white PNG the other scripts use is
  indistinguishable from a frame that never painted.
- **Every clip case needs an unclipped control.** "Outside the clip is background"
  passes vacuously if the media never painted at all — the control asserts the same
  fractional point *is* media on an unclipped frame, which gives the outside
  assertion discriminating power.
- Never sample within ~5% of a clip boundary (antialiasing).
- Overlay leaks are checked by scanning the whole image for the anchor orange
  `ACCENT` (canvas/constants.ts) and Konva's transformer blue `rgb(0,161,255)`, both unique in the
  palette. An absence proof over the full image beats sampling a few points.
- Exported PNGs are written to `/tmp/zeroseams-frame-render-tests/export-frame-*.png`
  so a human can confirm the silhouette once rather than trusting two sampled pixels.

### Video

`scripts/fixtures/solid-green-1s.mp4` — see `scripts/fixtures/README.md` for the
regeneration command. A committed file is unavoidable: a decodable MP4 can't be
synthesised in page context.

Chromium only presents a decodable frame once `currentTime` has been explicitly
assigned. The working sequence is: wait for `readyState >= 2` via the video registry,
seek to 0.5s (not 0 — the first keyframe is the flakiest), await `seeked`, then
`stage.draw()`. Assert green *dominance*, not an exact colour: the yuv420p round trip
shifts flat colours by ~10 per channel.

`ZS_SKIP_VIDEO_PIXEL=1` downgrades the video pixel assertions to skips while keeping
the structural ones, if the decode ever proves environment-dependent.

`exportMixedFrames`' ffmpeg.wasm encode is **out of scope** — it needs
`crossOriginIsolated` + `SharedArrayBuffer` and takes tens of seconds. Video coverage
is instead that `exportFrames` rasterises the video's pixels correctly (it's
format-agnostic) plus a unit test of the `videoObjectsInFrame` routing helper.

## Asserting click routing

Konva nodes carry stable names so hit-testing can be asserted without synthesising
pointer events: `grid-hit` on a grid group's hit rect, `frame-rect-<id>` on an
image/video frame's rect. `__zs.intersectionNames(points)` normalises the stage to
1:1 (like `sampleStage`) and returns `stage.getIntersection()?.name()` per point.

This is what covers the rule that exactly one of {a grid's hit rect, its cells}
listens at a time — a pixel test can't see it, because listening changes nothing
about what paints.
