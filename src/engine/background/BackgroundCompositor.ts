/**
 * OMNISCAN TITAN X - Centralized Background Compositing Engine
 * Production Multi-Layer Canvas Compositor (Color/Gradient + Image + Alpha Foreground Subject + Overlays)
 * Guarantees identical output across Live Preview, High-DPI Export, Sheet Layouts, and Centralized Printing.
 */

import {
  BackgroundStudioState,
  BackgroundTransform,
  ForegroundTransform,
  BackgroundCrop,
} from "./types";
import { calculateFitDimensions } from "./backgroundTransforms";

export interface CompositorRenderOptions {
  width: number;
  height: number;
  stageWidth?: number;  // Interactive stage CSS display width (for drag/pan scaling)
  stageHeight?: number; // Interactive stage CSS display height
  dpi?: number;
  exportFormat?: "png" | "jpeg" | "webp";
  exportQuality?: number;
  renderBiometricGuides?: boolean;
  guideColor?: string;
  forceSolidBackgroundForPrint?: boolean;
}

// In-memory HTMLImageElement cache to eliminate re-decoding lag during active drag/zoom
const imageElementCache = new Map<string, HTMLImageElement>();

export async function preloadImageElement(src: string): Promise<HTMLImageElement> {
  if (imageElementCache.has(src)) {
    const cached = imageElementCache.get(src)!;
    if (cached.complete && cached.naturalWidth > 0) return cached;
  }

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith("data:") && !src.startsWith("blob:")) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => {
      imageElementCache.set(src, img);
      resolve(img);
    };
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

export class BackgroundCompositor {
  /**
   * Render complete multi-layer composite into a target HTMLCanvasElement.
   */
  static async renderToCanvas(
    targetCanvas: HTMLCanvasElement,
    state: BackgroundStudioState,
    options: CompositorRenderOptions
  ): Promise<void> {
    const { width, height } = options;
    targetCanvas.width = width;
    targetCanvas.height = height;

    const ctx = targetCanvas.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("Could not acquire 2D canvas context");

    // Clear entire canvas
    ctx.clearRect(0, 0, width, height);

    // If backgroundMode is 'original' and we have originalImage
    if (state.backgroundMode === "original") {
      if (state.originalImage) {
        const origImg = await preloadImageElement(state.originalImage);
        ctx.drawImage(origImg, 0, 0, width, height);
      }
      return;
    }

    // -------------------------------------------------------------
    // LAYER 1: Background Base (Color / Gradient / Transparent)
    // -------------------------------------------------------------
    if (state.backgroundMode === "color" || state.backgroundMode === "preset") {
      ctx.fillStyle = state.backgroundColor || "#FFFFFF";
      ctx.fillRect(0, 0, width, height);
    } else if (state.backgroundMode === "gradient" && state.backgroundGradient) {
      const { color1, color2, type, angle } = state.backgroundGradient;
      if (type === "linear") {
        const rad = ((angle - 90) * Math.PI) / 180;
        const x1 = width / 2 - (Math.cos(rad) * width) / 2;
        const y1 = height / 2 - (Math.sin(rad) * height) / 2;
        const x2 = width / 2 + (Math.cos(rad) * width) / 2;
        const y2 = height / 2 + (Math.sin(rad) * height) / 2;
        const grad = ctx.createLinearGradient(x1, y1, x2, y2);
        grad.addColorStop(0, color1);
        grad.addColorStop(1, color2);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      } else {
        const cx = width / 2;
        const cy = height / 2;
        const radius = Math.max(width, height) / 1.5;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        grad.addColorStop(0, color1);
        grad.addColorStop(1, color2);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      }
    } else if (state.backgroundMode === "transparent") {
      // In transparent mode, leave alpha as 0 unless forced solid for print
      if (options.forceSolidBackgroundForPrint) {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, width, height);
      }
    } else if (state.backgroundMode === "image") {
      // Fallback base color beneath image if opacity < 1 or image doesn't fill canvas
      if (state.backgroundColor && state.backgroundColor !== "transparent") {
        ctx.fillStyle = state.backgroundColor;
        ctx.fillRect(0, 0, width, height);
      }
    }

    // -------------------------------------------------------------
    // LAYER 2: Custom Background Image (with transforms, crop, fit)
    // -------------------------------------------------------------
    if (state.backgroundMode === "image" && state.backgroundImage) {
      try {
        const bgImg = await preloadImageElement(state.backgroundImage);
        const bgTransform = state.backgroundTransform;

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, bgTransform.opacity ?? 1));

        // Container center with drag offset scaled from interactive stage display pixels
        const scaleFactorX = options.stageWidth && options.stageWidth > 0 ? width / options.stageWidth : 1;
        const scaleFactorY = options.stageHeight && options.stageHeight > 0 ? height / options.stageHeight : 1;
        const offsetX = (bgTransform.x || 0) * scaleFactorX;
        const offsetY = (bgTransform.y || 0) * scaleFactorY;

        const centerX = width / 2 + offsetX;
        const centerY = height / 2 + offsetY;

        ctx.translate(centerX, centerY);

        if (bgTransform.rotation) {
          ctx.rotate((bgTransform.rotation * Math.PI) / 180);
        }

        const filterParts: string[] = [];
        if (bgTransform.blur && bgTransform.blur > 0) {
          filterParts.push(`blur(${bgTransform.blur}px)`);
        }
        if (bgTransform.brightness !== undefined && bgTransform.brightness !== 0) {
          filterParts.push(`brightness(${1 + bgTransform.brightness / 100})`);
        }
        if (bgTransform.contrast !== undefined && bgTransform.contrast !== 0) {
          filterParts.push(`contrast(${1 + bgTransform.contrast / 100})`);
        }
        if (bgTransform.saturation !== undefined && bgTransform.saturation !== 0) {
          filterParts.push(`saturate(${1 + bgTransform.saturation / 100})`);
        }
        if (bgTransform.temperature !== undefined && bgTransform.temperature !== 0) {
          if (bgTransform.temperature > 0) {
            filterParts.push(`sepia(${bgTransform.temperature * 0.35}%)`);
          } else {
            filterParts.push(`hue-rotate(${bgTransform.temperature * 0.25}deg)`);
          }
        }
        if (filterParts.length > 0) {
          ctx.filter = filterParts.join(" ");
        }

        const sx = (bgTransform.scaleX || 1) * (bgTransform.scale || 1);
        const sy = (bgTransform.scaleY || 1) * (bgTransform.scale || 1);
        ctx.scale(sx, sy);

        if (bgTransform.fitMode === "tile") {
          const pattern = ctx.createPattern(bgImg, "repeat");
          if (pattern) {
            ctx.fillStyle = pattern;
            ctx.fillRect(-width / 2, -height / 2, width, height);
          }
        } else {
          // Calculate fit dimensions
          const fit = calculateFitDimensions(
            bgImg.naturalWidth,
            bgImg.naturalHeight,
            width,
            height,
            bgTransform.fitMode || "cover"
          );

          // Draw centered at origin
          ctx.drawImage(
            bgImg,
            -fit.width / 2,
            -fit.height / 2,
            fit.width,
            fit.height
          );
        }

        ctx.restore();
      } catch (err) {
        console.warn("Could not load background image for compositing:", err);
      }
    }

    // -------------------------------------------------------------
    // LAYER 3: Foreground Subject (Alpha-cutout with independent transform)
    // -------------------------------------------------------------
    const subjectSource = state.foregroundImage || state.originalImage;
    if (subjectSource) {
      try {
        const fgImg = await preloadImageElement(subjectSource);
        const fgTransform = state.foregroundTransform;

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, fgTransform.opacity ?? 1));

        const scaleFactorX = options.stageWidth && options.stageWidth > 0 ? width / options.stageWidth : 1;
        const scaleFactorY = options.stageHeight && options.stageHeight > 0 ? height / options.stageHeight : 1;
        const fgOffsetX = (fgTransform.x || 0) * scaleFactorX;
        const fgOffsetY = (fgTransform.y || 0) * scaleFactorY;

        const fgCenterX = width / 2 + fgOffsetX;
        const fgCenterY = height / 2 + fgOffsetY;

        ctx.translate(fgCenterX, fgCenterY);

        if (fgTransform.rotation) {
          ctx.rotate((fgTransform.rotation * Math.PI) / 180);
        }

        const fsx = (fgTransform.scaleX || 1) * (fgTransform.scale || 1);
        const fsy = (fgTransform.scaleY || 1) * (fgTransform.scale || 1);
        ctx.scale(fsx, fsy);

        // Foreground subject drawn at exact 1:1 natural pixel size (no stretching or scaling)
        const fgDrawW = fgImg.naturalWidth > 0 ? fgImg.naturalWidth : width;
        const fgDrawH = fgImg.naturalHeight > 0 ? fgImg.naturalHeight : height;
        ctx.drawImage(
          fgImg,
          -fgDrawW / 2,
          -fgDrawH / 2,
          fgDrawW,
          fgDrawH
        );

        ctx.restore();
      } catch (err) {
        console.warn("Could not load foreground image for compositing:", err);
      }
    }

    // -------------------------------------------------------------
    // LAYER 4: Optional Biometric Overlays (Guarantees compliance visualization)
    // -------------------------------------------------------------
    if (options.renderBiometricGuides) {
      ctx.save();
      ctx.strokeStyle = options.guideColor || "rgba(16, 185, 129, 0.6)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      // Eye level line (approx 55% from bottom = 45% from top)
      const eyeY = height * 0.45;
      ctx.beginPath();
      ctx.moveTo(0, eyeY);
      ctx.lineTo(width, eyeY);
      ctx.stroke();

      // Crown level line (approx 12% from top)
      const crownY = height * 0.12;
      ctx.beginPath();
      ctx.moveTo(0, crownY);
      ctx.lineTo(width, crownY);
      ctx.stroke();

      // Chin level line (approx 72% from top)
      const chinY = height * 0.72;
      ctx.beginPath();
      ctx.moveTo(0, chinY);
      ctx.lineTo(width, chinY);
      ctx.stroke();

      // Center vertical alignment axis
      ctx.beginPath();
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width / 2, height);
      ctx.stroke();

      ctx.restore();
    }
  }

  /**
   * Convenience helper to produce a Data URL directly from the state.
   */
  static async renderToDataUrl(
    state: BackgroundStudioState,
    options: CompositorRenderOptions
  ): Promise<string> {
    const canvas = document.createElement("canvas");
    await this.renderToCanvas(canvas, state, options);

    const format = options.exportFormat || (state.backgroundMode === "transparent" ? "png" : "jpeg");
    const quality = options.exportQuality ?? 0.98;

    if (format === "png") {
      return canvas.toDataURL("image/png");
    } else if (format === "webp") {
      return canvas.toDataURL("image/webp", quality);
    } else {
      return canvas.toDataURL("image/jpeg", quality);
    }
  }

  /**
   * Dedicated composite function for Passport Photo Print Studio.
   * THE GOLDEN RULE:
   * 1. Canvas MUST be created at CROPPED PHOTO dimensions — always.
   * 2. Background scales to fit/fill the canvas.
   * 3. Foreground is drawn at exact 1:1 pixel size (no scaling, no zoom).
   */
  static async compositeForPrint(
    state: BackgroundStudioState,
    cropDimensions: { width: number; height: number },
    stageDimensions?: { stageWidth: number; stageHeight: number }
  ): Promise<{ dataUrl: string; blob: Blob; width: number; height: number }> {
    const subjectSource = state.foregroundImage || state.originalImage;
    let actualW = cropDimensions.width;
    let actualH = cropDimensions.height;
    let fgImg: HTMLImageElement | null = null;
    let bgImg: HTMLImageElement | null = null;

    if (subjectSource) {
      try {
        fgImg = await preloadImageElement(subjectSource);
        if (fgImg.naturalWidth > 0 && fgImg.naturalHeight > 0) {
          actualW = fgImg.naturalWidth;
          actualH = fgImg.naturalHeight;
        }
      } catch (err) {
        console.warn("Could not preload subjectSource in compositeForPrint:", err);
      }
    }

    if (state.backgroundMode === "image" && state.backgroundImage) {
      try {
        bgImg = await preloadImageElement(state.backgroundImage);
      } catch (err) {
        console.warn("Could not preload backgroundImage in compositeForPrint:", err);
      }
    }

    const canvas = document.createElement("canvas");
    // ALWAYS use cropped photo dimensions — NEVER background image dimensions
    canvas.width = actualW;
    canvas.height = actualH;

    console.log("BG Studio composite dimensions:", {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      fgImageWidth: fgImg?.naturalWidth,
      fgImageHeight: fgImg?.naturalHeight,
      bgImageWidth: bgImg?.naturalWidth,
      bgImageHeight: bgImg?.naturalHeight,
    });

    const isTransparentBg = state.backgroundMode === "transparent";
    await this.renderToCanvas(canvas, state, {
      width: actualW,
      height: actualH,
      stageWidth: stageDimensions?.stageWidth,
      stageHeight: stageDimensions?.stageHeight,
      exportFormat: isTransparentBg ? "png" : "jpeg",
      exportQuality: 0.98,
      forceSolidBackgroundForPrint: !isTransparentBg,
    });

    const format = isTransparentBg ? "image/png" : "image/jpeg";
    const dataUrl = canvas.toDataURL(format, 0.98);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))),
        format,
        0.98
      );
    });

    return {
      dataUrl,
      blob,
      width: actualW,
      height: actualH,
    };
  }
}
