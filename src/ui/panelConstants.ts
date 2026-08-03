/**
 * Geometry shared by the floating chrome. These numbers were duplicated as bare
 * literals in LayerPanel, PropertiesPanel and ToolBar — the ToolBar's `left`/`right`
 * has to track the panel widths exactly or it slides under them.
 */

export const LAYER_PANEL_WIDTH = 240
export const PROPERTIES_PANEL_WIDTH = 300

/** TitleBar height. Panels are positioned inside the center column, which
 *  already starts below it, so their viewport-relative max-height subtracts it. */
export const TITLE_BAR_HEIGHT = 52

/** ToolBar height. It floats over the top of the canvas area between the panels. */
export const TOOL_BAR_HEIGHT = 62

/** Vertical strip at the bottom of the canvas kept clear for CanvasHud.
 *  PropertiesPanel stops short of it instead of running to the viewport floor
 *  and burying the zoom/fit controls (#74). */
export const HUD_LANE = 56
