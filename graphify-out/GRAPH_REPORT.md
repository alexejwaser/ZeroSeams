# Graph Report - .  (2026-06-05)

## Corpus Check
- 11 files · ~77,628 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 902 nodes · 1477 edges · 66 communities (51 shown, 15 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 49 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Canvas Store & History|Canvas Store & History]]
- [[_COMMUNITY_ImageVideo Node Rendering|Image/Video Node Rendering]]
- [[_COMMUNITY_Snap & Transform Guides|Snap & Transform Guides]]
- [[_COMMUNITY_Adjustments & Effects Pipeline|Adjustments & Effects Pipeline]]
- [[_COMMUNITY_Export & Frame Slicing|Export & Frame Slicing]]
- [[_COMMUNITY_UI Panels & Properties|UI Panels & Properties]]
- [[_COMMUNITY_Pen & Path Editing|Pen & Path Editing]]
- [[_COMMUNITY_Electron IPC & Platform|Electron IPC & Platform]]
- [[_COMMUNITY_Grid & Group Layout|Grid & Group Layout]]
- [[_COMMUNITY_Text & Shape Nodes|Text & Shape Nodes]]
- [[_COMMUNITY_Preview & Platform Shells|Preview & Platform Shells]]
- [[_COMMUNITY_Viewport & PanZoom|Viewport & Pan/Zoom]]
- [[_COMMUNITY_Toolbar & Keyboard Shortcuts|Toolbar & Keyboard Shortcuts]]
- [[_COMMUNITY_Guidelines & Rulers|Guidelines & Rulers]]
- [[_COMMUNITY_Geometry & Math Utilities|Geometry & Math Utilities]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
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
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]

## God Nodes (most connected - your core abstractions)
1. `buildFilterPipeline()` - 20 edges
2. `CanvasObject` - 18 edges
3. `compilerOptions` - 14 edges
4. `getWasmTableEntry()` - 14 edges
5. `SnapGuide` - 14 edges
6. `Zero Seams — AI Dev Guide` - 14 edges
7. `ImageObject` - 13 edges
8. `Toolbar()` - 12 edges
9. `compilerOptions` - 11 edges
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

## Communities (66 total, 15 thin omitted)

### Community 0 - "Canvas Store & History"
Cohesion: 0.07
Nodes (40): removeBg, CanvasGroupNodeInner, CanvasGroupNodeProps, InnerProps, Props, CanvasImageNodeInner(), CanvasImageNodeProps, anchorsToPathData() (+32 more)

### Community 1 - "Image/Video Node Rendering"
Cohesion: 0.04
Nodes (20): bigintToI53Checked(), DEFAULT_ARGS, DEFAULT_ARGS_FFPROBE, doCallback(), done(), doReadv(), doWritev(), _emscripten_asm_const_int() (+12 more)

### Community 2 - "Snap & Transform Guides"
Cohesion: 0.10
Nodes (49): applyStyleToAll(), applyStyleToRange(), SelectionStyle, getSelectionStyle(), mergeAdjacentSpans(), resolveSpanStyle(), SelectionStyle, splitSpansAt() (+41 more)

### Community 3 - "Adjustments & Effects Pipeline"
Cohesion: 0.06
Nodes (39): clearAll(), clickKonvaCenter(), consoleLogs, drag(), drawRect(), ELECTRON_BIN, escape(), failures (+31 more)

### Community 4 - "Export & Frame Slicing"
Cohesion: 0.06
Nodes (44): currentFilePath in useSaveStatusStore, addRecentFile(), IPC: autosave-project, body, buf, buffer, corpHeaders, createWindow() (+36 more)

### Community 5 - "UI Panels & Properties"
Cohesion: 0.09
Nodes (24): Photo Adjustments Bypass Toggle (hold-to-compare \ key + persistent Power button), rotateAroundCenter: Konva Rect/Text rotate around top-left not center; ellipse exempt, MAC_SYSTEM_FONTS, AdjustmentsSection(), AdjustmentsSectionProps, alignButtonStyle(), AlignDistributeSection(), distributeButtonStyle() (+16 more)

### Community 6 - "Pen & Path Editing"
Cohesion: 0.09
Nodes (10): FFmpeg, id, ids, trans, ERROR_IMPORT_FAILURE, ERROR_NOT_LOADED, ERROR_TERMINATED, ERROR_UNKNOWN_MESSAGE_TYPE (+2 more)

### Community 7 - "Electron IPC & Platform"
Cohesion: 0.12
Nodes (22): getStageInstance(), captureVideoFrameSequence(), downloadFrames(), exportMixedFrames(), ExportResult, canvas/index exports, posixDirname(), posixRelative() (+14 more)

### Community 8 - "Grid & Group Layout"
Cohesion: 0.17
Nodes (23): adjFingerprint(), build3DLUT(), buildFilterPipeline(), buildFloatLUT(), buildLUT(), evict(), floatLutCache, isAllDefault() (+15 more)

### Community 9 - "Text & Shape Nodes"
Cohesion: 0.09
Nodes (21): eq(), errors, failures, loaded, newVideoErrors, nonProtocolErrors, objects, ok() (+13 more)

### Community 10 - "Preview & Platform Shells"
Cohesion: 0.08
Nodes (25): author, dependencies, chokidar, @ffmpeg/ffmpeg, @ffmpeg/util, @imgly/background-removal, konva, lucide-react (+17 more)

### Community 11 - "Viewport & Pan/Zoom"
Cohesion: 0.10
Nodes (25): Agent Domain Isolation (no cross-domain edits), Rationale: Agents must not cross domain boundaries (ui/canvas/ai separation), Agent: ai-engineer, src/ai/ (ai-engineer domain), Agent: canvas-engineer, src/canvas/ (canvas-engineer domain), Agent: qa-reviewer, Agent: ui-engineer (+17 more)

### Community 12 - "Toolbar & Keyboard Shortcuts"
Cohesion: 0.09
Nodes (12): ELECTRON_BIN, eq(), failures, getState(), gs(), mask, ok(), orderBefore (+4 more)

### Community 13 - "Guidelines & Rulers"
Cohesion: 0.20
Nodes (11): effectsPipelineCache, boxBlurH(), boxBlurV(), buildFilter(), hexToRgb(), EffectControlDescriptor, EffectDefinition, EffectParams (+3 more)

### Community 14 - "Geometry & Math Utilities"
Cohesion: 0.18
Nodes (9): AIContext, AIContextValue, useAI(), AIStoreState, useAIStore, UseBackgroundRemovalReturn, syncGroupOnTransform, Frame/Content Two-Layer Model (+1 more)

### Community 15 - "Community 15"
Cohesion: 0.11
Nodes (17): compilerOptions, composite, jsx, lib, module, moduleResolution, noEmit, noImplicitReturns (+9 more)

### Community 16 - "Community 16"
Cohesion: 0.12
Nodes (7): consoleLogs, content, ELECTRON_BIN, existingPath, failures, ROOT, testFile

### Community 17 - "Community 17"
Cohesion: 0.12
Nodes (16): AnchorPoint, BaseCanvasObject, CanvasObject, CanvasObjectScope, FontStyle, GroupObject, GuidelineObject, ImageObject (+8 more)

### Community 18 - "Community 18"
Cohesion: 0.12
Nodes (14): allInputs, dblLogs, div, firstText, inp, labels, lbl, logs (+6 more)

### Community 19 - "Community 19"
Cohesion: 0.18
Nodes (11): ColorInput(), ColorMode, hexToHsl(), hexToRgb(), hslToHex(), loadRecentColors(), MixedColorInput(), PopoverProps (+3 more)

### Community 20 - "Community 20"
Cohesion: 0.23
Nodes (9): FrameSlideProps, VideoOverlayItemProps, FacebookShell(), InstagramShell(), getShell(), PlatformShellProps, registerShell(), SHELL_REGISTRY (+1 more)

### Community 21 - "Community 21"
Cohesion: 0.12
Nodes (15): code:block1 (graphify query "<your question>"), Core Concepts — never break these, Export (`src/canvas/exportFrames.ts`), Features Implemented (sprints 1–42 + issue #20), File Ownership, graphify, Key Architecture, Keyboard Shortcuts (+7 more)

### Community 22 - "Community 22"
Cohesion: 0.16
Nodes (8): CellRect, VideoExportSettings, GridPicker(), GridPickerProps, ActiveTool, PLATFORM_RECOMMENDED, PresetKey, VIDEO_PRESETS

### Community 23 - "Community 23"
Cohesion: 0.18
Nodes (15): alignMemory(), getSocketAddress(), getSocketFromFD(), mmapAlloc(), ___syscall_accept4(), ___syscall_bind(), ___syscall_connect(), ___syscall_getpeername() (+7 more)

### Community 24 - "Community 24"
Cohesion: 0.18
Nodes (8): clickAt(), drag(), ELECTRON_BIN, failures, getStageInfo(), k2p(), ROOT, wait()

### Community 25 - "Community 25"
Cohesion: 0.14
Nodes (14): getWasmTableEntry(), invoke_i(), invoke_ii(), invoke_iii(), invoke_iiii(), invoke_iiiii(), invoke_iiiiii(), invoke_iiiiiiiii() (+6 more)

### Community 26 - "Community 26"
Cohesion: 0.15
Nodes (12): compilerOptions, composite, module, moduleResolution, noEmit, noImplicitReturns, noUnusedLocals, noUnusedParameters (+4 more)

### Community 27 - "Community 27"
Cohesion: 0.21
Nodes (10): Playwright Electron Integration Testing Pattern, Window Store Exposure for E2E Tests (__canvasStore__, __viewportStore__, __saveStatusStore__), debug-selection Playwright Script, test-axis-lock Playwright Script, test-multiselect-transform Playwright Script, test-save-path Playwright Script, verify-mask-draw Playwright Script, App() (+2 more)

### Community 28 - "Community 28"
Cohesion: 0.18
Nodes (11): abort(), assert(), _dlopen(), ___dlsym(), getBinary(), getValue(), handleMessage(), initRandomFill() (+3 more)

### Community 29 - "Community 29"
Cohesion: 0.22
Nodes (11): _getnameinfo(), inetNtop4(), inetNtop6(), intArrayFromString(), lengthBytesUTF8(), readSockaddr(), stringToNewUTF8(), stringToUTF8() (+3 more)

### Community 30 - "Community 30"
Cohesion: 0.18
Nodes (10): code:bash (git clone https://github.com/alexejwaser/zeroseams.git), code:bash (node node_modules/electron/install.js), code:bash (npm install electron --save-dev), Download, Features, If you see `Error: Electron uninstall` after `npm install`, License, Running Locally (+2 more)

### Community 31 - "Community 31"
Cohesion: 0.22
Nodes (9): Save Split-Button Pattern (Save / Save As / Save a Copy), FrameSettingsPopoverProps, labelStyle, numberInputStyle, PLATFORM_LABELS, PLATFORMS, segmentButtonStyle(), SaveStatusPill() (+1 more)

### Community 32 - "Community 32"
Cohesion: 0.20
Nodes (10): addDays(), arraySum(), __gmtime_js(), isLeapYear(), __localtime_js(), __mktime_js(), readI53FromI64(), _strftime() (+2 more)

### Community 33 - "Community 33"
Cohesion: 0.39
Nodes (8): spanText(), anchorsToPathData(), computePathBBox(), generateMaskThumbnail(), generateThumbnail(), PathBBox, ThumbnailState, useThumbnailGenerator()

### Community 34 - "Community 34"
Cohesion: 0.28
Nodes (9): addRunDependency(), asyncLoad(), createWasm(), FS_createPreloadedFile(), getBinaryPromise(), getUniqueRunDependency(), instantiateArrayBuffer(), instantiateAsync() (+1 more)

### Community 35 - "Community 35"
Cohesion: 0.29
Nodes (6): Autosave Pipeline, electronAPI, SaveStatus, SaveStatusState, SaveStatus, SaveStatusState

### Community 36 - "Community 36"
Cohesion: 0.25
Nodes (8): addOnPostRun(), addOnPreRun(), callRuntimeCallbacks(), initRuntime(), postRun(), preRun(), run(), setTimeout()

### Community 37 - "Community 37"
Cohesion: 0.33
Nodes (3): Module-level activeTooltipCount (instant tooltip on hover when any tooltip is visible), Tooltip(), TooltipProps

### Community 38 - "Community 38"
Cohesion: 0.29
Nodes (7): ___assert_fail(), _getaddrinfo(), inetPton4(), inetPton6(), jstoi_q(), UTF8ArrayToString(), UTF8ToString()

### Community 39 - "Community 39"
Cohesion: 0.29
Nodes (7): devDependencies, playwright, @types/chokidar, @types/react, typescript, vite, @vitejs/plugin-react

### Community 40 - "Community 40"
Cohesion: 0.40
Nodes (5): fixtureJson, fixturePath, main(), ROOT, shot()

### Community 41 - "Community 41"
Cohesion: 0.40
Nodes (5): _emscripten_get_heap_max(), emscripten_realloc_buffer(), _emscripten_resize_heap(), getHeapMax(), updateMemoryViews()

### Community 42 - "Community 42"
Cohesion: 0.40
Nodes (5): _environ_get(), _environ_sizes_get(), getEnvStrings(), getExecutableName(), stringToAscii()

### Community 43 - "Community 43"
Cohesion: 0.40
Nodes (5): Electron-Vite Three-Target Build (main/preload/renderer), Electron Vite Config, TypeScript Node Config, TypeScript Root Config, TypeScript Web Config

### Community 44 - "Community 44"
Cohesion: 0.50
Nodes (4): exec(), ffprobe(), stringsToPtr(), stringToPtr()

## Knowledge Gaps
- **295 isolated node(s):** `composite`, `noEmit`, `module`, `moduleResolution`, `target` (+290 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Preview & Platform Shells` to `Image/Video Node Rendering`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Why does `Electron Vite Config` connect `Community 43` to `Community 39`, `Community 40`, `Text & Shape Nodes`, `Community 18`, `Community 24`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `Community 39` to `Preview & Platform Shells`, `Community 43`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **What connects `composite`, `noEmit`, `module` to the rest of the system?**
  _305 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Canvas Store & History` be split into smaller, more focused modules?**
  _Cohesion score 0.07155399473222125 - nodes in this community are weakly interconnected._
- **Should `Image/Video Node Rendering` be split into smaller, more focused modules?**
  _Cohesion score 0.03825136612021858 - nodes in this community are weakly interconnected._
- **Should `Snap & Transform Guides` be split into smaller, more focused modules?**
  _Cohesion score 0.09711779448621553 - nodes in this community are weakly interconnected._