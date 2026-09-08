/**
 * OMNISCAN TITAN X - Enterprise File Naming & Output Path Sanitizer
 * Manages clean file names, template expansion ({name}, {page}, {date}, {ext}),
 * sequential numbering, batch renaming, collision prevention, and OS sanitization.
 */

export interface NamingTemplateOptions {
  baseName: string;
  extension: string;
  pageNumber?: number;
  totalPages?: number;
  prefix?: string;
  suffix?: string;
  numberingStyle?: "none" | "underscore_two_digit" | "dash_two_digit" | "parentheses" | "raw";
  customPattern?: string; // e.g. "{name}_Page_{page}.{ext}"
}

export class FileNamingManager {
  // Disallowed characters in Windows, Linux, macOS filenames: \ / : * ? " < > |
  private static ILLEGAL_CHARS_REGEX = /[\\/:*?"<>|\x00-\x1f\x7f]/g;

  /**
   * Remove any OS-forbidden characters and normalize spacing
   */
  public static sanitizeFileName(input: string, fallback = "Document"): string {
    if (!input || !input.trim()) return fallback;

    let sanitized = input
      .replace(this.ILLEGAL_CHARS_REGEX, "_")
      .replace(/\s+/g, " ")
      .trim();

    // Prevent filenames consisting solely of dots or spaces
    if (/^\.+$/.test(sanitized)) {
      sanitized = fallback;
    }

    // Windows reserved filenames (CON, PRN, AUX, NUL, COM1-9, LPT1-9)
    const reservedRegex = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
    if (reservedRegex.test(sanitized)) {
      sanitized = `file_${sanitized}`;
    }

    return sanitized.slice(0, 240); // Safe length under 255 chars
  }

  /**
   * Strip extension from a filename
   */
  public static getBaseName(fileName: string): string {
    const lastDot = fileName.lastIndexOf(".");
    if (lastDot <= 0) return fileName;
    return fileName.slice(0, lastDot);
  }

  /**
   * Generate an output filename applying templates, numbering, and sanitization
   */
  public static generateOutputName(opts: NamingTemplateOptions): string {
    const cleanBase = this.getBaseName(this.sanitizeFileName(opts.baseName || "Document"));
    const cleanExt = (opts.extension || "").replace(/^\./, "").toLowerCase();
    const cleanPrefix = opts.prefix ? this.sanitizeFileName(opts.prefix) : "";
    const cleanSuffix = opts.suffix ? this.sanitizeFileName(opts.suffix) : "";

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "");

    const pNum = opts.pageNumber || 1;
    const totalP = opts.totalPages || 1;

    let numPart = "";
    if (opts.numberingStyle === "underscore_two_digit") {
      numPart = `_${String(pNum).padStart(2, "0")}`;
    } else if (opts.numberingStyle === "dash_two_digit") {
      numPart = `-${String(pNum).padStart(2, "0")}`;
    } else if (opts.numberingStyle === "parentheses") {
      numPart = ` (${pNum})`;
    } else if (opts.numberingStyle === "raw") {
      numPart = `_${pNum}`;
    }

    if (opts.customPattern && opts.customPattern.trim()) {
      let result = opts.customPattern
        .replace(/{name}/gi, cleanBase)
        .replace(/{ext}/gi, cleanExt)
        .replace(/{page}/gi, String(pNum).padStart(2, "0"))
        .replace(/{total}/gi, String(totalP))
        .replace(/{date}/gi, dateStr)
        .replace(/{time}/gi, timeStr);

      if (!result.toLowerCase().endsWith(`.${cleanExt}`)) {
        result += `.${cleanExt}`;
      }
      return this.sanitizeFileName(result);
    }

    const core = `${cleanPrefix ? cleanPrefix + "_" : ""}${cleanBase}${cleanSuffix ? "_" + cleanSuffix : ""}${numPart}`;
    const fullName = `${core}.${cleanExt}`;
    return this.sanitizeFileName(fullName);
  }

  /**
   * Generate a batch list of unique filenames avoiding collisions
   */
  public static generateUniqueNames(
    items: { baseName: string; extension: string; pageIndex?: number }[]
  ): string[] {
    const used = new Set<string>();
    const results: string[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      let candidate = this.generateOutputName({
        baseName: item.baseName,
        extension: item.extension,
        pageNumber: item.pageIndex !== undefined ? item.pageIndex + 1 : i + 1,
        totalPages: items.length,
        numberingStyle: items.length > 1 ? "underscore_two_digit" : "none",
      });

      let collisionCounter = 1;
      while (used.has(candidate.toLowerCase())) {
        const base = this.getBaseName(candidate);
        const ext = item.extension.replace(/^\./, "");
        candidate = `${base}_${collisionCounter}.${ext}`;
        collisionCounter++;
      }

      used.add(candidate.toLowerCase());
      results.push(candidate);
    }

    return results;
  }
}
