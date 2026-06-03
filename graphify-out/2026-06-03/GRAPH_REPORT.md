# Graph Report - ZeroSeams  (2026-06-03)

## Corpus Check
- 97 files · ~82,685 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 912 nodes · 1558 edges · 63 communities (47 shown, 16 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 62 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f645051d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Canvas Node Components|Canvas Node Components]]
- [[_COMMUNITY_E2E Test Helpers|E2E Test Helpers]]
- [[_COMMUNITY_Electron IPC & Save System|Electron IPC & Save System]]
- [[_COMMUNITY_Type System & Declarations|Type System & Declarations]]
- [[_COMMUNITY_Build & Test Infrastructure|Build & Test Infrastructure]]
- [[_COMMUNITY_Agent Domain Architecture|Agent Domain Architecture]]
- [[_COMMUNITY_UI Properties Panel|UI Properties Panel]]
- [[_COMMUNITY_Project Dependencies|Project Dependencies]]
- [[_COMMUNITY_Photo Filter Pipeline|Photo Filter Pipeline]]
- [[_COMMUNITY_Text Span Utilities|Text Span Utilities]]
- [[_COMMUNITY_Layer Effects Framework|Layer Effects Framework]]
- [[_COMMUNITY_TypeScript Config (Web)|TypeScript Config (Web)]]
- [[_COMMUNITY_AI Subsystem|AI Subsystem]]
- [[_COMMUNITY_Playwright Test Scripts|Playwright Test Scripts]]
- [[_COMMUNITY_Video Export Pipeline|Video Export Pipeline]]
- [[_COMMUNITY_Toolbar & Export UI|Toolbar & Export UI]]
- [[_COMMUNITY_Canvas Type Definitions|Canvas Type Definitions]]
- [[_COMMUNITY_Playwright Test Helpers|Playwright Test Helpers]]
- [[_COMMUNITY_TypeScript Config (Node)|TypeScript Config (Node)]]
- [[_COMMUNITY_E2E Test Infrastructure|E2E Test Infrastructure]]
- [[_COMMUNITY_Frame Settings UI|Frame Settings UI]]
- [[_COMMUNITY_Layer Panel & Tooltip|Layer Panel & Tooltip]]
- [[_COMMUNITY_Claude Settings|Claude Settings]]
- [[_COMMUNITY_Canvas Store Types|Canvas Store Types]]
- [[_COMMUNITY_Electron Type Declarations|Electron Type Declarations]]
- [[_COMMUNITY_TypeScript Root Config|TypeScript Root Config]]
- [[_COMMUNITY_Frame Labels Rationale|Frame Labels Rationale]]
- [[_COMMUNITY_KeepRatio Rationale|KeepRatio Rationale]]
- [[_COMMUNITY_Shape Origin Rationale|Shape Origin Rationale]]
- [[_COMMUNITY_Upcoming AI Features|Upcoming AI Features]]
- [[_COMMUNITY_HTML Entry Point|HTML Entry Point]]
- [[_COMMUNITY_Claude Local Settings|Claude Local Settings]]
- [[_COMMUNITY_Text Span Utilities|Text Span Utilities]]
- [[_COMMUNITY_AI Module Exports|AI Module Exports]]
- [[_COMMUNITY_Project README|Project README]]
- [[_COMMUNITY_Project File Format|Project File Format]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]

## God Nodes (most connected - your core abstractions)
1. `useCanvasStore` - 43 edges
2. `buildFilterPipeline()` - 19 edges
3. `CanvasObject` - 18 edges
4. `Toolbar()` - 16 edges
5. `useViewportStore` - 16 edges
6. `getWasmTableEntry()` - 15 edges
7. `SnapGuide` - 15 edges
8. `compilerOptions` - 14 edges
9. `useSnapGuides()` - 14 edges
10. `Zero Seams — AI Dev Guide` - 14 edges

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

## Communities (63 total, 16 thin omitted)

### Community 0 - "Canvas Node Components"
Cohesion: 0.06
Nodes (68): removeBg, CanvasImageNode, CanvasImageNodeInner(), CanvasImageNodeInnerProps, CanvasImageNodeOuter(), CanvasImageNodeProps, anchorsToPathData(), CanvasPathNode (+60 more)

### Community 1 - "E2E Test Helpers"
Cohesion: 0.06
Nodes (39): clearAll(), clickKonvaCenter(), consoleLogs, drag(), drawRect(), ELECTRON_BIN, escape(), failures (+31 more)

### Community 2 - "Electron IPC & Save System"
Cohesion: 0.07
Nodes (41): currentFilePath in useSaveStatusStore, addRecentFile(), IPC: autosave-project, body, corpHeaders, createWindow(), dir, editDir (+33 more)

### Community 3 - "Type System & Declarations"
Cohesion: 0.14
Nodes (38): Non-Destructive Photo Adjustments Pipeline, AIOperation, AIOperationBase, AIOperationStatus, AIOperationType, BackgroundRemovalOperation, InpaintingOperation, SegmentationOperation (+30 more)

### Community 4 - "Build & Test Infrastructure"
Cohesion: 0.05
Nodes (34): Electron-Vite Three-Target Build (main/preload/renderer), Electron Vite Config, allInputs, dblLogs, div, ELECTRON_BIN, firstText, inp (+26 more)

### Community 5 - "Agent Domain Architecture"
Cohesion: 0.10
Nodes (25): Agent Domain Isolation (no cross-domain edits), Rationale: Agents must not cross domain boundaries (ui/canvas/ai separation), Agent: ai-engineer, src/ai/ (ai-engineer domain), Agent: canvas-engineer, src/canvas/ (canvas-engineer domain), Agent: qa-reviewer, Agent: ui-engineer (+17 more)

### Community 6 - "UI Properties Panel"
Cohesion: 0.08
Nodes (24): rotateAroundCenter: Konva Rect/Text rotate around top-left not center; ellipse exempt, FontPicker(), MAC_SYSTEM_FONTS, AdjustmentsSectionProps, alignButtonStyle(), AlignDistributeSection(), AlignDistributeSectionProps, ColorInputProps (+16 more)

### Community 7 - "Project Dependencies"
Cohesion: 0.05
Nodes (36): author, dependencies, chokidar, @ffmpeg/core, @ffmpeg/ffmpeg, @ffmpeg/util, @imgly/background-removal, konva (+28 more)

### Community 8 - "Photo Filter Pipeline"
Cohesion: 0.16
Nodes (22): adjFingerprint(), build3DLUT(), buildFilterPipeline(), buildFloatLUT(), buildLUT(), floatLutCache, isAllDefault(), lut3dCache (+14 more)

### Community 9 - "Text Span Utilities"
Cohesion: 0.13
Nodes (21): applyStyleToAll(), applyStyleToRange(), ResolvedSpanStyle, SelectionStyle, fontStyleToCSS(), getSelectionStyle(), mergeAdjacentSpans(), ResolvedSpanStyle (+13 more)

### Community 10 - "Layer Effects Framework"
Cohesion: 0.22
Nodes (12): boxBlurH(), boxBlurV(), buildFilter(), hexToRgb(), EffectControlDescriptor, EffectDefinition, EffectParams, getAllEffectDefinitions() (+4 more)

### Community 11 - "TypeScript Config (Web)"
Cohesion: 0.11
Nodes (17): compilerOptions, composite, jsx, lib, module, moduleResolution, noEmit, noImplicitReturns (+9 more)

### Community 12 - "AI Subsystem"
Cohesion: 0.19
Nodes (13): AIContext, AIContextValue, useAI(), AIProvider(), AIStoreState, useAIStore, useBackgroundRemoval(), UseBackgroundRemovalReturn (+5 more)

### Community 13 - "Playwright Test Scripts"
Cohesion: 0.12
Nodes (7): consoleLogs, content, ELECTRON_BIN, existingPath, failures, ROOT, testFile

### Community 14 - "Video Export Pipeline"
Cohesion: 0.13
Nodes (22): captureVideoFrameSequence(), downloadFrames(), exportMixedFrames(), ExportResult, canvas/index exports, posixDirname(), posixRelative(), posixResolve() (+14 more)

### Community 15 - "Toolbar & Export UI"
Cohesion: 0.10
Nodes (21): Save Split-Button Pattern (Save / Save As / Save a Copy), Module-level activeTooltipCount (instant tooltip on hover when any tooltip is visible), App(), rootEl, FrameSettingsPopover(), FrameSettingsPopoverProps, labelStyle, numberInputStyle (+13 more)

### Community 16 - "Canvas Type Definitions"
Cohesion: 0.12
Nodes (16): AnchorPoint, BaseCanvasObject, CanvasObject, CanvasObjectScope, CanvasObjectType, FontStyle, GroupObject, ImageObject (+8 more)

### Community 17 - "Playwright Test Helpers"
Cohesion: 0.04
Nodes (24): bigintToI53Checked(), DEFAULT_ARGS, DEFAULT_ARGS_FFPROBE, doCallback(), done(), doReadv(), doWritev(), _emscripten_asm_const_int() (+16 more)

### Community 18 - "TypeScript Config (Node)"
Cohesion: 0.15
Nodes (12): compilerOptions, composite, module, moduleResolution, noEmit, noImplicitReturns, noUnusedLocals, noUnusedParameters (+4 more)

### Community 19 - "E2E Test Infrastructure"
Cohesion: 0.43
Nodes (7): Playwright Electron Integration Testing Pattern, Window Store Exposure for E2E Tests (__canvasStore__, __viewportStore__, __saveStatusStore__), debug-selection Playwright Script, test-axis-lock Playwright Script, test-multiselect-transform Playwright Script, test-save-path Playwright Script, verify-mask-draw Playwright Script

### Community 20 - "Frame Settings UI"
Cohesion: 0.09
Nodes (10): FFmpeg, id, ids, trans, ERROR_IMPORT_FAILURE, ERROR_NOT_LOADED, ERROR_TERMINATED, ERROR_UNKNOWN_MESSAGE_TYPE (+2 more)

### Community 21 - "Layer Panel & Tooltip"
Cohesion: 0.24
Nodes (5): Photo Adjustments Bypass Toggle (hold-to-compare \ key + persistent Power button), iconBtnStyle(), LayerPanel(), AdjustmentsSection(), TooltipProps

### Community 38 - "Community 38"
Cohesion: 0.09
Nodes (22): ELECTRON_BIN, eq(), errors, failures, loaded, newVideoErrors, nonProtocolErrors, objects (+14 more)

### Community 39 - "Community 39"
Cohesion: 0.09
Nodes (12): ELECTRON_BIN, eq(), failures, getState(), gs(), mask, ok(), orderBefore (+4 more)

### Community 40 - "Community 40"
Cohesion: 0.14
Nodes (19): alignMemory(), _getaddrinfo(), getSocketAddress(), getSocketFromFD(), inetPton4(), inetPton6(), jstoi_q(), mmapAlloc() (+11 more)

### Community 41 - "Community 41"
Cohesion: 0.12
Nodes (15): code:block1 (graphify query "<your question>"), Core Concepts — never break these, Export (`src/canvas/exportFrames.ts`), Features Implemented (sprints 1–42 + issue #20), File Ownership, graphify, Key Architecture, Keyboard Shortcuts (+7 more)

### Community 42 - "Community 42"
Cohesion: 0.13
Nodes (15): getWasmTableEntry(), invoke_i(), invoke_ii(), invoke_iii(), invoke_iiii(), invoke_iiiii(), invoke_iiiiii(), invoke_iiiiiiiii() (+7 more)

### Community 43 - "Community 43"
Cohesion: 0.15
Nodes (13): addDays(), arraySum(), ___assert_fail(), __gmtime_js(), isLeapYear(), __localtime_js(), __mktime_js(), readI53FromI64() (+5 more)

### Community 44 - "Community 44"
Cohesion: 0.18
Nodes (11): abort(), assert(), _dlopen(), ___dlsym(), getBinary(), getValue(), handleMessage(), initRandomFill() (+3 more)

### Community 45 - "Community 45"
Cohesion: 0.22
Nodes (11): _getnameinfo(), inetNtop4(), inetNtop6(), intArrayFromString(), lengthBytesUTF8(), readSockaddr(), stringToNewUTF8(), stringToUTF8() (+3 more)

### Community 46 - "Community 46"
Cohesion: 0.18
Nodes (10): code:bash (git clone https://github.com/alexejwaser/zeroseams.git), code:bash (node node_modules/electron/install.js), code:bash (npm install electron --save-dev), Download, Features, If you see `Error: Electron uninstall` after `npm install`, License, Running Locally (+2 more)

### Community 47 - "Community 47"
Cohesion: 0.28
Nodes (9): addRunDependency(), asyncLoad(), createWasm(), FS_createPreloadedFile(), getBinaryPromise(), getUniqueRunDependency(), instantiateArrayBuffer(), instantiateAsync() (+1 more)

### Community 48 - "Community 48"
Cohesion: 0.25
Nodes (8): addOnPostRun(), addOnPreRun(), callRuntimeCallbacks(), initRuntime(), postRun(), preRun(), run(), setTimeout()

### Community 49 - "Community 49"
Cohesion: 0.40
Nodes (4): SaveStatus, SaveStatusState, SaveStatus, SaveStatusState

### Community 50 - "Community 50"
Cohesion: 0.40
Nodes (5): _emscripten_get_heap_max(), emscripten_realloc_buffer(), _emscripten_resize_heap(), getHeapMax(), updateMemoryViews()

### Community 51 - "Community 51"
Cohesion: 0.40
Nodes (5): _environ_get(), _environ_sizes_get(), getEnvStrings(), getExecutableName(), stringToAscii()

## Knowledge Gaps
- **294 isolated node(s):** `composite`, `noEmit`, `module`, `moduleResolution`, `target` (+289 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Snap Guide System` connect `Canvas Node Components` to `Agent Domain Architecture`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Why does `useCanvasStore` connect `Canvas Node Components` to `UI Properties Panel`, `Text Span Utilities`, `AI Subsystem`, `Toolbar & Export UI`, `Layer Panel & Tooltip`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `CanvasObject` connect `Type System & Declarations` to `Canvas Node Components`, `Canvas Type Definitions`, `Video Export Pipeline`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `useCanvasStore` (e.g. with `FrameSettingsPopover()` and `VideoSection()`) actually correct?**
  _`useCanvasStore` has 6 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `Toolbar()` (e.g. with `useCanvasStore` and `useCanvasStore.ts`) actually correct?**
  _`Toolbar()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `composite`, `noEmit`, `module` to the rest of the system?**
  _304 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Canvas Node Components` be split into smaller, more focused modules?**
  _Cohesion score 0.05979843225083987 - nodes in this community are weakly interconnected._