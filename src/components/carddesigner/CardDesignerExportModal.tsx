/**
 * CardDesignerExportModal.tsx
 * 
 * High-Resolution Export Modal for ID & Service Card Designer:
 * - Full Physical A6 Sheet (Front on top, Back underneath)
 * - Front Card Only / Back Card Only
 * - Print-Ready ISO PDF (300 DPI)
 * - Lossless PNG (with optional transparency) & High-Resolution JPEG
 */

import React, { useState, useEffect, useRef } from "react";
import { CardDesignerProject } from "../../engine/carddesigner/types";
import {
  renderA6SheetToCanvas,
  renderCardSideToCanvas,
  exportProjectToPdf,
} from "../../engine/carddesigner/renderExport";
import {
  Download,
  FileText,
  Image as ImageIcon,
  Check,
  X,
  Printer,
  Sparkles,
  Layers,
} from "lucide-react";

interface CardDesignerExportModalProps {
  project: CardDesignerProject;
  onClose: () => void;
}

export const CardDesignerExportModal: React.FC<CardDesignerExportModalProps> = ({
  project,
  onClose,
}) => {
  const [exportScope, setExportScope] = useState<"full-a6" | "front-only" | "back-only" | "two-pages">("full-a6");
  const [format, setFormat] = useState<"pdf" | "png" | "jpeg">("pdf");
  const [dpi, setDpi] = useState<number>(300);
  const [includeCuttingGuides, setIncludeCuttingGuides] = useState<boolean>(project.cuttingGuides);
  const [previewDataUrl, setPreviewDataUrl] = useState<string>("");
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Update preview image when scope or cutting guides change
  useEffect(() => {
    let active = true;

    async function generatePreview() {
      try {
        let canvas: HTMLCanvasElement;
        if (exportScope === "full-a6" || exportScope === "two-pages") {
          canvas = await renderA6SheetToCanvas(project, {
            dpi: 150, // fast preview DPI
            showCuttingGuides: includeCuttingGuides,
          });
        } else {
          canvas = await renderCardSideToCanvas(
            project,
            exportScope === "front-only" ? "front" : "back",
            { dpi: 150 }
          );
        }
        if (active) {
          setPreviewDataUrl(canvas.toDataURL("image/png"));
        }
      } catch (err) {
        console.error("Preview generation failed:", err);
      }
    }

    generatePreview();
    return () => {
      active = false;
    };
  }, [project, exportScope, includeCuttingGuides]);

  const handleDownload = async () => {
    setIsExporting(true);
    try {
      const cleanName = project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

      if (format === "pdf") {
        const pdfBytes = await exportProjectToPdf(project, exportScope);
        const blob = new Blob([pdfBytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${cleanName}-${exportScope}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        let canvas: HTMLCanvasElement;
        if (exportScope === "full-a6" || exportScope === "two-pages") {
          canvas = await renderA6SheetToCanvas(project, {
            dpi,
            showCuttingGuides: includeCuttingGuides,
          });
        } else {
          canvas = await renderCardSideToCanvas(
            project,
            exportScope === "front-only" ? "front" : "back",
            { dpi }
          );
        }

        const mime = format === "png" ? "image/png" : "image/jpeg";
        const dataUrl = canvas.toDataURL(mime, 0.98);
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `${cleanName}-${exportScope}.${format}`;
        a.click();
      }

      setTimeout(() => onClose(), 600);
    } catch (err) {
      alert(`Export error: ${(err as Error).message}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-6 select-none">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col text-neutral-200">
        {/* Header */}
        <div className="h-12 border-b border-neutral-800 px-4 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center space-x-2">
            <Download className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white">
              Export Card Design (Print-Ready)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-2 gap-6">
          {/* Left: Configuration */}
          <div className="space-y-4 text-xs">
            {/* Scope */}
            <div>
              <label className="text-neutral-400 font-medium block mb-1.5">
                Export Scope
              </label>
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => setExportScope("full-a6")}
                  className={`w-full p-2 rounded-xl text-left border transition-all flex items-center justify-between ${
                    exportScope === "full-a6"
                      ? "bg-sky-950/80 border-sky-500 text-white font-semibold"
                      : "bg-neutral-950 border-neutral-800 text-neutral-300 hover:bg-neutral-800"
                  }`}
                >
                  <div>
                    <span className="block">Full A6 Sheet (Dual-Card)</span>
                    <span className="text-[10px] text-neutral-400">
                      Front on top, Back underneath on one physical A6 page
                    </span>
                  </div>
                  {exportScope === "full-a6" && <Check className="w-4 h-4 text-sky-400" />}
                </button>

                <button
                  type="button"
                  onClick={() => setExportScope("front-only")}
                  className={`w-full p-2 rounded-xl text-left border transition-all flex items-center justify-between ${
                    exportScope === "front-only"
                      ? "bg-sky-950/80 border-sky-500 text-white font-semibold"
                      : "bg-neutral-950 border-neutral-800 text-neutral-300 hover:bg-neutral-800"
                  }`}
                >
                  <div>
                    <span className="block">Front Card Only</span>
                    <span className="text-[10px] text-neutral-400">
                      Exact 74 × 105 mm card boundary
                    </span>
                  </div>
                  {exportScope === "front-only" && <Check className="w-4 h-4 text-sky-400" />}
                </button>

                <button
                  type="button"
                  onClick={() => setExportScope("back-only")}
                  className={`w-full p-2 rounded-xl text-left border transition-all flex items-center justify-between ${
                    exportScope === "back-only"
                      ? "bg-sky-950/80 border-sky-500 text-white font-semibold"
                      : "bg-neutral-950 border-neutral-800 text-neutral-300 hover:bg-neutral-800"
                  }`}
                >
                  <div>
                    <span className="block">Back Card Only</span>
                    <span className="text-[10px] text-neutral-400">
                      Exact 74 × 105 mm card boundary
                    </span>
                  </div>
                  {exportScope === "back-only" && <Check className="w-4 h-4 text-sky-400" />}
                </button>

                <button
                  type="button"
                  onClick={() => setExportScope("two-pages")}
                  className={`w-full p-2 rounded-xl text-left border transition-all flex items-center justify-between ${
                    exportScope === "two-pages"
                      ? "bg-sky-950/80 border-sky-500 text-white font-semibold"
                      : "bg-neutral-950 border-neutral-800 text-neutral-300 hover:bg-neutral-800"
                  }`}
                >
                  <div>
                    <span className="block">Separate 2-Page PDF</span>
                    <span className="text-[10px] text-neutral-400">
                      Page 1: Front Card, Page 2: Back Card
                    </span>
                  </div>
                  {exportScope === "two-pages" && <Check className="w-4 h-4 text-sky-400" />}
                </button>
              </div>
            </div>

            {/* Format Selection */}
            <div>
              <label className="text-neutral-400 font-medium block mb-1.5">
                Output Format
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setFormat("pdf")}
                  className={`p-2 rounded-xl border text-center font-semibold ${
                    format === "pdf"
                      ? "bg-emerald-950/80 border-emerald-500 text-white"
                      : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white"
                  }`}
                >
                  <FileText className="w-4 h-4 mx-auto mb-1 text-emerald-400" />
                  <span>ISO PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormat("png")}
                  className={`p-2 rounded-xl border text-center font-semibold ${
                    format === "png"
                      ? "bg-emerald-950/80 border-emerald-500 text-white"
                      : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white"
                  }`}
                >
                  <ImageIcon className="w-4 h-4 mx-auto mb-1 text-sky-400" />
                  <span>PNG Image</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormat("jpeg")}
                  className={`p-2 rounded-xl border text-center font-semibold ${
                    format === "jpeg"
                      ? "bg-emerald-950/80 border-emerald-500 text-white"
                      : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white"
                  }`}
                >
                  <ImageIcon className="w-4 h-4 mx-auto mb-1 text-amber-400" />
                  <span>JPEG High</span>
                </button>
              </div>
            </div>

            {/* Cutting Guides */}
            <label className="flex items-center space-x-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={includeCuttingGuides}
                onChange={(e) => setIncludeCuttingGuides(e.target.checked)}
                className="rounded accent-emerald-500"
              />
              <span className="text-neutral-300">Include Corner Cutting Marks</span>
            </label>
          </div>

          {/* Right: Live Preview */}
          <div className="flex flex-col items-center justify-center bg-neutral-950 border border-neutral-800 rounded-2xl p-4">
            <span className="text-[10px] font-mono text-neutral-400 mb-2 uppercase tracking-wider">
              Export Rendering Preview
            </span>
            <div className="flex-1 flex items-center justify-center overflow-hidden max-h-64">
              {previewDataUrl ? (
                <img
                  src={previewDataUrl}
                  alt="Export Preview"
                  className="max-h-56 max-w-full object-contain rounded shadow-lg border border-neutral-700/60"
                />
              ) : (
                <span className="text-xs text-neutral-500">Rendering preview...</span>
              )}
            </div>
            <span className="text-[10px] text-neutral-500 mt-2">
              Physical scale rendered at 300 DPI print fidelity
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="h-12 border-t border-neutral-800 px-4 flex items-center justify-between bg-neutral-950/60">
          <span className="text-xs text-neutral-400">
            Target Dimensions: {project.pageWidthMm} × {project.pageHeightMm} mm
          </span>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={isExporting}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? "Generating..." : `Download ${format.toUpperCase()}`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
