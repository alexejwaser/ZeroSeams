# Graph Report - ZeroSeams  (2026-07-27)

## Corpus Check
- 121 files · ~599,908 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1181 nodes · 2194 edges · 82 communities (67 shown, 15 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.78)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `acbf17fb`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- useSnapGuides.ts
- ffmpeg-core.js
- canvas.ts
- test-multiselect-transform.mjs
- electron/index.ts
- PropertiesPanel.tsx
- worker.js
- exportFrames.ts
- pipeline.ts
- test-video.mjs
- dependencies
- Zustand Store (src/store/index.ts)
- test-undo-redo.mjs
- effects/index.ts
- ContextMenu.tsx
- compilerOptions
- test-save-path.mjs
- CarouselStage.tsx
- debug-selection.mjs
- ColorInput.tsx
- PreviewShell.tsx
- Zero Seams — AI Dev Guide
- gridTemplates.ts
- getSocketFromFD
- test-axis-lock.mjs
- getWasmTableEntry
- CanvasTextNode.tsx
- Window Store Exposure for E2E Tests (__canvasStore__, __viewportStore__, __saveStatusStore__)
- abort
- intArrayFromString
- Zero Seams
- Toolbar.tsx
- _strftime
- useThumbnailStore.ts
- asyncLoad
- useViewportStore.ts
- callRuntimeCallbacks
- Tooltip
- CanvasVideoNode.tsx
- devDependencies
- useCanvasStore.ts
- emscripten_realloc_buffer
- getEnvStrings
- Electron Vite Config
- shared.tsx
- VideoSection.tsx
- hooks
- permissions
- electron.d.ts
- ExceptionInfo
- CanvasImageNode.tsx
- Frame Labels (HTML div, not Konva Text)
- keepRatio mirrors resizeMode
- Shape/Ellipse bounding-box origin in store
- Upcoming: AI background removal, SAM, LaMa
- index.html Entry Point
- Main Process (Electron)
- Claude Settings Local
- textSpans utilities
- ai/index exports
- Zero Seams Project README
- .carousel / .zeroseams Project File Format
- ui/index.ts
- FrameSection.tsx
- compilerOptions
- classes.js
- 56-update.md
- store/index.ts
- IPC: edit-in-external-app
- color.ts
- LazyUint8Array
- shortcuts.ts
- readFile
- tsconfig.json

## God Nodes (most connected - your core abstractions)
1. `useCanvasStore` - 43 edges
2. `buildFilterPipeline()` - 22 edges
3. `useViewportStore` - 19 edges
4. `FFmpeg` - 18 edges
5. `useSnapGuides()` - 18 edges
6. `SnapGuide` - 17 edges
7. `selectScale()` - 17 edges
8. `getWasmTableEntry()` - 16 edges
9. `Tooltip()` - 16 edges
10. `CanvasImageNodeInner()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `Agent: qa-reviewer` --references--> `Zustand Store (src/store/index.ts)`  [INFERRED]
  .claude/agents/qa-reviewer.md → src/store/index.ts
- `Zustand Store (src/store/index.ts)` --shares_data_with--> `Adjustments Bypass Toggle`  [INFERRED]
  src/store/index.ts → CLAUDE.md
- `Zustand Store (src/store/index.ts)` --shares_data_with--> `History (past/future snapshots)`  [INFERRED]
  src/store/index.ts → CLAUDE.md
- `Zustand Store (src/store/index.ts)` --shares_data_with--> `Masking System (pen/rect/ellipse)`  [INFERRED]
  src/store/index.ts → CLAUDE.md
- `Zustand Store (src/store/index.ts)` --shares_data_with--> `Multi-Select Architecture`  [INFERRED]
  src/store/index.ts → CLAUDE.md

## Import Cycles
- 3-file cycle: `src/canvas/CanvasPathNode.tsx -> src/canvas/makeCanvasNode.tsx -> src/canvas/useCanvasStore.ts -> src/canvas/CanvasPathNode.tsx`
- 4-file cycle: `src/canvas/CanvasPathNode.tsx -> src/canvas/makeCanvasNode.tsx -> src/canvas/useCanvasStore.ts -> src/canvas/frameClip.ts -> src/canvas/CanvasPathNode.tsx`

## Communities (82 total, 15 thin omitted)

### Community 0 - "useSnapGuides.ts"
Cohesion: 0.13
Nodes (20): CanvasGroupNodeInner, CanvasGroupNodeProps, CanvasGuidelineNodeInner(), CanvasShapeNode, CanvasShapeNodeInnerProps, CanvasShapeNodeProps, SNAP_THRESHOLD, SnapGuides() (+12 more)

### Community 1 - "ffmpeg-core.js"
Cohesion: 0.04
Nodes (24): bigintToI53Checked(), DEFAULT_ARGS, DEFAULT_ARGS_FFPROBE, doCallback(), done(), doReadv(), doWritev(), _emscripten_asm_const_int() (+16 more)

### Community 2 - "canvas.ts"
Cohesion: 0.09
Nodes (49): Non-Destructive Photo Adjustments Pipeline, applyStyleToAll(), applyStyleToRange(), getSelectionStyle(), mergeAdjacentSpans(), ResolvedSpanStyle, resolveSpanStyle(), SelectionStyle (+41 more)

### Community 3 - "test-multiselect-transform.mjs"
Cohesion: 0.06
Nodes (39): clearAll(), clickKonvaCenter(), consoleLogs, drag(), drawRect(), ELECTRON_BIN, escape(), failures (+31 more)

### Community 4 - "electron/index.ts"
Cohesion: 0.09
Nodes (19): body, buf, buffer, corpHeaders, dir, editDir, editor, existing (+11 more)

### Community 5 - "PropertiesPanel.tsx"
Cohesion: 0.09
Nodes (23): Photo Adjustments Bypass Toggle (hold-to-compare \ key + persistent Power button), rotateAroundCenter: Konva Rect/Text rotate around top-left not center; ellipse exempt, AdjustmentsSection(), AdjustmentsSectionProps, alignButtonStyle(), AlignDistributeSection(), distributeButtonStyle(), EffectsSection() (+15 more)

### Community 6 - "worker.js"
Cohesion: 0.12
Nodes (7): ERROR_IMPORT_FAILURE, ERROR_NOT_LOADED, ERROR_UNKNOWN_MESSAGE_TYPE, TODO: check if deletion works., TODO: check if creation works., TODO: check if deletion works., trans

### Community 7 - "exportFrames.ts"
Cohesion: 0.08
Nodes (26): Autosave Pipeline, FFmpeg, captureVideoFrameSequence(), downloadFrames(), exportMixedFrames(), ExportResult, canvas/index exports, posixDirname() (+18 more)

### Community 8 - "pipeline.ts"
Cohesion: 0.17
Nodes (24): adjFingerprint(), build3DLUT(), buildFilterPipeline(), buildFloatLUT(), buildLUT(), evict(), floatLutCache, isAllDefault() (+16 more)

### Community 9 - "test-video.mjs"
Cohesion: 0.09
Nodes (22): ELECTRON_BIN, eq(), errors, failures, loaded, newVideoErrors, nonProtocolErrors, objects (+14 more)

### Community 10 - "dependencies"
Cohesion: 0.05
Nodes (41): chokidar, @ffmpeg/core, @ffmpeg/ffmpeg, @ffmpeg/util, @imgly/background-removal, konva, lucide-react, onnxruntime-web (+33 more)

### Community 11 - "Zustand Store (src/store/index.ts)"
Cohesion: 0.10
Nodes (25): Agent Domain Isolation (no cross-domain edits), Rationale: Agents must not cross domain boundaries (ui/canvas/ai separation), Agent: ai-engineer, src/ai/ (ai-engineer domain), Agent: canvas-engineer, src/canvas/ (canvas-engineer domain), Agent: qa-reviewer, Agent: ui-engineer (+17 more)

### Community 12 - "test-undo-redo.mjs"
Cohesion: 0.11
Nodes (22): addImage(), addPath(), addShape(), addText(), app, ELECTRON_BIN, electronProc, eq() (+14 more)

### Community 13 - "effects/index.ts"
Cohesion: 0.19
Nodes (11): boxBlurH(), boxBlurV(), buildFilter(), hexToRgb(), EffectControlDescriptor, EffectDefinition, EffectParams, getAllEffectDefinitions() (+3 more)

### Community 14 - "ContextMenu.tsx"
Cohesion: 0.18
Nodes (13): Frame/Content Two-Layer Model, AIContext, AIContextValue, useAI(), AIProvider(), AIStoreState, useAIStore, useBackgroundRemoval() (+5 more)

### Community 15 - "compilerOptions"
Cohesion: 0.08
Nodes (23): DOM, DOM.Iterable, ES2022, src/**/*, compilerOptions, composite, jsx, lib (+15 more)

### Community 16 - "test-save-path.mjs"
Cohesion: 0.12
Nodes (7): consoleLogs, content, ELECTRON_BIN, existingPath, failures, ROOT, testFile

### Community 17 - "CarouselStage.tsx"
Cohesion: 0.17
Nodes (17): CanvasGroupNode(), CanvasGuidelineNode, CanvasGuidelineNodeOuter(), InnerProps, Props, computePathBBox(), CarouselStage(), getStageInstance() (+9 more)

### Community 18 - "debug-selection.mjs"
Cohesion: 0.11
Nodes (15): allInputs, dblLogs, div, ELECTRON_BIN, firstText, inp, labels, lbl (+7 more)

### Community 19 - "ColorInput.tsx"
Cohesion: 0.14
Nodes (15): ColorInput(), ColorInputProps, ColorMode, ColorPopover(), hexToHsl(), hexToRgb(), hslToHex(), loadRecentColors() (+7 more)

### Community 20 - "PreviewShell.tsx"
Cohesion: 0.24
Nodes (11): capturePreviewFrames(), FrameSlideProps, PreviewShell(), VideoOverlayItemProps, FacebookShell(), InstagramShell(), getShell(), PlatformShellProps (+3 more)

### Community 21 - "Zero Seams — AI Dev Guide"
Cohesion: 0.12
Nodes (15): code:block1 (graphify query "<your question>"), Core Concepts — never break these, Export (`src/canvas/exportFrames.ts`), Features Implemented (sprints 1–42 + issue #20), File Ownership, graphify, Key Architecture, Keyboard Shortcuts (+7 more)

### Community 22 - "gridTemplates.ts"
Cohesion: 0.31
Nodes (6): CellRect, GridTemplate, CanvasState, HistorySnapshot, GridPicker(), GridPickerProps

### Community 23 - "getSocketFromFD"
Cohesion: 0.14
Nodes (19): alignMemory(), _getaddrinfo(), getSocketAddress(), getSocketFromFD(), inetPton4(), inetPton6(), jstoi_q(), mmapAlloc() (+11 more)

### Community 24 - "test-axis-lock.mjs"
Cohesion: 0.17
Nodes (9): Playwright Electron Integration Testing Pattern, clickAt(), drag(), ELECTRON_BIN, failures, getStageInfo(), k2p(), ROOT (+1 more)

### Community 25 - "getWasmTableEntry"
Cohesion: 0.13
Nodes (15): getWasmTableEntry(), invoke_i(), invoke_ii(), invoke_iii(), invoke_iiii(), invoke_iiiii(), invoke_iiiiii(), invoke_iiiiiiiii() (+7 more)

### Community 26 - "CanvasTextNode.tsx"
Cohesion: 0.15
Nodes (17): Rationale: Snap absolute→logical coord conversion, Snap Guide System, CanvasPathNode, CanvasPathNodeInnerProps, CanvasPathNodeOuter(), CanvasPathNodeProps, CanvasTextNode, CanvasTextNodeInner() (+9 more)

### Community 27 - "Window Store Exposure for E2E Tests (__canvasStore__, __viewportStore__, __saveStatusStore__)"
Cohesion: 0.25
Nodes (4): Window Store Exposure for E2E Tests (__canvasStore__, __viewportStore__, __saveStatusStore__), App(), ErrorBoundary, rootEl

### Community 28 - "abort"
Cohesion: 0.20
Nodes (11): abort(), _dlopen(), ___dlsym(), getBinary(), getBinaryPromise(), getValue(), initRandomFill(), instantiateArrayBuffer() (+3 more)

### Community 29 - "intArrayFromString"
Cohesion: 0.22
Nodes (11): _getnameinfo(), inetNtop4(), inetNtop6(), intArrayFromString(), lengthBytesUTF8(), readSockaddr(), stringToNewUTF8(), stringToUTF8() (+3 more)

### Community 30 - "Zero Seams"
Cohesion: 0.18
Nodes (10): code:bash (git clone https://github.com/alexejwaser/zeroseams.git), code:bash (node node_modules/electron/install.js), code:bash (npm install electron --save-dev), Download, Features, If you see `Error: Electron uninstall` after `npm install`, License, Running Locally (+2 more)

### Community 31 - "Toolbar.tsx"
Cohesion: 0.11
Nodes (19): Save Split-Button Pattern (Save / Save As / Save a Copy), FrameSettingsPopover(), FrameSettingsPopoverProps, labelStyle, numberInputStyle, PLATFORM_LABELS, PLATFORMS, segmentButtonStyle() (+11 more)

### Community 32 - "_strftime"
Cohesion: 0.14
Nodes (13): addDays(), arraySum(), ___assert_fail(), __gmtime_js(), isLeapYear(), __localtime_js(), __mktime_js(), readI53FromI64() (+5 more)

### Community 33 - "useThumbnailStore.ts"
Cohesion: 0.36
Nodes (9): spanText(), anchorsToPathData(), computePathBBox(), generateMaskThumbnail(), generateThumbnail(), PathBBox, ThumbnailState, useThumbnailGenerator() (+1 more)

### Community 34 - "asyncLoad"
Cohesion: 0.24
Nodes (10): addRunDependency(), assert(), asyncLoad(), createWasm(), FS_createPreloadedFile(), getUniqueRunDependency(), handleMessage(), instantiateAsync() (+2 more)

### Community 35 - "useViewportStore.ts"
Cohesion: 0.22
Nodes (15): CanvasImageNodeInner(), CanvasPathNodeInner(), CanvasShapeNodeInner(), CANVAS_SCALE, EmptyFrameOverlay(), computeSnapResize(), ElectronFile, getCanvasScale() (+7 more)

### Community 36 - "callRuntimeCallbacks"
Cohesion: 0.25
Nodes (8): addOnPostRun(), addOnPreRun(), callRuntimeCallbacks(), initRuntime(), postRun(), preRun(), run(), setTimeout()

### Community 37 - "Tooltip"
Cohesion: 0.17
Nodes (9): Module-level activeTooltipCount (instant tooltip on hover when any tooltip is visible), hudBtnStyle, FrameLabelStrip(), FrameLabelStripProps, frameSlotOffset(), isEmptyFrame(), LayerPanel(), Tooltip() (+1 more)

### Community 38 - "CanvasVideoNode.tsx"
Cohesion: 0.22
Nodes (18): anchorsToPathData(), CanvasVideoNode, CanvasVideoNodeInner(), CanvasVideoNodeInnerProps, CanvasVideoNodeOuter(), CanvasVideoNodeProps, ClipEditOverlay(), ClipEditOverlayProps (+10 more)

### Community 39 - "devDependencies"
Cohesion: 0.05
Nodes (40): electron, electron-vite, author, description, devDependencies, electron, electron-vite, playwright (+32 more)

### Community 40 - "useCanvasStore.ts"
Cohesion: 0.12
Nodes (13): Undo/Redo History (past/future snapshots), removeBg, normalizeAnchors(), fitCover(), ActiveTool, buildFilledFrame(), buildFrameFromShape(), frameToEmptyImage() (+5 more)

### Community 41 - "emscripten_realloc_buffer"
Cohesion: 0.40
Nodes (5): _emscripten_get_heap_max(), emscripten_realloc_buffer(), _emscripten_resize_heap(), getHeapMax(), updateMemoryViews()

### Community 42 - "getEnvStrings"
Cohesion: 0.40
Nodes (5): _environ_get(), _environ_sizes_get(), getEnvStrings(), getExecutableName(), stringToAscii()

### Community 43 - "Electron Vite Config"
Cohesion: 0.25
Nodes (7): Electron-Vite Three-Target Build (main/preload/renderer), Electron Vite Config, electron.vite.config.ts, include, src/electron/**/*, src/preload/**/*, TypeScript Root Config

### Community 44 - "shared.tsx"
Cohesion: 0.18
Nodes (12): FontPicker(), MAC_SYSTEM_FONTS, AlignDistributeSection(), AlignDistributeSectionProps, alignButtonStyle(), distributeButtonStyle(), MixedNumberField(), MixedNumberFieldProps (+4 more)

### Community 45 - "VideoSection.tsx"
Cohesion: 0.23
Nodes (12): iconBtnStyle(), AdjustmentsSection(), AdjustmentsSectionProps, subGroupLabelStyle, TRACK_GRADIENT, EffectsSection(), EffectsSectionProps, sectionLabelStyle (+4 more)

### Community 50 - "CanvasImageNode.tsx"
Cohesion: 0.17
Nodes (12): Masking System (pen/rect/ellipse), Photo Adjustments Pipeline, CanvasImageNode, CanvasImageNodeInnerProps, CanvasImageNodeProps, NOTE: does not call onGuidesChange — guides are emitted by the onTransform, canBecomeFrame(), findDropTargetId() (+4 more)

### Community 57 - "Main Process (Electron)"
Cohesion: 0.23
Nodes (12): currentFilePath in useSaveStatusStore, addRecentFile(), IPC: autosave-project, createWindow(), getRecentFilesPath(), IPC: get-system-fonts, IPC: list-recent-projects, Main Process (Electron) (+4 more)

### Community 66 - "ui/index.ts"
Cohesion: 0.23
Nodes (9): react, react, GRID_TEMPLATES, formatVal(), NumericInput(), NumericInputProps, isFrameObject(), PropertiesPanel() (+1 more)

### Community 67 - "FrameSection.tsx"
Cohesion: 0.23
Nodes (10): buttonStyle, clipKindLabel(), destructiveButtonStyle, FrameSection(), FrameSectionProps, labelStyle, rowStyle, pickImageMedia() (+2 more)

### Community 68 - "compilerOptions"
Cohesion: 0.18
Nodes (11): compilerOptions, composite, module, moduleResolution, noEmit, noImplicitReturns, noUnusedLocals, noUnusedParameters (+3 more)

### Community 69 - "classes.js"
Cohesion: 0.22
Nodes (5): id, ids, trans, ERROR_TERMINATED, getMessageID

### Community 70 - "56-update.md"
Cohesion: 0.22
Nodes (8): Benefits, Content-Frame Relationship Consistency, Critical Considerations, Current Problem, Leverage Existing Grid System, Proposed Direction, Research & Exploration, Smart Guides & Alignment

### Community 71 - "store/index.ts"
Cohesion: 0.33
Nodes (6): ExportState, useExportStore, SaveStatus, SaveStatusState, trackSave(), useSaveStatusStore

### Community 72 - "IPC: edit-in-external-app"
Cohesion: 0.32
Nodes (8): IPC: edit-in-external-app, ExternalEditor, IPC Push: external-image-changed, IPC: get-external-editor, Preferences, IPC: stop-external-edit, tempFiles, watchers

### Community 73 - "color.ts"
Cohesion: 0.43
Nodes (7): clamp(), hexToHsl(), hexToRgb(), hslToHex(), hslToRgb(), rgbToHex(), rgbToHsl()

### Community 74 - "LazyUint8Array"
Cohesion: 0.40
Nodes (3): LazyUint8Array(), writeChunks(), start()

### Community 75 - "shortcuts.ts"
Cohesion: 0.40
Nodes (3): SHORTCUT_GROUPS, ShortcutEntry, ShortcutGroup

### Community 76 - "readFile"
Cohesion: 0.40
Nodes (5): readFile(), writeFile(), getPreferencesPath(), readPreferences(), writePreferences()

## Knowledge Gaps
- **335 isolated node(s):** `name`, `version`, `description`, `main`, `author` (+330 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `ffmpeg-core.js`, `ui/index.ts`, `devDependencies`?**
  _High betweenness centrality (0.334) - this node is a cross-community bridge._
- **Why does `react` connect `ui/index.ts` to `dependencies`, `ColorInput.tsx`, `CanvasImageNode.tsx`?**
  _High betweenness centrality (0.166) - this node is a cross-community bridge._
- **Why does `Electron Vite Config` connect `Electron Vite Config` to `test-axis-lock.mjs`, `test-video.mjs`, `debug-selection.mjs`, `devDependencies`?**
  _High betweenness centrality (0.133) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _335 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `useSnapGuides.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Should `ffmpeg-core.js` be split into smaller, more focused modules?**
  _Cohesion score 0.03989071038251366 - nodes in this community are weakly interconnected._
- **Should `canvas.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08874912648497554 - nodes in this community are weakly interconnected._