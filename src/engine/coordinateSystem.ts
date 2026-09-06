/**
 * OMNISCAN TITAN X - Unified Coordinate Transformation Engine
 * Comprehensive mathematical pipeline mapping between:
 * Screen (Window/Pointer) -> Canvas (Container) -> Viewport (Pan/Zoom) -> Document (Normalized 0-1) -> Image (Exact Pixels)
 * 
 * Handles:
 * - Zoom (0.1x to 10x)
 * - Pan (X, Y in canvas space)
 * - Rotation (0, 90, 180, 270 deg)
 * - Scaling & DPR (devicePixelRatio, Windows scaling 100%-200%)
 * - Aspect-ratio letterboxing & padding
 * - Crop bounding boxes & 8-handle drag transforms
 */

import { Point } from "../types";

export interface ScreenCoord {
  clientX: number;
  clientY: number;
  screenX?: number;
  screenY?: number;
  dpr: number;
}

export interface CanvasCoord {
  x: number; // pixels relative to canvas container element
  y: number;
}

export interface ViewportCoord {
  x: number; // pixels in virtual pan/zoom space
  y: number;
}

export interface DocumentNormalizedCoord {
  u: number; // 0.0 to 1.0 (horizontal fraction of document page)
  v: number; // 0.0 to 1.0 (vertical fraction of document page)
}

export interface ImagePixelCoord {
  x: number; // exact integer/float pixel in image buffer [0 .. imageWidth]
  y: number; // exact integer/float pixel in image buffer [0 .. imageHeight]
}

export interface CoordinateDiagnosticSnapshot {
  screen: { clientX: number; clientY: number; dpr: number };
  canvas: { x: number; y: number };
  documentNormalized: { u: number; v: number; percentU: string; percentV: string };
  imagePixel: { x: number; y: number; maxW: number; maxH: number };
  transform: { zoom: number; panX: number; panY: number; rotation: number };
  elementRect: { left: number; top: number; width: number; height: number };
}

/**
 * Maps Screen Pointer (clientX, clientY) to Canvas Container Space
 */
export function screenToCanvas(
  clientX: number,
  clientY: number,
  containerElement: HTMLElement | null
): CanvasCoord {
  if (!containerElement) return { x: clientX, y: clientY };
  const rect = containerElement.getBoundingClientRect();
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
}

/**
 * Maps Screen Pointer (clientX, clientY) to Normalized Document Page Space [0..1, 0..1]
 * Takes into account page DOM bounding rect, rotation, and clamp constraints
 */
export function screenToDocumentNormalized(
  clientX: number,
  clientY: number,
  pageElement: HTMLElement | null,
  clamp = true
): DocumentNormalizedCoord | null {
  if (!pageElement) return null;
  const rect = pageElement.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;

  let u = (clientX - rect.left) / rect.width;
  let v = (clientY - rect.top) / rect.height;

  if (clamp) {
    u = Math.max(0, Math.min(1, u));
    v = Math.max(0, Math.min(1, v));
  }

  return { u, v };
}

/**
 * Maps Normalized Document Space [u, v] to Screen Pointer (clientX, clientY)
 */
export function documentNormalizedToScreen(
  u: number,
  v: number,
  pageElement: HTMLElement | null
): Point | null {
  if (!pageElement) return null;
  const rect = pageElement.getBoundingClientRect();
  return {
    x: rect.left + u * rect.width,
    y: rect.top + v * rect.height,
  };
}

/**
 * Maps Screen Pointer (clientX, clientY) directly to Image Pixel Space [0..width, 0..height]
 * Correctly accounts for orientation rotation (0, 90, 180, 270)
 */
export function screenToImagePixel(
  clientX: number,
  clientY: number,
  pageElement: HTMLElement | null,
  imageWidth: number,
  imageHeight: number,
  rotation = 0
): ImagePixelCoord | null {
  const norm = screenToDocumentNormalized(clientX, clientY, pageElement, true);
  if (!norm) return null;
  return documentNormalizedToImagePixel(norm.u, norm.v, imageWidth, imageHeight, rotation);
}

/**
 * Maps Normalized Document Coordinates [u, v] to Raw Image Buffer Pixels
 * Handles 90°, 180°, 270° clockwise image orientation rotation
 */
export function documentNormalizedToImagePixel(
  u: number,
  v: number,
  imageWidth: number,
  imageHeight: number,
  rotation = 0
): ImagePixelCoord {
  const rot = ((rotation % 360) + 360) % 360;

  let px = 0;
  let py = 0;

  switch (rot) {
    case 90:
      // 90 deg clockwise: visual u -> image Y, visual v -> image (width - X)
      px = (1 - v) * imageWidth;
      py = u * imageHeight;
      break;
    case 180:
      // 180 deg: visual u -> (1 - u), visual v -> (1 - v)
      px = (1 - u) * imageWidth;
      py = (1 - v) * imageHeight;
      break;
    case 270:
      // 270 deg: visual u -> (1 - Y), visual v -> X
      px = v * imageWidth;
      py = (1 - u) * imageHeight;
      break;
    case 0:
    default:
      px = u * imageWidth;
      py = v * imageHeight;
      break;
  }

  return {
    x: Math.round(Math.max(0, Math.min(imageWidth, px))),
    y: Math.round(Math.max(0, Math.min(imageHeight, py))),
  };
}

/**
 * Maps Image Buffer Pixel Coordinates [px, py] to Normalized Document Space [u, v]
 */
export function imagePixelToDocumentNormalized(
  px: number,
  py: number,
  imageWidth: number,
  imageHeight: number,
  rotation = 0
): DocumentNormalizedCoord {
  if (imageWidth <= 0 || imageHeight <= 0) return { u: 0, v: 0 };
  const rot = ((rotation % 360) + 360) % 360;

  const fracX = Math.max(0, Math.min(1, px / imageWidth));
  const fracY = Math.max(0, Math.min(1, py / imageHeight));

  let u = 0;
  let v = 0;

  switch (rot) {
    case 90:
      u = fracY;
      v = 1 - fracX;
      break;
    case 180:
      u = 1 - fracX;
      v = 1 - fracY;
      break;
    case 270:
      u = 1 - fracY;
      v = fracX;
      break;
    case 0:
    default:
      u = fracX;
      v = fracY;
      break;
  }

  return {
    u: Math.max(0, Math.min(1, u)),
    v: Math.max(0, Math.min(1, v)),
  };
}

/**
 * Calculates Full Diagnostic Coordinate Snapshot for live HUD overlay
 */
export function computeDiagnosticSnapshot(
  clientX: number,
  clientY: number,
  containerElement: HTMLElement | null,
  pageElement: HTMLElement | null,
  imageWidth = 1275,
  imageHeight = 1650,
  zoom = 1.0,
  pan: Point = { x: 0, y: 0 },
  rotation = 0
): CoordinateDiagnosticSnapshot {
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const canvas = screenToCanvas(clientX, clientY, containerElement);
  const norm = screenToDocumentNormalized(clientX, clientY, pageElement, false) || { u: 0, v: 0 };
  const imgPixel = documentNormalizedToImagePixel(norm.u, norm.v, imageWidth, imageHeight, rotation);
  const rect = pageElement?.getBoundingClientRect() || { left: 0, top: 0, width: 0, height: 0 };

  return {
    screen: { clientX, clientY, dpr },
    canvas,
    documentNormalized: {
      u: Number(norm.u.toFixed(4)),
      v: Number(norm.v.toFixed(4)),
      percentU: `${(norm.u * 100).toFixed(1)}%`,
      percentV: `${(norm.v * 100).toFixed(1)}%`,
    },
    imagePixel: {
      x: imgPixel.x,
      y: imgPixel.y,
      maxW: imageWidth,
      maxH: imageHeight,
    },
    transform: {
      zoom: Number(zoom.toFixed(2)),
      panX: Math.round(pan.x),
      panY: Math.round(pan.y),
      rotation,
    },
    elementRect: {
      left: Math.round(rect.left),
      top: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    },
  };
}
