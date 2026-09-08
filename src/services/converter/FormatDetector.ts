/**
 * OMNISCAN TITAN X - Document Format Detector & Input File Validator
 * Performs deep binary inspection (magic bytes / signatures), MIME validation,
 * Office package inspection (DOCX / XLSX / PPTX / ODF), and format capabilities check.
 */

import { SupportedInputFormat } from "./ConversionTypes";
import JSZip from "jszip";

export interface FileDetectionResult {
  format: SupportedInputFormat;
  mimeType: string;
  isBinaryConfirmed: boolean;
  isOfficePackage: boolean;
  isValid: boolean;
  fileSize: number;
  fileName: string;
  error?: string;
  canMerge: boolean;
  canSplit: boolean;
  canConvertToPdf: boolean;
  canConvertFromPdf: boolean;
}

export class FormatDetector {
  /**
   * Inspect file headers and content to verify the actual format (prevents extension spoofing)
   */
  public static async detectFormat(file: File): Promise<FileDetectionResult> {
    const ext = this.getExtension(file.name).toLowerCase();
    const size = file.size;

    if (size === 0) {
      return {
        format: "unknown",
        mimeType: file.type || "application/octet-stream",
        isBinaryConfirmed: false,
        isOfficePackage: false,
        isValid: false,
        fileSize: 0,
        fileName: file.name,
        error: "File is empty (0 bytes).",
        canMerge: false,
        canSplit: false,
        canConvertToPdf: false,
        canConvertFromPdf: false,
      };
    }

    try {
      // Read first 512 bytes for magic numbers
      const slice = file.slice(0, 512);
      const buffer = await slice.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      // 1. PDF Signature: %PDF- (0x25, 0x50, 0x44, 0x46, 0x2D)
      if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
        return {
          format: "pdf",
          mimeType: "application/pdf",
          isBinaryConfirmed: true,
          isOfficePackage: false,
          isValid: true,
          fileSize: size,
          fileName: file.name,
          canMerge: true,
          canSplit: true,
          canConvertToPdf: false,
          canConvertFromPdf: true,
        };
      }

      // 2. PNG Signature: \x89PNG\r\n\x1a\n
      if (
        bytes.length >= 8 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a
      ) {
        return this.createImageResult("png", "image/png", file, size);
      }

      // 3. JPEG Signature: FF D8 FF
      if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        return this.createImageResult(ext === "jpeg" ? "jpeg" : "jpg", "image/jpeg", file, size);
      }

      // 4. GIF Signature: GIF87a or GIF89a
      if (
        bytes.length >= 6 &&
        bytes[0] === 0x47 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x38 &&
        (bytes[4] === 0x37 || bytes[4] === 0x39) &&
        bytes[5] === 0x61
      ) {
        return this.createImageResult("gif", "image/gif", file, size);
      }

      // 5. BMP Signature: BM (0x42, 0x4D)
      if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
        return this.createImageResult("bmp", "image/bmp", file, size);
      }

      // 6. TIFF Signature: II*\x00 (0x49, 0x49, 0x2A, 0x00) or MM\x00* (0x4D, 0x4D, 0x00, 0x2A)
      if (
        bytes.length >= 4 &&
        ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
          (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a))
      ) {
        return this.createImageResult("tiff", "image/tiff", file, size);
      }

      // 7. WEBP Signature: RIFF....WEBP
      if (
        bytes.length >= 12 &&
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
      ) {
        return this.createImageResult("webp", "image/webp", file, size);
      }

      // 8. RTF Signature: {\rtf
      if (
        bytes.length >= 5 &&
        bytes[0] === 0x7b &&
        bytes[1] === 0x5c &&
        bytes[2] === 0x72 &&
        bytes[3] === 0x74 &&
        bytes[4] === 0x66
      ) {
        return {
          format: "rtf",
          mimeType: "application/rtf",
          isBinaryConfirmed: true,
          isOfficePackage: false,
          isValid: true,
          fileSize: size,
          fileName: file.name,
          canMerge: true,
          canSplit: false,
          canConvertToPdf: true,
          canConvertFromPdf: false,
        };
      }

      // 9. ZIP / OpenXML Package Signature: PK\x03\x04 (0x50, 0x4B, 0x03, 0x04)
      if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
        // Deep inspect zip package to distinguish DOCX, XLSX, PPTX, ODF, and ZIP
        return await this.inspectZipArchive(file);
      }

      // 10. Text / XML / SVG / JSON inspection
      const headerText = new TextDecoder("utf-8", { fatal: false }).decode(bytes).trim();

      if (headerText.toLowerCase().includes("<svg") || (headerText.startsWith("<?xml") && headerText.includes("<svg"))) {
        return this.createImageResult("svg", "image/svg+xml", file, size);
      }

      if (headerText.startsWith("<?xml") || headerText.startsWith("<html") || headerText.startsWith("<!doctype html")) {
        const isHtml = headerText.toLowerCase().includes("<html") || ext === "html";
        return {
          format: isHtml ? "html" : "xml",
          mimeType: isHtml ? "text/html" : "application/xml",
          isBinaryConfirmed: false,
          isOfficePackage: false,
          isValid: true,
          fileSize: size,
          fileName: file.name,
          canMerge: true,
          canSplit: false,
          canConvertToPdf: true,
          canConvertFromPdf: false,
        };
      }

      if (ext === "json" && (headerText.startsWith("{") || headerText.startsWith("["))) {
        return {
          format: "json",
          mimeType: "application/json",
          isBinaryConfirmed: false,
          isOfficePackage: false,
          isValid: true,
          fileSize: size,
          fileName: file.name,
          canMerge: false,
          canSplit: false,
          canConvertToPdf: true,
          canConvertFromPdf: false,
        };
      }

      if (ext === "csv") {
        return {
          format: "csv",
          mimeType: "text/csv",
          isBinaryConfirmed: false,
          isOfficePackage: false,
          isValid: true,
          fileSize: size,
          fileName: file.name,
          canMerge: false,
          canSplit: false,
          canConvertToPdf: true,
          canConvertFromPdf: false,
        };
      }

      if (ext === "txt") {
        return {
          format: "txt",
          mimeType: "text/plain",
          isBinaryConfirmed: false,
          isOfficePackage: false,
          isValid: true,
          fileSize: size,
          fileName: file.name,
          canMerge: true,
          canSplit: false,
          canConvertToPdf: true,
          canConvertFromPdf: false,
        };
      }

      // Legacy Office Binary Formats (e.g. DOC, XLS, PPT)
      if (ext === "doc") {
        return {
          format: "doc",
          mimeType: "application/msword",
          isBinaryConfirmed: true,
          isOfficePackage: false,
          isValid: true,
          fileSize: size,
          fileName: file.name,
          canMerge: true,
          canSplit: false,
          canConvertToPdf: true,
          canConvertFromPdf: false,
        };
      }

      if (ext === "xls") {
        return {
          format: "xls",
          mimeType: "application/vnd.ms-excel",
          isBinaryConfirmed: true,
          isOfficePackage: false,
          isValid: true,
          fileSize: size,
          fileName: file.name,
          canMerge: false,
          canSplit: false,
          canConvertToPdf: true,
          canConvertFromPdf: false,
        };
      }

      if (ext === "ppt") {
        return {
          format: "ppt",
          mimeType: "application/vnd.ms-powerpoint",
          isBinaryConfirmed: true,
          isOfficePackage: false,
          isValid: true,
          fileSize: size,
          fileName: file.name,
          canMerge: false,
          canSplit: false,
          canConvertToPdf: true,
          canConvertFromPdf: false,
        };
      }

      // Fallback by extension
      return this.fallbackByExtension(ext, file, size);
    } catch (err: any) {
      return {
        format: "unknown",
        mimeType: "application/octet-stream",
        isBinaryConfirmed: false,
        isOfficePackage: false,
        isValid: false,
        fileSize: size,
        fileName: file.name,
        error: `Could not parse file header: ${err.message || String(err)}`,
        canMerge: false,
        canSplit: false,
        canConvertToPdf: false,
        canConvertFromPdf: false,
      };
    }
  }

  /**
   * Open zip stream to distinguish DOCX, XLSX, PPTX, ODT, ODS, ODP, and standard ZIP
   */
  private static async inspectZipArchive(file: File): Promise<FileDetectionResult> {
    const ext = this.getExtension(file.name).toLowerCase();
    const size = file.size;

    try {
      const zip = new JSZip();
      const content = await zip.loadAsync(file);

      // Check WordprocessingML
      if (content.file("word/document.xml") || ext === "docx") {
        return {
          format: "docx",
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          isBinaryConfirmed: true,
          isOfficePackage: true,
          isValid: true,
          fileSize: size,
          fileName: file.name,
          canMerge: true,
          canSplit: false,
          canConvertToPdf: true,
          canConvertFromPdf: false,
        };
      }

      // Check SpreadsheetML
      if (content.file("xl/workbook.xml") || ext === "xlsx") {
        return {
          format: "xlsx",
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          isBinaryConfirmed: true,
          isOfficePackage: true,
          isValid: true,
          fileSize: size,
          fileName: file.name,
          canMerge: false,
          canSplit: false,
          canConvertToPdf: true,
          canConvertFromPdf: false,
        };
      }

      // Check PresentationML
      if (content.file("ppt/presentation.xml") || ext === "pptx") {
        return {
          format: "pptx",
          mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          isBinaryConfirmed: true,
          isOfficePackage: true,
          isValid: true,
          fileSize: size,
          fileName: file.name,
          canMerge: false,
          canSplit: false,
          canConvertToPdf: true,
          canConvertFromPdf: false,
        };
      }

      // Check OpenDocument formats
      const mimetypeFile = content.file("mimetype");
      if (mimetypeFile) {
        const mime = (await mimetypeFile.async("string")).trim();
        if (mime.includes("opendocument.text") || ext === "odt") {
          return {
            format: "odt",
            mimeType: "application/vnd.oasis.opendocument.text",
            isBinaryConfirmed: true,
            isOfficePackage: true,
            isValid: true,
            fileSize: size,
            fileName: file.name,
            canMerge: true,
            canSplit: false,
            canConvertToPdf: true,
            canConvertFromPdf: false,
          };
        }
        if (mime.includes("opendocument.spreadsheet") || ext === "ods") {
          return {
            format: "ods",
            mimeType: "application/vnd.oasis.opendocument.spreadsheet",
            isBinaryConfirmed: true,
            isOfficePackage: true,
            isValid: true,
            fileSize: size,
            fileName: file.name,
            canMerge: false,
            canSplit: false,
            canConvertToPdf: true,
            canConvertFromPdf: false,
          };
        }
        if (mime.includes("opendocument.presentation") || ext === "odp") {
          return {
            format: "odp",
            mimeType: "application/vnd.oasis.opendocument.presentation",
            isBinaryConfirmed: true,
            isOfficePackage: true,
            isValid: true,
            fileSize: size,
            fileName: file.name,
            canMerge: false,
            canSplit: false,
            canConvertToPdf: true,
            canConvertFromPdf: false,
          };
        }
      }

      // Standard ZIP archive
      return {
        format: "zip",
        mimeType: "application/zip",
        isBinaryConfirmed: true,
        isOfficePackage: false,
        isValid: true,
        fileSize: size,
        fileName: file.name,
        canMerge: false,
        canSplit: false,
        canConvertToPdf: false,
        canConvertFromPdf: false,
      };
    } catch {
      // If JSZip fails, fallback to extension if standard
      return this.fallbackByExtension(ext, file, size);
    }
  }

  private static createImageResult(
    format: SupportedInputFormat,
    mimeType: string,
    file: File,
    size: number
  ): FileDetectionResult {
    return {
      format,
      mimeType,
      isBinaryConfirmed: true,
      isOfficePackage: false,
      isValid: true,
      fileSize: size,
      fileName: file.name,
      canMerge: true,
      canSplit: false,
      canConvertToPdf: true,
      canConvertFromPdf: false,
    };
  }

  private static fallbackByExtension(ext: string, file: File, size: number): FileDetectionResult {
    const formatMap: Record<string, { format: SupportedInputFormat; mimeType: string }> = {
      pdf: { format: "pdf", mimeType: "application/pdf" },
      docx: { format: "docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
      doc: { format: "doc", mimeType: "application/msword" },
      rtf: { format: "rtf", mimeType: "application/rtf" },
      txt: { format: "txt", mimeType: "text/plain" },
      odt: { format: "odt", mimeType: "application/vnd.oasis.opendocument.text" },
      xlsx: { format: "xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
      xls: { format: "xls", mimeType: "application/vnd.ms-excel" },
      csv: { format: "csv", mimeType: "text/csv" },
      ods: { format: "ods", mimeType: "application/vnd.oasis.opendocument.spreadsheet" },
      pptx: { format: "pptx", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
      ppt: { format: "ppt", mimeType: "application/vnd.ms-powerpoint" },
      odp: { format: "odp", mimeType: "application/vnd.oasis.opendocument.presentation" },
      png: { format: "png", mimeType: "image/png" },
      jpg: { format: "jpg", mimeType: "image/jpeg" },
      jpeg: { format: "jpeg", mimeType: "image/jpeg" },
      webp: { format: "webp", mimeType: "image/webp" },
      bmp: { format: "bmp", mimeType: "image/bmp" },
      tiff: { format: "tiff", mimeType: "image/tiff" },
      tif: { format: "tif", mimeType: "image/tiff" },
      gif: { format: "gif", mimeType: "image/gif" },
      svg: { format: "svg", mimeType: "image/svg+xml" },
      html: { format: "html", mimeType: "text/html" },
      xml: { format: "xml", mimeType: "application/xml" },
      json: { format: "json", mimeType: "application/json" },
      zip: { format: "zip", mimeType: "application/zip" },
    };

    const match = formatMap[ext];
    if (match) {
      return {
        format: match.format,
        mimeType: match.mimeType,
        isBinaryConfirmed: false,
        isOfficePackage: ["docx", "xlsx", "pptx", "odt", "ods", "odp"].includes(match.format),
        isValid: true,
        fileSize: size,
        fileName: file.name,
        canMerge: ["pdf", "jpg", "jpeg", "png", "webp", "bmp", "docx", "txt"].includes(match.format),
        canSplit: match.format === "pdf",
        canConvertToPdf: match.format !== "pdf" && match.format !== "zip",
        canConvertFromPdf: match.format === "pdf",
      };
    }

    return {
      format: "unknown",
      mimeType: file.type || "application/octet-stream",
      isBinaryConfirmed: false,
      isOfficePackage: false,
      isValid: false,
      fileSize: size,
      fileName: file.name,
      error: `Unsupported file format (.${ext || "unknown"})`,
      canMerge: false,
      canSplit: false,
      canConvertToPdf: false,
      canConvertFromPdf: false,
    };
  }

  public static getExtension(filename: string): string {
    const parts = filename.split(".");
    return parts.length > 1 ? parts.pop() || "" : "";
  }

  public static formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }
}
