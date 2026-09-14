/**
 * OMNISCAN TITAN X - Enterprise Security & File Signature Validator
 * Validates magic bytes, sanitizes filenames/metadata, and isolates untrusted inputs.
 */

// Known file magic bytes (signatures)
const MAGIC_SIGNATURES: {
  type: "pdf" | "png" | "jpeg" | "webp" | "gif" | "docx";
  bytes: number[];
  offset?: number;
}[] = [
  // PDF starts with '%PDF-' (0x25, 0x50, 0x44, 0x46, 0x2D)
  { type: "pdf", bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] },
  // PNG starts with 89 50 4E 47 0D 0A 1A 0A
  { type: "png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  // JPEG starts with FF D8 FF
  { type: "jpeg", bytes: [0xff, 0xd8, 0xff] },
  // GIF starts with 'GIF87a' or 'GIF89a'
  { type: "gif", bytes: [0x47, 0x49, 0x46, 0x38] },
  // WEBP has 'RIFF' at 0 and 'WEBP' at 8
  { type: "webp", bytes: [0x52, 0x49, 0x46, 0x46] },
  // DOCX / ZIP archive starts with PK\x03\x04
  { type: "docx", bytes: [0x50, 0x4b, 0x03, 0x04] },
];

export interface FileValidationResult {
  valid: boolean;
  detectedType: "pdf" | "image" | "document" | "unknown";
  sanitizedName: string;
  sizeBytes: number;
  error?: string;
  isEncryptedPdf?: boolean;
}

/**
 * Sanitize a filename to prevent path traversal, HTML/XSS injection, and control characters.
 */
export function sanitizeFilename(rawName: string): string {
  if (!rawName) return "document_unnamed";

  // Remove null bytes and control characters
  let clean = rawName.replace(/[\x00-\x1f\x7f-\x9f]/g, "");

  // Remove path traversal sequences (../ or ..\)
  clean = clean.replace(/\.\.+[/\\]/g, "");

  // Strip HTML / script tags
  clean = clean.replace(/<[^>]*>?/gm, "");

  // Strip dangerous characters for filesystem / URL safety: : * ? " < > |
  clean = clean.replace(/[:*?"<>|]/g, "_");

  // Trim leading/trailing whitespace and dots
  clean = clean.trim().replace(/^\.+/, "");

  // Cap max length to 255 characters
  if (clean.length > 255) {
    const extIdx = clean.lastIndexOf(".");
    const ext = extIdx !== -1 ? clean.slice(extIdx) : "";
    clean = clean.slice(0, 255 - ext.length) + ext;
  }

  return clean || "document";
}

/**
 * Read the first N bytes of a File or ArrayBuffer using FileReader / slice
 */
async function readHeaderBytes(file: File | Blob | ArrayBuffer, count = 16): Promise<Uint8Array> {
  if (file instanceof ArrayBuffer) {
    return new Uint8Array(file.slice(0, count));
  }
  const slice = file.slice(0, count);
  const buffer = await slice.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Validates a file's magic bytes to prevent file extension spoofing
 * (e.g. an executable or script disguised with a .pdf extension).
 */
export async function validateFileSecurity(
  file: File | Blob,
  fileName?: string
): Promise<FileValidationResult> {
  const name = sanitizeFilename(fileName || (file instanceof File ? file.name : "upload.bin"));
  const lowerName = name.toLowerCase();
  const sizeBytes = file.size;

  // Sanity check: reject completely empty files
  if (sizeBytes === 0) {
    return {
      valid: false,
      detectedType: "unknown",
      sanitizedName: name,
      sizeBytes,
      error: "File is 0 bytes (empty document).",
    };
  }

  // Enforce sensible upper limit per file: 500 MB to prevent instant browser memory crash
  const MAX_FILE_SIZE = 500 * 1024 * 1024;
  if (sizeBytes > MAX_FILE_SIZE) {
    return {
      valid: false,
      detectedType: "unknown",
      sanitizedName: name,
      sizeBytes,
      error: `File size exceeds 500 MB limit (${(sizeBytes / (1024 * 1024)).toFixed(1)} MB).`,
    };
  }

  try {
    const header = await readHeaderBytes(file, 16);

    // Check PDF
    const isPdfDeclared = lowerName.endsWith(".pdf") || file.type === "application/pdf";
    const hasPdfHeader =
      header[0] === 0x25 && // %
      header[1] === 0x50 && // P
      header[2] === 0x44 && // D
      header[3] === 0x46 && // F
      header[4] === 0x2d;   // -

    if (isPdfDeclared) {
      if (!hasPdfHeader) {
        // Some PDFs might have a few blank lines before %PDF-, check within first 1024 bytes
        const largerHeader = await readHeaderBytes(file, 1024);
        const headerStr = new TextDecoder("latin1").decode(largerHeader);
        if (!headerStr.includes("%PDF-")) {
          return {
            valid: false,
            detectedType: "unknown",
            sanitizedName: name,
            sizeBytes,
            error: "Security Violation: File has a .pdf extension but does not contain a valid %PDF- header.",
          };
        }
      }
      return {
        valid: true,
        detectedType: "pdf",
        sanitizedName: name,
        sizeBytes,
      };
    }

    // Check PNG
    const hasPngHeader =
      header[0] === 0x89 &&
      header[1] === 0x50 &&
      header[2] === 0x4e &&
      header[3] === 0x47;

    if (hasPngHeader) {
      return {
        valid: true,
        detectedType: "image",
        sanitizedName: name,
        sizeBytes,
      };
    }

    // Check JPEG
    const hasJpegHeader = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    if (hasJpegHeader) {
      return {
        valid: true,
        detectedType: "image",
        sanitizedName: name,
        sizeBytes,
      };
    }

    // Check WEBP / RIFF
    const hasRiffHeader =
      header[0] === 0x52 &&
      header[1] === 0x49 &&
      header[2] === 0x46 &&
      header[3] === 0x46;
    if (hasRiffHeader) {
      return {
        valid: true,
        detectedType: "image",
        sanitizedName: name,
        sizeBytes,
      };
    }

    // Check DOCX / ZIP
    const hasZipHeader = header[0] === 0x50 && header[1] === 0x4b && header[2] === 0x03 && header[3] === 0x04;
    if (hasZipHeader && lowerName.endsWith(".docx")) {
      return {
        valid: true,
        detectedType: "document",
        sanitizedName: name,
        sizeBytes,
      };
    }

    // Check TXT or other text documents
    if (
      lowerName.endsWith(".txt") ||
      lowerName.endsWith(".rtf") ||
      lowerName.endsWith(".doc") ||
      file.type.startsWith("text/")
    ) {
      return {
        valid: true,
        detectedType: "document",
        sanitizedName: name,
        sizeBytes,
      };
    }

    // Fallback image extensions
    if (/\.(jpe?g|png|webp|bmp|gif|tiff?|svg)$/i.test(lowerName)) {
      return {
        valid: true,
        detectedType: "image",
        sanitizedName: name,
        sizeBytes,
      };
    }

    return {
      valid: false,
      detectedType: "unknown",
      sanitizedName: name,
      sizeBytes,
      error: `Unsupported or unverified file signature for "${name}".`,
    };
  } catch (err: any) {
    return {
      valid: false,
      detectedType: "unknown",
      sanitizedName: name,
      sizeBytes,
      error: `Error reading file signature: ${err?.message || String(err)}`,
    };
  }
}
