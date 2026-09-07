/**
 * OMNISCAN TITAN X - Automatic Color Grading & Optical Tone Detection Engine
 * High-Speed Histogram Analysis for Auto-Enhance, Dynamic Contrast & Paper Whitening
 */

import { ImageFilterPipeline } from "../types";

export interface AutoColorAnalysisResult {
  meanLuminance: number;
  darkPoint: number; // 5th percentile
  whitePoint: number; // 95th percentile
  contrastSpread: number;
  averageSaturation: number;
  isDocument: boolean;
  hasDarkBackground: boolean;
  recommendedFilters: Partial<ImageFilterPipeline>;
  summary: string;
}

/**
 * Analyzes an image source (data URL, HTMLImageElement, or HTMLCanvasElement)
 * and calculates optimal non-destructive color grading adjustments.
 */
export async function analyzeImageAndComputeAutoGrade(
  imageSource: string | HTMLImageElement | HTMLCanvasElement
): Promise<AutoColorAnalysisResult> {
  let imgElement: HTMLImageElement | HTMLCanvasElement;

  if (typeof imageSource === "string") {
    imgElement = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
      img.src = imageSource;
    });
  } else {
    imgElement = imageSource;
  }

  // Create an offscreen canvas sampled down to 256x256 for sub-5ms instant analysis
  const sampleSize = 256;
  const canvas = document.createElement("canvas");
  canvas.width = sampleSize;
  canvas.height = sampleSize;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  if (!ctx) {
    throw new Error("Could not create 2D canvas context for color grading analysis.");
  }

  ctx.drawImage(imgElement, 0, 0, sampleSize, sampleSize);
  const imgData = ctx.getImageData(0, 0, sampleSize, sampleSize);
  const data = imgData.data;
  const totalPixels = sampleSize * sampleSize;

  // Compute Luminance Histogram and Color Saturation
  const histogram = new Uint32Array(256);
  let totalLuminance = 0;
  let totalSaturation = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Standard ITU-R BT.601 perceptual luminance
    const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    histogram[lum]++;
    totalLuminance += lum;

    // Saturation calculation
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    const sat = max === 0 ? 0 : delta / max;
    totalSaturation += sat;
  }

  const meanLuminance = totalLuminance / totalPixels;
  const averageSaturation = (totalSaturation / totalPixels) * 100;

  // Cumulative distribution for percentiles
  let cum = 0;
  let darkPoint = 0; // 5th percentile
  let whitePoint = 255; // 95th percentile
  const p5Target = totalPixels * 0.05;
  const p95Target = totalPixels * 0.95;

  for (let i = 0; i < 256; i++) {
    cum += histogram[i];
    if (darkPoint === 0 && cum >= p5Target) {
      darkPoint = i;
    }
    if (cum >= p95Target) {
      whitePoint = i;
      break;
    }
  }

  const contrastSpread = Math.max(1, whitePoint - darkPoint);
  const hasDarkBackground = whitePoint < 225 && meanLuminance < 195;
  const isDocument = averageSaturation < 28 && contrastSpread > 90;

  // -------------------------------------------------------------
  // Mathematical Adjustment Calculations
  // -------------------------------------------------------------
  // 1. Brightness: Lift grayish paper background towards clean paper white (245)
  let brightness = 0;
  if (whitePoint < 235) {
    brightness = Math.round(Math.min(38, Math.max(0, (240 - whitePoint) * 0.45)));
  } else if (whitePoint > 250 && darkPoint > 50) {
    brightness = Math.round(Math.max(-20, (230 - meanLuminance) * 0.2));
  }

  // 2. Contrast: Expand compressed dynamic range
  let contrast = 0;
  if (contrastSpread < 185) {
    contrast = Math.round(Math.min(42, Math.max(10, (190 - contrastSpread) * 0.38)));
  } else {
    contrast = 12; // Modest crispness boost
  }

  // 3. Gamma Curve: Correct mid-tone shadows without clipping highlights
  let gamma = 1.0;
  if (meanLuminance < 125) {
    // Underexposed or dark background: brighten midtones
    gamma = parseFloat((1.0 + Math.min(0.35, (135 - meanLuminance) / 160)).toFixed(2));
  } else if (meanLuminance > 195 && darkPoint > 35) {
    // Washed out midtones: deepen shadows slightly for text contrast
    gamma = parseFloat((1.0 - Math.min(0.18, (meanLuminance - 185) / 200)).toFixed(2));
  }

  // 4. Background Whitening & Threshold
  const backgroundWhiten = isDocument || hasDarkBackground;
  const backgroundWhitenThreshold = Math.max(
    175,
    Math.min(238, Math.round(whitePoint - (contrastSpread > 150 ? 12 : 22)))
  );

  // 5. Unsharp Mask Sharpness
  const sharpness = isDocument ? 24 : 14;

  // 6. Saturation
  let saturation = 0;
  if (!isDocument && averageSaturation > 15) {
    saturation = 8; // Gentle vibrance for color cards/photos
  }

  const recommendedFilters: Partial<ImageFilterPipeline> = {
    brightness,
    contrast,
    gamma,
    sharpness,
    saturation,
    backgroundWhiten,
    backgroundWhitenThreshold,
    shadowRemoval: hasDarkBackground,
  };

  const summary = `Auto-Enhanced: +${brightness} Brightness, +${contrast} Contrast, Gamma ${gamma}${
    backgroundWhiten ? ", Clean White Paper" : ""
  }`;

  return {
    meanLuminance: Math.round(meanLuminance),
    darkPoint,
    whitePoint,
    contrastSpread,
    averageSaturation: Math.round(averageSaturation),
    isDocument,
    hasDarkBackground,
    recommendedFilters,
    summary,
  };
}
