/**
 * OMNISCAN TITAN X - CamScanner-Style Advanced Filter Studio
 * Non-Destructive Live Preview, Before/After Split Comparison, 16 Presets & Batch Document Application
 */

import React, { useState, useEffect, useRef } from "react";
import { OmniPage, ImageFilterPipeline, CamScannerPresetId } from "../../types";
import { executeFilterPipeline, BUILTIN_CAMSCANNER_PRESETS } from "../../engine/filters";
import { DEFAULT_FILTERS } from "../../engine/vision";
import { FilterPresetGallery } from "./FilterPresetGallery";
import { FilterParameterControls } from "./FilterParameterControls";
import {
  X,
  Check,
  Columns,
  Split,
  Eye,
  Sliders,
  RotateCw,
  RotateCcw,
  Sparkles,
  Layers,
  Zap,
} from "lucide-react";

interface CamScannerFilterModalProps {
  page: OmniPage;
  pageIndex: number;
  totalPages: number;
  isOpen: boolean;
  onClose: () => void;
  onApplyFilters: (pageIndex: number, filters: ImageFilterPipeline, applyToAll: boolean) => void;
}

export const CamScannerFilterModal: React.FC<CamScannerFilterModalProps> = ({
  page,
  pageIndex,
  totalPages,
  isOpen,
  onClose,
  onApplyFilters,
}) => {
  const [activeFilters, setActiveFilters] = useState<ImageFilterPipeline>({
    ...page.filters,
  });
  const [previewUrl, setPreviewUrl] = useState<string>(page.processedDataUrl);
  const [isProcessing, setIsProcessing] = useState(false);

  // Comparison View Mode
  const [viewMode, setViewMode] = useState<"split" | "side-by-side" | "single">("split");
  const [splitPos, setSplitPos] = useState<number>(0.5);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);

  const debounceTimerRef = useRef<number | null>(null);

  // Process live filter preview on parameter change
  useEffect(() => {
    if (!isOpen) return;
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }

    setIsProcessing(true);

    debounceTimerRef.current = window.setTimeout(async () => {
      try {
        const { processedDataUrl } = await executeFilterPipeline(page.originalDataUrl, activeFilters, {
          isFastPreview: false,
        });
        setPreviewUrl(processedDataUrl);
      } catch (e) {
        console.error("Filter preview failed:", e);
      } finally {
        setIsProcessing(false);
      }
    }, 60);

    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, [activeFilters, page.originalDataUrl, isOpen]);

  const handleSelectPreset = (presetId: CamScannerPresetId, presetFilters: Partial<ImageFilterPipeline>) => {
    setActiveFilters((prev) => ({
      ...prev,
      ...presetFilters,
      preset: presetId,
    }));
  };

  const handleParameterChange = (updates: Partial<ImageFilterPipeline>) => {
    setActiveFilters((prev) => ({
      ...prev,
      ...updates,
      preset: "custom",
    }));
  };

  const handleResetFilters = () => {
    setActiveFilters({ ...DEFAULT_FILTERS });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingSplit || viewMode !== "split") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0.05, Math.min(0.95, (e.clientX - rect.left) / rect.width));
    setSplitPos(pos);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col select-none animate-in fade-in duration-200">
      {/* Top Header Bar */}
      <header className="h-14 px-6 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              CamScanner Document Filter Studio
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-950 text-sky-400 border border-sky-800/80">
                Page {pageIndex + 1} of {totalPages}
              </span>
            </h2>
            <p className="text-[11px] text-neutral-400">
              Non-destructive optical enhancement with instantaneous before/after comparison
            </p>
          </div>
        </div>

        {/* View Mode Controls */}
        <div className="flex items-center space-x-1.5 bg-neutral-950 p-1 rounded-lg border border-neutral-800 text-xs">
          <button
            onClick={() => setViewMode("split")}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded transition-colors ${
              viewMode === "split" ? "bg-amber-600 text-white font-medium shadow" : "text-neutral-400 hover:text-white"
            }`}
            title="Split Comparison Slider"
          >
            <Split className="w-3.5 h-3.5" />
            <span>Split Slider</span>
          </button>
          <button
            onClick={() => setViewMode("side-by-side")}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded transition-colors ${
              viewMode === "side-by-side" ? "bg-sky-600 text-white font-medium shadow" : "text-neutral-400 hover:text-white"
            }`}
            title="Side-by-Side Comparison"
          >
            <Columns className="w-3.5 h-3.5" />
            <span>Side-by-Side</span>
          </button>
          <button
            onClick={() => setViewMode("single")}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded transition-colors ${
              viewMode === "single" ? "bg-sky-600 text-white font-medium shadow" : "text-neutral-400 hover:text-white"
            }`}
            title="Full Processed Preview"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Processed</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Workspace Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left / Center Preview Stage */}
        <div
          onMouseMove={handleMouseMove}
          onMouseUp={() => setIsDraggingSplit(false)}
          className="flex-1 bg-neutral-950 p-6 flex flex-col items-center justify-center relative overflow-hidden"
        >
          {/* Split Mode */}
          {viewMode === "split" && (
            <div
              data-split-slider="true"
              onMouseDown={() => setIsDraggingSplit(true)}
              onWheel={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const delta = (e.deltaY < 0 || e.deltaX > 0) ? 0.02 : -0.02;
                setSplitPos((prev) => Math.max(0.05, Math.min(0.95, Number((prev + delta).toFixed(3)))));
              }}
              className="relative max-h-[68vh] max-w-full shadow-2xl rounded border border-neutral-800 overflow-hidden cursor-ew-resize select-none"
              title="Drag or roll mouse wheel to compare original vs processed"
            >
              {/* Processed (Full Base) */}
              <img
                src={previewUrl}
                alt="Processed"
                className="max-h-[68vh] w-auto pointer-events-none object-contain"
              />

              {/* Original (Left Overlay clamped by splitPos) */}
              <div
                style={{ width: `${splitPos * 100}%` }}
                className="absolute inset-y-0 left-0 overflow-hidden border-r-2 border-amber-400 shadow-2xl"
              >
                <img
                  src={page.originalDataUrl}
                  alt="Original"
                  className="max-h-[68vh] w-auto max-w-none pointer-events-none object-contain"
                />
                <span className="absolute top-3 left-3 px-2 py-0.5 rounded bg-black/85 text-[10px] font-mono text-amber-400 font-bold border border-amber-500/40">
                  ORIGINAL
                </span>
              </div>

              <span className="absolute top-3 right-3 px-2 py-0.5 rounded bg-black/85 text-[10px] font-mono text-sky-400 font-bold border border-sky-500/40">
                PROCESSED ({activeFilters.preset?.toUpperCase() || "CUSTOM"})
              </span>

              {/* Slider Handle */}
              <div
                style={{ left: `${splitPos * 100}%` }}
                className="absolute inset-y-0 -ml-3 w-6 flex items-center justify-center z-20 pointer-events-none"
              >
                <div className="w-6 h-10 rounded-full bg-amber-400 text-neutral-950 flex items-center justify-center shadow-2xl font-bold text-xs">
                  ↔
                </div>
              </div>
            </div>
          )}

          {/* Side-by-Side Mode */}
          {viewMode === "side-by-side" && (
            <div className="flex items-center gap-6 max-h-[68vh] max-w-full">
              {/* Original */}
              <div className="relative shadow-2xl rounded border border-neutral-800 overflow-hidden bg-neutral-900">
                <img
                  src={page.originalDataUrl}
                  alt="Original"
                  className="max-h-[66vh] w-auto object-contain"
                />
                <span className="absolute top-3 left-3 px-2 py-0.5 rounded bg-black/85 text-[10px] font-mono text-amber-400 font-bold">
                  ORIGINAL
                </span>
              </div>

              {/* Processed */}
              <div className="relative shadow-2xl rounded border border-sky-500/50 overflow-hidden bg-neutral-900">
                <img
                  src={previewUrl}
                  alt="Processed"
                  className="max-h-[66vh] w-auto object-contain"
                />
                <span className="absolute top-3 right-3 px-2 py-0.5 rounded bg-black/85 text-[10px] font-mono text-sky-400 font-bold">
                  PROCESSED
                </span>
              </div>
            </div>
          )}

          {/* Single Mode */}
          {viewMode === "single" && (
            <div className="relative shadow-2xl rounded border border-neutral-800 overflow-hidden bg-neutral-900">
              <img
                src={previewUrl}
                alt="Processed"
                className="max-h-[70vh] w-auto object-contain"
              />
            </div>
          )}

          {isProcessing && (
            <div className="absolute bottom-4 left-6 px-3 py-1.5 rounded-lg bg-black/80 backdrop-blur-md border border-neutral-700 text-xs text-sky-400 font-mono flex items-center gap-2 shadow-xl">
              <div className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-ping" />
              Rendering 300 DPI Non-Destructive Pass...
            </div>
          )}
        </div>

        {/* Right Sidebar - Parameter Controls */}
        <aside className="w-80 bg-neutral-900 border-l border-neutral-800 p-4 overflow-y-auto shrink-0 flex flex-col justify-between">
          <FilterParameterControls
            filters={activeFilters}
            onChange={handleParameterChange}
            onReset={handleResetFilters}
          />
        </aside>
      </div>

      {/* Bottom Preset Strip & Apply Footer */}
      <footer className="bg-neutral-900 border-t border-neutral-800 p-4 shrink-0 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Preset Gallery Strip */}
        <div className="flex-1 w-full overflow-hidden">
          <FilterPresetGallery
            activePreset={activeFilters.preset}
            currentFilters={activeFilters}
            sourceThumbnailUrl={page.thumbnailDataUrl || page.originalDataUrl}
            onSelectPreset={handleSelectPreset}
          />
        </div>

        {/* Confirm / Apply Buttons */}
        <div className="flex items-center space-x-2 shrink-0 border-t md:border-t-0 md:border-l border-neutral-800 pt-3 md:pt-0 md:pl-4">
          <button
            onClick={() => onApplyFilters(pageIndex, activeFilters, false)}
            className="flex items-center space-x-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-sky-600 hover:bg-sky-500 text-white shadow-lg transition-all"
          >
            <Check className="w-4 h-4" />
            <span>Apply to This Page</span>
          </button>

          {totalPages > 1 && (
            <button
              onClick={() => onApplyFilters(pageIndex, activeFilters, true)}
              className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sky-400 border border-neutral-700 transition-all"
              title="Apply this exact filter pipeline to all pages in the document"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Apply to All ({totalPages} pgs)</span>
            </button>
          )}
        </div>
      </footer>
    </div>
  );
};
