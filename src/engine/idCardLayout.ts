/**
 * OMNISCAN TITAN X - ID Card & CNIC Print Studio Layout Engine
 * Precision A4 / Multi-Format Document Printing Engine
 * Supports ID-1 / CNIC (85.6 × 53.98 mm), A6, A5, A4, Letter, Legal & Custom Sizes.
 * Automatic & Manual Grid Math, Margins, Gaps, Cutting Guides, Borders, Watermarks,
 * 100% Offline Multi-Page PDF Generation via pdf-lib & Native High-Precision Print.
 */

import { PDFDocument } from "pdf-lib";

export type IdCardUnit = "mm" | "cm" | "in" | "pt" | "px";

export type FrontBackLayoutMode =
  | "pairs-same-sheet" // Pairs (Front + Back) placed together across sheet
  | "front-and-back-same-sheet" // Front and Back alternating across grid
  | "front-only" // Front side repeated only
  | "back-only" // Back side repeated only
  | "separate-pages"; // Page 1: Front copies, Page 2: Back copies

export type PairArrangement = "side-by-side" | "stacked";

export interface IdCardPreset {
  id: string;
  name: string;
  category: string;
  widthMm: number;
  heightMm: number;
  description: string;
}

export interface IdCardPaperSize {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  category: "Standard Paper" | "Photo Sheets" | "Custom";
}

export const ID_CARD_PRESETS: IdCardPreset[] = [
  {
    id: "id-1-cnic",
    name: "ID-1 / CNIC / Driver License (85.6 × 54 mm)",
    category: "Standard Identification",
    widthMm: 85.6,
    heightMm: 53.98,
    description: "Standard ISO/IEC 7810 ID-1 CR80 format. Standard for National ID cards, CNIC, and Driver Licenses.",
  },
  {
    id: "a6-portrait",
    name: "A6 Portrait (105 × 148 mm)",
    category: "ISO Standard",
    widthMm: 105.0,
    heightMm: 148.0,
    description: "Standard ISO 216 A6 physical format in vertical portrait orientation (105 × 148 mm).",
  },
  {
    id: "a6-landscape",
    name: "A6 Landscape (148 × 105 mm)",
    category: "ISO Standard",
    widthMm: 148.0,
    heightMm: 105.0,
    description: "Standard ISO 216 A6 physical format in horizontal landscape orientation (148 × 105 mm).",
  },
  {
    id: "iso-a6",
    name: "A6 Document (105 × 148 mm)",
    category: "ISO Standard",
    widthMm: 105.0,
    heightMm: 148.0,
    description: "Quarter A4 standard (105 × 148 mm). Ideal for pocket forms, registration slips, and passes.",
  },
  {
    id: "iso-a5",
    name: "A5 Document (148 × 210 mm)",
    category: "ISO Standard",
    widthMm: 148.0,
    heightMm: 210.0,
    description: "Half A4 standard. Ideal for certificates, medical forms, and folded brochures.",
  },
  {
    id: "iso-a4",
    name: "A4 Document (210 × 297 mm)",
    category: "ISO Standard",
    widthMm: 210.0,
    heightMm: 297.0,
    description: "Full standard A4 size (1:1 direct document replication).",
  },
  {
    id: "us-letter",
    name: "US Letter (8.5 × 11.0 in / 215.9 × 279.4 mm)",
    category: "North American",
    widthMm: 215.9,
    heightMm: 279.4,
    description: "Standard North American Letter page.",
  },
  {
    id: "us-legal",
    name: "US Legal (8.5 × 14.0 in / 215.9 × 355.6 mm)",
    category: "North American",
    widthMm: 215.9,
    heightMm: 355.6,
    description: "Standard North American Legal page.",
  },
  {
    id: "iso-b6",
    name: "B6 Document (125 × 176 mm)",
    category: "ISO Standard",
    widthMm: 125.0,
    heightMm: 176.0,
    description: "B6 book and passport booklet size.",
  },
  {
    id: "custom",
    name: "Custom Dimensions...",
    category: "Custom",
    widthMm: 85.6,
    heightMm: 53.98,
    description: "User-specified custom physical dimensions.",
  },
];

export const ID_CARD_PAPER_SIZES: IdCardPaperSize[] = [
  {
    id: "iso-a4",
    name: "A4 Standard (210 × 297 mm)",
    widthMm: 210.0,
    heightMm: 297.0,
    category: "Standard Paper",
  },
  {
    id: "us-letter",
    name: "US Letter (8.5 × 11.0 in / 215.9 × 279.4 mm)",
    widthMm: 215.9,
    heightMm: 279.4,
    category: "Standard Paper",
  },
  {
    id: "us-legal",
    name: "US Legal (8.5 × 14.0 in / 215.9 × 355.6 mm)",
    widthMm: 215.9,
    heightMm: 355.6,
    category: "Standard Paper",
  },
  {
    id: "iso-a3",
    name: "A3 Large (297 × 420 mm)",
    widthMm: 297.0,
    heightMm: 420.0,
    category: "Standard Paper",
  },
  {
    id: "iso-a5",
    name: "A5 Compact (148 × 210 mm)",
    widthMm: 148.0,
    heightMm: 210.0,
    category: "Standard Paper",
  },
  {
    id: "iso-a6",
    name: "A6 Standard (105 × 148 mm)",
    widthMm: 105.0,
    heightMm: 148.0,
    category: "Standard Paper",
  },
  {
    id: "photo-4x6",
    name: "4 × 6 inch Photo (101.6 × 152.4 mm)",
    widthMm: 101.6,
    heightMm: 152.4,
    category: "Photo Sheets",
  },
  {
    id: "custom-paper",
    name: "Custom Paper Size...",
    widthMm: 210.0,
    heightMm: 297.0,
    category: "Custom",
  },
];

export interface IdCardStudioConfig {
  // Paper
  paperSizeId: string;
  paperWidthMm: number;
  paperHeightMm: number;
  orientation: "portrait" | "landscape";
  dpi: number; // 300 default

  // Document Dimensions
  presetId: string;
  docWidthMm: number;
  docHeightMm: number;
  unit: IdCardUnit;

  // Front / Back Layout Mode
  frontBackMode: FrontBackLayoutMode;
  pairArrangement: PairArrangement; // "side-by-side" | "stacked"

  // Copy Count & Grid
  copyCountMode: "auto" | "manual";
  manualColumns: number;
  manualRows: number;
  manualTotalCopies: number;

  // Margins (in mm)
  marginMode: "auto" | "manual";
  marginTopMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  marginRightMm: number;
  linkMargins: boolean;

  // Gaps (in mm)
  gapMode: "auto" | "manual";
  gapHMm: number;
  gapVMm: number;
  linkGaps: boolean;

  // Visual Borders
  borderEnabled: boolean;
  borderThicknessPx: number;
  borderStyle: "solid" | "dashed" | "dotted";
  borderColor: string;

  // Cutting Guides
  cuttingGuidesType: "none" | "corner-marks" | "crop-marks" | "dashed-lines";
  cuttingGuideColor: string;

  // Sample Watermark
  watermarkEnabled: boolean;
  watermarkText: string;

  // Document rotation per side (0, 90, 180, 270)
  frontRotation: number;
  backRotation: number;

  // Crop / Fit
  fitMode: "contain" | "cover";
}

export const DEFAULT_ID_CARD_CONFIG: IdCardStudioConfig = {
  paperSizeId: "iso-a4",
  paperWidthMm: 210.0,
  paperHeightMm: 297.0,
  orientation: "portrait",
  dpi: 300,

  presetId: "id-1-cnic",
  docWidthMm: 85.6,
  docHeightMm: 53.98,
  unit: "mm",

  frontBackMode: "separate-pages",
  pairArrangement: "side-by-side",

  copyCountMode: "auto",
  manualColumns: 2,
  manualRows: 4,
  manualTotalCopies: 8,

  marginMode: "auto",
  marginTopMm: 12.0,
  marginBottomMm: 12.0,
  marginLeftMm: 12.0,
  marginRightMm: 12.0,
  linkMargins: true,

  gapMode: "auto",
  gapHMm: 6.0,
  gapVMm: 8.0,
  linkGaps: false,

  borderEnabled: true,
  borderThicknessPx: 1,
  borderStyle: "solid",
  borderColor: "#94A3B8",

  cuttingGuidesType: "corner-marks",
  cuttingGuideColor: "#64748B",

  watermarkEnabled: false,
  watermarkText: "SAMPLE / FOR PRACTICE ONLY",

  frontRotation: 0,
  backRotation: 0,

  fitMode: "contain",
};

// -------------------------------------------------------------
// Unit Conversion Engine
// -------------------------------------------------------------
export function convertIdCardUnit(val: number, from: IdCardUnit, to: IdCardUnit): number {
  if (from === to) return val;
  // Convert from -> mm
  let inMm = val;
  if (from === "cm") inMm = val * 10;
  else if (from === "in") inMm = val * 25.4;
  else if (from === "pt") inMm = (val / 72) * 25.4;
  else if (from === "px") inMm = (val / 300) * 25.4;

  // Convert mm -> to
  if (to === "mm") return inMm;
  if (to === "cm") return inMm / 10;
  if (to === "in") return inMm / 25.4;
  if (to === "pt") return (inMm / 25.4) * 72;
  if (to === "px") return (inMm / 25.4) * 300;
  return inMm;
}

export interface IdCardInstancePosition {
  index: number;
  pairIndex: number;
  side: "front" | "back";
  pageIndex: number; // 0 for sheet 1, 1 for sheet 2 in separate-pages mode
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  row: number;
  col: number;
}

export interface IdCardLayoutCalculation {
  fits: boolean;
  columns: number;
  rows: number;
  totalCopies: number;
  totalPairs: number;
  pagesCount: number;
  printableWidthMm: number;
  printableHeightMm: number;
  actualMarginLeftMm: number;
  actualMarginTopMm: number;
  actualMarginRightMm: number;
  actualMarginBottomMm: number;
  actualGapHMm: number;
  actualGapVMm: number;
  positions: IdCardInstancePosition[];
  warningMessage?: string;
  sheetEfficiencyPercent: number;
}

/**
 * Calculates physical layout of ID card instances on paper
 */
export function calculateIdCardLayout(config: IdCardStudioConfig): IdCardLayoutCalculation {
  // Determine effective paper dimensions based on orientation
  const rawPaperW = config.paperWidthMm;
  const rawPaperH = config.paperHeightMm;
  const paperW = config.orientation === "landscape" ? Math.max(rawPaperW, rawPaperH) : Math.min(rawPaperW, rawPaperH);
  const paperH = config.orientation === "landscape" ? Math.min(rawPaperW, rawPaperH) : Math.max(rawPaperW, rawPaperH);

  const docW = config.docWidthMm;
  const docH = config.docHeightMm;

  let gapH = config.gapHMm;
  let gapV = config.gapVMm;

  let marginL = config.marginLeftMm;
  let marginR = config.marginRightMm;
  let marginT = config.marginTopMm;
  let marginB = config.marginBottomMm;

  let printableW = Math.max(10, paperW - marginL - marginR);
  let printableH = Math.max(10, paperH - marginT - marginB);

  let columns = 1;
  let rows = 1;
  let fits = true;
  let warningMessage: string | undefined;

  // Handling different front/back modes
  if (config.frontBackMode === "pairs-same-sheet") {
    // Treat Front + Back as a composite unit
    let unitW = docW;
    let unitH = docH;
    let internalGap = gapH;

    if (config.pairArrangement === "side-by-side") {
      unitW = docW * 2 + gapH;
      unitH = docH;
    } else {
      // stacked
      unitW = docW;
      unitH = docH * 2 + gapV;
      internalGap = gapV;
    }

    if (config.copyCountMode === "auto") {
      columns = Math.max(1, Math.floor((printableW + gapH) / (unitW + gapH)));
      rows = Math.max(1, Math.floor((printableH + gapV) / (unitH + gapV)));
    } else {
      columns = Math.max(1, config.manualColumns);
      rows = Math.max(1, config.manualRows);
    }

    const requiredW = columns * unitW + (columns - 1) * gapH;
    const requiredH = rows * unitH + (rows - 1) * gapV;

    if (requiredW > printableW || requiredH > printableH) {
      fits = false;
      warningMessage = `Selected grid (${columns} cols × ${rows} rows) requires ${requiredW.toFixed(1)} × ${requiredH.toFixed(1)} mm, which exceeds printable area (${printableW.toFixed(1)} × ${printableH.toFixed(1)} mm).`;
    }

    // Auto-balance margins to center content if auto margins enabled
    if (config.marginMode === "auto" && fits) {
      const extraX = Math.max(0, paperW - requiredW);
      const extraY = Math.max(0, paperH - requiredH);
      marginL = extraX / 2;
      marginR = extraX / 2;
      marginT = extraY / 2;
      marginB = extraY / 2;
    }

    const positions: IdCardInstancePosition[] = [];
    let pairCount = 0;
    const maxPairs = config.copyCountMode === "manual" && config.manualTotalCopies > 0
      ? config.manualTotalCopies
      : columns * rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        if (pairCount >= maxPairs) break;

        const unitX = marginL + c * (unitW + gapH);
        const unitY = marginT + r * (unitH + gapV);

        if (config.pairArrangement === "side-by-side") {
          // Front
          positions.push({
            index: positions.length,
            pairIndex: pairCount,
            side: "front",
            pageIndex: 0,
            xMm: unitX,
            yMm: unitY,
            widthMm: docW,
            heightMm: docH,
            row: r,
            col: c * 2,
          });
          // Back
          positions.push({
            index: positions.length,
            pairIndex: pairCount,
            side: "back",
            pageIndex: 0,
            xMm: unitX + docW + internalGap,
            yMm: unitY,
            widthMm: docW,
            heightMm: docH,
            row: r,
            col: c * 2 + 1,
          });
        } else {
          // Stacked
          // Front
          positions.push({
            index: positions.length,
            pairIndex: pairCount,
            side: "front",
            pageIndex: 0,
            xMm: unitX,
            yMm: unitY,
            widthMm: docW,
            heightMm: docH,
            row: r * 2,
            col: c,
          });
          // Back
          positions.push({
            index: positions.length,
            pairIndex: pairCount,
            side: "back",
            pageIndex: 0,
            xMm: unitX,
            yMm: unitY + docH + internalGap,
            widthMm: docW,
            heightMm: docH,
            row: r * 2 + 1,
            col: c,
          });
        }
        pairCount++;
      }
    }

    const usedArea = positions.length * docW * docH;
    const totalArea = paperW * paperH;
    const sheetEfficiencyPercent = Math.min(100, Math.round((usedArea / totalArea) * 100));

    return {
      fits,
      columns,
      rows,
      totalCopies: positions.length,
      totalPairs: pairCount,
      pagesCount: 1,
      printableWidthMm: printableW,
      printableHeightMm: printableH,
      actualMarginLeftMm: marginL,
      actualMarginTopMm: marginT,
      actualMarginRightMm: marginR,
      actualMarginBottomMm: marginB,
      actualGapHMm: gapH,
      actualGapVMm: gapV,
      positions,
      warningMessage,
      sheetEfficiencyPercent,
    };
  } else if (config.frontBackMode === "separate-pages") {
    // Two separate pages: Page 0 = Fronts, Page 1 = Backs
    if (config.copyCountMode === "auto") {
      columns = Math.max(1, Math.floor((printableW + gapH) / (docW + gapH)));
      rows = Math.max(1, Math.floor((printableH + gapV) / (docH + gapV)));
    } else {
      columns = Math.max(1, config.manualColumns);
      rows = Math.max(1, config.manualRows);
    }

    const requiredW = columns * docW + (columns - 1) * gapH;
    const requiredH = rows * docH + (rows - 1) * gapV;

    if (requiredW > printableW || requiredH > printableH) {
      fits = false;
      warningMessage = `Selected grid (${columns} × ${rows}) exceeds printable area.`;
    }

    if (config.marginMode === "auto" && fits) {
      const extraX = Math.max(0, paperW - requiredW);
      const extraY = Math.max(0, paperH - requiredH);
      marginL = extraX / 2;
      marginR = extraX / 2;
      marginT = extraY / 2;
      marginB = extraY / 2;
    }

    const positions: IdCardInstancePosition[] = [];
    const maxCopiesPerPage = config.copyCountMode === "manual" && config.manualTotalCopies > 0
      ? config.manualTotalCopies
      : columns * rows;

    // Page 0: Fronts
    let countPage0 = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        if (countPage0 >= maxCopiesPerPage) break;
        positions.push({
          index: positions.length,
          pairIndex: countPage0,
          side: "front",
          pageIndex: 0,
          xMm: marginL + c * (docW + gapH),
          yMm: marginT + r * (docH + gapV),
          widthMm: docW,
          heightMm: docH,
          row: r,
          col: c,
        });
        countPage0++;
      }
    }

    // Page 1: Backs
    let countPage1 = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        if (countPage1 >= maxCopiesPerPage) break;
        positions.push({
          index: positions.length,
          pairIndex: countPage1,
          side: "back",
          pageIndex: 1,
          xMm: marginL + c * (docW + gapH),
          yMm: marginT + r * (docH + gapV),
          widthMm: docW,
          heightMm: docH,
          row: r,
          col: c,
        });
        countPage1++;
      }
    }

    const usedArea = countPage0 * docW * docH;
    const sheetEfficiencyPercent = Math.min(100, Math.round((usedArea / (paperW * paperH)) * 100));

    return {
      fits,
      columns,
      rows,
      totalCopies: positions.length,
      totalPairs: countPage0,
      pagesCount: 2,
      printableWidthMm: printableW,
      printableHeightMm: printableH,
      actualMarginLeftMm: marginL,
      actualMarginTopMm: marginT,
      actualMarginRightMm: marginR,
      actualMarginBottomMm: marginB,
      actualGapHMm: gapH,
      actualGapVMm: gapV,
      positions,
      warningMessage,
      sheetEfficiencyPercent,
    };
  } else {
    // Single sheet modes: "front-and-back-same-sheet", "front-only", "back-only"
    if (config.copyCountMode === "auto") {
      columns = Math.max(1, Math.floor((printableW + gapH) / (docW + gapH)));
      rows = Math.max(1, Math.floor((printableH + gapV) / (docH + gapV)));
    } else {
      columns = Math.max(1, config.manualColumns);
      rows = Math.max(1, config.manualRows);
    }

    const requiredW = columns * docW + (columns - 1) * gapH;
    const requiredH = rows * docH + (rows - 1) * gapV;

    if (requiredW > printableW || requiredH > printableH) {
      fits = false;
      warningMessage = `Selected grid (${columns} × ${rows}) exceeds printable area.`;
    }

    if (config.marginMode === "auto" && fits) {
      const extraX = Math.max(0, paperW - requiredW);
      const extraY = Math.max(0, paperH - requiredH);
      marginL = extraX / 2;
      marginR = extraX / 2;
      marginT = extraY / 2;
      marginB = extraY / 2;
    }

    const positions: IdCardInstancePosition[] = [];
    const maxCopies = config.copyCountMode === "manual" && config.manualTotalCopies > 0
      ? config.manualTotalCopies
      : columns * rows;

    let itemCount = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        if (itemCount >= maxCopies) break;

        let side: "front" | "back" = "front";
        if (config.frontBackMode === "back-only") {
          side = "back";
        } else if (config.frontBackMode === "front-and-back-same-sheet") {
          side = itemCount % 2 === 0 ? "front" : "back";
        }

        positions.push({
          index: positions.length,
          pairIndex: Math.floor(itemCount / 2),
          side,
          pageIndex: 0,
          xMm: marginL + c * (docW + gapH),
          yMm: marginT + r * (docH + gapV),
          widthMm: docW,
          heightMm: docH,
          row: r,
          col: c,
        });

        itemCount++;
      }
    }

    const usedArea = positions.length * docW * docH;
    const sheetEfficiencyPercent = Math.min(100, Math.round((usedArea / (paperW * paperH)) * 100));

    return {
      fits,
      columns,
      rows,
      totalCopies: positions.length,
      totalPairs: Math.floor(positions.length / 2),
      pagesCount: 1,
      printableWidthMm: printableW,
      printableHeightMm: printableH,
      actualMarginLeftMm: marginL,
      actualMarginTopMm: marginT,
      actualMarginRightMm: marginR,
      actualMarginBottomMm: marginB,
      actualGapHMm: gapH,
      actualGapVMm: gapV,
      positions,
      warningMessage,
      sheetEfficiencyPercent,
    };
  }
}

// -------------------------------------------------------------
// High-Fidelity Canvas Rendering Engine
// -------------------------------------------------------------

const idCardImageCache = new Map<string, HTMLImageElement>();
const MAX_ID_CARD_IMAGE_CACHE_ENTRIES = 32;

/**
 * Loads an HTMLImageElement asynchronously from a dataUrl or blobUrl with LRU caching
 */
export function loadIdCardImage(src: string): Promise<HTMLImageElement> {
  const cached = idCardImageCache.get(src);
  if (cached && cached.complete && cached.naturalWidth > 0) {
    return Promise.resolve(cached);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (idCardImageCache.size >= MAX_ID_CARD_IMAGE_CACHE_ENTRIES) {
        const firstKey = idCardImageCache.keys().next().value;
        if (firstKey) idCardImageCache.delete(firstKey);
      }
      idCardImageCache.set(src, img);
      resolve(img);
    };
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

/**
 * Renders a specific sheet page (pageIndex 0 or 1) onto a canvas at target DPI
 */
export async function renderIdCardSheetCanvas(
  config: IdCardStudioConfig,
  frontImageDataUrl: string | HTMLCanvasElement | HTMLImageElement,
  backImageDataUrl: string | HTMLCanvasElement | HTMLImageElement,
  options: { targetDpi?: number; pageIndex?: number; destinationCanvas?: HTMLCanvasElement } = {}
): Promise<HTMLCanvasElement> {
  const targetDpi = options.targetDpi || config.dpi || 300;
  const pageIndex = options.pageIndex || 0;

  const rawPaperW = config.paperWidthMm;
  const rawPaperH = config.paperHeightMm;
  const paperWMm = config.orientation === "landscape" ? Math.max(rawPaperW, rawPaperH) : Math.min(rawPaperW, rawPaperH);
  const paperHMm = config.orientation === "landscape" ? Math.min(rawPaperW, rawPaperH) : Math.max(rawPaperW, rawPaperH);

  // Conversion: 1 inch = 25.4 mm
  const canvasWidth = Math.round((paperWMm / 25.4) * targetDpi);
  const canvasHeight = Math.round((paperHMm / 25.4) * targetDpi);

  const canvas = options.destinationCanvas || document.createElement("canvas");
  if (canvas.width !== canvasWidth) canvas.width = canvasWidth;
  if (canvas.height !== canvasHeight) canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not acquire 2D canvas context");

  // Pure clean white paper background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Calculate layout
  const layout = calculateIdCardLayout(config);
  const pagePositions = layout.positions.filter((p) => p.pageIndex === pageIndex);

  // Load images
  let frontImg: HTMLImageElement | HTMLCanvasElement | null = null;
  let backImg: HTMLImageElement | HTMLCanvasElement | null = null;

  try {
    if (frontImageDataUrl) {
      if (typeof frontImageDataUrl !== "string") {
        frontImg = frontImageDataUrl;
      } else {
        frontImg = await loadIdCardImage(frontImageDataUrl);
      }
    }
  } catch (e) {
    console.warn("Could not load front image:", e);
  }

  try {
    if (backImageDataUrl) {
      if (typeof backImageDataUrl !== "string") {
        backImg = backImageDataUrl;
      } else {
        backImg = await loadIdCardImage(backImageDataUrl);
      }
    }
  } catch (e) {
    console.warn("Could not load back image:", e);
  }

  // Draw each instance
  for (const pos of pagePositions) {
    const pxX = Math.round((pos.xMm / 25.4) * targetDpi);
    const pxY = Math.round((pos.yMm / 25.4) * targetDpi);
    const pxW = Math.round((pos.widthMm / 25.4) * targetDpi);
    const pxH = Math.round((pos.heightMm / 25.4) * targetDpi);

    const isFront = pos.side === "front";
    const imgToDraw = isFront ? frontImg : backImg;
    const rotationDeg = isFront ? config.frontRotation : config.backRotation;

    ctx.save();
    ctx.translate(pxX + pxW / 2, pxY + pxH / 2);
    if (rotationDeg !== 0) {
      ctx.rotate((rotationDeg * Math.PI) / 180);
    }

    const drawW = rotationDeg === 90 || rotationDeg === 270 ? pxH : pxW;
    const drawH = rotationDeg === 90 || rotationDeg === 270 ? pxW : pxH;

    if (imgToDraw) {
      // High-quality image rendering with contain or cover
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      if (config.fitMode === "cover") {
        const imgAspect = imgToDraw.width / imgToDraw.height;
        const boxAspect = drawW / drawH;
        let sX = 0, sY = 0, sW = imgToDraw.width, sH = imgToDraw.height;
        if (imgAspect > boxAspect) {
          sW = imgToDraw.height * boxAspect;
          sX = (imgToDraw.width - sW) / 2;
        } else {
          sH = imgToDraw.width / boxAspect;
          sY = (imgToDraw.height - sH) / 2;
        }
        ctx.drawImage(imgToDraw, sX, sY, sW, sH, -drawW / 2, -drawH / 2, drawW, drawH);
      } else {
        // contain
        const imgAspect = imgToDraw.width / imgToDraw.height;
        const boxAspect = drawW / drawH;
        let dW = drawW;
        let dH = drawH;
        if (imgAspect > boxAspect) {
          dH = drawW / imgAspect;
        } else {
          dW = drawH * imgAspect;
        }
        ctx.drawImage(imgToDraw, -dW / 2, -dH / 2, dW, dH);
      }
    } else {
      // Placeholder drawing if image is missing
      ctx.fillStyle = isFront ? "#F1F5F9" : "#E2E8F0";
      ctx.fillRect(-drawW / 2, -drawH / 2, drawW, drawH);
      ctx.fillStyle = "#64748B";
      ctx.font = `600 ${Math.max(12, Math.round(14 * (targetDpi / 300)))}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${isFront ? "FRONT" : "BACK"} (Slot #${pos.index + 1})`, 0, 0);
    }

    // Optional Sample Watermark
    if (config.watermarkEnabled && config.watermarkText) {
      ctx.save();
      ctx.rotate((-30 * Math.PI) / 180);
      ctx.fillStyle = "rgba(220, 38, 38, 0.45)"; // Translucent red
      ctx.font = `bold ${Math.max(10, Math.round(16 * (targetDpi / 300)))}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(config.watermarkText, 0, 0);
      ctx.restore();
    }

    ctx.restore();

    // Draw visual borders around instance
    if (config.borderEnabled) {
      ctx.save();
      ctx.strokeStyle = config.borderColor;
      ctx.lineWidth = Math.max(1, config.borderThicknessPx * (targetDpi / 300));
      if (config.borderStyle === "dashed") {
        ctx.setLineDash([6 * (targetDpi / 300), 4 * (targetDpi / 300)]);
      } else if (config.borderStyle === "dotted") {
        ctx.setLineDash([2 * (targetDpi / 300), 3 * (targetDpi / 300)]);
      } else {
        ctx.setLineDash([]);
      }
      ctx.strokeRect(pxX, pxY, pxW, pxH);
      ctx.restore();
    }

    // Draw cutting guides
    if (config.cuttingGuidesType !== "none") {
      drawCuttingGuides(ctx, pxX, pxY, pxW, pxH, config.cuttingGuidesType, config.cuttingGuideColor, targetDpi);
    }
  }

  return canvas;
}

/**
 * Draws precision corner marks, crop marks, or dashed cutting lines
 */
function drawCuttingGuides(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  type: "corner-marks" | "crop-marks" | "dashed-lines",
  color: string,
  dpi: number
) {
  const scale = dpi / 300;
  const len = 16 * scale; // 16px at 300 DPI
  const offset = 4 * scale;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, 1 * scale);

  if (type === "corner-marks") {
    // L-shaped corner tick marks inside or right at corners
    // Top-left
    ctx.beginPath();
    ctx.moveTo(x - offset, y + len);
    ctx.lineTo(x - offset, y - offset);
    ctx.lineTo(x + len, y - offset);
    ctx.stroke();

    // Top-right
    ctx.beginPath();
    ctx.moveTo(x + w - len, y - offset);
    ctx.lineTo(x + w + offset, y - offset);
    ctx.lineTo(x + w + offset, y + len);
    ctx.stroke();

    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(x - offset, y + h - len);
    ctx.lineTo(x - offset, y + h + offset);
    ctx.lineTo(x + len, y + h + offset);
    ctx.stroke();

    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(x + w - len, y + h + offset);
    ctx.lineTo(x + w + offset, y + h + offset);
    ctx.lineTo(x + w + offset, y + h - len);
    ctx.stroke();
  } else if (type === "crop-marks") {
    // Traditional crosshair crop marks extending outward
    // Top-left
    ctx.beginPath();
    ctx.moveTo(x, y - offset);
    ctx.lineTo(x, y - offset - len);
    ctx.moveTo(x - offset, y);
    ctx.lineTo(x - offset - len, y);
    ctx.stroke();

    // Top-right
    ctx.beginPath();
    ctx.moveTo(x + w, y - offset);
    ctx.lineTo(x + w, y - offset - len);
    ctx.moveTo(x + w + offset, y);
    ctx.lineTo(x + w + offset + len, y);
    ctx.stroke();

    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(x, y + h + offset);
    ctx.lineTo(x, y + h + offset + len);
    ctx.moveTo(x - offset, y + h);
    ctx.lineTo(x - offset - len, y + h);
    ctx.stroke();

    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(x + w, y + h + offset);
    ctx.lineTo(x + w, y + h + offset + len);
    ctx.moveTo(x + w + offset, y + h);
    ctx.lineTo(x + w + offset + len, y + h);
    ctx.stroke();
  } else if (type === "dashed-lines") {
    // Dashed perimeter cutting guide slightly offset
    ctx.setLineDash([4 * scale, 4 * scale]);
    ctx.strokeRect(x - offset, y - offset, w + offset * 2, h + offset * 2);
  }

  ctx.restore();
}

// -------------------------------------------------------------
// PDF & Export Engines (100% Offline via pdf-lib)
// -------------------------------------------------------------

/**
 * Exports printable multi-page or single-page PDF with exact physical dimensions in points
 */
export async function exportIdCardSheetAsPDF(
  config: IdCardStudioConfig,
  frontImageDataUrl: string,
  backImageDataUrl: string
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  const rawPaperW = config.paperWidthMm;
  const rawPaperH = config.paperHeightMm;
  const paperWMm = config.orientation === "landscape" ? Math.max(rawPaperW, rawPaperH) : Math.min(rawPaperW, rawPaperH);
  const paperHMm = config.orientation === "landscape" ? Math.min(rawPaperW, rawPaperH) : Math.max(rawPaperW, rawPaperH);

  // PDF Points (72 points per inch, 25.4 mm per inch)
  const ptWidth = (paperWMm / 25.4) * 72;
  const ptHeight = (paperHMm / 25.4) * 72;

  const layout = calculateIdCardLayout(config);
  const totalPages = layout.pagesCount;

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const page = pdfDoc.addPage([ptWidth, ptHeight]);

    // Render high-res 300 DPI canvas
    const highResCanvas = await renderIdCardSheetCanvas(config, frontImageDataUrl, backImageDataUrl, {
      targetDpi: 300,
      pageIndex: pageIdx,
    });
    const highResDataUrl = highResCanvas.toDataURL("image/jpeg", 0.96);

    const embeddedJpg = await pdfDoc.embedJpg(highResDataUrl);
    page.drawImage(embeddedJpg, {
      x: 0,
      y: 0,
      width: ptWidth,
      height: ptHeight,
    });
  }

  return await pdfDoc.save();
}

/**
 * Exports IdCard sheet as PNG/JPEG Blob
 */
export async function exportIdCardSheetAsBlob(
  config: IdCardStudioConfig,
  frontImageDataUrl: string,
  backImageDataUrl: string,
  format: "image/png" | "image/jpeg" = "image/png",
  dpi = 300,
  pageIndex = 0
): Promise<Blob> {
  const canvas = await renderIdCardSheetCanvas(config, frontImageDataUrl, backImageDataUrl, {
    targetDpi: dpi,
    pageIndex,
  });
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
 * Triggers centralized application printing system for exact physical dimensions
 */
export function printIdCardSheetCanvas(canvas: HTMLCanvasElement, config: IdCardStudioConfig) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("omniscan:open-print-dialog", {
        detail: {
          type: "id-card",
          title: "ID Card / CNIC Print Sheet",
          idCardConfig: config,
          defaultPaperSize: config.paperSizeId,
          defaultOrientation: config.orientation,
          hasCuttingGuides: config.cuttingGuidesType !== "none",
        },
      })
    );
  }
}

/**
 * Triggers centralized application printing system for multiple pages (e.g. Page 1 Front, Page 2 Back)
 */
export function printIdCardCanvases(canvases: HTMLCanvasElement[], config: IdCardStudioConfig) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("omniscan:open-print-dialog", {
        detail: {
          type: "id-card",
          title: "ID Card / CNIC Multi-Page Print Job",
          idCardConfig: config,
          defaultPaperSize: config.paperSizeId,
          defaultOrientation: config.orientation,
          hasCuttingGuides: config.cuttingGuidesType !== "none",
        },
      })
    );
  }
}

/**
 * Creates high-quality vector sample SVGs for practice/demonstration purposes
 */
export function createSampleIdCardSvg(side: "front" | "back"): string {
  if (side === "front") {
    return `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 856 540" width="856" height="540">
        <defs>
          <linearGradient id="frontBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#f8fafc"/>
            <stop offset="50%" stop-color="#f1f5f9"/>
            <stop offset="100%" stop-color="#e2e8f0"/>
          </linearGradient>
          <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#0f766e"/>
            <stop offset="100%" stop-color="#047857"/>
          </linearGradient>
        </defs>
        <rect width="856" height="540" rx="28" fill="url(#frontBg)" stroke="#cbd5e1" stroke-width="4"/>
        <rect x="0" y="0" width="856" height="88" rx="28" fill="url(#headerGrad)"/>
        <rect x="0" y="56" width="856" height="32" fill="url(#headerGrad)"/>
        
        <!-- Header Text -->
        <text x="428" y="44" font-family="sans-serif" font-size="22" font-weight="bold" fill="#ffffff" text-anchor="middle" letter-spacing="1">SAMPLE NATIONAL IDENTITY CARD</text>
        <text x="428" y="74" font-family="sans-serif" font-size="14" fill="#a7f3d0" text-anchor="middle">FOR PRACTICE &amp; PRINT TESTING ONLY</text>

        <!-- Photo Frame -->
        <rect x="52" y="128" width="180" height="225" rx="12" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2"/>
        <circle cx="142" cy="200" r="46" fill="#cbd5e1"/>
        <path d="M 82 320 C 82 260, 202 260, 202 320 Z" fill="#cbd5e1"/>
        <text x="142" y="340" font-family="sans-serif" font-size="12" fill="#64748b" text-anchor="middle">SAMPLE PHOTO</text>

        <!-- Details -->
        <text x="268" y="148" font-family="sans-serif" font-size="13" font-weight="bold" fill="#64748b">NAME / نام</text>
        <text x="268" y="174" font-family="sans-serif" font-size="20" font-weight="bold" fill="#0f172a">SAMPLE CITIZEN HOLDER</text>

        <text x="268" y="214" font-family="sans-serif" font-size="13" font-weight="bold" fill="#64748b">FATHER'S NAME / ولدیت</text>
        <text x="268" y="238" font-family="sans-serif" font-size="17" fill="#1e293b">SAMPLE GUARDIAN NAME</text>

        <text x="268" y="278" font-family="sans-serif" font-size="13" font-weight="bold" fill="#64748b">IDENTITY NUMBER / شناختی کارڈ نمبر</text>
        <text x="268" y="306" font-family="monospace" font-size="22" font-weight="bold" fill="#0f766e" letter-spacing="2">00000-0000000-0</text>

        <text x="268" y="346" font-family="sans-serif" font-size="13" font-weight="bold" fill="#64748b">DATE OF BIRTH</text>
        <text x="268" y="370" font-family="sans-serif" font-size="16" fill="#1e293b">01.01.1990</text>

        <text x="480" y="346" font-family="sans-serif" font-size="13" font-weight="bold" fill="#64748b">EXPIRY DATE</text>
        <text x="480" y="370" font-family="sans-serif" font-size="16" font-weight="bold" fill="#047857">01.01.2035</text>

        <!-- Watermark -->
        <text x="428" y="470" font-family="sans-serif" font-size="14" font-weight="bold" fill="#dc2626" opacity="0.65" text-anchor="middle" letter-spacing="2">SPECIMEN / NON-OFFICIAL SAMPLE FOR LAYOUT TEST</text>
      </svg>
    `)}`;
  } else {
    return `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 856 540" width="856" height="540">
        <defs>
          <linearGradient id="backBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#f8fafc"/>
            <stop offset="50%" stop-color="#f1f5f9"/>
            <stop offset="100%" stop-color="#e2e8f0"/>
          </linearGradient>
        </defs>
        <rect width="856" height="540" rx="28" fill="url(#backBg)" stroke="#cbd5e1" stroke-width="4"/>

        <!-- Top Bar -->
        <rect x="0" y="0" width="856" height="32" rx="28" fill="#334155"/>
        <rect x="0" y="16" width="856" height="16" fill="#334155"/>

        <!-- Address & Details -->
        <text x="52" y="80" font-family="sans-serif" font-size="13" font-weight="bold" fill="#64748b">PERMANENT ADDRESS / مستقل پتہ</text>
        <text x="52" y="108" font-family="sans-serif" font-size="16" fill="#1e293b">House #00, Street #00, Sector 0, Sample City, Country</text>

        <text x="52" y="156" font-family="sans-serif" font-size="13" font-weight="bold" fill="#64748b">CURRENT ADDRESS / موجودہ پتہ</text>
        <text x="52" y="184" font-family="sans-serif" font-size="16" fill="#1e293b">House #00, Street #00, Sector 0, Sample City, Country</text>

        <!-- Simulated Barcode / QR Box -->
        <rect x="52" y="240" width="752" height="120" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>
        <text x="428" y="295" font-family="monospace" font-size="18" fill="#475569" text-anchor="middle" letter-spacing="4">||||| | |||| ||| |||||| ||||| || |||||||| | |||</text>
        <text x="428" y="325" font-family="monospace" font-size="12" fill="#94a3b8" text-anchor="middle">&lt;SPECIMEN&lt;&lt;000000000000000000000000000000000000&lt;&lt;</text>

        <!-- Watermark -->
        <text x="428" y="450" font-family="sans-serif" font-size="14" font-weight="bold" fill="#dc2626" opacity="0.65" text-anchor="middle" letter-spacing="2">SPECIMEN / BACK SIDE PRINTING TEST</text>
      </svg>
    `)}`;
  }
}
