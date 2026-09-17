/**
 * OMNISCAN TITAN X - Physical Image & Page Rotation Engine
 * Applies true physical 2D canvas transforms to image data and persists the result
 * to PageBlobStore with updated dimensions (swapping width and height for 90°/270°).
 * Resets filters.rotation to 0 to prevent double-rotation bugs.
 */

import { OmniPage } from "../types";
import { pageBlobStore } from "../services/storage/PageBlobStore";
import { loadImage } from "./vision";

export interface RotateImageDataResult {
  blob: Blob;
  dataUrl: string;
  newWidth: number;
  newHeight: number;
}

/**
 * Physically rotates image data by 0, 90, 180, or 270 degrees.
 * Resizes the canvas to match the rotated bounds (swapping width and height for 90°/270°).
 * Returns the rotated Blob, DataURL, and new dimensions.
 */
export async function rotateImageData(
  sourceBlobIdOrUrl: string,
  angleDeg: 0 | 90 | 180 | 270 | number
): Promise<RotateImageDataResult> {
  const normAngle = ((Math.round(angleDeg) % 360) + 360) % 360;

  // Resolve source URL: if it looks like a blobId or has no protocol/data prefix, try pageBlobStore
  let sourceUrl = sourceBlobIdOrUrl;
  if (
    sourceBlobIdOrUrl &&
    !sourceBlobIdOrUrl.startsWith("data:") &&
    !sourceBlobIdOrUrl.startsWith("blob:") &&
    !sourceBlobIdOrUrl.startsWith("http")
  ) {
    const resolved = await pageBlobStore.resolveUrl(sourceBlobIdOrUrl);
    if (resolved) {
      sourceUrl = resolved;
    }
  }

  if (!sourceUrl) {
    throw new Error("Cannot rotate image: missing source URL or blob ID");
  }

  // 1. Load source image
  const img = await loadImage(sourceUrl);
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;

  // 2. Calculate new canvas dimensions (dimensions MUST swap for 90°/270°)
  const swap = normAngle === 90 || normAngle === 270;
  const newWidth = swap ? srcH : srcW;
  const newHeight = swap ? srcW : srcH;

  // 3. Create correctly-sized canvas
  const canvas = document.createElement("canvas");
  canvas.width = newWidth;
  canvas.height = newHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("Failed to allocate 2D canvas context for rotation");
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // 4. Apply rotation transform around new canvas center
  ctx.translate(newWidth / 2, newHeight / 2);
  ctx.rotate((normAngle * Math.PI) / 180);
  ctx.drawImage(img, -srcW / 2, -srcH / 2);

  // 5. Export as blob & dataUrl
  const dataUrl = canvas.toDataURL("image/png");
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error("Failed to serialize rotated canvas to blob"));
    }, "image/png");
  });

  return { blob, dataUrl, newWidth, newHeight };
}

/**
 * Transforms a normalized bounding box (x, y, width, height in 0..1 space)
 * according to clockwise rotation angle (90°, 180°, 270°).
 */
export function rotateNormalizedBox(
  box: { x: number; y: number; width: number; height: number },
  angleDeg: number
): { x: number; y: number; width: number; height: number } {
  const angle = ((Math.round(angleDeg) % 360) + 360) % 360;
  const { x, y, width, height } = box;

  if (angle === 90) {
    const newX = 1 - y - height;
    const newY = x;
    return {
      x: Math.max(0, Math.min(1, Number(newX.toFixed(4)))),
      y: Math.max(0, Math.min(1, Number(newY.toFixed(4)))),
      width: Math.max(0.001, Math.min(1, Number(height.toFixed(4)))),
      height: Math.max(0.001, Math.min(1, Number(width.toFixed(4)))),
    };
  } else if (angle === 180) {
    const newX = 1 - x - width;
    const newY = 1 - y - height;
    return {
      x: Math.max(0, Math.min(1, Number(newX.toFixed(4)))),
      y: Math.max(0, Math.min(1, Number(newY.toFixed(4)))),
      width: Math.max(0.001, Math.min(1, Number(width.toFixed(4)))),
      height: Math.max(0.001, Math.min(1, Number(height.toFixed(4)))),
    };
  } else if (angle === 270) {
    const newX = y;
    const newY = 1 - x - width;
    return {
      x: Math.max(0, Math.min(1, Number(newX.toFixed(4)))),
      y: Math.max(0, Math.min(1, Number(newY.toFixed(4)))),
      width: Math.max(0.001, Math.min(1, Number(height.toFixed(4)))),
      height: Math.max(0.001, Math.min(1, Number(width.toFixed(4)))),
    };
  }
  return box;
}

/**
 * Performs a physical, lossless geometry rotation on an OmniPage.
 * Rotates both processed and original image data, stores new blobs in PageBlobStore,
 * updates page dimensions (swapping width and height for 90°/270°), generates a new thumbnail,
 * rotates annotations/redactions, and resets filters.rotation to 0 to prevent double-rotation.
 */
export async function rotatePagePhysical(
  page: OmniPage,
  degrees: number
): Promise<OmniPage> {
  const normAngle = ((Math.round(degrees) % 360) + 360) % 360;
  if (normAngle === 0) return page;

  // 1. Resolve source image for processed view
  const processedSource =
    page.processedDataUrl ||
    (page.processedBlobId ? await pageBlobStore.resolveUrl(page.processedBlobId) : "") ||
    (await pageBlobStore.resolvePageUrl(page, "processed")) ||
    page.originalDataUrl ||
    (await pageBlobStore.resolvePageUrl(page, "original"));

  if (!processedSource) {
    throw new Error(`Cannot rotate page ${page.id}: missing source image.`);
  }

  // 2. Rotate processed image
  const rotatedProcessed = await rotateImageData(processedSource, normAngle);

  // 3. Resolve and rotate original image if distinct, so future filter edits stay upright
  const originalSource =
    page.originalDataUrl ||
    (page.originalBlobId ? await pageBlobStore.resolveUrl(page.originalBlobId) : "") ||
    (await pageBlobStore.resolvePageUrl(page, "original"));

  let rotatedOriginal = rotatedProcessed;
  if (originalSource && originalSource !== processedSource) {
    try {
      rotatedOriginal = await rotateImageData(originalSource, normAngle);
    } catch {
      rotatedOriginal = rotatedProcessed;
    }
  }

  // 4. Save new binary blobs to PageBlobStore with new unique IDs
  const newProcessedBlobId = await pageBlobStore.saveBlob(
    page.id,
    "processed",
    rotatedProcessed.blob
  );
  const newOriginalBlobId = await pageBlobStore.saveBlob(
    page.id,
    "original",
    rotatedOriginal.blob
  );

  // 5. Generate high-quality thumbnail matching new dimensions
  const thumbScale = Math.min(1, 240 / Math.max(rotatedProcessed.newWidth, rotatedProcessed.newHeight));
  const thumbW = Math.max(1, Math.round(rotatedProcessed.newWidth * thumbScale));
  const thumbH = Math.max(1, Math.round(rotatedProcessed.newHeight * thumbScale));
  const thumbCanvas = document.createElement("canvas");
  thumbCanvas.width = thumbW;
  thumbCanvas.height = thumbH;
  const thumbCtx = thumbCanvas.getContext("2d");
  if (thumbCtx) {
    const tempImg = await loadImage(rotatedProcessed.dataUrl);
    thumbCtx.drawImage(tempImg, 0, 0, thumbW, thumbH);
  }
  const thumbnailDataUrl = thumbCanvas.toDataURL("image/jpeg", 0.75);

  // 6. Transform vector annotations and redactions into the new rotated coordinate space
  const rotatedAnnotations = (page.annotations || []).map((ann) => {
    const transformed = rotateNormalizedBox(ann, normAngle);
    return { ...ann, ...transformed };
  });

  const rotatedRedactions = (page.redactions || []).map((red) => {
    const transformed = rotateNormalizedBox(red, normAngle);
    return { ...red, ...transformed };
  });

  // 7. Assemble updated page with swapped dimensions and reset rotation filter
  const updatedPage: OmniPage = {
    ...page,
    width: rotatedProcessed.newWidth,
    height: rotatedProcessed.newHeight,
    processedBlobId: newProcessedBlobId,
    originalBlobId: newOriginalBlobId,
    processedDataUrl: "", // Cleared in React state to save heap, persisted in IndexedDB
    originalDataUrl: "",
    thumbnailDataUrl,
    filters: {
      ...page.filters,
      rotation: 0, // CRITICAL: Reset to 0 after physical rotation is applied
      deskewAngle: 0,
      cropBox: undefined,
    },
    annotations: rotatedAnnotations,
    redactions: rotatedRedactions,
    perspectiveQuad: undefined,
    isModified: true,
    lastModifiedAt: new Date().toISOString(),
  };

  return updatedPage;
}
