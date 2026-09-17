/**
 * OMNISCAN TITAN X - Dedicated Image Processing Web Worker
 * Offloads pixel filter math, Radon deskew calculations, and blankness analysis
 * to background threads to ensure 60fps main-thread responsiveness.
 */

import {
  applyPixelFiltersToBuffer,
  computeRadonDeskewFromBuffer,
  computeEnsembleDeskewFromBuffer,
  computeBlanknessFromBuffer,
  executePerspectiveWarpBuffer,
  detectDocumentQuadFromBuffer,
  detectPageOrientationFromBuffer,
} from "../engine/pixelCore";

self.onmessage = (event: MessageEvent) => {
  const { id, type, buffer, width, height, filters, isFast, sensitivity } = event.data;

  try {
    switch (type) {
      case "PROCESS_PIXELS": {
        const u8 = new Uint8ClampedArray(buffer);
        applyPixelFiltersToBuffer(u8, width, height, filters, isFast);
        // Transfer buffer back to main thread with 0-copy overhead
        (self as any).postMessage(
          {
            id,
            type: "PROCESS_PIXELS_SUCCESS",
            buffer,
          },
          [buffer]
        );
        break;
      }

      case "CALCULATE_DESKEW": {
        const u8 = new Uint8ClampedArray(buffer);
        const deskewData = computeEnsembleDeskewFromBuffer(u8, width, height);
        (self as any).postMessage({
          id,
          type: "CALCULATE_DESKEW_SUCCESS",
          angle: deskewData.angle,
          confidence: deskewData.confidence,
          method: deskewData.method,
          spread: deskewData.spread,
        });
        break;
      }

      case "ANALYZE_BLANKNESS": {
        const u8 = new Uint8ClampedArray(buffer);
        const result = computeBlanknessFromBuffer(u8, width, height, sensitivity);
        (self as any).postMessage({
          id,
          type: "ANALYZE_BLANKNESS_SUCCESS",
          result,
        });
        break;
      }

      case "DETECT_ORIENTATION": {
        const u8 = new Uint8ClampedArray(buffer);
        const result = detectPageOrientationFromBuffer(u8, width, height);
        (self as any).postMessage({
          id,
          type: "DETECT_ORIENTATION_SUCCESS",
          result,
        });
        break;
      }

      case "PERSPECTIVE_WARP": {
        const { quad, targetW, targetH } = event.data;
        console.log("[filterWorker] PERSPECTIVE_WARP received task", { id, width, height, targetW, targetH, quad });
        const u8 = new Uint8ClampedArray(buffer);
        const targetBuffer = executePerspectiveWarpBuffer(
          u8,
          width,
          height,
          quad,
          targetW,
          targetH
        );
        (self as any).postMessage(
          {
            id,
            type: "PERSPECTIVE_WARP_SUCCESS",
            buffer: targetBuffer.buffer,
            targetW,
            targetH,
          },
          [targetBuffer.buffer]
        );
        break;
      }

      case "DETECT_DOCUMENT_QUAD": {
        const u8 = new Uint8ClampedArray(buffer);
        const result = detectDocumentQuadFromBuffer(u8, width, height);
        (self as any).postMessage({
          id,
          type: "DETECT_DOCUMENT_QUAD_SUCCESS",
          result,
        });
        break;
      }

      default:
        (self as any).postMessage({
          id,
          type: "ERROR",
          error: `Unknown action type: ${type}`,
        });
    }
  } catch (err: any) {
    (self as any).postMessage({
      id,
      type: "ERROR",
      error: err?.message || String(err),
    });
  }
};
