# Graph Report - src  (2026-06-04)

## Corpus Check
- 73 files · ~65,348 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 391 nodes · 794 edges · 20 communities (15 shown, 5 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 19 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c37cdaa0`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]

## God Nodes (most connected - your core abstractions)
1. `useCanvasStore` - 45 edges
2. `buildFilterPipeline()` - 17 edges
3. `useViewportStore` - 16 edges
4. `SnapGuide` - 14 edges
5. `useSnapGuides()` - 14 edges
6. `useSaveStatusStore` - 10 edges
7. `CarouselStage()` - 10 edges
8. `iconBtnStyle()` - 9 edges
9. `PropertiesPanel()` - 8 edges
10. `CanvasObject` - 8 edges

## Surprising Connections (you probably didn't know these)
- `App()` --calls--> `useExportStore`  [INFERRED]
  main.tsx → ui/useExportStore.ts
- `FrameSettingsPopover()` --calls--> `useCanvasStore`  [INFERRED]
  ui/FrameSettingsPopover.tsx → canvas/useCanvasStore.ts
- `TextSection()` --calls--> `getSelectionStyle()`  [INFERRED]
  ui/PropertiesPanel.tsx → canvas/textSpans.ts
- `EffectsSection()` --calls--> `getAllEffectDefinitions()`  [INFERRED]
  ui/PropertiesPanel.tsx → canvas/effects/registry.ts
- `VideoSection()` --calls--> `useCanvasStore`  [INFERRED]
  ui/PropertiesPanel.tsx → canvas/useCanvasStore.ts

## Communities (20 total, 5 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (57): CanvasImageNode, CanvasImageNodeInner(), CanvasImageNodeInnerProps, CanvasImageNodeOuter(), CanvasImageNodeProps, anchorsToPathData(), CanvasPathNode, CanvasPathNodeInner() (+49 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (40): AIContext, AIContextValue, useAI(), AIProvider(), AIStoreState, useAIStore, useBackgroundRemoval(), UseBackgroundRemovalReturn (+32 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (27): FontPicker(), MAC_SYSTEM_FONTS, iconBtnStyle(), LayerPanel(), AdjustmentsSection(), AdjustmentsSectionProps, alignButtonStyle(), AlignDistributeSection() (+19 more)

### Community 3 - "Community 3"
Cohesion: 0.13
Nodes (34): AIOperation, AIOperationBase, AIOperationStatus, AIOperationType, BackgroundRemovalOperation, InpaintingOperation, SegmentationOperation, AnchorPoint (+26 more)

### Community 4 - "Community 4"
Cohesion: 0.14
Nodes (24): adjFingerprint(), build3DLUT(), buildFilterPipeline(), buildFloatLUT(), buildLUT(), floatLutCache, isAllDefault(), lut3dCache (+16 more)

### Community 5 - "Community 5"
Cohesion: 0.08
Nodes (25): addRecentFile(), body, corpHeaders, dir, editDir, editor, existing, ExternalEditor (+17 more)

### Community 6 - "Community 6"
Cohesion: 0.20
Nodes (14): captureVideoFrameSequence(), downloadFrames(), exportMixedFrames(), ExportResult, getVideoElement(), registerVideoElement(), registry, unregisterVideoElement() (+6 more)

### Community 7 - "Community 7"
Cohesion: 0.17
Nodes (7): FrameSlideProps, PreviewShell(), VideoOverlayItemProps, getShell(), PlatformShellProps, registerShell(), SHELL_REGISTRY

### Community 8 - "Community 8"
Cohesion: 0.15
Nodes (19): applyStyleToAll(), applyStyleToRange(), fontStyleToCSS(), getSelectionStyle(), mergeAdjacentSpans(), ResolvedSpanStyle, resolveSpanStyle(), SelectionStyle (+11 more)

### Community 9 - "Community 9"
Cohesion: 0.23
Nodes (11): boxBlurH(), boxBlurV(), buildFilter(), hexToRgb(), EffectControlDescriptor, EffectDefinition, EffectParams, getAllEffectDefinitions() (+3 more)

### Community 10 - "Community 10"
Cohesion: 0.12
Nodes (16): AnchorPoint, BaseCanvasObject, CanvasObject, CanvasObjectScope, CanvasObjectType, FontStyle, GroupObject, ImageObject (+8 more)

## Knowledge Gaps
- **111 isolated node(s):** `rootEl`, `FrameSettingsPopoverProps`, `PLATFORM_LABELS`, `PLATFORMS`, `numberInputStyle` (+106 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useCanvasStore` connect `Community 0` to `Community 8`, `Community 1`, `Community 2`, `Community 7`?**
  _High betweenness centrality (0.269) - this node is a cross-community bridge._
- **Why does `PreviewShell()` connect `Community 7` to `Community 0`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Why does `PropertiesPanel()` connect `Community 1` to `Community 0`, `Community 8`, `Community 2`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Are the 8 inferred relationships involving `useCanvasStore` (e.g. with `FrameSettingsPopover()` and `VideoSection()`) actually correct?**
  _`useCanvasStore` has 8 INFERRED edges - model-reasoned connections that need verification._
- **What connects `rootEl`, `FrameSettingsPopoverProps`, `PLATFORM_LABELS` to the rest of the system?**
  _111 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06925624811803674 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.059322033898305086 - nodes in this community are weakly interconnected._