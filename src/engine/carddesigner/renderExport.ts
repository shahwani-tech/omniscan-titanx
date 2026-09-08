/**
 * High-Resolution Print & Export Rendering Pipeline for ID & Service Card Designer
 * 
 * Generates ISO 300 DPI print-ready outputs:
 * - Front Card only
 * - Back Card only
 * - Combined Physical A6 Sheet (Front on top, Back underneath) with cutting guides
 * - PDF Document generation via pdf-lib
 * - Direct integration with centralized Native Print Dialog
 */

import { PDFDocument } from "pdf-lib";
import { CardDesignerProject, CardObject, CardSide } from "./types";
import { getTrueCardBoundsInZone } from "./cardGeometry";
import { PrintJobPayload } from "../../types/print";

const MM_TO_INCH = 1 / 25.4;

export interface RenderCardOptions {
  dpi?: number; // Default 300
  showCuttingGuides?: boolean;
  showBleed?: boolean;
  transparentBackground?: boolean;
}

/**
 * Preloads an image into an HTMLImageElement
 */
function preloadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

/**
 * Render a single CardObject onto a 2D canvas context
 */
async function renderObjectOnCanvas(
  ctx: CanvasRenderingContext2D,
  obj: CardObject,
  scale: number // mm to pixels conversion factor
) {
  if (!obj.visible || obj.opacity <= 0) return;

  ctx.save();

  // Position and origin
  const posX = obj.x * scale;
  const posY = obj.y * scale;
  const width = obj.width * scale;
  const height = obj.height * scale;

  ctx.translate(posX + width / 2, posY + height / 2);

  if (obj.rotation) {
    ctx.rotate((obj.rotation * Math.PI) / 180);
  }

  // Mirror / Flip
  const scaleX = obj.flipX ? -1 : 1;
  const scaleY = obj.flipY ? -1 : 1;
  if (scaleX !== 1 || scaleY !== 1) {
    ctx.scale(scaleX, scaleY);
  }

  ctx.globalAlpha = Math.max(0, Math.min(1, obj.opacity));

  if (obj.blendMode && obj.blendMode !== "normal") {
    ctx.globalCompositeOperation = obj.blendMode as GlobalCompositeOperation;
  }

  if (obj.shadow) {
    ctx.shadowColor = obj.shadow.color;
    ctx.shadowBlur = obj.shadow.blur * scale;
    ctx.shadowOffsetX = obj.shadow.offsetX * scale;
    ctx.shadowOffsetY = obj.shadow.offsetY * scale;
  }

  // Draw with centered origin (-width/2, -height/2)
  const drawX = -width / 2;
  const drawY = -height / 2;

  switch (obj.type) {
    case "shape": {
      ctx.fillStyle = obj.fillColor || "transparent";
      ctx.strokeStyle = obj.strokeColor || "transparent";
      ctx.lineWidth = (obj.strokeWidth || 0) * scale;

      const hasFill = obj.fillColor && obj.fillColor !== "transparent";
      const hasStroke = obj.strokeColor && obj.strokeColor !== "transparent" && (obj.strokeWidth || 0) > 0;

      if (obj.shapeType === "rect") {
        if (hasFill) ctx.fillRect(drawX, drawY, width, height);
        if (hasStroke) ctx.strokeRect(drawX, drawY, width, height);
      } else if (obj.shapeType === "rounded-rect") {
        const radius = Math.min((obj.cornerRadius || 2) * scale, width / 2, height / 2);
        ctx.beginPath();
        ctx.roundRect(drawX, drawY, width, height, radius);
        if (hasFill) ctx.fill();
        if (hasStroke) ctx.stroke();
      } else if (obj.shapeType === "circle" || obj.shapeType === "ellipse") {
        ctx.beginPath();
        ctx.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
        if (hasFill) ctx.fill();
        if (hasStroke) ctx.stroke();
      } else if (obj.shapeType === "line") {
        ctx.beginPath();
        ctx.moveTo(drawX, 0);
        ctx.lineTo(drawX + width, 0);
        ctx.stroke();
      } else if (obj.shapeType === "star") {
        const points = 5;
        const outerRadius = Math.min(width, height) / 2;
        const innerRadius = outerRadius * 0.45;
        ctx.beginPath();
        for (let i = 0; i < points * 2; i++) {
          const r = i % 2 === 0 ? outerRadius : innerRadius;
          const angle = (i * Math.PI) / points - Math.PI / 2;
          const px = Math.cos(angle) * r;
          const py = Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        if (hasFill) ctx.fill();
        if (hasStroke) ctx.stroke();
      }
      break;
    }

    case "text": {
      if (obj.text) {
        // Text background if configured
        if (obj.textBackgroundColor && obj.textBackgroundColor !== "transparent") {
          ctx.fillStyle = obj.textBackgroundColor;
          ctx.fillRect(drawX, drawY, width, height);
        }

        ctx.fillStyle = obj.textColor || "#000000";
        // Convert font size mm to pixels
        const fontSizePx = (obj.fontSize || 10) * (scale / 3.78);
        const weight = obj.fontWeight || "normal";
        const style = obj.fontStyle === "italic" ? "italic" : "normal";
        const family = obj.fontFamily || "Plus Jakarta Sans, sans-serif";
        ctx.font = `${style} ${weight} ${fontSizePx}px "${family}"`;

        const align = obj.textAlign || "left";
        ctx.textAlign = align === "justify" ? "left" : align;
        ctx.textBaseline = "middle";

        let textX = drawX;
        if (align === "center") textX = 0;
        else if (align === "right") textX = drawX + width;

        const lines = obj.text.split("\n");
        const lineHeight = fontSizePx * (obj.lineHeight || 1.3);
        const startY = drawY + height / 2 - ((lines.length - 1) * lineHeight) / 2;

        lines.forEach((line, i) => {
          ctx.fillText(line, textX, startY + i * lineHeight);
          if (obj.textDecoration === "underline") {
            const metrics = ctx.measureText(line);
            ctx.fillRect(textX - (align === "center" ? metrics.width / 2 : 0), startY + i * lineHeight + fontSizePx * 0.4, metrics.width, Math.max(1, scale * 0.2));
          }
        });
      }
      break;
    }

    case "image":
    case "signature":
    case "barcode":
    case "qrcode": {
      if (obj.src) {
        try {
          const img = await preloadImage(obj.src);
          // Handle crop or image mask shapes
          if (
            obj.maskShape === "circle" ||
            obj.maskShape === "oval" ||
            (obj.cropRect && obj.cropRect.shape === "circle")
          ) {
            ctx.beginPath();
            ctx.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
            ctx.clip();
          } else if (
            obj.maskShape === "rounded" ||
            (obj.cropRect && obj.cropRect.shape === "rounded")
          ) {
            const rVal = obj.maskCornerRadius || obj.cropRect?.cornerRadius || 3;
            const radius = Math.min(rVal * scale, width / 2, height / 2);
            ctx.beginPath();
            ctx.roundRect(drawX, drawY, width, height, radius);
            ctx.clip();
          }

          // Image color filters
          if (obj.imageFilters) {
            const filters = [];
            if (obj.imageFilters.brightness !== 0) filters.push(`brightness(${100 + obj.imageFilters.brightness}%)`);
            if (obj.imageFilters.contrast !== 0) filters.push(`contrast(${100 + obj.imageFilters.contrast}%)`);
            if (obj.imageFilters.saturation !== 0) filters.push(`saturate(${100 + obj.imageFilters.saturation}%)`);
            if (obj.imageFilters.grayscale) filters.push("grayscale(100%)");
            if (filters.length > 0) {
              ctx.filter = filters.join(" ");
            }
          }

          ctx.drawImage(img, drawX, drawY, width, height);
          ctx.filter = "none";
        } catch (err) {
          console.warn("Could not draw object image:", obj.id, err);
        }
      }
      break;
    }
  }

  ctx.restore();
}

/**
 * Render a single card side (Front or Back) to an offscreen canvas
 */
export async function renderCardSideToCanvas(
  project: CardDesignerProject,
  side: CardSide,
  options: RenderCardOptions = {}
): Promise<HTMLCanvasElement> {
  const dpi = options.dpi || 300;
  const scale = (dpi * MM_TO_INCH); // pixels per mm

  const widthPx = Math.round(project.cardWidthMm * scale);
  const heightPx = Math.round(project.cardHeightMm * scale);

  const canvas = document.createElement("canvas");
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not initialize 2D context");

  const sideState = side === "front" ? project.front : project.back;

  // Background
  if (!options.transparentBackground) {
    if (sideState.background.type === "solid") {
      ctx.fillStyle = sideState.background.color1 || "#ffffff";
      ctx.fillRect(0, 0, widthPx, heightPx);
    } else if (sideState.background.type === "gradient" && sideState.background.color2) {
      const grad = ctx.createLinearGradient(0, 0, 0, heightPx);
      grad.addColorStop(0, sideState.background.color1);
      grad.addColorStop(1, sideState.background.color2);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, widthPx, heightPx);
    } else if (sideState.background.type === "image" && sideState.background.imageUrl) {
      try {
        const bgImg = await preloadImage(sideState.background.imageUrl);
        ctx.globalAlpha = sideState.background.imageOpacity ?? 1;
        ctx.drawImage(bgImg, 0, 0, widthPx, heightPx);
        ctx.globalAlpha = 1;
      } catch {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, widthPx, heightPx);
      }
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, widthPx, heightPx);
    }
  }

  // Sort objects by z-index
  const sortedObjects = [...sideState.objects].sort((a, b) => a.zIndex - b.zIndex);

  for (const obj of sortedObjects) {
    await renderObjectOnCanvas(ctx, obj, scale);
  }

  return canvas;
}

/**
 * Render the entire physical A6 sheet showing FRONT on top and BACK underneath
 */
export async function renderA6SheetToCanvas(
  project: CardDesignerProject,
  options: RenderCardOptions = {}
): Promise<HTMLCanvasElement> {
  const dpi = options.dpi || 300;
  const scale = dpi * MM_TO_INCH;

  const sheetWidthPx = Math.round(project.pageWidthMm * scale);
  const sheetHeightPx = Math.round(project.pageHeightMm * scale);

  const canvas = document.createElement("canvas");
  canvas.width = sheetWidthPx;
  canvas.height = sheetHeightPx;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not initialize 2D context");

  // Sheet background: pure print white
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, sheetWidthPx, sheetHeightPx);

  // Render Front Card
  const frontCanvas = await renderCardSideToCanvas(project, "front", options);
  const frontX = Math.round(project.frontPosMm.x * scale);
  const frontY = Math.round(project.frontPosMm.y * scale);
  ctx.drawImage(frontCanvas, frontX, frontY);

  // Render Back Card
  const backCanvas = await renderCardSideToCanvas(project, "back", options);
  const backX = Math.round(project.backPosMm.x * scale);
  const backY = Math.round(project.backPosMm.y * scale);
  ctx.drawImage(backCanvas, backX, backY);

  // Draw Cutting Guides / Crop Marks if enabled
  if (options.showCuttingGuides ?? project.cuttingGuides) {
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = Math.max(1, Math.round(0.15 * scale)); // 0.15 mm hairline
    const markLength = Math.round(4 * scale); // 4 mm line length

    // Guides for Front Card (Sheet zone)
    drawCornerCropMarks(ctx, frontX, frontY, frontCanvas.width, frontCanvas.height, markLength);

    // Guides for Back Card (Sheet zone)
    drawCornerCropMarks(ctx, backX, backY, backCanvas.width, backCanvas.height, markLength);

    // True Card Cut-Line Marks (Exact ID-1 CR-80 or preset card boundaries)
    if (project.showCardBoundary) {
      const cardBounds = getTrueCardBoundsInZone(project);

      ctx.strokeStyle = "#0ea5e9"; // Distinct sky blue for true card boundary cut marks
      drawCornerCropMarks(
        ctx,
        Math.round(frontX + cardBounds.x * scale),
        Math.round(frontY + cardBounds.y * scale),
        Math.round(cardBounds.width * scale),
        Math.round(cardBounds.height * scale),
        markLength
      );

      drawCornerCropMarks(
        ctx,
        Math.round(backX + cardBounds.x * scale),
        Math.round(backY + cardBounds.y * scale),
        Math.round(cardBounds.width * scale),
        Math.round(cardBounds.height * scale),
        markLength
      );
    }

    // Center fold / separation dashed line
    ctx.save();
    ctx.setLineDash([4 * scale, 4 * scale]);
    ctx.strokeStyle = "#cbd5e1";
    if (project.orientation === "portrait") {
      const midY = (frontY + frontCanvas.height + backY) / 2;
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(sheetWidthPx, midY);
      ctx.stroke();
    } else {
      const midX = (frontX + frontCanvas.width + backX) / 2;
      ctx.beginPath();
      ctx.moveTo(midX, 0);
      ctx.lineTo(midX, sheetHeightPx);
      ctx.stroke();
    }
    ctx.restore();
  }

  return canvas;
}

function drawCornerCropMarks(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  len: number
) {
  ctx.beginPath();
  // Top-left
  ctx.moveTo(x - len, y);
  ctx.lineTo(x, y);
  ctx.moveTo(x, y - len);
  ctx.lineTo(x, y);

  // Top-right
  ctx.moveTo(x + w, y);
  ctx.lineTo(x + w + len, y);
  ctx.moveTo(x + w, y - len);
  ctx.lineTo(x + w, y);

  // Bottom-left
  ctx.moveTo(x - len, y + h);
  ctx.lineTo(x, y + h);
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + h + len);

  // Bottom-right
  ctx.moveTo(x + w, y + h);
  ctx.lineTo(x + w + len, y + h);
  ctx.moveTo(x + w, y + h);
  ctx.lineTo(x + w, y + h + len);

  ctx.stroke();
}

/**
 * Generate a Print-Ready PDF document using pdf-lib
 */
export async function exportProjectToPdf(
  project: CardDesignerProject,
  mode: "full-a6" | "front-only" | "back-only" | "two-pages" = "full-a6"
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  if (mode === "full-a6") {
    // Exact A6 dimensions in PDF points (1 mm = 2.83465 pt)
    const pageW = project.pageWidthMm * 2.83465;
    const pageH = project.pageHeightMm * 2.83465;

    const page = pdfDoc.addPage([pageW, pageH]);
    const canvas = await renderA6SheetToCanvas(project, { dpi: 300 });
    const imgBytes = await fetch(canvas.toDataURL("image/png")).then((res) => res.arrayBuffer());
    const embeddedImg = await pdfDoc.embedPng(imgBytes);

    page.drawImage(embeddedImg, {
      x: 0,
      y: 0,
      width: pageW,
      height: pageH,
    });
  } else if (mode === "two-pages") {
    // Page 1: Front, Page 2: Back (each on individual A6 sheet)
    const pageW = project.pageWidthMm * 2.83465;
    const pageH = project.pageHeightMm * 2.83465;

    // Page 1
    const p1 = pdfDoc.addPage([pageW, pageH]);
    const fCanvas = await renderCardSideToCanvas(project, "front", { dpi: 300 });
    const fBytes = await fetch(fCanvas.toDataURL("image/png")).then((res) => res.arrayBuffer());
    const fImg = await pdfDoc.embedPng(fBytes);
    // Center on page
    const cardW = project.cardWidthMm * 2.83465;
    const cardH = project.cardHeightMm * 2.83465;
    p1.drawImage(fImg, {
      x: (pageW - cardW) / 2,
      y: (pageH - cardH) / 2,
      width: cardW,
      height: cardH,
    });

    // Page 2
    const p2 = pdfDoc.addPage([pageW, pageH]);
    const bCanvas = await renderCardSideToCanvas(project, "back", { dpi: 300 });
    const bBytes = await fetch(bCanvas.toDataURL("image/png")).then((res) => res.arrayBuffer());
    const bImg = await pdfDoc.embedPng(bBytes);
    p2.drawImage(bImg, {
      x: (pageW - cardW) / 2,
      y: (pageH - cardH) / 2,
      width: cardW,
      height: cardH,
    });
  } else {
    // Single side export
    const cardW = project.cardWidthMm * 2.83465;
    const cardH = project.cardHeightMm * 2.83465;
    const page = pdfDoc.addPage([cardW, cardH]);
    const side = mode === "front-only" ? "front" : "back";
    const canvas = await renderCardSideToCanvas(project, side, { dpi: 300 });
    const imgBytes = await fetch(canvas.toDataURL("image/png")).then((res) => res.arrayBuffer());
    const embeddedImg = await pdfDoc.embedPng(imgBytes);

    page.drawImage(embeddedImg, {
      x: 0,
      y: 0,
      width: cardW,
      height: cardH,
    });
  }

  return await pdfDoc.save();
}

/**
 * Build PrintJobPayload for centralized Native Print Dialog
 */
export async function buildPrintJobPayload(
  project: CardDesignerProject
): Promise<PrintJobPayload> {
  const sheetCanvas = await renderA6SheetToCanvas(project, { dpi: 300 });
  const dataUrl = sheetCanvas.toDataURL("image/png");

  return {
    type: "a6-card",
    title: `${project.name} - A6 Dual-Card Print Job`,
    pages: [
      {
        pageIndex: 0,
        dataUrl,
        widthMm: project.pageWidthMm,
        heightMm: project.pageHeightMm,
        label: "A6 Physical Sheet (Front Top, Back Underneath)",
      },
    ],
  };
}
