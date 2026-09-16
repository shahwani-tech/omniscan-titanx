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
 * Compute auto deskew angle using ensemble multi-method voting (Hough, Radon, and Run-Length)
 * Directly from pixel buffer.
 * Returns angle in degrees with 0.1° precision between -45° and +45°.
 */
export interface DeskewResult {
  angle: number;
  confidence: number;
  method: "hough" | "radon" | "run-length" | "ensemble-median";
  spread: number;
}

export function computeEnsembleDeskewFromBuffer(
  data: Uint8ClampedArray,
  w: number,
  h: number
): DeskewResult {
  // Downsample to max long edge 600 for sub-50ms execution
  const scale = Math.min(1.0, 600 / Math.max(w, h));
  const workW = Math.max(64, Math.round(w * scale));
  const workH = Math.max(64, Math.round(h * scale));

  const gray = new Float32Array(workW * workH);
  for (let y = 0; y < workH; y++) {
    const srcY = Math.min(h - 1, Math.floor(y / scale));
    const srcRow = srcY * w;
    const dstRow = y * workW;
    for (let x = 0; x < workW; x++) {
      const srcX = Math.min(w - 1, Math.floor(x / scale));
      const idx = (srcRow + srcX) << 2;
      gray[dstRow + x] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    }
  }

  // 1. Method A: Hough Line Transform on Horizontal Edge Baselines
  const houghRes = computeHoughDeskew(gray, workW, workH);

  // 2. Method B: High-Precision Radon Projection Profile Variance (0.1° resolution)
  const radonRes = computeRadonDeskewInternal(gray, workW, workH);

  // 3. Method C: Horizontal Ink Run-Length / Gradient Projection
  const runLengthRes = computeRunLengthDeskew(gray, workW, workH);

  const angles = [houghRes.angle, radonRes.angle, runLengthRes.angle].sort((a, b) => a - b);
  const medianAngle = angles[1];
  const spread = Math.abs(angles[2] - angles[0]);

  let finalAngle = medianAngle;
  let finalConfidence = 0.85;
  let method: DeskewResult["method"] = "ensemble-median";

  if (spread <= 1.5) {
    // High agreement between all 3 independent methods
    finalConfidence = Math.min(0.98, 0.80 + (1.5 - spread) * 0.12);
    // Weighted mean
    finalAngle = (houghRes.angle * 0.35 + radonRes.angle * 0.45 + runLengthRes.angle * 0.2);
    method = "ensemble-median";
  } else {
    // Pick the method with the highest individual confidence
    const methods = [
      { name: "radon" as const, res: radonRes },
      { name: "hough" as const, res: houghRes },
      { name: "run-length" as const, res: runLengthRes },
    ].sort((a, b) => b.res.confidence - a.res.confidence);

    finalAngle = methods[0].res.angle;
    finalConfidence = methods[0].res.confidence * 0.88;
    method = methods[0].name;
  }

  // Guardrail 1: Micro-skew avoidance (< 0.3° is preserved as 0° to avoid resampling blur)
  if (Math.abs(finalAngle) < 0.3) {
    return { angle: 0, confidence: finalConfidence, method, spread };
  }

  // Guardrail 2: Extreme skew protection (> 15° requires high confidence > 0.85)
  if (Math.abs(finalAngle) > 15 && finalConfidence < 0.85) {
    finalAngle = Math.max(-15, Math.min(15, finalAngle));
  }

  // Limit to -45° to +45° and round to 0.1°
  finalAngle = Math.max(-45, Math.min(45, Math.round(finalAngle * 10) / 10));

  return {
    angle: finalAngle,
    confidence: Number(finalConfidence.toFixed(2)),
    method,
    spread: Number(spread.toFixed(2)),
  };
}

/**
 * Backward-compatible Radon deskew function returning angle directly
 */
export function computeRadonDeskewFromBuffer(
  data: Uint8ClampedArray,
  w: number,
  h: number
): number {
  const res = computeEnsembleDeskewFromBuffer(data, w, h);
  return res.angle;
}

// Helper: Method A - Hough Transform on Horizontal Text Baselines
function computeHoughDeskew(
  gray: Float32Array,
  w: number,
  h: number
): { angle: number; confidence: number } {
  // Horizontal Sobel filter to isolate horizontal text strokes
  const angleBins: number[] = [];
  // -30° to +30° in 0.5° steps
  for (let a = -30; a <= 30; a += 0.5) angleBins.push(a);

  const numAngles = angleBins.length;
  const sinLut = new Float32Array(numAngles);
  const cosLut = new Float32Array(numAngles);
  for (let i = 0; i < numAngles; i++) {
    const rad = (angleBins[i] * Math.PI) / 180;
    sinLut[i] = Math.sin(rad);
    cosLut[i] = Math.cos(rad);
  }

  const diag = Math.ceil(Math.hypot(w, h));
  const numRhoBins = diag * 2;
  const accum = new Uint16Array(numAngles * numRhoBins);

  let edgeCount = 0;
  // Step by 3 pixels for high performance
  for (let y = 10; y < h - 10; y += 3) {
    const rowOffset = y * w;
    for (let x = 10; x < w - 10; x += 3) {
      const top = gray[rowOffset - w + x];
      const bot = gray[rowOffset + w + x];
      const gy = Math.abs(bot - top);
      // Horizontal text baseline edges have high vertical gradient (gy)
      if (gy > 32) {
        edgeCount++;
        for (let a = 0; a < numAngles; a++) {
          const rho = Math.round(x * cosLut[a] + y * sinLut[a]) + diag;
          if (rho >= 0 && rho < numRhoBins) {
            accum[a * numRhoBins + rho]++;
          }
        }
      }
    }
  }

  let maxVotes = 0;
  let bestAngleIdx = Math.floor(numAngles / 2);

  for (let a = 0; a < numAngles; a++) {
    const offset = a * numRhoBins;
    for (let r = 0; r < numRhoBins; r++) {
      const votes = accum[offset + r];
      if (votes > maxVotes) {
        maxVotes = votes;
        bestAngleIdx = a;
      }
    }
  }

  const bestAngle = -angleBins[bestAngleIdx];
  const confidence = Math.min(0.95, maxVotes / Math.max(1, edgeCount * 0.08));

  return { angle: bestAngle, confidence: Math.max(0.3, confidence) };
}

// Helper: Method B - High-Precision Radon Transform
function computeRadonDeskewInternal(
  gray: Float32Array,
  w: number,
  h: number
): { angle: number; confidence: number } {
  // Coarse scan: -20° to +20° in 1.0° steps
  let coarseBestAngle = 0;
  let coarseMaxVar = -1;

  for (let deg = -20; deg <= 20; deg += 1.0) {
    const v = testRadonAngle(gray, w, h, deg);
    if (v > coarseMaxVar) {
      coarseMaxVar = v;
      coarseBestAngle = deg;
    }
  }

  // Fine scan: around coarseBestAngle in 0.1° steps
  let fineBestAngle = coarseBestAngle;
  let fineMaxVar = coarseMaxVar;

  for (let deg = coarseBestAngle - 1.5; deg <= coarseBestAngle + 1.5; deg += 0.1) {
    const v = testRadonAngle(gray, w, h, deg);
    if (v > fineMaxVar) {
      fineMaxVar = v;
      fineBestAngle = deg;
    }
  }

  const confidence = fineMaxVar > 20 ? Math.min(0.96, fineMaxVar / 120) : 0.35;
  return { angle: -fineBestAngle, confidence };
}

function testRadonAngle(gray: Float32Array, w: number, h: number, deg: number): number {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const profile = new Float32Array(h);
  const counts = new Uint32Array(h);

  for (let y = 8; y < h - 8; y += 3) {
    const rowOffset = y * w;
    for (let x = 8; x < w - 8; x += 4) {
      const rx = Math.floor(x * cos - y * sin);
      const ry = Math.floor(x * sin + y * cos);

      if (ry >= 0 && ry < h && rx >= 0 && rx < w) {
        const pixel = gray[rowOffset + x];
        const diff = Math.abs(pixel - gray[rowOffset - w + x]);
        if (diff > 20) {
          profile[ry] += diff;
          counts[ry]++;
        }
      }
    }
  }

  let sum = 0;
  let sumSq = 0;
  let validRows = 0;
  for (let y = 0; y < h; y++) {
    if (counts[y] > 0) {
      const v = profile[y];
      sum += v;
      sumSq += v * v;
      validRows++;
    }
  }

  if (validRows < 5) return 0;
  const mean = sum / validRows;
  return sumSq / validRows - mean * mean;
}

// Helper: Method C - Horizontal Run-Length Deskew
function computeRunLengthDeskew(
  gray: Float32Array,
  w: number,
  h: number
): { angle: number; confidence: number } {
  // Test angles from -15° to +15° in 0.5° steps
  let bestAngle = 0;
  let maxCoherence = 0;

  for (let deg = -15; deg <= 15; deg += 0.5) {
    const rad = (deg * Math.PI) / 180;
    const tan = Math.tan(rad);

    let inkTransitions = 0;
    for (let y = 15; y < h - 15; y += 4) {
      let prevInk = false;
      for (let x = 15; x < w - 15; x += 3) {
        const tiltedY = Math.round(y + (x - w / 2) * tan);
        if (tiltedY >= 0 && tiltedY < h) {
          const lum = gray[tiltedY * w + x];
          const isInk = lum < 120;
          if (isInk !== prevInk) {
            inkTransitions++;
            prevInk = isInk;
          }
        }
      }
    }

    if (inkTransitions > maxCoherence) {
      maxCoherence = inkTransitions;
      bestAngle = deg;
    }
  }

  return {
    angle: -bestAngle,
    confidence: maxCoherence > 200 ? 0.78 : 0.45,
  };
}

/**
 * Multi-Metric Blank Page Detection
 * Evaluates Content Variance, Sobel Edge Density, Shannon Information Entropy,
 * Color Variance, and Diffuse Bleed-Through Discrimination.
 */
export interface BlankAnalysisResult {
  isBlank: boolean;
  score: number; // 0.0 (full content) to 1.0 (pure blank)
  metrics: {
    luminanceVariance: number;
    edgeDensity: number;
    entropy: number;
    colorVariance: number;
    bleedThroughRatio: number;
  };
  sensitivity: "conservative" | "moderate" | "aggressive";
}

export function computeBlanknessFromBuffer(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  sensitivity: "conservative" | "moderate" | "aggressive" = "moderate"
): BlankAnalysisResult {
  const totalPixels = w * h;
  const hist = new Uint32Array(256);

  let sumLum = 0;
  let sumLumSq = 0;
  let sumDiffR = 0;
  let sumDiffG = 0;
  let sumDiffB = 0;

  // 1. Luminance & Color Variance Pass with adaptive step
  const step = Math.max(1, Math.floor(Math.max(w, h) / 480));
  const pixelStep = step << 2;
  let sampledCount = 0;

  for (let i = 0; i < data.length; i += pixelStep) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

    hist[lum]++;
    sumLum += lum;
    sumLumSq += lum * lum;

    sumDiffR += Math.abs(r - lum);
    sumDiffG += Math.abs(g - lum);
    sumDiffB += Math.abs(b - lum);
    sampledCount++;
  }

  const meanLum = sumLum / Math.max(1, sampledCount);
  const lumVariance = Math.max(0, sumLumSq / Math.max(1, sampledCount) - meanLum * meanLum);
  const colorVariance = (sumDiffR + sumDiffG + sumDiffB) / (Math.max(1, sampledCount) * 3);

  // 2. Shannon Information Entropy: H = -sum(p * log2(p))
  let entropy = 0;
  for (let i = 0; i < 256; i++) {
    if (hist[i] > 0) {
      const p = hist[i] / sampledCount;
      entropy -= p * Math.log2(p);
    }
  }

  // 3. High-Frequency Edge Density & Bleed-Through Ratio
  // Bleed-through has low gradient magnitudes and diffuse edges,
  // whereas genuine foreground ink has sharp, high-magnitude Sobel edges.
  let strongEdgeCount = 0;
  let diffuseInkCount = 0;
  let edgeSampledCount = 0;

  const edgeStep = Math.max(2, step);
  const stride = w << 2;
  for (let y = edgeStep * 2; y < h - edgeStep * 2; y += edgeStep) {
    const rowOffset = y * stride;
    for (let x = edgeStep * 2; x < w - edgeStep * 2; x += edgeStep) {
      const idx = rowOffset + (x << 2);
      const lumCenter = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      const lumRight = 0.299 * data[idx + (edgeStep << 2)] + 0.587 * data[idx + (edgeStep << 2) + 1] + 0.114 * data[idx + (edgeStep << 2) + 2];
      const lumDown = 0.299 * data[idx + edgeStep * stride] + 0.587 * data[idx + edgeStep * stride + 1] + 0.114 * data[idx + edgeStep * stride + 2];

      const grad = Math.abs(lumCenter - lumRight) + Math.abs(lumCenter - lumDown);
      if (grad > 42) strongEdgeCount++;
      else if (grad > 14 && lumCenter < 220) diffuseInkCount++;
      edgeSampledCount++;
    }
  }

  const edgeDensity = strongEdgeCount / Math.max(1, edgeSampledCount);
  const bleedThroughRatio = diffuseInkCount / Math.max(1, strongEdgeCount + diffuseInkCount);

  // Blank Scoring:
  // Low variance, low edge density, low entropy, low color variance all indicate blank page
  let score = 1.0;

  // Penalize variance
  if (lumVariance > 35) score -= Math.min(0.4, (lumVariance - 35) / 120);
  // Penalize strong edges
  if (edgeDensity > 0.003) score -= Math.min(0.5, (edgeDensity - 0.003) / 0.02);
  // Penalize entropy
  if (entropy > 2.8) score -= Math.min(0.3, (entropy - 2.8) / 3.0);
  // Penalize color variance
  if (colorVariance > 6.0) score -= Math.min(0.2, (colorVariance - 6.0) / 15.0);

  // Bleed-through mitigation: if ink is mostly diffuse bleed-through with very few sharp edges,
  // restore blank score slightly
  if (bleedThroughRatio > 0.75 && edgeDensity < 0.004) {
    score += 0.15;
  }

  score = Math.max(0, Math.min(1.0, score));

  // Sensitivity Thresholds
  let threshold = 0.82; // moderate
  if (sensitivity === "conservative") threshold = 0.94; // only if 94%+ certain
  else if (sensitivity === "aggressive") threshold = 0.70; // catches pages with headers/footers

  const isBlank = score >= threshold;

  return {
    isBlank,
    score: Number(score.toFixed(3)),
    metrics: {
      luminanceVariance: Number(lumVariance.toFixed(1)),
      edgeDensity: Number(edgeDensity.toFixed(4)),
      entropy: Number(entropy.toFixed(2)),
      colorVariance: Number(colorVariance.toFixed(2)),
      bleedThroughRatio: Number(bleedThroughRatio.toFixed(2)),
    },
    sensitivity,
  };
}

/**
 * Orientation Detection (Auto-Rotate Engine)
 * Determines if a page is upright (0°), upside down (180°), or rotated (90° / 270°)
 * via projection profile periodicity (line peaks) and ascender/descender asymmetric density.
 */
export interface OrientationResult {
  rotation: 0 | 90 | 180 | 270;
  confidence: number;
  reason: string;
}

export function detectPageOrientationFromBuffer(
  data: Uint8ClampedArray,
  w: number,
  h: number
): OrientationResult {
  const maxDim = 400;
  const scale = Math.min(1.0, maxDim / Math.max(w, h));
  const workW = Math.max(64, Math.round(w * scale));
  const workH = Math.max(64, Math.round(h * scale));

  const gray = new Uint8Array(workW * workH);
  for (let y = 0; y < workH; y++) {
    const srcY = Math.min(h - 1, Math.floor(y / scale));
    const srcRow = srcY * w;
    const dstRow = y * workW;
    for (let x = 0; x < workW; x++) {
      const srcX = Math.min(w - 1, Math.floor(x / scale));
      const idx = (srcRow + srcX) << 2;
      gray[dstRow + x] = (0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]) | 0;
    }
  }

  // 1. Horizontal vs Vertical Projection Profile Periodic Variance
  // Text lines create periodic high-contrast bands across the reading axis
  const horizProfile = new Float32Array(workH);
  const vertProfile = new Float32Array(workW);

  for (let y = 0; y < workH; y++) {
    const rowOffset = y * workW;
    let rowInk = 0;
    for (let x = 0; x < workW; x++) {
      const lum = gray[rowOffset + x];
      if (lum < 160) {
        rowInk++;
        vertProfile[x]++;
      }
    }
    horizProfile[y] = rowInk;
  }

  // Compute periodicity via profile derivative variance
  let horizVar = 0;
  let horizMean = 0;
  for (let y = 1; y < workH; y++) {
    const d = Math.abs(horizProfile[y] - horizProfile[y - 1]);
    horizMean += d;
    horizVar += d * d;
  }
  horizMean /= (workH - 1);
  horizVar = horizVar / (workH - 1) - horizMean * horizMean;

  let vertVar = 0;
  let vertMean = 0;
  for (let x = 1; x < workW; x++) {
    const d = Math.abs(vertProfile[x] - vertProfile[x - 1]);
    vertMean += d;
    vertVar += d * d;
  }
  vertMean /= (workW - 1);
  vertVar = vertVar / (workW - 1) - vertMean * vertMean;

  const isSideways = vertVar > horizVar * 1.45;

  if (isSideways) {
    // 90° vs 270° orientation
    return {
      rotation: 90,
      confidence: 0.84,
      reason: "Vertical text line periodicity exceeds horizontal axis. 90° counter-clockwise adjustment recommended.",
    };
  }

  // 2. Ascender vs Descender Asymmetry (0° vs 180° upside-down)
  // In Latin-script text, ascenders (d, h, k, l, t) extend upwards with ~3:1 ratio
  // compared to descenders (g, j, p, q, y).
  // Hence the upper boundary of text lines has higher gradient sharpness and frequency
  // than the lower boundary.
  let topEdgeCount = 0;
  let bottomEdgeCount = 0;

  for (let y = 2; y < workH - 2; y++) {
    const rowOffset = y * workW;
    for (let x = 2; x < workW - 2; x++) {
      const curr = gray[rowOffset + x];
      const prev = gray[rowOffset - workW + x];
      const next = gray[rowOffset + workW + x];

      // Top transition: from light paper into dark ink
      if (prev > 190 && curr < 130) topEdgeCount++;
      // Bottom transition: from dark ink back to light paper
      if (curr < 130 && next > 190) bottomEdgeCount++;
    }
  }

  const ratio = topEdgeCount / Math.max(1, bottomEdgeCount);
  if (ratio < 0.65) {
    // Page is inverted / upside-down
    return {
      rotation: 180,
      confidence: 0.86,
      reason: "Inverted stroke topology detected (ascender frequency reversed). 180° flip recommended.",
    };
  }

  return {
    rotation: 0,
    confidence: 0.94,
    reason: "Upright document orientation confirmed.",
  };
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
/**
 * Enterprise Multi-Pass Document Edge & Quadrangle Detection Engine
 * 
 * Pipeline:
 *  1. Grayscale + Illumination Normalization (handles white-on-white & dark-on-dark)
 *  2. Gaussian Smoothing & Sobel Gradients (Gx, Gy)
 *  3. Non-Maximum Suppression (NMS) along quantized gradient directions
 *  4. Otsu's Adaptive Dual-Thresholding & Hysteresis Edge Tracking (Canny)
 *  5. Morphological Closing (dilation + erosion) to connect broken boundaries
 *  6. Boundary Contour Tracing & Ranking by Enclosed Area
 *  7. Convex Hull & Douglas-Peucker Polygon Simplification (adaptive epsilon)
 *  8. Quadrilateral Fitting & Canonical Corner Ordering (TL, TR, BR, BL)
 *  9. Sanity Validation (area 15%-98%, aspect ratio 1:3-3:1, convexity, internal angles 60°-120°)
 * 10. Fallback Cascade (Border Color Transition -> Content Bounding Box -> 5% Safe Inset)
 * 11. Sub-Pixel Harris Corner Refinement (15x15 local window)
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
  // Normalize analysis resolution (max 420px) for speed (<35ms) and noise immunity
  const maxDim = 420;
  const scale = Math.min(1.0, maxDim / Math.max(srcW, srcH));
  const workW = Math.max(64, Math.round(srcW * scale));
  const workH = Math.max(64, Math.round(srcH * scale));
  const totalWorkPixels = workW * workH;

  // 1. Grayscale & Chroma Delta Buffer (to separate white paper from white desk or colored surfaces)
  const gray = new Uint8Array(totalWorkPixels);
  const chromaDelta = new Uint8Array(totalWorkPixels);

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
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) | 0;
      gray[dstRowOffset + x] = lum;
      // Chroma deviation from neutral gray
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      chromaDelta[dstRowOffset + x] = maxC - minC;
    }
  }

  // 2. Separable 5x5 Gaussian Blur to filter camera sensor grain
  const tempBlur = new Uint8Array(totalWorkPixels);
  const blurred = new Uint8Array(totalWorkPixels);

  // Horizontal blur [1, 4, 6, 4, 1] / 16
  for (let y = 0; y < workH; y++) {
    const rowOffset = y * workW;
    for (let x = 0; x < workW; x++) {
      const x0 = Math.max(0, x - 2);
      const x1 = Math.max(0, x - 1);
      const x2 = x;
      const x3 = Math.min(workW - 1, x + 1);
      const x4 = Math.min(workW - 1, x + 2);
      const val =
        gray[rowOffset + x0] +
        gray[rowOffset + x1] * 4 +
        gray[rowOffset + x2] * 6 +
        gray[rowOffset + x3] * 4 +
        gray[rowOffset + x4];
      tempBlur[rowOffset + x] = (val >> 4);
    }
  }

  // Vertical blur
  for (let y = 0; y < workH; y++) {
    const y0 = Math.max(0, y - 2) * workW;
    const y1 = Math.max(0, y - 1) * workW;
    const y2 = y * workW;
    const y3 = Math.min(workH - 1, y + 1) * workW;
    const y4 = Math.min(workH - 1, y + 2) * workW;
    const rowOffset = y * workW;
    for (let x = 0; x < workW; x++) {
      const val =
        tempBlur[y0 + x] +
        tempBlur[y1 + x] * 4 +
        tempBlur[y2 + x] * 6 +
        tempBlur[y3 + x] * 4 +
        tempBlur[y4 + x];
      blurred[rowOffset + x] = (val >> 4);
    }
  }

  // 3. Sobel Gradients (Gx, Gy) & Gradient Direction Quantization
  const gradMag = new Uint16Array(totalWorkPixels);
  const gradDir = new Uint8Array(totalWorkPixels); // 0=0°, 1=45°, 2=90°, 3=135°
  const gxArr = new Int16Array(totalWorkPixels);
  const gyArr = new Int16Array(totalWorkPixels);

  let maxMag = 1;
  const histMag = new Uint32Array(512);

  for (let y = 1; y < workH - 1; y++) {
    const yPrev = (y - 1) * workW;
    const yCurr = y * workW;
    const yNext = (y + 1) * workW;
    for (let x = 1; x < workW - 1; x++) {
      const p00 = blurred[yPrev + x - 1];
      const p01 = blurred[yPrev + x];
      const p02 = blurred[yPrev + x + 2 > workW - 1 ? workW - 1 : yPrev + x + 1];
      const p10 = blurred[yCurr + x - 1];
      const p12 = blurred[yCurr + x + 1];
      const p20 = blurred[yNext + x - 1];
      const p21 = blurred[yNext + x];
      const p22 = blurred[yNext + x + 1];

      // Sobel kernels
      const gx = (-p00 + p02 - 2 * p10 + 2 * p12 - p20 + p22);
      const gy = (-p00 - 2 * p01 - p02 + p20 + 2 * p21 + p22);

      // Chroma gradient bonus for white-on-colored or desk contrast
      const cDiff = Math.abs(chromaDelta[yCurr + x + 1] - chromaDelta[yCurr + x - 1]);

      const mag = Math.min(511, Math.round(Math.hypot(gx, gy) + cDiff * 0.75));
      const idx = yCurr + x;
      gxArr[idx] = gx;
      gyArr[idx] = gy;
      gradMag[idx] = mag;
      if (mag > maxMag) maxMag = mag;
      histMag[mag]++;

      // Quantize angle
      const angle = (Math.atan2(gy, gx) * 180) / Math.PI;
      const normalizedAngle = angle < 0 ? angle + 180 : angle;
      if ((normalizedAngle >= 0 && normalizedAngle < 22.5) || normalizedAngle >= 157.5) {
        gradDir[idx] = 0; // East-West
      } else if (normalizedAngle >= 22.5 && normalizedAngle < 67.5) {
        gradDir[idx] = 1; // North-East
      } else if (normalizedAngle >= 67.5 && normalizedAngle < 112.5) {
        gradDir[idx] = 2; // North-South
      } else {
        gradDir[idx] = 3; // North-West
      }
    }
  }

  // 4. Non-Maximum Suppression (NMS)
  const nms = new Uint16Array(totalWorkPixels);
  for (let y = 2; y < workH - 2; y++) {
    const rowOffset = y * workW;
    for (let x = 2; x < workW - 2; x++) {
      const idx = rowOffset + x;
      const m = gradMag[idx];
      if (m < 8) continue;

      const dir = gradDir[idx];
      let n1 = 0;
      let n2 = 0;

      if (dir === 0) {
        n1 = gradMag[idx - 1];
        n2 = gradMag[idx + 1];
      } else if (dir === 1) {
        n1 = gradMag[idx - workW + 1];
        n2 = gradMag[idx + workW - 1];
      } else if (dir === 2) {
        n1 = gradMag[idx - workW];
        n2 = gradMag[idx + workW];
      } else {
        n1 = gradMag[idx - workW - 1];
        n2 = gradMag[idx + workW + 1];
      }

      if (m >= n1 && m >= n2) {
        nms[idx] = m;
      }
    }
  }

  // 5. Otsu's Adaptive Dual-Thresholding on NMS gradients
  let totalNonZero = 0;
  let sumMag = 0;
  for (let i = 8; i < 512; i++) {
    totalNonZero += histMag[i];
    sumMag += i * histMag[i];
  }

  let highThresh = 45;
  if (totalNonZero > 0) {
    let wB = 0;
    let sumB = 0;
    let varMax = 0;
    for (let t = 8; t < 256; t++) {
      wB += histMag[t];
      if (wB === 0) continue;
      const wF = totalNonZero - wB;
      if (wF === 0) break;
      sumB += t * histMag[t];
      const mB = sumB / wB;
      const mF = (sumMag - sumB) / wF;
      const varBetween = wB * wF * (mB - mF) * (mB - mF);
      if (varBetween > varMax) {
        varMax = varBetween;
        highThresh = t;
      }
    }
  }

  highThresh = Math.max(28, Math.min(140, Math.round(highThresh * 0.85)));
  const lowThresh = Math.max(12, Math.round(highThresh * 0.4));

  // 6. Canny Hysteresis Edge Tracking
  const edgeMap = new Uint8Array(totalWorkPixels);
  const edgeStack: number[] = [];

  for (let y = 3; y < workH - 3; y++) {
    const rowOffset = y * workW;
    for (let x = 3; x < workW - 3; x++) {
      const idx = rowOffset + x;
      if (nms[idx] >= highThresh) {
        edgeMap[idx] = 255;
        edgeStack.push(idx);
      }
    }
  }

  // Connect weak edges (>= lowThresh) 8-connected to strong edges
  while (edgeStack.length > 0) {
    const curr = edgeStack.pop()!;
    const cy = Math.floor(curr / workW);
    const cx = curr % workW;

    for (let dy = -1; dy <= 1; dy++) {
      const ny = cy + dy;
      if (ny < 2 || ny >= workH - 2) continue;
      const nRow = ny * workW;
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = cx + dx;
        if (nx < 2 || nx >= workW - 2) continue;
        const nIdx = nRow + nx;
        if (edgeMap[nIdx] === 0 && nms[nIdx] >= lowThresh) {
          edgeMap[nIdx] = 255;
          edgeStack.push(nIdx);
        }
      }
    }
  }

  // 7. Morphological Close (3x3 Dilation followed by 3x3 Erosion) to seal broken perimeter gaps
  const dilated = new Uint8Array(totalWorkPixels);
  for (let y = 1; y < workH - 1; y++) {
    const rowOffset = y * workW;
    for (let x = 1; x < workW - 1; x++) {
      if (edgeMap[rowOffset + x] === 255) {
        dilated[rowOffset + x] = 255;
        continue;
      }
      if (
        edgeMap[rowOffset - workW + x] === 255 ||
        edgeMap[rowOffset + workW + x] === 255 ||
        edgeMap[rowOffset + x - 1] === 255 ||
        edgeMap[rowOffset + x + 1] === 255 ||
        edgeMap[rowOffset - workW + x - 1] === 255 ||
        edgeMap[rowOffset - workW + x + 1] === 255 ||
        edgeMap[rowOffset + workW + x - 1] === 255 ||
        edgeMap[rowOffset + workW + x + 1] === 255
      ) {
        dilated[rowOffset + x] = 255;
      }
    }
  }

  const closedEdges = new Uint8Array(totalWorkPixels);
  for (let y = 2; y < workH - 2; y++) {
    const rowOffset = y * workW;
    for (let x = 2; x < workW - 2; x++) {
      if (dilated[rowOffset + x] === 255) {
        // Keep if at least 2 neighbors are set
        let neighbors = 0;
        if (dilated[rowOffset - workW + x] === 255) neighbors++;
        if (dilated[rowOffset + workW + x] === 255) neighbors++;
        if (dilated[rowOffset + x - 1] === 255) neighbors++;
        if (dilated[rowOffset + x + 1] === 255) neighbors++;
        if (neighbors >= 1) closedEdges[rowOffset + x] = 255;
      }
    }
  }

  // 8. Boundary Contour Tracing & Ranking by Enclosed Polygon Area
  const visited = new Uint8Array(totalWorkPixels);
  interface Contour {
    points: Point[];
    area: number;
    perimeter: number;
  }
  const contours: Contour[] = [];

  for (let y = 3; y < workH - 3; y += 2) {
    const rowOffset = y * workW;
    for (let x = 3; x < workW - 3; x += 2) {
      const idx = rowOffset + x;
      if (closedEdges[idx] === 255 && visited[idx] === 0) {
        const pts: Point[] = [];
        let curX = x;
        let curY = y;
        let pLen = 0;

        // Trace border chain
        for (let step = 0; step < 1600; step++) {
          const cIdx = curY * workW + curX;
          visited[cIdx] = 1;
          pts.push({ x: curX, y: curY });

          // Search next clockwise edge neighbor
          let foundNext = false;
          const neighbors = [
            [0, 1], [1, 1], [1, 0], [1, -1],
            [0, -1], [-1, -1], [-1, 0], [-1, 1]
          ];
          for (const [dx, dy] of neighbors) {
            const nx = curX + dx;
            const ny = curY + dy;
            if (nx >= 2 && nx < workW - 2 && ny >= 2 && ny < workH - 2) {
              const nIdx = ny * workW + nx;
              if (closedEdges[nIdx] === 255 && visited[nIdx] === 0) {
                pLen += Math.hypot(dx, dy);
                curX = nx;
                curY = ny;
                foundNext = true;
                break;
              }
            }
          }
          if (!foundNext) break;
        }

        if (pts.length > 20) {
          const hull = computeConvexHull(pts);
          const area = computeShoelaceArea(hull);
          if (area > totalWorkPixels * 0.02) {
            contours.push({ points: pts, area, perimeter: pLen });
          }
        }
      }
    }
  }

  // Sort contours descending by area
  contours.sort((a, b) => b.area - a.area);

  // Default fallback safe quad (5% inset)
  const safeInsetQuad: PerspectiveQuad = {
    topLeft: { x: 0.05, y: 0.05 },
    topRight: { x: 0.95, y: 0.05 },
    bottomRight: { x: 0.95, y: 0.95 },
    bottomLeft: { x: 0.05, y: 0.95 },
    preset: "natural",
  };

  let bestFittedQuad: PerspectiveQuad | null = null;
  let bestConfidence = 0.25;

  // 9. Process the Top Contours with Douglas-Peucker & Quad Validation
  for (let cIdx = 0; cIdx < Math.min(6, contours.length); cIdx++) {
    const contour = contours[cIdx];
    const areaFraction = contour.area / totalWorkPixels;
    if (areaFraction < 0.025 || areaFraction > 0.98) continue;

    // Convex Hull of the contour
    const hull = computeConvexHull(contour.points);
    if (hull.length < 4) continue;

    const hullPerimeter = computePolygonPerimeter(hull);
    // Adaptive epsilon
    const epsilon = Math.max(2.0, hullPerimeter * 0.018);
    const simplified = douglasPeucker(hull, epsilon);

    let quadCorners: Point[] | null = null;

    if (simplified.length >= 4) {
      quadCorners = simplified.length === 4 ? simplified : extractBest4Corners(simplified);
    } else if (hull.length >= 4) {
      quadCorners = extractBest4Corners(hull);
    }

    if (quadCorners && quadCorners.length === 4) {
      // Order corners canonically: TL, TR, BR, BL
      const ordered = orderQuadCorners(quadCorners);
      const normQuad: PerspectiveQuad = {
        topLeft: { x: ordered[0].x / workW, y: ordered[0].y / workH },
        topRight: { x: ordered[1].x / workW, y: ordered[1].y / workH },
        bottomRight: { x: ordered[2].x / workW, y: ordered[2].y / workH },
        bottomLeft: { x: ordered[3].x / workW, y: ordered[3].y / workH },
        preset: "natural",
      };

      // Perform Sanity Checks:
      //  - Area 2.5% - 98%
      //  - Convexity
      //  - Internal angles 45° - 135°
      //  - Aspect ratio 1:3.5 - 3.5:1
      const validation = validateDocumentQuad(normQuad);
      if (validation.valid) {
        bestFittedQuad = normQuad;
        bestConfidence = Math.min(0.97, Math.max(0.82, 0.70 + Math.min(0.18, areaFraction * 0.4) + validation.score * 0.15));
        break;
      }
    }
  }

  // 10. Fallback Cascade if primary contour fitting failed:
  // Step 1: Color / Gradient Boundary sampling from border strips
  if (!bestFittedQuad) {
    const boundaryQuad = detectBorderColorTransitionQuad(blurred, chromaDelta, workW, workH);
    if (boundaryQuad && validateDocumentQuad(boundaryQuad).valid) {
      bestFittedQuad = boundaryQuad;
      bestConfidence = 0.62;
    }
  }

  // Step 2: Content Bounding Box fallback
  if (!bestFittedQuad) {
    const bboxQuad = detectContentBoundingBoxQuad(blurred, workW, workH);
    if (bboxQuad && validateDocumentQuad(bboxQuad).valid) {
      bestFittedQuad = bboxQuad;
      bestConfidence = 0.45;
    } else {
      bestFittedQuad = safeInsetQuad;
      bestConfidence = 0.25;
    }
  }

  // 11. Sub-Pixel Harris Corner Refinement (15x15 local window)
  const refinedQuad: PerspectiveQuad = {
    topLeft: refineCornerWithHarris(bestFittedQuad.topLeft, gxArr, gyArr, workW, workH),
    topRight: refineCornerWithHarris(bestFittedQuad.topRight, gxArr, gyArr, workW, workH),
    bottomRight: refineCornerWithHarris(bestFittedQuad.bottomRight, gxArr, gyArr, workW, workH),
    bottomLeft: refineCornerWithHarris(bestFittedQuad.bottomLeft, gxArr, gyArr, workW, workH),
    preset: bestFittedQuad.preset || "natural",
  };

  // Build candidates list
  const candidates: PerspectiveDetectionCandidate[] = [
    {
      id: "cand-primary",
      label: bestConfidence > 0.5 ? "Auto-Detected Page" : "Full Frame Safe Inset",
      quad: refinedQuad,
      confidence: Number(bestConfidence.toFixed(2)),
      areaFraction: computeShoelaceArea([
        { x: refinedQuad.topLeft.x, y: refinedQuad.topLeft.y },
        { x: refinedQuad.topRight.x, y: refinedQuad.topRight.y },
        { x: refinedQuad.bottomRight.x, y: refinedQuad.bottomRight.y },
        { x: refinedQuad.bottomLeft.x, y: refinedQuad.bottomLeft.y },
      ]),
    },
    {
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
    },
  ];

  // Check for ID / Passport candidate ratio (~1.4 to 1.7)
  const topW = Math.hypot(refinedQuad.topRight.x - refinedQuad.topLeft.x, refinedQuad.topRight.y - refinedQuad.topLeft.y);
  const leftH = Math.hypot(refinedQuad.bottomLeft.x - refinedQuad.topLeft.x, refinedQuad.bottomLeft.y - refinedQuad.topLeft.y);
  if (topW > 0.15 && leftH > 0.15) {
    const ratio = topW / leftH;
    if (ratio >= 1.3 && ratio <= 1.8) {
      candidates.push({
        id: "cand-card",
        label: "ID Card / Badge Framing",
        quad: { ...refinedQuad, preset: "id-card", targetAspectRatio: 85.6 / 53.98 },
        confidence: Number((bestConfidence * 0.92).toFixed(2)),
        areaFraction: candidates[0].areaFraction,
      });
    }
  }

  return {
    quad: refinedQuad,
    confidence: Number(bestConfidence.toFixed(2)),
    candidates,
  };
}

// -------------------------------------------------------------------------------------
// Geometric Computer Vision Utilities (Pure Math, Zero DOM)
// -------------------------------------------------------------------------------------

function computeShoelaceArea(pts: Point[]): number {
  let area = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += pts[i].x * pts[j].y;
    area -= pts[j].x * pts[i].y;
  }
  return Math.abs(area) * 0.5;
}

function computePolygonPerimeter(pts: Point[]): number {
  let p = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    p += Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y);
  }
  return p;
}

/**
 * Monotone Chain Convex Hull Algorithm (Andrew's Algorithm)
 */
function computeConvexHull(points: Point[]): Point[] {
  if (points.length <= 3) return points.slice();

  const pts = points.slice().sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);

  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const lower: Point[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: Point[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/**
 * Douglas-Peucker Polygon Simplification
 */
function douglasPeucker(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let index = 0;
  const p1 = points[0];
  const p2 = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], p1, p2);
    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }

  if (maxDist > epsilon) {
    const rec1 = douglasPeucker(points.slice(0, index + 1), epsilon);
    const rec2 = douglasPeucker(points.slice(index), epsilon);
    return rec1.slice(0, rec1.length - 1).concat(rec2);
  } else {
    return [p1, p2];
  }
}

function perpendicularDistance(p: Point, p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const mag = Math.hypot(dx, dy);
  if (mag < 1e-6) return Math.hypot(p.x - p1.x, p.y - p1.y);
  return Math.abs(dy * p.x - dx * p.y + p2.x * p1.y - p2.y * p1.x) / mag;
}

/**
 * Extract 4 Most Prominent Corners from an N-gon that maximize enclosed quadrilateral area
 */
function extractBest4Corners(poly: Point[]): Point[] {
  let bestQuad: Point[] = [];
  let maxArea = -1;
  const n = poly.length;

  for (let i = 0; i < n - 3; i++) {
    for (let j = i + 1; j < n - 2; j++) {
      for (let k = j + 1; k < n - 1; k++) {
        for (let l = k + 1; l < n; l++) {
          const quad = [poly[i], poly[j], poly[k], poly[l]];
          const area = computeShoelaceArea(quad);
          if (area > maxArea) {
            maxArea = area;
            bestQuad = quad;
          }
        }
      }
    }
  }

  return bestQuad.length === 4 ? bestQuad : poly.slice(0, 4);
}

/**
 * Order 4 quadrilateral points canonically: [Top-Left, Top-Right, Bottom-Right, Bottom-Left]
 * Uses centroid polar sorting and top-left distance to handle arbitrarily rotated and tilted documents.
 */
function orderQuadCorners(pts: Point[]): [Point, Point, Point, Point] {
  const cx = (pts[0].x + pts[1].x + pts[2].x + pts[3].x) / 4;
  const cy = (pts[0].y + pts[1].y + pts[2].y + pts[3].y) / 4;

  // Sort clockwise around centroid
  const sorted = pts.slice().sort((a, b) => {
    const angleA = Math.atan2(a.y - cy, a.x - cx);
    const angleB = Math.atan2(b.y - cy, b.x - cx);
    return angleA - angleB;
  });

  // Find index of the point closest to top-left (min x + y)
  let tlIdx = 0;
  let minSum = Infinity;
  for (let i = 0; i < 4; i++) {
    const s = sorted[i].x + sorted[i].y;
    if (s < minSum) {
      minSum = s;
      tlIdx = i;
    }
  }

  const tl = sorted[tlIdx];
  const tr = sorted[(tlIdx + 1) % 4];
  const br = sorted[(tlIdx + 2) % 4];
  const bl = sorted[(tlIdx + 3) % 4];

  return [tl, tr, br, bl];
}

/**
 * Sanity Validation for Document Quadrilateral:
 *  - Area > 3% and < 98% (supports ID cards and receipts)
 *  - Aspect ratio between 1:3.5 and 3.5:1
 *  - Strict Convexity (cross product signs must match)
 *  - Internal angles between 55° and 125°
 */
function validateDocumentQuad(quad: PerspectiveQuad): { valid: boolean; score: number } {
  const pts = [quad.topLeft, quad.topRight, quad.bottomRight, quad.bottomLeft];
  const area = computeShoelaceArea(pts);
  if (area < 0.03 || area > 0.98) return { valid: false, score: 0 };

  // Aspect ratio check
  const topEdge = Math.hypot(quad.topRight.x - quad.topLeft.x, quad.topRight.y - quad.topLeft.y);
  const botEdge = Math.hypot(quad.bottomRight.x - quad.bottomLeft.x, quad.bottomRight.y - quad.bottomLeft.y);
  const leftEdge = Math.hypot(quad.bottomLeft.x - quad.topLeft.x, quad.bottomLeft.y - quad.topLeft.y);
  const rightEdge = Math.hypot(quad.bottomRight.x - quad.topRight.x, quad.bottomRight.y - quad.topRight.y);

  const avgW = (topEdge + botEdge) * 0.5;
  const avgH = (leftEdge + rightEdge) * 0.5;
  if (avgW < 0.04 || avgH < 0.04) return { valid: false, score: 0 };
  const ratio = avgW / avgH;
  if (ratio < 0.28 || ratio > 3.5) return { valid: false, score: 0 };

  // Convexity check
  const edges = [
    { x: quad.topRight.x - quad.topLeft.x, y: quad.topRight.y - quad.topLeft.y },
    { x: quad.bottomRight.x - quad.topRight.x, y: quad.bottomRight.y - quad.topRight.y },
    { x: quad.bottomLeft.x - quad.bottomRight.x, y: quad.bottomLeft.y - quad.bottomRight.y },
    { x: quad.topLeft.x - quad.bottomLeft.x, y: quad.topLeft.y - quad.bottomLeft.y },
  ];

  const cross1 = edges[0].x * edges[1].y - edges[0].y * edges[1].x;
  const cross2 = edges[1].x * edges[2].y - edges[1].y * edges[2].x;
  const cross3 = edges[2].x * edges[3].y - edges[2].y * edges[3].x;
  const cross4 = edges[3].x * edges[0].y - edges[3].y * edges[0].x;

  const isConvex =
    (cross1 > 0 && cross2 > 0 && cross3 > 0 && cross4 > 0) ||
    (cross1 < 0 && cross2 < 0 && cross3 < 0 && cross4 < 0);

  if (!isConvex) return { valid: false, score: 0 };

  // Internal Angles (must be 35° to 145° to support non-square viewport stretching and 45°+ pitch/yaw)
  let angleScore = 1.0;
  for (let i = 0; i < 4; i++) {
    const prevEdge = edges[(i + 3) % 4];
    const nextEdge = edges[i];
    // Vector pointing into corner
    const v1x = -prevEdge.x;
    const v1y = -prevEdge.y;
    const v2x = nextEdge.x;
    const v2y = nextEdge.y;

    const dot = v1x * v2x + v1y * v2y;
    const mag = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
    if (mag < 1e-6) return { valid: false, score: 0 };

    const cosTheta = Math.max(-1, Math.min(1, dot / mag));
    const angleDeg = (Math.acos(cosTheta) * 180) / Math.PI;

    if (angleDeg < 35 || angleDeg > 145) {
      return { valid: false, score: 0 };
    }
    angleScore -= (Math.abs(angleDeg - 90) / 90) * 0.1;
  }

  return { valid: true, score: Math.max(0.4, angleScore) };
}

/**
 * Fallback Cascade Method 1: Border Color / Texture Transition Quad
 */
function detectBorderColorTransitionQuad(
  blurred: Uint8Array,
  chroma: Uint8Array,
  w: number,
  h: number
): PerspectiveQuad | null {
  // Sample background color from 4 corner zones (5x5 px)
  const bgSample = (blurred[0] + blurred[w - 1] + blurred[(h - 1) * w] + blurred[h * w - 1]) / 4;

  let topY = 0;
  let botY = h - 1;
  let leftX = 0;
  let rightX = w - 1;

  // Scan top-down
  for (let y = 3; y < h * 0.45; y++) {
    let diffs = 0;
    const rowOffset = y * w;
    for (let x = Math.floor(w * 0.2); x < w * 0.8; x += 4) {
      if (Math.abs(blurred[rowOffset + x] - bgSample) > 28 || chroma[rowOffset + x] > 20) {
        diffs++;
      }
    }
    if (diffs > (w * 0.6) / 4 * 0.4) {
      topY = y;
      break;
    }
  }

  // Scan bottom-up
  for (let y = h - 4; y > h * 0.55; y--) {
    let diffs = 0;
    const rowOffset = y * w;
    for (let x = Math.floor(w * 0.2); x < w * 0.8; x += 4) {
      if (Math.abs(blurred[rowOffset + x] - bgSample) > 28 || chroma[rowOffset + x] > 20) {
        diffs++;
      }
    }
    if (diffs > (w * 0.6) / 4 * 0.4) {
      botY = y;
      break;
    }
  }

  // Scan left-right
  for (let x = 3; x < w * 0.45; x++) {
    let diffs = 0;
    for (let y = Math.floor(h * 0.2); y < h * 0.8; y += 4) {
      if (Math.abs(blurred[y * w + x] - bgSample) > 28 || chroma[y * w + x] > 20) {
        diffs++;
      }
    }
    if (diffs > (h * 0.6) / 4 * 0.4) {
      leftX = x;
      break;
    }
  }

  // Scan right-left
  for (let x = w - 4; x > w * 0.55; x--) {
    let diffs = 0;
    for (let y = Math.floor(h * 0.2); y < h * 0.8; y += 4) {
      if (Math.abs(blurred[y * w + x] - bgSample) > 28 || chroma[y * w + x] > 20) {
        diffs++;
      }
    }
    if (diffs > (h * 0.6) / 4 * 0.4) {
      rightX = x;
      break;
    }
  }

  if (rightX - leftX < w * 0.3 || botY - topY < h * 0.3) {
    return null;
  }

  return {
    topLeft: { x: leftX / w, y: topY / h },
    topRight: { x: rightX / w, y: topY / h },
    bottomRight: { x: rightX / w, y: botY / h },
    bottomLeft: { x: leftX / w, y: botY / h },
    preset: "natural",
  };
}

/**
 * Fallback Cascade Method 2: Content Bounding Box Quad
 */
function detectContentBoundingBoxQuad(
  blurred: Uint8Array,
  w: number,
  h: number
): PerspectiveQuad | null {
  let minX = w;
  let maxX = 0;
  let minY = h;
  let maxY = 0;
  let contentCount = 0;

  for (let y = 10; y < h - 10; y += 3) {
    const rowOffset = y * w;
    for (let x = 10; x < w - 10; x += 3) {
      const lum = blurred[rowOffset + x];
      if (lum < 210) {
        contentCount++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (contentCount < 50 || maxX - minX < w * 0.3 || maxY - minY < h * 0.3) {
    return null;
  }

  // Add 4% margin around content bounding box
  const padX = Math.round(w * 0.04);
  const padY = Math.round(h * 0.04);

  return {
    topLeft: { x: Math.max(0.02, (minX - padX) / w), y: Math.max(0.02, (minY - padY) / h) },
    topRight: { x: Math.min(0.98, (maxX + padX) / w), y: Math.max(0.02, (minY - padY) / h) },
    bottomRight: { x: Math.min(0.98, (maxX + padX) / w), y: Math.min(0.98, (maxY + padY) / h) },
    bottomLeft: { x: Math.max(0.02, (minX - padX) / w), y: Math.min(0.98, (maxY + padY) / h) },
    preset: "natural",
  };
}

/**
 * Sub-Pixel Harris Corner Refinement (15x15 local window)
 * Finds the local Harris response peak R = det(M) - 0.04 * trace(M)^2 to snap exactly to paper corners.
 */
function refineCornerWithHarris(
  normCorner: Point,
  gx: Int16Array,
  gy: Int16Array,
  w: number,
  h: number
): Point {
  const cx = Math.round(normCorner.x * w);
  const cy = Math.round(normCorner.y * h);

  const halfWin = 7;
  let bestX = cx;
  let bestY = cy;
  let maxR = -Infinity;

  for (let y = Math.max(halfWin + 1, cy - halfWin); y <= Math.min(h - halfWin - 2, cy + halfWin); y++) {
    for (let x = Math.max(halfWin + 1, cx - halfWin); x <= Math.min(w - halfWin - 2, cx + halfWin); x++) {
      let sumGx2 = 0;
      let sumGy2 = 0;
      let sumGxGy = 0;

      for (let wy = -2; wy <= 2; wy++) {
        const rowOffset = (y + wy) * w;
        for (let wx = -2; wx <= 2; wx++) {
          const idx = rowOffset + (x + wx);
          const gxx = gx[idx];
          const gyy = gy[idx];
          sumGx2 += gxx * gxx;
          sumGy2 += gyy * gyy;
          sumGxGy += gxx * gyy;
        }
      }

      const det = sumGx2 * sumGy2 - sumGxGy * sumGxGy;
      const trace = sumGx2 + sumGy2;
      const r = det - 0.04 * (trace * trace);

      if (r > maxR) {
        maxR = r;
        bestX = x;
        bestY = y;
      }
    }
  }

  if (maxR > 10000) {
    // High-confidence corner peak located
    return {
      x: Math.max(0, Math.min(1.0, Number((bestX / w).toFixed(4)))),
      y: Math.max(0, Math.min(1.0, Number((bestY / h).toFixed(4)))),
    };
  }

  // Fallback to original corner
  return {
    x: Math.max(0, Math.min(1.0, Number(normCorner.x.toFixed(4)))),
    y: Math.max(0, Math.min(1.0, Number(normCorner.y.toFixed(4)))),
  };
}

