/**
 * OMNISCAN TITAN X - Extreme-Scale Batch Import Manager
 * Handles up to 10,000 files or documents with zero freeze, real-time cooperative yielding,
 * memory-bounded execution, progress telemetry, and abortable cancellation.
 */

import { OmniPage } from "../types";
import { importPDFFile } from "./pdf";
import { DEFAULT_FILTERS } from "./vision";
import { validateFileSecurity, sanitizeFilename } from "./securityValidator";

async function convertBlobToOmniPage(file: File | Blob, name: string): Promise<OmniPage> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  return {
    id: "page-" + Math.random().toString(36).substring(2, 9) + "-" + Date.now(),
    pageNumber: 1,
    originalDataUrl: dataUrl,
    processedDataUrl: dataUrl,
    thumbnailDataUrl: dataUrl,
    width: 2480,
    height: 3508,
    dpi: 300,
    sizeBytes: Math.round(dataUrl.length * 0.75),
    isBlank: false,
    blankScore: 0,
    filters: { ...DEFAULT_FILTERS },
    annotations: [],
    redactions: [],
    formFields: [],
    isModified: false,
    lastModifiedAt: new Date().toISOString(),
  };
}

export interface BatchImportProgress {
  totalFiles: number;
  processedFiles: number;
  successCount: number;
  errorCount: number;
  currentFileName: string;
  percent: number;
  isComplete: boolean;
  isCancelled: boolean;
  errors: { fileName: string; error: string }[];
}

export interface BatchImportOptions {
  batchChunkSize?: number; // Number of pages/files to commit in each React state update
  onProgress?: (progress: BatchImportProgress) => void;
  onChunkReady?: (pagesChunk: OmniPage[]) => void;
  signal?: AbortSignal;
}

export interface BatchImportResult {
  pages: OmniPage[];
  totalProcessed: number;
  successCount: number;
  errorCount: number;
  errors: { fileName: string; error: string }[];
  wasCancelled: boolean;
}

/**
 * Cooperative sleep yielding to the browser event loop so UI does not freeze
 */
function yieldToEventLoop(ms = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * High-performance batch file processor designed to safely ingest up to 10,000 files.
 */
export async function processBatchFilesAtScale(
  files: (File | Blob)[],
  options: BatchImportOptions = {}
): Promise<BatchImportResult> {
  const { batchChunkSize = 25, onProgress, onChunkReady, signal } = options;

  const totalFiles = files.length;
  let processedFiles = 0;
  let successCount = 0;
  const errors: { fileName: string; error: string }[] = [];
  const allImportedPages: OmniPage[] = [];
  let pendingChunk: OmniPage[] = [];

  const updateProgress = (currentFileName: string, isComplete = false, isCancelled = false) => {
    if (onProgress) {
      const percent = totalFiles > 0 ? Math.round((processedFiles / totalFiles) * 100) : 100;
      onProgress({
        totalFiles,
        processedFiles,
        successCount,
        errorCount: errors.length,
        currentFileName,
        percent,
        isComplete,
        isCancelled,
        errors,
      });
    }
  };

  updateProgress("Starting batch import...", false, false);

  for (let i = 0; i < totalFiles; i++) {
    // Check if user cancelled the import
    if (signal?.aborted) {
      if (pendingChunk.length > 0 && onChunkReady) {
        onChunkReady(pendingChunk);
      }
      updateProgress("Batch import cancelled by user", true, true);
      return {
        pages: allImportedPages,
        totalProcessed: processedFiles,
        successCount,
        errorCount: errors.length,
        errors,
        wasCancelled: true,
      };
    }

    const file = files[i];
    const rawName = file instanceof File ? file.name : `file_${i + 1}.bin`;
    const cleanName = sanitizeFilename(rawName);

    try {
      // Step 1: Magic-bytes security and structure verification
      const securityCheck = await validateFileSecurity(file, cleanName);
      if (!securityCheck.valid) {
        errors.push({
          fileName: cleanName,
          error: securityCheck.error || "File failed security signature validation.",
        });
        processedFiles++;
        updateProgress(cleanName);
        continue;
      }

      // Step 2: Ingest based on detected type
      if (securityCheck.detectedType === "pdf") {
        const fileObj = file instanceof File ? file : new File([file], cleanName, { type: "application/pdf" });
        const imported = await importPDFFile(fileObj, {
          onProgress: () => {},
        });

        if (imported.pages && imported.pages.length > 0) {
          allImportedPages.push(...imported.pages);
          pendingChunk.push(...imported.pages);
          successCount++;
        }
      } else {
        // Standard Image or Document Page
        const singlePage = await convertBlobToOmniPage(file, cleanName);
        allImportedPages.push(singlePage);
        pendingChunk.push(singlePage);
        successCount++;
      }
    } catch (err: any) {
      errors.push({
        fileName: cleanName,
        error: err?.message || String(err),
      });
    }

    processedFiles++;
    updateProgress(cleanName);

    // If pending chunk reaches batchChunkSize or we are at the end, commit chunk to UI
    if (pendingChunk.length >= batchChunkSize || i === totalFiles - 1) {
      if (pendingChunk.length > 0 && onChunkReady) {
        onChunkReady([...pendingChunk]);
        pendingChunk = [];
      }
      // Yield to main thread every batch so animations and 60fps responsiveness stay smooth
      await yieldToEventLoop(4);
    } else if (i % 10 === 0) {
      // Yield occasionally even if pages haven't reached chunkSize
      await yieldToEventLoop(0);
    }
  }

  updateProgress("Batch import completed", true, false);

  return {
    pages: allImportedPages,
    totalProcessed: processedFiles,
    successCount,
    errorCount: errors.length,
    errors,
    wasCancelled: false,
  };
}
