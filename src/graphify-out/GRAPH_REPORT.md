# Graph Report - src  (2026-07-04)

## Corpus Check
- 88 files · ~80,850 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 477 nodes · 1049 edges · 20 communities (19 shown, 1 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 28 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `41bafdfd`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Shared Type Definitions|Shared Type Definitions]]
- [[_COMMUNITY_AI Context & UI Integration|AI Context & UI Integration]]
- [[_COMMUNITY_Electron Main Process|Electron Main Process]]
- [[_COMMUNITY_Adjustments Pipeline & LUTs|Adjustments Pipeline & LUTs]]
- [[_COMMUNITY_Canvas Nodes & HUD|Canvas Nodes & HUD]]
- [[_COMMUNITY_Canvas Node Rendering|Canvas Node Rendering]]
- [[_COMMUNITY_Grid & Group System|Grid & Group System]]
- [[_COMMUNITY_Toolbar & Frame Settings|Toolbar & Frame Settings]]
- [[_COMMUNITY_Platform Preview Shells|Platform Preview Shells]]
- [[_COMMUNITY_Carousel Stage & Export Glue|Carousel Stage & Export Glue]]
- [[_COMMUNITY_Text Spans & Thumbnails|Text Spans & Thumbnails]]
- [[_COMMUNITY_Properties Panel Sections|Properties Panel Sections]]
- [[_COMMUNITY_Layer Effects|Layer Effects]]
- [[_COMMUNITY_Panel Controls & Icon Styles|Panel Controls & Icon Styles]]
- [[_COMMUNITY_Video Export|Video Export]]
- [[_COMMUNITY_Color Input UI|Color Input UI]]
- [[_COMMUNITY_Snap System|Snap System]]
- [[_COMMUNITY_Shortcut Cheatsheet|Shortcut Cheatsheet]]
- [[_COMMUNITY_Electron Decls|Electron Decls]]

## God Nodes (most connected - your core abstractions)
1. `useCanvasStore` - 55 edges
2. `useViewportStore` - 22 edges
3. `buildFilterPipeline()` - 19 edges
4. `useSnapGuides()` - 17 edges
5. `SnapGuide` - 16 edges
6. `iconBtnStyle()` - 14 edges
7. `NumericInput()` - 12 edges
8. `selectScale()` - 11 edges
9. `CarouselStage()` - 10 edges
10. `buildEffectFilters()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `ShortcutOverlay()` --calls--> `useCanvasStore`  [INFERRED]
  ui/ShortcutOverlay.tsx → canvas/useCanvasStore.ts
- `FrameSettingsPopover()` --calls--> `useCanvasStore`  [INFERRED]
  ui/FrameSettingsPopover.tsx → canvas/useCanvasStore.ts
- `PropertiesPanel()` --calls--> `useCanvasStore`  [INFERRED]
  ui/PropertiesPanel.tsx → canvas/useCanvasStore.ts
- `PropertiesPanel()` --calls--> `useThumbnailStore`  [INFERRED]
  ui/PropertiesPanel.tsx → canvas/useThumbnailStore.ts
- `buildProjectJson()` --calls--> `relativizeVideoObjects()`  [INFERRED]
  ui/Toolbar.tsx → canvas/pathUtils.ts

## Communities (20 total, 1 thin omitted)

### Community 0 - "Shared Type Definitions"
Cohesion: 0.08
Nodes (41): AIOperation, AIOperationBase, AIOperationStatus, AIOperationType, BackgroundRemovalOperation, InpaintingOperation, SegmentationOperation, AnchorPoint (+33 more)

### Community 1 - "AI Context & UI Integration"
Cohesion: 0.09
Nodes (23): AIContext, AIContextValue, useAI(), AIProvider(), AIStoreState, useAIStore, useBackgroundRemoval(), UseBackgroundRemovalReturn (+15 more)

### Community 2 - "Electron Main Process"
Cohesion: 0.07
Nodes (28): addRecentFile(), body, buf, buffer, corpHeaders, dir, editDir, editor (+20 more)

### Community 3 - "Adjustments Pipeline & LUTs"
Cohesion: 0.18
Nodes (23): adjFingerprint(), build3DLUT(), buildFilterPipeline(), buildFloatLUT(), buildLUT(), evict(), floatLutCache, isAllDefault() (+15 more)

### Community 4 - "Canvas Nodes & HUD"
Cohesion: 0.18
Nodes (13): CanvasGuidelineNode, CanvasGuidelineNodeInner(), CanvasGuidelineNodeOuter(), InnerProps, Props, CanvasPathNodeInner(), CanvasTextNodeInner(), FrameGuides() (+5 more)

### Community 5 - "Canvas Node Rendering"
Cohesion: 0.19
Nodes (9): CanvasShapeNode, CanvasShapeNodeInner(), CanvasShapeNodeInnerProps, CanvasTextNode, CanvasTextNodeInnerProps, makeCanvasNode(), buildEffectFilters(), effectsFingerprint() (+1 more)

### Community 6 - "Grid & Group System"
Cohesion: 0.11
Nodes (12): findDropTargetId(), fitCover(), pointInEllipse(), pointInRect(), GridTemplate, ActiveTool, CanvasState, HistorySnapshot (+4 more)

### Community 7 - "Toolbar & Frame Settings"
Cohesion: 0.08
Nodes (21): posixDirname(), posixRelative(), posixResolve(), relativizeVideoObjects(), resolveVideoObjects(), buildProjectSnapshot(), FrameSettingsPopover(), FrameSettingsPopoverProps (+13 more)

### Community 8 - "Platform Preview Shells"
Cohesion: 0.17
Nodes (7): FrameSlideProps, PreviewShell(), VideoOverlayItemProps, getShell(), PlatformShellProps, registerShell(), SHELL_REGISTRY

### Community 9 - "Carousel Stage & Export Glue"
Cohesion: 0.19
Nodes (18): CanvasImageNode, CanvasPathNode, CanvasPathNodeInnerProps, computePathBBox(), CarouselStage(), EmptyFrameOverlay(), GridCellOverlay(), useAutosave() (+10 more)

### Community 10 - "Text Spans & Thumbnails"
Cohesion: 0.14
Nodes (20): applyStyleToAll(), applyStyleToRange(), fontStyleToCSS(), getSelectionStyle(), mergeAdjacentSpans(), ResolvedSpanStyle, resolveSpanStyle(), SelectionStyle (+12 more)

### Community 11 - "Properties Panel Sections"
Cohesion: 0.06
Nodes (51): AdjustmentsSection(), AdjustmentsSectionProps, subGroupLabelStyle, TRACK_GRADIENT, AlignDistributeSection(), AlignDistributeSectionProps, EffectsSection(), EffectsSectionProps (+43 more)

### Community 12 - "Layer Effects"
Cohesion: 0.14
Nodes (18): boxBlurH(), boxBlurV(), buildFilter(), EffectControlDescriptor, EffectDefinition, EffectParams, getAllEffectDefinitions(), getEffectDefinition() (+10 more)

### Community 13 - "Panel Controls & Icon Styles"
Cohesion: 0.19
Nodes (15): CanvasImageNodeInner(), CanvasImageNodeInnerProps, anchorsToPathData(), CanvasVideoNode, CanvasVideoNodeInner(), CanvasVideoNodeInnerProps, ClipEditOverlay(), ClipEditOverlayProps (+7 more)

### Community 14 - "Video Export"
Cohesion: 0.21
Nodes (13): getStageInstance(), captureVideoFrameSequence(), downloadFrames(), exportFrames(), exportMixedFrames(), getVideoElement(), registerVideoElement(), registry (+5 more)

### Community 15 - "Color Input UI"
Cohesion: 0.13
Nodes (13): CanvasGroupNode(), CanvasGroupNodeInner, CanvasGroupNodeProps, CanvasImageNodeProps, CanvasPathNodeProps, CanvasShapeNodeProps, CanvasTextNodeProps, CanvasVideoNodeProps (+5 more)

### Community 17 - "Snap System"
Cohesion: 0.29
Nodes (8): buildTargets(), computeSnap(), computeSnapFromTargets(), computeSnapResize(), computeSnapResizeFromTargets(), DragBox, ROTATION_SNAP_ANGLES, SnapTarget

### Community 22 - "Shortcut Cheatsheet"
Cohesion: 0.40
Nodes (4): ShortcutOverlay(), SHORTCUT_GROUPS, ShortcutEntry, ShortcutGroup

## Knowledge Gaps
- **115 isolated node(s):** `rootEl`, `FrameSettingsPopoverProps`, `PLATFORM_LABELS`, `PLATFORMS`, `labelStyle` (+110 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useCanvasStore` connect `Canvas Nodes & HUD` to `AI Context & UI Integration`, `Canvas Node Rendering`, `Grid & Group System`, `Toolbar & Frame Settings`, `Platform Preview Shells`, `Carousel Stage & Export Glue`, `Text Spans & Thumbnails`, `Properties Panel Sections`, `Panel Controls & Icon Styles`, `Video Export`, `Color Input UI`, `Snap System`, `Shortcut Cheatsheet`?**
  _High betweenness centrality (0.350) - this node is a cross-community bridge._
- **Why does `PreviewShell()` connect `Platform Preview Shells` to `Canvas Nodes & HUD`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Why does `TitleBar()` connect `AI Context & UI Integration` to `Properties Panel Sections`, `Canvas Nodes & HUD`, `Toolbar & Frame Settings`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Are the 10 inferred relationships involving `useCanvasStore` (e.g. with `FrameSettingsPopover()` and `PropertiesPanel()`) actually correct?**
  _`useCanvasStore` has 10 INFERRED edges - model-reasoned connections that need verification._
- **What connects `rootEl`, `FrameSettingsPopoverProps`, `PLATFORM_LABELS` to the rest of the system?**
  _115 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Shared Type Definitions` be split into smaller, more focused modules?**
  _Cohesion score 0.07777777777777778 - nodes in this community are weakly interconnected._
- **Should `AI Context & UI Integration` be split into smaller, more focused modules?**
  _Cohesion score 0.08771929824561403 - nodes in this community are weakly interconnected._