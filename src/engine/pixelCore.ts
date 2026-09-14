/**
 * OMNISCAN TITAN X - Core Pixel & Vision Mathematics (Zero-DOM)
 * Pure typed-array algorithms shared identically between Web Workers and Main Thread
 */

import { ImageFilterPipeline } from "../types";

/**
 * Apply 9-stage CamScanner filter pipeline to raw pixel buffer
 */
export function applyPixelFiltersToBuffer(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  filters: ImageFilterPipeline,
  isFast = false
): void {
  const len = data.length;

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
    applyFastSharpenBuffer(data, width, height, (filters.sharpness || 30) / 100);
  }

  // Step 5: Margin Cleanup & Punch Holes
  if (filters.punchHoleCleanup) {
    cleanMarginArtifactsBuffer(data, width, height);
  }
}

/**
 * Fast 3x3 Laplacian Sharpen Filter on buffer
 */
export function applyFastSharpenBuffer(
  dst: Uint8ClampedArray,
  w: number,
  h: number,
  amount: number
): void {
  const src = new Uint8ClampedArray(dst);
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
export function cleanMarginArtifactsBuffer(
  data: Uint8ClampedArray,
  w: number,
  h: number
): void {
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
 * Compute auto deskew angle using Radon projection profiles directly from pixel buffer
 * Returns angle in degrees between -15 and 15 deg
 */
export function computeRadonDeskewFromBuffer(
  data: Uint8ClampedArray,
  w: number,
  h: number
): number {
  const gray = new Float32Array(w * h);
  for (let i = 0; i < data.length; i += 4) {
    gray[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  let bestAngle = 0;
  let maxVariance = -1;

  for (let angle = -15; angle <= 15; angle += 0.5) {
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const profile = new Float32Array(h);
    const counts = new Uint32Array(h);

    // Sample lines
    for (let y = 10; y < h - 10; y += 2) {
      for (let x = 10; x < w - 10; x += 4) {
        const rx = Math.floor(x * cos - y * sin);
        const ry = Math.floor(x * sin + y * cos);

        if (ry >= 0 && ry < h && rx >= 0 && rx < w) {
          const pixel = gray[y * w + x];
          if (y > 0) {
            const diff = Math.abs(pixel - gray[(y - 1) * w + x]);
            if (diff > 25) {
              profile[ry] += diff;
              counts[ry]++;
            }
          }
        }
      }
    }

    let sum = 0;
    let sumSq = 0;
    let validRows = 0;
    for (let y = 0; y < h; y++) {
      if (counts[y] > 0) {
        const val = profile[y];
        sum += val;
        sumSq += val * val;
        validRows++;
      }
    }

    if (validRows > 0) {
      const mean = sum / validRows;
      const variance = sumSq / validRows - mean * mean;
      if (variance > maxVariance) {
        maxVariance = variance;
        bestAngle = angle;
      }
    }
  }

  return -bestAngle;
}

/**
 * Compute page blankness analysis from pixel buffer
 */
export function computeBlanknessFromBuffer(
  data: Uint8ClampedArray,
  w: number,
  h: number
): { isBlank: boolean; score: number } {
  const totalPixels = w * h;
  let nonWhiteCount = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;

    if (lum < 235) {
      nonWhiteCount++;
    }
  }

  const inkRatio = nonWhiteCount / totalPixels;
  const isBlank = inkRatio < 0.0075;
  const score = Math.max(0, Math.min(1, 1.0 - inkRatio * 20));

  return { isBlank, score };
}
