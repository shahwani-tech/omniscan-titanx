/**
 * OMNISCAN TITAN X - Enterprise Document Intelligence & Processing Engine
 * Core TypeScript Definitions & Architecture Schemas
 */

export type DocumentClassificationCategory =
  | "Financial"
  | "Legal"
  | "Medical"
  | "Government"
  | "Operational"
  | "Technical"
  | "Personal"
  | "General";

export interface DocumentClassification {
  type: string;
  category: DocumentClassificationCategory;
  confidence: number;
}

export interface ExtractedEntity {
  id: string;
  key: string;
  value: string;
  category: "entity" | "date" | "amount" | "identifier" | "legal" | "contact";
  confidence?: number;
  bbox?: [number, number, number, number]; // [x, y, w, h] normalized 0-1
}

export interface ExtractedLineItem {
  id: string;
  description: string;
  quantity?: string;
  unitPrice?: string;
  total?: string;
}

export interface ExtractedActionItem {
  id: string;
  task: string;
  deadline?: string;
  priority: "high" | "medium" | "low";
  completed?: boolean;
}

export interface DetectedPII {
  id: string;
  label: string;
  pattern: string;
  riskLevel: "high" | "medium" | "low";
  suggestedRedaction?: [number, number, number, number];
}

export interface DocumentIntelligenceResult {
  source: "gemini-3.7-flash" | "heuristic-engine";
  classification: DocumentClassification;
  summary: string;
  entities: ExtractedEntity[];
  lineItems?: ExtractedLineItem[];
  actionItems: ExtractedActionItem[];
  redactionRecommendations: DetectedPII[];
  analyzedAt: string;
  confidenceScore: number;
}

export interface OCRWord {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

export interface OCRLine {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  words: OCRWord[];
}

export interface OCRBlock {
  id: string;
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  lines: OCRLine[];
}

export interface OCRResult {
  text: string;
  blocks: OCRBlock[];
  language: string;
  confidence: number;
  status: "idle" | "processing" | "completed" | "error";
  errorMessage?: string;
  processedAt?: string;
}

export type AnnotationType =
  | "highlight"
  | "underline"
  | "strikeout"
  | "freehand"
  | "text"
  | "rectangle"
  | "circle"
  | "arrow"
  | "stamp"
  | "check"
  | "cross"
  | "note";

export interface Point {
  x: number;
  y: number;
}

export interface OmniAnnotation {
  id: string;
  type: AnnotationType;
  x: number; // normalized 0-1 relative to page width
  y: number; // normalized 0-1 relative to page height
  width: number; // normalized 0-1
  height: number; // normalized 0-1
  points?: Point[]; // for freehand or arrow
  strokeColor: string;
  fillColor?: string;
  strokeWidth: number;
  opacity: number;
  text?: string;
  fontSize?: number;
  fontColor?: string;
  createdAt: string;
}

export interface OmniRedaction {
  id: string;
  x: number; // normalized 0-1
  y: number; // normalized 0-1
  width: number; // normalized 0-1
  height: number; // normalized 0-1
  reason?: string;
  label?: string;
  color: string; // e.g. '#000000' or '#FFFFFF'
  isPermanent: boolean;
}

export type FormFieldType = "text" | "checkbox" | "radio" | "dropdown" | "signature";

export interface OmniFormField {
  id: string;
  type: FormFieldType;
  name: string;
  value: string | boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  options?: string[];
  required?: boolean;
}

export interface ImageFilterPipeline {
  // Geometry
  rotation: number; // 0, 90, 180, 270
  deskewAngle: number; // -45 to 45 deg
  cropBox?: { x: number; y: number; width: number; height: number }; // normalized
  perspectivePoints?: [Point, Point, Point, Point]; // TL, TR, BR, BL

  // Preset Identification
  preset?: CamScannerPresetId;

  // Quality & Cleanup
  brightness: number; // -100 to 100 (0 default)
  contrast: number; // -100 to 100 (0 default)
  gamma: number; // 0.2 to 3.0 (1.0 default)
  sharpness: number; // 0 to 100 (0 default)
  denoise: number; // 0 to 100 (0 default)
  saturation: number; // -100 to 100 (0 default)
  exposure: number; // -100 to 100 (0 default)

  // Document Specific Processing
  backgroundWhiten: boolean;
  backgroundWhitenThreshold: number; // 0 to 255
  shadowRemoval: boolean;
  shadowStrength: number; // 0 to 100
  punchHoleCleanup: boolean;
  bleedThroughReduce: boolean;
  despeckle: boolean;
  edgePreservation: number; // 0 to 100
  magicColorBoost: number; // 0 to 100 (for CamScanner magic color)
  autoWhiteBalance: boolean;

  // Binarization & Color
  colorMode: "color" | "grayscale" | "monochrome" | "sauvola" | "otsu" | "magic-color" | "eco";
  binarizationThreshold: number; // 0 to 255 (128 default)
  invert: boolean;
}

export type CamScannerPresetId =
  | "original"
  | "auto"
  | "lighten"
  | "enhance"
  | "magic-color"
  | "auto-color"
  | "grayscale"
  | "monochrome"
  | "eco"
  | "sharp"
  | "clean"
  | "shadow-removal"
  | "low-light"
  | "photo"
  | "receipt"
  | "id-document"
  | "custom";

export interface CamScannerPresetMeta {
  id: CamScannerPresetId;
  name: string;
  category: "Standard" | "Color" | "B&W" | "Enhance" | "Specialized";
  description: string;
  badge?: string;
  filters: Partial<ImageFilterPipeline>;
}

export interface CustomFilterPreset {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  filters: ImageFilterPipeline;
}

export interface FilterStackOperation {
  id: string;
  name: string;
  enabled: boolean;
  type:
    | "deskew"
    | "shadow-removal"
    | "background-cleanup"
    | "contrast-brightness"
    | "sharpen"
    | "color-tone"
    | "binarization"
    | "magic-color";
  params: Record<string, number | boolean | string>;
}

// -------------------------------------------------------------
// 4x6" Photo Print Studio & Passport Layout Engine Types
// -------------------------------------------------------------
export type PaperUnit = "in" | "mm" | "cm" | "px";

export interface PaperSizeSpec {
  id: string;
  name: string;
  widthInches: number;
  heightInches: number;
  widthMm: number;
  heightMm: number;
  isCustom?: boolean;
  category: "Photo Sheets" | "Standard Paper" | "Custom";
}

export interface PassportStandardSpec {
  id: string;
  name: string;
  country: string;
  widthMm: number;
  heightMm: number;
  widthInches: number;
  heightInches: number;
  description: string;
  faceMinPercent?: number; // chin to crown min %
  faceMaxPercent?: number; // chin to crown max %
  suggestedCopies: number;
}

export type CuttingGuideType = "none" | "corner-marks" | "crop-marks" | "grid-lines";
export type PhotoFitMode = "fit" | "fill" | "crop" | "stretch" | "original-ratio";

export interface PhotoBorderConfig {
  enabled: boolean;
  widthPx: number; // 0, 1, 2, 3, 4, 5, 10, or custom
  color: string; // e.g. '#000000', '#333333', '#FFFFFF'
  style: "solid" | "dashed";
}

export interface CuttingGuideConfig {
  type: CuttingGuideType;
  color: string;
  thicknessPx: number;
  lengthMm: number;
  offsetMm: number;
}

export interface PhotoInstancePosition {
  id: string;
  index: number;
  sourcePhotoId: string;
  xInches: number;
  yInches: number;
  widthInches: number;
  heightInches: number;
  row: number;
  column: number;
  rotationDeg?: number;
  customCrop?: {
    x: number; // 0 to 1
    y: number; // 0 to 1
    scale: number; // >= 1.0
  };
  filterOverride?: CamScannerPresetId;
}

export interface PhotoSheetConfig {
  // Paper
  paperSizeId: string;
  paperWidthInches: number;
  paperHeightInches: number;
  paperUnit: PaperUnit;
  dpi: 150 | 200 | 300 | 600;
  orientation: "portrait" | "landscape";

  // Photo Source vs Print Instance Rotation
  printInstanceRotation: 0 | 90 | 180 | 270;
  printerProfileId: string; // e.g. "auto", "90-feed-standard", "0-direct", "custom-profile"

  // Photo
  passportStandardId?: string;
  photoWidthInches: number;
  photoHeightInches: number;
  photoUnit: PaperUnit;
  fitMode: PhotoFitMode;

  // Layout & Copies
  copies: number;
  autoFit: boolean;
  columns: number;
  rows: number;

  // Margins (in inches)
  marginTopInches: number;
  marginBottomInches: number;
  marginLeftInches: number;
  marginRightInches: number;
  marginMode?: "auto" | "manual";
  marginUnit?: PaperUnit;

  // Spacing / Gaps (in inches)
  gapHorizontalInches: number;
  gapVerticalInches: number;

  // Border & Guides
  border: PhotoBorderConfig;
  cuttingGuides: CuttingGuideConfig;

  // Global Filter applied to sheet
  globalFilterPreset: CamScannerPresetId;
  backgroundColor: string; // e.g. '#FFFFFF'
}

export interface PrinterProfile {
  id: string;
  name: string;
  paperSizeId: string;
  feedRotation: 0 | 90 | 180 | 270;
  isCustom?: boolean;
}

export interface PhotoStudioSession {
  id: string;
  sourceImage: string; // 0° Raw Source Image
  cropBox: { x: number; y: number; width: number; height: number };
  aspectRatioLocked: boolean;
  filterPreset: CamScannerPresetId;
  brightness: number;
  contrast: number;
  gamma: number;
  sharpness: number;
  denoise: number;
  shadowRemoval: boolean;
  shadowStrength: number;
  bgColorReplacement: "none" | "white" | "blue" | "gray" | "cream" | "transparent";
  sheetConfig: PhotoSheetConfig;
  isGenerated: boolean;
  generatedPhotoDataUrl: string | null;
  generatedSheetDataUrl: string | null;
  lastModifiedAt: string;
}

export interface LayoutFitCalculation {
  fits: boolean;
  maxColumns: number;
  maxRows: number;
  maxPhotosPerSheet: number;
  actualColumns: number;
  actualRows: number;
  totalPhotosPlaced: number;
  sheetEfficiencyPercent: number;
  overflowCount: number;
  warningMessage?: string;
  positions: PhotoInstancePosition[];
  printableWidthInches: number;
  printableHeightInches: number;
  pixelDimensions: {
    width: number;
    height: number;
  };
}

export type PerformanceMode = "auto" | "performance" | "quality" | "custom";

export interface PerformanceSettings {
  mode: PerformanceMode;
  previewScale: number; // 0.35 to 1.0 (downscale during drag)
  debounceMs: number; // 50 to 300ms
  enableIntermediateCache: boolean;
  maxResolutionThreshold: number; // e.g. 4096
  hardwareTelemetry: {
    cores: number;
    estimatedMemoryGb: number;
    gpuTier: "low" | "medium" | "high";
  };
}

export interface OmniPage {
  id: string;
  pageNumber: number;
  originalDataUrl: string; // Lossless untouched source
  processedDataUrl: string; // Output after filter pipeline & renders
  thumbnailDataUrl: string; // Low-res fast preview
  width: number; // pixel width
  height: number; // pixel height
  dpi: number; // default 300
  sizeBytes: number;
  isBlank: boolean;
  blankScore: number; // 0 (full content) to 1.0 (pure blank)

  filters: ImageFilterPipeline;
  detectedContent?: {
    detectedType: "text-document" | "photo-id" | "mixed-content";
    label: "Text Document" | "Photo/ID Card" | "Mixed Content";
    confidence: number;
    recommendedPreset: CamScannerPresetId;
    reason: string;
    signals?: {
      colorVariance: number;
      saturationMean: number;
      edgeDensity: number;
      histogramSpread: number;
      skinToneScore: number;
      textContrastScore: number;
    };
  };
  filterSource?: "auto-detected" | "user-override";
  ocr?: OCRResult;
  annotations: OmniAnnotation[];
  redactions: OmniRedaction[];
  formFields: OmniFormField[];
  intelligence?: DocumentIntelligenceResult;

  isModified: boolean;
  lastModifiedAt: string;
  pdfDocId?: string;
  isPendingRender?: boolean;
}

export interface DocumentMetadata {
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creator: string;
  producer: string;
  creationDate: string;
  modificationDate: string;
  pdfAStandard: "PDF/A-1b" | "PDF/A-2b" | "PDF/A-3b" | "Standard PDF (1.7)";
  encryption?: {
    enabled: boolean;
    userPassword?: string;
    ownerPassword?: string;
    allowPrinting: boolean;
    allowCopying: boolean;
    allowModifications: boolean;
    allowAnnotations: boolean;
  };
}

export interface OmniDocument {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  pages: OmniPage[];
  activePageIndex: number;
  selectedPageIds: string[];
  metadata: DocumentMetadata;
  tags: string[];
  isDirty: boolean;
}

export type ViewMode = "single" | "continuous" | "two-page" | "grid";

export type ActiveTool =
  | "select"
  | "pan"
  | "magnifier"
  | "crop"
  | "perspective"
  | "highlight"
  | "freehand"
  | "text-annotation"
  | "shape-rectangle"
  | "shape-circle"
  | "shape-arrow"
  | "stamp"
  | "redact-region"
  | "form-text"
  | "form-checkbox"
  | "form-signature"
  | "split-view";

export interface BatchWorkflowStep {
  id: string;
  name: string;
  type:
    | "auto-rotate"
    | "auto-deskew"
    | "remove-blanks"
    | "background-whiten"
    | "denoise-clean"
    | "run-ocr"
    | "ai-intelligence"
    | "compress"
    | "smart-rename"
    | "export-pdfa";
  enabled: boolean;
  config?: Record<string, any>;
}

export interface BatchWorkflowPreset {
  id: string;
  name: string;
  description: string;
  steps: BatchWorkflowStep[];
}

export interface ScannerProfile {
  id: string;
  name: string;
  source: "flatbed" | "adf" | "duplex" | "camera";
  colorMode: "color" | "grayscale" | "monochrome";
  dpi: 75 | 150 | 200 | 300 | 600 | 1200;
  pageSize: "letter" | "legal" | "a4" | "a3" | "a5" | "receipt" | "auto";
  brightness: number;
  contrast: number;
  autoDeskew: boolean;
  autoCrop: boolean;
  removeBlankPages: boolean;
  blankSensitivity: number; // 0 to 1
  duplexFlip: "long-edge" | "short-edge";
}

export type AppTheme = "titan-dark" | "obsidian-navy" | "slate-contrast" | "studio-light";

export type AppLanguage = "en" | "ur" | "ar" | "fr" | "es" | "de";

export interface AppSettings {
  theme: AppTheme;
  language: AppLanguage;
  uiDensity: "compact" | "normal" | "spacious";
  defaultDpi: number;
  autoSaveIntervalMs: number;
  defaultOcrLanguage: string;
  hardwareAcceleration: boolean;
  defaultCompressionPreset: "maximum" | "high" | "balanced" | "small" | "extreme";
  privacyOfflineEnforced: boolean;
  enableSoundEffects: boolean;
}
