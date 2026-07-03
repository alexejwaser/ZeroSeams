# Graph Report - ./src  (2026-07-03)

## Corpus Check
- 82 files · ~79,449 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 455 nodes · 956 edges · 27 communities (22 shown, 5 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 19 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Canvas Node Rendering|Canvas Node Rendering]]
- [[_COMMUNITY_AI Context & UI Integration|AI Context & UI Integration]]
- [[_COMMUNITY_Shared Type Definitions|Shared Type Definitions]]
- [[_COMMUNITY_Electron Main Process|Electron Main Process]]
- [[_COMMUNITY_Adjustments Pipeline & LUTs|Adjustments Pipeline & LUTs]]
- [[_COMMUNITY_Layer Effects|Layer Effects]]
- [[_COMMUNITY_Properties Panel Sections|Properties Panel Sections]]
- [[_COMMUNITY_Export Pipeline|Export Pipeline]]
- [[_COMMUNITY_Platform Preview Shells|Platform Preview Shells]]
- [[_COMMUNITY_Text Span Styling|Text Span Styling]]
- [[_COMMUNITY_Canvas Object Types|Canvas Object Types]]
- [[_COMMUNITY_Panels & Icon Styles|Panels & Icon Styles]]
- [[_COMMUNITY_Toolbar & Export Store|Toolbar & Export Store]]
- [[_COMMUNITY_Frame Settings & Numeric Input|Frame Settings & Numeric Input]]
- [[_COMMUNITY_Grid Templates|Grid Templates]]
- [[_COMMUNITY_Project Save & Path Utils|Project Save & Path Utils]]
- [[_COMMUNITY_App Root & Error Boundary|App Root & Error Boundary]]
- [[_COMMUNITY_Text Span Decls|Text Span Decls]]
- [[_COMMUNITY_Canvas Store Decls|Canvas Store Decls]]
- [[_COMMUNITY_Electron Decls|Electron Decls]]
- [[_COMMUNITY_Save Status Decls|Save Status Decls]]
- [[_COMMUNITY_Viewport Decls|Viewport Decls]]

## God Nodes (most connected - your core abstractions)
1. `useCanvasStore` - 48 edges
2. `useViewportStore` - 19 edges
3. `buildFilterPipeline()` - 19 edges
4. `useSnapGuides()` - 17 edges
5. `SnapGuide` - 16 edges
6. `CarouselStage()` - 10 edges
7. `selectScale()` - 10 edges
8. `buildEffectFilters()` - 10 edges
9. `iconBtnStyle()` - 9 edges
10. `useSaveStatusStore` - 9 edges

## Surprising Connections (you probably didn't know these)
- `App()` --calls--> `useExportStore`  [INFERRED]
  main.tsx → ui/useExportStore.ts
- `FrameSettingsPopover()` --calls--> `useCanvasStore`  [INFERRED]
  ui/FrameSettingsPopover.tsx → canvas/useCanvasStore.ts
- `EffectsSection()` --calls--> `getAllEffectDefinitions()`  [INFERRED]
  ui/PropertiesPanel.tsx → canvas/effects/registry.ts
- `VideoSection()` --calls--> `useCanvasStore`  [INFERRED]
  ui/PropertiesPanel.tsx → canvas/useCanvasStore.ts
- `PropertiesPanel()` --calls--> `useCanvasStore`  [INFERRED]
  ui/PropertiesPanel.tsx → canvas/useCanvasStore.ts

## Communities (27 total, 5 thin omitted)

### Community 0 - "Canvas Node Rendering"
Cohesion: 0.06
Nodes (68): CanvasGroupNode(), CanvasGroupNodeInner, CanvasGroupNodeProps, CanvasGuidelineNode, CanvasGuidelineNodeInner(), CanvasGuidelineNodeOuter(), InnerProps, Props (+60 more)

### Community 1 - "AI Context & UI Integration"
Cohesion: 0.08
Nodes (30): AIContext, AIContextValue, useAI(), AIProvider(), AIStoreState, useAIStore, useBackgroundRemoval(), UseBackgroundRemovalReturn (+22 more)

### Community 2 - "Shared Type Definitions"
Cohesion: 0.12
Nodes (37): AIOperation, AIOperationBase, AIOperationStatus, AIOperationType, BackgroundRemovalOperation, InpaintingOperation, SegmentationOperation, AnchorPoint (+29 more)

### Community 3 - "Electron Main Process"
Cohesion: 0.07
Nodes (28): addRecentFile(), body, buf, buffer, corpHeaders, dir, editDir, editor (+20 more)

### Community 4 - "Adjustments Pipeline & LUTs"
Cohesion: 0.14
Nodes (25): adjFingerprint(), build3DLUT(), buildFilterPipeline(), buildFloatLUT(), buildLUT(), evict(), floatLutCache, isAllDefault() (+17 more)

### Community 5 - "Layer Effects"
Cohesion: 0.19
Nodes (14): buildEffectFilters(), effectsFingerprint(), effectsPipelineCache, boxBlurH(), boxBlurV(), buildFilter(), hexToRgb(), EffectControlDescriptor (+6 more)

### Community 6 - "Properties Panel Sections"
Cohesion: 0.11
Nodes (16): FontPicker(), MAC_SYSTEM_FONTS, AdjustmentsSectionProps, alignButtonStyle(), AlignDistributeSection(), AlignDistributeSectionProps, distributeButtonStyle(), EffectsSectionProps (+8 more)

### Community 7 - "Export Pipeline"
Cohesion: 0.16
Nodes (17): getStageInstance(), captureVideoFrameSequence(), downloadFrames(), exportFrames(), exportMixedFrames(), getVideoElement(), registerVideoElement(), registry (+9 more)

### Community 8 - "Platform Preview Shells"
Cohesion: 0.17
Nodes (7): FrameSlideProps, PreviewShell(), VideoOverlayItemProps, getShell(), PlatformShellProps, registerShell(), SHELL_REGISTRY

### Community 9 - "Text Span Styling"
Cohesion: 0.15
Nodes (17): applyStyleToAll(), applyStyleToRange(), fontStyleToCSS(), getSelectionStyle(), mergeAdjacentSpans(), ResolvedSpanStyle, resolveSpanStyle(), SelectionStyle (+9 more)

### Community 10 - "Canvas Object Types"
Cohesion: 0.11
Nodes (17): AnchorPoint, BaseCanvasObject, CanvasObject, CanvasObjectScope, CanvasObjectType, FontStyle, GroupObject, GuidelineObject (+9 more)

### Community 11 - "Panels & Icon Styles"
Cohesion: 0.14
Nodes (10): useThumbnailStore, segmentButtonStyle(), iconBtnStyle(), LayerPanel(), AdjustmentsSection(), EffectsSection(), formatDuration(), VideoSection() (+2 more)

### Community 12 - "Toolbar & Export Store"
Cohesion: 0.17
Nodes (7): ActiveTool, PLATFORM_RECOMMENDED, PresetKey, VIDEO_PRESETS, VideoExportSettingsPanelProps, ExportState, useExportStore

### Community 13 - "Frame Settings & Numeric Input"
Cohesion: 0.20
Nodes (8): FrameSettingsPopover(), FrameSettingsPopoverProps, labelStyle, PLATFORM_LABELS, PLATFORMS, formatVal(), NumericInput(), NumericInputProps

### Community 14 - "Grid Templates"
Cohesion: 0.31
Nodes (6): CellRect, GRID_TEMPLATES, GridTemplate, CanvasState, GridPicker(), GridPickerProps

### Community 15 - "Project Save & Path Utils"
Cohesion: 0.39
Nodes (7): posixDirname(), posixRelative(), posixResolve(), relativizeVideoObjects(), resolveVideoObjects(), buildProjectSnapshot(), buildProjectJson()

### Community 16 - "App Root & Error Boundary"
Cohesion: 0.29
Nodes (3): App(), ErrorBoundary, rootEl

## Knowledge Gaps
- **123 isolated node(s):** `rootEl`, `FrameSettingsPopoverProps`, `PLATFORM_LABELS`, `PLATFORMS`, `labelStyle` (+118 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useCanvasStore` connect `Canvas Node Rendering` to `AI Context & UI Integration`, `Export Pipeline`, `Platform Preview Shells`, `Text Span Styling`, `Panels & Icon Styles`, `Frame Settings & Numeric Input`?**
  _High betweenness centrality (0.228) - this node is a cross-community bridge._
- **Why does `PreviewShell()` connect `Platform Preview Shells` to `Canvas Node Rendering`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Why does `PropertiesPanel()` connect `AI Context & UI Integration` to `Canvas Node Rendering`, `Panels & Icon Styles`, `Properties Panel Sections`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Are the 8 inferred relationships involving `useCanvasStore` (e.g. with `FrameSettingsPopover()` and `VideoSection()`) actually correct?**
  _`useCanvasStore` has 8 INFERRED edges - model-reasoned connections that need verification._
- **What connects `rootEl`, `FrameSettingsPopoverProps`, `PLATFORM_LABELS` to the rest of the system?**
  _123 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Canvas Node Rendering` be split into smaller, more focused modules?**
  _Cohesion score 0.057777777777777775 - nodes in this community are weakly interconnected._
- **Should `AI Context & UI Integration` be split into smaller, more focused modules?**
  _Cohesion score 0.08383838383838384 - nodes in this community are weakly interconnected._