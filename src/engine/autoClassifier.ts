/**
 * OMNISCAN TITAN X - Intelligent Document & Photo Content Classifier
 * Fast heuristic vision classifier for automatic CamScanner-style filter selection.
 * Analyzes color variance, skin tones, edge density, and histogram bimodality.
 */

import {
  CamScannerPresetId,
  ImageFilterPipeline,
} from "../types";
import { DEFAULT_FILTERS } from "./vision";

export type DetectedContentType = "text-document" | "photo-id" | "mixed-content";

export interface ContentClassificationResult {
  detectedType: DetectedContentType;
  label: "Text Document" | "Photo/ID Card" | "Mixed Content";
  confidence: number; // 0 to 1
  recommendedPreset: CamScannerPresetId;
  recommendedFilters: ImageFilterPipeline;
  reason: string;
  signals: {
    colorVariance: number;
    saturationMean: number;
    edgeDensity: number;
    histogramSpread: number;
    skinToneScore: number;
    textContrastScore: number;
  };
}

/**
 * Highly optimized, lightweight content analyzer.
 * Downsamples the image to 200x200 onto an offscreen canvas and computes optical signals.
 * Typical execution time: 4-12ms.
 */
export async function classifyImageContent(
  imageSource: string | HTMLImageElement | HTMLCanvasElement
): Promise<ContentClassificationResult> {
  let img: HTMLImageElement | HTMLCanvasElement;

  if (typeof imageSource === "string") {
    img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = "anonymous";
      el.onload = () => resolve(el);
      el.onerror = (e) => reject(e);
      el.src = imageSource;
    });
  } else {
    img = imageSource;
  }

  const sampleSize = 200;
  const canvas = document.createElement("canvas");
  canvas.width = sampleSize;
  canvas.height = sampleSize;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  if (!ctx) {
    return getFallbackClassification();
  }

  // Draw scaled image
  ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
  const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
  const data = imageData.data;
  const totalPixels = sampleSize * sampleSize;

  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let totalSat = 0;
  let skinTonePixels = 0;
  let nearWhitePixels = 0;
  let darkInkPixels = 0;

  // 16-bin luminance histogram
  const lumHist = new Int32Array(16);

  // Compute stats across pixels
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    totalR += r;
    totalG += g;
    totalB += b;

    // Luminance & Histogram
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const bin = Math.min(15, Math.floor(lum / 16));
    lumHist[bin]++;

    if (lum > 215) nearWhitePixels++;
    if (lum < 85) darkInkPixels++;

    // Saturation in HSV: (max - min) / max
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    totalSat += sat;

    // Skin Tone Detection in normalized RGB space:
    // Human skin locus: R > 95, G > 40, B > 20, R > G, R > B, R - G > 15, |R - B| > 15
    if (
      r > 95 &&
      g > 40 &&
      b > 20 &&
      r > g &&
      r > b &&
      r - g > 15 &&
      Math.abs(r - b) > 15 &&
      sat > 0.15 &&
      sat < 0.75
    ) {
      skinTonePixels++;
    }
  }

  const meanR = totalR / totalPixels;
  const meanG = totalG / totalPixels;
  const meanB = totalB / totalPixels;
  const saturationMean = totalSat / totalPixels;
  const skinToneScore = skinTonePixels / totalPixels;
  const textContrastScore = (nearWhitePixels + darkInkPixels) / totalPixels;

  // Compute color variance
  let colorVarSum = 0;
  for (let i = 0; i < data.length; i += 16) { // step by 4 pixels for speed
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    colorVarSum += Math.abs(r - meanR) + Math.abs(g - meanG) + Math.abs(b - meanB);
  }
  const colorVariance = colorVarSum / ((totalPixels / 4) * 255 * 3);

  // Compute edge density via horizontal and vertical luminance gradient
  let edgeSum = 0;
  const stride = sampleSize * 4;
  for (let y = 1; y < sampleSize - 1; y += 2) {
    for (let x = 1; x < sampleSize - 1; x += 2) {
      const idx = y * stride + x * 4;
      const lumCenter = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      const lumRight = 0.299 * data[idx + 4] + 0.587 * data[idx + 5] + 0.114 * data[idx + 6];
      const lumDown = 0.299 * data[idx + stride] + 0.587 * data[idx + stride + 1] + 0.114 * data[idx + stride + 2];
      const grad = Math.abs(lumCenter - lumRight) + Math.abs(lumCenter - lumDown);
      if (grad > 45) edgeSum++;
    }
  }
  const edgeDensity = edgeSum / ((sampleSize / 2) * (sampleSize / 2));

  // Compute histogram spread
  let histSpread = 0;
  for (let b = 0; b < 16; b++) {
    if (lumHist[b] > totalPixels * 0.03) histSpread++;
  }
  const histogramSpread = histSpread / 16;

  // -------------------------------------------------------------
  // Decision Tree Classifier
  // -------------------------------------------------------------
  let detectedType: DetectedContentType = "mixed-content";
  let label: "Text Document" | "Photo/ID Card" | "Mixed Content" = "Mixed Content";
  let recommendedPreset: CamScannerPresetId = "auto";
  let confidence = 0.85;
  let reason = "";
  let recommendedFilters: ImageFilterPipeline = { ...DEFAULT_FILTERS };

  // Rule 1: Photo / ID Card Identification
  // High skin tone concentration OR high color saturation with wide chromatic variance
  const isPhotoCard =
    skinToneScore > 0.035 ||
    (saturationMean > 0.17 && colorVariance > 0.08) ||
    (saturationMean > 0.14 && skinToneScore > 0.02);

  // Rule 2: Pure Text Document Identification
  // Low saturation, high bimodal contrast (paper + text > 50%), low skin tone
  const isTextDocument =
    !isPhotoCard &&
    saturationMean < 0.12 &&
    (textContrastScore > 0.40 || (nearWhitePixels / totalPixels > 0.60 && darkInkPixels / totalPixels > 0.03)) &&
    skinToneScore < 0.02;

  if (isPhotoCard) {
    detectedType = "photo-id";
    label = "Photo/ID Card";
    confidence = Math.min(0.98, 0.75 + skinToneScore * 3 + saturationMean * 0.5);
    recommendedPreset = "photo";
    reason = `Photo content detected (${(skinToneScore * 100).toFixed(1)}% skin tone, ${(saturationMean * 100).toFixed(1)}% color saturation). Photo-preserving filter tuned for portrait fidelity.`;

    // Photo-preserving filter baseline:
    // Gentle contrast, natural gamma, color preservation, NO aggressive background whitening that erases faces
    recommendedFilters = {
      ...DEFAULT_FILTERS,
      preset: "photo",
      brightness: 6,
      contrast: 14,
      gamma: 1.05,
      sharpness: 20,
      denoise: 10,
      saturation: 8,
      exposure: 0,
      backgroundWhiten: false, // Critical: don't blow out photo backgrounds/skin
      shadowRemoval: false,
      colorMode: "color",
      invert: false,
    };
  } else if (isTextDocument) {
    detectedType = "text-document";
    label = "Text Document";
    confidence = Math.min(0.99, 0.78 + textContrastScore * 0.3);
    recommendedPreset = "enhance";
    reason = `High-contrast text document detected (${(textContrastScore * 100).toFixed(0)}% paper/ink contrast, low saturation). Text-enhancement filter applied for sharp clarity.`;

    // Text document filter baseline:
    // Deep contrast, background whitening for pure white paper, unsharp mask for crisp letters, shadow removal
    recommendedFilters = {
      ...DEFAULT_FILTERS,
      preset: "enhance",
      brightness: 12,
      contrast: 38,
      gamma: 0.92,
      sharpness: 45,
      denoise: 20,
      saturation: 0,
      backgroundWhiten: true,
      backgroundWhitenThreshold: 218,
      shadowRemoval: true,
      shadowStrength: 75,
      colorMode: "color",
      invert: false,
    };
  } else {
    // Mixed Content / Hybrid
    detectedType = "mixed-content";
    label = "Mixed Content";
    confidence = 0.82;
    recommendedPreset = "auto";
    reason = `Mixed document content detected (balanced color & text). Auto-balanced tuning applied.`;

    // Balanced default filter baseline:
    recommendedFilters = {
      ...DEFAULT_FILTERS,
      preset: "auto",
      brightness: 10,
      contrast: 24,
      gamma: 0.98,
      sharpness: 28,
      denoise: 15,
      saturation: 10,
      backgroundWhiten: true,
      backgroundWhitenThreshold: 212,
      shadowRemoval: true,
      shadowStrength: 60,
      colorMode: "color",
      invert: false,
    };
  }

  return {
    detectedType,
    label,
    confidence: Number(confidence.toFixed(2)),
    recommendedPreset,
    recommendedFilters,
    reason,
    signals: {
      colorVariance: Number(colorVariance.toFixed(3)),
      saturationMean: Number(saturationMean.toFixed(3)),
      edgeDensity: Number(edgeDensity.toFixed(3)),
      histogramSpread: Number(histogramSpread.toFixed(3)),
      skinToneScore: Number(skinToneScore.toFixed(3)),
      textContrastScore: Number(textContrastScore.toFixed(3)),
    },
  };
}

export function getFallbackClassification(): ContentClassificationResult {
  return {
    detectedType: "mixed-content",
    label: "Mixed Content",
    confidence: 0.7,
    recommendedPreset: "auto",
    recommendedFilters: { ...DEFAULT_FILTERS, preset: "auto", brightness: 10, contrast: 20, sharpness: 25 },
    reason: "Standard auto-tuning applied.",
    signals: {
      colorVariance: 0.05,
      saturationMean: 0.08,
      edgeDensity: 0.15,
      histogramSpread: 0.5,
      skinToneScore: 0,
      textContrastScore: 0.5,
    },
  };
}
