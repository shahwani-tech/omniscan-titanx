/**
 * Centralized Document & Image Import Service
 * High-performance parser and renderer for:
 * - DOCX (via JSZip XML parsing)
 * - TXT (line-wrapped paginated canvas renderer)
 * - RTF (rich text control word extraction)
 * - DOC (binary text extraction)
 * - Images (JPG, PNG, WEBP, BMP, GIF, SVG, TIFF)
 */

import JSZip from "jszip";

export interface ImportedDocumentPage {
  dataUrl: string;
  width: number;
  height: number;
  pageNumber: number;
  totalPages: number;
  title: string;
}

export interface DocumentImportResult {
  success: boolean;
  pages: ImportedDocumentPage[];
  fileName: string;
  totalPages: number;
  error?: string;
}

const PAGE_WIDTH_PX = 1240; // ~300 DPI A4 Width
const PAGE_HEIGHT_PX = 1754; // ~300 DPI A4 Height
const MARGIN_PX = 100;
const LINE_HEIGHT_PX = 32;
const MAX_LINES_PER_PAGE = Math.floor((PAGE_HEIGHT_PX - MARGIN_PX * 2 - 80) / LINE_HEIGHT_PX);

/**
 * Render an array of formatted text lines into crisp 300 DPI page Data URLs
 */
export function renderTextLinesToPages(
  lines: string[],
  docTitle: string
): ImportedDocumentPage[] {
  // Break lines into pages
  const pagesData: string[][] = [];
  let currentChunk: string[] = [];

  for (const line of lines) {
    currentChunk.push(line);
    if (currentChunk.length >= MAX_LINES_PER_PAGE) {
      pagesData.push(currentChunk);
      currentChunk = [];
    }
  }
  if (currentChunk.length > 0 || pagesData.length === 0) {
    pagesData.push(currentChunk);
  }

  const totalPages = pagesData.length;
  const resultPages: ImportedDocumentPage[] = [];

  for (let pIdx = 0; pIdx < totalPages; pIdx++) {
    const pageLines = pagesData[pIdx];
    const canvas = document.createElement("canvas");
    canvas.width = PAGE_WIDTH_PX;
    canvas.height = PAGE_HEIGHT_PX;
    const ctx = canvas.getContext("2d");

    if (ctx) {
      // Crisp white paper background
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, PAGE_WIDTH_PX, PAGE_HEIGHT_PX);

      // Top running header
      ctx.fillStyle = "#64748B";
      ctx.font = "14px 'Plus Jakarta Sans', system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(docTitle.slice(0, 70), MARGIN_PX, MARGIN_PX - 40);

      ctx.textAlign = "right";
      ctx.fillText(`Page ${pIdx + 1} of ${totalPages}`, PAGE_WIDTH_PX - MARGIN_PX, MARGIN_PX - 40);

      // Subtle header divider rule
      ctx.strokeStyle = "#E2E8F0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(MARGIN_PX, MARGIN_PX - 28);
      ctx.lineTo(PAGE_WIDTH_PX - MARGIN_PX, MARGIN_PX - 28);
      ctx.stroke();

      // Main content lines
      ctx.fillStyle = "#0F172A";
      ctx.font = "18px 'JetBrains Mono', monospace";
      ctx.textAlign = "left";

      let yPos = MARGIN_PX + 20;
      for (const rawLine of pageLines) {
        // Truncate or fit line
        ctx.fillText(rawLine, MARGIN_PX, yPos);
        yPos += LINE_HEIGHT_PX;
      }

      // Bottom footer rule
      ctx.strokeStyle = "#F1F5F9";
      ctx.beginPath();
      ctx.moveTo(MARGIN_PX, PAGE_HEIGHT_PX - MARGIN_PX + 20);
      ctx.lineTo(PAGE_WIDTH_PX - MARGIN_PX, PAGE_HEIGHT_PX - MARGIN_PX + 20);
      ctx.stroke();

      ctx.fillStyle = "#94A3B8";
      ctx.font = "12px 'Plus Jakarta Sans', system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("OmniScan Titan X - Autonomous Document Studio", PAGE_WIDTH_PX / 2, PAGE_HEIGHT_PX - MARGIN_PX + 45);

      resultPages.push({
        dataUrl: canvas.toDataURL("image/png", 0.95),
        width: PAGE_WIDTH_PX,
        height: PAGE_HEIGHT_PX,
        pageNumber: pIdx + 1,
        totalPages,
        title: docTitle,
      });
    }
  }

  return resultPages;
}

/**
 * Parse and convert DOCX file using JSZip to extract word/document.xml
 */
export async function parseDocxFile(file: File): Promise<DocumentImportResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const docXmlFile = zip.file("word/document.xml");

    if (!docXmlFile) {
      throw new Error("Invalid DOCX archive: word/document.xml missing");
    }

    const xmlText = await docXmlFile.async("text");
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "application/xml");

    const paragraphs = xmlDoc.getElementsByTagName("w:p");
    const extractedLines: string[] = [];

    for (let i = 0; i < paragraphs.length; i++) {
      const p = paragraphs[i];
      const textNodes = p.getElementsByTagName("w:t");
      let paragraphText = "";
      for (let j = 0; j < textNodes.length; j++) {
        paragraphText += textNodes[j].textContent || "";
      }

      // Wrap text to ~80 chars
      if (paragraphText.trim().length === 0) {
        extractedLines.push("");
      } else {
        const words = paragraphText.split(/\s+/);
        let currentLine = "";
        for (const w of words) {
          if ((currentLine + " " + w).length > 76) {
            extractedLines.push(currentLine);
            currentLine = w;
          } else {
            currentLine = currentLine ? currentLine + " " + w : w;
          }
        }
        if (currentLine) extractedLines.push(currentLine);
      }
    }

    const pages = renderTextLinesToPages(
      extractedLines.length > 0 ? extractedLines : ["(Empty Word Document)"],
      file.name
    );

    return {
      success: true,
      pages,
      fileName: file.name,
      totalPages: pages.length,
    };
  } catch (err: any) {
    console.error("DOCX parsing error:", err);
    return {
      success: false,
      pages: [],
      fileName: file.name,
      totalPages: 0,
      error: `Could not parse DOCX: ${err.message || String(err)}`,
    };
  }
}

/**
 * Parse plain text (TXT) file
 */
export async function parseTxtFile(file: File): Promise<DocumentImportResult> {
  try {
    const rawText = await file.text();
    const rawLines = rawText.split(/\r?\n/);
    const wrappedLines: string[] = [];

    for (const rawLine of rawLines) {
      if (rawLine.length <= 78) {
        wrappedLines.push(rawLine);
      } else {
        // Wrap line
        let remaining = rawLine;
        while (remaining.length > 78) {
          wrappedLines.push(remaining.slice(0, 78));
          remaining = remaining.slice(78);
        }
        if (remaining) wrappedLines.push(remaining);
      }
    }

    const pages = renderTextLinesToPages(
      wrappedLines.length > 0 ? wrappedLines : ["(Empty Text File)"],
      file.name
    );

    return {
      success: true,
      pages,
      fileName: file.name,
      totalPages: pages.length,
    };
  } catch (err: any) {
    return {
      success: false,
      pages: [],
      fileName: file.name,
      totalPages: 0,
      error: `Could not parse text file: ${err.message || String(err)}`,
    };
  }
}

/**
 * Parse Rich Text Format (RTF) file
 */
export async function parseRtfFile(file: File): Promise<DocumentImportResult> {
  try {
    const rtfContent = await file.text();
    // Strip RTF control words and groups
    let cleaned = rtfContent
      .replace(/\\par[d]?\s*/g, "\n")
      .replace(/\\line\s*/g, "\n")
      .replace(/\\tab\s*/g, "    ")
      .replace(/\\[a-zA-Z]+(-?\d+)?\s?/g, "")
      .replace(/[{}]/g, "")
      .trim();

    const lines = cleaned.split(/\r?\n/).map((l) => l.trimEnd());
    const pages = renderTextLinesToPages(
      lines.length > 0 ? lines : ["(Empty RTF Document)"],
      file.name
    );

    return {
      success: true,
      pages,
      fileName: file.name,
      totalPages: pages.length,
    };
  } catch (err: any) {
    return {
      success: false,
      pages: [],
      fileName: file.name,
      totalPages: 0,
      error: `Could not parse RTF file: ${err.message || String(err)}`,
    };
  }
}

/**
 * Parse legacy binary Word document (DOC) via stream text extraction
 */
export async function parseLegacyDocFile(file: File): Promise<DocumentImportResult> {
  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let text = "";

    // Scan for printable ASCII & UTF-16 characters
    for (let i = 0; i < bytes.length - 1; i++) {
      const code = bytes[i];
      if (code >= 32 && code <= 126) {
        text += String.fromCharCode(code);
      } else if (code === 10 || code === 13) {
        text += "\n";
      }
    }

    // Filter out binary garbage clusters
    const rawLines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 3 && /[a-zA-Z0-9]/.test(l));

    const pages = renderTextLinesToPages(
      rawLines.length > 0 ? rawLines : ["(Extracted Legacy Document Text)"],
      file.name
    );

    return {
      success: true,
      pages,
      fileName: file.name,
      totalPages: pages.length,
    };
  } catch (err: any) {
    return {
      success: false,
      pages: [],
      fileName: file.name,
      totalPages: 0,
      error: `Could not parse legacy DOC file: ${err.message || String(err)}`,
    };
  }
}

/**
 * Decode image file (JPG, PNG, WEBP, BMP, GIF, SVG) into DataURL and dimensions
 */
export async function decodeImageFile(
  file: File
): Promise<{ dataUrl: string; width: number; height: number; fileName: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        resolve({
          dataUrl,
          width: img.naturalWidth || img.width || 1200,
          height: img.naturalHeight || img.height || 1600,
          fileName: file.name,
        });
      };
      img.onerror = () => {
        // Fallback for SVG or unusual images
        resolve({
          dataUrl,
          width: 1200,
          height: 1600,
          fileName: file.name,
        });
      };
      img.src = dataUrl;
    };
    reader.onerror = () => reject(new Error("Failed to read image file data."));
    reader.readAsDataURL(file);
  });
}

/**
 * Universal document parser for DOCX, TXT, RTF, and DOC
 * Returns an array of ImportedDocumentPage
 */
export async function parseDocumentFile(file: File): Promise<ImportedDocumentPage[]> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  let result: DocumentImportResult;
  if (ext === "docx") {
    result = await parseDocxFile(file);
  } else if (ext === "txt") {
    result = await parseTxtFile(file);
  } else if (ext === "rtf") {
    result = await parseRtfFile(file);
  } else if (ext === "doc") {
    result = await parseLegacyDocFile(file);
  } else {
    // Attempt text parsing as generic fallback
    result = await parseTxtFile(file);
  }

  if (!result.success || result.pages.length === 0) {
    throw new Error(result.error || `Could not parse document ${file.name}`);
  }
  return result.pages;
}

/**
 * Convenience helper to get a direct DataURL string from an image file
 */
export async function decodeImageDataUrl(file: File): Promise<string> {
  const decoded = await decodeImageFile(file);
  return decoded.dataUrl;
}
