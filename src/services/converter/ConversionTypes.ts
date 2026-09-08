/**
 * OMNISCAN TITAN X - Enterprise Document Conversion & Workspace Types
 * Specifications for Multi-Format Document Conversion, PDF Merging,
 * Splitting, Office Transformations (Word, Excel, PowerPoint),
 * Extraction, OCR Modes, Batch Queue and File Management.
 */

export type SupportedInputFormat =
  // Documents
  | "pdf"
  | "docx"
  | "doc"
  | "rtf"
  | "txt"
  | "odt"
  // Spreadsheets
  | "xlsx"
  | "xls"
  | "csv"
  | "ods"
  // Presentations
  | "pptx"
  | "ppt"
  | "odp"
  // Images
  | "jpg"
  | "jpeg"
  | "png"
  | "webp"
  | "bmp"
  | "tiff"
  | "tif"
  | "gif"
  | "svg"
  // Other Structured
  | "html"
  | "xml"
  | "json"
  | "zip"
  | "unknown";

export type SupportedOutputFormat =
  | "pdf"
  | "docx"
  | "xlsx"
  | "csv"
  | "pptx"
  | "jpg"
  | "png"
  | "webp"
  | "txt"
  | "zip";

export type ConversionTool =
  | "merge-pdf"
  | "split-pdf"
  | "pdf-to-word"
  | "word-to-pdf"
  | "pdf-to-excel"
  | "excel-to-pdf"
  | "pdf-to-pptx"
  | "pptx-to-pdf"
  | "pdf-to-image"
  | "image-to-pdf"
  | "office-to-image"
  | "compress-pdf"
  | "ocr-pdf";

export type ConversionMode =
  | "native-editable" // Direct structural text & layout conversion
  | "text-preserving" // Extracts layout text and structured paragraphs
  | "ocr-scanned"     // Uses OCR engine to extract text & tables from raster images
  | "flattened-image" // High-fidelity visual raster slide/page mode
  | "hybrid";         // Combines vector/text with image fallback

export interface ConversionPageSelection {
  pageNumber: number; // 1-indexed
  selected: boolean;
  rotation: number;   // 0, 90, 180, 270
  thumbnailUrl?: string;
  originalIndex?: number;
}

export interface WorkspaceFile {
  id: string;
  name: string;
  size: number;
  type: string;
  format: SupportedInputFormat;
  rawFile: File;
  objectUrl?: string;
  pageCount: number;
  pages: ConversionPageSelection[];
  status: "ready" | "analyzing" | "converting" | "completed" | "error";
  errorMessage?: string;
  previewUrl?: string;
  metadata?: {
    author?: string;
    title?: string;
    dimensions?: { width: number; height: number };
    sheetNames?: string[];
    isEncrypted?: boolean;
    isScanned?: boolean;
  };
}

export interface ConversionJobConfig {
  tool: ConversionTool;
  outputFormat: SupportedOutputFormat;
  outputFileNamePattern: string; // e.g. "{name}_converted.{ext}" or "{name}_Page_{page}.{ext}"
  conversionMode: ConversionMode;
  
  // PDF Output & Margins
  pageSize: "A4" | "A5" | "A6" | "Letter" | "Legal" | "Custom";
  customWidthMm?: number;
  customHeightMm?: number;
  orientation: "portrait" | "landscape" | "auto";
  marginMm: number;
  gapMm: number;
  fitMode: "fit-to-page" | "full-bleed" | "actual-size";
  backgroundColor: string; // "#FFFFFF"

  // Image Output Options
  imageDpi: 72 | 150 | 300 | 600;
  imageQuality: number; // 0.1 to 1.0 (for JPEG/WEBP)
  transparentBackground?: boolean;

  // Split Options
  splitMode?: "every-page" | "custom-ranges" | "odd-pages" | "even-pages" | "front-only" | "last-only";
  customRangesText?: string; // "1-3, 5, 7-10"
  packageAsZip?: boolean;

  // OCR & Recognition Options
  ocrLanguage: string; // "eng", "fra", "deu", "spa", "urd", etc.
  detectTables: boolean;
  preserveImages: boolean;
  includeHeadersFooters: boolean;

  // Spreadsheet Options
  selectedSheets?: string[];
  fitColumnsToPage?: boolean;
  gridlinesVisible?: boolean;
}

export interface ConvertedOutputItem {
  id: string;
  fileName: string;
  format: SupportedOutputFormat;
  mimeType: string;
  data: Blob | Uint8Array | string;
  downloadUrl: string;
  pageNumber?: number;
  totalPages?: number;
  conversionMode: ConversionMode;
  notes?: string;
}

export interface ConversionResult {
  success: boolean;
  jobId: string;
  tool: ConversionTool;
  outputFiles: ConvertedOutputItem[];
  zipPackageBlob?: Blob;
  zipPackageUrl?: string;
  zipPackageName?: string;
  totalTimeMs: number;
  error?: string;
  warnings?: string[];
}

export interface ConversionProgressCallback {
  (progress: number, stageText: string, currentFile?: string): void;
}
