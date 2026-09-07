/**
 * Vector & CorelDRAW Export Importer for ID & Service Card Designer
 * 
 * Supports:
 * - CorelDRAW-exported SVG with vector object extraction (<rect>, <circle>, <text>, <image>, <path>)
 * - PDF documents rendered at 300 DPI print fidelity
 * - Transparent PNG signatures with alpha channel preservation
 * - Transparent detection and guidance for native binary .cdr files
 */

import { CardObject, CardSide } from "./types";
import * as pdfjsLib from "pdfjs-dist";

export interface ImportResult {
  success: boolean;
  format: "svg" | "pdf" | "image" | "cdr-notice";
  objects: CardObject[];
  message: string;
  isFlattened?: boolean;
  detectedDimensionsMm?: { width: number; height: number };
}

/**
 * Parse an SVG string exported from CorelDRAW, Illustrator, or Inkscape
 * into editable CardObject elements.
 */
export function parseSvgToCardObjects(
  svgString: string,
  targetSide: CardSide = "front",
  cardWidthMm: number = 74,
  cardHeightMm: number = 105
): ImportResult {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, "image/svg+xml");
    const svgEl = doc.querySelector("svg");

    if (!svgEl) {
      return {
        success: false,
        format: "svg",
        objects: [],
        message: "Invalid SVG: No <svg> root element found.",
      };
    }

    // Determine SVG viewBox / dimensions
    let svgWidth = 74;
    let svgHeight = 105;
    const viewBoxAttr = svgEl.getAttribute("viewBox");
    if (viewBoxAttr) {
      const parts = viewBoxAttr.split(/[\s,]+/).map(parseFloat);
      if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
        svgWidth = parts[2];
        svgHeight = parts[3];
      }
    } else {
      const wAttr = parseFloat(svgEl.getAttribute("width") || "74");
      const hAttr = parseFloat(svgEl.getAttribute("height") || "105");
      if (wAttr > 0) svgWidth = wAttr;
      if (hAttr > 0) svgHeight = hAttr;
    }

    // Scale factor from SVG coordinates to mm
    const scaleX = cardWidthMm / svgWidth;
    const scaleY = cardHeightMm / svgHeight;

    const objects: CardObject[] = [];
    let zIndex = 1;

    // Recursive or sequential traversal of elements
    const elements = svgEl.querySelectorAll("rect, circle, ellipse, line, text, image, path, polygon");

    elements.forEach((el, index) => {
      const tagName = el.tagName.toLowerCase();
      const id = `svg-import-${Date.now()}-${index}`;

      const fill = el.getAttribute("fill") || (el as HTMLElement).style.fill || "#000000";
      const stroke = el.getAttribute("stroke") || (el as HTMLElement).style.stroke || "none";
      const strokeWidthVal = parseFloat(el.getAttribute("stroke-width") || (el as HTMLElement).style.strokeWidth || "0") * scaleX;
      const opacity = parseFloat(el.getAttribute("opacity") || (el as HTMLElement).style.opacity || "1");

      if (tagName === "rect") {
        const x = (parseFloat(el.getAttribute("x") || "0")) * scaleX;
        const y = (parseFloat(el.getAttribute("y") || "0")) * scaleY;
        const width = (parseFloat(el.getAttribute("width") || "10")) * scaleX;
        const height = (parseFloat(el.getAttribute("height") || "10")) * scaleY;
        const rx = (parseFloat(el.getAttribute("rx") || "0")) * scaleX;

        objects.push({
          id,
          name: `Vector Rect ${index + 1}`,
          type: "shape",
          targetSide,
          x: Math.max(0, Math.min(cardWidthMm - 1, x)),
          y: Math.max(0, Math.min(cardHeightMm - 1, y)),
          width: Math.max(1, width),
          height: Math.max(1, height),
          rotation: 0,
          opacity: isNaN(opacity) ? 1 : opacity,
          zIndex: zIndex++,
          visible: true,
          locked: false,
          aspectRatioLocked: false,
          flipX: false,
          flipY: false,
          shapeType: rx > 0 ? "rounded-rect" : "rect",
          cornerRadius: rx,
          fillColor: fill === "none" ? "transparent" : fill,
          strokeColor: stroke === "none" ? undefined : stroke,
          strokeWidth: strokeWidthVal,
        });
      } else if (tagName === "circle" || tagName === "ellipse") {
        const cx = (parseFloat(el.getAttribute("cx") || "0")) * scaleX;
        const cy = (parseFloat(el.getAttribute("cy") || "0")) * scaleY;
        const r = (parseFloat(el.getAttribute("r") || "5")) * scaleX;
        const rx = (parseFloat(el.getAttribute("rx") || String(r))) * scaleX;
        const ry = (parseFloat(el.getAttribute("ry") || String(r))) * scaleY;

        objects.push({
          id,
          name: `Vector Circle ${index + 1}`,
          type: "shape",
          targetSide,
          x: Math.max(0, cx - rx),
          y: Math.max(0, cy - ry),
          width: Math.max(1, rx * 2),
          height: Math.max(1, ry * 2),
          rotation: 0,
          opacity: isNaN(opacity) ? 1 : opacity,
          zIndex: zIndex++,
          visible: true,
          locked: false,
          aspectRatioLocked: true,
          flipX: false,
          flipY: false,
          shapeType: "circle",
          fillColor: fill === "none" ? "transparent" : fill,
          strokeColor: stroke === "none" ? undefined : stroke,
          strokeWidth: strokeWidthVal,
        });
      } else if (tagName === "text") {
        const x = (parseFloat(el.getAttribute("x") || "0")) * scaleX;
        const y = (parseFloat(el.getAttribute("y") || "0")) * scaleY;
        const content = el.textContent?.trim() || "Vector Text";
        const fontSizeAttr = parseFloat(el.getAttribute("font-size") || (el as HTMLElement).style.fontSize || "12");
        const fontWeight = el.getAttribute("font-weight") || (el as HTMLElement).style.fontWeight || "normal";
        const fontFamily = el.getAttribute("font-family") || (el as HTMLElement).style.fontFamily || "Plus Jakarta Sans";

        objects.push({
          id,
          name: `Imported Text "${content.slice(0, 12)}"`,
          type: "text",
          targetSide,
          x: Math.max(0, x),
          y: Math.max(0, y - 4),
          width: Math.min(cardWidthMm, Math.max(15, content.length * 2.5)),
          height: 6,
          rotation: 0,
          opacity: isNaN(opacity) ? 1 : opacity,
          zIndex: zIndex++,
          visible: true,
          locked: false,
          aspectRatioLocked: false,
          flipX: false,
          flipY: false,
          text: content,
          fontSize: Math.max(6, Math.min(36, fontSizeAttr * 0.75)),
          fontWeight: fontWeight.includes("bold") || fontWeight === "700" ? "bold" : "normal",
          fontFamily,
          textColor: fill === "none" ? "#000000" : fill,
          textAlign: "left",
        });
      } else if (tagName === "image") {
        const href = el.getAttribute("href") || el.getAttribute("xlink:href") || "";
        const x = (parseFloat(el.getAttribute("x") || "0")) * scaleX;
        const y = (parseFloat(el.getAttribute("y") || "0")) * scaleY;
        const width = (parseFloat(el.getAttribute("width") || "20")) * scaleX;
        const height = (parseFloat(el.getAttribute("height") || "20")) * scaleY;

        if (href) {
          objects.push({
            id,
            name: `Imported Image ${index + 1}`,
            type: "image",
            targetSide,
            x: Math.max(0, x),
            y: Math.max(0, y),
            width: Math.max(2, width),
            height: Math.max(2, height),
            rotation: 0,
            opacity: isNaN(opacity) ? 1 : opacity,
            zIndex: zIndex++,
            visible: true,
            locked: false,
            aspectRatioLocked: true,
            flipX: false,
            flipY: false,
            src: href,
          });
        }
      } else if (tagName === "path") {
        // Render complex vector paths as SVG objects preserving vector rendering
        const d = el.getAttribute("d") || "";
        if (d) {
          const pathSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}"><path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidthVal || 1}" /></svg>`;
          const encodedSvg = `data:image/svg+xml;utf8,${encodeURIComponent(pathSvg)}`;

          objects.push({
            id,
            name: `Vector Path ${index + 1}`,
            type: "image",
            targetSide,
            x: 0,
            y: 0,
            width: cardWidthMm,
            height: cardHeightMm,
            rotation: 0,
            opacity: isNaN(opacity) ? 1 : opacity,
            zIndex: zIndex++,
            visible: true,
            locked: false,
            aspectRatioLocked: false,
            flipX: false,
            flipY: false,
            src: encodedSvg,
          });
        }
      }
    });

    return {
      success: true,
      format: "svg",
      objects,
      message: `Successfully extracted ${objects.length} vector elements from SVG.`,
      detectedDimensionsMm: { width: cardWidthMm, height: cardHeightMm },
    };
  } catch (err) {
    return {
      success: false,
      format: "svg",
      objects: [],
      message: `Failed to parse SVG: ${(err as Error).message}`,
    };
  }
}

/**
 * Render a PDF page into a high-resolution 300 DPI CardObject
 */
export async function importPdfPageAsCardObject(
  file: File,
  pageIndex: number = 1,
  targetSide: CardSide = "front",
  cardWidthMm: number = 74,
  cardHeightMm: number = 105
): Promise<ImportResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;
    const page = await pdfDoc.getPage(pageIndex);

    // Render at 300 DPI for print fidelity
    // 300 DPI is approx 4.166 scale factor relative to 72 DPI PDF points
    const scale = 4.166;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");

    if (!ctx) throw new Error("Could not initialize 2D rendering canvas context.");

    // PDF.js v6 syntax: pass canvas instance
    const renderContext = {
      canvas,
      viewport,
    };
    await page.render(renderContext).promise;

    const dataUrl = canvas.toDataURL("image/png");

    const object: CardObject = {
      id: `pdf-layer-${Date.now()}`,
      name: `PDF Page ${pageIndex} (${file.name})`,
      type: "image",
      targetSide,
      x: 0,
      y: 0,
      width: cardWidthMm,
      height: cardHeightMm,
      rotation: 0,
      opacity: 1,
      zIndex: 1,
      visible: true,
      locked: false,
      aspectRatioLocked: false,
      flipX: false,
      flipY: false,
      src: dataUrl,
      originalSrc: dataUrl,
      naturalWidth: canvas.width,
      naturalHeight: canvas.height,
    };

    return {
      success: true,
      format: "pdf",
      objects: [object],
      isFlattened: true,
      message: `Imported PDF page ${pageIndex} at 300 DPI print quality. (Note: Imported as high-resolution rasterized vector page).`,
      detectedDimensionsMm: { width: cardWidthMm, height: cardHeightMm },
    };
  } catch (err) {
    return {
      success: false,
      format: "pdf",
      objects: [],
      message: `Failed to import PDF page: ${(err as Error).message}`,
    };
  }
}

/**
 * Handle Transparent PNG / Signature Upload with explicit alpha preservation
 */
export async function importSignaturePng(
  file: File,
  targetSide: CardSide = "front"
): Promise<ImportResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        // Calculate aspect ratio for signature box (default 35mm width)
        const aspect = img.width / img.height;
        const width = 35;
        const height = Math.round((width / aspect) * 10) / 10;

        const sigObject: CardObject = {
          id: `sig-${Date.now()}`,
          name: "Signature (Transparent PNG)",
          type: "signature",
          targetSide,
          x: 10,
          y: 65,
          width,
          height: Math.max(8, height),
          rotation: 0,
          opacity: 1,
          zIndex: 10,
          visible: true,
          locked: false,
          aspectRatioLocked: true,
          flipX: false,
          flipY: false,
          src: dataUrl,
          originalSrc: dataUrl,
          naturalWidth: img.width,
          naturalHeight: img.height,
          isSignature: true,
          preserveAlpha: true,
        };

        resolve({
          success: true,
          format: "image",
          objects: [sigObject],
          message: "Signature imported successfully with transparent alpha channel preserved.",
        });
      };
      img.onerror = () => {
        resolve({
          success: false,
          format: "image",
          objects: [],
          message: "Could not decode image file.",
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
