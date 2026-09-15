/**
 * OMNISCAN TITAN X - Dedicated Image Processing Web Worker
 * Offloads pixel filter math, Radon deskew calculations, and blankness analysis
 * to background threads to ensure 60fps main-thread responsiveness.
 */

import {
  applyPixelFiltersToBuffer,
  computeRadonDeskewFromBuffer,
  computeBlanknessFromBuffer,
  executePerspectiveWarpBuffer,
  detectDocumentQuadFromBuffer,
} from "../engine/pixelCore";

self.onmessage = (event: MessageEvent) => {
  const { id, type, buffer, width, height, filters, isFast } = event.data;

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
        const angle = computeRadonDeskewFromBuffer(u8, width, height);
        (self as any).postMessage({
          id,
          type: "CALCULATE_DESKEW_SUCCESS",
          angle,
        });
        break;
      }

      case "ANALYZE_BLANKNESS": {
        const u8 = new Uint8ClampedArray(buffer);
        const result = computeBlanknessFromBuffer(u8, width, height);
        (self as any).postMessage({
          id,
          type: "ANALYZE_BLANKNESS_SUCCESS",
          result,
        });
        break;
      }

      case "PERSPECTIVE_WARP": {
        const { quad, targetW, targetH } = event.data;
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
