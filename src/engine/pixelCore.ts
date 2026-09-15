/**
 * OMNISCAN TITAN X - Core Pixel & Vision Mathematics (Zero-DOM)
 * Pure typed-array algorithms shared identically between Web Workers and Main Thread
 */

import { ImageFilterPipeline, PerspectiveQuad, PerspectiveDetectionCandidate, Point } from "../types";

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

/**
 * Execute perspective transformation (Homography) on raw pixel buffer.
 * Maps arbitrary quadrilateral (4 source points) to target rectangle [0, targetW] x [0, targetH]
 * using closed-form Direct Linear Transform and sub-pixel bilinear interpolation.
 */
export function executePerspectiveWarpBuffer(
  sourceData: Uint8ClampedArray,
  srcW: number,
  srcH: number,
  quad: PerspectiveQuad,
  targetW: number,
  targetH: number
): Uint8ClampedArray {
  const targetBuffer = new Uint8ClampedArray(targetW * targetH * 4);

  // Convert normalized corner coordinates (0-1) to pixel coordinates
  const x0 = Math.max(0, Math.min(srcW - 1, quad.topLeft.x * srcW));
  const y0 = Math.max(0, Math.min(srcH - 1, quad.topLeft.y * srcH));

  const x1 = Math.max(0, Math.min(srcW - 1, quad.topRight.x * srcW));
  const y1 = Math.max(0, Math.min(srcH - 1, quad.topRight.y * srcH));

  const x2 = Math.max(0, Math.min(srcW - 1, quad.bottomRight.x * srcW));
  const y2 = Math.max(0, Math.min(srcH - 1, quad.bottomRight.y * srcH));

  const x3 = Math.max(0, Math.min(srcW - 1, quad.bottomLeft.x * srcW));
  const y3 = Math.max(0, Math.min(srcH - 1, quad.bottomLeft.y * srcH));

  // Compute Projective Matrix mapping Unit Square [0, 1]x[0, 1] -> Quad (x, y)
  // Mapping:
  // (0, 0) -> (x0, y0) [Top-Left]
  // (1, 0) -> (x1, y1) [Top-Right]
  // (1, 1) -> (x2, y2) [Bottom-Right]
  // (0, 1) -> (x3, y3) [Bottom-Left]
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dx3 = x0 - x1 + x2 - x3;

  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const dy3 = y0 - y1 + y2 - y3;

  let a11: number, a12: number, a13: number;
  let a21: number, a22: number, a23: number;
  let a31: number, a32: number;

  if (Math.abs(dx3) < 1e-6 && Math.abs(dy3) < 1e-6) {
    // Affine Parallelogram
    a11 = x1 - x0;
    a12 = x3 - x0;
    a13 = x0;
    a21 = y1 - y0;
    a22 = y3 - y0;
    a23 = y0;
    a31 = 0;
    a32 = 0;
  } else {
    // Perspective Quadrilateral
    let denom = dx1 * dy2 - dy1 * dx2;
    if (Math.abs(denom) < 1e-10) denom = 1e-10;

    a31 = (dx3 * dy2 - dy3 * dx2) / denom;
    a32 = (dx1 * dy3 - dy1 * dx3) / denom;

    a11 = x1 - x0 + a31 * x1;
    a12 = x3 - x0 + a32 * x3;
    a13 = x0;

    a21 = y1 - y0 + a31 * y1;
    a22 = y3 - y0 + a32 * y3;
    a23 = y0;
  }

  const normDenomU = targetW > 1 ? targetW - 1 : 1;
  const normDenomV = targetH > 1 ? targetH - 1 : 1;
  const maxSrcX = srcW - 1.0001;
  const maxSrcY = srcH - 1.0001;

  // Warp loop: iterate over every destination pixel (u, v) and sample source (x, y)
  for (let v = 0; v < targetH; v++) {
    const normV = v / normDenomV;
    const vA12 = a12 * normV + a13;
    const vA22 = a22 * normV + a23;
    const vA32 = a32 * normV + 1.0;
    const dstRowOffset = v * targetW;

    for (let u = 0; u < targetW; u++) {
      const normU = u / normDenomU;

      // Projective weight
      const w = a31 * normU + vA32;
      const invW = 1.0 / (Math.abs(w) > 1e-8 ? w : 1e-8);

      // Continuous coordinates in source image
      let sx = (a11 * normU + vA12) * invW;
      let sy = (a21 * normU + vA22) * invW;

      // Boundary clamping
      if (sx < 0) sx = 0;
      else if (sx > maxSrcX) sx = maxSrcX;

      if (sy < 0) sy = 0;
      else if (sy > maxSrcY) sy = maxSrcY;

      // Bilinear interpolation
      const ix0 = sx | 0;
      const iy0 = sy | 0;
      const ix1 = ix0 < srcW - 1 ? ix0 + 1 : ix0;
      const iy1 = iy0 < srcH - 1 ? iy0 + 1 : iy0;

      const fx = sx - ix0;
      const fy = sy - iy0;

      const w00 = (1 - fx) * (1 - fy);
      const w10 = fx * (1 - fy);
      const w01 = (1 - fx) * fy;
      const w11 = fx * fy;

      const row0 = iy0 * srcW;
      const row1 = iy1 * srcW;

      const idx00 = (row0 + ix0) << 2;
      const idx10 = (row0 + ix1) << 2;
      const idx01 = (row1 + ix0) << 2;
      const idx11 = (row1 + ix1) << 2;

      const dstIdx = (dstRowOffset + u) << 2;

      targetBuffer[dstIdx] = (w00 * sourceData[idx00] + w10 * sourceData[idx10] + w01 * sourceData[idx01] + w11 * sourceData[idx11]) | 0;
      targetBuffer[dstIdx + 1] = (w00 * sourceData[idx00 + 1] + w10 * sourceData[idx10 + 1] + w01 * sourceData[idx01 + 1] + w11 * sourceData[idx11 + 1]) | 0;
      targetBuffer[dstIdx + 2] = (w00 * sourceData[idx00 + 2] + w10 * sourceData[idx10 + 2] + w01 * sourceData[idx01 + 2] + w11 * sourceData[idx11 + 2]) | 0;
      targetBuffer[dstIdx + 3] = (w00 * sourceData[idx00 + 3] + w10 * sourceData[idx10 + 3] + w01 * sourceData[idx01 + 3] + w11 * sourceData[idx11 + 3]) | 0;
    }
  }

  return targetBuffer;
}

/**
 * Intelligent Document Edge & Quadrangle Detection from raw pixel buffer.
 * Uses adaptive Sobel gradient magnitude, boundary ray-casting, extreme corner point analysis,
 * and convex contour validation.
 */
export function detectDocumentQuadFromBuffer(
  sourceData: Uint8ClampedArray,
  srcW: number,
  srcH: number
): {
  quad: PerspectiveQuad;
  confidence: number;
  candidates: PerspectiveDetectionCandidate[];
} {
  // Downscale image to work dimensions for fast analysis (<10ms)
  const maxDim = 360;
  const scale = Math.min(1.0, maxDim / Math.max(srcW, srcH));
  const workW = Math.max(64, Math.round(srcW * scale));
  const workH = Math.max(64, Math.round(srcH * scale));

  // Compute grayscale luminance buffer
  const gray = new Uint8Array(workW * workH);
  for (let y = 0; y < workH; y++) {
    const srcY = Math.min(srcH - 1, Math.floor(y / scale));
    const srcRowOffset = srcY * srcW;
    const dstRowOffset = y * workW;
    for (let x = 0; x < workW; x++) {
      const srcX = Math.min(srcW - 1, Math.floor(x / scale));
      const idx = (srcRowOffset + srcX) << 2;
      const r = sourceData[idx];
      const g = sourceData[idx + 1];
      const b = sourceData[idx + 2];
      gray[dstRowOffset + x] = (0.299 * r + 0.587 * g + 0.114 * b) | 0;
    }
  }

  // 3x3 Box blur to smooth noise and paper texture
  const blurred = new Uint8Array(workW * workH);
  for (let y = 1; y < workH - 1; y++) {
    const yPrev = (y - 1) * workW;
    const yCurr = y * workW;
    const yNext = (y + 1) * workW;
    for (let x = 1; x < workW - 1; x++) {
      const sum =
        gray[yPrev + x - 1] + gray[yPrev + x] + gray[yPrev + x + 1] +
        gray[yCurr + x - 1] + gray[yCurr + x] + gray[yCurr + x + 1] +
        gray[yNext + x - 1] + gray[yNext + x] + gray[yNext + x + 1];
      blurred[yCurr + x] = (sum / 9) | 0;
    }
  }

  // Compute Sobel gradient magnitude
  const grad = new Uint8Array(workW * workH);
  let maxGrad = 1;
  for (let y = 1; y < workH - 1; y++) {
    const yPrev = (y - 1) * workW;
    const yCurr = y * workW;
    const yNext = (y + 1) * workW;
    for (let x = 1; x < workW - 1; x++) {
      // Sobel X
      const gx =
        -blurred[yPrev + x - 1] + blurred[yPrev + x + 1] +
        -2 * blurred[yCurr + x - 1] + 2 * blurred[yCurr + x + 1] +
        -blurred[yNext + x - 1] + blurred[yNext + x + 1];

      // Sobel Y
      const gy =
        -blurred[yPrev + x - 1] - 2 * blurred[yPrev + x] - blurred[yPrev + x + 1] +
        blurred[yNext + x - 1] + 2 * blurred[yNext + x] + blurred[yNext + x + 1];

      const mag = Math.min(255, Math.hypot(gx, gy) | 0);
      grad[yCurr + x] = mag;
      if (mag > maxGrad) maxGrad = mag;
    }
  }

  // Adaptive threshold for edge detection
  const edgeThresh = Math.max(28, maxGrad * 0.28);
  const boundaryPoints: Array<{ x: number; y: number; weight: number }> = [];

  // Ray-cast from top border downward
  const numRays = 32;
  for (let i = 2; i < numRays - 2; i++) {
    const x = Math.round((i / numRays) * workW);
    for (let y = 3; y < workH * 0.45; y++) {
      const mag = grad[y * workW + x];
      if (mag >= edgeThresh) {
        boundaryPoints.push({ x, y, weight: mag });
        break;
      }
    }
  }

  // Ray-cast from bottom border upward
  for (let i = 2; i < numRays - 2; i++) {
    const x = Math.round((i / numRays) * workW);
    for (let y = workH - 4; y > workH * 0.55; y--) {
      const mag = grad[y * workW + x];
      if (mag >= edgeThresh) {
        boundaryPoints.push({ x, y, weight: mag });
        break;
      }
    }
  }

  // Ray-cast from left border rightward
  for (let i = 2; i < numRays - 2; i++) {
    const y = Math.round((i / numRays) * workH);
    for (let x = 3; x < workW * 0.45; x++) {
      const mag = grad[y * workW + x];
      if (mag >= edgeThresh) {
        boundaryPoints.push({ x, y, weight: mag });
        break;
      }
    }
  }

  // Ray-cast from right border leftward
  for (let i = 2; i < numRays - 2; i++) {
    const y = Math.round((i / numRays) * workH);
    for (let x = workW - 4; x > workW * 0.55; x--) {
      const mag = grad[y * workW + x];
      if (mag >= edgeThresh) {
        boundaryPoints.push({ x, y, weight: mag });
        break;
      }
    }
  }

  // Fallback safe inset quad (e.g. standard 2.5% margin)
  const defaultQuad: PerspectiveQuad = {
    topLeft: { x: 0.025, y: 0.025 },
    topRight: { x: 0.975, y: 0.025 },
    bottomRight: { x: 0.975, y: 0.975 },
    bottomLeft: { x: 0.025, y: 0.975 },
    preset: "natural",
  };

  const candidates: PerspectiveDetectionCandidate[] = [];

  if (boundaryPoints.length < 16) {
    // Insufficient edge points: return default quad with low confidence
    return {
      quad: defaultQuad,
      confidence: 0.2,
      candidates: [
        {
          id: "cand-full",
          label: "Full Page Safe Inset",
          quad: defaultQuad,
          confidence: 0.2,
          areaFraction: 0.95,
        },
      ],
    };
  }

  // Find 4 extreme corner candidates in normalized space
  // TL minimizes (x + y)
  // TR maximizes (x - y)
  // BR maximizes (x + y)
  // BL minimizes (x - y) [maximizes (y - x)]
  let bestTl = boundaryPoints[0];
  let minXplusY = Infinity;

  let bestTr = boundaryPoints[0];
  let maxXminusY = -Infinity;

  let bestBr = boundaryPoints[0];
  let maxXplusY = -Infinity;

  let bestBl = boundaryPoints[0];
  let minXminusY = Infinity;

  for (const pt of boundaryPoints) {
    const normX = pt.x / workW;
    const normY = pt.y / workH;

    const xPlusY = normX + normY;
    const xMinusY = normX - normY;

    if (xPlusY < minXplusY) {
      minXplusY = xPlusY;
      bestTl = pt;
    }
    if (xMinusY > maxXminusY) {
      maxXminusY = xMinusY;
      bestTr = pt;
    }
    if (xPlusY > maxXplusY) {
      maxXplusY = xPlusY;
      bestBr = pt;
    }
    if (xMinusY < minXminusY) {
      minXminusY = xMinusY;
      bestBl = pt;
    }
  }

  // Normalize coordinates to 0..1
  const rawTl: Point = { x: bestTl.x / workW, y: bestTl.y / workH };
  const rawTr: Point = { x: bestTr.x / workW, y: bestTr.y / workH };
  const rawBr: Point = { x: bestBr.x / workW, y: bestBr.y / workH };
  const rawBl: Point = { x: bestBl.x / workW, y: bestBl.y / workH };

  // Calculate polygon area using Shoelace formula
  const area = 0.5 * Math.abs(
    rawTl.x * rawTr.y - rawTr.x * rawTl.y +
    rawTr.x * rawBr.y - rawBr.x * rawTr.y +
    rawBr.x * rawBl.y - rawBl.x * rawBr.y +
    rawBl.x * rawTl.y - rawTl.x * rawBl.y
  );

  // Check convexity via cross product signs of consecutive edges
  const edge1 = { x: rawTr.x - rawTl.x, y: rawTr.y - rawTl.y };
  const edge2 = { x: rawBr.x - rawTr.x, y: rawBr.y - rawTr.y };
  const edge3 = { x: rawBl.x - rawBr.x, y: rawBl.y - rawBr.y };
  const edge4 = { x: rawTl.x - rawBl.x, y: rawTl.y - rawBl.y };

  const cross1 = edge1.x * edge2.y - edge1.y * edge2.x;
  const cross2 = edge2.x * edge3.y - edge2.y * edge3.x;
  const cross3 = edge3.x * edge4.y - edge3.y * edge4.x;
  const cross4 = edge4.x * edge1.y - edge4.y * edge1.x;

  const isConvex =
    (cross1 > 0 && cross2 > 0 && cross3 > 0 && cross4 > 0) ||
    (cross1 < 0 && cross2 < 0 && cross3 < 0 && cross4 < 0);

  // If area is reasonable (between 12% and 98% of frame) and polygon is convex
  let confidence = 0.35;
  if (isConvex && area >= 0.12 && area <= 0.98) {
    confidence = Math.min(0.96, 0.5 + (boundaryPoints.length / 80) * 0.4);
  }

  const detectedQuad: PerspectiveQuad = isConvex && area >= 0.12 && area <= 0.98
    ? {
        topLeft: {
          x: Math.max(0, Math.min(0.95, Math.round(rawTl.x * 10000) / 10000)),
          y: Math.max(0, Math.min(0.95, Math.round(rawTl.y * 10000) / 10000)),
        },
        topRight: {
          x: Math.max(0.05, Math.min(1.0, Math.round(rawTr.x * 10000) / 10000)),
          y: Math.max(0, Math.min(0.95, Math.round(rawTr.y * 10000) / 10000)),
        },
        bottomRight: {
          x: Math.max(0.05, Math.min(1.0, Math.round(rawBr.x * 10000) / 10000)),
          y: Math.max(0.05, Math.min(1.0, Math.round(rawBr.y * 10000) / 10000)),
        },
        bottomLeft: {
          x: Math.max(0, Math.min(0.95, Math.round(rawBl.x * 10000) / 10000)),
          y: Math.max(0.05, Math.min(1.0, Math.round(rawBl.y * 10000) / 10000)),
        },
        preset: "natural",
      }
    : defaultQuad;

  candidates.push({
    id: "cand-primary",
    label: confidence > 0.55 ? "Auto-Detected Document" : "Standard Frame Inset",
    quad: detectedQuad,
    confidence,
    areaFraction: area,
  });

  // Secondary candidate: Full Frame / Tight Margin
  candidates.push({
    id: "cand-full",
    label: "Full Frame (100%)",
    quad: {
      topLeft: { x: 0, y: 0 },
      topRight: { x: 1, y: 0 },
      bottomRight: { x: 1, y: 1 },
      bottomLeft: { x: 0, y: 1 },
      preset: "natural",
    },
    confidence: 0.5,
    areaFraction: 1.0,
  });

  // Multi-document / Card candidate check:
  // If the detected document is small (e.g. ID card occupying <40% area) or if aspect ratio is roughly ID-1 (1.58)
  const quadW = Math.hypot(detectedQuad.topRight.x - detectedQuad.topLeft.x, detectedQuad.topRight.y - detectedQuad.topLeft.y);
  const quadH = Math.hypot(detectedQuad.bottomLeft.x - detectedQuad.topLeft.x, detectedQuad.bottomLeft.y - detectedQuad.topLeft.y);
  if (quadW > 0.1 && quadH > 0.1) {
    const ratio = quadW / quadH;
    if (ratio >= 1.3 && ratio <= 1.8) {
      candidates.push({
        id: "cand-card",
        label: "ID Card / Business Card Framing",
        quad: { ...detectedQuad, preset: "id-card", targetAspectRatio: 85.6 / 53.98 },
        confidence: confidence * 0.95,
        areaFraction: area,
      });
    }
  }

  return {
    quad: detectedQuad,
    confidence,
    candidates,
  };
}
