# Graph Report - src  (2026-08-03)

## Corpus Check
- 98 files · ~99,883 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 834 nodes · 2403 edges · 30 communities (29 shown, 1 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 67 edges (avg confidence: 0.75)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `63d7323d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_typesindex.ts|types/index.ts]]
- [[_COMMUNITY_ContextMenu.tsx|ContextMenu.tsx]]
- [[_COMMUNITY_electronindex.ts|electron/index.ts]]
- [[_COMMUNITY_pipeline.ts|pipeline.ts]]
- [[_COMMUNITY_Toolbar.tsx|Toolbar.tsx]]
- [[_COMMUNITY_effectsindex.ts|effects/index.ts]]
- [[_COMMUNITY_useCanvasStore.ts|useCanvasStore.ts]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_useCanvasStore|useCanvasStore]]
- [[_COMMUNITY_textSpans.ts|textSpans.ts]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_color.ts|color.ts]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_exportFrames.ts|exportFrames.ts]]
- [[_COMMUNITY_PreviewShell.tsx|PreviewShell.tsx]]
- [[_COMMUNITY_PropertiesPanel.tsx|PropertiesPanel.tsx]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_shortcuts.ts|shortcuts.ts]]
- [[_COMMUNITY_electron.d.ts|electron.d.ts]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]

## God Nodes (most connected - your core abstractions)
1. `useCanvasStore` - 79 edges
2. `types/index.ts` - 33 edges
3. `useViewportStore` - 32 edges
4. `electron/index.ts` - 32 edges
5. `useSnapGuides()` - 27 edges
6. `selectScale()` - 26 edges
7. `SnapGuide` - 25 edges
8. `NumericInput()` - 23 edges
9. `iconBtnProps` - 23 edges
10. `buildFilterPipeline()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `NewDocumentGate()` --calls--> `useSaveStatusStore`  [INFERRED]
  main.tsx → store/useSaveStatusStore.ts
- `App()` --calls--> `useExportStore`  [INFERRED]
  main.tsx → store/useExportStore.ts
- `FrameSettingsPopover()` --calls--> `useCanvasStore`  [INFERRED]
  ui/FrameSettingsPopover.tsx → canvas/useCanvasStore.ts
- `PropertiesPanel()` --calls--> `useCanvasStore`  [INFERRED]
  ui/PropertiesPanel.tsx → canvas/useCanvasStore.ts
- `PropertiesPanel()` --calls--> `useSaveStatusStore`  [INFERRED]
  ui/PropertiesPanel.tsx → store/useSaveStatusStore.ts

## Communities (30 total, 1 thin omitted)

### Community 0 - "types/index.ts"
Cohesion: 0.13
Nodes (44): MaskData, AIOperation, AIOperationBase, AIOperationStatus, AIOperationType, BackgroundRemovalOperation, InpaintingOperation, SegmentationOperation (+36 more)

### Community 1 - "ContextMenu.tsx"
Cohesion: 0.18
Nodes (16): AIContext, AIContextValue, useAI(), AIProvider(), ai/index.ts, AIStoreState, useAIStore, useBackgroundRemoval() (+8 more)

### Community 2 - "electron/index.ts"
Cohesion: 0.07
Nodes (25): electron/index.ts, ExternalEditor, getZeroSeamsDir(), Preferences, tempFiles, watchers, body, buf (+17 more)

### Community 3 - "pipeline.ts"
Cohesion: 0.19
Nodes (24): adjFingerprint(), build3DLUT(), buildFilterPipeline(), buildFloatLUT(), buildLUT(), evict(), floatLutCache, isAllDefault() (+16 more)

### Community 4 - "Toolbar.tsx"
Cohesion: 0.09
Nodes (20): App(), ErrorBoundary, rootEl, App(), ErrorBoundary, NewDocumentGate(), rootEl, store/index.ts (+12 more)

### Community 5 - "effects/index.ts"
Cohesion: 0.20
Nodes (12): boxBlurH(), boxBlurV(), buildFilter(), effects/index.ts, effects/registry.ts, EffectControlDescriptor, EffectDefinition, EffectParams (+4 more)

### Community 6 - "useCanvasStore.ts"
Cohesion: 0.08
Nodes (41): EmptyFrameOverlay(), buildEmptyFrameImage(), EmptyFrameSpec, frameToEmptyImage(), isEmptyFrame(), isFrameObject(), isGridCell(), makeEmptyCell() (+33 more)

### Community 7 - "Community 7"
Cohesion: 0.06
Nodes (54): AddClipRow(), ctaButtonStyle, OPTIONS, AdjustmentsSection(), AdjustmentsSectionProps, AdjustmentValue(), subGroupLabelStyle, TRACK_GRADIENT (+46 more)

### Community 8 - "Community 8"
Cohesion: 0.11
Nodes (30): posixDirname(), posixRelative(), posixResolve(), relativizeVideoObjects(), resolveVideoObjects(), ContentSignature, useAutosave(), buildProjectSnapshot() (+22 more)

### Community 9 - "useCanvasStore"
Cohesion: 0.08
Nodes (83): CanvasGroupNode(), CanvasGroupNodeInner, CanvasGroupNodeProps, hitTestCell(), CanvasGuidelineNode, CanvasGuidelineNodeInner(), CanvasGuidelineNodeOuter(), InnerProps (+75 more)

### Community 10 - "textSpans.ts"
Cohesion: 0.12
Nodes (33): apply2dFill(), cssStops(), DEFAULT_GRADIENT_STOPS, denormalizeFill(), fillPreviewCss(), flatStops(), isBlankColor(), konvaFillProps (+25 more)

### Community 11 - "Community 11"
Cohesion: 0.07
Nodes (25): body, buf, buffer, corpHeaders, createWindow(), editDir, editor, existing (+17 more)

### Community 12 - "color.ts"
Cohesion: 0.16
Nodes (17): boxBlurH(), boxBlurV(), buildFilter(), EffectControlDescriptor, EffectDefinition, EffectParams, getAllEffectDefinitions(), getEffectDefinition() (+9 more)

### Community 13 - "Community 13"
Cohesion: 0.17
Nodes (21): clampInt(), ColorInput(), ColorInputProps, ColorMode, ColorPopover(), loadRecentColors(), MixedColorInput(), MixedColorInputProps (+13 more)

### Community 14 - "exportFrames.ts"
Cohesion: 0.23
Nodes (15): getStageInstance(), captureVideoFrameSequence(), downloadFrames(), exportFrames(), exportMixedFrames(), videoObjectsInFrame(), canvas/index.ts, getVideoElement() (+7 more)

### Community 15 - "PreviewShell.tsx"
Cohesion: 0.18
Nodes (9): capturePreviewFrames(), FrameSlideProps, PreviewShell(), VideoOverlayItemProps, shells/registry.ts, getShell(), PlatformShellProps, registerShell() (+1 more)

### Community 16 - "PropertiesPanel.tsx"
Cohesion: 0.13
Nodes (24): AddClipRow(), ctaButtonStyle, OPTIONS, AlignDistributeSection(), AlignDistributeSectionProps, buttonStyle, CLIP_KINDS, destructiveButtonStyle (+16 more)

### Community 17 - "Community 17"
Cohesion: 0.18
Nodes (23): adjFingerprint(), build3DLUT(), buildFilterPipeline(), buildFloatLUT(), buildLUT(), evict(), floatLutCache, isAllDefault() (+15 more)

### Community 18 - "Community 18"
Cohesion: 0.16
Nodes (14): iconBtnProps, iconBtnStyle(), LayerPanel(), typeLabel(), AdjustmentsSection(), AdjustmentsSectionProps, subGroupLabelStyle, TRACK_GRADIENT (+6 more)

### Community 19 - "Community 19"
Cohesion: 0.17
Nodes (7): FrameSlideProps, PreviewShell(), VideoOverlayItemProps, getShell(), PlatformShellProps, registerShell(), SHELL_REGISTRY

### Community 20 - "Community 20"
Cohesion: 0.22
Nodes (14): GridPicker(), GridPickerProps, blobToBase64(), buildProjectJson(), loadExportSettings(), PersistedExportSettings, PLATFORM_RECOMMENDED, PresetKey (+6 more)

### Community 21 - "Community 21"
Cohesion: 0.28
Nodes (11): FrameSettingsPopover(), FrameSettingsPopoverProps, labelStyle, PLATFORM_LABELS, PLATFORMS, segmentButtonStyle(), formatVal(), NumericInput() (+3 more)

### Community 22 - "shortcuts.ts"
Cohesion: 0.43
Nodes (4): ShortcutOverlay(), SHORTCUT_GROUPS, ShortcutEntry, ShortcutGroup

### Community 23 - "electron.d.ts"
Cohesion: 0.07
Nodes (3): ExternalEditor, SwatchDTO, Window

### Community 24 - "Community 24"
Cohesion: 0.22
Nodes (10): filenameError(), NewDocumentScreen(), NewDocumentScreenProps, NewDocumentSpec, PLATFORM_LABELS, PLATFORMS, RecentFile, sectionLabel (+2 more)

### Community 27 - "Community 27"
Cohesion: 0.67
Nodes (4): addRecentFile(), buildAppMenu(), getRecentFilesPath(), refreshAppMenu()

### Community 28 - "Community 28"
Cohesion: 0.67
Nodes (3): getPreferencesPath(), readPreferences(), writePreferences()

## Knowledge Gaps
- **125 isolated node(s):** `rootEl`, `UNIT_WORDS`, `NewDocumentSpec`, `RecentFile`, `NewDocumentScreenProps` (+120 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useCanvasStore` connect `useCanvasStore` to `ContextMenu.tsx`, `useCanvasStore.ts`, `Community 7`, `Community 8`, `textSpans.ts`, `Community 13`, `exportFrames.ts`, `PreviewShell.tsx`, `Community 18`, `Community 19`, `Community 20`, `Community 21`, `shortcuts.ts`, `Community 26`?**
  _High betweenness centrality (0.310) - this node is a cross-community bridge._
- **Why does `PropertiesPanel()` connect `ContextMenu.tsx` to `Toolbar.tsx`, `useCanvasStore.ts`, `Community 7`, `useCanvasStore`, `textSpans.ts`, `Community 13`, `PropertiesPanel.tsx`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **Why does `TitleBar()` connect `Community 20` to `useCanvasStore`, `Community 18`, `Toolbar.tsx`, `Community 13`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Are the 12 inferred relationships involving `useCanvasStore` (e.g. with `FrameSettingsPopover()` and `PropertiesPanel()`) actually correct?**
  _`useCanvasStore` has 12 INFERRED edges - model-reasoned connections that need verification._
- **What connects `rootEl`, `UNIT_WORDS`, `NewDocumentSpec` to the rest of the system?**
  _127 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `types/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12941176470588237 - nodes in this community are weakly interconnected._
- **Should `electron/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07407407407407407 - nodes in this community are weakly interconnected._