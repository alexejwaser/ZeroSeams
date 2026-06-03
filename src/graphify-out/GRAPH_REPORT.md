# Graph Report - src  (2026-06-03)

## Corpus Check
- 67 files · ~62,201 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 364 nodes · 736 edges · 20 communities (15 shown, 5 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `296ee92a`
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
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]

## God Nodes (most connected - your core abstractions)
1. `useCanvasStore` - 43 edges
2. `buildFilterPipeline()` - 17 edges
3. `useViewportStore` - 14 edges
4. `SnapGuide` - 14 edges
5. `useSnapGuides()` - 14 edges
6. `CarouselStage()` - 10 edges
7. `useSaveStatusStore` - 9 edges
8. `PropertiesPanel()` - 8 edges
9. `iconBtnStyle()` - 8 edges
10. `CanvasObject` - 8 edges

## Surprising Connections (you probably didn't know these)
- `FrameSettingsPopover()` --calls--> `useCanvasStore`  [INFERRED]
  ui/FrameSettingsPopover.tsx → canvas/useCanvasStore.ts
- `EffectsSection()` --calls--> `getAllEffectDefinitions()`  [INFERRED]
  ui/PropertiesPanel.tsx → canvas/effects/registry.ts
- `VideoSection()` --calls--> `useCanvasStore`  [INFERRED]
  ui/PropertiesPanel.tsx → canvas/useCanvasStore.ts
- `PropertiesPanel()` --calls--> `useCanvasStore`  [INFERRED]
  ui/PropertiesPanel.tsx → canvas/useCanvasStore.ts
- `PropertiesPanel()` --calls--> `useThumbnailStore`  [INFERRED]
  ui/PropertiesPanel.tsx → canvas/useThumbnailStore.ts

## Communities (20 total, 5 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (59): CanvasImageNode, CanvasImageNodeInner(), CanvasImageNodeInnerProps, CanvasImageNodeOuter(), CanvasImageNodeProps, anchorsToPathData(), CanvasPathNode, CanvasPathNodeInner() (+51 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (30): getSelectionStyle(), resolveSpanStyle(), useThumbnailStore, FontPicker(), MAC_SYSTEM_FONTS, iconBtnStyle(), LayerPanel(), AdjustmentsSection() (+22 more)

### Community 2 - "Community 2"
Cohesion: 0.13
Nodes (34): AIOperation, AIOperationBase, AIOperationStatus, AIOperationType, BackgroundRemovalOperation, InpaintingOperation, SegmentationOperation, AnchorPoint (+26 more)

### Community 3 - "Community 3"
Cohesion: 0.17
Nodes (20): adjFingerprint(), buildFilterPipeline(), buildLUT(), isAllDefault(), lutCache, makeBlacksFilter(), makeClarityFilter(), makeContrastFilter() (+12 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (25): addRecentFile(), body, corpHeaders, dir, editDir, editor, existing, ExternalEditor (+17 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (32): AIContext, AIContextValue, useAI(), AIProvider(), AIStoreState, useAIStore, useBackgroundRemoval(), UseBackgroundRemovalReturn (+24 more)

### Community 6 - "Community 6"
Cohesion: 0.22
Nodes (12): buildEffectFilters(), boxBlurH(), boxBlurV(), buildFilter(), hexToRgb(), EffectControlDescriptor, EffectDefinition, EffectParams (+4 more)

### Community 7 - "Community 7"
Cohesion: 0.18
Nodes (15): applyStyleToAll(), applyStyleToRange(), fontStyleToCSS(), mergeAdjacentSpans(), ResolvedSpanStyle, SelectionStyle, spanText(), splitSpansAt() (+7 more)

### Community 8 - "Community 8"
Cohesion: 0.12
Nodes (16): AnchorPoint, BaseCanvasObject, CanvasObject, CanvasObjectScope, CanvasObjectType, FontStyle, GroupObject, ImageObject (+8 more)

### Community 19 - "Community 19"
Cohesion: 0.25
Nodes (12): getStageInstance(), captureVideoFrameSequence(), downloadFrames(), exportFrames(), exportMixedFrames(), ExportResult, encodeVideoFrames(), encodeVideoWithAudio() (+4 more)

### Community 20 - "Community 20"
Cohesion: 0.43
Nodes (6): posixDirname(), posixRelative(), posixResolve(), relativizeVideoObjects(), resolveVideoObjects(), buildProjectSnapshot()

## Knowledge Gaps
- **106 isolated node(s):** `rootEl`, `FrameSettingsPopoverProps`, `PLATFORM_LABELS`, `PLATFORMS`, `numberInputStyle` (+101 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useCanvasStore` connect `Community 0` to `Community 1`, `Community 5`, `Community 7`, `Community 19`, `Community 20`?**
  _High betweenness centrality (0.211) - this node is a cross-community bridge._
- **Why does `PropertiesPanel()` connect `Community 5` to `Community 0`, `Community 1`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Why does `VideoSection()` connect `Community 1` to `Community 0`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `useCanvasStore` (e.g. with `FrameSettingsPopover()` and `VideoSection()`) actually correct?**
  _`useCanvasStore` has 6 INFERRED edges - model-reasoned connections that need verification._
- **What connects `rootEl`, `FrameSettingsPopoverProps`, `PLATFORM_LABELS` to the rest of the system?**
  _106 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06259183073758448 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05919661733615222 - nodes in this community are weakly interconnected._