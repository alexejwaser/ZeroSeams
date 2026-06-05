# Graph Report - src  (2026-06-05)

## Corpus Check
- 79 files · ~77,260 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1040 nodes · 2298 edges · 70 communities (53 shown, 17 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 67 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8ffc633d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Canvas Node Rendering|Canvas Node Rendering]]
- [[_COMMUNITY_FFmpeg Core Runtime|FFmpeg Core Runtime]]
- [[_COMMUNITY_Multiselect Transform Tests|Multiselect Transform Tests]]
- [[_COMMUNITY_Electron Main Process|Electron Main Process]]
- [[_COMMUNITY_Canvas Types & Grid Overlay|Canvas Types & Grid Overlay]]
- [[_COMMUNITY_FFmpeg Class API|FFmpeg Class API]]
- [[_COMMUNITY_Adjustment Pipeline & LUTs|Adjustment Pipeline & LUTs]]
- [[_COMMUNITY_Package Dependencies|Package Dependencies]]
- [[_COMMUNITY_Video Test Suite|Video Test Suite]]
- [[_COMMUNITY_Agent Definitions|Agent Definitions]]
- [[_COMMUNITY_Properties Panel UI|Properties Panel UI]]
- [[_COMMUNITY_Export & Path Utilities|Export & Path Utilities]]
- [[_COMMUNITY_UndoRedo Test Suite|Undo/Redo Test Suite]]
- [[_COMMUNITY_Text Span Editing|Text Span Editing]]
- [[_COMMUNITY_TSConfig Web|TSConfig Web]]
- [[_COMMUNITY_Save Path Tests|Save Path Tests]]
- [[_COMMUNITY_Debug Selection Scripts|Debug Selection Scripts]]
- [[_COMMUNITY_AI Store & Context|AI Store & Context]]
- [[_COMMUNITY_Visual Effects Pipeline|Visual Effects Pipeline]]
- [[_COMMUNITY_Preview & Platform Shells|Preview & Platform Shells]]
- [[_COMMUNITY_Canvas Type Definitions|Canvas Type Definitions]]
- [[_COMMUNITY_Color Input UI|Color Input UI]]
- [[_COMMUNITY_CLAUDE.md Architecture Docs|CLAUDE.md Architecture Docs]]
- [[_COMMUNITY_FFmpeg Network Syscalls|FFmpeg Network Syscalls]]
- [[_COMMUNITY_Axis Lock Tests|Axis Lock Tests]]
- [[_COMMUNITY_App Root & Frame Settings|App Root & Frame Settings]]
- [[_COMMUNITY_FFmpeg Wasm Invoke Helpers|FFmpeg Wasm Invoke Helpers]]
- [[_COMMUNITY_Grid Templates & Picker|Grid Templates & Picker]]
- [[_COMMUNITY_TSConfig Node|TSConfig Node]]
- [[_COMMUNITY_FFmpeg Low-Level Helpers|FFmpeg Low-Level Helpers]]
- [[_COMMUNITY_FFmpeg Network Utilities|FFmpeg Network Utilities]]
- [[_COMMUNITY_README Docs|README Docs]]
- [[_COMMUNITY_FFmpeg DateTime Helpers|FFmpeg Date/Time Helpers]]
- [[_COMMUNITY_FFmpeg Wasm LoadInit|FFmpeg Wasm Load/Init]]
- [[_COMMUNITY_FFmpeg Runtime Callbacks|FFmpeg Runtime Callbacks]]
- [[_COMMUNITY_Autosave & Save Status|Autosave & Save Status]]
- [[_COMMUNITY_FFmpeg String Utilities|FFmpeg String Utilities]]
- [[_COMMUNITY_Dev Dependencies|Dev Dependencies]]
- [[_COMMUNITY_Playwright E2E Test Concepts|Playwright E2E Test Concepts]]
- [[_COMMUNITY_Layer Panel & Tooltip|Layer Panel & Tooltip]]
- [[_COMMUNITY_Mask Draw Verify Script|Mask Draw Verify Script]]
- [[_COMMUNITY_FFmpeg Heap Management|FFmpeg Heap Management]]
- [[_COMMUNITY_FFmpeg Environ Helpers|FFmpeg Environ Helpers]]
- [[_COMMUNITY_Electron-Vite Build Config|Electron-Vite Build Config]]
- [[_COMMUNITY_Adjustment Bypass & Icon Style|Adjustment Bypass & Icon Style]]
- [[_COMMUNITY_FFmpeg Exec & Probe|FFmpeg Exec & Probe]]
- [[_COMMUNITY_Claude Settings Hooks|Claude Settings Hooks]]
- [[_COMMUNITY_Claude Local Permissions|Claude Local Permissions]]
- [[_COMMUNITY_Store History Snapshot Types|Store History Snapshot Types]]
- [[_COMMUNITY_Electron Window Types|Electron Window Types]]
- [[_COMMUNITY_TSConfig Root|TSConfig Root]]
- [[_COMMUNITY_Frame Labels Rationale|Frame Labels Rationale]]
- [[_COMMUNITY_Key Ratio Rationale|Key Ratio Rationale]]
- [[_COMMUNITY_ShapeEllipse Rationale|Shape/Ellipse Rationale]]
- [[_COMMUNITY_HTML Entry Point|HTML Entry Point]]
- [[_COMMUNITY_AI Background Removal Docs|AI Background Removal Docs]]
- [[_COMMUNITY_Electron Preload|Electron Preload]]
- [[_COMMUNITY_Claude Local Settings|Claude Local Settings]]
- [[_COMMUNITY_Text Spans Module|Text Spans Module]]
- [[_COMMUNITY_AI Index|AI Index]]
- [[_COMMUNITY_README Root|README Root]]
- [[_COMMUNITY_Carousel File Concept|Carousel File Concept]]
- [[_COMMUNITY_Community 66|Community 66]]

## God Nodes (most connected - your core abstractions)
1. `useCanvasStore` - 52 edges
2. `SnapGuide` - 26 edges
3. `CanvasObject` - 24 edges
4. `buildFilterPipeline()` - 23 edges
5. `CANVAS_SCALE` - 20 edges
6. `ImageObject` - 19 edges
7. `useViewportStore` - 19 edges
8. `useSnapGuides()` - 17 edges
9. `ToolBar()` - 16 edges
10. `axisLock()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `Agent: qa-reviewer` --references--> `Zustand Store (src/store/index.ts)`  [INFERRED]
  .claude/agents/qa-reviewer.md → src/store/index.ts
- `Zustand Store (src/store/index.ts)` --shares_data_with--> `Multi-Select Architecture`  [INFERRED]
  src/store/index.ts → CLAUDE.md
- `Zustand Store (src/store/index.ts)` --shares_data_with--> `Adjustments Bypass Toggle`  [INFERRED]
  src/store/index.ts → CLAUDE.md
- `Zustand Store (src/store/index.ts)` --shares_data_with--> `Masking System (pen/rect/ellipse)`  [INFERRED]
  src/store/index.ts → CLAUDE.md
- `Zustand Store (src/store/index.ts)` --shares_data_with--> `History (past/future snapshots)`  [INFERRED]
  src/store/index.ts → CLAUDE.md

## Communities (70 total, 17 thin omitted)

### Community 0 - "Canvas Node Rendering"
Cohesion: 0.05
Nodes (87): removeBg, CanvasGroupNode(), CanvasGroupNodeInner, CanvasGroupNodeProps, hitTestCell(), CanvasGuidelineNode, CanvasGuidelineNodeInner(), CanvasGuidelineNodeOuter() (+79 more)

### Community 1 - "FFmpeg Core Runtime"
Cohesion: 0.04
Nodes (20): bigintToI53Checked(), DEFAULT_ARGS, DEFAULT_ARGS_FFPROBE, doCallback(), done(), doReadv(), doWritev(), _emscripten_asm_const_int() (+12 more)

### Community 2 - "Multiselect Transform Tests"
Cohesion: 0.06
Nodes (39): clearAll(), clickKonvaCenter(), consoleLogs, drag(), drawRect(), ELECTRON_BIN, escape(), failures (+31 more)

### Community 3 - "Electron Main Process"
Cohesion: 0.09
Nodes (45): currentFilePath in useSaveStatusStore, addRecentFile(), IPC: autosave-project, body, buf, buffer, corpHeaders, createWindow() (+37 more)

### Community 4 - "Canvas Types & Grid Overlay"
Cohesion: 0.16
Nodes (42): Non-Destructive Photo Adjustments Pipeline, AIOperation, AIOperationBase, AIOperationStatus, AIOperationType, BackgroundRemovalOperation, InpaintingOperation, SegmentationOperation (+34 more)

### Community 5 - "FFmpeg Class API"
Cohesion: 0.09
Nodes (10): FFmpeg, id, ids, trans, ERROR_IMPORT_FAILURE, ERROR_NOT_LOADED, ERROR_TERMINATED, ERROR_UNKNOWN_MESSAGE_TYPE (+2 more)

### Community 6 - "Adjustment Pipeline & LUTs"
Cohesion: 0.22
Nodes (25): adjFingerprint(), build3DLUT(), buildFilterPipeline(), buildFloatLUT(), buildLUT(), floatLutCache, hslToRgb(), isAllDefault() (+17 more)

### Community 7 - "Package Dependencies"
Cohesion: 0.08
Nodes (25): author, dependencies, chokidar, @ffmpeg/ffmpeg, @ffmpeg/util, @imgly/background-removal, konva, lucide-react (+17 more)

### Community 8 - "Video Test Suite"
Cohesion: 0.09
Nodes (21): eq(), errors, failures, loaded, newVideoErrors, nonProtocolErrors, objects, ok() (+13 more)

### Community 9 - "Agent Definitions"
Cohesion: 0.10
Nodes (25): Agent Domain Isolation (no cross-domain edits), Rationale: Agents must not cross domain boundaries (ui/canvas/ai separation), Agent: ai-engineer, src/ai/ (ai-engineer domain), Agent: canvas-engineer, src/canvas/ (canvas-engineer domain), Agent: qa-reviewer, Agent: ui-engineer (+17 more)

### Community 10 - "Properties Panel UI"
Cohesion: 0.14
Nodes (25): rotateAroundCenter: Konva Rect/Text rotate around top-left not center; ellipse exempt, FontPicker(), MAC_SYSTEM_FONTS, AdjustmentsSectionProps, alignButtonStyle(), AlignDistributeSection(), AlignDistributeSectionProps, CanvasSection() (+17 more)

### Community 11 - "Export & Path Utilities"
Cohesion: 0.20
Nodes (16): captureVideoFrameSequence(), downloadFrames(), exportMixedFrames(), ExportResult, getVideoElement(), registerVideoElement(), registry, unregisterVideoElement() (+8 more)

### Community 12 - "Undo/Redo Test Suite"
Cohesion: 0.09
Nodes (12): ELECTRON_BIN, eq(), failures, getState(), gs(), mask, ok(), orderBefore (+4 more)

### Community 13 - "Text Span Editing"
Cohesion: 0.16
Nodes (22): applyStyleToAll(), applyStyleToRange(), ResolvedSpanStyle, SelectionStyle, fontStyleToCSS(), getSelectionStyle(), mergeAdjacentSpans(), ResolvedSpanStyle (+14 more)

### Community 14 - "TSConfig Web"
Cohesion: 0.11
Nodes (17): compilerOptions, composite, jsx, lib, module, moduleResolution, noEmit, noImplicitReturns (+9 more)

### Community 15 - "Save Path Tests"
Cohesion: 0.12
Nodes (7): consoleLogs, content, ELECTRON_BIN, existingPath, failures, ROOT, testFile

### Community 16 - "Debug Selection Scripts"
Cohesion: 0.12
Nodes (14): allInputs, dblLogs, div, firstText, inp, labels, lbl, logs (+6 more)

### Community 17 - "AI Store & Context"
Cohesion: 0.13
Nodes (20): AIContext, AIContextValue, useAI(), AIProvider(), AIStoreState, useAIStore, useBackgroundRemoval(), UseBackgroundRemovalReturn (+12 more)

### Community 18 - "Visual Effects Pipeline"
Cohesion: 0.26
Nodes (13): buildFilter(), boxBlurH(), boxBlurV(), buildFilter(), hexToRgb(), EffectControlDescriptor, EffectDefinition, EffectParams (+5 more)

### Community 19 - "Preview & Platform Shells"
Cohesion: 0.24
Nodes (14): capturePreviewFrames(), FrameSlide(), FrameSlideProps, PreviewShell(), VideoOverlayItem(), VideoOverlayItemProps, FacebookShell(), InstagramShell() (+6 more)

### Community 20 - "Canvas Type Definitions"
Cohesion: 0.19
Nodes (17): AnchorPoint, BaseCanvasObject, CanvasObject, CanvasObjectScope, CanvasObjectType, FontStyle, GroupObject, GuidelineObject (+9 more)

### Community 21 - "Color Input UI"
Cohesion: 0.26
Nodes (14): clamp(), ColorMode, ColorPopover(), hexToHsl(), hexToRgb(), hslToHex(), loadRecentColors(), MixedColorInput() (+6 more)

### Community 22 - "CLAUDE.md Architecture Docs"
Cohesion: 0.12
Nodes (15): code:block1 (graphify query "<your question>"), Core Concepts — never break these, Export (`src/canvas/exportFrames.ts`), Features Implemented (sprints 1–42 + issue #20), File Ownership, graphify, Key Architecture, Keyboard Shortcuts (+7 more)

### Community 23 - "FFmpeg Network Syscalls"
Cohesion: 0.18
Nodes (15): alignMemory(), getSocketAddress(), getSocketFromFD(), mmapAlloc(), ___syscall_accept4(), ___syscall_bind(), ___syscall_connect(), ___syscall_getpeername() (+7 more)

### Community 24 - "Axis Lock Tests"
Cohesion: 0.18
Nodes (8): clickAt(), drag(), ELECTRON_BIN, failures, getStageInfo(), k2p(), ROOT, wait()

### Community 25 - "App Root & Frame Settings"
Cohesion: 0.33
Nodes (8): ColorInput(), FrameSettingsPopover(), FrameSettingsPopoverProps, labelStyle, numberInputStyle, PLATFORM_LABELS, PLATFORMS, segmentButtonStyle()

### Community 26 - "FFmpeg Wasm Invoke Helpers"
Cohesion: 0.14
Nodes (14): getWasmTableEntry(), invoke_i(), invoke_ii(), invoke_iii(), invoke_iiii(), invoke_iiiii(), invoke_iiiiii(), invoke_iiiiiiiii() (+6 more)

### Community 27 - "Grid Templates & Picker"
Cohesion: 0.14
Nodes (17): Save Split-Button Pattern (Save / Save As / Save a Copy), GridPicker(), ActiveTool, blobToBase64(), buildProjectJson(), PLATFORM_RECOMMENDED, PresetKey, SaveStatusPill() (+9 more)

### Community 28 - "TSConfig Node"
Cohesion: 0.15
Nodes (12): compilerOptions, composite, module, moduleResolution, noEmit, noImplicitReturns, noUnusedLocals, noUnusedParameters (+4 more)

### Community 29 - "FFmpeg Low-Level Helpers"
Cohesion: 0.18
Nodes (11): abort(), assert(), _dlopen(), ___dlsym(), getBinary(), getValue(), handleMessage(), initRandomFill() (+3 more)

### Community 30 - "FFmpeg Network Utilities"
Cohesion: 0.22
Nodes (11): _getnameinfo(), inetNtop4(), inetNtop6(), intArrayFromString(), lengthBytesUTF8(), readSockaddr(), stringToNewUTF8(), stringToUTF8() (+3 more)

### Community 31 - "README Docs"
Cohesion: 0.18
Nodes (10): code:bash (git clone https://github.com/alexejwaser/zeroseams.git), code:bash (node node_modules/electron/install.js), code:bash (npm install electron --save-dev), Download, Features, If you see `Error: Electron uninstall` after `npm install`, License, Running Locally (+2 more)

### Community 32 - "FFmpeg Date/Time Helpers"
Cohesion: 0.20
Nodes (10): addDays(), arraySum(), __gmtime_js(), isLeapYear(), __localtime_js(), __mktime_js(), readI53FromI64(), _strftime() (+2 more)

### Community 33 - "FFmpeg Wasm Load/Init"
Cohesion: 0.28
Nodes (9): addRunDependency(), asyncLoad(), createWasm(), FS_createPreloadedFile(), getBinaryPromise(), getUniqueRunDependency(), instantiateArrayBuffer(), instantiateAsync() (+1 more)

### Community 34 - "FFmpeg Runtime Callbacks"
Cohesion: 0.25
Nodes (8): addOnPostRun(), addOnPreRun(), callRuntimeCallbacks(), initRuntime(), postRun(), preRun(), run(), setTimeout()

### Community 36 - "FFmpeg String Utilities"
Cohesion: 0.29
Nodes (7): ___assert_fail(), _getaddrinfo(), inetPton4(), inetPton6(), jstoi_q(), UTF8ArrayToString(), UTF8ToString()

### Community 37 - "Dev Dependencies"
Cohesion: 0.29
Nodes (7): devDependencies, playwright, @types/chokidar, @types/react, typescript, vite, @vitejs/plugin-react

### Community 38 - "Playwright E2E Test Concepts"
Cohesion: 0.43
Nodes (7): Playwright Electron Integration Testing Pattern, Window Store Exposure for E2E Tests (__canvasStore__, __viewportStore__, __saveStatusStore__), debug-selection Playwright Script, test-axis-lock Playwright Script, test-multiselect-transform Playwright Script, test-save-path Playwright Script, verify-mask-draw Playwright Script

### Community 39 - "Layer Panel & Tooltip"
Cohesion: 0.20
Nodes (9): Photo Adjustments Bypass Toggle (hold-to-compare \ key + persistent Power button), Module-level activeTooltipCount (instant tooltip on hover when any tooltip is visible), iconBtnStyle(), typeLabel(), AdjustmentsSection(), EffectsSection(), Tooltip(), TooltipInner() (+1 more)

### Community 40 - "Mask Draw Verify Script"
Cohesion: 0.40
Nodes (5): fixtureJson, fixturePath, main(), ROOT, shot()

### Community 41 - "FFmpeg Heap Management"
Cohesion: 0.40
Nodes (5): _emscripten_get_heap_max(), emscripten_realloc_buffer(), _emscripten_resize_heap(), getHeapMax(), updateMemoryViews()

### Community 42 - "FFmpeg Environ Helpers"
Cohesion: 0.40
Nodes (5): _environ_get(), _environ_sizes_get(), getEnvStrings(), getExecutableName(), stringToAscii()

### Community 43 - "Electron-Vite Build Config"
Cohesion: 0.40
Nodes (5): Electron-Vite Three-Target Build (main/preload/renderer), Electron Vite Config, TypeScript Node Config, TypeScript Root Config, TypeScript Web Config

### Community 44 - "Adjustment Bypass & Icon Style"
Cohesion: 0.35
Nodes (8): posixDirname(), posixRelative(), posixResolve(), relativizeVideoObjects(), resolveVideoObjects(), buildProjectSnapshot(), Autosave Pipeline, electronAPI

### Community 45 - "FFmpeg Exec & Probe"
Cohesion: 0.50
Nodes (4): exec(), ffprobe(), stringsToPtr(), stringToPtr()

### Community 66 - "Community 66"
Cohesion: 0.43
Nodes (5): CellRect, GRID_TEMPLATES, GridTemplate, uniformGrid(), GridPickerProps

## Knowledge Gaps
- **208 isolated node(s):** `AlignDistributeSectionProps`, `VideoExportSettingsPanelProps`, `UseColorPopoverOptions`, `ImageFormat`, `DEFAULT_IMAGE_EXPORT_SETTINGS` (+203 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `CanvasObject` connect `Canvas Types & Grid Overlay` to `Canvas Node Rendering`, `Export & Path Utilities`, `Canvas Type Definitions`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Why does `useCanvasStore` connect `Canvas Node Rendering` to `Properties Panel UI`, `Text Span Editing`, `AI Store & Context`, `Preview & Platform Shells`, `App Root & Frame Settings`, `Grid Templates & Picker`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Why does `Snap Guide System` connect `Canvas Node Rendering` to `Agent Definitions`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Are the 8 inferred relationships involving `useCanvasStore` (e.g. with `FrameSettingsPopover()` and `VideoSection()`) actually correct?**
  _`useCanvasStore` has 8 INFERRED edges - model-reasoned connections that need verification._
- **What connects `AlignDistributeSectionProps`, `VideoExportSettingsPanelProps`, `UseColorPopoverOptions` to the rest of the system?**
  _218 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Canvas Node Rendering` be split into smaller, more focused modules?**
  _Cohesion score 0.053552554315913097 - nodes in this community are weakly interconnected._
- **Should `FFmpeg Core Runtime` be split into smaller, more focused modules?**
  _Cohesion score 0.03825136612021858 - nodes in this community are weakly interconnected._