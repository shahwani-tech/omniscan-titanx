import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Sliders,
  Sun,
  Contrast,
  Sparkles,
  Zap,
  Palette,
  RotateCcw,
  Wand2,
  Compass,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileText,
  Image as ImageIcon,
  RotateCw,
  SunDim,
  Moon,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { ImageFilterPipeline, CamScannerPresetId } from "../../types";
import { OmniAdjustmentSlider } from "./OmniAdjustmentSlider";
import { OmniAdjustmentHistogram } from "./OmniAdjustmentHistogram";
import { analyzeImageAndComputeAutoGrade } from "../../engine/autoColorGrade";
import { diagnoseDocumentDefects, buildAdaptivePlan } from "../../engine/autoProcessor";
import { ContentClassificationResult } from "../../engine/autoClassifier";

export interface AdjustmentPresetItem {
  id: string;
  name: string;
  filters: Partial<ImageFilterPipeline>;
}

export const DEFAULT_OMNI_PRESETS: AdjustmentPresetItem[] = [
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
      colorMode: "color",
      invert: false,
      deskewAngle: 0,
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
      colorMode: "magic-color",
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
      colorMode: "color",
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
      colorMode: "grayscale",
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
      colorMode: "sauvola",
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
      colorMode: "eco",
    },
  },
];

export interface OmniAdjustmentStudioPanelProps {
  // Current filter state & change handler
  filters: Partial<ImageFilterPipeline>;
  onChange: (updated: Partial<ImageFilterPipeline>, isCommit?: boolean) => void;
  onReset: () => void;

  // Optional image source for defect diagnosis, histogram & auto-grading
  imageSource?: string | HTMLImageElement | HTMLCanvasElement;

  // Layout & Docking
  isDocked?: boolean; // When true, mounts as an expandable resizable side panel
  dockPosition?: "left" | "right";
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  allowResize?: boolean;
  minWidth?: number;
  maxWidth?: number;
  defaultWidth?: number;
  storageKey?: string;

  // Configurable Sections & Controls
  title?: string;
  showAutoEnhance?: boolean;
  showResetAll?: boolean;
  showHistogram?: boolean;
  showPresets?: boolean;
  presets?: AdjustmentPresetItem[];

  sections?: {
    tone?: boolean; // Brightness, Contrast, Exposure, Gamma
    color?: boolean; // Saturation, Color Modes
    detail?: boolean; // Sharpness / Unsharp Mask, Denoise
    optics?: boolean; // Background whiten, Shadow removal, Invert
    alignment?: boolean; // Fine Deskew, Rotation
  };

  // Custom range constraints if tool requires custom limits (e.g. Passport vs Full PDF)
  ranges?: {
    brightness?: { min: number; max: number; step?: number };
    contrast?: { min: number; max: number; step?: number };
    gamma?: { min: number; max: number; step?: number };
    sharpness?: { min: number; max: number; step?: number };
    saturation?: { min: number; max: number; step?: number };
    deskewAngle?: { min: number; max: number; step?: number };
  };

  idPrefix?: string;
  detectedContent?: ContentClassificationResult | null;
  filterSource?: "auto-detected" | "user-override";
  onReDetect?: () => void;
  onApplyToAllPages?: () => void;
  pageCount?: number;
  onAutoEnhanced?: (summary: string) => void;

  // Custom extra slots
  extraHeaderActions?: React.ReactNode;
  extraFooterContent?: React.ReactNode;
  className?: string;
}

export const OmniAdjustmentStudioPanel: React.FC<OmniAdjustmentStudioPanelProps> = ({
  filters,
  onChange,
  onReset,
  imageSource,
  isDocked = false,
  dockPosition = "right",
  isCollapsed: controlledCollapsed,
  onToggleCollapse,
  allowResize = true,
  minWidth = 280,
  maxWidth = 480,
  defaultWidth = 340,
  storageKey = "omni_adjustment_panel_width",
  title = "Color Grading & Adjustments",
  showAutoEnhance = true,
  showResetAll = true,
  showHistogram = true,
  showPresets = true,
  presets = DEFAULT_OMNI_PRESETS,
  sections = {
    tone: true,
    color: true,
    detail: true,
    optics: true,
    alignment: false,
  },
  ranges = {},
  idPrefix = "omni-adj",
  detectedContent,
  filterSource = "auto-detected",
  onReDetect,
  onApplyToAllPages,
  pageCount,
  onAutoEnhanced,
  extraHeaderActions,
  extraFooterContent,
  className = "",
}) => {
  // Resizing state
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    if (typeof window === "undefined") return defaultWidth;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= minWidth && parsed <= maxWidth) {
          return parsed;
        }
      }
    } catch {}
    return defaultWidth;
  });

  const isResizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(panelWidth);

  // Internal collapse state if not externally controlled
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;
  const handleToggleCollapse = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed((prev) => !prev);
    }
  };

  // Collapsible section accordion states
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    tone: true,
    color: true,
    detail: true,
    optics: false,
    alignment: true,
  });

  const toggleSection = (sectionKey: string) => {
    setOpenSections((prev) => ({ ...prev, [sectionKey]: !prev[sectionKey] }));
  };

  // Auto-enhance analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [autoFeedback, setAutoFeedback] = useState<string | null>(null);

  // Compare original state
  const [isComparingOriginal, setIsComparingOriginal] = useState(false);
  const originalFiltersRef = useRef<Partial<ImageFilterPipeline> | null>(null);

  const handleToggleCompareOriginal = (active: boolean) => {
    setIsComparingOriginal(active);
    if (active) {
      originalFiltersRef.current = { ...filters };
      onChange(
        {
          brightness: 0,
          contrast: 0,
          gamma: 1.0,
          sharpness: 0,
          saturation: 0,
          backgroundWhiten: false,
          shadowRemoval: false,
        },
        false
      );
    } else if (originalFiltersRef.current) {
      onChange(originalFiltersRef.current, true);
      originalFiltersRef.current = null;
    }
  };

  // Auto-Enhance Execution
  const handleAutoEnhance = async () => {
    if (!imageSource || isAnalyzing) return;
    setIsAnalyzing(true);
    setAutoFeedback("Diagnosing document defects & lighting...");

    try {
      const { report } = await diagnoseDocumentDefects(imageSource);
      const plan = buildAdaptivePlan(report);
      onChange(plan.targetFilters, true);
      const summary = `${report.label}: ${plan.appliedCorrections.slice(0, 2).join("; ") || "Optimized"}`;
      setAutoFeedback(summary);
      if (onAutoEnhanced) onAutoEnhanced(summary);
      setTimeout(() => setAutoFeedback(null), 4000);
    } catch (err) {
      console.warn("Adaptive auto enhance fallback:", err);
      try {
        const result = await analyzeImageAndComputeAutoGrade(imageSource);
        onChange(result.recommendedFilters, true);
        setAutoFeedback(result.summary);
        if (onAutoEnhanced) onAutoEnhanced(result.summary);
        setTimeout(() => setAutoFeedback(null), 3500);
      } catch (fallbackErr) {
        setAutoFeedback("Auto analyze completed with fallback curve.");
        setTimeout(() => setAutoFeedback(null), 2500);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Resizing Drag Handlers (Left or Right dock edge)
  const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = panelWidth;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (!isResizingRef.current) return;
      const delta =
        dockPosition === "right"
          ? startXRef.current - moveEvent.clientX
          : moveEvent.clientX - startXRef.current;
      const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidthRef.current + delta));
      setPanelWidth(newWidth);
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        try {
          localStorage.setItem(storageKey, String(panelWidth));
        } catch {}
      }
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // Safe fallback values
  const brightness = filters.brightness ?? 0;
  const contrast = filters.contrast ?? 0;
  const gamma = filters.gamma ?? 1.0;
  const exposure = filters.exposure ?? 0;
  const saturation = filters.saturation ?? 0;
  const sharpness = filters.sharpness ?? 0;
  const deskewAngle = filters.deskewAngle ?? 0;
  const backgroundWhiten = Boolean(filters.backgroundWhiten);
  const backgroundWhitenThreshold = filters.backgroundWhitenThreshold ?? 220;
  const shadowRemoval = Boolean(filters.shadowRemoval);
  const invert = Boolean(filters.invert);
  const colorMode = filters.colorMode || "color";

  // If collapsed in docked mode, render sleek expansion pill
  if (isDocked && isCollapsed) {
    return (
      <aside
        className={`w-10 bg-neutral-900 border-neutral-800 flex flex-col items-center py-3 shrink-0 z-20 select-none shadow-lg transition-all ${
          dockPosition === "right" ? "border-l" : "border-r"
        } ${className}`}
      >
        <button
          type="button"
          onClick={handleToggleCollapse}
          className="p-1.5 rounded-lg bg-neutral-850 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-750 transition-colors shadow-sm"
          title="Expand Adjustments Panel"
        >
          {dockPosition === "right" ? (
            <ChevronLeft className="w-4 h-4 text-sky-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-sky-400" />
          )}
        </button>
        <div className="mt-6 flex flex-col items-center space-y-3">
          <Sliders className="w-3.5 h-3.5 text-neutral-400" />
          <span className="text-[11px] font-mono text-neutral-400 [writing-mode:vertical-lr] tracking-widest uppercase">
            Adjustments
          </span>
        </div>
      </aside>
    );
  }

  // Panel Inner Content
  const panelContent = (
    <div
      className="flex flex-col h-full overflow-hidden select-none bg-neutral-900/98 text-neutral-200"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-neutral-850/90 border-b border-neutral-800/90 shrink-0">
        <div className="flex items-center space-x-2 min-w-0 pr-2">
          <div className="p-1 rounded bg-sky-950/80 border border-sky-600/30 text-sky-400 shrink-0">
            <Sliders className="w-3.5 h-3.5" />
          </div>
          <span className="font-semibold text-xs text-white truncate tracking-wide">
            {title}
          </span>
        </div>

        <div className="flex items-center space-x-1.5 shrink-0">
          {/* Prominent Auto Enhance Button */}
          {showAutoEnhance && imageSource && (
            <button
              type="button"
              onClick={handleAutoEnhance}
              disabled={isAnalyzing}
              className={`flex items-center space-x-1 text-[11px] px-2.5 py-1 rounded-md font-semibold border transition-all ${
                isAnalyzing
                  ? "bg-amber-950 text-amber-300 border-amber-800 animate-pulse"
                  : "bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-neutral-950 border-amber-400/80 shadow-[0_2px_8px_rgba(245,158,11,0.25)] active:scale-95"
              }`}
              title="Automatically diagnose document defects and optimize tonal curve"
            >
              <Wand2 className={`w-3 h-3 ${isAnalyzing ? "animate-spin" : ""}`} />
              <span>{isAnalyzing ? "Analyzing..." : "Auto Enhance"}</span>
            </button>
          )}

          {/* Clearly Separated Reset All Action */}
          {showResetAll && (
            <button
              type="button"
              onClick={onReset}
              className="flex items-center space-x-1 text-[11px] text-neutral-400 hover:text-white px-2 py-1 rounded-md bg-neutral-800/80 hover:bg-neutral-750 border border-neutral-700/60 transition-colors"
              title="Reset all adjustments and filters to default"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset All</span>
            </button>
          )}

          {extraHeaderActions}

          {/* Collapse Toggle when Docked */}
          {isDocked && (
            <button
              type="button"
              onClick={handleToggleCollapse}
              className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-750 border border-transparent hover:border-neutral-700 transition-colors ml-0.5"
              title="Collapse Panel (Distraction-Free Canvas View)"
            >
              {dockPosition === "right" ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Internal Scroll Area with Custom Non-Obtrusive Scrollbar */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3.5 min-w-0">
        {/* Content Classification & Auto Filter Badge */}
        {detectedContent && (
          <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-950 border border-neutral-800 shadow-inner">
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

        {/* Prominent Action: Apply Settings to All Pages */}
        {onApplyToAllPages && (
          <button
            type="button"
            onClick={onApplyToAllPages}
            className="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-lg bg-gradient-to-r from-sky-950 to-blue-950 hover:from-sky-900 hover:to-blue-900 border border-sky-600/40 hover:border-sky-500/60 text-sky-200 text-xs font-semibold shadow-sm transition-all group"
            title={`Copy current filter and adjustment settings to all ${pageCount || ""} pages`}
          >
            <Copy className="w-3.5 h-3.5 text-sky-400 group-hover:scale-110 transition-transform" />
            <span>
              Apply Settings to All Pages {pageCount && pageCount > 1 ? `(${pageCount})` : ""}
            </span>
          </button>
        )}

        {/* Auto Feedback Notification */}
        {autoFeedback && (
          <div className="p-2 rounded-lg bg-amber-950/50 border border-amber-700/60 text-amber-300 text-[11px] flex items-center space-x-2 animate-in fade-in duration-150">
            <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">{autoFeedback}</span>
          </div>
        )}

        {/* Live Tonal Curve & Histogram with Before/After Compare */}
        {showHistogram && (
          <OmniAdjustmentHistogram
            brightness={brightness}
            contrast={contrast}
            gamma={gamma}
            exposure={exposure}
            isComparingOriginal={isComparingOriginal}
            onToggleCompareOriginal={handleToggleCompareOriginal}
          />
        )}

        {/* Quick Presets Gallery */}
        {showPresets && presets && presets.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold">
              Presets
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {presets.map((preset) => {
                const isSelected = filters.preset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      onChange({ ...preset.filters, preset: preset.id as any }, true)
                    }
                    className={`px-2 py-1.5 rounded-lg text-[11px] font-medium truncate text-center border transition-all ${
                      isSelected
                        ? "bg-sky-600 text-white border-sky-400 font-bold shadow-sm"
                        : "bg-neutral-850 text-neutral-300 border-neutral-750/70 hover:bg-neutral-800 hover:text-white"
                    }`}
                  >
                    {preset.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* SECTION 1: TONE (Collapsible) */}
        {sections.tone && (
          <div className="rounded-xl bg-neutral-925 border border-neutral-800/80 overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => toggleSection("tone")}
              className="w-full flex items-center justify-between px-3 py-2 bg-neutral-850/60 hover:bg-neutral-800/60 text-neutral-300 transition-colors"
            >
              <div className="flex items-center space-x-1.5 font-semibold text-xs text-neutral-200">
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>Tone &amp; Exposure</span>
              </div>
              <div className="text-neutral-400">
                {openSections.tone ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </div>
            </button>

            {openSections.tone && (
              <div className="p-2.5 space-y-1">
                {/* Brightness */}
                <OmniAdjustmentSlider
                  id={`${idPrefix}-brightness`}
                  label="Brightness"
                  icon={<Sun className="w-3.5 h-3.5" />}
                  value={brightness}
                  min={ranges.brightness?.min ?? -100}
                  max={ranges.brightness?.max ?? 100}
                  step={ranges.brightness?.step ?? 1}
                  defaultValue={0}
                  precision={0}
                  accentColor="amber"
                  tooltip="Adjusts overall image lightness without clipping midtones"
                  onChange={(val, commit) => onChange({ brightness: val }, commit)}
                  onReset={() => onChange({ brightness: 0 }, true)}
                />

                {/* Contrast */}
                <OmniAdjustmentSlider
                  id={`${idPrefix}-contrast`}
                  label="Contrast"
                  icon={<Contrast className="w-3.5 h-3.5" />}
                  value={contrast}
                  min={ranges.contrast?.min ?? -100}
                  max={ranges.contrast?.max ?? 100}
                  step={ranges.contrast?.step ?? 1}
                  defaultValue={0}
                  precision={0}
                  accentColor="sky"
                  tooltip="Expands or compresses separation between highlights and shadows"
                  onChange={(val, commit) => onChange({ contrast: val }, commit)}
                  onReset={() => onChange({ contrast: 0 }, true)}
                />

                {/* Gamma Curve */}
                <OmniAdjustmentSlider
                  id={`${idPrefix}-gamma`}
                  label="Gamma Curve"
                  icon={<Sparkles className="w-3.5 h-3.5" />}
                  value={gamma}
                  min={ranges.gamma?.min ?? 0.2}
                  max={ranges.gamma?.max ?? 3.0}
                  step={ranges.gamma?.step ?? 0.05}
                  defaultValue={1.0}
                  precision={2}
                  bipolar={false}
                  accentColor="purple"
                  tooltip="Non-linear midtone distribution curve without affecting white/black points"
                  onChange={(val, commit) => onChange({ gamma: val }, commit)}
                  onReset={() => onChange({ gamma: 1.0 }, true)}
                />
              </div>
            )}
          </div>
        )}

        {/* SECTION 2: COLOR (Collapsible) */}
        {sections.color && (
          <div className="rounded-xl bg-neutral-925 border border-neutral-800/80 overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => toggleSection("color")}
              className="w-full flex items-center justify-between px-3 py-2 bg-neutral-850/60 hover:bg-neutral-800/60 text-neutral-300 transition-colors"
            >
              <div className="flex items-center space-x-1.5 font-semibold text-xs text-neutral-200">
                <Palette className="w-3.5 h-3.5 text-emerald-400" />
                <span>Color &amp; Rendition</span>
              </div>
              <div className="text-neutral-400">
                {openSections.color ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </div>
            </button>

            {openSections.color && (
              <div className="p-2.5 space-y-2">
                {/* Saturation */}
                <OmniAdjustmentSlider
                  id={`${idPrefix}-saturation`}
                  label="Saturation"
                  icon={<Palette className="w-3.5 h-3.5" />}
                  value={saturation}
                  min={ranges.saturation?.min ?? -100}
                  max={ranges.saturation?.max ?? 100}
                  step={ranges.saturation?.step ?? 1}
                  defaultValue={0}
                  precision={0}
                  accentColor="emerald"
                  tooltip="Vibrancy and chroma intensity. -100 produces pure monochrome."
                  onChange={(val, commit) => onChange({ saturation: val }, commit)}
                  onReset={() => onChange({ saturation: 0 }, true)}
                />

                {/* Color Mode Grid */}
                <div className="space-y-1 pt-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold block">
                    Binarization &amp; Color Mode
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
                      const isActive = colorMode === mode.id;
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
              </div>
            )}
          </div>
        )}

        {/* SECTION 3: DETAIL & CLEANUP (Collapsible) */}
        {sections.detail && (
          <div className="rounded-xl bg-neutral-925 border border-neutral-800/80 overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => toggleSection("detail")}
              className="w-full flex items-center justify-between px-3 py-2 bg-neutral-850/60 hover:bg-neutral-800/60 text-neutral-300 transition-colors"
            >
              <div className="flex items-center space-x-1.5 font-semibold text-xs text-neutral-200">
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>Detail &amp; Sharpness</span>
              </div>
              <div className="text-neutral-400">
                {openSections.detail ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </div>
            </button>

            {openSections.detail && (
              <div className="p-2.5 space-y-1">
                {/* Unsharp Mask (Sharpness) */}
                <OmniAdjustmentSlider
                  id={`${idPrefix}-sharpness`}
                  label="Unsharp Mask"
                  icon={<Zap className="w-3.5 h-3.5" />}
                  value={sharpness}
                  min={ranges.sharpness?.min ?? 0}
                  max={ranges.sharpness?.max ?? 100}
                  step={ranges.sharpness?.step ?? 1}
                  defaultValue={0}
                  precision={0}
                  bipolar={false}
                  accentColor="amber"
                  tooltip="Accentuates high-frequency edges for crisp scan reading"
                  onChange={(val, commit) => onChange({ sharpness: val }, commit)}
                  onReset={() => onChange({ sharpness: 0 }, true)}
                />
              </div>
            )}
          </div>
        )}

        {/* SECTION 4: OPTICS & CLEANING (Collapsible) */}
        {sections.optics && (
          <div className="rounded-xl bg-neutral-925 border border-neutral-800/80 overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => toggleSection("optics")}
              className="w-full flex items-center justify-between px-3 py-2 bg-neutral-850/60 hover:bg-neutral-800/60 text-neutral-300 transition-colors"
            >
              <div className="flex items-center space-x-1.5 font-semibold text-xs text-neutral-200">
                <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                <span>Document Optics &amp; Cleaning</span>
              </div>
              <div className="text-neutral-400">
                {openSections.optics ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </div>
            </button>

            {openSections.optics && (
              <div className="p-2.5 space-y-2">
                {/* Background Whitening Toggle & Threshold */}
                <div className="p-2.5 rounded-lg bg-neutral-850 border border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center space-x-2 text-neutral-200 cursor-pointer font-medium text-xs">
                      <input
                        type="checkbox"
                        checked={backgroundWhiten}
                        onChange={(e) => onChange({ backgroundWhiten: e.target.checked }, true)}
                        className="rounded accent-sky-500 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-amber-400" /> Background Whiten
                      </span>
                    </label>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      {backgroundWhitenThreshold}
                    </span>
                  </div>

                  {backgroundWhiten && (
                    <OmniAdjustmentSlider
                      id={`${idPrefix}-whiten`}
                      label="Paper Threshold"
                      icon={<SunDim className="w-3.5 h-3.5" />}
                      value={backgroundWhitenThreshold}
                      min={140}
                      max={250}
                      step={1}
                      defaultValue={220}
                      precision={0}
                      bipolar={false}
                      accentColor="amber"
                      tooltip="Luminance threshold above which paper grain is pushed to pure white"
                      onChange={(val, commit) =>
                        onChange({ backgroundWhitenThreshold: val }, commit)
                      }
                      onReset={() => onChange({ backgroundWhitenThreshold: 220 }, true)}
                    />
                  )}
                </div>

                {/* Shadow Removal & Invert Toggles */}
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center space-x-2 p-2 rounded-lg bg-neutral-850 border border-neutral-800 text-neutral-200 cursor-pointer text-[11px] hover:border-neutral-700 transition-colors">
                    <input
                      type="checkbox"
                      checked={shadowRemoval}
                      onChange={(e) => onChange({ shadowRemoval: e.target.checked }, true)}
                      className="rounded accent-sky-500 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span>Shadow Removal</span>
                  </label>

                  <label className="flex items-center space-x-2 p-2 rounded-lg bg-neutral-850 border border-neutral-800 text-neutral-200 cursor-pointer text-[11px] hover:border-neutral-700 transition-colors">
                    <input
                      type="checkbox"
                      checked={invert}
                      onChange={(e) => onChange({ invert: e.target.checked }, true)}
                      className="rounded accent-sky-500 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span>Invert Colors</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SECTION 5: ALIGNMENT & GEOMETRY (Collapsible) */}
        {sections.alignment && (
          <div className="rounded-xl bg-neutral-925 border border-neutral-800/80 overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => toggleSection("alignment")}
              className="w-full flex items-center justify-between px-3 py-2 bg-neutral-850/60 hover:bg-neutral-800/60 text-neutral-300 transition-colors"
            >
              <div className="flex items-center space-x-1.5 font-semibold text-xs text-neutral-200">
                <Compass className="w-3.5 h-3.5 text-teal-400" />
                <span>Alignment &amp; Deskew</span>
              </div>
              <div className="text-neutral-400">
                {openSections.alignment ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </div>
            </button>

            {openSections.alignment && (
              <div className="p-2.5 space-y-1">
                {/* Fine Deskew Angle */}
                <OmniAdjustmentSlider
                  id={`${idPrefix}-deskew`}
                  label="Fine Deskew"
                  icon={<Compass className="w-3.5 h-3.5" />}
                  value={deskewAngle}
                  min={ranges.deskewAngle?.min ?? -25}
                  max={ranges.deskewAngle?.max ?? 25}
                  step={ranges.deskewAngle?.step ?? 0.1}
                  defaultValue={0}
                  unit="°"
                  precision={1}
                  accentColor="teal"
                  tooltip="Micro-rotation angle to align skewed document pages or cards"
                  onChange={(val, commit) => onChange({ deskewAngle: val }, commit)}
                  onReset={() => onChange({ deskewAngle: 0 }, true)}
                />
              </div>
            )}
          </div>
        )}

        {extraFooterContent}
      </div>
    </div>
  );

  // If used as a docked side panel, wrap in resizable aside with drag handle
  if (isDocked) {
    return (
      <aside
        style={{ width: `${panelWidth}px` }}
        className={`relative flex flex-col h-full shrink-0 z-20 shadow-xl transition-[width] duration-75 ${
          dockPosition === "right"
            ? "border-l border-neutral-800"
            : "border-r border-neutral-800"
        } ${className}`}
      >
        {/* Resizer Handle Bar */}
        {allowResize && (
          <div
            onPointerDown={handleResizePointerDown}
            className={`absolute top-0 bottom-0 w-2.5 cursor-col-resize z-30 group flex items-center justify-center transition-colors ${
              dockPosition === "right" ? "-left-1.5" : "-right-1.5"
            }`}
            title="Drag to resize adjustments panel"
          >
            <div className="w-0.5 h-8 bg-neutral-700/60 group-hover:bg-sky-500 rounded-full transition-colors group-active:bg-sky-400" />
          </div>
        )}

        {panelContent}
      </aside>
    );
  }

  // Standalone inline panel container (for embedding in modals or inspector tabs)
  return <div className={`flex flex-col h-full ${className}`}>{panelContent}</div>;
};
