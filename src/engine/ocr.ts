/**
 * OMNISCAN TITAN X - Professional Local OCR Engine
 * Multi-Language Text Recognition, Layout Analysis & Bounding Box Extraction
 */

import { createWorker, Worker } from "tesseract.js";
import { OCRBlock, OCRLine, OCRResult, OCRWord } from "../types";

let cachedWorker: Worker | null = null;
let currentLanguage = "";

export interface OCRProgressEvent {
  status: string;
  progress: number; // 0 to 1
  pageNumber?: number;
}

/**
 * Initialize or get cached Tesseract OCR worker
 */
async function getOCRWorker(
  language = "eng",
  onProgress?: (e: OCRProgressEvent) => void
): Promise<Worker> {
  if (cachedWorker && currentLanguage === language) {
    return cachedWorker;
  }

  if (cachedWorker) {
    try {
      await cachedWorker.terminate();
    } catch (e) {
      console.warn("Worker termination error:", e);
    }
    cachedWorker = null;
  }

  onProgress?.({ status: `Loading OCR Model (${language})...`, progress: 0.1 });

  const worker = await createWorker(language, 1, {
    logger: (m) => {
      if (m.status === "recognizing text") {
        onProgress?.({
          status: "Recognizing Text...",
          progress: 0.2 + (m.progress || 0) * 0.75,
        });
      } else {
        onProgress?.({
          status: m.status || "Initializing OCR...",
          progress: 0.15,
        });
      }
    },
  });

  cachedWorker = worker;
  currentLanguage = language;
  return worker;
}

/**
 * Perform high-precision local OCR on an image
 */
export async function performPageOCR(
  imageDataUrl: string,
  language = "eng",
  onProgress?: (e: OCRProgressEvent) => void
): Promise<OCRResult> {
  try {
    onProgress?.({ status: "Preparing Page...", progress: 0.05 });
    const worker = await getOCRWorker(language, onProgress);

    const ret = await worker.recognize(imageDataUrl);
    const data = ret.data;

    // Build structured layout hierarchy
    const blocks: OCRBlock[] = [];

    if (data.blocks && data.blocks.length > 0) {
      data.blocks.forEach((b: any, bIdx: number) => {
        const lines: OCRLine[] = [];

        if (b.paragraphs) {
          b.paragraphs.forEach((p: any) => {
            if (p.lines) {
              p.lines.forEach((l: any) => {
                const words: OCRWord[] = [];
                if (l.words) {
                  l.words.forEach((w: any) => {
                    words.push({
                      text: w.text || "",
                      confidence: Math.round(w.confidence || 0),
                      bbox: {
                        x0: w.bbox?.x0 || 0,
                        y0: w.bbox?.y0 || 0,
                        x1: w.bbox?.x1 || 0,
                        y1: w.bbox?.y1 || 0,
                      },
                    });
                  });
                }

                lines.push({
                  text: l.text || "",
                  confidence: Math.round(l.confidence || 0),
                  bbox: {
                    x0: l.bbox?.x0 || 0,
                    y0: l.bbox?.y0 || 0,
                    x1: l.bbox?.x1 || 0,
                    y1: l.bbox?.y1 || 0,
                  },
                  words,
                });
              });
            }
          });
        }

        blocks.push({
          id: `block-${bIdx}`,
          text: b.text || "",
          confidence: Math.round(b.confidence || 0),
          bbox: {
            x0: b.bbox?.x0 || 0,
            y0: b.bbox?.y0 || 0,
            x1: b.bbox?.x1 || 0,
            y1: b.bbox?.y1 || 0,
          },
          lines,
        });
      });
    }

    onProgress?.({ status: "Completed", progress: 1.0 });

    return {
      text: data.text || "",
      blocks,
      language,
      confidence: Math.round(data.confidence || 0),
      status: "completed",
      processedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    console.error("OCR Execution Error:", err);
    return {
      text: "",
      blocks: [],
      language,
      confidence: 0,
      status: "error",
      errorMessage: err.message || "Local OCR recognition failed",
      processedAt: new Date().toISOString(),
    };
  }
}

export async function runPageOCR(
  imageDataUrl: string,
  language = "eng",
  onProgress?: (progress: number) => void
): Promise<OCRResult> {
  return performPageOCR(imageDataUrl, language, (e) => {
    onProgress?.(e.progress);
  });
}

/**
 * Terminate cached OCR worker when closing or resetting
 */
export async function terminateOCRWorker(): Promise<void> {
  if (cachedWorker) {
    try {
      await cachedWorker.terminate();
    } catch (e) {
      console.warn("Worker termination error:", e);
    }
    cachedWorker = null;
    currentLanguage = "";
  }
}

/**
 * Search text within OCR result and return bounding boxes
 */
export function searchOCRText(
  ocr: OCRResult,
  query: string
): Array<{ text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }> {
  if (!query || !ocr.blocks || ocr.blocks.length === 0) return [];
  const q = query.toLowerCase().trim();
  const matches: Array<{ text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }> = [];

  for (const block of ocr.blocks) {
    for (const line of block.lines) {
      for (const word of line.words) {
        if (word.text.toLowerCase().includes(q)) {
          matches.push({
            text: word.text,
            bbox: word.bbox,
          });
        }
      }
    }
  }

  return matches;
}
