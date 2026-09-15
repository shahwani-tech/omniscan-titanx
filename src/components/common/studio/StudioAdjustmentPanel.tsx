import React from "react";
import {
  Wand2,
  RotateCcw,
  Sun,
  Contrast,
  Zap,
  Compass,
  Sparkles,
  Copy,
  Sliders,
  Palette,
} from "lucide-react";
import { UniversalNumericInput } from "../UniversalNumericInput";
import { ImageFilterPipeline } from "../../../types";
import { ContentClassificationResult } from "../../../engine/autoClassifier";

export interface StudioAdjustmentPanelProps {
  filters: ImageFilterPipeline;
  onChange: (updated: Partial<ImageFilterPipeline>, isCommit?: boolean) => void;
  onReset: () => void;
  title?: string;
  scope?: "current" | "both" | "all";
  onScopeChange?: (scope: "current" | "both" | "all") => void;
  activeSide?: "front" | "back";
  onActiveSideChange?: (side: "front" | "back") => void;
  onApplyToBothSides?: () => void;
  detectedContent?: Partial<ContentClassificationResult> | null;
  filterSource?: "auto-detected" | "user-override";
  onReDetect?: () => void;
  showScopeSelector?: boolean;
  showPresets?: boolean;
  compact?: boolean;
  className?: string;
}

const PRESET_FILTERS = [
  {
    id: "original",
    label: "Original",
    values: { brightness: 0, contrast: 0, gamma: 1.0, sharpness: 0, deskewAngle: 0 },
  },
  {
    id: "magic-color",
    label: "Magic Color",
    values: { brightness: 14, contrast: 28, gamma: 1.05, sharpness: 25 },
  },
  {
    id: "crisp-doc",
    label: "Crisp Doc",
    values: { brightness: 22, contrast: 34, gamma: 1.1, sharpness: 30 },
  },
  {
    id: "grayscale",
    label: "Grayscale",
    values: { brightness: 8, contrast: 22, gamma: 1.0, sharpness: 18 },
  },
  {
    id: "high-contrast",
    label: "High Contrast",
    values: { brightness: 16, contrast: 48, gamma: 1.15, sharpness: 35 },
  },
];

export const StudioAdjustmentPanel: React.FC<StudioAdjustmentPanelProps> = ({
  filters,
  onChange,
  onReset,
  title = "Filters & Image Adjustments",
  scope = "current",
  onScopeChange,
  activeSide = "front",
  onActiveSideChange,
  onApplyToBothSides,
  detectedContent,
  filterSource,
  onReDetect,
  showScopeSelector = true,
  showPresets = true,
  compact = false,
  className = "",
}) => {
  const handleNumericChange = (key: keyof ImageFilterPipeline, val: number, isCommit: boolean) => {
    onChange({ [key]: val } as Partial<ImageFilterPipeline>, isCommit);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header with Title and Reset */}
      <div className="flex items-center justify-between">
        <span className="font-bold text-neutral-200 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
          <Wand2 className="w-3.5 h-3.5 text-sky-400" />
          <span>{title}</span>
        </span>
        <button
          type="button"
          onClick={onReset}
          className="text-[10px] text-neutral-400 hover:text-white flex items-center space-x-1 px-1.5 py-0.5 rounded hover:bg-neutral-800 transition-colors"
          title="Reset adjustments to zero"
        >
          <RotateCcw className="w-2.5 h-2.5" />
          <span>Reset</span>
        </button>
      </div>

      {/* Scope: Apply To */}
      {showScopeSelector && onScopeChange && (
        <div className="space-y-1">
          <label className="block text-[10px] font-medium text-neutral-400">
            Apply To
          </label>
          <div className="grid grid-cols-3 gap-1 bg-neutral-950 p-0.5 rounded-lg border border-neutral-800 text-[10px]">
            <button
              type="button"
              onClick={() => onScopeChange("current")}
              className={`py-1 rounded font-medium text-center transition-colors ${
                scope === "current"
                  ? "bg-sky-600 text-white shadow-sm font-semibold"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Current Side
            </button>
            <button
              type="button"
              onClick={() => onScopeChange("both")}
              className={`py-1 rounded font-medium text-center transition-colors ${
                scope === "both"
                  ? "bg-sky-600 text-white shadow-sm font-semibold"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Both Sides
            </button>
            <button
              type="button"
              onClick={() => onScopeChange("all")}
              className={`py-1 rounded font-medium text-center transition-colors ${
                scope === "all"
                  ? "bg-sky-600 text-white shadow-sm font-semibold"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              All Pages
            </button>
          </div>
        </div>
      )}

      {/* Side Switcher (when scope === "current") */}
      {showScopeSelector && scope === "current" && onActiveSideChange && (
        <div className="flex items-center space-x-1 bg-neutral-900/90 p-1 rounded-md border border-neutral-800">
          <span className="text-[10px] text-neutral-400 pl-1">Side:</span>
          <button
            type="button"
            onClick={() => onActiveSideChange("front")}
            className={`flex-1 py-0.5 px-2 rounded text-[10px] font-medium transition-all ${
              activeSide === "front"
                ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                : "text-neutral-400 hover:text-white border border-transparent"
            }`}
          >
            Front Card
          </button>
          <button
            type="button"
            onClick={() => onActiveSideChange("back")}
            className={`flex-1 py-0.5 px-2 rounded text-[10px] font-medium transition-all ${
              activeSide === "back"
                ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40"
                : "text-neutral-400 hover:text-white border border-transparent"
            }`}
          >
            Back Card
          </button>
        </div>
      )}

      {/* Optical Auto-Detection Status */}
      {detectedContent && (
        <div className="p-2 rounded-md bg-neutral-950 border border-neutral-800/80 space-y-1">
          <div className="flex items-center justify-between text-[10px]">
            <div className="flex items-center space-x-1.5">
              <span className="px-1.5 py-0.5 rounded font-bold uppercase tracking-wider text-[9px] bg-sky-950 text-sky-300 border border-sky-600/40">
                {detectedContent.label}
              </span>
              <span className="text-neutral-400">
                {filterSource === "auto-detected" ? "✨ Auto filter" : "Manual override"}
              </span>
            </div>
            {onReDetect && (
              <button
                type="button"
                onClick={onReDetect}
                className="text-sky-400 hover:text-sky-300 underline underline-offset-2"
              >
                Re-detect
              </button>
            )}
          </div>
          {detectedContent.reason && (
            <div className="text-[9px] text-neutral-500">{detectedContent.reason}</div>
          )}
        </div>
      )}

      {/* Prominent Action: Apply Settings to Both Sides */}
      {onApplyToBothSides && (
        <button
          type="button"
          onClick={onApplyToBothSides}
          className="w-full flex items-center justify-center space-x-1.5 py-1.5 px-2 rounded-md bg-sky-950/70 hover:bg-sky-900 border border-sky-600/40 hover:border-sky-500/60 text-sky-200 text-[11px] font-medium transition-all shadow-sm"
          title="Copy current adjustments to the opposite side"
        >
          <Copy className="w-3.5 h-3.5 text-sky-400" />
          <span>Apply {activeSide === "front" ? "Front" : "Back"} Settings to Both Sides</span>
        </button>
      )}

      {/* Presets Strip */}
      {showPresets && (
        <div className="space-y-1">
          <label className="block text-[10px] font-medium text-neutral-400">Presets</label>
          <div className="grid grid-cols-3 gap-1">
            {PRESET_FILTERS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onChange(preset.values as Partial<ImageFilterPipeline>, true)}
                className="py-1 px-1.5 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-neutral-300 rounded text-[10px] text-center font-medium transition-colors truncate"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Granular Adjustment Sliders */}
      <div className="space-y-2.5 pt-1">
        {/* Brightness */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] h-4 select-none">
            <span className="text-neutral-400 flex items-center space-x-1">
              <Sun className="w-3 h-3 text-amber-400" />
              <span>Brightness</span>
            </span>
            <button
              type="button"
              onClick={() => handleNumericChange("brightness", 0, true)}
              className="text-[9px] text-neutral-500 hover:text-sky-400 font-mono transition-colors"
              title="Reset Brightness"
            >
              reset (0)
            </button>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="range"
              min="-100"
              max="100"
              step="1"
              value={filters.brightness ?? 0}
              onChange={(e) =>
                handleNumericChange("brightness", parseInt(e.target.value, 10), false)
              }
              onMouseUp={(e) =>
                handleNumericChange(
                  "brightness",
                  parseInt((e.target as HTMLInputElement).value, 10),
                  true
                )
              }
              className="flex-1 h-1.5 bg-neutral-800 accent-sky-500 rounded cursor-pointer"
            />
            <UniversalNumericInput
              id="studio-adj-brightness"
              value={filters.brightness ?? 0}
              min={-100}
              max={100}
              step={1}
              precision={0}
              onChange={(val, isCommit) => handleNumericChange("brightness", val, isCommit)}
              className="w-14"
            />
          </div>
        </div>

        {/* Contrast */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] h-4 select-none">
            <span className="text-neutral-400 flex items-center space-x-1">
              <Contrast className="w-3 h-3 text-sky-400" />
              <span>Contrast</span>
            </span>
            <button
              type="button"
              onClick={() => handleNumericChange("contrast", 0, true)}
              className="text-[9px] text-neutral-500 hover:text-sky-400 font-mono transition-colors"
              title="Reset Contrast"
            >
              reset (0)
            </button>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="range"
              min="-100"
              max="100"
              step="1"
              value={filters.contrast ?? 0}
              onChange={(e) =>
                handleNumericChange("contrast", parseInt(e.target.value, 10), false)
              }
              onMouseUp={(e) =>
                handleNumericChange(
                  "contrast",
                  parseInt((e.target as HTMLInputElement).value, 10),
                  true
                )
              }
              className="flex-1 h-1.5 bg-neutral-800 accent-sky-500 rounded cursor-pointer"
            />
            <UniversalNumericInput
              id="studio-adj-contrast"
              value={filters.contrast ?? 0}
              min={-100}
              max={100}
              step={1}
              precision={0}
              onChange={(val, isCommit) => handleNumericChange("contrast", val, isCommit)}
              className="w-14"
            />
          </div>
        </div>

        {/* Gamma / Exposure */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] h-4 select-none">
            <span className="text-neutral-400 flex items-center space-x-1">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              <span>Gamma Curve</span>
            </span>
            <button
              type="button"
              onClick={() => handleNumericChange("gamma", 1.0, true)}
              className="text-[9px] text-neutral-500 hover:text-sky-400 font-mono transition-colors"
              title="Reset Gamma"
            >
              reset (1.00)
            </button>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="range"
              min="0.2"
              max="3.0"
              step="0.05"
              value={filters.gamma ?? 1.0}
              onChange={(e) =>
                handleNumericChange("gamma", parseFloat(e.target.value), false)
              }
              onMouseUp={(e) =>
                handleNumericChange(
                  "gamma",
                  parseFloat((e.target as HTMLInputElement).value),
                  true
                )
              }
              className="flex-1 h-1.5 bg-neutral-800 accent-sky-500 rounded cursor-pointer"
            />
            <UniversalNumericInput
              id="studio-adj-gamma"
              value={filters.gamma ?? 1.0}
              min={0.2}
              max={3.0}
              step={0.05}
              precision={2}
              onChange={(val, isCommit) => handleNumericChange("gamma", val, isCommit)}
              className="w-14"
            />
          </div>
        </div>

        {/* Sharpness / Unsharp Mask */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] h-4 select-none">
            <span className="text-neutral-400 flex items-center space-x-1">
              <Zap className="w-3 h-3 text-amber-300" />
              <span>Sharpness</span>
            </span>
            <button
              type="button"
              onClick={() => handleNumericChange("sharpness", 0, true)}
              className="text-[9px] text-neutral-500 hover:text-sky-400 font-mono transition-colors"
              title="Reset Sharpness"
            >
              reset (0)
            </button>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={filters.sharpness ?? 0}
              onChange={(e) =>
                handleNumericChange("sharpness", parseInt(e.target.value, 10), false)
              }
              onMouseUp={(e) =>
                handleNumericChange(
                  "sharpness",
                  parseInt((e.target as HTMLInputElement).value, 10),
                  true
                )
              }
              className="flex-1 h-1.5 bg-neutral-800 accent-sky-500 rounded cursor-pointer"
            />
            <UniversalNumericInput
              id="studio-adj-sharpness"
              value={filters.sharpness ?? 0}
              min={0}
              max={100}
              step={1}
              precision={0}
              onChange={(val, isCommit) => handleNumericChange("sharpness", val, isCommit)}
              className="w-14"
            />
          </div>
        </div>

        {/* Fine Deskew */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] h-4 select-none">
            <span className="text-neutral-400 flex items-center space-x-1">
              <Compass className="w-3 h-3 text-emerald-400" />
              <span>Fine Deskew</span>
            </span>
            <button
              type="button"
              onClick={() => handleNumericChange("deskewAngle", 0, true)}
              className="text-[9px] text-neutral-500 hover:text-sky-400 font-mono transition-colors"
              title="Reset Deskew"
            >
              reset (0.0°)
            </button>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="range"
              min="-15"
              max="15"
              step="0.1"
              value={filters.deskewAngle ?? 0}
              onChange={(e) =>
                handleNumericChange("deskewAngle", parseFloat(e.target.value), false)
              }
              onMouseUp={(e) =>
                handleNumericChange(
                  "deskewAngle",
                  parseFloat((e.target as HTMLInputElement).value),
                  true
                )
              }
              className="flex-1 h-1.5 bg-neutral-800 accent-sky-500 rounded cursor-pointer"
            />
            <UniversalNumericInput
              id="studio-adj-deskew"
              value={filters.deskewAngle ?? 0}
              min={-15}
              max={15}
              step={0.1}
              precision={1}
              unit="°"
              onChange={(val, isCommit) => handleNumericChange("deskewAngle", val, isCommit)}
              className="w-14"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
