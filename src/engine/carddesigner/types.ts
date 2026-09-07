/**
 * Professional ID & Service Card Designer - Type Definitions
 * Vector-like object model inspired by CorelDRAW workflows.
 * 
 * Supports dual-card layout on a single A6 page:
 * - Front Card (Top, 74 × 105 mm)
 * - Back Card (Underneath, 74 × 105 mm)
 */

export type CardSide = "front" | "back";

export type CardObjectType =
  | "text"
  | "image"
  | "shape"
  | "signature"
  | "barcode"
  | "qrcode"
  | "group"
  | "svg";

export type ShapeType =
  | "rect"
  | "rectangle"
  | "rounded-rect"
  | "circle"
  | "ellipse"
  | "line"
  | "arrow"
  | "polygon"
  | "star";

export type BarcodeType = "code128" | "ean13" | "upc" | "code39";

export interface ObjectShadow {
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
}

export interface ImageCropRect {
  x: number; // percentage 0-100 or normalized
  y: number;
  width: number;
  height: number;
  shape: "rect" | "circle" | "rounded";
  cornerRadius?: number;
}

export interface ImageFilters {
  brightness: number; // -100 to 100
  contrast: number; // -100 to 100
  saturation: number; // -100 to 100
  sharpness: number; // 0 to 100
  deskewAngle: number; // -15 to 15
  grayscale: boolean;
}

export interface CardObject {
  id: string;
  name: string;
  type: CardObjectType;
  targetSide: CardSide;

  // Geometry in Millimeters (relative to the card's top-left corner)
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // Degrees 0-360

  // Display & Layer properties
  opacity: number; // 0.0 to 1.0
  zIndex: number;
  visible: boolean;
  locked: boolean;
  aspectRatioLocked: boolean;
  flipX: boolean;
  flipY: boolean;
  groupId?: string;
  shadow?: ObjectShadow;
  blendMode?: string;

  // Type-specific: Text
  text?: string;
  fontSize?: number; // pt or mm equivalent
  fontFamily?: string;
  fontWeight?: "normal" | "bold" | "300" | "400" | "500" | "600" | "700" | "800" | "900" | string;
  fontStyle?: "normal" | "italic";
  textDecoration?: "none" | "underline";
  textAlign?: "left" | "center" | "right" | "justify";
  letterSpacing?: number; // px or pt
  lineHeight?: number; // multiplier e.g. 1.2
  textColor?: string;
  textBackgroundColor?: string;
  textWrap?: boolean;
  isDynamicField?: boolean;
  dynamicFieldKey?: string;

  // Type-specific: Shapes
  shapeType?: ShapeType;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number; // mm
  strokeStyle?: "solid" | "dashed" | "dotted";
  cornerRadius?: number; // mm

  // Type-specific: Images & Signatures
  src?: string; // Data URL or object URL
  originalSrc?: string;
  naturalWidth?: number;
  naturalHeight?: number;
  cropRect?: ImageCropRect;
  imageFilters?: ImageFilters;
  imagePan?: { x: number; y: number };
  imageZoom?: number;
  fitMode?: "cover" | "contain" | "fill";
  isSignature?: boolean;
  preserveAlpha?: boolean;

  // Type-specific: Barcodes & QR
  barcodeType?: BarcodeType;
  barcodeValue?: string;
  displayBarcodeText?: boolean;
  qrValue?: string;
  qrForegroundColor?: string;
  qrBackgroundColor?: string;

  // Type-specific: Groups
  childrenIds?: string[];

  // Type-specific: SVG
  rawSvg?: string;
}

export interface SideBackground {
  type: "solid" | "gradient" | "image" | "transparent";
  color1: string;
  color2?: string;
  gradientAngle?: number; // degrees
  imageUrl?: string;
  imageOpacity?: number;
}

export interface CardSideState {
  background: SideBackground;
  objects: CardObject[];
}

export type A6Orientation = "portrait" | "landscape";

export interface CardDesignerProject {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;

  // Sheet Specifications
  pageFormat: "A6" | "custom";
  orientation: A6Orientation;
  pageWidthMm: number; // 105 for portrait A6, 148 for landscape A6
  pageHeightMm: number; // 148 for portrait A6, 105 for landscape A6

  // Card Dimensions (Default 74 mm × 105 mm)
  cardWidthMm: number;
  cardHeightMm: number;

  // Positions on the A6 page
  frontPosMm: { x: number; y: number };
  backPosMm: { x: number; y: number };

  // Margin & Guides
  safeAreaMarginMm: number; // Default 3mm
  bleedMarginMm: number; // Default 2mm
  cuttingGuides: boolean;
  showBleed: boolean;
  showSafeArea: boolean;
  showRulers: boolean;
  showGrid: boolean;
  snapToGrid: boolean;
  snapToObjects: boolean;
  gridSizeMm: number; // Default 2mm

  // Guides
  guides: {
    horizontal: number[]; // mm
    vertical: number[]; // mm
  };

  // Card Content
  front: CardSideState;
  back: CardSideState;
}

export type ActiveToolType =
  | "select"
  | "pan"
  | "text"
  | "image"
  | "signature"
  | "shape"
  | "barcode"
  | "qrcode"
  | "crop";

export interface SnapGuideLine {
  type: "h" | "v";
  positionMm: number;
  cardSide: CardSide;
  label?: string;
}

export type TransformHandle =
  | "nw"
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w"
  | "rot";
