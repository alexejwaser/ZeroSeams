# Graph Report - src  (2026-08-04)

## Corpus Check
- 100 files · ~102,392 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 666 nodes · 1505 edges · 24 communities
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 30 edges (avg confidence: 0.78)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0acbb18b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- types/index.ts
- ContextMenu.tsx
- electron/index.ts
- pipeline.ts
- store/index.ts
- effects/index.ts
- useCanvasStore.ts
- FrameSection.tsx
- fileManager.ts
- CarouselStage.tsx
- useThumbnailStore.ts
- mediaPlacement.ts
- FillEditor.tsx
- ColorInput.tsx
- exportFrames.ts
- PreviewShell.tsx
- PropertiesPanel.tsx
- iconBtnProps
- Toolbar.tsx
- shortcuts.ts
- electron.d.ts
- NewDocumentScreen.tsx
- Tooltip.tsx

## God Nodes (most connected - your core abstractions)
1. `useCanvasStore` - 46 edges
2. `buildFilterPipeline()` - 20 edges
3. `useViewportStore` - 19 edges
4. `useSnapGuides()` - 18 edges
5. `selectScale()` - 17 edges
6. `iconBtnProps` - 17 edges
7. `SnapGuide` - 16 edges
8. `Tooltip()` - 16 edges
9. `CarouselStage()` - 15 edges
10. `CanvasVideoNodeInner()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `EmptyFrameOverlay()` --indirect_call--> `isEmptyFrame()`  [INFERRED]
  src/canvas/EmptyFrameOverlay.tsx → src/canvas/frameModel.ts
- `EffectsSection()` --calls--> `getAllEffectDefinitions()`  [INFERRED]
  src/ui/properties/EffectsSection.tsx → src/canvas/effects/registry.ts
- `FillEditor()` --calls--> `normalizeFill()`  [INFERRED]
  src/ui/properties/FillEditor.tsx → src/canvas/fill.ts
- `FillEditor()` --calls--> `fillPreviewCss()`  [INFERRED]
  src/ui/properties/FillEditor.tsx → src/canvas/fill.ts
- `FrameSection()` --calls--> `isEmptyFrame()`  [INFERRED]
  src/ui/properties/FrameSection.tsx → src/canvas/frameModel.ts

## Import Cycles
- 3-file cycle: `src/canvas/CanvasPathNode.tsx -> src/canvas/useCanvasStore.ts -> src/canvas/frameClip.ts -> src/canvas/CanvasPathNode.tsx`
- 3-file cycle: `src/canvas/CanvasPathNode.tsx -> src/canvas/useSnapGuides.ts -> src/canvas/frameClip.ts -> src/canvas/CanvasPathNode.tsx`
- 4-file cycle: `src/canvas/CanvasPathNode.tsx -> src/canvas/makeCanvasNode.tsx -> src/canvas/useCanvasStore.ts -> src/canvas/frameClip.ts -> src/canvas/CanvasPathNode.tsx`
- 4-file cycle: `src/canvas/CanvasPathNode.tsx -> src/canvas/useSnapGuides.ts -> src/canvas/useCanvasStore.ts -> src/canvas/frameClip.ts -> src/canvas/CanvasPathNode.tsx`

## Communities (24 total, 0 thin omitted)

### Community 0 - "types/index.ts"
Cohesion: 0.09
Nodes (42): AIOperation, AIOperationBase, AIOperationStatus, AIOperationType, BackgroundRemovalOperation, InpaintingOperation, SegmentationOperation, AnchorPoint (+34 more)

### Community 1 - "ContextMenu.tsx"
Cohesion: 0.20
Nodes (11): AIContext, AIContextValue, useAI(), AIProvider(), AIStoreState, useAIStore, useBackgroundRemoval(), UseBackgroundRemovalReturn (+3 more)

### Community 2 - "electron/index.ts"
Cohesion: 0.06
Nodes (39): addRecentFile(), buildAppMenu(), createWindow(), ExternalEditor, getGlobalSwatchesPath(), getPreferencesPath(), getRecentFilesPath(), pendingOpenFiles (+31 more)

### Community 3 - "pipeline.ts"
Cohesion: 0.19
Nodes (24): adjFingerprint(), build3DLUT(), buildFilterPipeline(), buildFloatLUT(), buildLUT(), evict(), floatLutCache, isAllDefault() (+16 more)

### Community 4 - "store/index.ts"
Cohesion: 0.12
Nodes (14): App(), ErrorBoundary, NewDocumentGate(), rootEl, ExportState, useExportStore, SaveStatus, SaveStatusState (+6 more)

### Community 5 - "effects/index.ts"
Cohesion: 0.14
Nodes (17): boxBlurH(), boxBlurV(), buildFilter(), EffectControlDescriptor, EffectDefinition, EffectParams, getAllEffectDefinitions(), getEffectDefinition() (+9 more)

### Community 6 - "useCanvasStore.ts"
Cohesion: 0.06
Nodes (32): denormalizeFill(), normalizeAnchors(), buildEmptyFrameImage(), EmptyFrameSpec, frameToEmptyImage(), isEmptyFrame(), makeEmptyCell(), canBecomeFrame() (+24 more)

### Community 7 - "FrameSection.tsx"
Cohesion: 0.19
Nodes (11): isFrameObject(), buttonStyle, CLIP_KINDS, destructiveButtonStyle, FrameSectionProps, labelStyle, rowStyle, pickImageMedia() (+3 more)

### Community 8 - "fileManager.ts"
Cohesion: 0.14
Nodes (30): posixDirname(), posixRelative(), posixResolve(), relativizeVideoObjects(), resolveVideoObjects(), makeFrames(), cancelNewDocument(), CreateDocumentSpec (+22 more)

### Community 9 - "CarouselStage.tsx"
Cohesion: 0.06
Nodes (84): CanvasGroupNode(), CanvasGroupNodeInner, CanvasGroupNodeProps, hitTestCell(), CanvasGuidelineNode, CanvasGuidelineNodeInner(), CanvasGuidelineNodeOuter(), InnerProps (+76 more)

### Community 10 - "useThumbnailStore.ts"
Cohesion: 0.11
Nodes (31): apply2dFill(), cssStops(), DEFAULT_GRADIENT_STOPS, fillPreviewCss(), flatStops(), isBlankColor(), linearEndpoints(), NO_FILL (+23 more)

### Community 11 - "mediaPlacement.ts"
Cohesion: 0.10
Nodes (25): BuildImageArgs, buildImageObject(), BuildVideoArgs, buildVideoObject(), defaultDropPoint(), fitMediaBox(), frameCenter(), frameIndexAt() (+17 more)

### Community 12 - "FillEditor.tsx"
Cohesion: 0.19
Nodes (11): AdjustmentValue(), FillEditor(), FillEditorProps, FillKind, kindOf(), KINDS, labelStyle, rowStyle (+3 more)

### Community 13 - "ColorInput.tsx"
Cohesion: 0.14
Nodes (15): ColorInput(), ColorInputProps, ColorMode, ColorPopover(), loadRecentColors(), MixedColorInput(), MixedColorInputProps, placePopover() (+7 more)

### Community 14 - "exportFrames.ts"
Cohesion: 0.29
Nodes (11): captureVideoFrameSequence(), downloadFrames(), exportMixedFrames(), videoObjectsInFrame(), getVideoElement(), registerVideoElement(), registry, encodeVideoFrames() (+3 more)

### Community 15 - "PreviewShell.tsx"
Cohesion: 0.18
Nodes (8): capturePreviewFrames(), FrameSlideProps, PreviewShell(), VideoOverlayItemProps, getShell(), PlatformShellProps, registerShell(), SHELL_REGISTRY

### Community 16 - "PropertiesPanel.tsx"
Cohesion: 0.13
Nodes (20): FontPicker(), MAC_SYSTEM_FONTS, AddClipRow(), ctaButtonStyle, OPTIONS, AlignDistributeSection(), AlignDistributeSectionProps, alignButtonStyle() (+12 more)

### Community 18 - "iconBtnProps"
Cohesion: 0.18
Nodes (14): iconBtnProps, iconBtnStyle(), AdjustmentsSection(), AdjustmentsSectionProps, subGroupLabelStyle, TRACK_GRADIENT, EFFECT_PARAM_UNITS, EffectSliderRowProps (+6 more)

### Community 20 - "Toolbar.tsx"
Cohesion: 0.10
Nodes (22): FrameSettingsPopover(), FrameSettingsPopoverProps, labelStyle, PLATFORM_LABELS, PLATFORMS, segmentButtonStyle(), GridPicker(), GridPickerProps (+14 more)

### Community 22 - "shortcuts.ts"
Cohesion: 0.40
Nodes (3): SHORTCUT_GROUPS, ShortcutEntry, ShortcutGroup

### Community 23 - "electron.d.ts"
Cohesion: 0.05
Nodes (3): ExternalEditor, SwatchDTO, Window

### Community 24 - "NewDocumentScreen.tsx"
Cohesion: 0.22
Nodes (10): filenameError(), NewDocumentScreen(), NewDocumentScreenProps, NewDocumentSpec, PLATFORM_LABELS, PLATFORMS, RecentFile, sectionLabel (+2 more)

### Community 26 - "Tooltip.tsx"
Cohesion: 0.18
Nodes (7): hudBtnStyle, FrameLabelStrip(), FrameLabelStripProps, frameSlotOffset(), LayerPanel(), Tooltip(), TooltipProps

## Knowledge Gaps
- **145 isolated node(s):** `AIContextValue`, `AIStoreState`, `UseBackgroundRemovalReturn`, `CanvasGroupNodeInner`, `Props` (+140 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useCanvasStore` connect `CarouselStage.tsx` to `ContextMenu.tsx`, `useCanvasStore.ts`, `useThumbnailStore.ts`, `mediaPlacement.ts`, `exportFrames.ts`, `PreviewShell.tsx`, `iconBtnProps`?**
  _High betweenness centrality (0.220) - this node is a cross-community bridge._
- **Why does `VideoSection()` connect `iconBtnProps` to `PropertiesPanel.tsx`, `CarouselStage.tsx`?**
  _High betweenness centrality (0.144) - this node is a cross-community bridge._
- **Why does `shortenPath()` connect `NewDocumentScreen.tsx` to `types/index.ts`?**
  _High betweenness centrality (0.111) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `useCanvasStore` (e.g. with `PreviewShell()` and `VideoSection()`) actually correct?**
  _`useCanvasStore` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 7 inferred relationships involving `selectScale()` (e.g. with `CanvasImageNodeInner()` and `CanvasPathNodeInner()`) actually correct?**
  _`selectScale()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `AIContextValue`, `AIStoreState`, `UseBackgroundRemovalReturn` to the rest of the system?**
  _145 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `types/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08599033816425121 - nodes in this community are weakly interconnected._