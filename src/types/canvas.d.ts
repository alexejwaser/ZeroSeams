export type CanvasObjectType = 'image' | 'text' | 'shape' | 'group' | 'path' | 'video' | 'guideline';
export type CanvasObjectScope = 'global' | 'pinned';
export interface BaseCanvasObject {
    /** Unique stable identifier (nanoid / uuid) */
    id: string;
    type: CanvasObjectType;
    scope: CanvasObjectScope;
    /** Only set when scope === 'pinned'. Zero-based frame index. */
    pinnedFrame?: number;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
    opacity: number;
    visible: boolean;
    locked: boolean;
    zIndex: number;
    name?: string;
}
export interface ImageObject extends BaseCanvasObject {
    type: 'image';
    /** Data URL or resolved file path (after IPC load) */
    src: string;
    /** True when background has been removed (AI-processed copy) */
    backgroundRemoved: boolean;
    /** Original src before any AI processing */
    originalSrc?: string;
    frameX: number;
    frameY: number;
    frameWidth: number;
    frameHeight: number;
    contentOffsetX: number;
    contentOffsetY: number;
    contentWidth: number;
    contentHeight: number;
    /** Intrinsic pixel dimensions of the original image bitmap */
    naturalWidth: number;
    naturalHeight: number;
    /** When true, transformer targets the image content rather than the frame */
    contentEditMode: boolean;
    /** When true, mask anchor overlay is shown and editable */
    maskEditMode: boolean;
    mask?: MaskData;
    adjustments?: PhotoAdjustments;
}
/** Closed bezier path that clips the visible area of an image. Anchors are in content space. */
export interface MaskData {
    /** Closed bezier path — anchors in content space (0,0 = image bitmap top-left) */
    anchors: AnchorPoint[];
    /** Soft edge blur in canvas pixels; 0 = hard edge */
    feather: number;
    /** false = hide outside path, true = hide inside path */
    inverted: boolean;
    /** Toggle mask on/off without deleting it */
    visible: boolean;
}
export interface PhotoAdjustments {
    exposure: number;
    contrast: number;
    highlights: number;
    shadows: number;
    whites: number;
    blacks: number;
    temperature: number;
    tint: number;
    saturation: number;
    vibrance: number;
    clarity: number;
    dehaze: number;
}
export declare const DEFAULT_ADJUSTMENTS: PhotoAdjustments;
export type FontStyle = 'normal' | 'bold' | 'italic' | 'bold italic';
/** Per-character style overrides — undefined fields inherit from TextObject layer defaults */
export interface TextSpanStyle {
    fontFamily?: string;
    fontSize?: number;
    fontStyle?: FontStyle;
    fill?: string;
    letterSpacing?: number;
}
/** A contiguous run of text with optional style overrides */
export interface TextSpan {
    text: string;
    style?: TextSpanStyle;
}
export interface TextObject extends BaseCanvasObject {
    type: 'text';
    fontFamily: string;
    fontSize: number;
    fontStyle: FontStyle;
    align: 'left' | 'center' | 'right';
    fill: string;
    letterSpacing: number;
    lineHeight: number;
    spans: TextSpan[];
}
export type ShapeKind = 'rect' | 'ellipse' | 'line' | 'arrow';
export interface ShapeObject extends BaseCanvasObject {
    type: 'shape';
    kind: ShapeKind;
    fill: string;
    stroke: string;
    strokeWidth: number;
    cornerRadius?: number;
    x2?: number;
    y2?: number;
}
export interface AnchorPoint {
    x: number;
    y: number;
    handleIn: {
        dx: number;
        dy: number;
    };
    handleOut: {
        dx: number;
        dy: number;
    };
}
export interface PathObject extends BaseCanvasObject {
    type: 'path';
    anchors: AnchorPoint[];
    closed: boolean;
    fill: string;
    stroke: string;
    strokeWidth: number;
    pathEditMode: boolean;
}
export interface GroupObject extends BaseCanvasObject {
    type: 'group';
    childIds: string[];
}
export interface GuidelineObject extends BaseCanvasObject {
    type: 'guideline';
    orientation: 'horizontal' | 'vertical';
    position: number;
    frameIndex: number;
    spanAllFrames: boolean;
}
export type CanvasObject = ImageObject | TextObject | ShapeObject | GroupObject | PathObject | GuidelineObject;
