# Zero Seams — AI Dev Guide

## MANDATORY: Query the graph before reading files
```
graphify query "<question>"        # BFS traversal, instant
graphify path "<A>" "<B>"          # relationship between two nodes
graphify explain "<concept>"       # focused concept deep-dive
graphify update ./src              # after any code change (AST-only, no API cost)
```
Only fall back to reading source files when the graph answer is incomplete or you need exact line-level detail.

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
Desktop Electron app for seamless Instagram carousels. One long horizontal canvas sliced into Instagram frames.

**Stack:** Electron + React + TypeScript · Konva.js/react-konva · Zustand · @imgly/background-removal (WASM) · ONNX Runtime (SAM/LaMa) · FFmpeg WASM (video export)

## File Ownership
- `src/canvas/` — canvas-agent · `src/ui/` — ui-agent · `src/ai/` — ai-agent
- `src/electron/` — electron-agent · `src/store/` — shared stores (useSaveStatusStore, useExportStore, trackSave), coordinate before editing
- `src/utils/` — domain-neutral helpers (color conversions, clamp); must never import from canvas/, ui/, or ai/
- Layering: ui may import canvas; canvas must not import ui stores/logic. Exception: `CarouselStage` composes the prop-driven `<FrameLabelStrip>` overlay (drag state machine + Konva preview capture stay canvas-side).

## Core Concepts — never break these
- Canvas = one long surface, N frames wide
- Frame = one Instagram slide — 1080×1080 or 1080×1350; controlled by `ratio` in store
- `frameHeight` is dynamic — always read from store, never hardcode
- Objects are `global` (span canvas freely) or `pinned` (locked to a frame)
- Export = slice canvas at frame boundaries → array of PNGs via Electron IPC

## Key Architecture

**Image Frame/Content Model** — two-layer, never collapse:
- Frame (`frameX/Y`, `frameWidth/Height`) = visible crop viewport; `x/y/width/height` kept in sync
- Content (`contentOffsetX/Y`, `contentWidth/Height`) = bitmap floating inside frame
- `naturalWidth/naturalHeight` = intrinsic bitmap dims, set at drop time, never changes
- `contentEditMode: boolean` — false = frame transformer (blue); true = content mode (orange `#f94608`)
- Transformer is always a sibling of the Group, never inside it; Rect (not Group) is transform target in frame mode
- `resizeMode` (`'advanced'|'auto'`): advanced = frame resize crops; auto = cover-fits content to new frame
- Image Transformer always `keepRatio={false}`; Group transformer always `keepRatio={true}`

**Media Frames** (`src/canvas/frameClip.ts`, `src/canvas/frameModel.ts`, `src/canvas/geometry.ts`):
- `frameModel.ts` owns frame *identity*; `frameClip.ts` owns clip *geometry* — don't merge them. `frameModel` is a leaf (type-only imports, no store, no React), so anything may import it
- `buildEmptyFrameImage(id, spec)` is the ONLY place that knows an empty `ImageObject`'s field list; `frameToEmptyImage` (clear an existing frame), `makeEmptyCell` (fresh grid cell) and `buildFrameFromShape` all delegate to it. Three hand-written copies had already drifted before this existed
- `isFrameObject` (has clip/fill/stroke state OR is empty) and `isEmptyFrame` (is a placeholder) are deliberately DISTINCT — a filled clipped image is the first but not the second. Never re-derive either; `EmptyFrameOverlay` layers its `visible`/`rotation` policy on top as a second filter rather than folding it into the predicate
- `clipShape?` on `ImageObject`/`VideoObject`: `{kind:'rect', cornerRadius?}|{kind:'ellipse'}|{kind:'path', anchors}` — absent = plain rect; `path` anchors are NORMALIZED 0–1 in frame units, never display px (storing display px was the bug that killed the old mask system — it doesn't survive frame resize)
- `fill?` is a union (`{type:'solid', color}` today, gradient lands later) — read it only via `solidColorOf(fill)`, never `fill.color`
- Node-type dispatch in `CarouselStage` must stay REACTIVE (`useShallow` over the type list). Objects change type in place via `swapObjectPreservingId`, and a `getState()` read leaves the old node component mounted rendering nothing — the layer panel shows the media, the canvas doesn't
- `makeCanvasNode(Inner, expectedType)` returns null on a type mismatch, so a stale dispatch degrades to blank instead of throwing
- `canBecomeFrame(obj)` (`geometry.ts`) is the ONLY convertibility predicate — line/arrow/open path have no interior. Never re-derive it
- `insertMediaIntoShape(id, media)` = convert + fill in one `set()`, one undo step; returns `false` when the target can't hold media so drop handlers fall back to standalone placement
- `convertShapeToFrame` rejects sub-1px bboxes and `buildClipFunc` returns `undefined` for a degenerate frame — an *empty* clipFunc clips the whole group away, it does not mean "no clip"
- There is exactly ONE empty state per object: a standalone object with no media is a `ShapeObject`/`PathObject` (with the `+ Image / + Video` CTA), NOT an empty frame. `removeMediaFromFrame` collapses a standalone frame back to its shape via `buildShapeFromFrame` — that's why there's no separate "Convert to Shape" button; they were the same action with two indistinguishable results
- `isEmpty: true` `ImageObject` therefore means **grid cell** — a cell must keep its slot, so it's the one case `removeMediaFromFrame` leaves as a frame. `EmptyFrameOverlay` (ex-`GridCellOverlay`) renders it. Legacy projects may still contain standalone empty frames; they stay functional
- `convertShapeToFrame`/`convertFrameToShape`/`insertMediaIntoFrame`/`removeMediaFromFrame` all go through `swapObjectPreservingId` — id-preserving, single history entry, `objectOrder` index untouched
- `_srcVault` entries are KEPT (not deleted) on `removeMediaFromFrame` — undo needs the src back without a save round-trip
- `clipFunc` is only set when `clipShape` is non-plain-rect; the frame `Rect`'s `hitFunc` follows the same clip geometry so hit-testing matches the visible shape
- `computePathBBox` takes a `closed` boolean param — pass `true` for closed paths, or the bbox undercounts the closing segment
- `isFrameObject` stays narrow on purpose: a plain image becomes a frame by *acquiring* a clip (`AddClipRow` → `commitUpdate({clipShape})`), never by widening the predicate — widening it would put clip/fill/stroke UI on every image ever dropped. "Remove Clip" is the inverse and clears clip **+ fill + stroke together**; clearing only the clip flips `isFrameObject` false and strands state that still paints but can no longer be seen or edited
- The Frame section authors **rect and ellipse only**. A clip can only ever SUBTRACT area — the bitmap stops at the frame box — so dragging a path anchor outward changes nothing visible, which made panel-driven path editing a dead end. `path` is still a first-class `ClipShape`: it arrives by drawing a shape and inserting media into it, and renders/exports/snaps like any other. A frame carrying one shows a read-only `Custom` chip
- `clipEditMode`, `ClipEditOverlay` and `enterClipEditMode` are retained but have **no UI entry point** since the Edit Shape button was removed — they're the machinery a pen-tool-edits-a-frame's-edges flow would reuse. Case 15 keeps them honest
- `isPointInClipShape` is for hit tests done in logical coords with no Konva node (entering a grid cell); on-canvas hit-testing already goes through the frame Rect's `hitFunc`
- `clipEditMode` disarms the frame Transformer (`tr.nodes([])`, same branch as multi-select) in both node files — its resize anchors sit on the exact points as a path clip's corner anchors, so leaving it up makes those corners ungrabbable
- Transformer `anchorStroke`/`borderStroke` are the accent `#f94608`, NOT Konva's default blue — a pixel hunt can't tell resize handles from clip anchors, so assert "is the transformer up?" on the scene graph (`find('Transformer')` + `nodes().length`), never by colour

**Multi-Select:**
- `selectedId` — Properties Panel; `selectedIds[]` — group transformer + align/distribute; `anchorId` — alignment reference (gold `#f5a623` border)
- `setSelected(id)` sets both; `addToSelection(id)` shift+click appends; clicking already-selected → promotes to `anchorId`
- `commitMultipleUpdates(patches)` / `removeMultipleObjects(ids)` — atomic batch ops, single history entry

**Snap** (`useSnapGuides.ts`):
- Snaps to frame edges/centers + objects' edges/centers, 8px threshold
- `boundBoxFunc` receives absolute screen coords — convert absolute→logical before snapping, back to absolute before returning; `logicalThreshold = 8 / scale`
- `snapEnabled: boolean` in store; `rotationSnaps=[0,45,90,135,180,225,270,315]` on all Transformers
- Snap is **disabled** for pen anchor drag and line endpoint drag
- Media frames expose `frameSnapBox()`, not raw `frameX/Y/Width/Height`: rotated frames snap to their rotated corners' AABB, and `path` clips snap to the clip silhouette bbox rather than the enclosing frame rect
- Content dragged inside a frame lives in frame-local space — route it through `snapRectInRotatedFrame` (`geometry.ts`) so snapping still works on a rotated frame
- `startSnapSession(id)` / `endSnapSession()` — call at `onDragStart`/`onDragEnd` and `onTransformStart`/`onTransformEnd` on every draggable node; caches `buildTargets` result for the drag duration so it runs once per gesture, not per mousemove

**History & Drag Pattern:**
- `past[]`/`future[]` snapshots; `commitUpdate` = push snapshot; load project resets history
- Drag pattern (all sliders): `onMouseDown` → `startDrag()` captures pre-drag state; `onChange` → `updateObject` (live, no history push); `onMouseUp` → `commitUpdate`. Ensures undo reaches pre-drag state, not mid-drag.
- `reorderObjects` pushes history — undoable via Cmd+Z
- `_srcVault: Map<id, {src, originalSrc?}>` lives outside history — `normalizeObjectsForSnapshot` strips base64 `src` from snapshots; `reinjectSrc` restores on undo/redo. Background-removal `src` changes are therefore not undoable at pixel level (acceptable — feature not yet wired to history).
- `_openEditModeCount: number` tracks objects in any edit mode — `normalizeObjectsForSnapshot` skips the edit-mode clearing loop when 0 (common case). Kept in sync by `updateObject`, `commitUpdate`, and all direct mode-set actions.
- Normalized/reinjected image copies are WeakMap-cached by object identity (`normalizedImageCache`/`reinjectedCache`) — valid because objects are replaced immutably on update; unchanged images cost zero allocations per history push. Never mutate a `CanvasObject` in place or the caches serve stale copies.

**Per-Object Subscription Pattern:**
- `makeCanvasNode(Inner)` (`src/canvas/makeCanvasNode.tsx`) generates the memoized Outer for all five node types: subscribes to `s.objects[id]`, returns null if missing/hidden, passes typed `obj` to Inner. Contract changes go there, not in the node files.
- Inner subscribes to `s.selectedId === id`; prevents CarouselStage re-renders from cascading to nodes during drag
- Handlers call `useCanvasStore.getState().setSelected(id)` directly — no `onSelect` prop

**Shape/Text/Pen invariants:**
- Shape/Ellipse: store uses bounding-box top-left `(x,y)`; Konva Ellipse uses center — convert at render time
- Text: handles resize the textbox, text reflows; `scaleX/Y` always 1 after transform
- Pen: `PathObject` with `anchors: AnchorPoint[]`; transform bakes full affine matrix into anchors, resets node to identity
- Pen: `penDrawingId` in store (transient) mirrors CarouselStage's `currentPenPathIdRef` — the pen selects the path on its first anchor, so `CanvasPathNode` needs this to suppress the transform box until the path is committed. Update both together at every assignment site
- Shift+drag axis-locks via `axisLock(dx,dy)` in `constants.ts`
- `locked: boolean` on every object — no handles, no drag, no double-click

**Photo Adjustments** (`src/canvas/adjustments/pipeline.ts`):
- `buildFilterPipeline(adj)` → `Array<(ImageData) => void>`; returns `[]` when all values are 0 (zero cost for unedited images)
- Three module-level LUT caches: 1D per-channel, 33³ cube (saturation/vibrance/dehaze), 256-entry float (highlights/shadows/clarity)
- `sample3DLUT` must NOT use inner functions — one closure per pixel × 1.4M pixels causes GC freeze
- `adjustmentsBypass: boolean` in store (transient) — `\` hold-to-compare; Power button in Adjustments header toggles persistently
- Double-click any slider label/handle resets that param to 0; one undo step per drag

**Layer Effects** (`src/canvas/effects/`):
- Adding a new effect = one file + one `registerEffect(def)` call, no framework changes
- `buildEffectFilters(effects)` → same `Array<(ImageData) => void>` signature as adjustments pipeline
- `CanvasImageNode` stacks: `allFilters = [...filterPipeline, ...effectFilters]`
- `CarouselStage.tsx` imports `@/canvas/effects` as a side-effect to register all effects at startup

**Export** (`src/canvas/exportFrames.ts`):
- `stage.x()` and `stage.y()` MUST be reset to 0 before `toCanvas()` — non-zero pan offsets shift all content and break `i * frameWidth * pixelRatio` crop math
- Hides Transformers + `guides` layer + `frame-dividers` layer before render; restores in `finally`
- Background fills live in dedicated `background` layer (not `guides`) — ensures they appear in exported PNGs
- `pixelRatio` (default 2) is threaded as a parameter through `exportFrames`, `captureVideoFrameSequence`, and `exportMixedFrames` — never hardcode it; user controls it via the export dialog `1×/2×/3×` selector
- Batch export: single `show-folder-dialog` IPC call → all frames written via `write-file-to-folder`; no per-frame save dialog
- `ImageExportSettings` (`src/types/canvas.ts`) controls format (png/jpeg/tiff), quality (0–100), and optional `maxFileSizeKB` cap (JPEG only — quality iterated down in steps of 5)

**Video Layer** (`CanvasVideoNode.tsx`):
- Frame/content model identical to ImageObject; extra fields: `trimStart/trimEnd`, `loop`, `startOffset`, `volume`, `posterFrame`
- Use `durationchange` event (not `loadedmetadata`) to read duration — ensures finite value; listener also persists `naturalWidth/Height/Duration` to store (older saves have these as `0`/`null`)
- Always seek to `trimStart ?? 0` after `canplay` to force first-frame decode in Chromium
- RAF trim end: `obj.trimEnd ?? obj.naturalDuration ?? Infinity` — `Infinity` guards against `naturalDuration: null` on older saves; `null` coerces to `0` and makes the trim check always-true, causing constant seek-to-frame-0
- `obj.effects ?? []` when calling `buildEffectFilters` — video objects saved before the effects field was introduced omit it entirely
- RAF cache throttle: skip `.cache()` + `batchDraw()` when `currentTime` unchanged; reset throttle ref to `-1` on `allFilters` change — otherwise paused-video adjustment changes never apply
- The cache effect MUST also depend on `contentWidth`/`contentHeight` (as `CanvasImageNode` does): `.cache()` snapshots the node at its current size and Konva scales that bitmap to the node's new box, so re-fitting content without re-caching renders the video **stretched**
- `zeroseams-media://` scheme with Range support + CORP/COEP headers enables `SharedArrayBuffer` for FFmpeg WASM
- Store `platform` must be subscribed as a hook in Toolbar components — `getState()` inside handlers only leaves it undefined during render

**Platform Preview Mode** (`src/ui/preview/`):
- `previewMode: boolean` + `previewFrame: number` in store (transient, not persisted); disabled for `custom` platform
- On open: captures all frames via `getStageInstance()` → JPEG data URLs (same crop approach as `exportFrames.ts`)
- `FrameSlide` = static JPEG background + `<VideoOverlayItem>` overlays for any video whose x-span overlaps the frame
- Shell registry: `registerShell(platform, Component)` — adding a platform = one file + one call
- Frame labels in `CarouselStage` hidden when `previewMode` is true
- `PreviewShell` must be rendered at the root `App` level (sibling of `TitleBar`), NOT inside the canvas area div — the canvas area has `position:relative; zIndex:0` which creates a stacking context that causes the overlay to paint beneath the panels/toolbar

**Grid/Collage System** (`src/canvas/gridTemplates.ts`, `CanvasGroupNode.tsx`, `EmptyFrameOverlay.tsx`):
- `GroupObject` with `isGrid: true` owns N `ImageObject`/`VideoObject` cells via `childIds`; `gridTemplateId` references the template used
- `gridTemplates.ts` `cells(groupW, groupH, gap)` is pure — zero hardcoded pixels; always proportional to group dimensions
- **Listening rule:** exactly one of {a grid's group hit rect, its cells} listens at any moment — cells listen iff the grid is *entered* (some cell is `selectedId`). `CanvasGroupNode`'s `listening={!locked && !isCellSelected}` and the cell's `isGridEntered` are complements; change them together. Consequence: the group drags from anywhere on it, and once entered, clicks move directly between sibling cells
- `EmptyFrameOverlay`'s `+image`/`+video` buttons are HTML, so they're immune to Konva listening — a cell can still be filled in one click without entering the grid. That's what makes the rule ergonomically safe
- Grid cells get a selection border but **no resize/rotate anchors** (`obj.locked || isGridCell` branch in both node files): `computeGridChildPatches` owns cell geometry, so an individual resize is silently reverted by the next group drag or gap change. Resize a cell by detaching it (`disconnectGridCell`) or by changing the template
- Konva node names `grid-hit` / `frame-rect-<id>` exist so click routing is assertable via `stage.getIntersection()` — see `docs/testing.md`
- Deleting a group deletes its cells: `withGroupDescendants` expands the id set in both `removeObject` and `removeMultipleObjects`. A cell left behind keeps a `parentGroupId` pointing at nothing, and since cells only listen while the grid is entered, it becomes visible debris that can never be selected again. Keeping a cell is what `disconnectGridCell` is for
- Cells swept up by a group delete **keep** their `_srcVault` entries (only the explicitly targeted id drops its entry) — `reinjectSrc` reads the vault, so dropping them would undo the delete with every image blank
- `GridTemplate.cellClipShape` applies one clip to every cell **at creation only** (`addGrid` → `makeEmptyCell`); per-cell overrides come from the Frame section's shape picker. `cells()` still returns bare rects, which is what keeps `computeGridChildPatches` free of clip logic
- Delete on a *filled* cell restores an empty frame (`isEmpty: true`) — never removes the slot. Delete on an *already-empty* cell falls through to the generic delete (both interceptions in `removeObject` require media), which is why that path must detach too
- `detachCellFromParent(objects, cellId, parentGroupId)` is the ONLY way a cell leaves a grid — it strips the id from `childIds` and deletes the group when that was the last cell. Skipping it leaves a dangling child id and a slot that can never be refilled. Mutates the `objects` copy; returns the deleted group's id so the caller can drop it from `objectOrder` and selection
- `disconnectGridCell(id)` detaches, and **collapses an empty cell to a shape** in the same `set()` — one undo step, one empty state. It builds the replacement inline rather than via `swapObjectPreservingId` because that helper re-attaches `parentGroupId` from the old object, which is the exact field disconnect clears
- `EmptyFrameOverlay` container must be `pointerEvents: none`; only the `+image`/`+video` buttons set `pointerEvents: auto` — otherwise the div captures clicks before Konva hit-tests the group rect
- Gap slider and group transform must update ALL child types (image + video) — filtering by `child.type === 'image'` breaks video cells
- `computeGridChildPatches` (`gridTemplates.ts`) is the ONLY place cell geometry is derived — `CanvasGroupNode` (drag/transform) and the Properties gap slider both call it. Never re-derive `template.cells(...)` inline
- Cell content refit goes through `fitCover` off `naturalWidth/naturalHeight`, never by scaling the previous content dims. Scaling by the group's independent x/y deltas destroys the media's aspect ratio, and scaling the previous *result* compounds when applied per-mousemove. Deriving from the source bitmap is idempotent, which is what lets live transform preview the real result (#69)
- `refitContent` must be `false` for a plain move — the cell size hasn't changed, and refitting would discard any content offset set in content-edit mode

**Guidelines** (`src/canvas/CanvasGuidelineNode.tsx`):
- `GuidelineObject` extends `BaseCanvasObject`: `orientation: 'horizontal'|'vertical'`, `position: number` (canvas-absolute), `frameIndex: number` (-1 = global), `spanAllFrames: boolean`
- Position encoded in Konva node `x`/`y` props, NOT in `points` — `points` are always relative to node origin; encoding position in points causes double-speed drag (React re-render + Konva offset compound)
- Rendered in `guideline-overlay` layer, which sits above `objects` layer and is hidden during export (both export functions hide/restore it by name `.guideline-overlay`)
- `guidelinesVisible: boolean` in store (transient) — toolbar eye toggle; guidelines excluded from LayerPanel entirely
- `buildTargets()` in `useSnapGuides.ts` has a `'guideline'` branch: pushes `position` directly into snap targets and `continue`s — skips bbox processing
- `getObjectBBox` in store guards `type === 'guideline'` → returns zero-size rect at `(obj.x, obj.y)`
- Drag uses `startSnapSession`/`endSnapSession` + `computeSnap` in `onDragMove`; axis constraint enforced imperatively (`node.x(fixedX)` for horizontal, `node.y(0)` for vertical)

**Frame Reordering** (`reorderFrames` in store, drag UI in `CarouselStage.tsx`):
- `reorderFrames(from, to)` — single raw `set()` + `pushHistoryFrom`; can't use `commitMultipleUpdates` because it only patches objects, not `frames[]`
- Object ownership = spatial center: `Math.floor((bbox.x + bbox.width/2) / frameWidth)` — the `scope` field is irrelevant here
- `contentOffsetX/Y` is frame-relative — never shift it; only `frameX` + `x` shift for image/video objects
- Guidelines: owned by `frameIndex` / `spanAllFrames`; global (`frameIndex === -1`) and span-all never move
- Frame drag: `onPointerMove/Up` live on the container div, not the grip span — Chromium silently drops `setPointerCapture` when an ancestor receives `pointer-events: none` via React re-render
- `useImageDrop` / `useVideoDrop`: early-return when `!e.dataTransfer?.types.includes('Files')` — without this they swallow the frame-drag pointer events
- Canvas preview capture: deferred into `requestAnimationFrame`, saves/restores stage size + scale, hides UI layers, crops at `pixelRatio: 0.5`

**Properties Panel** (`src/ui/PropertiesPanel.tsx` + `src/ui/properties/`):
- Section components live one-per-file in `src/ui/properties/` (AlignDistribute, Text, Effects, Adjustments, Video, FrameSection) with shared field helpers/styles in `properties/shared.tsx`; PropertiesPanel keeps layout and selection routing
- `VideoSection` composes `AdjustmentsSection` + `EffectsSection` — video and image share the adjustment UI

**Shortcuts & discoverability:**
- `src/ui/shortcuts.ts` is the single source of truth for the shortcut list; `ShortcutOverlay` (toggled by `?`) renders it — when adding a shortcut, update the table AND the handler in `useKeyboardShortcuts.ts`, and quote the same string in the button's `<Tooltip shortcut=>`
- Zoom: `zoomIn()`/`zoomOut()` (clamped `setZoom`, MIN/MAX_ZOOM) live in `useViewportStore` and are shared by ⌘± and the bottom-right `CanvasHud` (zoom −/%/+, fit-all-frames, ? help)

**Save feedback:**
- Every manual save path (⌘S, ⌘⇧S, Save menu, Save a Copy) must go through `trackSave()` from `@/store` — it drives the SaveStatusPill (saving spinner → saved/error), clears `dirty`, and treats Electron's `{success:false}` dialog-cancel as idle, not saved
- `dirty` in useSaveStatusStore: armed on any canvas-store change (useAutosave subscription), cleared on save success; rendered as the accent dot next to the title

**Other invariants:**
- Display scale: subscribe via `useViewportStore(selectScale)` (= `CANVAS_SCALE × zoom`); in handlers use `getCanvasScale()`, for a hypothetical zoom use `scaleForZoom(z)`. Never import `CANVAS_SCALE` outside `useViewportStore.ts` — it's an implementation detail of the store.
- Pan is imperative — **never subscribe to `s.panX`/`s.panY` in a Konva node or in `CarouselStage`**. Doing so re-renders that component (and the whole node tree) on every pan pointermove — the pan was ~1ms drawing + ~45ms React (issue #59). `CarouselStage` applies the Stage transform (`x/y/scaleX/scaleY` + `batchDraw`) imperatively from a `useViewportStore.subscribe` in a `useLayoutEffect`; the Stage has no `x/y/scale` JSX props. Transform/drag callbacks read pan via `useViewportStore.getState()`. Only cheap HTML overlays that must track the viewport (`FrameLabelStrip`, `EmptyFrameOverlay`, `CanvasTextNode`'s display div) may subscribe to pan. `scale` may be subscribed (zoom is infrequent). Dev perf HUD: `perfMonitor.ts` + `PerfHud.tsx`, toggle ⌥⇧P.
- Save: `currentFilePath` in `useSaveStatusStore` (`src/store/`); autosave forks on it; `recentFiles.json` tracks history
- Session restore: `localStorage['zeroseams:lastFile']` is written on every open and read on `TitleBar` mount — survives renderer reloads (Vite HMR after sleep/wake, renderer crashes) without IPC round-trips
- `resolveVideoObjects` prefers `relativeFilePath` but falls back to stored absolute `filePath` when the resolved path escapes the project directory — handles projects copied to a new location while assets remain on an external volume
- `ErrorBoundary` wraps the root render in `main.tsx` — render crashes show a message + Reload button instead of a white screen
- Export overlay: `useExportStore` (`src/store/`) — `exporting/exportStatus/cancelRequested`; status flows from `exportMixedFrames` → Toolbar label; mid-export Cancel button lives in the main.tsx canvas overlay
- Export dialog settings persist in `localStorage['zeroseams:exportSettings']`; failures render an inline banner in the popover (panel stays open) — never `alert()`
- Thumbnails: `useThumbnailStore`, HTML Canvas 2D, triggered on `past.length` changes + mount
- Frame labels: HTML div strip at `top: Math.max(4, panY - 22)` in CarouselStage (not Konva Text); grip + label pill uses `transform: translateX` for animated reorder — see ColorInput portal note below
- Multi-file drop: drop coords captured synchronously before async work; 30px stagger per file

## Visual Design System
Tokens in `src/ui/theme.css` — single source of truth. Imported once in `src/main.tsx`.

**Palette:**
- `--bg-base` `#fdf8f2` · `--bg-panel` `#f5ede2` · `--bg-canvas` `#ede7dc` · `--bg-surface` `#ffffff`
- `--border` `#e8e0d5` · `--stroke` `#d4ccc2`
- `--text-primary` `#111111` · `--text-secondary` `#555555` · `--text-muted` `#aaaaaa`
- `--accent` `#f94608` — active states, Konva handles, primary CTA
- `--accent-gold` `#f5a623` — multi-select anchor star/outline
- Use `var(--…)` tokens in components — Toolbar/LayerPanel are fully tokenized; don't reintroduce raw hex for token values
- `--font` — always use `var(--font)`, never hardcode `'Uncut Sans Variable'`

**Components:**
- Buttons: pill shape (`borderRadius: 999`). Inputs/selects: `borderRadius: 6`. Cards/popovers: `borderRadius: 16`
- `.btn-raised` (in `theme.css`): shadow button with press-down animation — `box-shadow: 2px 4px 0 #000` at rest
- `iconBtnStyle(active)` (`src/ui/iconBtnStyle.ts`): active = `#f94608` fill + white icon; inactive = white fill + `#555` icon + `#d4ccc2` border; always `borderRadius: 999`
- Sliders: global `input[type="range"]` in `theme.css` handles all. Adjustments sliders override track via inline `background`. Never add `.adj-slider`
- Tooltips: every interactive button must be wrapped in `<Tooltip label shortcut? description?>` (`src/ui/Tooltip.tsx`). Never use native `title=` on buttons — wrong font, timing, style. Tooltip chains the child's mouse/focus handlers and shows on keyboard focus. `label` always required; `shortcut` required if a shortcut exists; `description` for ambiguous labels. Empty `label=""` renders children unwrapped (no tooltip).
- Color picker: `<ColorInput>` / `<MixedColorInput>` in `src/ui/ColorInput.tsx` (exported from `src/ui/index.ts`) — never use raw `input[type="color"]`. Popover uses `react-colorful` + HEX/RGB/HSL modes + eyedropper + 5 recent colors (localStorage `zeroseams:recentColors`). `fixed` prop portals the popover into `document.body` — required whenever the trigger has a CSS `transform` ancestor (even `translateX(0px)` creates a containing block that breaks `position:fixed`). `popoverAnchorFn?: () => {top,left}` overrides automatic `getBoundingClientRect` positioning when you need a fixed anchor (e.g. frame label strip). `MixedColorInput` renders a `—` overlay and shows `value=undefined` as mixed state.

**Layout:**
- `TitleBar` (full width, 52px) — logo, file ops, frame settings, frames counter, preview, export, undo/redo
- `ToolBar` (center column only, 62px) — `position: absolute; top: 0; left: 240; right: 300; zIndex: 10` — constrained to the gap between panels so it never extends under them; gradient background (`--bg-base` solid top 50% → transparent bottom); three labeled groups: **Transform** (Select, Snap, Crop/Autofill), **Add** (Text, Shape, Pen, Image, Video), **Layout** (Grid, Guideline, visibility toggle); `ToolGroup` helper at module scope renders the group label (`top: -13px, left: 0` absolute) above buttons; `alignItems: flex-end` + `paddingBottom: 10`
- `LayerPanel` + `PropertiesPanel` are `position: absolute` inside the center column — `left: 0` / `right: 0`, `top: 0`, `zIndex: 20` (above toolbar gradient); height driven by `ResizeObserver`, `max-height: calc(100vh - 52px)`; `borderRadius: 0 0 16px 16px`; sticky header; `panel-scroll` class applies slim 4px scrollbar
- Middle row: center column only (panels float inside it) — see `src/main.tsx`

**Konva handles:** `borderStroke`/`anchorStroke` = `#f94608`. Snap guides: `#f94608` object snaps · `#ff3b5c` frame snaps (intentionally distinct).

## Keyboard Shortcuts
`useKeyboardShortcuts.ts`, mounted once in CarouselStage. No-op in input/textarea.

`V` select · `T` text · `R` shape · `P` pen · `G` guideline · `S` snap toggle · `F` frame settings · `?` shortcut cheatsheet · `\` bypass adjustments (hold) · `Esc` deselect · `⌘A` all · `⌘D` dupe · `⌘E` export · `⌘Z/⇧Z` undo/redo · `⌘]/[` layers · `⌘L` lock · `⌘±/0` zoom · `⌘→` add frame · `⌘←` remove frame · arrows nudge · `⌫` delete · `⌘⇧P` preview toggle (disabled for custom platform)

Full list: `src/ui/shortcuts.ts` (renders the `?` overlay).

## Upcoming
AI background removal UI · SAM segmentation · LaMa inpainting · Font picker + Google Fonts · Templates/presets · Windows packaging + auto-update · Video: volume meter, playback rate, poster frame thumbnail in layer panel · Preview: TikTok/Facebook/Threads shells, dark-mode variant, phone bezel
