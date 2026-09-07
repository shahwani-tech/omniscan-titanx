/**
 * OMNISCAN TITAN X - Print Preview Component
 * High-fidelity interactive preview matching exact printed output with zoom, pan,
 * page flipping, physical dimension overlays, and cutting guides.
 */

import React, { useState, useRef, useEffect } from "react";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileCheck,
  RefreshCw,
  Eye,
  Sliders,
} from "lucide-react";
import { usePrint } from "../../context/PrintContext";
import { printPreviewRenderer } from "../../services/print/PrintPreviewRenderer";

export const PrintPreview: React.FC = () => {
  const {
    renderedPages,
    isPreviewLoading,
    printSettings,
    selectedPrinter,
    refreshPreview,
  } = usePrint();

  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0); // 0.3 to 3.0
  const [isFitWidth, setIsFitWidth] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep active page index clamped within rendered pages
  useEffect(() => {
    if (activePageIndex >= renderedPages.length && renderedPages.length > 0) {
      setActivePageIndex(renderedPages.length - 1);
    }
  }, [renderedPages.length, activePageIndex]);

  const currentPage = renderedPages[activePageIndex] || renderedPages[0];

  const handleZoomIn = () => setZoomLevel((z) => Math.min(3.0, Number((z + 0.15).toFixed(2))));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(0.35, Number((z - 0.15).toFixed(2))));
  const handleActualSize = () => setZoomLevel(1.0);

  const handleFitPage = () => {
    if (!containerRef.current || !currentPage) return;
    const containerH = containerRef.current.clientHeight - 80;
    const containerW = containerRef.current.clientWidth - 80;
    const aspect = currentPage.widthMm / currentPage.heightMm;

    let targetH = containerH;
    let targetW = targetH * aspect;
    if (targetW > containerW) {
      targetW = containerW;
      targetH = targetW / aspect;
    }

    // Default reference rendered height is around 600px
    const scale = Math.max(0.4, Math.min(2.0, targetH / 650));
    setZoomLevel(Number(scale.toFixed(2)));
    setIsFitWidth(false);
  };

  const handleFitWidth = () => {
    if (!containerRef.current || !currentPage) return;
    const containerW = containerRef.current.clientWidth - 80;
    const scale = Math.max(0.4, Math.min(2.5, containerW / 500));
    setZoomLevel(Number(scale.toFixed(2)));
    setIsFitWidth(true);
  };

  const { widthMm, heightMm } = printPreviewRenderer.getPaperDimensions(
    printSettings.paperSizeId,
    printSettings.orientation
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-950/90 select-none overflow-hidden relative">
      {/* Top Preview Control Bar */}
      <div className="h-10 px-4 bg-neutral-900/90 border-b border-neutral-800 flex items-center justify-between z-10 shrink-0 text-xs">
        {/* Page Switcher */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActivePageIndex((p) => Math.max(0, p - 1))}
            disabled={activePageIndex === 0 || renderedPages.length <= 1}
            className="p-1 hover:bg-neutral-800 disabled:opacity-30 rounded text-neutral-300 transition-colors"
            title="Previous page (Left arrow)"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-mono text-neutral-300 px-1 font-semibold">
            {renderedPages.length > 0 ? activePageIndex + 1 : 0} / {renderedPages.length}
          </span>
          <button
            type="button"
            onClick={() => setActivePageIndex((p) => Math.min(renderedPages.length - 1, p + 1))}
            disabled={activePageIndex >= renderedPages.length - 1 || renderedPages.length <= 1}
            className="p-1 hover:bg-neutral-800 disabled:opacity-30 rounded text-neutral-300 transition-colors"
            title="Next page (Right arrow)"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {currentPage?.label && (
            <span className="hidden sm:inline text-neutral-400 text-[11px] border-l border-neutral-700/80 pl-2 ml-1 truncate max-w-[140px]">
              {currentPage.label}
            </span>
          )}
        </div>

        {/* Dimension & Sheet Spec Badge */}
        <div className="hidden md:flex items-center gap-2 text-[11px] text-neutral-400 bg-neutral-950 px-2.5 py-1 rounded border border-neutral-800 font-mono">
          <span className="text-amber-400 uppercase font-semibold">{printSettings.paperSizeId}</span>
          <span>•</span>
          <span>
            {widthMm} × {heightMm} mm
          </span>
          <span>•</span>
          <span className="capitalize">{printSettings.orientation}</span>
          {printSettings.colorMode === "grayscale" && (
            <>
              <span>•</span>
              <span className="text-neutral-400">Grayscale</span>
            </>
          )}
        </div>

        {/* Zoom & Fit Controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-1 hover:bg-neutral-800 text-neutral-300 rounded transition-colors"
            title="Zoom out (-)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleActualSize}
            className="px-1.5 py-0.5 hover:bg-neutral-800 text-neutral-300 font-mono text-[11px] rounded transition-colors"
            title="Actual Size (100%)"
          >
            {Math.round(zoomLevel * 100)}%
          </button>
          <button
            type="button"
            onClick={handleZoomIn}
            className="p-1 hover:bg-neutral-800 text-neutral-300 rounded transition-colors"
            title="Zoom in (+)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <div className="h-4 w-[1px] bg-neutral-800 mx-1" />
          <button
            type="button"
            onClick={handleFitPage}
            className="px-2 py-0.5 hover:bg-neutral-800 text-neutral-300 text-[11px] font-medium rounded transition-colors"
            title="Fit to window"
          >
            Fit Page
          </button>
          <button
            type="button"
            onClick={handleFitWidth}
            className="px-2 py-0.5 hover:bg-neutral-800 text-neutral-300 text-[11px] font-medium rounded transition-colors"
            title="Fit width"
          >
            Fit Width
          </button>
          <button
            type="button"
            onClick={refreshPreview}
            disabled={isPreviewLoading}
            className="p-1 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 rounded transition-colors"
            title="Force re-render preview"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPreviewLoading ? "animate-spin text-amber-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* Main Interactive Stage Area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex items-center justify-center p-6 bg-[#121418] relative"
      >
        {isPreviewLoading && (
          <div className="absolute inset-0 bg-neutral-950/60 backdrop-blur-[1px] flex flex-col items-center justify-center gap-2 z-20">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
            <span className="text-xs text-neutral-300 font-medium">Generating Print Preview...</span>
          </div>
        )}

        {currentPage ? (
          <div
            className="relative shadow-2xl transition-transform duration-75 ease-out rounded-sm border border-neutral-700/60 bg-white"
            style={{
              transform: `scale(${zoomLevel})`,
              transformOrigin: "center center",
              boxShadow: "0 20px 50px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)",
            }}
          >
            {/* Sheet Render Image */}
            <img
              src={currentPage.dataUrl}
              alt={`Print Preview Page ${activePageIndex + 1}`}
              className="block max-w-none select-none pointer-events-none"
              style={{
                width: `${currentPage.widthMm * 2.2}px`,
                height: `${currentPage.heightMm * 2.2}px`,
              }}
            />

            {/* Printable Bounds / Non-Printable Margin Overlay Guidelines */}
            {!printSettings.borderless && printSettings.marginType !== "none" && (
              <div
                className="absolute pointer-events-none border border-dashed border-sky-400/40"
                style={{
                  top: `${(printSettings.marginType === "narrow" ? 3 : 5) * 2.2}px`,
                  left: `${(printSettings.marginType === "narrow" ? 3 : 5) * 2.2}px`,
                  right: `${(printSettings.marginType === "narrow" ? 3 : 5) * 2.2}px`,
                  bottom: `${(printSettings.marginType === "narrow" ? 3 : 5) * 2.2}px`,
                }}
                title="Printable bounds guideline"
              />
            )}
          </div>
        ) : (
          <div className="text-center space-y-2 text-neutral-500">
            <Eye className="w-8 h-8 mx-auto stroke-1" />
            <div className="text-sm">No preview available for the current selection.</div>
          </div>
        )}
      </div>

      {/* Bottom Preview Meta Bar */}
      <div className="h-7 px-4 bg-neutral-900 border-t border-neutral-800 flex items-center justify-between text-[11px] text-neutral-400 shrink-0">
        <div className="flex items-center gap-2">
          <span>Physical Output:</span>
          <span className="text-neutral-200 font-mono">
            {widthMm} × {heightMm} mm ({(widthMm / 25.4).toFixed(2)} × {(heightMm / 25.4).toFixed(2)} in)
          </span>
          <span>•</span>
          <span>Destination:</span>
          <span className="text-amber-300 truncate max-w-[200px] font-medium">
            {selectedPrinter?.displayName || "Select printer"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {printSettings.cuttingGuides && (
            <span className="px-1.5 py-0.2 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded text-[10px]">
              Cutting Guides Active
            </span>
          )}
          <span>WYSIWYG 1:1 Rendering Pipeline</span>
        </div>
      </div>
    </div>
  );
};
