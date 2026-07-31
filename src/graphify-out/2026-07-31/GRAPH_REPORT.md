# Graph Report - src  (2026-07-31)

## Corpus Check
- 90 files · ~84,061 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 526 nodes · 1214 edges · 23 communities (22 shown, 1 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 37 edges (avg confidence: 0.79)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `356711f4`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- types/index.ts
- ContextMenu.tsx
- electron/index.ts
- pipeline.ts
- relativizeVideoObjects
- buildEffectFilters
- useCanvasStore.ts
- Toolbar.tsx
- VideoSection.tsx
- useCanvasStore
- useThumbnailStore.ts
- ColorInput.tsx
- color.ts
- CanvasVideoNode.tsx
- exportFrames.ts
- PreviewShell.tsx
- shared.tsx
- PropertiesPanel.tsx
- NumericInput.tsx
- Tooltip.tsx
- shortcuts.ts
- electron.d.ts

## God Nodes (most connected - your core abstractions)
1. `useCanvasStore` - 53 edges
2. `buildFilterPipeline()` - 20 edges
3. `useViewportStore` - 20 edges
4. `useSnapGuides()` - 18 edges
5. `selectScale()` - 17 edges
6. `SnapGuide` - 16 edges
7. `iconBtnStyle()` - 15 edges
8. `CanvasImageNodeInner()` - 14 edges
9. `CarouselStage()` - 14 edges
10. `buildEffectFilters()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `ShortcutOverlay()` --calls--> `useCanvasStore`  [INFERRED]
  src/ui/ShortcutOverlay.tsx → src/canvas/useCanvasStore.ts
- `CanvasImageNodeInner()` --indirect_call--> `selectScale()`  [INFERRED]
  src/canvas/CanvasImageNode.tsx → src/canvas/useViewportStore.ts
- `CanvasVideoNodeInner()` --indirect_call--> `selectScale()`  [INFERRED]
  src/canvas/CanvasVideoNode.tsx → src/canvas/useViewportStore.ts
- `buildFilter()` --calls--> `hexToRgb()`  [INFERRED]
  src/canvas/effects/halation.ts → src/utils/color.ts
- `EffectsSection()` --calls--> `getAllEffectDefinitions()`  [INFERRED]
  src/ui/properties/EffectsSection.tsx → src/canvas/effects/registry.ts

## Import Cycles
- 3-file cycle: `src/canvas/CanvasPathNode.tsx -> src/canvas/useSnapGuides.ts -> src/canvas/frameClip.ts -> src/canvas/CanvasPathNode.tsx`
- 3-file cycle: `src/canvas/CanvasPathNode.tsx -> src/canvas/useCanvasStore.ts -> src/canvas/frameClip.ts -> src/canvas/CanvasPathNode.tsx`
- 4-file cycle: `src/canvas/CanvasPathNode.tsx -> src/canvas/useSnapGuides.ts -> src/canvas/useCanvasStore.ts -> src/canvas/frameClip.ts -> src/canvas/CanvasPathNode.tsx`
- 4-file cycle: `src/canvas/CanvasPathNode.tsx -> src/canvas/makeCanvasNode.tsx -> src/canvas/useCanvasStore.ts -> src/canvas/frameClip.ts -> src/canvas/CanvasPathNode.tsx`

## Communities (23 total, 1 thin omitted)

### Community 0 - "types/index.ts"
Cohesion: 0.09
Nodes (41): MaskData, AIOperation, AIOperationBase, AIOperationStatus, AIOperationType, BackgroundRemovalOperation, InpaintingOperation, SegmentationOperation (+33 more)

### Community 1 - "ContextMenu.tsx"
Cohesion: 0.18
Nodes (13): AIContext, AIContextValue, useAI(), AIProvider(), AIStoreState, useAIStore, useBackgroundRemoval(), UseBackgroundRemovalReturn (+5 more)

### Community 2 - "electron/index.ts"
Cohesion: 0.07
Nodes (28): addRecentFile(), ExternalEditor, getPreferencesPath(), getRecentFilesPath(), Preferences, readPreferences(), tempFiles, watchers (+20 more)

### Community 3 - "pipeline.ts"
Cohesion: 0.19
Nodes (24): adjFingerprint(), build3DLUT(), buildFilterPipeline(), buildFloatLUT(), buildLUT(), evict(), floatLutCache, isAllDefault() (+16 more)

### Community 4 - "relativizeVideoObjects"
Cohesion: 0.11
Nodes (16): posixDirname(), posixRelative(), posixResolve(), relativizeVideoObjects(), resolveVideoObjects(), useAutosave(), buildProjectSnapshot(), App() (+8 more)

### Community 5 - "buildEffectFilters"
Cohesion: 0.17
Nodes (13): buildEffectFilters(), effectsFingerprint(), effectsPipelineCache, boxBlurH(), boxBlurV(), buildFilter(), EffectControlDescriptor, EffectDefinition (+5 more)

### Community 6 - "useCanvasStore.ts"
Cohesion: 0.08
Nodes (24): normalizeAnchors(), buildEmptyFrameImage(), EmptyFrameSpec, frameToEmptyImage(), makeEmptyCell(), canBecomeFrame(), findDropTargetId(), fitCover() (+16 more)

### Community 7 - "Toolbar.tsx"
Cohesion: 0.15
Nodes (10): GridPicker(), GridPickerProps, buildProjectJson(), loadExportSettings(), PersistedExportSettings, PLATFORM_RECOMMENDED, PresetKey, TitleBar() (+2 more)

### Community 8 - "VideoSection.tsx"
Cohesion: 0.17
Nodes (13): iconBtnStyle(), LayerPanel(), AdjustmentsSection(), AdjustmentsSectionProps, subGroupLabelStyle, TRACK_GRADIENT, EffectsSection(), EffectsSectionProps (+5 more)

### Community 9 - "useCanvasStore"
Cohesion: 0.06
Nodes (70): CanvasGroupNode(), CanvasGroupNodeInner, CanvasGroupNodeProps, CanvasGuidelineNode, CanvasGuidelineNodeInner(), CanvasGuidelineNodeOuter(), InnerProps, Props (+62 more)

### Community 10 - "useThumbnailStore.ts"
Cohesion: 0.33
Nodes (8): anchorsToPathData(), computePathBBox(), generateThumbnail(), PathBBox, ThumbnailState, useThumbnailGenerator(), useThumbnailStore, generateMaskThumbnail()

### Community 11 - "ColorInput.tsx"
Cohesion: 0.21
Nodes (12): ColorInput(), ColorInputProps, ColorMode, ColorPopover(), loadRecentColors(), MixedColorInput(), MixedColorInputProps, PopoverProps (+4 more)

### Community 12 - "color.ts"
Cohesion: 0.36
Nodes (8): clampInt(), clamp(), hexToHsl(), hexToRgb(), hslToHex(), hslToRgb(), rgbToHex(), rgbToHsl()

### Community 13 - "CanvasVideoNode.tsx"
Cohesion: 0.16
Nodes (25): CanvasImageNode, CanvasImageNodeInner(), CanvasImageNodeInnerProps, CanvasImageNodeProps, NOTE: does not call onGuidesChange — guides are emitted by the onTransform, anchorsToPathData(), CanvasVideoNode, CanvasVideoNodeInner() (+17 more)

### Community 14 - "exportFrames.ts"
Cohesion: 0.30
Nodes (11): getStageInstance(), captureVideoFrameSequence(), downloadFrames(), exportFrames(), exportMixedFrames(), videoObjectsInFrame(), getVideoElement(), encodeVideoFrames() (+3 more)

### Community 15 - "PreviewShell.tsx"
Cohesion: 0.18
Nodes (8): capturePreviewFrames(), FrameSlideProps, PreviewShell(), VideoOverlayItemProps, getShell(), PlatformShellProps, registerShell(), SHELL_REGISTRY

### Community 16 - "shared.tsx"
Cohesion: 0.18
Nodes (12): FontPicker(), MAC_SYSTEM_FONTS, AlignDistributeSection(), AlignDistributeSectionProps, alignButtonStyle(), distributeButtonStyle(), MixedNumberField(), MixedNumberFieldProps (+4 more)

### Community 17 - "PropertiesPanel.tsx"
Cohesion: 0.22
Nodes (11): buttonStyle, clipKindLabel(), destructiveButtonStyle, FrameSection(), FrameSectionProps, labelStyle, rowStyle, pickImageMedia() (+3 more)

### Community 18 - "NumericInput.tsx"
Cohesion: 0.21
Nodes (9): FrameSettingsPopover(), FrameSettingsPopoverProps, labelStyle, PLATFORM_LABELS, PLATFORMS, segmentButtonStyle(), formatVal(), NumericInput() (+1 more)

### Community 19 - "Tooltip.tsx"
Cohesion: 0.27
Nodes (6): hudBtnStyle, FrameLabelStrip(), FrameLabelStripProps, frameSlotOffset(), Tooltip(), TooltipProps

### Community 22 - "shortcuts.ts"
Cohesion: 0.40
Nodes (4): ShortcutOverlay(), SHORTCUT_GROUPS, ShortcutEntry, ShortcutGroup

## Knowledge Gaps
- **109 isolated node(s):** `AIContextValue`, `AIStoreState`, `UseBackgroundRemovalReturn`, `CanvasGroupNodeInner`, `Props` (+104 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useCanvasStore` connect `useCanvasStore` to `ContextMenu.tsx`, `relativizeVideoObjects`, `useCanvasStore.ts`, `Toolbar.tsx`, `VideoSection.tsx`, `useThumbnailStore.ts`, `CanvasVideoNode.tsx`, `exportFrames.ts`, `PreviewShell.tsx`, `NumericInput.tsx`, `shortcuts.ts`?**
  _High betweenness centrality (0.312) - this node is a cross-community bridge._
- **Why does `TitleBar()` connect `Toolbar.tsx` to `VideoSection.tsx`, `useCanvasStore`, `ColorInput.tsx`, `relativizeVideoObjects`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Why does `PropertiesPanel()` connect `ContextMenu.tsx` to `relativizeVideoObjects`, `useCanvasStore`, `useThumbnailStore.ts`, `ColorInput.tsx`, `PropertiesPanel.tsx`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Are the 10 inferred relationships involving `useCanvasStore` (e.g. with `PreviewShell()` and `VideoSection()`) actually correct?**
  _`useCanvasStore` has 10 INFERRED edges - model-reasoned connections that need verification._
- **Are the 7 inferred relationships involving `selectScale()` (e.g. with `CanvasImageNodeInner()` and `CanvasPathNodeInner()`) actually correct?**
  _`selectScale()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `AIContextValue`, `AIStoreState`, `UseBackgroundRemovalReturn` to the rest of the system?**
  _109 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `types/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08787878787878788 - nodes in this community are weakly interconnected._