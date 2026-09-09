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
  appliedCropAdjustments?: {
    cropBoxNorm?: { x: number; y: number; width: number; height: number };
    cropBoxPixels?: { x: number; y: number; width: number; height: number };
    zoom?: number;
    imagePan?: { x: number; y: number };
    rotation?: number;
    deskewAngle?: number;
    preset?: string;
    aspectRatioLocked?: boolean;
  };
  imageFilters?: ImageFilters;
  imagePan?: { x: number; y: number };
  imageZoom?: number;
  fitMode?: "cover" | "contain" | "fill";
  isSignature?: boolean;
  preserveAlpha?: boolean;
  maskShape?: "rect" | "rounded" | "circle" | "oval";
  maskCornerRadius?: number; // mm

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

export type CardPresetType =
  | "id1_cr80"
  | "business_eu"
  | "business_us"
  | "id2"
  | "a6_half"
  | "custom";

export const STANDARD_CARD_PRESETS: Array<{
  id: CardPresetType;
  name: string;
  widthMm: number;
  heightMm: number;
  description: string;
}> = [
  {
    id: "id1_cr80",
    name: "CR-80 Standard Die-Cut (85.6 × 54.0 mm)",
    widthMm: 85.6,
    heightMm: 54.0,
    description: "Real physical die-cut/punch standard size for CR-80 ID cards, badges & licenses (R 3.18mm)",
  },
  {
    id: "business_eu",
    name: "Standard Business Card (85 × 55 mm)",
    widthMm: 85.0,
    heightMm: 55.0,
    description: "Standard European business card size",
  },
  {
    id: "business_us",
    name: "US Business Card (88.9 × 50.8 mm)",
    widthMm: 88.9,
    heightMm: 50.8,
    description: "Standard 3.5 × 2.0 inches US business card size",
  },
  {
    id: "id2",
    name: "ISO ID-2 Card (105 × 74 mm)",
    widthMm: 105.0,
    heightMm: 74.0,
    description: "Official ISO/IEC 7810 ID-2 visa and document format",
  },
  {
    id: "a6_half",
    name: "Full A6 Half Zone (105 × 74 mm)",
    widthMm: 105.0,
    heightMm: 74.0,
    description: "Fills the entire front/back half of physical A6 sheet",
  },
  {
    id: "custom",
    name: "Custom Millimeter Dimensions",
    widthMm: 85.6,
    heightMm: 54.0,
    description: "Enter arbitrary width and height in millimeters",
  },
];

export const CARD_PRESETS = STANDARD_CARD_PRESETS;

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

  // Zone Dimensions on Sheet (Default 105 mm × 74 mm each)
  cardWidthMm: number;
  cardHeightMm: number;

  // Exact True Card Boundary Specifications (Standard CR-80: 85.6 × 54.0 mm, R 3.18mm)
  trueCardWidthMm: number; // 85.6 mm default
  trueCardHeightMm: number; // 54.0 mm default
  trueCardOrientation: "landscape" | "portrait";
  cardPreset: CardPresetType;
  showCardBoundary: boolean; // default true
  showBleedShading: boolean; // default true (subtly tints area outside card boundary)
  cardCornerRadiusMm: number; // default 3.18 mm (standard CR-80 corner radius)

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
  snapToCardBoundary?: boolean;
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

/**
 * Native Editable Project File Format (.ocard / .omniscanproj)
 */
export interface OCardProjectFile {
  format: "omniscan-card-project";
  version: "2.0.0";
  app: "OMNISCAN PRO ULTRA";
  exportedAt: string;
  project: CardDesignerProject;
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
