/**
 * OMNISCAN TITAN X - Enterprise Perspective Quadrangle Warp Engine
 * Professional-Grade Document Corner Pinning & Homography De-Warping System
 *
 * Implements Direct Linear Transform (DLT) Projective Homography with sub-pixel
 * bilinear interpolation, Web Worker execution, intelligent edge detection,
 * aspect ratio normalization presets (A4, Letter, ID-1, CR80), and non-destructive storage.
 */

import {
  OmniPage,
  PerspectiveQuad,
  PerspectiveCorner,
  PerspectivePreset,
  PerspectivePresetDefinition,
  PerspectiveDetectionCandidate,
  Point,
} from "../types";
import { loadImage } from "./vision";
import { pageBlobStore } from "../services/storage/PageBlobStore";
import {
  warpPerspectiveAsync,
  detectDocumentQuadAsync,
  calculateDeskewAsync,
} from "../workers/filterWorkerPool";
import {
  executePerspectiveWarpBuffer,
  detectDocumentQuadFromBuffer,
} from "./pixelCore";

export const PERSPECTIVE_PRESETS: PerspectivePresetDefinition[] = [
  {
    id: "natural",
    name: "Natural / Auto",
    aspectRatio: null,
    description: "Dimensions calculated dynamically from quadrilateral edge lengths",
  },
  {
    id: "a4",
    name: "A4 Document",
    widthMm: 210,
    heightMm: 297,
    aspectRatio: 210 / 297,
    description: "International Standard ISO 216 (210 × 297 mm, 1:1.414)",
  },
  {
    id: "letter",
    name: "US Letter",
    widthInches: 8.5,
    heightInches: 11,
    aspectRatio: 8.5 / 11,
    description: "Standard North American Document (8.5 × 11 in)",
  },
  {
    id: "legal",
    name: "US Legal",
    widthInches: 8.5,
    heightInches: 14,
    aspectRatio: 8.5 / 14,
    description: "Legal Contract Standard (8.5 × 14 in)",
  },
  {
    id: "id-card",
    name: "ID-1 / Driver License / Card",
    widthMm: 85.6,
    heightMm: 53.98,
    aspectRatio: 85.6 / 53.98,
    description: "ISO/IEC 7810 ID-1 standard (85.6 × 53.98 mm, 1.586:1)",
  },
  {
    id: "business-card",
    name: "Business Card",
    widthInches: 3.5,
    heightInches: 2.0,
    aspectRatio: 3.5 / 2.0,
    description: "Standard Business Card (3.5 × 2.0 in, 1.75:1)",
  },
  {
    id: "photo-4x6",
    name: "4 × 6\" Photo",
    widthInches: 4,
    heightInches: 6,
    aspectRatio: 4 / 6,
    description: "Standard Photographic Print (2:3)",
  },
  {
    id: "square",
    name: "Square (1:1)",
    aspectRatio: 1.0,
    description: "Equal width and height (1:1)",
  },
  {
    id: "custom",
    name: "Custom",
    aspectRatio: null,
    description: "Freeform dimensions or custom fixed ratio",
  },
];

/**
 * Calculates the natural (unconstrained) pixel dimensions of a quadrilateral
 * based on the average lengths of opposing edges.
 */
export function calculateNaturalQuadDimensions(
  srcW: number,
  srcH: number,
  quad: PerspectiveQuad
): { width: number; height: number; naturalRatio: number } {
  const isNormalized =
    Math.max(
      Math.abs(quad.topLeft.x),
      Math.abs(quad.topRight.x),
      Math.abs(quad.bottomRight.x),
      Math.abs(quad.bottomLeft.x),
      Math.abs(quad.topLeft.y),
      Math.abs(quad.topRight.y),
      Math.abs(quad.bottomRight.y),
      Math.abs(quad.bottomLeft.y)
    ) <= 1.5;

  const p0 = {
    x: isNormalized ? quad.topLeft.x * srcW : quad.topLeft.x,
    y: isNormalized ? quad.topLeft.y * srcH : quad.topLeft.y,
  };
  const p1 = {
    x: isNormalized ? quad.topRight.x * srcW : quad.topRight.x,
    y: isNormalized ? quad.topRight.y * srcH : quad.topRight.y,
  };
  const p2 = {
    x: isNormalized ? quad.bottomRight.x * srcW : quad.bottomRight.x,
    y: isNormalized ? quad.bottomRight.y * srcH : quad.bottomRight.y,
  };
  const p3 = {
    x: isNormalized ? quad.bottomLeft.x * srcW : quad.bottomLeft.x,
    y: isNormalized ? quad.bottomLeft.y * srcH : quad.bottomLeft.y,
  };

  const topW = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  const botW = Math.hypot(p2.x - p3.x, p2.y - p3.y);
  const leftH = Math.hypot(p3.x - p0.x, p3.y - p0.y);
  const rightH = Math.hypot(p2.x - p1.x, p2.y - p1.y);

  const naturalW = Math.max(64, Math.round((topW + botW) / 2));
  const naturalH = Math.max(64, Math.round((leftH + rightH) / 2));
  const naturalRatio = naturalW / naturalH;

  return { width: naturalW, height: naturalH, naturalRatio };
}

/**
 * Computes optimal target output pixel dimensions (W, H) taking into account
 * preset aspect ratio constraints (e.g. A4, Letter, ID-1, CR80) while preserving native resolution.
 */
export function calculateTargetDimensions(
  srcW: number,
  srcH: number,
  quad: PerspectiveQuad,
  targetAspectRatio?: number | null
): { targetW: number; targetH: number } {
  const { width: natW, height: natH } = calculateNaturalQuadDimensions(srcW, srcH, quad);

  if (!targetAspectRatio || targetAspectRatio <= 0) {
    return { targetW: natW, targetH: natH };
  }

  const currentRatio = natW / natH;
  let targetW = natW;
  let targetH = natH;

  if (currentRatio > targetAspectRatio) {
    // Current is wider than target ratio: adjust width to fit height
    targetW = Math.max(64, Math.round(natH * targetAspectRatio));
  } else {
    // Current is taller than target ratio: adjust height to fit width
    targetH = Math.max(64, Math.round(natW / targetAspectRatio));
  }

  return { targetW, targetH };
}

/**
 * Calculates internal Rule-of-Thirds (3x3) perspective grid lines
 * for visual alignment display inside the interactive quadrilateral overlay.
 */
export function calculatePerspectiveGridLines(quad: PerspectiveQuad): {
  verticalLines: Array<{ start: Point; end: Point }>;
  horizontalLines: Array<{ start: Point; end: Point }>;
} {
  const lerp = (a: Point, b: Point, t: number): Point => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  });

  const { topLeft: tl, topRight: tr, bottomRight: br, bottomLeft: bl } = quad;

  // 2 Vertical Lines (at t = 1/3 and t = 2/3 between top and bottom edges)
  const verticalLines = [1 / 3, 2 / 3].map((t) => ({
    start: lerp(tl, tr, t),
    end: lerp(bl, br, t),
  }));

  // 2 Horizontal Lines (at s = 1/3 and s = 2/3 between left and right edges)
  const horizontalLines = [1 / 3, 2 / 3].map((s) => ({
    start: lerp(tl, bl, s),
    end: lerp(tr, br, s),
  }));

  return { verticalLines, horizontalLines };
}

import { getAutoFeatureSettings } from "../services/settings/autoFeatureSettings";

/**
 * Automatically detects document edge boundaries from an image URL or base64 data.
 * Offloads heavy edge gradient analysis to Web Worker to avoid blocking UI.
 */
export async function detectDocumentPerspective(
  sourceUrl: string
): Promise<{
  quad: PerspectiveQuad;
  confidence: number;
  candidates: PerspectiveDetectionCandidate[];
}> {
  const fallback: PerspectiveQuad = {
    topLeft: { x: 0.03, y: 0.03 },
    topRight: { x: 0.97, y: 0.03 },
    bottomRight: { x: 0.97, y: 0.97 },
    bottomLeft: { x: 0.03, y: 0.97 },
  };

  const settings = getAutoFeatureSettings();
  if (!settings.autoEdgeDetection) {
    return {
      quad: fallback,
      confidence: 0,
      candidates: [],
    };
  }

  try {
    const img = await loadImage(sourceUrl);
    const canvas = document.createElement("canvas");
    // Standardize analysis size (max dim 480) for high speed and noise reduction
    const maxDim = 480;
    const scale = Math.min(1.0, maxDim / Math.max(img.width, img.height));
    canvas.width = Math.max(64, Math.round(img.width * scale));
    canvas.height = Math.max(64, Math.round(img.height * scale));

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Could not create canvas context for edge detection");

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Run in Web Worker pool
    const result = await detectDocumentQuadAsync(
      imgData.data,
      canvas.width,
      canvas.height
    );

    return result;
  } catch (err) {
    console.warn("Perspective detection failed, returning safe fallback quad:", err);
    const fallback: PerspectiveQuad = {
      topLeft: { x: 0.03, y: 0.03 },
      topRight: { x: 0.97, y: 0.03 },
      bottomRight: { x: 0.97, y: 0.97 },
      bottomLeft: { x: 0.03, y: 0.97 },
      preset: "natural",
    };
    return {
      quad: fallback,
      confidence: 0.25,
      candidates: [
        {
          id: "cand-default",
          label: "Full Frame Inset",
          quad: fallback,
          confidence: 0.25,
          areaFraction: 0.94,
        },
      ],
    };
  }
}

export interface PerspectiveWarpOptions {
  targetAspectRatio?: number | null;
  targetPreset?: PerspectivePreset;
  fineDeskew?: boolean;
  mimeType?: "image/png" | "image/jpeg";
  quality?: number;
}

/**
 * Executes a full-resolution perspective warp on an image URL, transforming the quadrilateral
 * defined by the 4 corners into a planar flattened rectangular image.
 */
export async function executePerspectiveWarp(
  sourceUrl: string,
  quad: PerspectiveQuad,
  options: PerspectiveWarpOptions = {}
): Promise<{
  dataUrl: string;
  width: number;
  height: number;
  deskewAngleApplied?: number;
}> {
  console.log("[PerspectiveEngine] executePerspectiveWarp called with quad:", JSON.stringify(quad), { options });
  const img = await loadImage(sourceUrl);
  const srcW = img.width;
  const srcH = img.height;

  // Calculate destination rectangle dimensions
  const { targetW, targetH } = calculateTargetDimensions(
    srcW,
    srcH,
    quad,
    options.targetAspectRatio
  );

  // Extract source pixel data
  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = srcW;
  srcCanvas.height = srcH;
  const srcCtx = srcCanvas.getContext("2d", { willReadFrequently: true });
  if (!srcCtx) throw new Error("Failed to allocate canvas for source image");

  srcCtx.drawImage(img, 0, 0);
  const srcImageData = srcCtx.getImageData(0, 0, srcW, srcH);

  // Perform Homography Warp via Web Worker Pool
  const warpedBuffer = await warpPerspectiveAsync(
    srcImageData.data,
    srcW,
    srcH,
    quad,
    targetW,
    targetH
  );

  // Render Warped Result to Destination Canvas
  const dstCanvas = document.createElement("canvas");
  dstCanvas.width = targetW;
  dstCanvas.height = targetH;
  const dstCtx = dstCanvas.getContext("2d");
  if (!dstCtx) throw new Error("Failed to allocate destination canvas");

  const dstImageData = new ImageData(
    new Uint8ClampedArray(warpedBuffer),
    targetW,
    targetH
  );
  dstCtx.putImageData(dstImageData, 0, 0);

  let finalCanvas = dstCanvas;
  let deskewAngleApplied: number | undefined;

  // Secondary Fine Deskew Pass: check if residual angle exists
  if (options.fineDeskew) {
    try {
      const angle = await calculateDeskewAsync(
        new Uint8ClampedArray(warpedBuffer),
        targetW,
        targetH
      );
      if (Math.abs(angle) >= 0.35 && Math.abs(angle) <= 15) {
        deskewAngleApplied = angle;
        const deskewCanvas = document.createElement("canvas");
        deskewCanvas.width = targetW;
        deskewCanvas.height = targetH;
        const deskewCtx = deskewCanvas.getContext("2d");
        if (deskewCtx) {
          deskewCtx.save();
          deskewCtx.translate(targetW / 2, targetH / 2);
          deskewCtx.rotate((angle * Math.PI) / 180);
          deskewCtx.drawImage(dstCanvas, -targetW / 2, -targetH / 2);
          deskewCtx.restore();
          finalCanvas = deskewCanvas;
        }
      }
    } catch (deskewErr) {
      console.warn("Secondary deskew pass skipped:", deskewErr);
    }
  }

  const mimeType = options.mimeType || "image/png";
  const quality = options.quality ?? 0.95;
  const dataUrl = finalCanvas.toDataURL(mimeType, quality);

  return {
    dataUrl,
    width: finalCanvas.width,
    height: finalCanvas.height,
    deskewAngleApplied,
  };
}

/**
 * Non-destructive perspective warp execution on an OmniPage.
 * Updates original and processed data URLs / Blobs, updates dimensions,
 * sets thumbnail, preserves perspectiveQuad in page state, and marks page modified.
 */
export async function warpPagePerspective(
  page: OmniPage,
  quad: PerspectiveQuad,
  options: PerspectiveWarpOptions = {}
): Promise<OmniPage> {
  const sourceUrl =
    page.processedDataUrl ||
    page.originalDataUrl ||
    (await pageBlobStore.resolvePageUrl(page, "processed")) ||
    (await pageBlobStore.resolvePageUrl(page, "original"));

  if (!sourceUrl) {
    throw new Error(`Cannot warp perspective: Page ${page.id} has no source image.`);
  }

  const { dataUrl, width, height, deskewAngleApplied } = await executePerspectiveWarp(
    sourceUrl,
    quad,
    options
  );

  // Generate thumbnail
  const thumbCanvas = document.createElement("canvas");
  const thumbScale = Math.min(1, 240 / Math.max(width, height));
  thumbCanvas.width = Math.max(1, Math.round(width * thumbScale));
  thumbCanvas.height = Math.max(1, Math.round(height * thumbScale));
  const thumbCtx = thumbCanvas.getContext("2d");
  if (thumbCtx) {
    const tempImg = await loadImage(dataUrl);
    thumbCtx.drawImage(tempImg, 0, 0, thumbCanvas.width, thumbCanvas.height);
  }
  const thumbnailDataUrl = thumbCanvas.toDataURL("image/jpeg", 0.75);

  const updatedPage: OmniPage = {
    ...page,
    originalDataUrl: dataUrl,
    processedDataUrl: dataUrl,
    thumbnailDataUrl,
    width,
    height,
    sizeBytes: Math.round(dataUrl.length * 0.75),
    perspectiveQuad: quad,
    isModified: true,
    lastModifiedAt: new Date().toISOString(),
    filters: {
      ...page.filters,
      rotation: 0,
      deskewAngle: 0,
      cropBox: undefined,
    },
  };

  // Ensure Blob storage synchronization
  try {
    const migrated = await pageBlobStore.migratePageToBlobs(updatedPage);
    return migrated;
  } catch {
    return updatedPage;
  }
}

/**
 * High-performance fast preview rendering for live drag interaction.
 * Uses a downscaled representation to achieve 60fps update rate.
 */
export function renderFastPerspectivePreviewSync(
  sourceCanvasOrImg: HTMLCanvasElement | HTMLImageElement,
  quad: PerspectiveQuad,
  maxPreviewDim = 400
): string {
  const srcW = sourceCanvasOrImg.width;
  const srcH = sourceCanvasOrImg.height;

  // Compute preview dimensions
  const scale = Math.min(1.0, maxPreviewDim / Math.max(srcW, srcH));
  const previewSrcW = Math.max(32, Math.round(srcW * scale));
  const previewSrcH = Math.max(32, Math.round(srcH * scale));

  const offscreen = document.createElement("canvas");
  offscreen.width = previewSrcW;
  offscreen.height = previewSrcH;
  const offCtx = offscreen.getContext("2d");
  if (!offCtx) return "";

  offCtx.drawImage(sourceCanvasOrImg, 0, 0, previewSrcW, previewSrcH);
  const srcData = offCtx.getImageData(0, 0, previewSrcW, previewSrcH);

  const { targetW: natW, targetH: natH } = calculateTargetDimensions(
    previewSrcW,
    previewSrcH,
    quad,
    quad.targetAspectRatio
  );

  const warped = executePerspectiveWarpBuffer(
    srcData.data,
    previewSrcW,
    previewSrcH,
    quad,
    natW,
    natH
  );

  const dstCanvas = document.createElement("canvas");
  dstCanvas.width = natW;
  dstCanvas.height = natH;
  const dstCtx = dstCanvas.getContext("2d");
  if (!dstCtx) return "";

  dstCtx.putImageData(new ImageData(warped, natW, natH), 0, 0);
  return dstCanvas.toDataURL("image/jpeg", 0.75);
}
