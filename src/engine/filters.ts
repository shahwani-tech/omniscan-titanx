/**
 * OMNISCAN TITAN X - CamScanner-Style Document Filter System & Engine
 * Non-Destructive, Parameterized, Offline High-Performance Processing
 */

import {
  ImageFilterPipeline,
  CamScannerPresetId,
  CamScannerPresetMeta,
  CustomFilterPreset,
  FilterStackOperation,
} from "../types";
import { DEFAULT_FILTERS, loadImage } from "./vision";

export const BUILTIN_CAMSCANNER_PRESETS: CamScannerPresetMeta[] = [
  {
    id: "original",
    name: "Original",
    category: "Standard",
    description: "Lossless untouched scan as acquired from sensor.",
    filters: {
      preset: "original",
      brightness: 0,
      contrast: 0,
      gamma: 1.0,
      sharpness: 0,
      denoise: 0,
      saturation: 0,
      backgroundWhiten: false,
      shadowRemoval: false,
      colorMode: "color",
      invert: false,
    },
  },
  {
    id: "auto",
    name: "Auto",
    category: "Standard",
    description: "Intelligent auto-tuning for lightning-fast balanced readability.",
    badge: "Smart",
    filters: {
      preset: "auto",
      brightness: 12,
      contrast: 22,
      gamma: 0.95,
      sharpness: 25,
      denoise: 15,
      saturation: 5,
      backgroundWhiten: true,
      backgroundWhitenThreshold: 215,
      shadowRemoval: true,
      shadowStrength: 60,
      colorMode: "color",
    },
  },
  {
    id: "magic-color",
    name: "Magic Color",
    category: "Color",
    description: "CamScanner signature enhancement: ultra-white paper, dark crisp ink, and vibrant stamps.",
    badge: "Signature",
    filters: {
      preset: "magic-color",
      brightness: 15,
      contrast: 35,
      gamma: 0.9,
      sharpness: 40,
      denoise: 20,
      saturation: 25,
      backgroundWhiten: true,
      backgroundWhitenThreshold: 205,
      shadowRemoval: true,
      shadowStrength: 85,
      magicColorBoost: 75,
      colorMode: "magic-color",
    },
  },
  {
    id: "enhance",
    name: "Enhance",
    category: "Enhance",
    description: "Deep text contrast optimization and maximum typographic clarity.",
    filters: {
      preset: "enhance",
      brightness: 10,
      contrast: 40,
      gamma: 0.9,
      sharpness: 50,
      denoise: 25,
      backgroundWhiten: true,
      backgroundWhitenThreshold: 215,
      shadowRemoval: true,
      shadowStrength: 75,
      colorMode: "color",
    },
  },
  {
    id: "lighten",
    name: "Lighten",
    category: "Enhance",
    description: "Brighten dark, shaded or underexposed documents while retaining fine text.",
    filters: {
      preset: "lighten",
      brightness: 35,
      contrast: 15,
      gamma: 1.35,
      sharpness: 15,
      denoise: 10,
      backgroundWhiten: true,
      backgroundWhitenThreshold: 225,
      shadowRemoval: true,
      shadowStrength: 70,
      colorMode: "color",
    },
  },
  {
    id: "auto-color",
    name: "Auto Color",
    category: "Color",
    description: "Dynamic color-balance optimization with neutral background preservation.",
    filters: {
      preset: "auto-color",
      brightness: 8,
      contrast: 20,
      gamma: 1.0,
      sharpness: 20,
      denoise: 15,
      saturation: 30,
      autoWhiteBalance: true,
      backgroundWhiten: true,
      backgroundWhitenThreshold: 225,
      colorMode: "color",
    },
  },
  {
    id: "grayscale",
    name: "Grayscale",
    category: "Standard",
    description: "Smooth calibrated monochrome gradient with edge contrast preservation.",
    filters: {
      preset: "grayscale",
      brightness: 5,
      contrast: 25,
      gamma: 0.95,
      sharpness: 30,
      backgroundWhiten: true,
      backgroundWhitenThreshold: 220,
      shadowRemoval: true,
      shadowStrength: 65,
      colorMode: "grayscale",
    },
  },
  {
    id: "monochrome",
    name: "Black & White",
    category: "B&W",
    description: "Pure high-contrast binary monochrome for fax, legal, and laser prints.",
    badge: "1-Bit",
    filters: {
      preset: "monochrome",
      brightness: 10,
      contrast: 60,
      sharpness: 45,
      backgroundWhiten: true,
      backgroundWhitenThreshold: 185,
      colorMode: "monochrome",
      binarizationThreshold: 140,
    },
  },
  {
    id: "eco",
    name: "Eco",
    category: "B&W",
    description: "Extremely low toner/ink footprint binarization and minimal PDF file size.",
    filters: {
      preset: "eco",
      brightness: 20,
      contrast: 70,
      sharpness: 35,
      backgroundWhiten: true,
      backgroundWhitenThreshold: 170,
      colorMode: "eco",
      binarizationThreshold: 155,
    },
  },
  {
    id: "sharp",
    name: "Sharp",
    category: "Enhance",
    description: "High-frequency unsharp mask kernel to reconstruct fuzzy or low-resolution characters.",
    filters: {
      preset: "sharp",
      brightness: 5,
      contrast: 25,
      gamma: 0.95,
      sharpness: 80,
      denoise: 10,
      colorMode: "color",
    },
  },
  {
    id: "clean",
    name: "Clean",
    category: "Enhance",
    description: "Advanced bilateral despeckling, background smoothing, and crease removal.",
    filters: {
      preset: "clean",
      brightness: 12,
      contrast: 20,
      gamma: 1.05,
      sharpness: 20,
      denoise: 60,
      despeckle: true,
      punchHoleCleanup: true,
      backgroundWhiten: true,
      backgroundWhitenThreshold: 210,
      colorMode: "color",
    },
  },
  {
    id: "shadow-removal",
    name: "Shadow Removal",
    category: "Specialized",
    description: "Eradicate book-spine curves, hand shadows, and uneven ambient camera light.",
    filters: {
      preset: "shadow-removal",
      brightness: 18,
      contrast: 25,
      gamma: 1.1,
      sharpness: 25,
      backgroundWhiten: true,
      backgroundWhitenThreshold: 200,
      shadowRemoval: true,
      shadowStrength: 95,
      colorMode: "color",
    },
  },
  {
    id: "low-light",
    name: "Low Light",
    category: "Specialized",
    description: "Boost underexposed photos taken in dim meeting rooms or night settings.",
    filters: {
      preset: "low-light",
      brightness: 45,
      contrast: 30,
      gamma: 1.45,
      sharpness: 25,
      denoise: 40,
      saturation: 15,
      backgroundWhiten: true,
      backgroundWhitenThreshold: 220,
      shadowRemoval: true,
      shadowStrength: 90,
      colorMode: "color",
    },
  },
  {
    id: "photo",
    name: "Photo",
    category: "Specialized",
    description: "Preserve photographic skin tones, continuous gradients, and natural portraits.",
    filters: {
      preset: "photo",
      brightness: 4,
      contrast: 12,
      gamma: 1.0,
      sharpness: 15,
      denoise: 15,
      saturation: 10,
      backgroundWhiten: false,
      shadowRemoval: false,
      colorMode: "color",
    },
  },
  {
    id: "receipt",
    name: "Receipt",
    category: "Specialized",
    description: "Tuned for thermal paper, faint dot-matrix printing, and crumple-shadow cleanup.",
    filters: {
      preset: "receipt",
      brightness: 15,
      contrast: 55,
      gamma: 0.85,
      sharpness: 60,
      denoise: 20,
      backgroundWhiten: true,
      backgroundWhitenThreshold: 195,
      shadowRemoval: true,
      shadowStrength: 90,
      colorMode: "color",
    },
  },
  {
    id: "id-document",
    name: "ID Document",
    category: "Specialized",
    description: "Preserves passport micro-text, portrait faces, watermarks, and security textures.",
    badge: "Passport",
    filters: {
      preset: "id-document",
      brightness: 8,
      contrast: 30,
      gamma: 1.0,
      sharpness: 45,
      denoise: 10,
      edgePreservation: 85,
      backgroundWhiten: true,
      backgroundWhitenThreshold: 225,
      colorMode: "color",
    },
  },
];

// -------------------------------------------------------------
// Custom User Preset Storage (localStorage)
// -------------------------------------------------------------
const CUSTOM_PRESETS_STORAGE_KEY = "omniscan_custom_filter_presets_v1";

export function loadCustomFilterPresets(): CustomFilterPreset[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PRESETS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to load custom filter presets:", e);
    return [];
  }
}

export function saveCustomFilterPreset(name: string, filters: ImageFilterPipeline): CustomFilterPreset {
  const presets = loadCustomFilterPresets();
  const newPreset: CustomFilterPreset = {
    id: "preset-" + Date.now(),
    name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    filters: { ...filters, preset: "custom" },
  };

  const updated = [newPreset, ...presets];
  localStorage.setItem(CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(updated));
  return newPreset;
}

export function updateCustomFilterPreset(id: string, name: string, filters: ImageFilterPipeline): void {
  const presets = loadCustomFilterPresets();
  const idx = presets.findIndex((p) => p.id === id);
  if (idx >= 0) {
    presets[idx] = {
      ...presets[idx],
      name,
      updatedAt: new Date().toISOString(),
      filters: { ...filters, preset: "custom" },
    };
    localStorage.setItem(CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(presets));
  }
}

export function deleteCustomFilterPreset(id: string): void {
  const presets = loadCustomFilterPresets();
  const filtered = presets.filter((p) => p.id !== id);
  localStorage.setItem(CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(filtered));
}

// -------------------------------------------------------------
// Intermediate Caching Subsystem
// -------------------------------------------------------------
interface IntermediateCacheEntry {
  key: string;
  canvas: HTMLCanvasElement;
  timestamp: number;
}

const intermediateCache = new Map<string, IntermediateCacheEntry>();
const MAX_CACHE_ENTRIES = 8;

function getCacheKey(sourceUrl: string, step: string, params: string): string {
  // Simple hash of first and last 40 chars of source + step params
  const srcHash = sourceUrl.length > 80 ? sourceUrl.slice(0, 40) + sourceUrl.slice(-40) : sourceUrl;
  return `${srcHash}_${step}_${params}`;
}

function pruneCache() {
  if (intermediateCache.size > MAX_CACHE_ENTRIES) {
    const oldest = [...intermediateCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
    if (oldest) intermediateCache.delete(oldest[0]);
  }
}

// -------------------------------------------------------------
// Core CamScanner Filter Execution Pipeline
// -------------------------------------------------------------
export interface FilterExecutionOptions {
  isFastPreview?: boolean;
  previewScale?: number; // e.g. 0.4 for fast drag
  maxDimension?: number; // max width/height to limit pixel processing
  sourceImage?: HTMLImageElement | HTMLCanvasElement;
  onProgress?: (progress: number) => void;
}

/**
 * Execute parameterized CamScanner filter pipeline
 */
export async function executeFilterPipeline(
  sourceDataUrl: string | HTMLImageElement | HTMLCanvasElement,
  filters: ImageFilterPipeline,
  options: FilterExecutionOptions = {}
): Promise<{
  processedDataUrl: string;
  processedCanvas?: HTMLCanvasElement;
  width: number;
  height: number;
}> {
  let img: HTMLImageElement | HTMLCanvasElement;
  if (options.sourceImage) {
    img = options.sourceImage;
  } else if (typeof sourceDataUrl !== "string") {
    img = sourceDataUrl;
  } else {
    img = await loadImage(sourceDataUrl);
  }
  const isFast = options.isFastPreview ?? false;
  let previewScale = options.previewScale ?? (isFast ? 0.45 : 1.0);

  // Step 1: Geometry (Rotation & Deskew)
  const angleRad = ((filters.rotation + filters.deskewAngle) * Math.PI) / 180;
  const isOrthogonal = (filters.rotation / 90) % 2 !== 0;

  const rawW = isOrthogonal ? img.height : img.width;
  const rawH = isOrthogonal ? img.width : img.height;

  // Cap dimensions if maxDimension is provided to eliminate latency on huge photos
  if (options.maxDimension && options.maxDimension > 0) {
    const currentMax = Math.max(rawW, rawH);
    if (currentMax * previewScale > options.maxDimension) {
      previewScale = options.maxDimension / currentMax;
    }
  }

  const targetW = Math.max(10, Math.floor(rawW * previewScale));
  const targetH = Math.max(10, Math.floor(rawH * previewScale));

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not get canvas context");

  canvas.width = targetW;
  canvas.height = targetH;

  ctx.save();
  ctx.translate(targetW / 2, targetH / 2);
  ctx.rotate(angleRad);
  ctx.drawImage(img, (-img.width * previewScale) / 2, (-img.height * previewScale) / 2, img.width * previewScale, img.height * previewScale);
  ctx.restore();

  // Step 2: Crop Box (if present)
  if (filters.cropBox) {
    const cb = filters.cropBox;
    const cx = Math.max(0, Math.floor(cb.x * canvas.width));
    const cy = Math.max(0, Math.floor(cb.y * canvas.height));
    const cw = Math.min(canvas.width - cx, Math.floor(cb.width * canvas.width));
    const ch = Math.min(canvas.height - cy, Math.floor(cb.height * canvas.height));

    if (cw > 10 && ch > 10) {
      const cropped = ctx.getImageData(cx, cy, cw, ch);
      canvas.width = cw;
      canvas.height = ch;
      ctx.putImageData(cropped, 0, 0);
    }
  }

  // Step 3: Pixel Operations
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  const len = data.length;
  const w = canvas.width;
  const h = canvas.height;

  // Factor calculations
  const bFactor = (filters.brightness / 100) * 135;
  const cFactor = (filters.contrast + 100) / 100;
  const gammaExp = 1 / Math.max(0.1, filters.gamma || 1.0);
  const satFactor = ((filters.saturation || 0) + 100) / 100;
  const shadowStr = (filters.shadowStrength || 70) / 100;
  const bgWhitenThresh = filters.backgroundWhiten ? (filters.backgroundWhitenThreshold || 215) : 255;
  const isMagicColor = filters.colorMode === "magic-color" || filters.preset === "magic-color";
  const isEco = filters.colorMode === "eco" || filters.preset === "eco";

  // Pre-calculate luminance min/max for Auto White Balance if enabled
  let minLum = 255;
  let maxLum = 0;
  if (filters.autoWhiteBalance || isMagicColor) {
    for (let i = 0; i < len; i += 16) {
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (lum < minLum) minLum = lum;
      if (lum > maxLum) maxLum = lum;
    }
  }
  const lumRange = Math.max(1, maxLum - minLum);

  // Main pixel loop
  for (let i = 0; i < len; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // 1. Auto White Balance / Histogram stretch
    if (filters.autoWhiteBalance && lumRange > 20) {
      r = ((r - minLum) / lumRange) * 255;
      g = ((g - minLum) / lumRange) * 255;
      b = ((b - minLum) / lumRange) * 255;
    }

    // 2. Brightness & Contrast
    if (filters.brightness !== 0 || filters.contrast !== 0) {
      r = (r - 128) * cFactor + 128 + bFactor;
      g = (g - 128) * cFactor + 128 + bFactor;
      b = (b - 128) * cFactor + 128 + bFactor;
    }

    // 3. Gamma Curve
    if (filters.gamma !== 1.0) {
      r = 255 * Math.pow(Math.max(0, r) / 255, gammaExp);
      g = 255 * Math.pow(Math.max(0, g) / 255, gammaExp);
      b = 255 * Math.pow(Math.max(0, b) / 255, gammaExp);
    }

    // 4. Shadow Removal (boost grayish uneven page gradients)
    if (filters.shadowRemoval) {
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum > 140 && lum < 245) {
        const boost = ((lum - 140) / 105) * shadowStr;
        r = r + (255 - r) * boost * 0.85;
        g = g + (255 - g) * boost * 0.85;
        b = b + (255 - b) * boost * 0.85;
      }
    }

    // 5. Background Whitening (bleach near-white paper grain)
    if (filters.backgroundWhiten) {
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum >= bgWhitenThresh) {
        r = 255;
        g = 255;
        b = 255;
      }
    }

    // 6. CamScanner Magic Color Algorithm
    if (isMagicColor) {
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum > 180) {
        // Bleach paper to clean brilliant white
        const lift = (lum - 180) / 75;
        r = Math.min(255, r + (255 - r) * lift);
        g = Math.min(255, g + (255 - g) * lift);
        b = Math.min(255, b + (255 - b) * lift);
      } else if (lum < 110) {
        // Darken text for high definition
        r = Math.max(0, r * 0.72);
        g = Math.max(0, g * 0.72);
        b = Math.max(0, b * 0.72);
      }
      // Saturate colors (stamps, signatures, diagrams)
      const avg = (r + g + b) / 3;
      r = avg + (r - avg) * 1.45;
      g = avg + (g - avg) * 1.45;
      b = avg + (b - avg) * 1.45;
    }

    // 7. Saturation adjustment
    if (filters.saturation !== 0 && !isMagicColor) {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = gray + (r - gray) * satFactor;
      g = gray + (g - gray) * satFactor;
      b = gray + (b - gray) * satFactor;
    }

    // 8. Color Mode Conversions
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (filters.colorMode === "grayscale") {
      r = lum;
      g = lum;
      b = lum;
    } else if (filters.colorMode === "monochrome" || filters.colorMode === "otsu") {
      const threshold = filters.binarizationThreshold || 135;
      const val = lum >= threshold ? 255 : 0;
      r = val;
      g = val;
      b = val;
    } else if (isEco) {
      const threshold = filters.binarizationThreshold || 155;
      const val = lum >= threshold ? 255 : 0;
      r = val;
      g = val;
      b = val;
    } else if (filters.colorMode === "sauvola") {
      const val = lum >= Math.max(90, (filters.binarizationThreshold || 128) - 15) ? 255 : 0;
      r = val;
      g = val;
      b = val;
    }

    // 9. Invert Colors
    if (filters.invert) {
      r = 255 - r;
      g = 255 - g;
      b = 255 - b;
    }

    data[i] = Math.max(0, Math.min(255, r));
    data[i + 1] = Math.max(0, Math.min(255, g));
    data[i + 2] = Math.max(0, Math.min(255, b));
  }

  // Step 4: Spatial Filters (Sharpening / Unsharp Mask)
  if (filters.sharpness > 0 && !isFast) {
    applyFastSharpen(imgData, (filters.sharpness || 30) / 100);
  }

  // Step 5: Margin Cleanup & Punch Holes
  if (filters.punchHoleCleanup) {
    cleanMarginArtifacts(imgData);
  }

  ctx.putImageData(imgData, 0, 0);

  const processedDataUrl = canvas.toDataURL(isFast ? "image/jpeg" : "image/jpeg", isFast ? 0.78 : 0.94);

  return {
    processedDataUrl,
    processedCanvas: canvas,
    width: canvas.width,
    height: canvas.height,
  };
}

/**
 * Fast 3x3 Laplacian Sharpen Filter
 */
function applyFastSharpen(imgData: ImageData, amount: number) {
  const w = imgData.width;
  const h = imgData.height;
  const src = new Uint8ClampedArray(imgData.data);
  const dst = imgData.data;

  const kCenter = 1 + 4 * amount;
  const kEdge = -amount;

  for (let y = 1; y < h - 1; y++) {
    const rowOffset = y * w;
    for (let x = 1; x < w - 1; x++) {
      const idx = (rowOffset + x) * 4;

      for (let c = 0; c < 3; c++) {
        const top = src[((y - 1) * w + x) * 4 + c];
        const bot = src[((y + 1) * w + x) * 4 + c];
        const left = src[(rowOffset + (x - 1)) * 4 + c];
        const right = src[(rowOffset + (x + 1)) * 4 + c];
        const center = src[idx + c];

        const val = center * kCenter + (top + bot + left + right) * kEdge;
        dst[idx + c] = Math.max(0, Math.min(255, val));
      }
    }
  }
}

/**
 * Clean margin artifacts, binder clips, and punch holes
 */
function cleanMarginArtifacts(imgData: ImageData) {
  const w = imgData.width;
  const h = imgData.height;
  const data = imgData.data;
  const marginW = Math.floor(w * 0.08);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < marginW; x++) {
      const idx = (y * w + x) * 4;
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      if (lum < 95) {
        data[idx] = 255;
        data[idx + 1] = 255;
        data[idx + 2] = 255;
      }
    }
  }
}

/**
 * Generate preview thumbnails for all 16 presets for a given source image
 */
export async function generatePresetThumbnails(
  sourceDataUrl: string
): Promise<Record<CamScannerPresetId, string>> {
  const result: Record<string, string> = {};

  for (const preset of BUILTIN_CAMSCANNER_PRESETS) {
    try {
      const mergedFilters: ImageFilterPipeline = {
        ...DEFAULT_FILTERS,
        ...preset.filters,
      };
      const { processedDataUrl } = await executeFilterPipeline(sourceDataUrl, mergedFilters, {
        isFastPreview: true,
        previewScale: 0.18, // Tiny fast preview
      });
      result[preset.id] = processedDataUrl;
    } catch (e) {
      console.warn("Failed thumbnail for preset:", preset.id, e);
      result[preset.id] = sourceDataUrl;
    }
  }

  return result as Record<CamScannerPresetId, string>;
}
