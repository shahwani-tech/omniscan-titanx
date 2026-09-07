/**
 * OMNISCAN TITAN X - Print Settings Panel
 * Full suite of printer-synchronized layout, page range, scaling, margin, and duplex controls.
 */

import React from "react";
import {
  Copy,
  FileSpreadsheet,
  Maximize2,
  Scissors,
  Palette,
  BookOpen,
  Layout,
  Gauge,
  Sliders,
} from "lucide-react";
import { usePrint } from "../../context/PrintContext";
import { STANDARD_PAPER_SIZES } from "../../services/print/constants";

export const PrintSettingsPanel: React.FC = () => {
  const {
    printSettings,
    updatePrintSettings,
    capabilities,
    payload,
  } = usePrint();

  const supportedPaperSizes = capabilities?.paperSizes || STANDARD_PAPER_SIZES;
  const supportsDuplex = capabilities?.supportsDuplex ?? false;
  const supportsColor = capabilities?.supportsColor ?? true;

  const totalSourcePages = payload?.document?.pages?.length || payload?.pages?.length || payload?.canvases?.length || 1;

  return (
    <div className="space-y-4 text-xs">
      {/* 1. Copies & Collate */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-neutral-300 flex items-center gap-1">
            <Copy className="w-3 h-3 text-amber-400" />
            Copies
          </label>
          <div className="flex items-center border border-neutral-700 bg-neutral-900 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => updatePrintSettings({ copies: Math.max(1, printSettings.copies - 1) })}
              className="px-2.5 py-1.5 hover:bg-neutral-800 text-neutral-300 transition-colors"
            >
              -
            </button>
            <input
              type="number"
              min={1}
              max={999}
              value={printSettings.copies}
              onChange={(e) => updatePrintSettings({ copies: Math.max(1, parseInt(e.target.value, 10) || 1) })}
              className="w-full bg-transparent text-center text-xs font-semibold text-neutral-100 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => updatePrintSettings({ copies: printSettings.copies + 1 })}
              className="px-2.5 py-1.5 hover:bg-neutral-800 text-neutral-300 transition-colors"
            >
              +
            </button>
          </div>
        </div>

        <div className="space-y-1 flex flex-col justify-end">
          <label className="flex items-center gap-2 p-2 bg-neutral-900 border border-neutral-800 rounded-lg cursor-pointer hover:bg-neutral-800/80 transition-colors">
            <input
              type="checkbox"
              checked={printSettings.collate}
              onChange={(e) => updatePrintSettings({ collate: e.target.checked })}
              className="w-4 h-4 rounded border-neutral-700 bg-neutral-800 text-amber-500 focus:ring-0 cursor-pointer"
            />
            <span className="text-neutral-300 font-medium">Collate Pages</span>
          </label>
        </div>
      </div>

      {/* 2. Paper Size & Orientation */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-neutral-300 flex items-center gap-1">
            <FileSpreadsheet className="w-3 h-3 text-amber-400" />
            Paper Size
          </label>
          <select
            value={printSettings.paperSizeId}
            onChange={(e) => updatePrintSettings({ paperSizeId: e.target.value })}
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
          >
            {supportedPaperSizes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-medium text-neutral-300 flex items-center gap-1">
            <Layout className="w-3 h-3 text-amber-400" />
            Orientation
          </label>
          <div className="grid grid-cols-2 gap-1 bg-neutral-900 p-1 border border-neutral-700 rounded-lg">
            <button
              type="button"
              onClick={() => updatePrintSettings({ orientation: "portrait" })}
              className={`py-1 rounded text-center font-medium transition-colors ${
                printSettings.orientation === "portrait"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              Portrait
            </button>
            <button
              type="button"
              onClick={() => updatePrintSettings({ orientation: "landscape" })}
              className={`py-1 rounded text-center font-medium transition-colors ${
                printSettings.orientation === "landscape"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              Landscape
            </button>
          </div>
        </div>
      </div>

      {/* 3. Color Mode & Quality */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-neutral-300 flex items-center gap-1">
            <Palette className="w-3 h-3 text-amber-400" />
            Color Output
          </label>
          <div className="grid grid-cols-2 gap-1 bg-neutral-900 p-1 border border-neutral-700 rounded-lg">
            <button
              type="button"
              disabled={!supportsColor}
              onClick={() => updatePrintSettings({ colorMode: "color" })}
              className={`py-1 rounded text-center font-medium transition-colors ${
                printSettings.colorMode === "color"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "text-neutral-400 hover:text-neutral-200 disabled:opacity-30"
              }`}
            >
              Color
            </button>
            <button
              type="button"
              onClick={() => updatePrintSettings({ colorMode: "grayscale" })}
              className={`py-1 rounded text-center font-medium transition-colors ${
                printSettings.colorMode === "grayscale"
                  ? "bg-neutral-700 text-neutral-100 border border-neutral-500"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              Grayscale
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-medium text-neutral-300 flex items-center gap-1">
            <Gauge className="w-3 h-3 text-amber-400" />
            Print Quality
          </label>
          <select
            value={printSettings.quality}
            onChange={(e) => updatePrintSettings({ quality: e.target.value as any })}
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
          >
            <option value="draft">Draft (300 DPI Fast)</option>
            <option value="normal">Normal (600 DPI Standard)</option>
            <option value="high">High (1200 DPI Photo Quality)</option>
          </select>
        </div>
      </div>

      {/* 4. Scaling Mode */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-medium text-neutral-300 flex items-center gap-1">
          <Maximize2 className="w-3 h-3 text-amber-400" />
          Page Scaling
        </label>
        <div className="grid grid-cols-4 gap-1 bg-neutral-900 p-1 border border-neutral-700 rounded-lg text-center">
          <button
            type="button"
            onClick={() => updatePrintSettings({ scaling: "fit" })}
            className={`py-1 rounded text-[11px] font-medium transition-colors ${
              printSettings.scaling === "fit"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Fit Page
          </button>
          <button
            type="button"
            onClick={() => updatePrintSettings({ scaling: "actual" })}
            className={`py-1 rounded text-[11px] font-medium transition-colors ${
              printSettings.scaling === "actual"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            100% Actual
          </button>
          <button
            type="button"
            onClick={() => updatePrintSettings({ scaling: "fill" })}
            className={`py-1 rounded text-[11px] font-medium transition-colors ${
              printSettings.scaling === "fill"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Fill Page
          </button>
          <button
            type="button"
            onClick={() => updatePrintSettings({ scaling: "custom" })}
            className={`py-1 rounded text-[11px] font-medium transition-colors ${
              printSettings.scaling === "custom"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Custom %
          </button>
        </div>

        {printSettings.scaling === "custom" && (
          <div className="flex items-center gap-2 pt-1 px-1">
            <span className="text-[11px] text-neutral-400">Scale:</span>
            <input
              type="range"
              min={25}
              max={250}
              value={printSettings.customScalePercent}
              onChange={(e) => updatePrintSettings({ customScalePercent: parseInt(e.target.value, 10) })}
              className="w-full accent-amber-500"
            />
            <span className="text-xs font-mono text-amber-300 w-12 text-right">
              {printSettings.customScalePercent}%
            </span>
          </div>
        )}
      </div>

      {/* 5. Margins */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-neutral-300 flex items-center gap-1">
            <Sliders className="w-3 h-3 text-amber-400" />
            Margins
          </label>
          <select
            value={printSettings.marginType}
            onChange={(e) => updatePrintSettings({ marginType: e.target.value as any })}
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
          >
            <option value="normal">Normal (5 mm)</option>
            <option value="narrow">Narrow (3 mm)</option>
            <option value="none">None (0 mm / Edge-to-Edge)</option>
            <option value="custom">Custom Margins...</option>
          </select>
        </div>

        {/* 6. Duplex / 2-Sided Printing */}
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-neutral-300 flex items-center gap-1">
            <BookOpen className="w-3 h-3 text-amber-400" />
            Two-Sided (Duplex)
          </label>
          <select
            value={printSettings.duplex}
            disabled={!supportsDuplex}
            onChange={(e) => updatePrintSettings({ duplex: e.target.value as any })}
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-amber-500 disabled:opacity-40"
          >
            <option value="none">Single-Sided (1-Sided)</option>
            {supportsDuplex && (
              <>
                <option value="long-edge">Flip on Long Edge (Standard Book)</option>
                <option value="short-edge">Flip on Short Edge (Calendar)</option>
              </>
            )}
            {!supportsDuplex && <option value="none">Not supported by printer</option>}
          </select>
        </div>
      </div>

      {/* 7. Page Range Selection */}
      <div className="space-y-1.5 bg-neutral-950/60 p-2.5 rounded-lg border border-neutral-800">
        <label className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider flex items-center justify-between">
          <span>Page Range</span>
          <span className="text-neutral-500 font-normal">Total: {totalSourcePages} page(s)</span>
        </label>
        <div className="grid grid-cols-3 gap-1">
          <button
            type="button"
            onClick={() => updatePrintSettings({ pageRangeMode: "all" })}
            className={`py-1 rounded text-center text-[11px] font-medium transition-colors ${
              printSettings.pageRangeMode === "all"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                : "bg-neutral-900 text-neutral-400 hover:text-neutral-200"
            }`}
          >
            All Pages
          </button>
          <button
            type="button"
            onClick={() => updatePrintSettings({ pageRangeMode: "current" })}
            className={`py-1 rounded text-center text-[11px] font-medium transition-colors ${
              printSettings.pageRangeMode === "current"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                : "bg-neutral-900 text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Current Page
          </button>
          <button
            type="button"
            onClick={() => updatePrintSettings({ pageRangeMode: "custom" })}
            className={`py-1 rounded text-center text-[11px] font-medium transition-colors ${
              printSettings.pageRangeMode === "custom"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                : "bg-neutral-900 text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Custom Range
          </button>
        </div>

        {printSettings.pageRangeMode === "custom" && (
          <div className="pt-1.5">
            <input
              type="text"
              placeholder="e.g. 1-3, 5, 8"
              value={printSettings.customPageRange}
              onChange={(e) => updatePrintSettings({ customPageRange: e.target.value })}
              className="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
            />
          </div>
        )}
      </div>

      {/* 8. Cutting Guides & Crop Marks */}
      <label className="flex items-center justify-between p-2.5 bg-neutral-900/60 hover:bg-neutral-900 rounded-lg border border-neutral-800 cursor-pointer transition-colors">
        <div className="flex items-center gap-2">
          <Scissors className="w-3.5 h-3.5 text-amber-400" />
          <div className="text-xs">
            <div className="font-medium text-neutral-200">Cutting Guides & Corner Marks</div>
            <div className="text-[10px] text-neutral-400">Essential for passport photos, cards, and A6 trimming</div>
          </div>
        </div>
        <input
          type="checkbox"
          checked={printSettings.cuttingGuides}
          onChange={(e) => updatePrintSettings({ cuttingGuides: e.target.checked })}
          className="w-4 h-4 rounded border-neutral-700 bg-neutral-800 text-amber-500 focus:ring-0 cursor-pointer"
        />
      </label>
    </div>
  );
};
