/**
 * OMNISCAN TITAN X - Conversion Manager & Job Queue Orchestrator
 * Coordinates asynchronous document conversions, batch queues, cancellation,
 * throttled progress reporting, and memory/URL cleanup.
 */

import {
  WorkspaceFile,
  ConversionJobConfig,
  ConversionResult,
  ConversionProgressCallback,
  ConversionTool,
} from "./ConversionTypes";
import { ConversionEngine } from "./ConversionEngine";

export interface ActiveJobState {
  id: string;
  tool: ConversionTool;
  fileCount: number;
  progress: number;
  statusText: string;
  isCancelled: boolean;
  startTime: number;
}

export class ConversionManager {
  private static activeJobs = new Map<string, ActiveJobState>();
  private static createdObjectUrls = new Set<string>();

  /**
   * Execute a conversion job with full progress tracking, cancellation support, and error safety
   */
  public static async executeJob(
    jobId: string,
    files: WorkspaceFile[],
    config: ConversionJobConfig,
    onProgress?: ConversionProgressCallback
  ): Promise<ConversionResult> {
    const jobState: ActiveJobState = {
      id: jobId,
      tool: config.tool,
      fileCount: files.length,
      progress: 0,
      statusText: "Initializing conversion pipeline...",
      isCancelled: false,
      startTime: Date.now(),
    };

    this.activeJobs.set(jobId, jobState);

    const safeProgress: ConversionProgressCallback = (percent, msg, currentFile) => {
      if (jobState.isCancelled) return;
      jobState.progress = percent;
      jobState.statusText = msg;
      onProgress?.(percent, msg, currentFile);
    };

    try {
      let result: ConversionResult;

      switch (config.tool) {
        case "merge-pdf":
          result = await ConversionEngine.mergeFilesToPdf(files, config, safeProgress);
          break;

        case "split-pdf":
          if (files.length === 0) throw new Error("No PDF file selected for splitting.");
          result = await ConversionEngine.splitPdf(files[0], config, safeProgress);
          break;

        case "pdf-to-image":
          if (files.length === 0) throw new Error("No PDF file selected for image export.");
          result = await ConversionEngine.convertPdfToImages(files[0], config, safeProgress);
          break;

        case "image-to-pdf":
          result = await ConversionEngine.convertImagesToPdf(files, config, safeProgress);
          break;

        case "pdf-to-word":
          if (files.length === 0) throw new Error("No PDF file selected for Word conversion.");
          result = await ConversionEngine.convertPdfToWord(files[0], config, safeProgress);
          break;

        case "word-to-pdf":
          if (files.length === 0) throw new Error("No document file selected for PDF conversion.");
          result = await ConversionEngine.convertWordToPdf(files[0], config, safeProgress);
          break;

        case "pdf-to-excel":
          if (files.length === 0) throw new Error("No PDF file selected for Excel conversion.");
          result = await ConversionEngine.convertPdfToExcel(files[0], config, safeProgress);
          break;

        case "excel-to-pdf":
          if (files.length === 0) throw new Error("No spreadsheet file selected for PDF conversion.");
          result = await ConversionEngine.convertExcelToPdf(files[0], config, safeProgress);
          break;

        case "pdf-to-pptx":
          if (files.length === 0) throw new Error("No PDF file selected for PowerPoint conversion.");
          result = await ConversionEngine.convertPdfToPptx(files[0], config, safeProgress);
          break;

        case "pptx-to-pdf":
          if (files.length === 0) throw new Error("No presentation file selected for PDF conversion.");
          result = await ConversionEngine.convertPptxToPdf(files[0], config, safeProgress);
          break;

        default:
          throw new Error(`Unsupported conversion tool: ${config.tool}`);
      }

      if (jobState.isCancelled) {
        throw new Error("Conversion was cancelled by user.");
      }

      // Track created URLs for later automatic or manual cleanup
      result.outputFiles.forEach((item) => {
        if (item.downloadUrl) {
          this.createdObjectUrls.add(item.downloadUrl);
        }
      });
      if (result.zipPackageUrl) {
        this.createdObjectUrls.add(result.zipPackageUrl);
      }

      return result;
    } catch (err: any) {
      return {
        success: false,
        jobId,
        tool: config.tool,
        outputFiles: [],
        totalTimeMs: Date.now() - jobState.startTime,
        error: err.message || "An unknown error occurred during conversion.",
      };
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  /**
   * Cancel an active conversion job
   */
  public static cancelJob(jobId: string): void {
    const job = this.activeJobs.get(jobId);
    if (job) {
      job.isCancelled = true;
      job.statusText = "Cancelling conversion...";
    }
  }

  /**
   * Revoke any generated object URLs to free memory
   */
  public static cleanupUrls(): void {
    for (const url of this.createdObjectUrls) {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    }
    this.createdObjectUrls.clear();
  }
}
