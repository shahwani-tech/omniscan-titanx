/**
 * A6 Half-Card Layout Studio - Geometry & Printing Engine
 * 
 * Supports standard ISO 216 A6 sheets:
 * - A6 Portrait: 105 mm × 148 mm
 * - A6 Landscape: 148 mm × 105 mm
 * 
 * Target Half-Card Working Area:
 * - Default: 74 mm width × 105 mm height (half of A6 portrait/landscape)
 * 
 * Real physical millimeter calculations internally with DPI-aware rendering.
 */

import { PDFDocument } from "pdf-lib";

export type A6PaperOrientation = "portrait" | "landscape";

export type A6LayoutMode =
  | "mode-a-single-front"       // Single Front card on A6
  | "mode-b-single-back"        // Single Back card on A6
  | "mode-c-separate-pages"     // Page 1: Front, Page 2: Back (2 A6 sheets)
  | "mode-d-one-page-stacked"   // Front + Back on one A6 sheet
  | "mode-e-two-identical";     // 2 copies on one A6 sheet (Front or Back)

export type CardFitMode = "contain" | "cover" | "exact" | "stretch";

export type FrontBackOrder = "front-first" | "back-first";

export interface A6CardAdjustment {
  // Geometry & Placement
  widthMm: number;
  heightMm: number;
  offsetX: number; // mm manual offset relative to slot center
  offsetY: number; // mm manual offset relative to slot center
  rotation: number; // 0, 90, 180, 270 deg
  fitMode: CardFitMode;
  preserveAspect: boolean;

  // Zoom & Pan inside the card frame
  zoom: number; // 0.5 to 3.0
  panX: number; // px
  panY: number; // px

  // Filters
  brightness: number; // -100 to 100
  contrast: number;   // -100 to 100
  gamma: number;      // 0.2 to 3.0
  sharpness: number;  // 0 to 100
  deskewAngle: number;// -15 to 15 deg
  grayscale: boolean;
  preset: string;     // 'original' | 'photo' | 'document' | 'crisp-bw' | 'grayscale'
}

export interface A6HalfCardConfig {
  orientation: A6PaperOrientation;
  layoutMode: A6LayoutMode;
  frontBackOrder: FrontBackOrder;
  twoIdenticalSource: "front" | "back";

  // Margins & Spacing
  marginMm: number;       // Outer margin around sheet (0 to 15 mm)
  gapMm: number;          // Gap between the two half-card slots (0 to 20 mm)

  // Visual Guides & Borders
  showSlotGuides: boolean;
  showCuttingGuides: boolean;
  showCenterDashedLine: boolean;
  showRuler: boolean;
  cardBorder: "none" | "hairline" | "solid" | "dashed";
  cardBorderColor: string;

  // Front & Back independent parameters
  front: A6CardAdjustment;
  back: A6CardAdjustment;
}

export const A6_PORTRAIT_WIDTH_MM = 105.0;
export const A6_PORTRAIT_HEIGHT_MM = 148.0;

export const DEFAULT_HALF_CARD_WIDTH_MM = 74.0;
export const DEFAULT_HALF_CARD_HEIGHT_MM = 105.0;

export const DEFAULT_CARD_ADJUSTMENT: A6CardAdjustment = {
  widthMm: DEFAULT_HALF_CARD_WIDTH_MM,
  heightMm: DEFAULT_HALF_CARD_HEIGHT_MM,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  fitMode: "contain",
  preserveAspect: true,
  zoom: 1.0,
  panX: 0,
  panY: 0,
  brightness: 0,
  contrast: 0,
  gamma: 1.0,
  sharpness: 0,
  deskewAngle: 0,
  grayscale: false,
  preset: "original",
};

export const DEFAULT_A6_CONFIG: A6HalfCardConfig = {
  orientation: "portrait",
  layoutMode: "mode-d-one-page-stacked",
  frontBackOrder: "front-first",
  twoIdenticalSource: "front",
  marginMm: 3.0,
  gapMm: 2.0,
  showSlotGuides: true,
  showCuttingGuides: true,
  showCenterDashedLine: true,
  showRuler: true,
  cardBorder: "none",
  cardBorderColor: "#94a3b8",
  front: { ...DEFAULT_CARD_ADJUSTMENT },
  back: { ...DEFAULT_CARD_ADJUSTMENT },
};

/**
 * Millimeter to Pixel converter at given DPI
 */
export function mmToPixels(mm: number, dpi: number = 300): number {
  return Math.round((mm * dpi) / 25.4);
}

/**
 * Pixel to Millimeter converter at given DPI
 */
export function pixelsToMm(px: number, dpi: number = 300): number {
  return (px * 25.4) / dpi;
}

/**
 * Get sheet physical dimensions in mm
 */
export function getA6SheetDimensions(orientation: A6PaperOrientation): { widthMm: number; heightMm: number } {
  return orientation === "portrait"
    ? { widthMm: A6_PORTRAIT_WIDTH_MM, heightMm: A6_PORTRAIT_HEIGHT_MM }
    : { widthMm: A6_PORTRAIT_HEIGHT_MM, heightMm: A6_PORTRAIT_WIDTH_MM };
}

/**
 * Calculated slot geometry for each page
 */
export interface CardSlotGeometry {
  slotIndex: number;
  slotName: "upper" | "lower" | "left" | "right" | "single";
  assignedSide: "front" | "back";
  // Slot bounding box in mm on the sheet
  slotX: number;
  slotY: number;
  slotWidth: number;
  slotHeight: number;
  // Card placement inside the slot in mm
  cardX: number;
  cardY: number;
  cardWidth: number;
  cardHeight: number;
  isOverflowing: boolean;
}

export interface A6PageCalculation {
  pageIndex: number;
  slots: CardSlotGeometry[];
  hasOverflowWarning: boolean;
}

/**
 * Calculates slot coordinates and card placements for all pages
 */
export function calculateA6Layout(config: A6HalfCardConfig): {
  pages: A6PageCalculation[];
  sheetWidthMm: number;
  sheetHeightMm: number;
} {
  const { widthMm: sheetW, heightMm: sheetH } = getA6SheetDimensions(config.orientation);
  const m = config.marginMm;
  const g = config.gapMm;

  // Usable area after outer margins
  const usableW = Math.max(10, sheetW - m * 2);
  const usableH = Math.max(10, sheetH - m * 2);

  const calculateSlotCard = (
    slotIdx: number,
    slotName: "upper" | "lower" | "left" | "right" | "single",
    side: "front" | "back",
    sx: number,
    sy: number,
    sw: number,
    sh: number
  ): CardSlotGeometry => {
    const adj = side === "front" ? config.front : config.back;
    let targetW = adj.widthMm;
    let targetH = adj.heightMm;

    // Handle orientation adjustments if rotation is 90 or 270
    const isRotated = adj.rotation === 90 || adj.rotation === 270;
    const effW = isRotated ? targetH : targetW;
    const effH = isRotated ? targetW : targetH;

    // Center of slot plus manual offset
    const centerX = sx + sw / 2 + adj.offsetX;
    const centerY = sy + sh / 2 + adj.offsetY;

    const cardX = centerX - effW / 2;
    const cardY = centerY - effH / 2;

    // Check if card boundaries exceed printable sheet margins
    const isOverflowing =
      cardX < 0 ||
      cardY < 0 ||
      cardX + effW > sheetW ||
      cardY + effH > sheetH;

    return {
      slotIndex: slotIdx,
      slotName,
      assignedSide: side,
      slotX: sx,
      slotY: sy,
      slotWidth: sw,
      slotHeight: sh,
      cardX,
      cardY,
      cardWidth: effW,
      cardHeight: effH,
      isOverflowing,
    };
  };

  const pages: A6PageCalculation[] = [];

  switch (config.layoutMode) {
    case "mode-a-single-front": {
      // 1 slot centered on sheet
      const sw = usableW;
      const sh = usableH;
      const slot = calculateSlotCard(0, "single", "front", m, m, sw, sh);
      pages.push({
        pageIndex: 0,
        slots: [slot],
        hasOverflowWarning: slot.isOverflowing,
      });
      break;
    }

    case "mode-b-single-back": {
      // 1 slot centered on sheet
      const sw = usableW;
      const sh = usableH;
      const slot = calculateSlotCard(0, "single", "back", m, m, sw, sh);
      pages.push({
        pageIndex: 0,
        slots: [slot],
        hasOverflowWarning: slot.isOverflowing,
      });
      break;
    }

    case "mode-c-separate-pages": {
      // Page 1: Front
      const slotFront = calculateSlotCard(0, "single", "front", m, m, usableW, usableH);
      pages.push({
        pageIndex: 0,
        slots: [slotFront],
        hasOverflowWarning: slotFront.isOverflowing,
      });
      // Page 2: Back
      const slotBack = calculateSlotCard(0, "single", "back", m, m, usableW, usableH);
      pages.push({
        pageIndex: 1,
        slots: [slotBack],
        hasOverflowWarning: slotBack.isOverflowing,
      });
      break;
    }

    case "mode-d-one-page-stacked": {
      const isPortrait = config.orientation === "portrait";
      const side1 = config.frontBackOrder === "front-first" ? "front" : "back";
      const side2 = config.frontBackOrder === "front-first" ? "back" : "front";

      if (isPortrait) {
        // Upper & Lower slots
        const slotH = Math.max(10, (usableH - g) / 2);
        const slotW = usableW;
        const slot1 = calculateSlotCard(0, "upper", side1, m, m, slotW, slotH);
        const slot2 = calculateSlotCard(1, "lower", side2, m, m + slotH + g, slotW, slotH);
        pages.push({
          pageIndex: 0,
          slots: [slot1, slot2],
          hasOverflowWarning: slot1.isOverflowing || slot2.isOverflowing,
        });
      } else {
        // Landscape: Left & Right slots
        const slotW = Math.max(10, (usableW - g) / 2);
        const slotH = usableH;
        const slot1 = calculateSlotCard(0, "left", side1, m, m, slotW, slotH);
        const slot2 = calculateSlotCard(1, "right", side2, m + slotW + g, m, slotW, slotH);
        pages.push({
          pageIndex: 0,
          slots: [slot1, slot2],
          hasOverflowWarning: slot1.isOverflowing || slot2.isOverflowing,
        });
      }
      break;
    }

    case "mode-e-two-identical": {
      const isPortrait = config.orientation === "portrait";
      const side = config.twoIdenticalSource;

      if (isPortrait) {
        // Upper & Lower identical copies
        const slotH = Math.max(10, (usableH - g) / 2);
        const slotW = usableW;
        const slot1 = calculateSlotCard(0, "upper", side, m, m, slotW, slotH);
        const slot2 = calculateSlotCard(1, "lower", side, m, m + slotH + g, slotW, slotH);
        pages.push({
          pageIndex: 0,
          slots: [slot1, slot2],
          hasOverflowWarning: slot1.isOverflowing || slot2.isOverflowing,
        });
      } else {
        // Landscape: Left & Right identical copies
        const slotW = Math.max(10, (usableW - g) / 2);
        const slotH = usableH;
        const slot1 = calculateSlotCard(0, "left", side, m, m, slotW, slotH);
        const slot2 = calculateSlotCard(1, "right", side, m + slotW + g, m, slotW, slotH);
        pages.push({
          pageIndex: 0,
          slots: [slot1, slot2],
          hasOverflowWarning: slot1.isOverflowing || slot2.isOverflowing,
        });
      }
      break;
    }
  }

  return { pages, sheetWidthMm: sheetW, sheetHeightMm: sheetH };
}

/**
 * Image loader with cache
 */
const imageCache = new Map<string, HTMLImageElement>();

export function loadA6CardImage(src: string): Promise<HTMLImageElement> {
  if (imageCache.has(src)) {
    const cached = imageCache.get(src)!;
    if (cached.complete && cached.naturalWidth > 0) {
      return Promise.resolve(cached);
    }
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

/**
 * Render a single card with its filters, rotation, crop zoom/pan onto an offscreen canvas
 */
export async function renderProcessedCardCanvas(
  imageSrc: string,
  adj: A6CardAdjustment,
  targetWidthPx: number,
  targetHeightPx: number
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = targetWidthPx;
  canvas.height = targetHeightPx;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  try {
    const img = await loadA6CardImage(imageSrc);

    // Filter pipeline calculation
    const offCanvas = document.createElement("canvas");
    offCanvas.width = img.naturalWidth || img.width || 800;
    offCanvas.height = img.naturalHeight || img.height || 600;
    const offCtx = offCanvas.getContext("2d");
    if (!offCtx) return canvas;

    // Build CSS filter string for fast GPU-accelerated filter rendering
    const filters: string[] = [];
    if (adj.brightness !== 0) {
      filters.push(`brightness(${100 + adj.brightness}%)`);
    }
    if (adj.contrast !== 0) {
      filters.push(`contrast(${100 + adj.contrast}%)`);
    }
    if (adj.grayscale) {
      filters.push("grayscale(100%)");
    }
    if (filters.length > 0) {
      offCtx.filter = filters.join(" ");
    }

    offCtx.drawImage(img, 0, 0);

    // Deskew & Rotation transform
    ctx.save();
    ctx.translate(targetWidthPx / 2, targetHeightPx / 2);

    const totalAngle = (adj.rotation + adj.deskewAngle) * (Math.PI / 180);
    ctx.rotate(totalAngle);

    // Card zoom & pan
    const scale = adj.zoom || 1.0;
    ctx.scale(scale, scale);

    // Calculate image draw rect based on fitMode
    let drawW = targetWidthPx;
    let drawH = targetHeightPx;
    const imgAspect = (img.naturalWidth || 800) / (img.naturalHeight || 600);
    const targetAspect = targetWidthPx / targetHeightPx;

    if (adj.preserveAspect) {
      if (adj.fitMode === "cover") {
        if (imgAspect > targetAspect) {
          drawH = targetHeightPx;
          drawW = drawH * imgAspect;
        } else {
          drawW = targetWidthPx;
          drawH = drawW / imgAspect;
        }
      } else {
        // default "contain"
        if (imgAspect > targetAspect) {
          drawW = targetWidthPx;
          drawH = drawW / imgAspect;
        } else {
          drawH = targetHeightPx;
          drawW = drawH * imgAspect;
        }
      }
    }

    const drawX = -drawW / 2 + adj.panX;
    const drawY = -drawH / 2 + adj.panY;

    ctx.drawImage(offCanvas, drawX, drawY, drawW, drawH);
    ctx.restore();

    // Sharpness / Gamma post-pass if needed
    if (adj.gamma !== 1.0 || adj.sharpness > 0) {
      applyGammaAndSharpness(ctx, targetWidthPx, targetHeightPx, adj.gamma, adj.sharpness);
    }
  } catch (e) {
    console.error("Card render error:", e);
    // Draw placeholder
    ctx.fillStyle = "#f1f5f9";
    ctx.fillRect(0, 0, targetWidthPx, targetHeightPx);
    ctx.fillStyle = "#64748b";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Card Image Preview", targetWidthPx / 2, targetHeightPx / 2);
  }

  return canvas;
}

/**
 * Pixel manipulation for Gamma and Sharpness
 */
function applyGammaAndSharpness(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  gamma: number,
  sharpness: number
) {
  try {
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    // Precalculate gamma LUT
    if (gamma !== 1.0 && gamma > 0) {
      const invGamma = 1 / gamma;
      const lut = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        lut[i] = Math.min(255, Math.max(0, Math.round(Math.pow(i / 255, invGamma) * 255)));
      }
      for (let i = 0; i < data.length; i += 4) {
        data[i] = lut[data[i]];
        data[i + 1] = lut[data[i + 1]];
        data[i + 2] = lut[data[i + 2]];
      }
    }

    ctx.putImageData(imgData, 0, 0);
  } catch {
    // Ignore canvas security errors
  }
}

/**
 * Render complete A6 Sheet Canvas for a given page index
 */
export async function renderA6SheetCanvas(
  config: A6HalfCardConfig,
  images: { front?: string; back?: string },
  pageIndex: number = 0,
  options: {
    dpi?: number;
    showGuidesOverlay?: boolean;
    destinationCanvas?: HTMLCanvasElement;
  } = {}
): Promise<HTMLCanvasElement> {
  const dpi = options.dpi || 150;
  const showGuides = options.showGuidesOverlay ?? true;

  const layout = calculateA6Layout(config);
  const pageCalc = layout.pages[pageIndex] || layout.pages[0];

  const canvasWidth = mmToPixels(layout.sheetWidthMm, dpi);
  const canvasHeight = mmToPixels(layout.sheetHeightMm, dpi);

  const canvas = options.destinationCanvas || document.createElement("canvas");
  if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  // Background white sheet
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // 1. Draw Slot Guides if enabled
  if (showGuides && config.showSlotGuides) {
    ctx.save();
    for (const slot of pageCalc.slots) {
      const sx = mmToPixels(slot.slotX, dpi);
      const sy = mmToPixels(slot.slotY, dpi);
      const sw = mmToPixels(slot.slotWidth, dpi);
      const sh = mmToPixels(slot.slotHeight, dpi);

      // Light dashed boundary guide for half-card target zone
      ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
      ctx.lineWidth = Math.max(1, Math.round(dpi / 150));
      ctx.setLineDash([4 * (dpi / 150), 3 * (dpi / 150)]);
      ctx.strokeRect(sx, sy, sw, sh);

      // Slot label watermark
      ctx.fillStyle = "rgba(56, 189, 248, 0.25)";
      ctx.font = `${Math.round(11 * (dpi / 100))}px monospace`;
      ctx.fillText(
        `[Half-A6 Slot: ${slot.slotName.toUpperCase()} — ${slot.assignedSide.toUpperCase()}]`,
        sx + 8 * (dpi / 100),
        sy + 16 * (dpi / 100)
      );
    }
    ctx.restore();
  }

  // 2. Draw Center Dashed Line between slots (fold / cut indicator)
  if (showGuides && config.showCenterDashedLine && pageCalc.slots.length > 1) {
    ctx.save();
    ctx.strokeStyle = "rgba(148, 163, 184, 0.5)";
    ctx.lineWidth = Math.max(1, Math.round(dpi / 150));
    ctx.setLineDash([6 * (dpi / 150), 4 * (dpi / 150)]);

    if (config.orientation === "portrait") {
      // Horizontal center line
      const midY = canvasHeight / 2;
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(canvasWidth, midY);
      ctx.stroke();
    } else {
      // Vertical center line
      const midX = canvasWidth / 2;
      ctx.beginPath();
      ctx.moveTo(midX, 0);
      ctx.lineTo(midX, canvasHeight);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 3. Render Cards in their slots
  for (const slot of pageCalc.slots) {
    const side = slot.assignedSide;
    const imgSrc = side === "front" ? images.front : images.back;
    const adj = side === "front" ? config.front : config.back;

    const cardPxX = mmToPixels(slot.cardX, dpi);
    const cardPxY = mmToPixels(slot.cardY, dpi);
    const cardPxW = mmToPixels(slot.cardWidth, dpi);
    const cardPxH = mmToPixels(slot.cardHeight, dpi);

    if (imgSrc) {
      const cardCanvas = await renderProcessedCardCanvas(imgSrc, adj, cardPxW, cardPxH);
      ctx.drawImage(cardCanvas, cardPxX, cardPxY, cardPxW, cardPxH);
    } else {
      // Empty slot placeholder
      ctx.save();
      ctx.fillStyle = "rgba(241, 245, 249, 0.8)";
      ctx.fillRect(cardPxX, cardPxY, cardPxW, cardPxH);
      ctx.strokeStyle = "rgba(203, 213, 225, 0.9)";
      ctx.lineWidth = 1;
      ctx.strokeRect(cardPxX, cardPxY, cardPxW, cardPxH);

      ctx.fillStyle = "#64748b";
      ctx.font = `bold ${Math.round(13 * (dpi / 100))}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(
        `No ${side.toUpperCase()} Card Uploaded`,
        cardPxX + cardPxW / 2,
        cardPxY + cardPxH / 2 - 8
      );
      ctx.font = `${Math.round(11 * (dpi / 100))}px sans-serif`;
      ctx.fillText(
        `Upload ${side} in left sidebar`,
        cardPxX + cardPxW / 2,
        cardPxY + cardPxH / 2 + 14
      );
      ctx.restore();
    }

    // Card border if requested
    if (config.cardBorder !== "none") {
      ctx.save();
      ctx.strokeStyle = config.cardBorderColor || "#94a3b8";
      ctx.lineWidth = config.cardBorder === "hairline" ? 1 : Math.round(1.5 * (dpi / 100));
      if (config.cardBorder === "dashed") {
        ctx.setLineDash([4 * (dpi / 100), 3 * (dpi / 100)]);
      }
      ctx.strokeRect(cardPxX, cardPxY, cardPxW, cardPxH);
      ctx.restore();
    }

    // Cutting guides / Crop marks on card corners
    if (config.showCuttingGuides) {
      drawCropMarks(ctx, cardPxX, cardPxY, cardPxW, cardPxH, dpi);
    }
  }

  return canvas;
}

/**
 * Corner crop marks drawing helper
 */
function drawCropMarks(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  dpi: number
) {
  ctx.save();
  ctx.strokeStyle = "rgba(100, 116, 139, 0.75)";
  ctx.lineWidth = Math.max(1, Math.round(dpi / 200));
  const len = Math.round(5 * (dpi / 25.4)); // 5mm mark length
  const gap = Math.round(1.5 * (dpi / 25.4)); // 1.5mm offset gap

  // Top-Left
  ctx.beginPath();
  ctx.moveTo(x - gap, y);
  ctx.lineTo(x - gap - len, y);
  ctx.moveTo(x, y - gap);
  ctx.lineTo(x, y - gap - len);
  ctx.stroke();

  // Top-Right
  ctx.beginPath();
  ctx.moveTo(x + w + gap, y);
  ctx.lineTo(x + w + gap + len, y);
  ctx.moveTo(x + w, y - gap);
  ctx.lineTo(x + w, y - gap - len);
  ctx.stroke();

  // Bottom-Left
  ctx.beginPath();
  ctx.moveTo(x - gap, y + h);
  ctx.lineTo(x - gap - len, y + h);
  ctx.moveTo(x, y + h + gap);
  ctx.lineTo(x, y + h + gap + len);
  ctx.stroke();

  // Bottom-Right
  ctx.beginPath();
  ctx.moveTo(x + w + gap, y + h);
  ctx.lineTo(x + w + gap + len, y + h);
  ctx.moveTo(x + w, y + h + gap);
  ctx.lineTo(x + w, y + h + gap + len);
  ctx.stroke();

  ctx.restore();
}

/**
 * Export complete A6 Sheet as a clean physical PDF using pdf-lib
 */
export async function exportA6SheetAsPDF(
  config: A6HalfCardConfig,
  images: { front?: string; back?: string }
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const layout = calculateA6Layout(config);

  // PDF Points (1 pt = 1/72 inch, 25.4 mm = 72 pt)
  const ptWidth = (layout.sheetWidthMm * 72) / 25.4;
  const ptHeight = (layout.sheetHeightMm * 72) / 25.4;

  for (let pIdx = 0; pIdx < layout.pages.length; pIdx++) {
    // Render high-res 300 DPI canvas
    const canvas = await renderA6SheetCanvas(config, images, pIdx, {
      dpi: 300,
      showGuidesOverlay: false,
    });

    const pageImagePng = canvas.toDataURL("image/png");
    const embeddedImage = await pdfDoc.embedPng(pageImagePng);

    const page = pdfDoc.addPage([ptWidth, ptHeight]);
    page.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: ptWidth,
      height: ptHeight,
    });
  }

  return await pdfDoc.save();
}

/**
 * Export Sheet as Image Blob (PNG / JPEG)
 */
export async function exportA6SheetAsBlob(
  config: A6HalfCardConfig,
  images: { front?: string; back?: string },
  format: "image/png" | "image/jpeg" = "image/png",
  dpi: number = 300,
  pageIndex: number = 0
): Promise<Blob> {
  const canvas = await renderA6SheetCanvas(config, images, pageIndex, {
    dpi,
    showGuidesOverlay: false,
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to generate image blob"));
      },
      format,
      format === "image/jpeg" ? 0.95 : undefined
    );
  });
}

/**
 * High-Precision Printing via Centralized Application Print System
 */
export function printA6Canvases(canvases: HTMLCanvasElement[], config: A6HalfCardConfig) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("omniscan:open-print-dialog", {
        detail: {
          type: "a6-card",
          title: "A6 Half-Card Print Job",
          a6Config: config,
          defaultPaperSize: "a6",
          defaultOrientation: config.orientation,
          hasCuttingGuides: config.showCuttingGuides,
        },
      })
    );
  }
}

/**
 * Creates high-fidelity sample vector SVGs for A6 half-cards (74mm × 105mm aspect ratio)
 */
export function createSampleA6CardSvg(side: "front" | "back"): string {
  if (side === "front") {
    return `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 740 1050" width="740" height="1050">
        <defs>
          <linearGradient id="cardBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0f172a"/>
            <stop offset="60%" stop-color="#1e293b"/>
            <stop offset="100%" stop-color="#090d16"/>
          </linearGradient>
          <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#6366f1"/>
            <stop offset="50%" stop-color="#8b5cf6"/>
            <stop offset="100%" stop-color="#ec4899"/>
          </linearGradient>
          <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#fbbf24"/>
            <stop offset="100%" stop-color="#d97706"/>
          </linearGradient>
        </defs>

        <!-- Background with border -->
        <rect width="740" height="1050" rx="36" fill="url(#cardBg)" stroke="#334155" stroke-width="4"/>
        
        <!-- Header Banner -->
        <rect x="0" y="0" width="740" height="160" rx="36" fill="url(#accentGrad)"/>
        <rect x="0" y="110" width="740" height="50" fill="url(#accentGrad)"/>
        
        <!-- Organization Emblem -->
        <circle cx="370" cy="80" r="38" fill="#ffffff" opacity="0.2"/>
        <circle cx="370" cy="80" r="28" fill="#ffffff"/>
        <polygon points="370,62 384,94 356,94" fill="#6366f1"/>
        <text x="370" y="140" font-family="sans-serif" font-size="18" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="4">EXECUTIVE PASS</text>

        <!-- Target Half-A6 Badge -->
        <rect x="235" y="180" width="270" height="34" rx="17" fill="#1e1b4b" stroke="#6366f1" stroke-width="1.5"/>
        <text x="370" y="203" font-family="monospace" font-size="13" font-weight="bold" fill="#a5b4fc" text-anchor="middle">A6 HALF-CARD (74 × 105 mm)</text>

        <!-- Portrait Frame -->
        <rect x="245" y="240" width="250" height="310" rx="20" fill="#0f172a" stroke="#475569" stroke-width="3"/>
        <circle cx="370" cy="340" r="64" fill="#334155"/>
        <path d="M 280 520 C 280 430, 460 430, 460 520 Z" fill="#334155"/>
        <text x="370" y="540" font-family="sans-serif" font-size="13" fill="#94a3b8" text-anchor="middle">OFFICIAL PHOTOGRAPH</text>

        <!-- Member Information -->
        <text x="370" y="600" font-family="sans-serif" font-size="28" font-weight="bold" fill="#ffffff" text-anchor="middle">ALEXANDER VAUGHN</text>
        <text x="370" y="630" font-family="sans-serif" font-size="16" font-weight="600" fill="#818cf8" text-anchor="middle">CHIEF TECHNOLOGY OFFICER</text>
        <text x="370" y="655" font-family="sans-serif" font-size="14" fill="#94a3b8" text-anchor="middle">FACILITY ACCESS TIER 1 • ALL SECTORS</text>

        <!-- Data Fields Grid -->
        <rect x="70" y="690" width="600" height="160" rx="16" fill="#1e293b" stroke="#334155" stroke-width="1"/>
        
        <text x="110" y="730" font-family="sans-serif" font-size="12" font-weight="bold" fill="#94a3b8">HOLDER ID</text>
        <text x="110" y="756" font-family="monospace" font-size="18" font-weight="bold" fill="#f8fafc">EXEC-74105-X</text>

        <text x="370" y="730" font-family="sans-serif" font-size="12" font-weight="bold" fill="#94a3b8">CLEARANCE</text>
        <text x="370" y="756" font-family="sans-serif" font-size="18" font-weight="bold" fill="#38bdf8">ALPHA LEVEL</text>

        <text x="110" y="805" font-family="sans-serif" font-size="12" font-weight="bold" fill="#94a3b8">ISSUED DATE</text>
        <text x="110" y="830" font-family="sans-serif" font-size="15" fill="#f8fafc">01 / JAN / 2026</text>

        <text x="370" y="805" font-family="sans-serif" font-size="12" font-weight="bold" fill="#94a3b8">EXPIRATION</text>
        <text x="370" y="830" font-family="sans-serif" font-size="15" font-weight="bold" fill="#4ade80">31 / DEC / 2030</text>

        <!-- Barcode / QR Simulation -->
        <rect x="120" y="890" width="500" height="60" rx="8" fill="#ffffff"/>
        <!-- Simulated Barcode Lines -->
        <line x1="150" y1="900" x2="150" y2="940" stroke="#000" stroke-width="4"/>
        <line x1="160" y1="900" x2="160" y2="940" stroke="#000" stroke-width="2"/>
        <line x1="168" y1="900" x2="168" y2="940" stroke="#000" stroke-width="6"/>
        <line x1="182" y1="900" x2="182" y2="940" stroke="#000" stroke-width="3"/>
        <line x1="194" y1="900" x2="194" y2="940" stroke="#000" stroke-width="5"/>
        <line x1="210" y1="900" x2="210" y2="940" stroke="#000" stroke-width="2"/>
        <line x1="220" y1="900" x2="220" y2="940" stroke="#000" stroke-width="7"/>
        <line x1="236" y1="900" x2="236" y2="940" stroke="#000" stroke-width="3"/>
        <line x1="248" y1="900" x2="248" y2="940" stroke="#000" stroke-width="4"/>
        <line x1="260" y1="900" x2="260" y2="940" stroke="#000" stroke-width="2"/>
        <line x1="272" y1="900" x2="272" y2="940" stroke="#000" stroke-width="6"/>
        <line x1="288" y1="900" x2="288" y2="940" stroke="#000" stroke-width="3"/>
        <line x1="300" y1="900" x2="300" y2="940" stroke="#000" stroke-width="5"/>
        <line x1="316" y1="900" x2="316" y2="940" stroke="#000" stroke-width="2"/>
        <line x1="330" y1="900" x2="330" y2="940" stroke="#000" stroke-width="6"/>
        <line x1="344" y1="900" x2="344" y2="940" stroke="#000" stroke-width="3"/>
        <line x1="358" y1="900" x2="358" y2="940" stroke="#000" stroke-width="4"/>
        <line x1="372" y1="900" x2="372" y2="940" stroke="#000" stroke-width="2"/>
        <line x1="384" y1="900" x2="384" y2="940" stroke="#000" stroke-width="5"/>
        <line x1="398" y1="900" x2="398" y2="940" stroke="#000" stroke-width="3"/>
        <line x1="412" y1="900" x2="412" y2="940" stroke="#000" stroke-width="6"/>
        <line x1="428" y1="900" x2="428" y2="940" stroke="#000" stroke-width="2"/>
        <line x1="440" y1="900" x2="440" y2="940" stroke="#000" stroke-width="4"/>
        <line x1="452" y1="900" x2="452" y2="940" stroke="#000" stroke-width="3"/>
        <line x1="466" y1="900" x2="466" y2="940" stroke="#000" stroke-width="5"/>
        <line x1="480" y1="900" x2="480" y2="940" stroke="#000" stroke-width="2"/>
        <line x1="492" y1="900" x2="492" y2="940" stroke="#000" stroke-width="7"/>
        <line x1="510" y1="900" x2="510" y2="940" stroke="#000" stroke-width="3"/>
        <line x1="524" y1="900" x2="524" y2="940" stroke="#000" stroke-width="5"/>
        <line x1="540" y1="900" x2="540" y2="940" stroke="#000" stroke-width="3"/>
        <line x1="554" y1="900" x2="554" y2="940" stroke="#000" stroke-width="4"/>
        <line x1="570" y1="900" x2="570" y2="940" stroke="#000" stroke-width="2"/>

        <text x="370" y="990" font-family="monospace" font-size="11" fill="#64748b" text-anchor="middle">* AUTHENTIC SAMPLE FRONT - A6 HALF-CARD STUDIO *</text>
      </svg>
    `)}`;
  } else {
    return `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 740 1050" width="740" height="1050">
        <defs>
          <linearGradient id="cardBackBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#1e293b"/>
            <stop offset="50%" stop-color="#0f172a"/>
            <stop offset="100%" stop-color="#020617"/>
          </linearGradient>
          <linearGradient id="backHeader" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#475569"/>
            <stop offset="100%" stop-color="#334155"/>
          </linearGradient>
        </defs>

        <!-- Background with border -->
        <rect width="740" height="1050" rx="36" fill="url(#cardBackBg)" stroke="#334155" stroke-width="4"/>

        <!-- Magnetic Stripe Simulation -->
        <rect x="0" y="70" width="740" height="140" fill="#090d16"/>
        <line x1="0" y1="70" x2="740" y2="70" stroke="#000000" stroke-width="2"/>
        <line x1="0" y1="210" x2="740" y2="210" stroke="#000000" stroke-width="2"/>

        <!-- Signature Strip -->
        <rect x="60" y="260" width="460" height="70" rx="8" fill="#f8fafc"/>
        <text x="80" y="305" font-family="cursive, sans-serif" font-size="28" fill="#0f172a">Alexander Vaughn</text>
        <rect x="540" y="260" width="140" height="70" rx="8" fill="#e2e8f0"/>
        <text x="610" y="305" font-family="monospace" font-size="22" font-weight="bold" fill="#0f172a" text-anchor="middle">741</text>
        <text x="60" y="350" font-family="sans-serif" font-size="11" fill="#94a3b8">AUTHORIZED SIGNATURE • NOT VALID UNLESS SIGNED</text>

        <!-- Instructions & Legal Notice Box -->
        <rect x="60" y="380" width="620" height="340" rx="16" fill="#1e293b" stroke="#475569" stroke-width="1.5"/>
        <text x="90" y="420" font-family="sans-serif" font-size="16" font-weight="bold" fill="#f8fafc">TERMS &amp; SECURITY PROTOCOLS</text>
        
        <text x="90" y="460" font-family="sans-serif" font-size="13" fill="#cbd5e1">• This card remains property of the issuing corporation.</text>
        <text x="90" y="490" font-family="sans-serif" font-size="13" fill="#cbd5e1">• Must be presented upon request by security personnel.</text>
        <text x="90" y="520" font-family="sans-serif" font-size="13" fill="#cbd5e1">• Loss or theft must be reported immediately to Security Operations.</text>
        <text x="90" y="550" font-family="sans-serif" font-size="13" fill="#cbd5e1">• Non-transferable. Misuse is grounds for immediate termination.</text>
        <text x="90" y="580" font-family="sans-serif" font-size="13" fill="#cbd5e1">• Card format conforms to ISO 216 Half-A6 specifications.</text>
        <text x="90" y="610" font-family="sans-serif" font-size="13" fill="#cbd5e1">• 24/7 Security Helpline: +1 (800) 555-CARD</text>
        <text x="90" y="640" font-family="sans-serif" font-size="13" fill="#cbd5e1">• Return address: Facility Security HQ, Suite 400</text>
        <text x="90" y="680" font-family="monospace" font-size="12" font-weight="bold" fill="#38bdf8">SERIAL HASH: SHA256-A6-74X105-998822</text>

        <!-- Microchip / Smartcard Contacts Simulation -->
        <rect x="290" y="750" width="160" height="120" rx="16" fill="#f59e0b" stroke="#b45309" stroke-width="2"/>
        <line x1="290" y1="790" x2="450" y2="790" stroke="#b45309" stroke-width="2"/>
        <line x1="290" y1="830" x2="450" y2="830" stroke="#b45309" stroke-width="2"/>
        <line x1="370" y1="750" x2="370" y2="870" stroke="#b45309" stroke-width="2"/>
        <circle cx="370" cy="810" r="14" fill="#d97706"/>

        <text x="370" y="910" font-family="sans-serif" font-size="12" font-weight="bold" fill="#f59e0b" text-anchor="middle">ENCRYPTED RFID / NFC CONTACTLESS</text>

        <!-- QR Code Simulation -->
        <rect x="295" y="930" width="150" height="70" rx="8" fill="#ffffff"/>
        <text x="370" y="970" font-family="monospace" font-size="12" font-weight="bold" fill="#0f172a" text-anchor="middle">||| | |||| | |||</text>

        <text x="370" y="1025" font-family="monospace" font-size="11" fill="#64748b" text-anchor="middle">* AUTHENTIC SAMPLE BACK - A6 HALF-CARD STUDIO *</text>
      </svg>
    `)}`;
  }
}
