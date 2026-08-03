# Graph Report - src  (2026-08-03)

## Corpus Check
- 91 files · ~86,914 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 533 nodes · 1238 edges · 16 communities (15 shown, 1 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 47 edges (avg confidence: 0.73)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d82f44d3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- types/index.ts
- ContextMenu.tsx
- electron/index.ts
- pipeline.ts
- Toolbar.tsx
- effects/index.ts
- useCanvasStore.ts
- useCanvasStore
- textSpans.ts
- color.ts
- exportFrames.ts
- PreviewShell.tsx
- PropertiesPanel.tsx
- shortcuts.ts
- electron.d.ts

## God Nodes (most connected - your core abstractions)
1. `useCanvasStore` - 53 edges
2. `buildFilterPipeline()` - 20 edges
3. `useViewportStore` - 20 edges
4. `useSnapGuides()` - 18 edges
5. `selectScale()` - 17 edges
6. `SnapGuide` - 16 edges
7. `iconBtnProps` - 15 edges
8. `CanvasImageNodeInner()` - 14 edges
9. `CarouselStage()` - 14 edges
10. `buildEffectFilters()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `ShortcutOverlay()` --calls--> `useCanvasStore`  [INFERRED]
  src/ui/ShortcutOverlay.tsx → src/canvas/useCanvasStore.ts
- `EmptyFrameOverlay()` --indirect_call--> `isEmptyFrame()`  [INFERRED]
  src/canvas/EmptyFrameOverlay.tsx → src/canvas/frameModel.ts
- `buildFilter()` --calls--> `hexToRgb()`  [INFERRED]
  src/canvas/effects/halation.ts → src/utils/color.ts
- `EffectsSection()` --calls--> `getAllEffectDefinitions()`  [INFERRED]
  src/ui/properties/EffectsSection.tsx → src/canvas/effects/registry.ts
- `TextSection()` --calls--> `getSelectionStyle()`  [INFERRED]
  src/ui/properties/TextSection.tsx → src/canvas/textSpans.ts

## Import Cycles
- 3-file cycle: `src/canvas/CanvasPathNode.tsx -> src/canvas/useSnapGuides.ts -> src/canvas/frameClip.ts -> src/canvas/CanvasPathNode.tsx`
- 3-file cycle: `src/canvas/CanvasPathNode.tsx -> src/canvas/useCanvasStore.ts -> src/canvas/frameClip.ts -> src/canvas/CanvasPathNode.tsx`
- 4-file cycle: `src/canvas/CanvasPathNode.tsx -> src/canvas/useSnapGuides.ts -> src/canvas/useCanvasStore.ts -> src/canvas/frameClip.ts -> src/canvas/CanvasPathNode.tsx`
- 4-file cycle: `src/canvas/CanvasPathNode.tsx -> src/canvas/makeCanvasNode.tsx -> src/canvas/useCanvasStore.ts -> src/canvas/frameClip.ts -> src/canvas/CanvasPathNode.tsx`

## Communities (16 total, 1 thin omitted)

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

### Community 4 - "Toolbar.tsx"
Cohesion: 0.06
Nodes (33): posixDirname(), posixRelative(), posixResolve(), relativizeVideoObjects(), resolveVideoObjects(), useAutosave(), buildProjectSnapshot(), App() (+25 more)

### Community 5 - "effects/index.ts"
Cohesion: 0.17
Nodes (12): effectsFingerprint(), effectsPipelineCache, boxBlurH(), boxBlurV(), buildFilter(), EffectControlDescriptor, EffectDefinition, EffectParams (+4 more)

### Community 6 - "useCanvasStore.ts"
Cohesion: 0.06
Nodes (32): normalizeAnchors(), buildEmptyFrameImage(), EmptyFrameSpec, frameToEmptyImage(), isEmptyFrame(), makeEmptyCell(), canBecomeFrame(), findDropTargetId() (+24 more)

### Community 9 - "useCanvasStore"
Cohesion: 0.07
Nodes (78): CanvasGroupNode(), CanvasGroupNodeInner, CanvasGroupNodeProps, hitTestCell(), CanvasGuidelineNode, CanvasGuidelineNodeInner(), CanvasGuidelineNodeOuter(), InnerProps (+70 more)

### Community 10 - "textSpans.ts"
Cohesion: 0.16
Nodes (18): applyStyleToAll(), applyStyleToRange(), getSelectionStyle(), mergeAdjacentSpans(), ResolvedSpanStyle, resolveSpanStyle(), SelectionStyle, spanText() (+10 more)

### Community 12 - "color.ts"
Cohesion: 0.36
Nodes (8): clampInt(), clamp(), hexToHsl(), hexToRgb(), hslToHex(), hslToRgb(), rgbToHex(), rgbToHsl()

### Community 14 - "exportFrames.ts"
Cohesion: 0.23
Nodes (13): getStageInstance(), captureVideoFrameSequence(), downloadFrames(), exportFrames(), exportMixedFrames(), videoObjectsInFrame(), getVideoElement(), registerVideoElement() (+5 more)

### Community 15 - "PreviewShell.tsx"
Cohesion: 0.18
Nodes (8): capturePreviewFrames(), FrameSlideProps, PreviewShell(), VideoOverlayItemProps, getShell(), PlatformShellProps, registerShell(), SHELL_REGISTRY

### Community 16 - "PropertiesPanel.tsx"
Cohesion: 0.05
Nodes (62): hudBtnStyle, ColorInput(), ColorInputProps, ColorMode, ColorPopover(), loadRecentColors(), MixedColorInput(), MixedColorInputProps (+54 more)

### Community 22 - "shortcuts.ts"
Cohesion: 0.40
Nodes (4): ShortcutOverlay(), SHORTCUT_GROUPS, ShortcutEntry, ShortcutGroup

## Knowledge Gaps
- **112 isolated node(s):** `AIContextValue`, `AIStoreState`, `UseBackgroundRemovalReturn`, `CanvasGroupNodeInner`, `Props` (+107 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useCanvasStore` connect `useCanvasStore` to `ContextMenu.tsx`, `Toolbar.tsx`, `useCanvasStore.ts`, `textSpans.ts`, `exportFrames.ts`, `PreviewShell.tsx`, `PropertiesPanel.tsx`, `shortcuts.ts`?**
  _High betweenness centrality (0.314) - this node is a cross-community bridge._
- **Why does `PropertiesPanel()` connect `ContextMenu.tsx` to `PropertiesPanel.tsx`, `useCanvasStore`, `textSpans.ts`, `Toolbar.tsx`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Why does `TitleBar()` connect `Toolbar.tsx` to `PropertiesPanel.tsx`, `useCanvasStore`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Are the 10 inferred relationships involving `useCanvasStore` (e.g. with `CanvasHud()` and `ContextMenu()`) actually correct?**
  _`useCanvasStore` has 10 INFERRED edges - model-reasoned connections that need verification._
- **Are the 7 inferred relationships involving `selectScale()` (e.g. with `CanvasImageNodeInner()` and `CanvasPathNodeInner()`) actually correct?**
  _`selectScale()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `AIContextValue`, `AIStoreState`, `UseBackgroundRemovalReturn` to the rest of the system?**
  _112 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `types/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08787878787878788 - nodes in this community are weakly interconnected._