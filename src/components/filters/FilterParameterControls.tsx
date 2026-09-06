/**
 * OMNISCAN TITAN X - CamScanner Filter Parameter Controls
 * Live Sliders, Micro-Adjustments, Dynamic Whiten/Shadow Toggles & Tooltips
 */

import React from "react";
import { ImageFilterPipeline } from "../../types";
import {
  Sun,
  Contrast,
  Zap,
  Sliders,
  Sparkles,
  RotateCcw,
  Eye,
  Shield,
  Palette,
  Droplets,
  Layers,
} from "lucide-react";
import { PdfFilterNumericInput } from "../common/PdfFilterNumericInput";

interface FilterParameterControlsProps {
  filters: ImageFilterPipeline;
  onChange: (updated: Partial<ImageFilterPipeline>) => void;
  onReset: () => void;
}

export const FilterParameterControls: React.FC<FilterParameterControlsProps> = ({
  filters,
  onChange,
  onReset,
}) => {
  return (
    <div className="flex flex-col space-y-4 text-xs">
      {/* Header with Reset */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
        <div className="flex items-center space-x-1.5 text-neutral-300 font-semibold">
          <Sliders className="w-3.5 h-3.5 text-sky-400" />
          <span>Advanced Adjustments</span>
        </div>
        <button
          onClick={onReset}
          className="flex items-center space-x-1 text-[11px] text-neutral-400 hover:text-white px-2 py-0.5 rounded bg-neutral-850 hover:bg-neutral-800 border border-neutral-750 transition-colors"
          title="Reset all parameters to default"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset</span>
        </button>
      </div>

      {/* Tone & Exposure */}
      <div className="space-y-3">
        <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 font-bold">
          Tone & Exposure
        </span>

        {/* Brightness */}
        <div className="space-y-1">
          <div className="flex justify-between text-neutral-300 select-none">
            <span className="flex items-center gap-1">
              <Sun className="w-3 h-3 text-amber-400" /> Brightness
            </span>
            <button
              type="button"
              onClick={() => onChange({ brightness: 0 })}
              className="text-[9px] text-neutral-500 hover:text-sky-400 font-mono transition-colors cursor-pointer"
            >
              reset (0)
            </button>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="range"
              min="-100"
              max="100"
              value={filters.brightness}
              onChange={(e) => onChange({ brightness: parseInt(e.target.value, 10) })}
              className="flex-1 accent-sky-500 bg-neutral-800 h-1.5 rounded cursor-pointer"
            />
            <PdfFilterNumericInput
              id="filter-studio-brightness"
              value={filters.brightness}
              min={-100}
              max={100}
              step={1}
              precision={0}
              onChange={(val) => onChange({ brightness: val })}
              ariaLabel="Brightness value"
            />
          </div>
        </div>

        {/* Contrast */}
        <div className="space-y-1">
          <div className="flex justify-between text-neutral-300 select-none">
            <span className="flex items-center gap-1">
              <Contrast className="w-3 h-3 text-sky-400" /> Contrast
            </span>
            <button
              type="button"
              onClick={() => onChange({ contrast: 0 })}
              className="text-[9px] text-neutral-500 hover:text-sky-400 font-mono transition-colors cursor-pointer"
            >
              reset (0)
            </button>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="range"
              min="-100"
              max="100"
              value={filters.contrast}
              onChange={(e) => onChange({ contrast: parseInt(e.target.value, 10) })}
              className="flex-1 accent-sky-500 bg-neutral-800 h-1.5 rounded cursor-pointer"
            />
            <PdfFilterNumericInput
              id="filter-studio-contrast"
              value={filters.contrast}
              min={-100}
              max={100}
              step={1}
              precision={0}
              onChange={(val) => onChange({ contrast: val })}
              ariaLabel="Contrast value"
            />
          </div>
        </div>

        {/* Gamma */}
        <div className="space-y-1">
          <div className="flex justify-between text-neutral-300 select-none">
            <span>Gamma Curve</span>
            <button
              type="button"
              onClick={() => onChange({ gamma: 1.0 })}
              className="text-[9px] text-neutral-500 hover:text-sky-400 font-mono transition-colors cursor-pointer"
            >
              reset (1.00)
            </button>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="range"
              min="0.3"
              max="2.5"
              step="0.05"
              value={filters.gamma}
              onChange={(e) => onChange({ gamma: parseFloat(e.target.value) })}
              className="flex-1 accent-sky-500 bg-neutral-800 h-1.5 rounded cursor-pointer"
            />
            <PdfFilterNumericInput
              id="filter-studio-gamma"
              value={filters.gamma}
              min={0.3}
              max={2.5}
              step={0.05}
              precision={2}
              onChange={(val) => onChange({ gamma: val })}
              ariaLabel="Gamma curve value"
            />
          </div>
        </div>

        {/* Saturation */}
        <div className="space-y-1">
          <div className="flex justify-between text-neutral-300 select-none">
            <span className="flex items-center gap-1">
              <Palette className="w-3 h-3 text-emerald-400" /> Saturation
            </span>
            <button
              type="button"
              onClick={() => onChange({ saturation: 0 })}
              className="text-[9px] text-neutral-500 hover:text-sky-400 font-mono transition-colors cursor-pointer"
            >
              reset (0)
            </button>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="range"
              min="-100"
              max="100"
              value={filters.saturation || 0}
              onChange={(e) => onChange({ saturation: parseInt(e.target.value, 10) })}
              className="flex-1 accent-emerald-500 bg-neutral-800 h-1.5 rounded cursor-pointer"
            />
            <PdfFilterNumericInput
              id="filter-studio-saturation"
              value={filters.saturation || 0}
              min={-100}
              max={100}
              step={1}
              precision={0}
              onChange={(val) => onChange({ saturation: val })}
              ariaLabel="Saturation value"
            />
          </div>
        </div>
      </div>

      {/* CamScanner Document Optics */}
      <div className="space-y-3 pt-2 border-t border-neutral-800/80">
        <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 font-bold">
          Document Optics & Cleaning
        </span>

        {/* Background Whitening */}
        <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center space-x-2 text-neutral-200 cursor-pointer font-medium">
              <input
                type="checkbox"
                checked={filters.backgroundWhiten}
                onChange={(e) => onChange({ backgroundWhiten: e.target.checked })}
                className="rounded accent-sky-500"
              />
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" /> Background Whiten
              </span>
            </label>
            <span className="text-[10px] text-neutral-400 font-mono">
              {filters.backgroundWhitenThreshold}
            </span>
          </div>
          {filters.backgroundWhiten && (
            <div className="flex items-center space-x-2">
              <input
                type="range"
                min="140"
                max="250"
                value={filters.backgroundWhitenThreshold}
                onChange={(e) => onChange({ backgroundWhitenThreshold: parseInt(e.target.value, 10) })}
                className="flex-1 accent-amber-500 bg-neutral-800 h-1.5 rounded cursor-pointer"
              />
              <PdfFilterNumericInput
                id="filter-studio-whiten"
                value={filters.backgroundWhitenThreshold}
                min={140}
                max={250}
                step={1}
                precision={0}
                onChange={(val) => onChange({ backgroundWhitenThreshold: val })}
                ariaLabel="Background whiten threshold"
              />
            </div>
          )}
        </div>

        {/* Shadow Removal */}
        <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center space-x-2 text-neutral-200 cursor-pointer font-medium">
              <input
                type="checkbox"
                checked={filters.shadowRemoval}
                onChange={(e) => onChange({ shadowRemoval: e.target.checked })}
                className="rounded accent-sky-500"
              />
              <span>Shadow Removal</span>
            </label>
            <span className="text-[10px] text-neutral-400 font-mono">
              {filters.shadowStrength || 70}%
            </span>
          </div>
          {filters.shadowRemoval && (
            <div className="flex items-center space-x-2">
              <input
                type="range"
                min="10"
                max="100"
                value={filters.shadowStrength || 70}
                onChange={(e) => onChange({ shadowStrength: parseInt(e.target.value, 10) })}
                className="flex-1 accent-sky-500 bg-neutral-800 h-1.5 rounded cursor-pointer"
              />
              <PdfFilterNumericInput
                id="filter-studio-shadow-strength"
                value={filters.shadowStrength || 70}
                min={10}
                max={100}
                step={1}
                precision={0}
                unit="%"
                onChange={(val) => onChange({ shadowStrength: val })}
                ariaLabel="Shadow removal strength"
              />
            </div>
          )}
        </div>

        {/* Sharpness */}
        <div className="space-y-1">
          <div className="flex justify-between text-neutral-300 select-none">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-cyan-400" /> Unsharp Mask / Sharpness
            </span>
            <button
              type="button"
              onClick={() => onChange({ sharpness: 0 })}
              className="text-[9px] text-neutral-500 hover:text-sky-400 font-mono transition-colors cursor-pointer"
            >
              reset (0%)
            </button>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="range"
              min="0"
              max="100"
              value={filters.sharpness}
              onChange={(e) => onChange({ sharpness: parseInt(e.target.value, 10) })}
              className="flex-1 accent-cyan-500 bg-neutral-800 h-1.5 rounded cursor-pointer"
            />
            <PdfFilterNumericInput
              id="filter-studio-sharpness"
              value={filters.sharpness}
              min={0}
              max={100}
              step={1}
              precision={0}
              unit="%"
              onChange={(val) => onChange({ sharpness: val })}
              ariaLabel="Sharpness percentage"
            />
          </div>
        </div>

        {/* Punch Holes & Margin Cleanup */}
        <label className="flex items-center space-x-2 text-neutral-300 cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={filters.punchHoleCleanup}
            onChange={(e) => onChange({ punchHoleCleanup: e.target.checked })}
            className="rounded accent-sky-500"
          />
          <span>Clean Punch Holes & Margin Binder Shadows</span>
        </label>
      </div>

      {/* Color Mode & Binarization */}
      <div className="space-y-3 pt-2 border-t border-neutral-800/80">
        <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 font-bold">
          Color Modes & Binarization
        </span>

        <div className="grid grid-cols-3 gap-1.5">
          {(["color", "magic-color", "grayscale", "monochrome", "eco", "sauvola"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => onChange({ colorMode: mode })}
              className={`px-2 py-1.5 rounded text-[11px] font-medium border capitalize transition-colors ${
                filters.colorMode === mode
                  ? "bg-sky-600 text-white border-sky-500 font-bold shadow-sm"
                  : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white"
              }`}
            >
              {mode.replace("-", " ")}
            </button>
          ))}
        </div>

        {/* Binarization Threshold for Monochrome / Eco / Sauvola */}
        {(filters.colorMode === "monochrome" || filters.colorMode === "eco" || filters.colorMode === "sauvola") && (
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-neutral-300 select-none">
              <span>Binarization Threshold</span>
              <button
                type="button"
                onClick={() => onChange({ binarizationThreshold: 128 })}
                className="text-[9px] text-neutral-500 hover:text-sky-400 font-mono transition-colors cursor-pointer"
              >
                reset (128)
              </button>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="range"
                min="60"
                max="220"
                value={filters.binarizationThreshold}
                onChange={(e) => onChange({ binarizationThreshold: parseInt(e.target.value, 10) })}
                className="flex-1 accent-sky-500 bg-neutral-800 h-1.5 rounded cursor-pointer"
              />
              <PdfFilterNumericInput
                id="filter-studio-binarize"
                value={filters.binarizationThreshold}
                min={60}
                max={220}
                step={1}
                precision={0}
                onChange={(val) => onChange({ binarizationThreshold: val })}
                ariaLabel="Binarization threshold"
              />
            </div>
          </div>
        )}

        {/* Invert */}
        <label className="flex items-center space-x-2 text-neutral-300 cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={filters.invert}
            onChange={(e) => onChange({ invert: e.target.checked })}
            className="rounded accent-sky-500"
          />
          <span>Invert Colors (Negative Film / Dark Mode)</span>
        </label>
      </div>
    </div>
  );
};
