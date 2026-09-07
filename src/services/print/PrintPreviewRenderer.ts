/**
 * OMNISCAN TITAN X - Print Preview & Output Renderer
 * High-precision canvas pipeline preserving physical millimeters, aspect ratios,
 * margins, offsets, grayscale conversion, and cutting guides.
 */

import { PrintJobPayload, PrintSettings, PrintPageItem, PaperSizeOption } from "../../types/print";
import { STANDARD_PAPER_SIZES } from "./constants";

export interface RenderedPreviewPage {
  pageIndex: number;
  canvas: HTMLCanvasElement;
  dataUrl: string;
  widthMm: number;
  heightMm: number;
  label?: string;
}

export class PrintPreviewRenderer {
  private static instance: PrintPreviewRenderer;
  private previewCache = new Map<string, RenderedPreviewPage[]>();

  private constructor() {}

  public static getInstance(): PrintPreviewRenderer {
    if (!PrintPreviewRenderer.instance) {
      PrintPreviewRenderer.instance = new PrintPreviewRenderer();
    }
    return PrintPreviewRenderer.instance;
  }

  /**
   * Determine paper size in millimeters
   */
  public getPaperDimensions(paperSizeId: string, orientation: "portrait" | "landscape"): { widthMm: number; heightMm: number } {
    const found = STANDARD_PAPER_SIZES.find((p) => p.id === paperSizeId) || STANDARD_PAPER_SIZES[0];
    const isPortrait = orientation === "portrait";
    const w = isPortrait ? Math.min(found.widthMm, found.heightMm) : Math.max(found.widthMm, found.heightMm);
    const h = isPortrait ? Math.max(found.widthMm, found.heightMm) : Math.min(found.widthMm, found.heightMm);
    return { widthMm: w, heightMm: h };
  }

  /**
   * Filter pages according to page range settings
   */
  public filterPagesByRange<T>(items: T[], settings: PrintSettings, activePageIndex: number = 0): { items: T[]; indices: number[] } {
    const total = items.length;
    if (total === 0) return { items: [], indices: [] };

    const selectedIndices: number[] = [];

    switch (settings.pageRangeMode) {
      case "current":
        selectedIndices.push(Math.min(Math.max(0, activePageIndex), total - 1));
        break;

      case "odd":
        for (let i = 0; i < total; i++) {
          if (i % 2 === 0) selectedIndices.push(i); // 1-based odd is 0, 2, 4
        }
        break;

      case "even":
        for (let i = 0; i < total; i++) {
          if (i % 2 === 1) selectedIndices.push(i); // 1-based even is 1, 3, 5
        }
        break;

      case "custom":
        if (settings.customPageRange.trim()) {
          const parts = settings.customPageRange.split(",");
          for (const part of parts) {
            const trimmed = part.trim();
            if (trimmed.includes("-")) {
              const [startStr, endStr] = trimmed.split("-");
              const start = parseInt(startStr, 10);
              const end = parseInt(endStr, 10);
              if (!isNaN(start) && !isNaN(end)) {
                for (let p = Math.max(1, start); p <= Math.min(total, end); p++) {
                  if (!selectedIndices.includes(p - 1)) selectedIndices.push(p - 1);
                }
              }
            } else {
              const p = parseInt(trimmed, 10);
              if (!isNaN(p) && p >= 1 && p <= total && !selectedIndices.includes(p - 1)) {
                selectedIndices.push(p - 1);
              }
            }
          }
        } else {
          // Fallback to all if range empty
          for (let i = 0; i < total; i++) selectedIndices.push(i);
        }
        break;

      case "all":
      default:
        for (let i = 0; i < total; i++) selectedIndices.push(i);
        break;
    }

    // Sort indices ascending
    selectedIndices.sort((a, b) => a - b);
    return {
      items: selectedIndices.map((idx) => items[idx]),
      indices: selectedIndices,
    };
  }

  /**
   * Extract raw page images/canvases from any PrintJobPayload
   */
  public async extractSourcePages(payload: PrintJobPayload): Promise<Array<{ dataUrl: string; label?: string }>> {
    const results: Array<{ dataUrl: string; label?: string }> = [];

    // 1. Direct canvases (from Photo Studio, ID Card Studio, A6 Studio)
    if (payload.canvases && payload.canvases.length > 0) {
      for (let i = 0; i < payload.canvases.length; i++) {
        const c = payload.canvases[i];
        results.push({
          dataUrl: c.toDataURL("image/png"),
          label: `Page ${i + 1}`,
        });
      }
      return results;
    }

    // 2. Direct pages
    if (payload.pages && payload.pages.length > 0) {
      return payload.pages.map((p, idx) => ({
        dataUrl: p.dataUrl,
        label: p.label || `Page ${idx + 1}`,
      }));
    }

    // 3. Document pages (from Main PDF / Document Tool)
    if (payload.document && payload.document.pages.length > 0) {
      for (let i = 0; i < payload.document.pages.length; i++) {
        const p = payload.document.pages[i];
        const srcUrl = p.processedDataUrl || p.originalDataUrl;
        if (srcUrl) {
          results.push({
            dataUrl: srcUrl,
            label: `Page ${i + 1} (${p.pageNumber})`,
          });
        }
      }
      return results;
    }

    // 4. Raw images array
    if (payload.images && payload.images.length > 0) {
      for (let i = 0; i < payload.images.length; i++) {
        results.push({
          dataUrl: payload.images[i].url,
          label: `Image ${i + 1}`,
        });
      }
      return results;
    }

    // 5. Tool-specific Studio Payloads (A6, ID Card, Photo Sheet)
    if (payload.type === "a6-card" && payload.a6Config) {
      const { calculateA6Layout, renderA6SheetCanvas } = await import("../../engine/a6HalfCardLayout");
      const layout = calculateA6Layout(payload.a6Config);
      const totalPages = Math.max(1, layout.pages.length);
      for (let pIdx = 0; pIdx < totalPages; pIdx++) {
        const c = await renderA6SheetCanvas(payload.a6Config, payload.a6Images || {}, pIdx, {
          dpi: 200,
          showGuidesOverlay: payload.hasCuttingGuides ?? true,
        });
        results.push({
          dataUrl: c.toDataURL("image/png"),
          label: totalPages > 1 ? `A6 Sheet Page ${pIdx + 1}` : "A6 Half-Card Sheet",
        });
      }
      return results;
    }

    if ((payload.type === "id-card" || payload.type === "idcard-sheet") && payload.idCardConfig) {
      const { renderIdCardSheetCanvas } = await import("../../engine/idCardLayout");
      const isMultiPage = payload.idCardConfig.layoutMode === "duplex-two-page";
      const totalPages = isMultiPage ? 2 : 1;
      for (let pIdx = 0; pIdx < totalPages; pIdx++) {
        const c = await renderIdCardSheetCanvas(
          payload.idCardConfig,
          payload.idCardImages?.front || "",
          payload.idCardImages?.back || "",
          {
            targetDpi: 200,
            pageIndex: pIdx,
          }
        );
        results.push({
          dataUrl: c.toDataURL("image/png"),
          label: isMultiPage ? (pIdx === 0 ? "Front Side (Page 1)" : "Back Side (Page 2)") : "ID Card / CNIC Sheet",
        });
      }
      return results;
    }

    if (payload.type === "photo-sheet" && payload.photoSheetConfig) {
      const { renderPhotoSheetCanvas } = await import("../../engine/photoLayout");
      const c = await renderPhotoSheetCanvas(
        payload.photoSheetConfig,
        payload.photoSheetImages || {},
        {
          targetDpi: 200,
          showGuidesOverlay: payload.hasCuttingGuides ?? true,
        }
      );
      results.push({
        dataUrl: c.toDataURL("image/png"),
        label: `Photo Sheet (${payload.photoSheetConfig.paperSizeId.toUpperCase()})`,
      });
      return results;
    }

    return results;
  }

  /**
   * Render complete preview pages according to settings, DPI, and geometry
   */
  public async renderPreviewPages(
    payload: PrintJobPayload,
    settings: PrintSettings,
    targetDpi: number = 150
  ): Promise<RenderedPreviewPage[]> {
    const rawPages = await this.extractSourcePages(payload);
    if (rawPages.length === 0) return [];

    // Filter pages by range
    const { items: filteredPages, indices } = this.filterPagesByRange(
      rawPages,
      settings,
      payload.activePageIndex || 0
    );

    const { widthMm: sheetW_mm, heightMm: sheetH_mm } = this.getPaperDimensions(
      settings.paperSizeId,
      settings.orientation
    );

    // Pixels per mm = (DPI / 25.4)
    const pxPerMm = targetDpi / 25.4;
    const canvasW = Math.round(sheetW_mm * pxPerMm);
    const canvasH = Math.round(sheetH_mm * pxPerMm);

    // Margins in mm
    let mTop = 0;
    let mRight = 0;
    let mBottom = 0;
    let mLeft = 0;

    if (!settings.borderless) {
      if (settings.marginType === "normal") {
        mTop = mRight = mBottom = mLeft = 5;
      } else if (settings.marginType === "narrow") {
        mTop = mRight = mBottom = mLeft = 3;
      } else if (settings.marginType === "custom") {
        mTop = settings.customMarginsMm.top;
        mRight = settings.customMarginsMm.right;
        mBottom = settings.customMarginsMm.bottom;
        mLeft = settings.customMarginsMm.left;
      }
    }

    const printableW_mm = Math.max(10, sheetW_mm - (mLeft + mRight));
    const printableH_mm = Math.max(10, sheetH_mm - (mTop + mBottom));

    const renderedPages: RenderedPreviewPage[] = [];

    for (let i = 0; i < filteredPages.length; i++) {
      const page = filteredPages[i];
      const origIndex = indices[i];

      const canvas = document.createElement("canvas");
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) continue;

      // Fill white background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvasW, canvasH);

      // Load image
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const imgAspect = img.width / img.height;
          const printableAspect = printableW_mm / printableH_mm;

          let targetW_mm = printableW_mm;
          let targetH_mm = printableH_mm;

          // Scaling logic
          if (settings.scaling === "actual") {
            // 1:1 physical size assuming 300 DPI original unless specified
            const origW_mm = (img.width / 300) * 25.4;
            const origH_mm = (img.height / 300) * 25.4;
            targetW_mm = origW_mm;
            targetH_mm = origH_mm;
          } else if (settings.scaling === "fill") {
            // Fill printable area, crop overflow
            if (imgAspect > printableAspect) {
              targetH_mm = printableH_mm;
              targetW_mm = targetH_mm * imgAspect;
            } else {
              targetW_mm = printableW_mm;
              targetH_mm = targetW_mm / imgAspect;
            }
          } else if (settings.scaling === "custom") {
            const scale = (settings.customScalePercent || 100) / 100;
            if (imgAspect > printableAspect) {
              targetW_mm = printableW_mm * scale;
              targetH_mm = (printableW_mm / imgAspect) * scale;
            } else {
              targetH_mm = printableH_mm * scale;
              targetW_mm = printableH_mm * imgAspect * scale;
            }
          } else {
            // Default "fit" to printable area
            if (imgAspect > printableAspect) {
              targetW_mm = printableW_mm;
              targetH_mm = printableW_mm / imgAspect;
            } else {
              targetH_mm = printableH_mm;
              targetW_mm = printableH_mm * imgAspect;
            }
          }

          // Offsets in mm
          let posX_mm = mLeft;
          let posY_mm = mTop;

          if (settings.centerHorizontally) {
            posX_mm = mLeft + (printableW_mm - targetW_mm) / 2;
          }
          if (settings.centerVertically) {
            posY_mm = mTop + (printableH_mm - targetH_mm) / 2;
          }

          const drawX = Math.round(posX_mm * pxPerMm);
          const drawY = Math.round(posY_mm * pxPerMm);
          const drawW = Math.round(targetW_mm * pxPerMm);
          const drawH = Math.round(targetH_mm * pxPerMm);

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = settings.imageInterpolation === "smooth" ? "medium" : "high";

          ctx.drawImage(img, drawX, drawY, drawW, drawH);

          // Grayscale simulation if colorMode === "grayscale"
          if (settings.colorMode === "grayscale") {
            const imgData = ctx.getImageData(0, 0, canvasW, canvasH);
            const d = imgData.data;
            for (let p = 0; p < d.length; p += 4) {
              // Standard ITU-R BT.601 luminance: 0.299 R + 0.587 G + 0.114 B
              const gray = 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2];
              d[p] = gray;
              d[p + 1] = gray;
              d[p + 2] = gray;
            }
            ctx.putImageData(imgData, 0, 0);
          }

          // Cutting Guides & Crop Marks
          if (settings.cuttingGuides || settings.cropMarks) {
            this.drawCuttingGuides(ctx, drawX, drawY, drawW, drawH, pxPerMm);
          }

          resolve();
        };

        img.onerror = () => {
          // Draw error page box
          ctx.fillStyle = "#fef2f2";
          ctx.fillRect(0, 0, canvasW, canvasH);
          ctx.strokeStyle = "#ef4444";
          ctx.lineWidth = 2;
          ctx.strokeRect(10, 10, canvasW - 20, canvasH - 20);
          ctx.fillStyle = "#991b1b";
          ctx.font = "16px sans-serif";
          ctx.fillText("Failed to load page image", 20, 40);
          resolve();
        };

        img.src = page.dataUrl;
      });

      renderedPages.push({
        pageIndex: origIndex,
        canvas,
        dataUrl: canvas.toDataURL("image/jpeg", 0.92),
        widthMm: sheetW_mm,
        heightMm: sheetH_mm,
        label: page.label,
      });
    }

    return renderedPages;
  }

  /**
   * Draw high-contrast physical cutting guides and corner crop marks
   */
  private drawCuttingGuides(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    pxPerMm: number
  ) {
    const markLength = Math.round(5 * pxPerMm); // 5 mm mark
    const offset = Math.round(1.5 * pxPerMm); // 1.5 mm offset from edge

    ctx.save();
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;

    // Top-Left Corner
    ctx.beginPath();
    ctx.moveTo(x - offset - markLength, y);
    ctx.lineTo(x - offset, y);
    ctx.moveTo(x, y - offset - markLength);
    ctx.lineTo(x, y - offset);
    ctx.stroke();

    // Top-Right Corner
    ctx.beginPath();
    ctx.moveTo(x + w + offset, y);
    ctx.lineTo(x + w + offset + markLength, y);
    ctx.moveTo(x + w, y - offset - markLength);
    ctx.lineTo(x + w, y - offset);
    ctx.stroke();

    // Bottom-Left Corner
    ctx.beginPath();
    ctx.moveTo(x - offset - markLength, y + h);
    ctx.lineTo(x - offset, y + h);
    ctx.moveTo(x, y + h + offset);
    ctx.lineTo(x, y + h + offset + markLength);
    ctx.stroke();

    // Bottom-Right Corner
    ctx.beginPath();
    ctx.moveTo(x + w + offset, y + h);
    ctx.lineTo(x + w + offset + markLength, y + h);
    ctx.moveTo(x + w, y + h + offset);
    ctx.lineTo(x + w, y + h + offset + markLength);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Render high-resolution 300 DPI pages for the final print job submission
   */
  public async renderFinalPrintPages(
    payload: PrintJobPayload,
    settings: PrintSettings
  ): Promise<PrintPageItem[]> {
    const previewPages = await this.renderPreviewPages(payload, settings, 300);
    return previewPages.map((p) => ({
      pageIndex: p.pageIndex,
      dataUrl: p.dataUrl,
      widthMm: p.widthMm,
      heightMm: p.heightMm,
      label: p.label,
    }));
  }
}

export const printPreviewRenderer = PrintPreviewRenderer.getInstance();
