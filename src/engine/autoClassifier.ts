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

export type DocumentSubCategory =
  | "id-card"
  | "passport"
  | "receipt"
  | "invoice"
  | "contract"
  | "color-photo"
  | "standard";

export interface ContentClassificationResult {
  detectedType: DetectedContentType;
  subCategory?: DocumentSubCategory;
  isIdOrBadge?: boolean;
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
    tableGridScore?: number;
    aspectRatio?: number;
  };
}

import { getAutoFeatureSettings } from "../services/settings/autoFeatureSettings";

/**
 * Highly optimized, lightweight content analyzer.
 * Downsamples the image to 200x200 onto an offscreen canvas and computes optical signals.
 * Typical execution time: 4-12ms.
 */
export async function classifyImageContent(
  imageSource: string | HTMLImageElement | HTMLCanvasElement
): Promise<ContentClassificationResult> {
  const settings = getAutoFeatureSettings();
  if (!settings.autoClassification) {
    return getFallbackClassification();
  }

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

  // Compute table grid / structured line score
  let horizLineHits = 0;
  let vertLineHits = 0;
  for (let y = 10; y < sampleSize - 10; y += 4) {
    let continuousDark = 0;
    for (let x = 10; x < sampleSize - 10; x++) {
      const idx = (y * sampleSize + x) * 4;
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      if (lum < 110) continuousDark++;
      else continuousDark = 0;
      if (continuousDark > 20) {
        horizLineHits++;
        break;
      }
    }
  }
  for (let x = 10; x < sampleSize - 10; x += 4) {
    let continuousDark = 0;
    for (let y = 10; y < sampleSize - 10; y++) {
      const idx = (y * sampleSize + x) * 4;
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      if (lum < 110) continuousDark++;
      else continuousDark = 0;
      if (continuousDark > 20) {
        vertLineHits++;
        break;
      }
    }
  }
  const totalLineChecks = ((sampleSize - 20) / 4) * 2;
  const tableGridScore = Number(((horizLineHits + vertLineHits) / totalLineChecks).toFixed(3));
  const origWidth = img.width || sampleSize;
  const origHeight = img.height || sampleSize;
  const aspectRatio = Number((origWidth / origHeight).toFixed(3));

  // -------------------------------------------------------------
  // Multi-Signal Decision Tree Classifier
  // -------------------------------------------------------------
  let detectedType: DetectedContentType = "mixed-content";
  let subCategory: DocumentSubCategory = "standard";
  let label: "Text Document" | "Photo/ID Card" | "Mixed Content" = "Mixed Content";
  let recommendedPreset: CamScannerPresetId = "auto";
  let confidence = 0.85;
  let reason = "";
  let recommendedFilters: ImageFilterPipeline = { ...DEFAULT_FILTERS };
  let isIdOrBadge = false;

  // Signal Detectors
  const isIdAspect = (aspectRatio >= 1.40 && aspectRatio <= 1.75) || (aspectRatio >= 0.58 && aspectRatio <= 0.72);
  const isPassportAspect = (aspectRatio >= 0.68 && aspectRatio <= 0.82) || (aspectRatio >= 1.25 && aspectRatio <= 1.45);
  const isReceiptAspect = aspectRatio < 0.55;

  const hasSubstantialFace = skinToneScore > 0.035;
  const hasVibrantColors = saturationMean > 0.16 && colorVariance > 0.07;
  const isLowColor = saturationMean < 0.10;

  if (isIdAspect && (hasSubstantialFace || hasVibrantColors || skinToneScore > 0.015)) {
    detectedType = "photo-id";
    subCategory = "id-card";
    isIdOrBadge = true;
    label = "Photo/ID Card";
    confidence = Math.min(0.98, 0.82 + skinToneScore * 2 + (isIdAspect ? 0.08 : 0));
    recommendedPreset = "photo";
    reason = `ID Card / Driver License detected (${(skinToneScore * 100).toFixed(1)}% portrait zone, aspect ratio ${aspectRatio}). Tuned for ID photo fidelity and legible microtext.`;
    recommendedFilters = {
      ...DEFAULT_FILTERS,
      preset: "photo",
      brightness: 6,
      contrast: 18,
      gamma: 1.02,
      sharpness: 28,
      denoise: 12,
      saturation: 8,
      backgroundWhiten: false,
      shadowRemoval: false,
      colorMode: "color",
      invert: false,
    };
  } else if (isPassportAspect && hasSubstantialFace && skinToneScore > 0.05) {
    detectedType = "photo-id";
    subCategory = "passport";
    isIdOrBadge = true;
    label = "Photo/ID Card";
    confidence = Math.min(0.98, 0.85 + skinToneScore * 2);
    recommendedPreset = "photo";
    reason = `Passport / Portrait page detected (${(skinToneScore * 100).toFixed(1)}% skin tone). Protective portrait lighting applied.`;
    recommendedFilters = {
      ...DEFAULT_FILTERS,
      preset: "photo",
      brightness: 6,
      contrast: 14,
      gamma: 1.04,
      sharpness: 22,
      denoise: 10,
      saturation: 6,
      backgroundWhiten: false,
      shadowRemoval: false,
      colorMode: "color",
      invert: false,
    };
  } else if (isReceiptAspect && isLowColor && darkInkPixels / totalPixels > 0.02) {
    detectedType = "text-document";
    subCategory = "receipt";
    label = "Text Document";
    confidence = Math.min(0.96, 0.85 + (1 - saturationMean) * 0.1);
    recommendedPreset = "enhance";
    reason = `Receipt detected (narrow aspect ratio ${aspectRatio}, thermal paper characteristics). Contrast maximized for faint thermal print.`;
    recommendedFilters = {
      ...DEFAULT_FILTERS,
      preset: "enhance",
      brightness: 14,
      contrast: 42,
      gamma: 0.88,
      sharpness: 50,
      denoise: 25,
      saturation: 0,
      backgroundWhiten: true,
      backgroundWhitenThreshold: 215,
      shadowRemoval: true,
      shadowStrength: 80,
      colorMode: "color",
      invert: false,
    };
  } else if (tableGridScore > 0.12 && isLowColor && textContrastScore > 0.35) {
    detectedType = "text-document";
    subCategory = "invoice";
    label = "Text Document";
    confidence = Math.min(0.97, 0.82 + tableGridScore * 0.4);
    recommendedPreset = "enhance";
    reason = `Structured invoice/table detected (${(tableGridScore * 100).toFixed(0)}% grid line score). Fine lines and numerical text enhanced.`;
    recommendedFilters = {
      ...DEFAULT_FILTERS,
      preset: "enhance",
      brightness: 10,
      contrast: 36,
      gamma: 0.94,
      sharpness: 42,
      denoise: 18,
      saturation: 0,
      backgroundWhiten: true,
      backgroundWhitenThreshold: 220,
      shadowRemoval: true,
      shadowStrength: 70,
      colorMode: "color",
      invert: false,
    };
  } else if (hasSubstantialFace || (hasVibrantColors && colorVariance > 0.10)) {
    detectedType = "photo-id";
    subCategory = "color-photo";
    label = "Photo/ID Card";
    confidence = Math.min(0.97, 0.78 + saturationMean * 0.6);
    recommendedPreset = "photo";
    reason = `Color photo detected (${(saturationMean * 100).toFixed(1)}% saturation). Natural tones and shadow subtleties preserved.`;
    recommendedFilters = {
      ...DEFAULT_FILTERS,
      preset: "photo",
      brightness: 4,
      contrast: 12,
      gamma: 1.05,
      sharpness: 18,
      denoise: 10,
      saturation: 10,
      backgroundWhiten: false,
      shadowRemoval: false,
      colorMode: "color",
      invert: false,
    };
  } else if (isLowColor && (textContrastScore > 0.38 || (nearWhitePixels / totalPixels > 0.55 && darkInkPixels / totalPixels > 0.02))) {
    detectedType = "text-document";
    subCategory = "contract";
    label = "Text Document";
    confidence = Math.min(0.99, 0.80 + textContrastScore * 0.25);
    recommendedPreset = "enhance";
    reason = `High-contrast text document detected (${(textContrastScore * 100).toFixed(0)}% paper/ink contrast). Clean paper whitening and sharp letter edge rendering applied.`;
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
    detectedType = "mixed-content";
    subCategory = "standard";
    label = "Mixed Content";
    confidence = 0.82;
    recommendedPreset = "auto";
    reason = `Mixed document content detected (balanced color & text). Auto-balanced tuning applied.`;
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
    subCategory,
    isIdOrBadge,
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
      tableGridScore,
      aspectRatio,
    },
  };
}

export function getFallbackClassification(): ContentClassificationResult {
  return {
    detectedType: "mixed-content",
    subCategory: "standard",
    isIdOrBadge: false,
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
      tableGridScore: 0,
      aspectRatio: 1.0,
    },
  };
}
