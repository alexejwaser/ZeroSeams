# Zero Seams — AI Dev Guide

## MANDATORY: Query the graph before reading files
```
graphify query "<question>"        # BFS traversal, instant
graphify path "<A>" "<B>"          # relationship between two nodes
graphify explain "<concept>"       # focused concept deep-dive
graphify update .                  # after any code change (AST-only, ~1.5s, no API cost)
```
Only fall back to reading source files when the graph answer is incomplete or you need exact line-level detail.

**Run `update` from the repo root with `.`, never `./src`.** The path argument is the project root, so `graphify update ./src` builds a second, smaller, code-only graph into `src/graphify-out/` — while `graphify query` reads `./graphify-out/graph.json`. That's how the queried graph went stale for a month. `update` merges into the existing graph, so the `document`/`concept`/`rationale` nodes extracted from CLAUDE.md survive an AST-only rebuild; re-ingesting *changed* docs still needs the `/graphify` skill (LLM-backed).

`npm run typecheck` checks both tsconfig projects (web + node) — the root tsconfig is references-only (`files: []`), so never run bare `tsc -p tsconfig.json`; it validates nothing. Keep both projects at zero errors.

`npm test` builds, then runs the history suite and the render/export pixel suite. See `docs/testing.md` — it covers the `window.__*__` test-exposure contract, why new scripts must use the CDP launch pattern, and the video-decode sequence.

**God nodes — touch carefully:**
- `useCanvasStore` (45+ edges) — owns all canvas state
- `buildFilterPipeline` (18 edges) — called on every image render; LUT-cached
- `CarouselStage` (16 edges) — canvas composition root

## Maintaining this file
At the end of any session that introduces non-obvious patterns, invariants, or decisions:
- Add the invariant to the relevant section (one line rule + one line why, if not obvious)
- Move implementation narrative to source file comments where it belongs
- Remove entries that are now obvious from the code or duplicated in comments
- Never add sprint history or feature changelogs — those belong in git

## What this is
Desktop Electron app for seamless multi-frame social posts: one long horizontal canvas sliced into per-platform frames. Instagram carousels were the original target and are still the default preset, but nothing in the canvas is Instagram-specific — platform, aspect ratio and exact pixel dimensions are all document state.

## File Ownership
- `src/canvas/` — canvas-agent · `src/ui/` — ui-agent · `src/ai/` — ai-agent
- `src/electron/` — electron-agent · `src/store/` — shared stores (useSaveStatusStore, useExportStore, trackSave), coordinate before editing
- `src/utils/` — domain-neutral helpers (color conversions, clamp); must never import from canvas/, ui/, or ai/
- Layering: ui may import canvas; canvas must not import ui stores/logic. Exception: `CarouselStage` composes the prop-driven `<FrameLabelStrip>` overlay (drag state machine + Konva preview capture stay canvas-side).

## Core Concepts — never break these
- Canvas = one long surface, N frames wide
- Frame = one slide/post in the sequence; its pixel size comes from `platform` + `ratio` (see below), never from a constant
- **`frameWidth` AND `frameHeight` are dynamic** — always read both from the store. There is no `FRAME_WIDTH`/`FRAME_HEIGHT` constant any more (`constants.ts` holds only `CANVAS_SCALE`), and 1080 is a preset value, not an invariant. Code that assumes a square frame, a 1080 width, or a fixed 1:1/4:5 pair is broken on tiktok/landscape/custom
- Objects are `global` (span canvas freely) or `pinned` (locked to a frame)
- Export = slice canvas at frame boundaries → array of PNGs via Electron IPC

## Platforms & frame sizing
- `Platform` = `instagram | tiktok | facebook | threads | custom`, `FrameRatio` = `square | portrait | story | landscape | custom` (`src/types/project.ts`). Both ride in the saved project; `platform` is optional so pre-multi-platform files load unmigrated
- **`PLATFORM_PRESETS` (`useCanvasStore.ts`) is the ONLY place a platform's allowed sizes live** — one `{ratio, label, width, height}[]` per platform. Adding a platform = one entry there + one shell registered in `src/ui/preview/shells/` + one entry in `FrameSettingsPopover`'s `PLATFORMS` list. Never inline a width/height at a call site
- `setPlatform(p)` resets `ratio`/`frameWidth`/`frameHeight` to `PLATFORM_PRESETS[p][0]` and pushes history — switching platform is a document-level change, not a view toggle. It deliberately does NOT try to preserve the current ratio: not every ratio exists on every platform
- `custom` platform = free dimensions, 100–8000px per axis, entered in `FrameSettingsPopover`'s Dimensions fields → `setRatio('custom', w, h)`. Preview mode is disabled for `custom` because no phone shell can frame an arbitrary size
- Landscape (facebook 16:9) is the one preset where the frame is **wider than tall** — the frame strip, snap boxes and export crop math are all width-driven, so this is the case that catches height-assuming code

## Key Architecture

Directory-scoped invariants load on demand: `src/canvas/CLAUDE.md` (canvas, media frames, grids, export, video) · `src/ui/CLAUDE.md` (panels, preview, design system) · `src/io/CLAUDE.md` (file lifecycle).

**Colour swatches** (`src/store/useSwatchStore.ts`):
- Two scopes: `file` rides inside the project payload, `global` lives in `userData/swatches.json` behind `get-global-swatches`/`set-global-swatches`
- Deliberately NOT in `useCanvasStore` — swatches must never enter the undo stack; undoing a shape move must not drop a saved colour. The cost is that `useAutosave` can't see a file-swatch edit through its canvas subscription, so it subscribes to `useSwatchStore` separately. Remove that and the last swatch before a quit is lost

**Other invariants:**
- Display scale: subscribe via `useViewportStore(selectScale)` (= `CANVAS_SCALE × zoom`); in handlers use `getCanvasScale()`, for a hypothetical zoom use `scaleForZoom(z)`. Never import `CANVAS_SCALE` outside `useViewportStore.ts` — it's an implementation detail of the store.
- Session restore: `localStorage['zeroseams:lastFile']` is written on every open AND every save, read by the `NewDocumentGate` on mount — survives renderer reloads (Vite HMR after sleep/wake, renderer crashes) without IPC round-trips. Two app instances can't share an Electron profile; localStorage writes contend (use `--user-data-dir` when running two)
- Panels/HUD: geometry constants live in `src/ui/panelConstants.ts` — ToolBar's `left`/`right` must track the panel widths or it slides under them. `CanvasHud` renders at the **App root** as `position:fixed`; the canvas-area div is `position:relative; zIndex:0`, a stacking context nothing inside it can escape at any z-index. `PropertiesPanel` reserves `HUD_LANE` at the bottom so it scrolls internally instead of burying the zoom controls
- `resolveVideoObjects` prefers `relativeFilePath` but falls back to stored absolute `filePath` when the resolved path escapes the project directory — handles projects copied to a new location while assets remain on an external volume
- `ErrorBoundary` wraps the root render in `main.tsx` — render crashes show a message + Reload button instead of a white screen
- Export overlay: `useExportStore` (`src/store/`) — `exporting/exportStatus/cancelRequested`; status flows from `exportMixedFrames` → Toolbar label; mid-export Cancel button lives in the main.tsx canvas overlay
- Export dialog settings persist in `localStorage['zeroseams:exportSettings']`; failures render an inline banner in the popover (panel stays open) — never `alert()`
- Thumbnails: `useThumbnailStore`, HTML Canvas 2D, triggered on `past.length` changes + mount. That sweep is blind to anything that changes a thumbnail without committing history, so `regenerate(id)` is the escape hatch — it marks one id dirty and flushes directly. The video branch draws the live element from `videoElementRegistry` and falls back to a grey play plate when `readyState < 2`, so a decode landing after load left the placeholder stuck (#84); `CanvasVideoNode` calls `regenerate` from a **`seeked`** listener, not from `canplay` — at `canplay` the `currentTime` assignment has been made but the seek has NOT completed, so drawing there captures the wrong frame. `posterFrame` is a number (seconds), a seek target, not a bitmap — it can never be drawn directly
- Frame labels: HTML div strip at `top: Math.max(4, panY - 22)` in CarouselStage (not Konva Text); grip + label pill uses `transform: translateX` for animated reorder — see the ColorInput portal note in `src/ui/CLAUDE.md`
- Multi-file drop: drop coords captured synchronously before async work; 30px stagger per file

**Konva ↔ `theme.css` binding:**
- **Konva can't read CSS custom properties**, so `ACCENT` / `ACCENT_GOLD` / `SNAP_GUIDE_FRAME` / `GUIDELINE` in `canvas/constants.ts` mirror these by hand — change both or a selected object's handles stop matching the panel that edits it. `scripts/test-frame-render-export.mjs` also hunts `ACCENT` by RGB; a stale literal there makes its absence proofs pass on a colour the palette no longer contains

**Konva handles:** every node's Transformer sets `borderStroke`/`anchorStroke` = `ACCENT` declaratively as JSX props. Setting only `borderStroke` leaves the anchors on Konva's default blue, which is what they were. Snap guides: `ACCENT` object snaps · `SNAP_GUIDE_FRAME` frame snaps (intentionally distinct).

## Keyboard Shortcuts
`useKeyboardShortcuts.ts`, mounted once in CarouselStage. No-op in input/textarea.

Full list: `src/ui/shortcuts.ts` (renders the `?` overlay).

## Upcoming
Tracked in GitHub issues, not here — `gh issue list`. A roadmap duplicated into this file goes stale the moment an issue closes.
