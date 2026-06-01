# Graph Report - src  (2026-06-01)

## Corpus Check
- 61 files · ~50,911 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 314 nodes · 624 edges · 19 communities (13 shown, 6 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f06b612e`
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
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]

## God Nodes (most connected - your core abstractions)
1. `useCanvasStore` - 37 edges
2. `buildFilterPipeline()` - 16 edges
3. `useViewportStore` - 12 edges
4. `SnapGuide` - 12 edges
5. `useSnapGuides()` - 12 edges
6. `useSaveStatusStore` - 9 edges
7. `CarouselStage()` - 9 edges
8. `PropertiesPanel()` - 8 edges
9. `buildLUT()` - 8 edges
10. `ContextMenu()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `FrameSettingsPopover()` --calls--> `useCanvasStore`  [INFERRED]
  ui/FrameSettingsPopover.tsx → canvas/useCanvasStore.ts
- `TextSection()` --calls--> `getSelectionStyle()`  [INFERRED]
  ui/PropertiesPanel.tsx → canvas/textSpans.ts
- `EffectsSection()` --calls--> `getAllEffectDefinitions()`  [INFERRED]
  ui/PropertiesPanel.tsx → canvas/effects/registry.ts
- `PropertiesPanel()` --calls--> `useCanvasStore`  [INFERRED]
  ui/PropertiesPanel.tsx → canvas/useCanvasStore.ts
- `PropertiesPanel()` --calls--> `useAI()`  [INFERRED]
  ui/PropertiesPanel.tsx → ai/AIContext.tsx

## Communities (19 total, 6 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (52): CanvasImageNode, CanvasImageNodeInner(), CanvasImageNodeInnerProps, CanvasImageNodeOuter(), CanvasImageNodeProps, anchorsToPathData(), CanvasPathNode, CanvasPathNodeInner() (+44 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (37): useThumbnailStore, FontPicker(), MAC_SYSTEM_FONTS, FrameSettingsPopover(), FrameSettingsPopoverProps, labelStyle, numberInputStyle, PLATFORM_LABELS (+29 more)

### Community 2 - "Community 2"
Cohesion: 0.13
Nodes (33): AIOperation, AIOperationBase, AIOperationStatus, AIOperationType, BackgroundRemovalOperation, InpaintingOperation, SegmentationOperation, AnchorPoint (+25 more)

### Community 3 - "Community 3"
Cohesion: 0.18
Nodes (19): adjFingerprint(), buildFilterPipeline(), buildLUT(), isAllDefault(), lutCache, makeBlacksFilter(), makeClarityFilter(), makeContrastFilter() (+11 more)

### Community 4 - "Community 4"
Cohesion: 0.10
Nodes (19): addRecentFile(), dir, editDir, editor, existing, ExternalEditor, filePath, files (+11 more)

### Community 5 - "Community 5"
Cohesion: 0.20
Nodes (11): AIContext, AIContextValue, useAI(), AIProvider(), AIStoreState, useAIStore, useBackgroundRemoval(), UseBackgroundRemovalReturn (+3 more)

### Community 6 - "Community 6"
Cohesion: 0.22
Nodes (12): buildEffectFilters(), boxBlurH(), boxBlurV(), buildFilter(), hexToRgb(), EffectControlDescriptor, EffectDefinition, EffectParams (+4 more)

### Community 7 - "Community 7"
Cohesion: 0.16
Nodes (17): applyStyleToAll(), applyStyleToRange(), fontStyleToCSS(), getSelectionStyle(), mergeAdjacentSpans(), ResolvedSpanStyle, resolveSpanStyle(), SelectionStyle (+9 more)

### Community 8 - "Community 8"
Cohesion: 0.12
Nodes (16): AnchorPoint, BaseCanvasObject, CanvasObject, CanvasObjectScope, CanvasObjectType, FontStyle, GroupObject, ImageObject (+8 more)

## Knowledge Gaps
- **88 isolated node(s):** `rootEl`, `FrameSettingsPopoverProps`, `PLATFORM_LABELS`, `PLATFORMS`, `numberInputStyle` (+83 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useCanvasStore` connect `Community 0` to `Community 1`, `Community 5`, `Community 7`?**
  _High betweenness centrality (0.184) - this node is a cross-community bridge._
- **Why does `PropertiesPanel()` connect `Community 1` to `Community 0`, `Community 5`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Why does `useSaveStatusStore` connect `Community 1` to `Community 0`, `Community 5`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `useCanvasStore` (e.g. with `FrameSettingsPopover()` and `PropertiesPanel()`) actually correct?**
  _`useCanvasStore` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `rootEl`, `FrameSettingsPopoverProps`, `PLATFORM_LABELS` to the rest of the system?**
  _88 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06664388243335612 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.053246753246753244 - nodes in this community are weakly interconnected._