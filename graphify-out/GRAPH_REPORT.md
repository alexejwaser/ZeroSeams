# Graph Report - .  (2026-06-03)

## Corpus Check
- 21 files · ~56,801 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 551 nodes · 911 edges · 38 communities (24 shown, 14 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 43 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

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

## God Nodes (most connected - your core abstractions)
1. `CanvasObject` - 18 edges
2. `buildFilterPipeline()` - 18 edges
3. `compilerOptions` - 14 edges
4. `Toolbar()` - 12 edges
5. `SnapGuide` - 12 edges
6. `compilerOptions` - 11 edges
7. `ImageObject` - 11 edges
8. `CarouselProject` - 10 edges
9. `TextObject` - 10 edges
10. `Main Process (Electron)` - 10 edges

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

## Communities (38 total, 14 thin omitted)

### Community 0 - "Canvas Node Components"
Cohesion: 0.06
Nodes (38): removeBg, CanvasImageNodeProps, anchorsToPathData(), computePathBBox(), CanvasShapeNode(), CanvasShapeNodeProps, CanvasVideoNodeOuter(), CanvasVideoNodeProps (+30 more)

### Community 1 - "E2E Test Helpers"
Cohesion: 0.06
Nodes (39): clearAll(), clickKonvaCenter(), consoleLogs, drag(), drawRect(), ELECTRON_BIN, escape(), failures (+31 more)

### Community 2 - "Electron IPC & Save System"
Cohesion: 0.07
Nodes (39): currentFilePath in useSaveStatusStore, addRecentFile(), IPC: autosave-project, body, corpHeaders, createWindow(), dir, editDir (+31 more)

### Community 3 - "Type System & Declarations"
Cohesion: 0.15
Nodes (35): Non-Destructive Photo Adjustments Pipeline, AIOperation, AIOperationBase, AIOperationStatus, BackgroundRemovalOperation, InpaintingOperation, SegmentationOperation, AnchorPoint (+27 more)

### Community 4 - "Build & Test Infrastructure"
Cohesion: 0.06
Nodes (31): Electron-Vite Three-Target Build (main/preload/renderer), Electron Vite Config, allInputs, dblLogs, div, firstText, inp, labels (+23 more)

### Community 5 - "Agent Domain Architecture"
Cohesion: 0.09
Nodes (27): Agent Domain Isolation (no cross-domain edits), Rationale: Agents must not cross domain boundaries (ui/canvas/ai separation), Agent: ai-engineer, src/ai/ (ai-engineer domain), Agent: canvas-engineer, src/canvas/ (canvas-engineer domain), Agent: qa-reviewer, Agent: ui-engineer (+19 more)

### Community 6 - "UI Properties Panel"
Cohesion: 0.09
Nodes (20): rotateAroundCenter: Konva Rect/Text rotate around top-left not center; ellipse exempt, MAC_SYSTEM_FONTS, AdjustmentsSectionProps, alignButtonStyle(), AlignDistributeSection(), distributeButtonStyle(), EffectsSection(), EffectsSectionProps (+12 more)

### Community 7 - "Project Dependencies"
Cohesion: 0.08
Nodes (23): author, dependencies, chokidar, @imgly/background-removal, konva, lucide-react, onnxruntime-web, react (+15 more)

### Community 8 - "Photo Filter Pipeline"
Cohesion: 0.20
Nodes (18): adjFingerprint(), buildFilterPipeline(), buildLUT(), isAllDefault(), lutCache, makeBlacksFilter(), makeClarityFilter(), makeContrastFilter() (+10 more)

### Community 9 - "Text Span Utilities"
Cohesion: 0.18
Nodes (17): applyStyleToAll(), applyStyleToRange(), SelectionStyle, getSelectionStyle(), mergeAdjacentSpans(), resolveSpanStyle(), SelectionStyle, spanText() (+9 more)

### Community 10 - "Layer Effects Framework"
Cohesion: 0.24
Nodes (10): boxBlurH(), boxBlurV(), buildFilter(), hexToRgb(), EffectControlDescriptor, EffectDefinition, EffectParams, getEffectDefinition() (+2 more)

### Community 11 - "TypeScript Config (Web)"
Cohesion: 0.11
Nodes (17): compilerOptions, composite, jsx, lib, module, moduleResolution, noEmit, noImplicitReturns (+9 more)

### Community 12 - "AI Subsystem"
Cohesion: 0.19
Nodes (9): AIContext, AIContextValue, useAI(), AIStoreState, useAIStore, UseBackgroundRemovalReturn, syncGroupOnTransform, Frame/Content Two-Layer Model (+1 more)

### Community 13 - "Playwright Test Scripts"
Cohesion: 0.12
Nodes (7): consoleLogs, content, ELECTRON_BIN, existingPath, failures, ROOT, testFile

### Community 14 - "Video Export Pipeline"
Cohesion: 0.21
Nodes (13): captureVideoFrameSequence(), downloadFrames(), exportMixedFrames(), ExportResult, getVideoElement(), registerVideoElement(), registry, encodeVideoFrames() (+5 more)

### Community 15 - "Toolbar & Export UI"
Cohesion: 0.18
Nodes (11): Photo Adjustments Bypass Toggle (hold-to-compare \ key + persistent Power button), Save Split-Button Pattern (Save / Save As / Save a Copy), AdjustmentsSection(), ActiveTool, SaveStatusPill(), Toolbar(), ExportState, SaveStatus (+3 more)

### Community 16 - "Canvas Type Definitions"
Cohesion: 0.12
Nodes (15): AnchorPoint, BaseCanvasObject, CanvasObject, CanvasObjectScope, FontStyle, GroupObject, ImageObject, MaskData (+7 more)

### Community 17 - "Playwright Test Helpers"
Cohesion: 0.20
Nodes (7): clickAt(), drag(), failures, getStageInfo(), k2p(), ROOT, wait()

### Community 18 - "TypeScript Config (Node)"
Cohesion: 0.15
Nodes (12): compilerOptions, composite, module, moduleResolution, noEmit, noImplicitReturns, noUnusedLocals, noUnusedParameters (+4 more)

### Community 19 - "E2E Test Infrastructure"
Cohesion: 0.27
Nodes (9): Playwright Electron Integration Testing Pattern, Window Store Exposure for E2E Tests (__canvasStore__, __viewportStore__, __saveStatusStore__), debug-selection Playwright Script, test-axis-lock Playwright Script, test-multiselect-transform Playwright Script, test-save-path Playwright Script, verify-mask-draw Playwright Script, App() (+1 more)

### Community 20 - "Frame Settings UI"
Cohesion: 0.29
Nodes (6): FrameSettingsPopoverProps, labelStyle, numberInputStyle, PLATFORM_LABELS, PLATFORMS, segmentButtonStyle()

### Community 21 - "Layer Panel & Tooltip"
Cohesion: 0.33
Nodes (3): Module-level activeTooltipCount (instant tooltip on hover when any tooltip is visible), Tooltip(), TooltipProps

## Knowledge Gaps
- **220 isolated node(s):** `composite`, `noEmit`, `module`, `moduleResolution`, `target` (+215 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Snap Guide System` connect `Agent Domain Architecture` to `Canvas Node Components`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Why does `CanvasObject` connect `Type System & Declarations` to `Canvas Node Components`, `Canvas Type Definitions`, `Video Export Pipeline`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `Toolbar()` (e.g. with `useCanvasStore.ts` and `iconBtnStyle.ts`) actually correct?**
  _`Toolbar()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `composite`, `noEmit`, `module` to the rest of the system?**
  _230 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Canvas Node Components` be split into smaller, more focused modules?**
  _Cohesion score 0.06277436347673397 - nodes in this community are weakly interconnected._
- **Should `E2E Test Helpers` be split into smaller, more focused modules?**
  _Cohesion score 0.058279370952821465 - nodes in this community are weakly interconnected._
- **Should `Electron IPC & Save System` be split into smaller, more focused modules?**
  _Cohesion score 0.06829268292682927 - nodes in this community are weakly interconnected._