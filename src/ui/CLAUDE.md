# Zero Seams — `src/ui/`

UI invariants and the visual design system. Tokens in `src/ui/theme.css` are the single source of truth — the Konva mirror rule lives in the root `CLAUDE.md`.

**Platform Preview Mode** (`src/ui/preview/`):
- `previewMode: boolean` + `previewFrame: number` in store (transient, not persisted); disabled for `custom` platform
- On open: captures all frames via `getStageInstance()` → JPEG data URLs (same crop approach as `exportFrames.ts`)
- `FrameSlide` = static JPEG background + `<VideoOverlayItem>` overlays for any video whose x-span overlaps the frame
- Shell registry: `registerShell(platform, Component)` — adding a platform = one file + one call. Shipped shells: `InstagramShell`, `TikTokShell`, `FacebookShell`, `ThreadsShell`. `custom` has none **by design** — `getShell` returns `null` and preview is disabled, because a shell is a phone chrome drawn around a known aspect ratio
- Shells receive `ratio` + `frameDisplayWidth/Height` as props and must lay out from those, never from a hardcoded 1080 — the same shell renders a 1:1 and a 9:16 frame
- Frame labels in `CarouselStage` hidden when `previewMode` is true
- `PreviewShell` must be rendered at the root `App` level (sibling of `TitleBar`), NOT inside the canvas area div — the canvas area has `position:relative; zIndex:0` which creates a stacking context that causes the overlay to paint beneath the panels/toolbar

**Properties Panel** (`src/ui/PropertiesPanel.tsx` + `src/ui/properties/`):
- Section components live one-per-file in `src/ui/properties/` (AlignDistribute, Text, Effects, Adjustments, Video, FrameSection) with shared field helpers/styles in `properties/shared.tsx`; PropertiesPanel keeps layout and selection routing
- `VideoSection` composes `AdjustmentsSection` + `EffectsSection` — video and image share the adjustment UI
- `<Field>` (`properties/shared.tsx`) is the ONE property row: label + `NumericInput`. `NumberField`/`MixedNumberField` are thin wrappers over it. There are no paired `<input type="range">` rows any more — dragging the field's unit affix scrubs the value. The two surviving slider families are deliberate: `AdjustmentsSection`'s `.adj-slider` gradient tracks (the track carries the meaning) and the video transport scrub bar
- **Any NumericInput wired with BOTH a live `onChange` and a `commitUpdate`-backed `onCommit` must go through `useScrubbedValue`** (`properties/shared.tsx`). It arms `startDrag` on the first live write and disarms on commit. Without it `commitUpdate` snapshots the state the live writes already mutated, and undo lands on the edited value — i.e. does nothing
- Units are picked per call site: `°` rotation · `%` opacity/volume/normalized-position · `px` sizes, offsets, radii, spacing · `s` trims · `×` line height · `EV` exposure. A 0–1 normalized fraction is NOT a percentage — effect params like vignette strength stay unitless and get a scrub-grip glyph instead

**Shortcuts & discoverability:**
- `src/ui/shortcuts.ts` is the single source of truth for the shortcut list; `ShortcutOverlay` (toggled by `?`) renders it — when adding a shortcut, update the table AND the handler in `useKeyboardShortcuts.ts`, and quote the same string in the button's `<Tooltip shortcut=>`
- **A native menu accelerator SHADOWS the renderer's keydown handler** — macOS consumes ⌘Z/⌘A/⌘N/⌘O before the document sees them. Anything with a menu item must route through `handleMenuAction`, and guards that used to live in the keydown handler (e.g. "focus is in a text field, so undo the text not the canvas") have to be re-implemented there. The clipboard roles are the exception — see **Clipboard** in `src/canvas/CLAUDE.md`
- Option-modified shortcuts must match on `e.code` (`'KeyS'`), not `e.key` — macOS reports `'ß'` for ⌥S
- Zoom: `zoomIn()`/`zoomOut()` (clamped `setZoom`, MIN/MAX_ZOOM) live in `useViewportStore` and are shared by ⌘± and the bottom-right `CanvasHud` (zoom −/%/+, fit-all-frames, ? help)

## Visual Design System
Tokens in `src/ui/theme.css` — single source of truth. Imported once in `src/main.tsx`.

**Palette:**
- `--text-muted` is **2.0:1 on `--bg-panel`** — it is the *disabled* colour and nothing else. Anything carrying words or a meaningful glyph uses `--text-tertiary` (4.6:1), which is warm-tinted so the ramp reads as a tier rather than a shade
- `--accent` — active states, Konva handles, primary CTA. Darkened from `#f94608` so white labels on accent fills clear 4.5:1
- `--accent-gold` — multi-select anchor star/outline · `--accent-tint` — selected-row wash
- Use `var(--…)` tokens in components — `src/ui/` is fully tokenized; don't reintroduce raw hex for token values
- `--font` — always use `var(--font)`, never hardcode `'Uncut Sans Variable'`

**Components:**
- Buttons: pill shape (`borderRadius: 999`). Inputs/selects: `borderRadius: 6`. Cards/popovers: `borderRadius: 16`
- `.btn-raised` (in `theme.css`): shadow button with press-down animation — `box-shadow: 2px 4px 0 #000` at rest
- `iconBtnProps(active, disabled?, extraStyle?)` (`src/ui/iconBtnStyle.ts`) — spread it, don't pass a separate `style=`. Colour and every state live in `.zs-icon-btn` in `theme.css`; the helper returns geometry plus `data-active`. That split exists because an inline `background` beats any `:hover` rule, which is how 32 icon buttons ended up with a `transition` and no hover for so long. `extraStyle` is where per-site width/padding overrides go
- Focus: `theme.css` draws one `:focus-visible` ring for all interactive controls. **Never set `outline: none` on a focusable element** — an inline one wins over the ring and silently removes it. The one retarget: `NumericInput`'s input is excluded from the global rule (`input:not(.zs-num-input)`) and the ring is drawn on its `.zs-num` wrapper via `:has(input:focus-visible)`, because an outline on the inner input renders inside the wrapper's border and collides with the unit affix. Retarget the ring, never remove it
- Sliders: global `input[type="range"]` in `theme.css` handles all. `.adj-slider` (`adjustments.css`) additionally exists for the gradient adjustment tracks
- Tooltips: every interactive button must be wrapped in `<Tooltip label shortcut? description?>` (`src/ui/Tooltip.tsx`). Never use native `title=` on buttons — wrong font, timing, style. Tooltip chains the child's mouse/focus handlers and shows on keyboard focus. `label` always required; `shortcut` required if a shortcut exists; `description` for ambiguous labels. Empty `label=""` renders children unwrapped (no tooltip).
- Color picker: `<ColorInput>` / `<MixedColorInput>` in `src/ui/ColorInput.tsx` (exported from `src/ui/index.ts`) — never use raw `input[type="color"]`. Popover uses `react-colorful` + HEX/RGB/HSL modes + eyedropper + 5 recent colors (localStorage `zeroseams:recentColors`). `fixed` prop portals the popover into `document.body` — required whenever the trigger has a CSS `transform` ancestor (even `translateX(0px)` creates a containing block that breaks `position:fixed`). `popoverAnchorFn?: () => {top,left}` overrides automatic `getBoundingClientRect` positioning when you need a fixed anchor (e.g. frame label strip). `MixedColorInput` renders a `—` overlay and shows `value=undefined` as mixed state.

**Layout:**
- `TitleBar` (full width, 52px) — logo, file ops, frame settings, frames counter, preview, export, undo/redo
- `ToolBar` (center column only, `TOOL_BAR_HEIGHT`) — `position: absolute; top: 0; left/right` from `panelConstants.ts`, `zIndex: 10` — constrained to the gap between panels so it never extends under them; gradient background (`--bg-base` solid top 50% → transparent bottom); three labeled groups: **Transform** (Select, Snap, Crop/Autofill), **Add** (Text, Shape, Pen, Image, Video), **Layout** (Grid, Guideline, visibility toggle); `ToolGroup` helper at module scope renders the group label (`top: -13px, left: 0` absolute) above buttons; `alignItems: flex-end` + `paddingBottom: 10`
- `LayerPanel` + `PropertiesPanel` are `position: absolute` inside the center column — `left: 0` / `right: 0`, `top: 0`, `zIndex: 20` (above toolbar gradient); widths from `panelConstants.ts`; height driven by `ResizeObserver`, `max-height: calc(100vh - TITLE_BAR_HEIGHT)` — and `PropertiesPanel` subtracts `HUD_LANE` on top of that so it never reaches the floor where `CanvasHud` sits; `borderRadius: 0 0 16px 16px`; sticky header; `panel-scroll` class applies slim 4px scrollbar
- Middle row: center column only (panels float inside it) — see `src/main.tsx`
