# Graph Report - .  (2026-06-04)

## Corpus Check
- 37 files · ~66,628 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 862 nodes · 1399 edges · 61 communities (46 shown, 15 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 49 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Canvas Node Rendering|Canvas Node Rendering]]
- [[_COMMUNITY_FFmpeg WASM Core (wasi)|FFmpeg WASM Core (wasi)]]
- [[_COMMUNITY_Multi-Select Transform Tests|Multi-Select Transform Tests]]
- [[_COMMUNITY_Electron Main Process|Electron Main Process]]
- [[_COMMUNITY_Type Definitions|Type Definitions]]
- [[_COMMUNITY_Build Config & Debug Scripts|Build Config & Debug Scripts]]
- [[_COMMUNITY_FFmpeg Classes|FFmpeg Classes]]
- [[_COMMUNITY_Properties Panel & Font Picker|Properties Panel & Font Picker]]
- [[_COMMUNITY_Package & Dependencies|Package & Dependencies]]
- [[_COMMUNITY_Video Object Tests|Video Object Tests]]
- [[_COMMUNITY_Adjustment Pipeline & LUTs|Adjustment Pipeline & LUTs]]
- [[_COMMUNITY_Agent Definitions|Agent Definitions]]
- [[_COMMUNITY_UndoRedo Tests|Undo/Redo Tests]]
- [[_COMMUNITY_Text Spans & Styling|Text Spans & Styling]]
- [[_COMMUNITY_TS Web Config|TS Web Config]]
- [[_COMMUNITY_Layer Effects (FilmHalation)|Layer Effects (Film/Halation)]]
- [[_COMMUNITY_Save Path Tests|Save Path Tests]]
- [[_COMMUNITY_Canvas Type Declarations|Canvas Type Declarations]]
- [[_COMMUNITY_AI Context & Store|AI Context & Store]]
- [[_COMMUNITY_Preview Shell & Video Overlay|Preview Shell & Video Overlay]]
- [[_COMMUNITY_CLAUDE.md Documentation|CLAUDE.md Documentation]]
- [[_COMMUNITY_Export & Video Frame Capture|Export & Video Frame Capture]]
- [[_COMMUNITY_FFmpeg WASM Syscalls|FFmpeg WASM Syscalls]]
- [[_COMMUNITY_Axis Lock Tests|Axis Lock Tests]]
- [[_COMMUNITY_App Entry & Frame Settings|App Entry & Frame Settings]]
- [[_COMMUNITY_FFmpeg WASM Invoke Helpers|FFmpeg WASM Invoke Helpers]]
- [[_COMMUNITY_UI Toolbar & Save Status|UI Toolbar & Save Status]]
- [[_COMMUNITY_TS Node Config|TS Node Config]]
- [[_COMMUNITY_FFmpeg WASM Runtime Stubs|FFmpeg WASM Runtime Stubs]]
- [[_COMMUNITY_FFmpeg WASM Network|FFmpeg WASM Network]]
- [[_COMMUNITY_README Documentation|README Documentation]]
- [[_COMMUNITY_FFmpeg WASM Date Utils|FFmpeg WASM Date Utils]]
- [[_COMMUNITY_FFmpeg WASM Async Load|FFmpeg WASM Async Load]]
- [[_COMMUNITY_FFmpeg WASM Runtime Init|FFmpeg WASM Runtime Init]]
- [[_COMMUNITY_Playwright E2E Testing|Playwright E2E Testing]]
- [[_COMMUNITY_FFmpeg WASM Socket Utils|FFmpeg WASM Socket Utils]]
- [[_COMMUNITY_Layer Panel & Tooltips|Layer Panel & Tooltips]]
- [[_COMMUNITY_FFmpeg WASM Heap Mgmt|FFmpeg WASM Heap Mgmt]]
- [[_COMMUNITY_FFmpeg WASM Env Utils|FFmpeg WASM Env Utils]]
- [[_COMMUNITY_Adjustment Bypass & Icon Btn|Adjustment Bypass & Icon Btn]]
- [[_COMMUNITY_FFmpeg WASM Exec|FFmpeg WASM Exec]]
- [[_COMMUNITY_Claude Settings Hooks|Claude Settings Hooks]]
- [[_COMMUNITY_Claude Local Permissions|Claude Local Permissions]]
- [[_COMMUNITY_Canvas Store Types|Canvas Store Types]]
- [[_COMMUNITY_Electron API Types|Electron API Types]]
- [[_COMMUNITY_TS Root Config|TS Root Config]]
- [[_COMMUNITY_Frame Label Invariant|Frame Label Invariant]]
- [[_COMMUNITY_Frame Height Invariant|Frame Height Invariant]]
- [[_COMMUNITY_ShapeEllipse Invariant|Shape/Ellipse Invariant]]
- [[_COMMUNITY_HTML Entry Point|HTML Entry Point]]
- [[_COMMUNITY_On-Device AI (Upcoming)|On-Device AI (Upcoming)]]
- [[_COMMUNITY_Claude Local Settings|Claude Local Settings]]
- [[_COMMUNITY_TextSpans Module|TextSpans Module]]
- [[_COMMUNITY_AI Index Exports|AI Index Exports]]
- [[_COMMUNITY_README Root|README Root]]
- [[_COMMUNITY_Carousel File Format|Carousel File Format]]

## God Nodes (most connected - your core abstractions)
1. `buildFilterPipeline()` - 19 edges
2. `CanvasObject` - 18 edges
3. `compilerOptions` - 14 edges
4. `getWasmTableEntry()` - 14 edges
5. `Zero Seams — AI Dev Guide` - 14 edges
6. `SnapGuide` - 13 edges
7. `Toolbar()` - 12 edges
8. `compilerOptions` - 11 edges
9. `ImageObject` - 11 edges
10. `abort()` - 10 edges

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

## Communities (61 total, 15 thin omitted)

### Community 0 - "Canvas Node Rendering"
Cohesion: 0.06
Nodes (47): removeBg, CanvasImageNodeInner(), CanvasImageNodeProps, anchorsToPathData(), CanvasPathNodeOuter(), computePathBBox(), CanvasShapeNode, CanvasShapeNodeInner() (+39 more)

### Community 1 - "FFmpeg WASM Core (wasi)"
Cohesion: 0.04
Nodes (20): bigintToI53Checked(), DEFAULT_ARGS, DEFAULT_ARGS_FFPROBE, doCallback(), done(), doReadv(), doWritev(), _emscripten_asm_const_int() (+12 more)

### Community 2 - "Multi-Select Transform Tests"
Cohesion: 0.06
Nodes (39): clearAll(), clickKonvaCenter(), consoleLogs, drag(), drawRect(), ELECTRON_BIN, escape(), failures (+31 more)

### Community 3 - "Electron Main Process"
Cohesion: 0.07
Nodes (41): currentFilePath in useSaveStatusStore, addRecentFile(), IPC: autosave-project, body, corpHeaders, createWindow(), dir, editDir (+33 more)

### Community 4 - "Type Definitions"
Cohesion: 0.15
Nodes (36): Non-Destructive Photo Adjustments Pipeline, AIOperation, AIOperationBase, AIOperationStatus, BackgroundRemovalOperation, InpaintingOperation, SegmentationOperation, AnchorPoint (+28 more)

### Community 5 - "Build Config & Debug Scripts"
Cohesion: 0.06
Nodes (31): Electron-Vite Three-Target Build (main/preload/renderer), Electron Vite Config, allInputs, dblLogs, div, firstText, inp, labels (+23 more)

### Community 6 - "FFmpeg Classes"
Cohesion: 0.09
Nodes (10): FFmpeg, id, ids, trans, ERROR_IMPORT_FAILURE, ERROR_NOT_LOADED, ERROR_TERMINATED, ERROR_UNKNOWN_MESSAGE_TYPE (+2 more)

### Community 7 - "Properties Panel & Font Picker"
Cohesion: 0.09
Nodes (20): rotateAroundCenter: Konva Rect/Text rotate around top-left not center; ellipse exempt, MAC_SYSTEM_FONTS, AdjustmentsSectionProps, alignButtonStyle(), AlignDistributeSection(), distributeButtonStyle(), EffectsSectionProps, formatDuration() (+12 more)

### Community 8 - "Package & Dependencies"
Cohesion: 0.08
Nodes (25): author, dependencies, chokidar, @ffmpeg/ffmpeg, @ffmpeg/util, @imgly/background-removal, konva, lucide-react (+17 more)

### Community 9 - "Video Object Tests"
Cohesion: 0.09
Nodes (21): eq(), errors, failures, loaded, newVideoErrors, nonProtocolErrors, objects, ok() (+13 more)

### Community 10 - "Adjustment Pipeline & LUTs"
Cohesion: 0.16
Nodes (22): adjFingerprint(), build3DLUT(), buildFilterPipeline(), buildFloatLUT(), buildLUT(), floatLutCache, isAllDefault(), lut3dCache (+14 more)

### Community 11 - "Agent Definitions"
Cohesion: 0.10
Nodes (25): Agent Domain Isolation (no cross-domain edits), Rationale: Agents must not cross domain boundaries (ui/canvas/ai separation), Agent: ai-engineer, src/ai/ (ai-engineer domain), Agent: canvas-engineer, src/canvas/ (canvas-engineer domain), Agent: qa-reviewer, Agent: ui-engineer (+17 more)

### Community 12 - "Undo/Redo Tests"
Cohesion: 0.09
Nodes (12): ELECTRON_BIN, eq(), failures, getState(), gs(), mask, ok(), orderBefore (+4 more)

### Community 13 - "Text Spans & Styling"
Cohesion: 0.17
Nodes (18): applyStyleToAll(), applyStyleToRange(), ResolvedSpanStyle, SelectionStyle, getSelectionStyle(), mergeAdjacentSpans(), resolveSpanStyle(), SelectionStyle (+10 more)

### Community 14 - "TS Web Config"
Cohesion: 0.11
Nodes (17): compilerOptions, composite, jsx, lib, module, moduleResolution, noEmit, noImplicitReturns (+9 more)

### Community 15 - "Layer Effects (Film/Halation)"
Cohesion: 0.24
Nodes (10): boxBlurH(), boxBlurV(), buildFilter(), hexToRgb(), EffectControlDescriptor, EffectDefinition, EffectParams, getEffectDefinition() (+2 more)

### Community 16 - "Save Path Tests"
Cohesion: 0.12
Nodes (7): consoleLogs, content, ELECTRON_BIN, existingPath, failures, ROOT, testFile

### Community 17 - "Canvas Type Declarations"
Cohesion: 0.12
Nodes (16): AnchorPoint, BaseCanvasObject, CanvasObject, CanvasObjectScope, CanvasObjectType, FontStyle, GroupObject, ImageObject (+8 more)

### Community 18 - "AI Context & Store"
Cohesion: 0.19
Nodes (9): AIContext, AIContextValue, useAI(), AIStoreState, useAIStore, UseBackgroundRemovalReturn, syncGroupOnTransform, Frame/Content Two-Layer Model (+1 more)

### Community 19 - "Preview Shell & Video Overlay"
Cohesion: 0.23
Nodes (9): FrameSlideProps, VideoOverlayItemProps, FacebookShell(), InstagramShell(), getShell(), PlatformShellProps, registerShell(), SHELL_REGISTRY (+1 more)

### Community 20 - "CLAUDE.md Documentation"
Cohesion: 0.12
Nodes (15): code:block1 (graphify query "<your question>"), Core Concepts — never break these, Export (`src/canvas/exportFrames.ts`), Features Implemented (sprints 1–42 + issue #20), File Ownership, graphify, Key Architecture, Keyboard Shortcuts (+7 more)

### Community 21 - "Export & Video Frame Capture"
Cohesion: 0.24
Nodes (12): captureVideoFrameSequence(), exportMixedFrames(), ExportResult, canvas/index exports, getVideoElement(), registerVideoElement(), registry, encodeVideoFrames() (+4 more)

### Community 22 - "FFmpeg WASM Syscalls"
Cohesion: 0.18
Nodes (15): alignMemory(), getSocketAddress(), getSocketFromFD(), mmapAlloc(), ___syscall_accept4(), ___syscall_bind(), ___syscall_connect(), ___syscall_getpeername() (+7 more)

### Community 23 - "Axis Lock Tests"
Cohesion: 0.18
Nodes (8): clickAt(), drag(), ELECTRON_BIN, failures, getStageInfo(), k2p(), ROOT, wait()

### Community 24 - "App Entry & Frame Settings"
Cohesion: 0.15
Nodes (12): Save Split-Button Pattern (Save / Save As / Save a Copy), App(), rootEl, FrameSettingsPopoverProps, labelStyle, numberInputStyle, PLATFORM_LABELS, PLATFORMS (+4 more)

### Community 25 - "FFmpeg WASM Invoke Helpers"
Cohesion: 0.14
Nodes (14): getWasmTableEntry(), invoke_i(), invoke_ii(), invoke_iii(), invoke_iiii(), invoke_iiiii(), invoke_iiiiii(), invoke_iiiiiiiii() (+6 more)

### Community 26 - "UI Toolbar & Save Status"
Cohesion: 0.18
Nodes (9): VideoExportSettings, ActiveTool, PLATFORM_RECOMMENDED, PresetKey, VIDEO_PRESETS, SaveStatus, SaveStatusState, SaveStatus (+1 more)

### Community 27 - "TS Node Config"
Cohesion: 0.15
Nodes (12): compilerOptions, composite, module, moduleResolution, noEmit, noImplicitReturns, noUnusedLocals, noUnusedParameters (+4 more)

### Community 28 - "FFmpeg WASM Runtime Stubs"
Cohesion: 0.18
Nodes (11): abort(), assert(), _dlopen(), ___dlsym(), getBinary(), getValue(), handleMessage(), initRandomFill() (+3 more)

### Community 29 - "FFmpeg WASM Network"
Cohesion: 0.22
Nodes (11): _getnameinfo(), inetNtop4(), inetNtop6(), intArrayFromString(), lengthBytesUTF8(), readSockaddr(), stringToNewUTF8(), stringToUTF8() (+3 more)

### Community 30 - "README Documentation"
Cohesion: 0.18
Nodes (10): code:bash (git clone https://github.com/alexejwaser/zeroseams.git), code:bash (node node_modules/electron/install.js), code:bash (npm install electron --save-dev), Download, Features, If you see `Error: Electron uninstall` after `npm install`, License, Running Locally (+2 more)

### Community 31 - "FFmpeg WASM Date Utils"
Cohesion: 0.20
Nodes (10): addDays(), arraySum(), __gmtime_js(), isLeapYear(), __localtime_js(), __mktime_js(), readI53FromI64(), _strftime() (+2 more)

### Community 32 - "FFmpeg WASM Async Load"
Cohesion: 0.28
Nodes (9): addRunDependency(), asyncLoad(), createWasm(), FS_createPreloadedFile(), getBinaryPromise(), getUniqueRunDependency(), instantiateArrayBuffer(), instantiateAsync() (+1 more)

### Community 33 - "FFmpeg WASM Runtime Init"
Cohesion: 0.25
Nodes (8): addOnPostRun(), addOnPreRun(), callRuntimeCallbacks(), initRuntime(), postRun(), preRun(), run(), setTimeout()

### Community 34 - "Playwright E2E Testing"
Cohesion: 0.43
Nodes (7): Playwright Electron Integration Testing Pattern, Window Store Exposure for E2E Tests (__canvasStore__, __viewportStore__, __saveStatusStore__), debug-selection Playwright Script, test-axis-lock Playwright Script, test-multiselect-transform Playwright Script, test-save-path Playwright Script, verify-mask-draw Playwright Script

### Community 35 - "FFmpeg WASM Socket Utils"
Cohesion: 0.29
Nodes (7): ___assert_fail(), _getaddrinfo(), inetPton4(), inetPton6(), jstoi_q(), UTF8ArrayToString(), UTF8ToString()

### Community 36 - "Layer Panel & Tooltips"
Cohesion: 0.33
Nodes (3): Module-level activeTooltipCount (instant tooltip on hover when any tooltip is visible), Tooltip(), TooltipProps

### Community 37 - "FFmpeg WASM Heap Mgmt"
Cohesion: 0.40
Nodes (5): _emscripten_get_heap_max(), emscripten_realloc_buffer(), _emscripten_resize_heap(), getHeapMax(), updateMemoryViews()

### Community 38 - "FFmpeg WASM Env Utils"
Cohesion: 0.40
Nodes (5): _environ_get(), _environ_sizes_get(), getEnvStrings(), getExecutableName(), stringToAscii()

### Community 39 - "Adjustment Bypass & Icon Btn"
Cohesion: 0.40
Nodes (4): Photo Adjustments Bypass Toggle (hold-to-compare \ key + persistent Power button), AdjustmentsSection(), EffectsSection(), TitleBar()

### Community 40 - "FFmpeg WASM Exec"
Cohesion: 0.50
Nodes (4): exec(), ffprobe(), stringsToPtr(), stringToPtr()

## Knowledge Gaps
- **283 isolated node(s):** `composite`, `noEmit`, `module`, `moduleResolution`, `target` (+278 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Package & Dependencies` to `FFmpeg WASM Core (wasi)`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Why does `Electron Vite Config` connect `Build Config & Debug Scripts` to `Video Object Tests`, `Axis Lock Tests`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `Build Config & Debug Scripts` to `Package & Dependencies`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **What connects `composite`, `noEmit`, `module` to the rest of the system?**
  _293 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Canvas Node Rendering` be split into smaller, more focused modules?**
  _Cohesion score 0.06322624743677376 - nodes in this community are weakly interconnected._
- **Should `FFmpeg WASM Core (wasi)` be split into smaller, more focused modules?**
  _Cohesion score 0.03825136612021858 - nodes in this community are weakly interconnected._
- **Should `Multi-Select Transform Tests` be split into smaller, more focused modules?**
  _Cohesion score 0.058279370952821465 - nodes in this community are weakly interconnected._