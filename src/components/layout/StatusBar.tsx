/**
 * OMNISCAN TITAN X - Enterprise Status Bar
 * Metric Gauges, Zoom Controls, Memory Telemetry & Engine Indicators
 */

import React from "react";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Activity,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  Cpu,
} from "lucide-react";
import { OmniPage, AppLanguage } from "../../types";
import { t } from "../../engine/i18n";
import { PdfFilterNumericInput } from "../common/PdfFilterNumericInput";

interface StatusBarProps {
  activePage: OmniPage | null;
  activePageIndex: number;
  totalPages: number;
  zoom: number;
  isProcessing: boolean;
  processingMessage?: string;
  language: AppLanguage;
  onZoomChange: (newZoom: number) => void;
  onFitWidth: () => void;
  onFitPage: () => void;
  onActualSize: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  activePage,
  activePageIndex,
  totalPages,
  zoom,
  isProcessing,
  processingMessage,
  language,
  onZoomChange,
  onFitWidth,
  onFitPage,
  onActualSize,
}) => {
  // Convert pixels to mm and inches based on page DPI
  const dpi = activePage?.dpi || 300;
  const widthMm = activePage ? ((activePage.width / dpi) * 25.4).toFixed(1) : "215.9";
  const heightMm = activePage ? ((activePage.height / dpi) * 25.4).toFixed(1) : "279.4";
  const widthIn = activePage ? (activePage.width / dpi).toFixed(2) : "8.50";
  const heightIn = activePage ? (activePage.height / dpi).toFixed(2) : "11.00";

  return (
    <footer className="flex items-center justify-between px-3 py-1 bg-neutral-900 border-t border-neutral-800 text-[11px] text-neutral-400 select-none z-30 shrink-0">
      {/* Left: Engine Status & Active Page Info */}
      <div className="flex items-center space-x-3">
        {/* Status Indicator */}
        <div className="flex items-center space-x-1.5">
          {isProcessing ? (
            <div className="flex items-center space-x-1.5 text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span className="font-medium">{processingMessage || t("status.processing", language)}</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="font-medium">{t("status.ready", language)}</span>
            </div>
          )}
        </div>

        <span className="text-neutral-700">|</span>

        {/* Page Counter */}
        <div className="font-mono text-neutral-200">
          Page <span className="font-bold text-sky-400">{totalPages > 0 ? activePageIndex + 1 : 0}</span> of{" "}
          <span className="font-bold">{totalPages}</span>
        </div>

        <span className="text-neutral-700">|</span>

        {/* Paper Dimensions in Metric and Imperial */}
        {activePage && (
          <div className="hidden md:flex items-center space-x-1 font-mono text-neutral-400">
            <span>
              {widthMm} × {heightMm} mm
            </span>
            <span className="text-neutral-600">({widthIn} × {heightIn} in)</span>
          </div>
        )}

        {/* DPI & Color Depth */}
        {activePage && (
          <div className="hidden lg:flex items-center space-x-1 font-mono text-neutral-400">
            <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 font-semibold text-[10px]">
              {activePage.dpi || 300} DPI
            </span>
            <span className="capitalize">{activePage.filters?.colorMode || "color"}</span>
          </div>
        )}

        {/* Blank warning */}
        {activePage?.isBlank && (
          <div className="flex items-center space-x-1 text-amber-400 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-800/40">
            <AlertTriangle className="w-3 h-3" />
            <span>{t("status.blankDetected", language)}</span>
          </div>
        )}
      </div>

      {/* Right: Zoom Controls & Engine Metrics */}
      <div className="flex items-center space-x-2">
        {/* Memory telemetry */}
        <div className="hidden xl:flex items-center space-x-1 text-neutral-500 font-mono text-[10px]">
          <HardDrive className="w-3 h-3" />
          <span>RAM: ~{(totalPages * 3.4 + 18).toFixed(1)} MB</span>
        </div>

        <span className="hidden xl:inline text-neutral-700">|</span>

        {/* Fit Width / Fit Page Buttons */}
        <button
          onClick={onFitWidth}
          className="px-1.5 py-0.5 rounded hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
          title="Fit Width"
        >
          Fit Width
        </button>
        <button
          onClick={onFitPage}
          className="px-1.5 py-0.5 rounded hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
          title="Fit Entire Page"
        >
          Fit Page
        </button>
        <button
          onClick={onActualSize}
          className="px-1.5 py-0.5 rounded hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
          title="100% Actual Size"
        >
          100%
        </button>

        {/* Zoom Slider and Increment Controls */}
        <div className="flex items-center space-x-1.5 bg-neutral-850 px-2 py-0.5 rounded border border-neutral-800">
          <button
            onClick={() => onZoomChange(Math.max(0.1, zoom - 0.15))}
            className="p-0.5 rounded hover:bg-neutral-750 text-neutral-400 hover:text-white"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <input
            id="pdf-zoom-slider"
            type="range"
            min="0.1"
            max="4.0"
            step="0.05"
            value={zoom}
            onChange={(e) => onZoomChange(parseFloat(e.target.value))}
            className="w-20 accent-sky-500 cursor-pointer h-1.5 bg-neutral-700 rounded-lg appearance-none"
            title={`Zoom (${Math.round(zoom * 100)}%)`}
          />

          <button
            onClick={() => onZoomChange(Math.min(5.0, zoom + 0.15))}
            className="p-0.5 rounded hover:bg-neutral-750 text-neutral-400 hover:text-white"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <PdfFilterNumericInput
            id="pdf-zoom-numeric-input"
            value={Math.round(zoom * 100)}
            min={10}
            max={500}
            step={5}
            precision={0}
            unit="%"
            className="w-11"
            ariaLabel="Zoom percentage"
            onChange={(val) => {
              const clamped = Math.max(0.1, Math.min(5.0, val / 100));
              onZoomChange(clamped);
            }}
          />
        </div>
      </div>
    </footer>
  );
};
