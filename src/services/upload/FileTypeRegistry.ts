/**
 * Centralized File Type Registry & Validation Service
 * Defines all accepted file formats, extensions, MIME types, and categorization
 * across OmniScan Titan X tools (PDF Studio, ID Card Studio, A6 Mode, Card Designer, Photo Studio, etc.)
 */

export type FileCategory = "pdf" | "image" | "document" | "project" | "vector" | "unknown";

export interface FileTypeDefinition {
  extension: string;
  mimeType: string;
  category: FileCategory;
  label: string;
  isMultiPage?: boolean;
}

export const SUPPORTED_FILE_TYPES: FileTypeDefinition[] = [
  // PDFs
  { extension: ".pdf", mimeType: "application/pdf", category: "pdf", label: "PDF Document", isMultiPage: true },

  // Images
  { extension: ".png", mimeType: "image/png", category: "image", label: "PNG Image" },
  { extension: ".jpg", mimeType: "image/jpeg", category: "image", label: "JPEG Image" },
  { extension: ".jpeg", mimeType: "image/jpeg", category: "image", label: "JPEG Image" },
  { extension: ".webp", mimeType: "image/webp", category: "image", label: "WebP Image" },
  { extension: ".bmp", mimeType: "image/bmp", category: "image", label: "Bitmap Image" },
  { extension: ".tiff", mimeType: "image/tiff", category: "image", label: "TIFF Document / Image", isMultiPage: true },
  { extension: ".tif", mimeType: "image/tiff", category: "image", label: "TIFF Document / Image", isMultiPage: true },
  { extension: ".gif", mimeType: "image/gif", category: "image", label: "GIF Image" },
  { extension: ".svg", mimeType: "image/svg+xml", category: "image", label: "SVG Vector Graphic" },

  // Text & Word Documents
  {
    extension: ".docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    category: "document",
    label: "Word Document (DOCX)",
    isMultiPage: true,
  },
  { extension: ".doc", mimeType: "application/msword", category: "document", label: "Legacy Word Document (DOC)", isMultiPage: true },
  { extension: ".txt", mimeType: "text/plain", category: "document", label: "Plain Text (TXT)", isMultiPage: true },
  { extension: ".rtf", mimeType: "application/rtf", category: "document", label: "Rich Text Format (RTF)", isMultiPage: true },

  // Project Archives & Vectors
  { extension: ".titanproj", mimeType: "application/octet-stream", category: "project", label: "Titan Project File" },
  { extension: ".zip", mimeType: "application/zip", category: "project", label: "ZIP Archive" },
  { extension: ".cdr", mimeType: "application/vnd.corel-draw", category: "vector", label: "CorelDRAW CDR File" },
];

/**
 * Universal File Picker Accept Strings
 */

// Universal accept for Document & PDF Tools
export const ACCEPT_ALL_SUPPORTED = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".bmp",
  ".tiff",
  ".tif",
  ".gif",
  ".svg",
  ".docx",
  ".doc",
  ".txt",
  ".rtf",
  "application/pdf",
  "image/*",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "application/rtf",
].join(",");

// Universal accept for ID Card / CNIC & A6 Half-Card Studios (PDF + all images)
export const ACCEPT_PDF_AND_IMAGES = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".bmp",
  ".tiff",
  ".tif",
  ".gif",
  ".svg",
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/bmp",
  "image/tiff",
  "image/gif",
  "image/svg+xml",
  "image/*",
].join(",");

// Images only
export const ACCEPT_IMAGES_ONLY = [
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".bmp",
  ".tiff",
  ".tif",
  ".gif",
  ".svg",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/bmp",
  "image/tiff",
  "image/gif",
  "image/svg+xml",
  "image/*",
].join(",");

// PDF only
export const ACCEPT_PDF_ONLY = ".pdf,application/pdf";

// Vector & Design Studio (SVG, CDR, PDF, Images)
export const ACCEPT_CARD_DESIGNER_INPUTS = [
  ".svg",
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".bmp",
  ".tiff",
  ".cdr",
  "image/svg+xml",
  "application/pdf",
  "image/*",
].join(",");

// Titan Project Archives
export const ACCEPT_PROJECT_ARCHIVES = ".titanproj,.zip,application/zip,application/x-zip-compressed";

export interface FileAnalysis {
  category: FileCategory;
  extension: string;
  mimeType: string;
  displayName: string;
  isImage: boolean;
  isPdf: boolean;
  isTextDocument: boolean;
  isProjectArchive: boolean;
  isMultiPage: boolean;
  isValid: boolean;
}

/**
 * Robust file classifier that checks file extension and MIME type safely
 * Never rejects a file solely because its MIME type is missing or generic.
 */
export function analyzeFile(file: File | { name: string; type?: string }): FileAnalysis {
  const fileName = file.name || "";
  const lastDotIndex = fileName.lastIndexOf(".");
  const ext = lastDotIndex !== -1 ? fileName.slice(lastDotIndex).toLowerCase() : "";
  const rawMime = (file.type || "").toLowerCase();

  // Find matching definition
  let matchedDef = SUPPORTED_FILE_TYPES.find((def) => def.extension === ext);

  if (!matchedDef && rawMime) {
    matchedDef = SUPPORTED_FILE_TYPES.find(
      (def) => def.mimeType.toLowerCase() === rawMime
    );
  }

  // Handle generic image mime type image/*
  if (!matchedDef && rawMime.startsWith("image/")) {
    matchedDef = {
      extension: ext || ".png",
      mimeType: rawMime,
      category: "image",
      label: "Image File",
      isMultiPage: false,
    };
  }

  const category: FileCategory = matchedDef?.category || (
    ext === ".pdf" || rawMime === "application/pdf" ? "pdf"
    : rawMime.startsWith("image/") || /\.(png|jpe?g|webp|bmp|gif|tiff?|svg)$/i.test(fileName) ? "image"
    : /\.(docx?|txt|rtf)$/i.test(fileName) ? "document"
    : /\.(titanproj|zip)$/i.test(fileName) ? "project"
    : "unknown"
  );

  const isImage = category === "image";
  const isPdf = category === "pdf";
  const isTextDocument = category === "document";
  const isProjectArchive = category === "project";
  const isMultiPage = isPdf || (matchedDef?.isMultiPage ?? false);
  const isValid = category !== "unknown";

  return {
    category,
    extension: ext,
    mimeType: rawMime || matchedDef?.mimeType || "application/octet-stream",
    displayName: matchedDef?.label || (isValid ? `${ext.toUpperCase().replace(".", "")} File` : "Unsupported File"),
    isImage,
    isPdf,
    isTextDocument,
    isProjectArchive,
    isMultiPage,
    isValid,
  };
}

/**
 * Helper to check whether a file is an acceptable image
 */
export function isImageFile(file: File | { name: string; type?: string }): boolean {
  const analysis = analyzeFile(file);
  return analysis.isImage;
}

/**
 * Helper to check whether a file is a PDF
 */
export function isPdfFile(file: File | { name: string; type?: string }): boolean {
  const analysis = analyzeFile(file);
  return analysis.isPdf;
}

/**
 * Helper to check whether a file is a printable text document (DOCX, DOC, TXT, RTF)
 */
export function isTextDocFile(file: File | { name: string; type?: string }): boolean {
  const analysis = analyzeFile(file);
  return analysis.isTextDocument;
}
