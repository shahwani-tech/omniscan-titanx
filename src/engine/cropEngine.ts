/**
 * OMNISCAN TITAN X - Professional PDF Page Crop Engine
 * Real Physical PDF Page Geometry, Multi-Unit Conversions, Non-Destructive Transformations
 */

import { OmniPage, Point } from "../types";
import { loadImage } from "./vision";

export type CropUnit = "mm" | "cm" | "inch" | "px" | "pt";

export interface NormalizedCropBox {
  x: number; // 0 to 1 (from left)
  y: number; // 0 to 1 (from top)
  width: number; // 0 to 1
  height: number; // 0 to 1
}

export type StandardCropPreset =
  | "free"
  | "original"
  | "a4"
  | "a5"
  | "a6"
  | "letter"
  | "legal"
  | "photo-4x6"
  | "custom";

export interface CropPresetDefinition {
  id: StandardCropPreset;
  name: string;
  widthMm?: number;
  heightMm?: number;
  widthInches?: number;
  heightInches?: number;
  aspectRatio?: number; // width / height
  description: string;
}

export const CROP_PRESETS: CropPresetDefinition[] = [
  { id: "free", name: "Free Crop", description: "Unconstrained custom crop boundary" },
  { id: "original", name: "Original Ratio", description: "Lock to original page aspect ratio" },
  { id: "a4", name: "A4", widthMm: 210, heightMm: 297, aspectRatio: 210 / 297, description: "ISO 216 standard (210 × 297 mm)" },
  { id: "a5", name: "A5", widthMm: 148, heightMm: 210, aspectRatio: 148 / 210, description: "Half A4 (148 × 210 mm)" },
  { id: "a6", name: "A6", widthMm: 105, heightMm: 148, aspectRatio: 105 / 148, description: "Pocket size (105 × 148 mm)" },
  { id: "letter", name: "US Letter", widthInches: 8.5, heightInches: 11, aspectRatio: 8.5 / 11, description: "Standard US Letter (8.5 × 11 in)" },
  { id: "legal", name: "US Legal", widthInches: 8.5, heightInches: 14, aspectRatio: 8.5 / 14, description: "Standard US Legal (8.5 × 14 in)" },
  { id: "photo-4x6", name: "4 × 6 Photo", widthInches: 4, heightInches: 6, aspectRatio: 4 / 6, description: "Standard Photo print (4 × 6 in)" },
  { id: "custom", name: "Custom Size", description: "Specify explicit width, height and unit" },
];

export interface CropMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
  equal: boolean;
  unit: CropUnit;
}

/**
 * Unit conversions to and from Pixels based on Page DPI
 */
export function convertUnitToPixels(value: number, unit: CropUnit, dpi: number = 300): number {
  switch (unit) {
    case "px":
      return value;
    case "inch":
      return value * dpi;
    case "mm":
      return (value / 25.4) * dpi;
    case "cm":
      return (value / 2.54) * dpi;
    case "pt":
      return (value / 72) * dpi;
  }
}

export function convertPixelsToUnit(pixels: number, unit: CropUnit, dpi: number = 300): number {
  switch (unit) {
    case "px":
      return Math.round(pixels);
    case "inch":
      return Number((pixels / dpi).toFixed(2));
    case "mm":
      return Number(((pixels / dpi) * 25.4).toFixed(1));
    case "cm":
      return Number(((pixels / dpi) * 2.54).toFixed(2));
    case "pt":
      return Number(((pixels / dpi) * 72).toFixed(1));
  }
}

/**
 * Format dimension string for display
 */
export function formatDimension(pixels: number, unit: CropUnit, dpi: number = 300): string {
  const val = convertPixelsToUnit(pixels, unit, dpi);
  return `${val} ${unit}`;
}

/**
 * Get standard aspect ratio for a preset matching page orientation
 */
export function getPresetAspectRatio(
  preset: StandardCropPreset,
  pageWidth: number,
  pageHeight: number
): number | null {
  const isLandscape = pageWidth > pageHeight;

  switch (preset) {
    case "free":
      return null;
    case "original":
      return pageWidth / pageHeight;
    case "a4":
      return isLandscape ? 297 / 210 : 210 / 297;
    case "a5":
      return isLandscape ? 210 / 148 : 148 / 210;
    case "a6":
      return isLandscape ? 148 / 105 : 105 / 148;
    case "letter":
      return isLandscape ? 11 / 8.5 : 8.5 / 11;
    case "legal":
      return isLandscape ? 14 / 8.5 : 8.5 / 14;
    case "photo-4x6":
      return isLandscape ? 6 / 4 : 4 / 6;
    case "custom":
      return null;
  }
}

/**
 * Fit a target aspect ratio inside the page boundary, centered
 */
export function fitAspectRatioInPage(
  targetRatio: number,
  pageWidth: number,
  pageHeight: number,
  paddingPercent: number = 0.05
): NormalizedCropBox {
  const maxNormW = 1 - paddingPercent * 2;
  const maxNormH = 1 - paddingPercent * 2;
  const pageRatio = pageWidth / pageHeight;

  let normW = maxNormW;
  let normH = normW * (pageRatio / targetRatio);

  if (normH > maxNormH) {
    normH = maxNormH;
    normW = normH * (targetRatio / pageRatio);
  }

  const normX = (1 - normW) / 2;
  const normY = (1 - normH) / 2;

  return {
    x: Math.max(0, Math.min(1 - normW, normX)),
    y: Math.max(0, Math.min(1 - normH, normY)),
    width: Math.min(1, Math.max(0.05, normW)),
    height: Math.min(1, Math.max(0.05, normH)),
  };
}

/**
 * Calculate crop box from margins
 */
export function cropBoxFromMargins(
  margins: CropMargins,
  pageWidth: number,
  pageHeight: number,
  dpi: number = 300
): NormalizedCropBox {
  const topPx = convertUnitToPixels(margins.top, margins.unit, dpi);
  const bottomPx = convertUnitToPixels(margins.bottom, margins.unit, dpi);
  const leftPx = convertUnitToPixels(margins.left, margins.unit, dpi);
  const rightPx = convertUnitToPixels(margins.right, margins.unit, dpi);

  const cropPixelX = Math.max(0, leftPx);
  const cropPixelY = Math.max(0, topPx);
  const cropPixelW = Math.max(20, pageWidth - leftPx - rightPx);
  const cropPixelH = Math.max(20, pageHeight - topPx - bottomPx);

  return {
    x: cropPixelX / pageWidth,
    y: cropPixelY / pageHeight,
    width: Math.min(1 - cropPixelX / pageWidth, cropPixelW / pageWidth),
    height: Math.min(1 - cropPixelY / pageHeight, cropPixelH / pageHeight),
  };
}

/**
 * Calculate margins from a normalized crop box
 */
export function marginsFromCropBox(
  cropBox: NormalizedCropBox,
  pageWidth: number,
  pageHeight: number,
  unit: CropUnit,
  dpi: number = 300
): CropMargins {
  const topPx = cropBox.y * pageHeight;
  const leftPx = cropBox.x * pageWidth;
  const bottomPx = (1 - (cropBox.y + cropBox.height)) * pageHeight;
  const rightPx = (1 - (cropBox.x + cropBox.width)) * pageWidth;

  const top = convertPixelsToUnit(topPx, unit, dpi);
  const left = convertPixelsToUnit(leftPx, unit, dpi);
  const bottom = convertPixelsToUnit(bottomPx, unit, dpi);
  const right = convertPixelsToUnit(rightPx, unit, dpi);

  const equal = Math.abs(top - left) < 0.2 && Math.abs(top - bottom) < 0.2 && Math.abs(top - right) < 0.2;

  return { top, right, bottom, left, equal, unit };
}

/**
 * Intelligent Document Content / Contour Detection for Auto-Crop
 */
export async function detectAutoCropBounds(dataUrl: string): Promise<NormalizedCropBox> {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  const w = Math.min(800, img.width);
  const h = Math.min(1000, img.height);
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return { x: 0.05, y: 0.05, width: 0.9, height: 0.9 };
  }

  ctx.drawImage(img, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Find bounding box of content with luminance threshold
  let minX = w;
  let maxX = 0;
  let minY = h;
  let maxY = 0;

  // Background sample from 4 corners
  const sampleCorners = [
    data[0] * 0.299 + data[1] * 0.587 + data[2] * 0.114,
    data[(w - 1) * 4] * 0.299 + data[(w - 1) * 4 + 1] * 0.587 + data[(w - 1) * 4 + 2] * 0.114,
    data[(h - 1) * w * 4] * 0.299 + data[(h - 1) * w * 4 + 1] * 0.587 + data[(h - 1) * w * 4 + 2] * 0.114,
    data[((h - 1) * w + w - 1) * 4] * 0.299 + data[((h - 1) * w + w - 1) * 4 + 1] * 0.587 + data[((h - 1) * w + w - 1) * 4 + 2] * 0.114,
  ];
  const avgBgLum = sampleCorners.reduce((a, b) => a + b, 0) / 4;
  const isLightBg = avgBgLum > 128;
  const lumThreshold = isLightBg ? Math.min(230, avgBgLum - 25) : Math.max(30, avgBgLum + 25);

  let foundContent = false;

  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const idx = (y * w + x) * 4;
      const lum = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
      const isContent = isLightBg ? lum < lumThreshold : lum > lumThreshold;

      if (isContent) {
        foundContent = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!foundContent || maxX <= minX || maxY <= minY) {
    return { x: 0.05, y: 0.05, width: 0.9, height: 0.9 };
  }

  // Add 2.5% safe margin around detected content
  const marginX = w * 0.025;
  const marginY = h * 0.025;

  const finalMinX = Math.max(0, minX - marginX);
  const finalMinY = Math.max(0, minY - marginY);
  const finalMaxX = Math.min(w, maxX + marginX);
  const finalMaxY = Math.min(h, maxY + marginY);

  return {
    x: finalMinX / w,
    y: finalMinY / h,
    width: Math.min(1 - finalMinX / w, (finalMaxX - finalMinX) / w),
    height: Math.min(1 - finalMinY / h, (finalMaxY - finalMinY) / h),
  };
}

/**
 * Execute lossless high-precision physical PDF page crop on an OmniPage
 */
export async function executePhysicalPageCrop(
  page: OmniPage,
  cropBox: NormalizedCropBox
): Promise<OmniPage> {
  const sourceImage = await loadImage(page.processedDataUrl || page.originalDataUrl);

  const srcW = sourceImage.width;
  const srcH = sourceImage.height;

  const cropX = Math.max(0, Math.floor(cropBox.x * srcW));
  const cropY = Math.max(0, Math.floor(cropBox.y * srcH));
  const cropW = Math.min(srcW - cropX, Math.max(10, Math.floor(cropBox.width * srcW)));
  const cropH = Math.min(srcH - cropY, Math.max(10, Math.floor(cropBox.height * srcH)));

  // 1. Create Cropped High-Res Canvas
  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = cropW;
  cropCanvas.height = cropH;

  const ctx = cropCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Failed to allocate 2D canvas for crop");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(sourceImage, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

  const croppedDataUrl = cropCanvas.toDataURL("image/png");

  // 2. Create Thumbnail
  const thumbCanvas = document.createElement("canvas");
  const thumbScale = Math.min(1, 240 / Math.max(cropW, cropH));
  thumbCanvas.width = Math.max(1, Math.round(cropW * thumbScale));
  thumbCanvas.height = Math.max(1, Math.round(cropH * thumbScale));
  const thumbCtx = thumbCanvas.getContext("2d");
  if (thumbCtx) {
    thumbCtx.drawImage(cropCanvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
  }
  const thumbnailDataUrl = thumbCanvas.toDataURL("image/jpeg", 0.75);

  // 3. Transform Annotations and Redactions into the new cropped coordinate space
  const transformedAnnotations = (page.annotations || [])
    .map((ann) => {
      const relX = (ann.x - cropBox.x) / cropBox.width;
      const relY = (ann.y - cropBox.y) / cropBox.height;
      const relW = ann.width / cropBox.width;
      const relH = ann.height / cropBox.height;

      // Skip if completely outside
      if (relX + relW < 0 || relX > 1 || relY + relH < 0 || relY > 1) {
        return null;
      }

      return {
        ...ann,
        x: Math.max(0, Math.min(1, relX)),
        y: Math.max(0, Math.min(1, relY)),
        width: Math.min(1 - Math.max(0, relX), relW),
        height: Math.min(1 - Math.max(0, relY), relH),
      };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);

  const transformedRedactions = (page.redactions || [])
    .map((red) => {
      const relX = (red.x - cropBox.x) / cropBox.width;
      const relY = (red.y - cropBox.y) / cropBox.height;
      const relW = red.width / cropBox.width;
      const relH = red.height / cropBox.height;

      if (relX + relW < 0 || relX > 1 || relY + relH < 0 || relY > 1) {
        return null;
      }

      return {
        ...red,
        x: Math.max(0, Math.min(1, relX)),
        y: Math.max(0, Math.min(1, relY)),
        width: Math.min(1 - Math.max(0, relX), relW),
        height: Math.min(1 - Math.max(0, relY), relH),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  return {
    ...page,
    width: cropW,
    height: cropH,
    originalDataUrl: croppedDataUrl,
    processedDataUrl: croppedDataUrl,
    thumbnailDataUrl: thumbnailDataUrl,
    filters: {
      ...page.filters,
      rotation: 0,
      deskewAngle: 0,
    },
    annotations: transformedAnnotations,
    redactions: transformedRedactions,
    isModified: true,
    lastModifiedAt: new Date().toISOString(),
  };
}
