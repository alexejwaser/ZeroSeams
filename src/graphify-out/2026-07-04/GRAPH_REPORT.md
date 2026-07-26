# Graph Report - ./src  (2026-07-03)

## Corpus Check
- 84 files · ~80,259 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 438 nodes · 936 edges · 26 communities (24 shown, 2 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 28 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

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
- [[_COMMUNITY_Viewport & Media Drop|Viewport & Media Drop]]
- [[_COMMUNITY_Snap System|Snap System]]
- [[_COMMUNITY_Numeric Input & Adjustments UI|Numeric Input & Adjustments UI]]
- [[_COMMUNITY_Color Utilities|Color Utilities]]
- [[_COMMUNITY_Frame Label Strip & Tooltip|Frame Label Strip & Tooltip]]
- [[_COMMUNITY_Project Save & Path Utils|Project Save & Path Utils]]
- [[_COMMUNITY_Shortcut Cheatsheet|Shortcut Cheatsheet]]
- [[_COMMUNITY_Electron Decls|Electron Decls]]

## God Nodes (most connected - your core abstractions)
1. `useCanvasStore` - 50 edges
2. `useViewportStore` - 20 edges
3. `buildFilterPipeline()` - 19 edges
4. `useSnapGuides()` - 17 edges
5. `SnapGuide` - 16 edges
6. `iconBtnStyle()` - 12 edges
7. `NumericInput()` - 11 edges
8. `CarouselStage()` - 10 edges
9. `selectScale()` - 10 edges
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

## Communities (26 total, 2 thin omitted)

### Community 0 - "Shared Type Definitions"
Cohesion: 0.08
Nodes (39): AIOperation, AIOperationBase, AIOperationStatus, AIOperationType, BackgroundRemovalOperation, InpaintingOperation, SegmentationOperation, AnchorPoint (+31 more)

### Community 1 - "AI Context & UI Integration"
Cohesion: 0.09
Nodes (21): AIContext, AIContextValue, useAI(), AIProvider(), AIStoreState, useAIStore, useBackgroundRemoval(), UseBackgroundRemovalReturn (+13 more)

### Community 2 - "Electron Main Process"
Cohesion: 0.07
Nodes (28): addRecentFile(), body, buf, buffer, corpHeaders, dir, editDir, editor (+20 more)

### Community 3 - "Adjustments Pipeline & LUTs"
Cohesion: 0.18
Nodes (23): adjFingerprint(), build3DLUT(), buildFilterPipeline(), buildFloatLUT(), buildLUT(), evict(), floatLutCache, isAllDefault() (+15 more)

### Community 4 - "Canvas Nodes & HUD"
Cohesion: 0.16
Nodes (19): CanvasGuidelineNode, CanvasGuidelineNodeInner(), CanvasGuidelineNodeOuter(), InnerProps, Props, CanvasImageNodeInner(), anchorsToPathData(), CanvasPathNodeInner() (+11 more)

### Community 5 - "Canvas Node Rendering"
Cohesion: 0.16
Nodes (18): CanvasImageNode, CanvasImageNodeInnerProps, CanvasImageNodeProps, CanvasPathNode, CanvasPathNodeInnerProps, CanvasPathNodeProps, CanvasShapeNode, CanvasShapeNodeInnerProps (+10 more)

### Community 6 - "Grid & Group System"
Cohesion: 0.11
Nodes (12): CanvasGroupNode(), CanvasGroupNodeInner, CanvasGroupNodeProps, CellRect, GRID_TEMPLATES, GridTemplate, ActiveTool, CanvasState (+4 more)

### Community 7 - "Toolbar & Frame Settings"
Cohesion: 0.10
Nodes (14): FrameSettingsPopover(), FrameSettingsPopoverProps, labelStyle, PLATFORM_LABELS, PLATFORMS, segmentButtonStyle(), GridPicker(), GridPickerProps (+6 more)

### Community 8 - "Platform Preview Shells"
Cohesion: 0.17
Nodes (7): FrameSlideProps, PreviewShell(), VideoOverlayItemProps, getShell(), PlatformShellProps, registerShell(), SHELL_REGISTRY

### Community 9 - "Carousel Stage & Export Glue"
Cohesion: 0.19
Nodes (13): computePathBBox(), CarouselStage(), getStageInstance(), axisLock(), exportFrames(), FrameGuides(), FrameGuidesProps, useAutosave() (+5 more)

### Community 10 - "Text Spans & Thumbnails"
Cohesion: 0.16
Nodes (17): applyStyleToAll(), applyStyleToRange(), fontStyleToCSS(), getSelectionStyle(), mergeAdjacentSpans(), ResolvedSpanStyle, resolveSpanStyle(), SelectionStyle (+9 more)

### Community 11 - "Properties Panel Sections"
Cohesion: 0.19
Nodes (13): AlignDistributeSection(), AlignDistributeSectionProps, alignButtonStyle(), distributeButtonStyle(), MixedNumberField(), MixedNumberFieldProps, NumberField(), NumberFieldProps (+5 more)

### Community 12 - "Layer Effects"
Cohesion: 0.24
Nodes (10): boxBlurH(), boxBlurV(), buildFilter(), EffectControlDescriptor, EffectDefinition, EffectParams, getAllEffectDefinitions(), getEffectDefinition() (+2 more)

### Community 13 - "Panel Controls & Icon Styles"
Cohesion: 0.21
Nodes (11): useThumbnailStore, AdjustmentsSection(), EffectsSection(), EffectsSectionProps, formatDuration(), trimLabelStyle, VideoSection(), VideoSectionProps (+3 more)

### Community 14 - "Video Export"
Cohesion: 0.26
Nodes (11): captureVideoFrameSequence(), downloadFrames(), exportMixedFrames(), getVideoElement(), registerVideoElement(), registry, unregisterVideoElement(), encodeVideoFrames() (+3 more)

### Community 15 - "Color Input UI"
Cohesion: 0.22
Nodes (10): ColorInput(), ColorInputProps, ColorMode, loadRecentColors(), MixedColorInput(), MixedColorInputProps, PopoverProps, pushRecentColor() (+2 more)

### Community 16 - "Viewport & Media Drop"
Cohesion: 0.23
Nodes (7): CanvasTextNode, CanvasTextNodeInnerProps, ElectronFile, getCanvasScale(), scaleForZoom(), selectScale(), ViewportState

### Community 17 - "Snap System"
Cohesion: 0.21
Nodes (10): SnapGuides(), SnapGuidesProps, buildTargets(), computeSnap(), computeSnapFromTargets(), computeSnapResize(), computeSnapResizeFromTargets(), DragBox (+2 more)

### Community 18 - "Numeric Input & Adjustments UI"
Cohesion: 0.28
Nodes (6): AdjustmentsSectionProps, subGroupLabelStyle, TRACK_GRADIENT, formatVal(), NumericInput(), NumericInputProps

### Community 19 - "Color Utilities"
Cohesion: 0.33
Nodes (8): clampInt(), clamp(), hexToHsl(), hexToRgb(), hslToHex(), hslToRgb(), rgbToHex(), rgbToHsl()

### Community 21 - "Project Save & Path Utils"
Cohesion: 0.48
Nodes (6): posixDirname(), posixRelative(), posixResolve(), relativizeVideoObjects(), resolveVideoObjects(), buildProjectJson()

### Community 22 - "Shortcut Cheatsheet"
Cohesion: 0.40
Nodes (4): ShortcutOverlay(), SHORTCUT_GROUPS, ShortcutEntry, ShortcutGroup

## Knowledge Gaps
- **106 isolated node(s):** `rootEl`, `FrameSettingsPopoverProps`, `PLATFORM_LABELS`, `PLATFORMS`, `labelStyle` (+101 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useCanvasStore` connect `Canvas Nodes & HUD` to `AI Context & UI Integration`, `Canvas Node Rendering`, `Grid & Group System`, `Toolbar & Frame Settings`, `Platform Preview Shells`, `Carousel Stage & Export Glue`, `Text Spans & Thumbnails`, `Panel Controls & Icon Styles`, `Viewport & Media Drop`, `Snap System`, `Shortcut Cheatsheet`?**
  _High betweenness centrality (0.338) - this node is a cross-community bridge._
- **Why does `PreviewShell()` connect `Platform Preview Shells` to `Canvas Nodes & HUD`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Why does `TitleBar()` connect `Panel Controls & Icon Styles` to `AI Context & UI Integration`, `Color Input UI`, `Canvas Nodes & HUD`, `Toolbar & Frame Settings`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Are the 10 inferred relationships involving `useCanvasStore` (e.g. with `FrameSettingsPopover()` and `PropertiesPanel()`) actually correct?**
  _`useCanvasStore` has 10 INFERRED edges - model-reasoned connections that need verification._
- **What connects `rootEl`, `FrameSettingsPopoverProps`, `PLATFORM_LABELS` to the rest of the system?**
  _106 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Shared Type Definitions` be split into smaller, more focused modules?**
  _Cohesion score 0.08084163898117387 - nodes in this community are weakly interconnected._
- **Should `AI Context & UI Integration` be split into smaller, more focused modules?**
  _Cohesion score 0.09309309309309309 - nodes in this community are weakly interconnected._