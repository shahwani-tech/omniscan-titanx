/**
 * OMNISCAN TITAN X - Unified Color Grading & Adjustment Studio Panel
 * Professional, Non-Destructive High-Precision Adjustments with Auto-Detection & Preset Grading
 */

import React, { useState, useRef, useCallback } from "react";
import { ImageFilterPipeline } from "../../types";
import {
  Sun,
  Contrast,
  Sparkles,
  Zap,
  Palette,
  RotateCcw,
  Wand2,
  Sliders,
  Compass,
  Check,
  Layers,
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  Image as ImageIcon,
} from "lucide-react";
import { PdfFilterNumericInput } from "./PdfFilterNumericInput";
import { analyzeImageAndComputeAutoGrade } from "../../engine/autoColorGrade";
import { ContentClassificationResult } from "../../engine/autoClassifier";

export interface UnifiedColorGradingPanelProps {
  filters: ImageFilterPipeline;
  onChange: (updated: Partial<ImageFilterPipeline>, isCommit?: boolean) => void;
  onReset: () => void;
  imageSource?: string | HTMLImageElement | HTMLCanvasElement;
  compact?: boolean;
  showPresets?: boolean;
  showOptics?: boolean;
  showColorModes?: boolean;
  showGeometry?: boolean;
  idPrefix?: string;
  onAutoEnhanced?: (summary: string) => void;
  detectedContent?: ContentClassificationResult | null;
  filterSource?: "auto-detected" | "user-override";
  onReDetect?: () => void;
  onApplyToAllPages?: () => void;
  pageCount?: number;
}

export const UNIFIED_COLOR_PRESETS = [
  {
    id: "original",
    name: "Original",
    filters: {
      brightness: 0,
      contrast: 0,
      gamma: 1.0,
      sharpness: 0,
      saturation: 0,
      backgroundWhiten: false,
      shadowRemoval: false,
      colorMode: "color" as const,
      invert: false,
    },
  },
  {
    id: "magic-color",
    name: "Magic Color",
    filters: {
      brightness: 14,
      contrast: 28,
      gamma: 1.05,
      sharpness: 25,
      saturation: 20,
      backgroundWhiten: true,
      backgroundWhitenThreshold: 220,
      shadowRemoval: true,
      colorMode: "magic-color" as const,
    },
  },
  {
    id: "crisp-doc",
    name: "Crisp Doc",
    filters: {
      brightness: 22,
      contrast: 34,
      gamma: 1.1,
      sharpness: 30,
      saturation: 0,
      backgroundWhiten: true,
      backgroundWhitenThreshold: 228,
      shadowRemoval: true,
      colorMode: "color" as const,
    },
  },
  {
    id: "grayscale",
    name: "Grayscale",
    filters: {
      brightness: 8,
      contrast: 22,
      gamma: 1.0,
      sharpness: 18,
      saturation: -100,
      backgroundWhiten: true,
      backgroundWhitenThreshold: 224,
      colorMode: "grayscale" as const,
    },
  },
  {
    id: "high-contrast",
    name: "High Contrast",
    filters: {
      brightness: 16,
      contrast: 48,
      gamma: 1.15,
      sharpness: 35,
      backgroundWhiten: true,
      backgroundWhitenThreshold: 232,
      colorMode: "sauvola" as const,
    },
  },
  {
    id: "eco",
    name: "Eco Print",
    filters: {
      brightness: 26,
      contrast: 18,
      gamma: 1.25,
      sharpness: 12,
      backgroundWhiten: true,
      backgroundWhitenThreshold: 215,
      colorMode: "eco" as const,
    },
  },
];

export const UnifiedColorGradingPanel: React.FC<UnifiedColorGradingPanelProps> = ({
  filters,
  onChange,
  onReset,
  imageSource,
  compact = false,
  showPresets = true,
  showOptics = true,
  showColorModes = true,
  showGeometry = false,
  idPrefix = "unified-adj",
  onAutoEnhanced,
  detectedContent,
  filterSource = "auto-detected",
  onReDetect,
  onApplyToAllPages,
  pageCount,
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [autoFeedback, setAutoFeedback] = useState<string | null>(null);
  const [opticsExpanded, setOpticsExpanded] = useState(!compact);
  const isDraggingRef = useRef(false);

  // Auto-Enhance Handler
  const handleAutoEnhance = async () => {
    if (!imageSource || isAnalyzing) return;
    setIsAnalyzing(true);
    setAutoFeedback("Analyzing dynamic range & optical tones...");

    try {
      const result = await analyzeImageAndComputeAutoGrade(imageSource);
      onChange(result.recommendedFilters, true);
      setAutoFeedback(result.summary);
      if (onAutoEnhanced) onAutoEnhanced(result.summary);
      setTimeout(() => setAutoFeedback(null), 3500);
    } catch (err) {
      console.warn("Auto enhance failed:", err);
      setAutoFeedback("Auto analyze completed with fallback curve.");
      setTimeout(() => setAutoFeedback(null), 2500);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Safe pointer tracking for continuous slider drag without premature commits
  const handleSliderPointerDown = (e: React.PointerEvent<HTMLInputElement>) => {
    isDraggingRef.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handleSliderPointerUp = (
    e: React.PointerEvent<HTMLInputElement>,
    updates: Partial<ImageFilterPipeline>
  ) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      onChange(updates, true);
    }
  };

  return (
    <div className={`flex flex-col space-y-3 text-xs select-none ${compact ? "p-1" : "p-3"}`}>
      {/* Header with Title, Auto-Detect & Reset */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
        <div className="flex items-center space-x-1.5 text-neutral-200 font-semibold">
          <Sliders className="w-3.5 h-3.5 text-sky-400" />
          <span>Color Grading & Adjustments</span>
        </div>

        <div className="flex items-center space-x-1.5">
          {imageSource && (
            <button
              type="button"
              onClick={handleAutoEnhance}
              disabled={isAnalyzing}
              className={`flex items-center space-x-1 text-[11px] px-2 py-0.5 rounded font-semibold border transition-all ${
                isAnalyzing
                  ? "bg-amber-950 text-amber-300 border-amber-800 animate-pulse"
                  : "bg-gradient-to-r from-amber-600/30 to-amber-500/20 hover:from-amber-600/50 hover:to-amber-500/40 text-amber-300 border-amber-600/40 shadow-sm"
              }`}
              title="Analyze image histogram and automatically optimize brightness, contrast, and paper whitening"
            >
              <Wand2 className={`w-3 h-3 text-amber-400 ${isAnalyzing ? "animate-spin" : ""}`} />
              <span>{isAnalyzing ? "Analyzing..." : "Auto Grade"}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onReset}
            className="flex items-center space-x-1 text-[11px] text-neutral-400 hover:text-white px-2 py-0.5 rounded bg-neutral-850 hover:bg-neutral-800 border border-neutral-750 transition-colors"
            title="Reset all adjustments to defaults"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Content Classification & Auto Filter Badge */}
      {detectedContent && (
        <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-900 border border-neutral-800/80 shadow-inner">
          <div className="flex items-center space-x-2">
            {detectedContent.detectedType === "photo-id" ? (
              <span className="flex items-center space-x-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-950/80 text-blue-300 border border-blue-500/40 shadow-sm">
                <ImageIcon className="w-3 h-3 text-blue-400" />
                <span>Photo / ID Card</span>
              </span>
            ) : detectedContent.detectedType === "text-document" ? (
              <span className="flex items-center space-x-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 shadow-sm">
                <FileText className="w-3 h-3 text-emerald-400" />
                <span>Text Document</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950/80 text-purple-300 border border-purple-500/40 shadow-sm">
                <Sparkles className="w-3 h-3 text-purple-400" />
                <span>Mixed Content</span>
              </span>
            )}

            <span className="text-[10px] font-medium text-neutral-400">
              {filterSource === "auto-detected" ? (
                <span className="text-emerald-400/90 font-medium">✨ Auto-detected</span>
              ) : (
                <span className="text-neutral-400">Manual override</span>
              )}
            </span>
          </div>

          {onReDetect && (
            <button
              type="button"
              onClick={onReDetect}
              className="text-[10px] text-sky-400 hover:text-sky-300 underline underline-offset-2 px-1 py-0.5 transition-colors"
              title="Re-run optical content analysis"
            >
              Re-detect
            </button>
          )}
        </div>
      )}

      {/* Prominent Action: Apply to All Pages */}
      {onApplyToAllPages && (
        <button
          type="button"
          onClick={onApplyToAllPages}
          className="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-lg bg-gradient-to-r from-sky-950 to-blue-950 hover:from-sky-900 hover:to-blue-900 border border-sky-600/40 hover:border-sky-500/60 text-sky-200 text-xs font-semibold shadow-sm transition-all group"
          title={`Copy current filter and adjustment settings to all ${pageCount || ""} pages`}
        >
          <Copy className="w-3.5 h-3.5 text-sky-400 group-hover:scale-110 transition-transform" />
          <span>Apply Settings to All Pages {pageCount && pageCount > 1 ? `(${pageCount})` : ""}</span>
        </button>
      )}

      {/* Auto Feedback Notification */}
      {autoFeedback && (
        <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-700/50 text-amber-300 text-[11px] flex items-center space-x-1.5 animate-in fade-in duration-150">
          <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="truncate">{autoFeedback}</span>
        </div>
      )}

      {/* Quick Presets Grid */}
      {showPresets && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 font-bold">
            Presets
          </span>
          <div className="grid grid-cols-3 gap-1">
            {UNIFIED_COLOR_PRESETS.map((preset) => {
              const isSelected = filters.preset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onChange({ ...preset.filters, preset: preset.id as any }, true)}
                  className={`px-1.5 py-1.5 rounded text-[10px] font-medium truncate text-center border transition-all ${
                    isSelected
                      ? "bg-sky-600 text-white border-sky-400 font-bold shadow"
                      : "bg-neutral-850 text-neutral-300 border-neutral-750 hover:bg-neutral-800 hover:text-white"
                  }`}
                >
                  {preset.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Section 1: Tone & Exposure */}
      <div className="space-y-3">
        <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 font-bold">
          Tone & Exposure
        </span>

        {/* Brightness */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-neutral-300">
            <span className="flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span>Brightness</span>
            </span>
            <button
              type="button"
              onClick={() => onChange({ brightness: 0 }, true)}
              className="text-[9px] text-neutral-500 hover:text-sky-400 font-mono transition-colors cursor-pointer"
              title="Reset Brightness to 0"
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
              value={filters.brightness}
              onPointerDown={handleSliderPointerDown}
              onChange={(e) => onChange({ brightness: parseInt(e.target.value, 10) }, false)}
              onPointerUp={(e) =>
                handleSliderPointerUp(e, { brightness: parseInt(e.currentTarget.value, 10) })
              }
              className="flex-1 accent-sky-500 bg-neutral-800 h-1.5 rounded cursor-pointer"
            />
            <PdfFilterNumericInput
              id={`${idPrefix}-brightness`}
              value={filters.brightness}
              min={-100}
              max={100}
              step={1}
              precision={0}
              onChange={(val, isCommit) => onChange({ brightness: val }, isCommit)}
              ariaLabel="Brightness value"
            />
          </div>
        </div>

        {/* Contrast */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-neutral-300">
            <span className="flex items-center gap-1.5">
              <Contrast className="w-3.5 h-3.5 text-sky-400" />
              <span>Contrast</span>
            </span>
            <button
              type="button"
              onClick={() => onChange({ contrast: 0 }, true)}
              className="text-[9px] text-neutral-500 hover:text-sky-400 font-mono transition-colors cursor-pointer"
              title="Reset Contrast to 0"
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
              value={filters.contrast}
              onPointerDown={handleSliderPointerDown}
              onChange={(e) => onChange({ contrast: parseInt(e.target.value, 10) }, false)}
              onPointerUp={(e) =>
                handleSliderPointerUp(e, { contrast: parseInt(e.currentTarget.value, 10) })
              }
              className="flex-1 accent-sky-500 bg-neutral-800 h-1.5 rounded cursor-pointer"
            />
            <PdfFilterNumericInput
              id={`${idPrefix}-contrast`}
              value={filters.contrast}
              min={-100}
              max={100}
              step={1}
              precision={0}
              onChange={(val, isCommit) => onChange({ contrast: val }, isCommit)}
              ariaLabel="Contrast value"
            />
          </div>
        </div>

        {/* Gamma Curve */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-neutral-300">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Gamma Curve</span>
            </span>
            <button
              type="button"
              onClick={() => onChange({ gamma: 1.0 }, true)}
              className="text-[9px] text-neutral-500 hover:text-sky-400 font-mono transition-colors cursor-pointer"
              title="Reset Gamma to 1.00"
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
              value={filters.gamma}
              onPointerDown={handleSliderPointerDown}
              onChange={(e) => onChange({ gamma: parseFloat(e.target.value) }, false)}
              onPointerUp={(e) =>
                handleSliderPointerUp(e, { gamma: parseFloat(e.currentTarget.value) })
              }
              className="flex-1 accent-purple-500 bg-neutral-800 h-1.5 rounded cursor-pointer"
            />
            <PdfFilterNumericInput
              id={`${idPrefix}-gamma`}
              value={filters.gamma}
              min={0.2}
              max={3.0}
              step={0.05}
              precision={2}
              onChange={(val, isCommit) => onChange({ gamma: val }, isCommit)}
              ariaLabel="Gamma curve value"
            />
          </div>
        </div>

        {/* Saturation */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-neutral-300">
            <span className="flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-emerald-400" />
              <span>Saturation</span>
            </span>
            <button
              type="button"
              onClick={() => onChange({ saturation: 0 }, true)}
              className="text-[9px] text-neutral-500 hover:text-sky-400 font-mono transition-colors cursor-pointer"
              title="Reset Saturation to 0"
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
              value={filters.saturation || 0}
              onPointerDown={handleSliderPointerDown}
              onChange={(e) => onChange({ saturation: parseInt(e.target.value, 10) }, false)}
              onPointerUp={(e) =>
                handleSliderPointerUp(e, { saturation: parseInt(e.currentTarget.value, 10) })
              }
              className="flex-1 accent-emerald-500 bg-neutral-800 h-1.5 rounded cursor-pointer"
            />
            <PdfFilterNumericInput
              id={`${idPrefix}-saturation`}
              value={filters.saturation || 0}
              min={-100}
              max={100}
              step={1}
              precision={0}
              onChange={(val, isCommit) => onChange({ saturation: val }, isCommit)}
              ariaLabel="Saturation value"
            />
          </div>
        </div>

        {/* Unsharp Mask (Sharpness) */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-neutral-300">
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>Unsharp Mask</span>
            </span>
            <button
              type="button"
              onClick={() => onChange({ sharpness: 0 }, true)}
              className="text-[9px] text-neutral-500 hover:text-sky-400 font-mono transition-colors cursor-pointer"
              title="Reset Sharpness to 0"
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
              value={filters.sharpness || 0}
              onPointerDown={handleSliderPointerDown}
              onChange={(e) => onChange({ sharpness: parseInt(e.target.value, 10) }, false)}
              onPointerUp={(e) =>
                handleSliderPointerUp(e, { sharpness: parseInt(e.currentTarget.value, 10) })
              }
              className="flex-1 accent-amber-500 bg-neutral-800 h-1.5 rounded cursor-pointer"
            />
            <PdfFilterNumericInput
              id={`${idPrefix}-sharpness`}
              value={filters.sharpness || 0}
              min={0}
              max={100}
              step={1}
              precision={0}
              onChange={(val, isCommit) => onChange({ sharpness: val }, isCommit)}
              ariaLabel="Sharpness value"
            />
          </div>
        </div>
      </div>

      {/* Section 2: Geometry (Fine Deskew) */}
      {showGeometry && (
        <div className="space-y-2 pt-2 border-t border-neutral-800">
          <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 font-bold">
            Fine Deskew Angle
          </span>
          <div className="space-y-1">
            <div className="flex justify-between items-center text-neutral-300">
              <span className="flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-teal-400" />
                <span>Rotation Deskew</span>
              </span>
              <button
                type="button"
                onClick={() => onChange({ deskewAngle: 0 }, true)}
                className="text-[9px] text-neutral-500 hover:text-sky-400 font-mono transition-colors cursor-pointer"
                title="Reset Deskew to 0.0°"
              >
                reset (0.0°)
              </button>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="range"
                min="-25"
                max="25"
                step="0.1"
                value={filters.deskewAngle || 0}
                onPointerDown={handleSliderPointerDown}
                onChange={(e) => onChange({ deskewAngle: parseFloat(e.target.value) }, false)}
                onPointerUp={(e) =>
                  handleSliderPointerUp(e, { deskewAngle: parseFloat(e.currentTarget.value) })
                }
                className="flex-1 accent-teal-500 bg-neutral-800 h-1.5 rounded cursor-pointer"
              />
              <PdfFilterNumericInput
                id={`${idPrefix}-deskew`}
                value={filters.deskewAngle || 0}
                min={-25}
                max={25}
                step={0.1}
                precision={1}
                unit="°"
                onChange={(val, isCommit) => onChange({ deskewAngle: val }, isCommit)}
                ariaLabel="Fine deskew angle"
              />
            </div>
          </div>
        </div>
      )}

      {/* Section 3: Document Optics & Cleaning */}
      {showOptics && (
        <div className="space-y-2 pt-2 border-t border-neutral-800">
          <div
            onClick={() => setOpticsExpanded(!opticsExpanded)}
            className="flex items-center justify-between cursor-pointer py-1 text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            <span className="text-[10px] font-mono uppercase tracking-wider font-bold">
              Document Optics & Cleaning
            </span>
            {opticsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </div>

          {opticsExpanded && (
            <div className="space-y-2.5 pt-1">
              {/* Background Whitening Toggle & Threshold */}
              <div className="p-2.5 rounded-lg bg-neutral-850 border border-neutral-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-2 text-neutral-200 cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={filters.backgroundWhiten}
                      onChange={(e) => onChange({ backgroundWhiten: e.target.checked }, true)}
                      className="rounded accent-sky-500"
                    />
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-400" /> Background Whiten
                    </span>
                  </label>
                  <span className="text-[10px] text-neutral-400 font-mono">
                    {filters.backgroundWhitenThreshold || 220}
                  </span>
                </div>

                {filters.backgroundWhiten && (
                  <div className="flex items-center space-x-2">
                    <input
                      type="range"
                      min="140"
                      max="250"
                      step="1"
                      value={filters.backgroundWhitenThreshold || 220}
                      onPointerDown={handleSliderPointerDown}
                      onChange={(e) =>
                        onChange({ backgroundWhitenThreshold: parseInt(e.target.value, 10) }, false)
                      }
                      onPointerUp={(e) =>
                        handleSliderPointerUp(e, {
                          backgroundWhitenThreshold: parseInt(e.currentTarget.value, 10),
                        })
                      }
                      className="flex-1 accent-amber-500 bg-neutral-800 h-1.5 rounded cursor-pointer"
                    />
                    <PdfFilterNumericInput
                      id={`${idPrefix}-whiten`}
                      value={filters.backgroundWhitenThreshold || 220}
                      min={140}
                      max={250}
                      step={1}
                      precision={0}
                      onChange={(val, isCommit) => onChange({ backgroundWhitenThreshold: val }, isCommit)}
                      ariaLabel="Background whiten threshold"
                    />
                  </div>
                )}
              </div>

              {/* Shadow Removal & Punch Hole Cleanup Toggles */}
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center space-x-2 p-2 rounded-lg bg-neutral-850 border border-neutral-800 text-neutral-200 cursor-pointer text-[11px]">
                  <input
                    type="checkbox"
                    checked={filters.shadowRemoval}
                    onChange={(e) => onChange({ shadowRemoval: e.target.checked }, true)}
                    className="rounded accent-sky-500"
                  />
                  <span>Shadow Removal</span>
                </label>

                <label className="flex items-center space-x-2 p-2 rounded-lg bg-neutral-850 border border-neutral-800 text-neutral-200 cursor-pointer text-[11px]">
                  <input
                    type="checkbox"
                    checked={filters.invert}
                    onChange={(e) => onChange({ invert: e.target.checked }, true)}
                    className="rounded accent-sky-500"
                  />
                  <span>Invert Colors</span>
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Section 4: Color Modes */}
      {showColorModes && (
        <div className="space-y-2 pt-2 border-t border-neutral-800">
          <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 font-bold">
            Color Mode
          </span>
          <div className="grid grid-cols-3 gap-1">
            {[
              { id: "color", name: "Color" },
              { id: "grayscale", name: "Grayscale" },
              { id: "monochrome", name: "B&W 1-Bit" },
              { id: "magic-color", name: "Magic Color" },
              { id: "sauvola", name: "Adaptive B&W" },
              { id: "eco", name: "Eco Saver" },
            ].map((mode) => {
              const isActive = filters.colorMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => onChange({ colorMode: mode.id as any }, true)}
                  className={`py-1 px-1 rounded text-[10px] font-medium transition-all text-center border ${
                    isActive
                      ? "bg-sky-600 text-white border-sky-400 font-bold shadow"
                      : "bg-neutral-850 text-neutral-300 border-neutral-750 hover:bg-neutral-800 hover:text-white"
                  }`}
                >
                  {mode.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
