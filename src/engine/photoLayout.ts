/**
 * OMNISCAN TITAN X - Photo Print Studio & Layout Engine
 * 4x6" Sheet Calculation, Passport Specifications, Safe Margins, Borders, Cutting Guides, & Physical DPI Export
 */

import {
  PaperSizeSpec,
  PassportStandardSpec,
  PhotoSheetConfig,
  LayoutFitCalculation,
  PhotoInstancePosition,
  PaperUnit,
  PrinterProfile,
} from "../types";
import { PDFDocument } from "pdf-lib";
import { loadImage } from "./vision";

// -------------------------------------------------------------
// Standard Paper Sizes Specs
// -------------------------------------------------------------
export const STANDARD_PAPER_SIZES: PaperSizeSpec[] = [
  {
    id: "photo-4x6",
    name: "4 × 6 inch (102 × 152 mm)",
    widthInches: 4.0,
    heightInches: 6.0,
    widthMm: 101.6,
    heightMm: 152.4,
    category: "Photo Sheets",
  },
  {
    id: "photo-6x4",
    name: "6 × 4 inch Landscape (152 × 102 mm)",
    widthInches: 6.0,
    heightInches: 4.0,
    widthMm: 152.4,
    heightMm: 101.6,
    category: "Photo Sheets",
  },
  {
    id: "photo-5x7",
    name: "5 × 7 inch (127 × 178 mm)",
    widthInches: 5.0,
    heightInches: 7.0,
    widthMm: 127.0,
    heightMm: 177.8,
    category: "Photo Sheets",
  },
  {
    id: "photo-3.5x5",
    name: "3.5 × 5 inch (89 × 127 mm)",
    widthInches: 3.5,
    heightInches: 5.0,
    widthMm: 88.9,
    heightMm: 127.0,
    category: "Photo Sheets",
  },
  {
    id: "iso-a4",
    name: "A4 Standard (210 × 297 mm)",
    widthInches: 8.27,
    heightInches: 11.69,
    widthMm: 210.0,
    heightMm: 297.0,
    category: "Standard Paper",
  },
  {
    id: "us-letter",
    name: "US Letter (8.5 × 11.0 inch)",
    widthInches: 8.5,
    heightInches: 11.0,
    widthMm: 215.9,
    heightMm: 279.4,
    category: "Standard Paper",
  },
];

// -------------------------------------------------------------
// Standard Passport & ID Dimensions Specifications
// -------------------------------------------------------------
export const PASSPORT_STANDARDS: PassportStandardSpec[] = [
  {
    id: "us-passport",
    name: "US Passport / Visa / Green Card",
    country: "United States",
    widthInches: 2.0,
    heightInches: 2.0,
    widthMm: 50.8,
    heightMm: 50.8,
    description: "2 × 2 in (51 × 51 mm) square format with head height 1 - 1 3/8 in.",
    faceMinPercent: 50,
    faceMaxPercent: 69,
    suggestedCopies: 6, // 2x3 on 4x6"
  },
  {
    id: "uk-eu-schengen",
    name: "UK / EU / Schengen / Australia / Canada",
    country: "International",
    widthInches: 1.378,
    heightInches: 1.772,
    widthMm: 35.0,
    heightMm: 45.0,
    description: "35 × 45 mm (ICAO Doc 9303 standard biometric passport format).",
    faceMinPercent: 70,
    faceMaxPercent: 80,
    suggestedCopies: 8, // 2x4 on 4x6"
  },
  {
    id: "india-passport",
    name: "India Passport / OCI Card",
    country: "India",
    widthInches: 1.378,
    heightInches: 1.772,
    widthMm: 35.0,
    heightMm: 45.0,
    description: "35 × 45 mm standard (or 51 × 51 mm for Indian Visa / OCI).",
    faceMinPercent: 65,
    faceMaxPercent: 75,
    suggestedCopies: 8,
  },
  {
    id: "pakistan-passport",
    name: "Pakistan Passport / CNIC / Visa",
    country: "Pakistan",
    widthInches: 1.378,
    heightInches: 1.772,
    widthMm: 35.0,
    heightMm: 45.0,
    description: "35 × 45 mm (or 2 × 1.5 in) standard biometric NADRA passport and CNIC format.",
    faceMinPercent: 70,
    faceMaxPercent: 80,
    suggestedCopies: 8, // 2x4 on 4x6"
  },
  {
    id: "japan-passport",
    name: "Japan Passport / Driving License",
    country: "Japan",
    widthInches: 1.378,
    heightInches: 1.772,
    widthMm: 35.0,
    heightMm: 45.0,
    description: "35 × 45 mm passport photo (30 × 40 mm for driving license / resume).",
    faceMinPercent: 70,
    faceMaxPercent: 80,
    suggestedCopies: 8,
  },
  {
    id: "china-visa",
    name: "China Visa / Passport",
    country: "China",
    widthInches: 1.299,
    heightInches: 1.89,
    widthMm: 33.0,
    heightMm: 48.0,
    description: "33 × 48 mm biometric format with head height 28 - 33 mm.",
    faceMinPercent: 58,
    faceMaxPercent: 68,
    suggestedCopies: 8,
  },
  {
    id: "wallet-mini",
    name: "2 × 3 Wallet Photo / Mini Print",
    country: "General",
    widthInches: 2.0,
    heightInches: 3.0,
    widthMm: 50.8,
    heightMm: 76.2,
    description: "2 × 3 inch (51 × 76 mm) portrait mini photo print.",
    suggestedCopies: 4, // 2x2 on 4x6"
  },
  {
    id: "custom-photo",
    name: "Custom Dimension",
    country: "Custom",
    widthInches: 2.0,
    heightInches: 2.0,
    widthMm: 50.8,
    heightMm: 50.8,
    description: "User-defined custom width and height.",
    suggestedCopies: 6,
  },
];

// Unit Conversion Helpers
export function convertUnits(val: number, from: PaperUnit, to: PaperUnit): number {
  if (from === to) return val;
  // Convert from -> inches
  let inInches = val;
  if (from === "mm") inInches = val / 25.4;
  else if (from === "cm") inInches = val / 2.54;
  else if (from === "px") inInches = val / 300; // assume 300 base

  // Convert inches -> to
  if (to === "in") return inInches;
  if (to === "mm") return inInches * 25.4;
  if (to === "cm") return inInches * 2.54;
  if (to === "px") return inInches * 300;
  return inInches;
}

export const BUILTIN_PRINTER_PROFILES: PrinterProfile[] = [
  {
    id: "auto",
    name: "Automatic (Optimized 4×6\" Sheet Fit)",
    paperSizeId: "photo-4x6",
    feedRotation: 90,
  },
  {
    id: "feed-90-standard",
    name: "90° Standard 4×6\" Feed (8-Copy Biometric Standard)",
    paperSizeId: "photo-4x6",
    feedRotation: 90,
  },
  {
    id: "feed-0-direct",
    name: "0° Direct Upright Sheet",
    paperSizeId: "photo-4x6",
    feedRotation: 0,
  },
  {
    id: "feed-180-inverted",
    name: "180° Inverted Feed",
    paperSizeId: "photo-4x6",
    feedRotation: 180,
  },
  {
    id: "feed-270-counter",
    name: "270° Counter-Feed",
    paperSizeId: "photo-4x6",
    feedRotation: 270,
  },
];

export const DEFAULT_PHOTO_SHEET_CONFIG: PhotoSheetConfig = {
  paperSizeId: "photo-4x6",
  paperWidthInches: 4.0,
  paperHeightInches: 6.0,
  paperUnit: "in",
  dpi: 300,
  orientation: "portrait",

  printInstanceRotation: 90,
  printerProfileId: "feed-90-standard",

  passportStandardId: "uk-eu-schengen",
  photoWidthInches: 1.378,
  photoHeightInches: 1.772,
  photoUnit: "mm",
  fitMode: "crop",

  copies: 8,
  autoFit: true,
  columns: 2,
  rows: 4,

  marginTopInches: 0.1,
  marginBottomInches: 0.1,
  marginLeftInches: 0.1,
  marginRightInches: 0.1,

  gapHorizontalInches: 0.08,
  gapVerticalInches: 0.08,

  border: {
    enabled: true,
    widthPx: 1,
    color: "#000000",
    style: "solid",
  },

  cuttingGuides: {
    type: "corner-marks",
    color: "#94A3B8",
    thicknessPx: 1,
    lengthMm: 4,
    offsetMm: 1,
  },

  globalFilterPreset: "original",
  backgroundColor: "#FFFFFF",
};

/**
 * Calculate Grid Layout, Placements, and Auto-Fit Validation with 0° Source vs 90° Print Instance Rotation
 */
export function calculatePhotoSheetLayout(
  config: PhotoSheetConfig,
  sourcePhotoIds: string[] = ["photo-1"]
): LayoutFitCalculation {
  const paperW =
    config.orientation === "landscape"
      ? Math.max(config.paperWidthInches, config.paperHeightInches)
      : Math.min(config.paperWidthInches, config.paperHeightInches);
  const paperH =
    config.orientation === "landscape"
      ? Math.min(config.paperWidthInches, config.paperHeightInches)
      : Math.max(config.paperWidthInches, config.paperHeightInches);

  const printableW = Math.max(0.1, paperW - config.marginLeftInches - config.marginRightInches);
  const printableH = Math.max(0.1, paperH - config.marginTopInches - config.marginBottomInches);

  // Effective slot dimensions on paper considering printInstanceRotation
  const isRotated90or270 =
    config.printInstanceRotation === 90 || config.printInstanceRotation === 270;
  const cellW = isRotated90or270 ? config.photoHeightInches : config.photoWidthInches;
  const cellH = isRotated90or270 ? config.photoWidthInches : config.photoHeightInches;

  const gapH = config.gapHorizontalInches;
  const gapV = config.gapVerticalInches;

  // Maximum columns & rows mathematically possible within printable area
  const maxCols = Math.max(1, Math.floor((printableW + gapH) / (cellW + gapH)));
  const maxRows = Math.max(1, Math.floor((printableH + gapV) / (cellH + gapV)));
  const maxPhotosPerSheet = maxCols * maxRows;

  let actualCols = config.columns;
  let actualRows = config.rows;

  if (config.autoFit) {
    // Auto-calculate best columns & rows to accommodate requested copies up to capacity
    actualCols = maxCols;
    actualRows = Math.min(maxRows, Math.ceil(config.copies / maxCols));
    if (actualRows < 1) actualRows = 1;
  }

  // Calculate actual dimensions consumed by the grid
  const gridW = actualCols * cellW + Math.max(0, actualCols - 1) * gapH;
  const gridH = actualRows * cellH + Math.max(0, actualRows - 1) * gapV;

  // Verify fit within the printable area bounded by margins
  const fits = gridW <= printableW + 0.001 && gridH <= printableH + 0.001;
  const totalCapacity = actualCols * actualRows;
  const totalPhotosPlaced = Math.min(config.copies, totalCapacity);
  const overflowCount = Math.max(0, config.copies - totalPhotosPlaced);

  let warningMessage: string | undefined;
  if (!fits) {
    warningMessage = "Layout does not fit within the 4×6 printable area.";
  } else if (overflowCount > 0) {
    warningMessage = `Sheet fits ${totalPhotosPlaced} photos. ${overflowCount} remaining photo${overflowCount > 1 ? "s" : ""} will go to next sheet.`;
  }

  // Determine grid positioning: Auto centers within printable area, Manual starts at exact marginLeft/marginTop
  const isAutoMargin = config.marginMode !== "manual";
  const startX = isAutoMargin
    ? config.marginLeftInches + Math.max(0, (printableW - gridW) / 2)
    : config.marginLeftInches;
  const startY = isAutoMargin
    ? config.marginTopInches + Math.max(0, (printableH - gridH) / 2)
    : config.marginTopInches;

  const positions: PhotoInstancePosition[] = [];

  let placed = 0;
  for (let r = 0; r < actualRows && placed < totalPhotosPlaced; r++) {
    for (let c = 0; c < actualCols && placed < totalPhotosPlaced; c++) {
      const posX = startX + c * (cellW + gapH);
      const posY = startY + r * (cellH + gapV);
      const photoId = sourcePhotoIds[placed % sourcePhotoIds.length] || sourcePhotoIds[0];

      positions.push({
        id: `pos-${placed}`,
        index: placed,
        sourcePhotoId: photoId,
        xInches: posX,
        yInches: posY,
        widthInches: cellW,
        heightInches: cellH,
        row: r,
        column: c,
        rotationDeg: config.printInstanceRotation,
      });

      placed++;
    }
  }

  const sheetEfficiencyPercent = Math.min(
    100,
    Math.round(((totalPhotosPlaced * cellW * cellH) / (paperW * paperH)) * 100)
  );

  return {
    fits,
    maxColumns: maxCols,
    maxRows: maxRows,
    maxPhotosPerSheet,
    actualColumns: actualCols,
    actualRows: actualRows,
    totalPhotosPlaced,
    sheetEfficiencyPercent,
    overflowCount,
    warningMessage,
    positions,
    printableWidthInches: printableW,
    printableHeightInches: printableH,
    pixelDimensions: {
      width: Math.round(paperW * config.dpi),
      height: Math.round(paperH * config.dpi),
    },
  };
}

/**
 * Render High-Resolution or Preview Photo Sheet to an HTMLCanvasElement
 */
export async function renderPhotoSheetCanvas(
  config: PhotoSheetConfig,
  sourceImages: Record<string, string>, // photoId -> dataUrl (CamScanner processed at 0°)
  options: {
    targetDpi?: number;
    showGuidesOverlay?: boolean;
    scaleMultiplier?: number;
  } = {}
): Promise<HTMLCanvasElement> {
  const dpi = options.targetDpi || config.dpi;
  const paperW =
    config.orientation === "landscape"
      ? Math.max(config.paperWidthInches, config.paperHeightInches)
      : Math.min(config.paperWidthInches, config.paperHeightInches);
  const paperH =
    config.orientation === "landscape"
      ? Math.min(config.paperWidthInches, config.paperHeightInches)
      : Math.max(config.paperWidthInches, config.paperHeightInches);

  const canvasW = Math.round(paperW * dpi);
  const canvasH = Math.round(paperH * dpi);

  const canvas = document.createElement("canvas");
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas context failed");

  // Step 1: Fill clean paper background
  ctx.fillStyle = config.backgroundColor || "#FFFFFF";
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Step 2: Solve layout
  const photoIds = Object.keys(sourceImages);
  const layout = calculatePhotoSheetLayout(config, photoIds.length > 0 ? photoIds : ["photo-1"]);

  // Pre-load images to avoid re-decoding per cell
  const imageElements: Record<string, HTMLImageElement> = {};
  for (const [id, url] of Object.entries(sourceImages)) {
    try {
      imageElements[id] = await loadImage(url);
    } catch (e) {
      console.warn("Failed to load source image for layout:", id, e);
    }
  }

  // Step 3: Draw Photos with Print Rotation
  for (const pos of layout.positions) {
    const pxX = Math.round(pos.xInches * dpi);
    const pxY = Math.round(pos.yInches * dpi);
    const pxW = Math.round(pos.widthInches * dpi);
    const pxH = Math.round(pos.heightInches * dpi);

    const img = imageElements[pos.sourcePhotoId] || Object.values(imageElements)[0];
    const rotation = pos.rotationDeg ?? config.printInstanceRotation ?? 0;

    if (img) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(pxX, pxY, pxW, pxH);
      ctx.clip();

      const centerX = pxX + pxW / 2;
      const centerY = pxY + pxH / 2;
      ctx.translate(centerX, centerY);

      if (rotation !== 0) {
        ctx.rotate((rotation * Math.PI) / 180);
      }

      // Local dimensions inside rotated context
      const is90or270 = rotation === 90 || rotation === 270;
      const localW = is90or270 ? pxH : pxW;
      const localH = is90or270 ? pxW : pxH;

      // Fit / Fill / Crop Logic
      if (config.fitMode === "fit") {
        const aspectImg = img.width / img.height;
        const aspectTarget = localW / localH;
        let drawW = localW;
        let drawH = localH;

        if (aspectImg > aspectTarget) {
          drawH = localW / aspectImg;
        } else {
          drawW = localH * aspectImg;
        }
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(-localW / 2, -localH / 2, localW, localH);
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      } else if (config.fitMode === "stretch") {
        ctx.drawImage(img, -localW / 2, -localH / 2, localW, localH);
      } else {
        // Crop / Fill centered
        const aspectImg = img.width / img.height;
        const aspectTarget = localW / localH;
        let sx = 0;
        let sy = 0;
        let sw = img.width;
        let sh = img.height;

        if (aspectImg > aspectTarget) {
          sw = img.height * aspectTarget;
          sx = (img.width - sw) / 2;
        } else {
          sh = img.width / aspectTarget;
          sy = (img.height - sh) / 2;
        }

        ctx.drawImage(img, sx, sy, sw, sh, -localW / 2, -localH / 2, localW, localH);
      }

      ctx.restore();
    } else {
      // Placeholder photo box
      ctx.fillStyle = "#F1F5F9";
      ctx.fillRect(pxX, pxY, pxW, pxH);
      ctx.fillStyle = "#94A3B8";
      ctx.font = `${Math.round(14 * (dpi / 150))}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(`Photo #${pos.index + 1}`, pxX + pxW / 2, pxY + pxH / 2);
    }

    // Step 4: Photo Border around each print instance
    if (config.border.enabled && config.border.widthPx > 0) {
      const bWidth = Math.max(1, Math.round(config.border.widthPx * (dpi / 300)));
      ctx.strokeStyle = config.border.color || "#000000";
      ctx.lineWidth = bWidth;
      if (config.border.style === "dashed") {
        ctx.setLineDash([6 * (dpi / 300), 4 * (dpi / 300)]);
      } else {
        ctx.setLineDash([]);
      }
      ctx.strokeRect(pxX, pxY, pxW, pxH);
      ctx.setLineDash([]);
    }

    // Step 5: Cutting Guides
    if (config.cuttingGuides.type !== "none") {
      drawCuttingGuides(ctx, pos, config.cuttingGuides, dpi);
    }
  }

  return canvas;
}

/**
 * Draw Precision Cutting Guides (Corner marks, Crop marks, Grid lines)
 */
function drawCuttingGuides(
  ctx: CanvasRenderingContext2D,
  pos: PhotoInstancePosition,
  guide: PhotoSheetConfig["cuttingGuides"],
  dpi: number
) {
  const pxX = Math.round(pos.xInches * dpi);
  const pxY = Math.round(pos.yInches * dpi);
  const pxW = Math.round(pos.widthInches * dpi);
  const pxH = Math.round(pos.heightInches * dpi);

  const lenPx = Math.round((guide.lengthMm / 25.4) * dpi);
  const offsetPx = Math.round((guide.offsetMm / 25.4) * dpi);

  ctx.save();
  ctx.strokeStyle = guide.color || "#94A3B8";
  ctx.lineWidth = Math.max(1, Math.round(guide.thicknessPx * (dpi / 300)));
  ctx.setLineDash([]);

  if (guide.type === "corner-marks") {
    // Top-Left L
    ctx.beginPath();
    ctx.moveTo(pxX - offsetPx - lenPx, pxY);
    ctx.lineTo(pxX - offsetPx, pxY);
    ctx.lineTo(pxX - offsetPx, pxY - offsetPx - lenPx);
    ctx.stroke();

    // Top-Right L
    ctx.beginPath();
    ctx.moveTo(pxX + pxW + offsetPx + lenPx, pxY);
    ctx.lineTo(pxX + pxW + offsetPx, pxY);
    ctx.lineTo(pxX + pxW + offsetPx, pxY - offsetPx - lenPx);
    ctx.stroke();

    // Bottom-Left L
    ctx.beginPath();
    ctx.moveTo(pxX - offsetPx - lenPx, pxY + pxH);
    ctx.lineTo(pxX - offsetPx, pxY + pxH);
    ctx.lineTo(pxX - offsetPx, pxY + pxH + offsetPx + lenPx);
    ctx.stroke();

    // Bottom-Right L
    ctx.beginPath();
    ctx.moveTo(pxX + pxW + offsetPx + lenPx, pxY + pxH);
    ctx.lineTo(pxX + pxW + offsetPx, pxY + pxH);
    ctx.lineTo(pxX + pxW + offsetPx, pxY + pxH + offsetPx + lenPx);
    ctx.stroke();
  } else if (guide.type === "grid-lines") {
    ctx.setLineDash([4 * (dpi / 300), 4 * (dpi / 300)]);
    ctx.strokeRect(pxX - 1, pxY - 1, pxW + 2, pxH + 2);
  }

  ctx.restore();
}

// -------------------------------------------------------------
// PDF & Image Export Engines
// -------------------------------------------------------------

/**
 * Export high-resolution 4x6" PDF with exact physical dimensions in points
 */
export async function exportPhotoSheetAsPDF(
  config: PhotoSheetConfig,
  sourceImages: Record<string, string>
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  const paperW = config.orientation === "landscape" ? Math.max(config.paperWidthInches, config.paperHeightInches) : Math.min(config.paperWidthInches, config.paperHeightInches);
  const paperH = config.orientation === "landscape" ? Math.min(config.paperWidthInches, config.paperHeightInches) : Math.max(config.paperWidthInches, config.paperHeightInches);

  // PDF Points (72 points per inch)
  const ptWidth = paperW * 72;
  const ptHeight = paperH * 72;

  const page = pdfDoc.addPage([ptWidth, ptHeight]);

  // Render high DPI 300/600 raster of the sheet
  const highResCanvas = await renderPhotoSheetCanvas(config, sourceImages, { targetDpi: Math.max(300, config.dpi) });
  const highResDataUrl = highResCanvas.toDataURL("image/jpeg", 0.96);

  const embeddedJpg = await pdfDoc.embedJpg(highResDataUrl);
  page.drawImage(embeddedJpg, {
    x: 0,
    y: 0,
    width: ptWidth,
    height: ptHeight,
  });

  return await pdfDoc.save();
}

/**
 * Export Photo Sheet as High-Res Raster File Blob (PNG / JPEG)
 */
export async function exportPhotoSheetAsBlob(
  config: PhotoSheetConfig,
  sourceImages: Record<string, string>,
  format: "image/png" | "image/jpeg" = "image/jpeg",
  dpi = 300
): Promise<Blob> {
  const canvas = await renderPhotoSheetCanvas(config, sourceImages, { targetDpi: dpi });
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas blob export failed"));
      },
      format,
      format === "image/jpeg" ? 0.95 : undefined
    );
  });
}

/**
 * Trigger Centralized Application Print System for Photo Sheet with 100% exact scaling
 */
export function printPhotoSheetCanvas(canvas: HTMLCanvasElement, config: PhotoSheetConfig) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("omniscan:open-print-dialog", {
        detail: {
          type: "photo-sheet",
          title: `Photo Sheet (${config.paperSizeId.toUpperCase()})`,
          photoSheetConfig: config,
          defaultPaperSize: config.paperSizeId,
          defaultOrientation: config.orientation,
          hasCuttingGuides: config.cuttingGuides.type !== "none",
        },
      })
    );
  }
}
