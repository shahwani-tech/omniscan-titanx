/**
 * OMNISCAN TITAN X - Background Transform & Layout Mathematics
 * Provides precise contain/cover/fill calculations, zoom/pan mapping,
 * coordinate transformations, and rotation math.
 */

import { BackgroundTransform, BackgroundCrop, ImageFitMode } from "./types";

export interface FitDimensions {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Calculates initial target dimensions & placement for background image
 * based on the container dimensions and selected fit mode.
 */
export function calculateFitDimensions(
  imgNaturalWidth: number,
  imgNaturalHeight: number,
  containerWidth: number,
  containerHeight: number,
  fitMode: ImageFitMode
): FitDimensions {
  if (imgNaturalWidth <= 0 || imgNaturalHeight <= 0 || containerWidth <= 0 || containerHeight <= 0) {
    return { x: 0, y: 0, width: containerWidth, height: containerHeight };
  }

  const imgAspect = imgNaturalWidth / imgNaturalHeight;
  const containerAspect = containerWidth / containerHeight;

  let width = containerWidth;
  let height = containerHeight;
  let x = 0;
  let y = 0;

  switch (fitMode) {
    case "contain": {
      if (imgAspect > containerAspect) {
        width = containerWidth;
        height = containerWidth / imgAspect;
      } else {
        height = containerHeight;
        width = containerHeight * imgAspect;
      }
      x = (containerWidth - width) / 2;
      y = (containerHeight - height) / 2;
      break;
    }

    case "cover": {
      if (imgAspect > containerAspect) {
        height = containerHeight;
        width = containerHeight * imgAspect;
      } else {
        width = containerWidth;
        height = containerWidth / imgAspect;
      }
      x = (containerWidth - width) / 2;
      y = (containerHeight - height) / 2;
      break;
    }

    case "fill": {
      width = containerWidth;
      height = containerHeight;
      x = 0;
      y = 0;
      break;
    }

    case "original": {
      width = imgNaturalWidth;
      height = imgNaturalHeight;
      x = (containerWidth - width) / 2;
      y = (containerHeight - height) / 2;
      break;
    }

    case "center":
    default: {
      if (imgAspect > containerAspect) {
        height = containerHeight;
        width = containerHeight * imgAspect;
      } else {
        width = containerWidth;
        height = containerWidth / imgAspect;
      }
      x = (containerWidth - width) / 2;
      y = (containerHeight - height) / 2;
      break;
    }
  }

  return { x, y, width, height };
}

/**
 * Applies a BackgroundCrop rectangle to an image canvas and outputs the cropped data URL.
 */
export async function applyBackgroundCrop(
  imageSource: string | HTMLImageElement,
  crop: BackgroundCrop
): Promise<string> {
  let img: HTMLImageElement;
  if (typeof imageSource === "string") {
    img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageSource;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (e) => reject(e);
    });
  } else {
    img = imageSource;
  }

  const naturalW = img.naturalWidth || img.width;
  const naturalH = img.naturalHeight || img.height;

  // Normalized to pixel coordinates
  const sx = Math.max(0, Math.min(naturalW, Math.round(crop.x * naturalW)));
  const sy = Math.max(0, Math.min(naturalH, Math.round(crop.y * naturalH)));
  const sw = Math.max(1, Math.min(naturalW - sx, Math.round(crop.width * naturalW)));
  const sh = Math.max(1, Math.min(naturalH - sy, Math.round(crop.height * naturalH)));

  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Crop canvas context failed");

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas.toDataURL("image/png");
}

/**
 * Checks if a file is an allowed background image format.
 */
export function isAllowedBackgroundImage(file: File): boolean {
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/bmp",
    "image/svg+xml",
    "image/tiff",
  ];
  if (allowedTypes.includes(file.type.toLowerCase())) return true;
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  return ["jpg", "jpeg", "png", "webp", "bmp", "svg", "tif", "tiff"].includes(ext);
}
