/**
 * OMNISCAN TITAN X - Enterprise Inspector Panel
 * CV Lab Tuning, OCR Editor, Semantic Intelligence, Annotations & PDF/A Metadata
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  Sliders,
  FileSearch,
  Sparkles,
  Bookmark,
  FileText,
  RotateCw,
  RotateCcw,
  Wand2,
  Crop,
  Sun,
  Contrast,
  Zap,
  Shield,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Download,
  AlertTriangle,
  Layers,
  ChevronRight,
  ChevronLeft,
  Search,
  RefreshCw,
  Plus,
  Trash2,
  Printer,
} from "lucide-react";
import {
  OmniPage,
  OmniDocument,
  ImageFilterPipeline,
  DocumentMetadata,
  AppLanguage,
  CamScannerPresetId,
} from "../../types";
import { estimatePDFSize } from "../../engine/pdf";
import { t } from "../../engine/i18n";
import { BUILTIN_CAMSCANNER_PRESETS } from "../../engine/filters";
import { PdfFilterNumericInput } from "../common/PdfFilterNumericInput";
import { UnifiedColorGradingPanel } from "../common/UnifiedColorGradingPanel";

interface InspectorPanelProps {
  activePage: OmniPage | null;
  document: OmniDocument;
  language: AppLanguage;
  isCollapsed: boolean;
  isProcessing: boolean;
  onToggleCollapse: () => void;
  onUpdateFilters: (filters: Partial<ImageFilterPipeline>, isCommit?: boolean) => void;
  onResetFilters: () => void;
  onAutoDeskew: () => void;
  onAutoCrop: () => void;
  onAutoEnhance?: () => void;
  onAutoEnhanceAll?: () => void;
  onOpenCropMode?: () => void;
  onOpenFilterStudio?: () => void;
  onOpenPhotoPrintStudio?: () => void;
  onRunOcr: (lang: string) => void;
  onUpdateOcrText: (newText: string) => void;
  onAnalyzeIntelligence: () => void;
  onAutoRedactPII: () => void;
  onUpdateMetadata: (meta: Partial<DocumentMetadata>) => void;
  onExportPdf: () => void;
  onApplyToAllPages?: () => void;
  onReDetectContent?: () => void;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  activePage,
  document,
  language,
  isCollapsed,
  isProcessing,
  onToggleCollapse,
  onUpdateFilters,
  onResetFilters,
  onAutoDeskew,
  onAutoCrop,
  onAutoEnhance,
  onAutoEnhanceAll,
  onOpenCropMode,
  onOpenFilterStudio,
  onOpenPhotoPrintStudio,
  onRunOcr,
  onUpdateOcrText,
  onAnalyzeIntelligence,
  onAutoRedactPII,
  onUpdateMetadata,
  onExportPdf,
  onApplyToAllPages,
  onReDetectContent,
}) => {
  const [activeTab, setActiveTab] = useState<
    "cv" | "ocr" | "intelligence" | "annotate" | "metadata"
  >("cv");
  const [ocrLang, setOcrLang] = useState("eng");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [compressionPreset, setCompressionPreset] = useState<
    "maximum" | "high" | "balanced" | "small" | "extreme"
  >("balanced");

  if (isCollapsed) {
    return (
      <aside className="w-10 bg-neutral-900 border-l border-neutral-800 flex flex-col items-center py-2 shrink-0 z-20">
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
          title="Expand Inspector"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="mt-4 flex flex-col items-center space-y-2">
          <span className="text-[11px] font-mono text-neutral-400 [writing-mode:vertical-lr] tracking-widest uppercase">
            Inspector
          </span>
        </div>
      </aside>
    );
  }

  const fallbackFilters: ImageFilterPipeline = {
    rotation: 0,
    deskewAngle: 0,
    preset: "original",
    brightness: 0,
    contrast: 0,
    gamma: 1.0,
    sharpness: 0,
    denoise: 0,
    saturation: 0,
    exposure: 0,
    backgroundWhiten: false,
    backgroundWhitenThreshold: 220,
    shadowRemoval: false,
    shadowStrength: 70,
    punchHoleCleanup: false,
    bleedThroughReduce: false,
    despeckle: false,
    edgePreservation: 0,
    magicColorBoost: 0,
    autoWhiteBalance: false,
    colorMode: "color",
    binarizationThreshold: 128,
    invert: false,
  };

  // Immediate local UI control state decoupled from expensive rendering
  const [immediateFilters, setImmediateFilters] = useState<ImageFilterPipeline>(
    () => (activePage?.filters ? { ...activePage.filters } : fallbackFilters)
  );

  useEffect(() => {
    if (activePage?.filters) {
      setImmediateFilters({ ...activePage.filters });
    }
  }, [activePage?.id, activePage?.lastModifiedAt]);

  const handleControlChange = useCallback(
    (updates: Partial<ImageFilterPipeline>, isCommit: boolean = false) => {
      setImmediateFilters((prev) => ({ ...prev, ...updates }));
      onUpdateFilters(updates, isCommit);
    },
    [onUpdateFilters]
  );

  const filters = immediateFilters;

  const ocr = activePage?.ocr;
  const intel = activePage?.intelligence;
  const meta = document.metadata;

  // File size estimate
  const sizeEstimate = estimatePDFSize(document, compressionPreset);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  return (
    <aside className="w-84 bg-neutral-900 border-l border-neutral-800 flex flex-col h-full shrink-0 select-none z-20">
      {/* Tab Navigation Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 bg-neutral-850 px-2 py-1">
        <div className="flex items-center space-x-1 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveTab("cv")}
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded font-medium transition-colors ${
              activeTab === "cv"
                ? "bg-sky-600/20 text-sky-400 border border-sky-500/30"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
            title="Computer Vision Lab"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>CV Lab</span>
          </button>

          <button
            onClick={() => setActiveTab("ocr")}
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded font-medium transition-colors ${
              activeTab === "ocr"
                ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
            title="OCR & Text Layout"
          >
            <FileSearch className="w-3.5 h-3.5" />
            <span>OCR</span>
          </button>

          <button
            onClick={() => setActiveTab("intelligence")}
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded font-medium transition-colors ${
              activeTab === "intelligence"
                ? "bg-purple-600/20 text-purple-400 border border-purple-500/30"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
            title="Document Intelligence & Extraction"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Intel</span>
          </button>

          <button
            onClick={() => setActiveTab("metadata")}
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded font-medium transition-colors ${
              activeTab === "metadata"
                ? "bg-amber-600/20 text-amber-400 border border-amber-500/30"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
            title="PDF/A Standards & Metadata"
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>PDF/A</span>
          </button>
        </div>

        <button
          onClick={onToggleCollapse}
          className="p-1 rounded hover:bg-neutral-750 text-neutral-400 hover:text-white transition-colors"
          title="Collapse Panel"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Tab Body Contents */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4 text-xs text-neutral-300 custom-scrollbar">
        {/* ================= TAB 1: COMPUTER VISION LAB ================= */}
        {activeTab === "cv" && (
          <div className="space-y-4">
            {/* Adaptive Document Engine Card */}
            <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-950/60 via-neutral-900 to-sky-950/60 border border-sky-600/40 space-y-2.5 shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <Wand2 className="w-3.5 h-3.5 text-sky-400" />
                  <span className="text-[11px] font-bold text-white">Adaptive Document Engine</span>
                </div>
                {activePage?.adaptiveAnalysis && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold bg-emerald-950 border border-emerald-700 text-emerald-400">
                    Quality {activePage.adaptiveAnalysis.qualityScorePost}/100
                  </span>
                )}
              </div>

              {activePage?.adaptiveAnalysis ? (
                <div className="space-y-1.5 bg-black/40 p-2 rounded-lg border border-neutral-800 text-[10px]">
                  <div className="flex items-center justify-between text-neutral-300">
                    <span className="font-semibold text-sky-300">{activePage.adaptiveAnalysis.report.label}</span>
                    <span className="text-emerald-400 font-mono">+{activePage.adaptiveAnalysis.qualityDelta} pts</span>
                  </div>
                  {activePage.adaptiveAnalysis.report.diagnosedDefects.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {activePage.adaptiveAnalysis.report.diagnosedDefects.map((defect, i) => (
                        <span key={i} className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 text-[9px] border border-neutral-700">
                          {defect}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[10px] text-neutral-400 leading-tight">
                  Autonomous defect diagnosis: deskews angle, whitens paper, lifts shadows, and verifies text legibility.
                </p>
              )}

              <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                {onAutoEnhance && (
                  <button
                    onClick={onAutoEnhance}
                    disabled={isProcessing}
                    className="flex items-center justify-center space-x-1.5 py-1.5 rounded-lg bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold text-[11px] transition-all shadow-sm active:scale-95 disabled:opacity-50"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>Auto-Optimize</span>
                  </button>
                )}
                {onAutoEnhanceAll && document.pages.length > 1 && (
                  <button
                    onClick={onAutoEnhanceAll}
                    disabled={isProcessing}
                    className="flex items-center justify-center space-x-1.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-750 text-neutral-200 font-medium text-[11px] border border-neutral-700 transition-all active:scale-95 disabled:opacity-50"
                    title={`Batch optimize all ${document.pages.length} pages`}
                  >
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    <span>All Pages ({document.pages.length})</span>
                  </button>
                )}
              </div>
            </div>

            {/* CamScanner Filter Studio Quick Launcher */}
            <div className="p-3 rounded-xl bg-gradient-to-br from-sky-950/60 via-neutral-900 to-indigo-950/60 border border-sky-800/40 space-y-2.5 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                  <span>CamScanner Filters</span>
                </span>
                {onOpenFilterStudio && (
                  <button
                    onClick={onOpenFilterStudio}
                    className="text-[10px] font-semibold text-sky-400 hover:text-sky-300 px-2 py-0.5 rounded bg-sky-950 border border-sky-800"
                  >
                    Open Studio →
                  </button>
                )}
              </div>

              {/* Quick Presets Grid */}
              <div className="grid grid-cols-4 gap-1">
                {BUILTIN_CAMSCANNER_PRESETS.slice(0, 8).map((preset) => {
                  const isSelected = filters.preset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => handleControlChange({ ...preset.filters, preset: preset.id }, true)}
                      className={`px-1.5 py-1.5 rounded text-[10px] font-medium truncate text-center border transition-all ${
                        isSelected
                          ? "bg-sky-600 text-white border-sky-400 font-bold shadow"
                          : "bg-neutral-850 text-neutral-300 border-neutral-750 hover:bg-neutral-800 hover:text-white"
                      }`}
                      title={preset.description}
                    >
                      {preset.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Photo Print Studio Shortcut */}
            {onOpenPhotoPrintStudio && (
              <button
                onClick={onOpenPhotoPrintStudio}
                className="flex items-center justify-between w-full p-2.5 rounded-xl bg-gradient-to-r from-amber-950/50 to-neutral-900 border border-amber-800/40 text-amber-200 hover:border-amber-600 transition-all text-left shadow-sm group"
              >
                <div className="flex items-center space-x-2">
                  <Printer className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-amber-300">
                      4×6" Photo &amp; Passport Studio
                    </div>
                    <div className="text-[10px] text-neutral-400">
                      Multi-grid layout, margins &amp; biometric crop
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-white" />
              </button>
            )}

            {/* Section: Geometry */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-neutral-400 uppercase tracking-wider text-[10px] font-bold">
                <span>Geometry &amp; Orientation</span>
                <button
                  onClick={onAutoDeskew}
                  className="flex items-center space-x-1 text-sky-400 hover:text-sky-300 font-semibold"
                >
                  <Wand2 className="w-3 h-3" />
                  <span>Auto Deskew</span>
                </button>
              </div>

              {/* Rotation buttons */}
              <div className="grid grid-cols-4 gap-1.5">
                {[0, 90, 180, 270].map((deg) => (
                  <button
                    key={deg}
                    onClick={() => handleControlChange({ rotation: deg }, true)}
                    className={`py-1.5 rounded border text-center font-mono font-medium transition-colors ${
                      filters.rotation === deg
                        ? "bg-sky-600 text-white border-sky-500"
                        : "bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-750"
                    }`}
                  >
                    {deg}°
                  </button>
                ))}
              </div>

              {/* Deskew Angle Slider */}
              <div className="space-y-1 bg-neutral-850 p-2 rounded border border-neutral-800">
                <div className="flex items-center justify-between text-neutral-300 text-xs select-none">
                  <span>Fine Deskew Angle</span>
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => handleControlChange({ deskewAngle: 0 }, true)}
                      className="text-[9px] text-neutral-500 hover:text-sky-400 font-mono transition-colors cursor-pointer"
                      title="Reset Deskew Angle to 0°"
                    >
                      reset (0°)
                    </button>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="range"
                    min="-25"
                    max="25"
                    step="0.2"
                    value={filters.deskewAngle}
                    onChange={(e) => handleControlChange({ deskewAngle: parseFloat(e.target.value) }, false)}
                    onPointerUp={() => handleControlChange({ deskewAngle: filters.deskewAngle }, true)}
                    className="flex-1 accent-sky-500 cursor-pointer h-1.5 bg-neutral-700 rounded-lg appearance-none"
                  />
                  <PdfFilterNumericInput
                    id="pdf-input-deskew"
                    value={filters.deskewAngle}
                    min={-25}
                    max={25}
                    step={0.2}
                    precision={1}
                    unit="°"
                    onChange={(val, isCommit) => handleControlChange({ deskewAngle: val }, isCommit)}
                    ariaLabel="Deskew angle degrees"
                  />
                </div>
              </div>

              {/* Crop Page & Auto Crop */}
              <div className="grid grid-cols-2 gap-1.5">
                {onOpenCropMode && (
                  <button
                    onClick={onOpenCropMode}
                    className="flex items-center justify-center space-x-1.5 py-1.5 rounded bg-sky-600 hover:bg-sky-500 border border-sky-400 text-white font-bold transition-colors shadow-sm"
                    title="Open Dedicated 8-Point Physical Page Crop Tool (C)"
                  >
                    <Crop className="w-3.5 h-3.5" />
                    <span>Crop Page</span>
                  </button>
                )}
                <button
                  onClick={onAutoCrop}
                  className={`flex items-center justify-center space-x-1.5 py-1.5 rounded bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 text-neutral-200 font-medium transition-colors ${
                    !onOpenCropMode ? "col-span-2" : ""
                  }`}
                  title="Auto-Detect Document Margins"
                >
                  <Wand2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Auto Margins</span>
                </button>
              </div>
            </div>

            {/* Section: Unified Tone & Image Grading */}
            <div className="border-t border-neutral-800 pt-3">
              <UnifiedColorGradingPanel
                filters={filters}
                onChange={(updates, isCommit) => handleControlChange(updates, isCommit)}
                onReset={() => {
                  setImmediateFilters(fallbackFilters);
                  onResetFilters();
                }}
                imageSource={activePage?.processedDataUrl || activePage?.originalDataUrl}
                title="Tone & Image Grading"
                compact={false}
                showAutoGrade={true}
                showPresets={true}
                showCleanup={true}
                showColorModes={true}
                detectedContent={activePage?.detectedContent}
                filterSource={activePage?.filterSource || "auto-detected"}
                onReDetect={onReDetectContent}
                onApplyToAllPages={onApplyToAllPages}
                pageCount={document.pages.length}
              />
            </div>
          </div>
        )}

        {/* ================= TAB 2: OCR & TEXT ================= */}
        {activeTab === "ocr" && (
          <div className="space-y-4">
            {/* Language Selection & Execute OCR */}
            <div className="space-y-2 bg-neutral-850 p-3 rounded-lg border border-neutral-800">
              <span className="text-neutral-400 uppercase tracking-wider text-[10px] font-bold">
                OCR Engine Controls
              </span>

              <div className="flex items-center space-x-2">
                <select
                  value={ocrLang}
                  onChange={(e) => setOcrLang(e.target.value)}
                  className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none"
                >
                  <option value="eng">English (Latin)</option>
                  <option value="urd">Urdu (اردو)</option>
                  <option value="ara">Arabic (العربية)</option>
                  <option value="fra">French (Français)</option>
                  <option value="spa">Spanish (Español)</option>
                  <option value="deu">German (Deutsch)</option>
                  <option value="chi_sim">Chinese Simplified (简体中文)</option>
                  <option value="jpn">Japanese (日本語)</option>
                </select>

                <button
                  onClick={() => onRunOcr(ocrLang)}
                  disabled={isProcessing}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm transition-all disabled:opacity-50"
                >
                  <FileSearch className="w-3.5 h-3.5" />
                  <span>{isProcessing ? "Running..." : "Run OCR"}</span>
                </button>
              </div>

              {ocr && ocr.status === "completed" && (
                <div className="flex items-center justify-between text-[11px] pt-1 text-neutral-400 border-t border-neutral-800">
                  <span>Confidence:</span>
                  <span
                    className={`font-mono font-bold px-1.5 py-0.5 rounded ${
                      ocr.confidence >= 80
                        ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                        : ocr.confidence >= 50
                        ? "bg-amber-950 text-amber-400 border border-amber-800"
                        : "bg-rose-950 text-rose-400 border border-rose-800"
                    }`}
                  >
                    {ocr.confidence}% Accuracy
                  </span>
                </div>
              )}
            </div>

            {/* OCR Extracted Text Editor */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-neutral-400 uppercase tracking-wider text-[10px] font-bold">
                  Recognized Text ({ocr?.text ? ocr.text.split(/\s+/).length : 0} words)
                </span>
                {ocr?.text && (
                  <button
                    onClick={() => copyToClipboard(ocr.text, "ocr-text")}
                    className="flex items-center space-x-1 text-sky-400 hover:text-sky-300 text-[11px]"
                  >
                    {copiedKey === "ocr-text" ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === "ocr-text" ? "Copied" : "Copy"}</span>
                  </button>
                )}
              </div>

              <textarea
                value={ocr?.text || ""}
                onChange={(e) => onUpdateOcrText(e.target.value)}
                placeholder="OCR output will appear here. You can edit recognized words directly..."
                rows={12}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-xs text-neutral-200 font-mono leading-relaxed focus:outline-none focus:border-sky-500 custom-scrollbar resize-none"
              />
            </div>
          </div>
        )}

        {/* ================= TAB 3: DOCUMENT INTELLIGENCE ================= */}
        {activeTab === "intelligence" && (
          <div className="space-y-4">
            {/* Analyze Button */}
            <div className="flex items-center justify-between">
              <span className="text-neutral-400 uppercase tracking-wider text-[10px] font-bold">
                Semantic Intelligence
              </span>
              <button
                onClick={onAnalyzeIntelligence}
                disabled={isProcessing}
                className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white font-medium shadow-sm transition-all disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isProcessing ? "Analyzing..." : "Analyze Page"}</span>
              </button>
            </div>

            {intel ? (
              <div className="space-y-3">
                {/* Classification Badge */}
                <div className="p-3 rounded-lg bg-gradient-to-r from-purple-950/40 to-indigo-950/40 border border-purple-800/40 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-purple-300 font-mono uppercase tracking-wider">
                      Classification: {intel.classification.category}
                    </span>
                    <span className="text-[10px] font-mono bg-purple-900/60 text-purple-200 px-1.5 py-0.5 rounded">
                      {Math.round(intel.classification.confidence * 100)}% Conf
                    </span>
                  </div>
                  <div className="text-sm font-bold text-white">
                    {intel.classification.type}
                  </div>
                </div>

                {/* Executive Summary */}
                <div className="space-y-1 bg-neutral-850 p-2.5 rounded-lg border border-neutral-800">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">
                    Executive Summary
                  </span>
                  <p className="text-xs text-neutral-300 leading-relaxed">{intel.summary}</p>
                </div>

                {/* Extracted Key-Value Entities */}
                {intel.entities && intel.entities.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">
                      Extracted Fields &amp; Entities ({intel.entities.length})
                    </span>
                    <div className="space-y-1 max-h-44 overflow-y-auto custom-scrollbar">
                      {intel.entities.map((e) => (
                        <div
                          key={e.id}
                          className="flex items-center justify-between p-2 rounded bg-neutral-850 border border-neutral-800 hover:border-neutral-700"
                        >
                          <div className="flex flex-col pr-2">
                            <span className="text-[10px] text-neutral-400 font-medium">{e.key}</span>
                            <span className="text-xs font-semibold text-neutral-200 font-mono truncate max-w-[190px]">
                              {e.value}
                            </span>
                          </div>
                          <button
                            onClick={() => copyToClipboard(e.value, e.id)}
                            className="p-1 rounded hover:bg-neutral-750 text-neutral-400 hover:text-white"
                            title="Copy Value"
                          >
                            {copiedKey === e.id ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* PII & Redaction Recommendations */}
                {intel.redactionRecommendations && intel.redactionRecommendations.length > 0 && (
                  <div className="space-y-2 bg-rose-950/20 p-2.5 rounded-lg border border-rose-900/40">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider flex items-center space-x-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>PII / Sensitive Data ({intel.redactionRecommendations.length})</span>
                      </span>
                    </div>

                    <div className="space-y-1">
                      {intel.redactionRecommendations.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between p-1.5 rounded bg-neutral-900/80 text-[11px]"
                        >
                          <span className="text-neutral-300 font-medium">{r.label}</span>
                          <span className="font-mono text-rose-400 text-[10px] px-1 bg-rose-950/60 rounded">
                            {r.riskLevel.toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={onAutoRedactPII}
                      className="w-full py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-medium transition-colors text-xs flex items-center justify-center space-x-1.5"
                    >
                      <Shield className="w-3.5 h-3.5" />
                      <span>1-Click Auto Redact Sensitive Areas</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-neutral-500 space-y-2">
                <Sparkles className="w-8 h-8 mx-auto text-neutral-600" />
                <p className="text-xs">
                  Click "Analyze Page" to extract semantic metadata, document classification, line items, and risk items.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 4: METADATA & PDF/A ================= */}
        {activeTab === "metadata" && (
          <div className="space-y-4">
            {/* Standard Selection */}
            <div className="space-y-1.5">
              <span className="text-neutral-400 uppercase tracking-wider text-[10px] font-bold">
                Archival Standard
              </span>
              <select
                value={meta.pdfAStandard}
                onChange={(e) => onUpdateMetadata({ pdfAStandard: e.target.value as any })}
                className="w-full bg-neutral-850 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none"
              >
                <option value="PDF/A-2b">PDF/A-2b (ISO 19005-2 Archival Standard)</option>
                <option value="PDF/A-1b">PDF/A-1b (ISO 19005-1 Legacy Archival)</option>
                <option value="PDF/A-3b">PDF/A-3b (ISO 19005-3 with XML Attachments)</option>
                <option value="Standard PDF (1.7)">Standard PDF (v1.7 Fast Web)</option>
              </select>
            </div>

            {/* Compression Preset Selector & Live Estimator */}
            <div className="space-y-2 bg-neutral-850 p-3 rounded-lg border border-neutral-800">
              <span className="text-neutral-400 uppercase tracking-wider text-[10px] font-bold">
                Intelligent Compression
              </span>

              <div className="grid grid-cols-3 gap-1">
                {(["maximum", "high", "balanced", "small", "extreme"] as const).map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setCompressionPreset(preset)}
                    className={`py-1 rounded border text-[11px] font-medium capitalize transition-colors ${
                      compressionPreset === preset
                        ? "bg-sky-600 text-white border-sky-500"
                        : "bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-750"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              {/* Reduction Gauge */}
              <div className="bg-neutral-900 p-2 rounded border border-neutral-800 space-y-1 text-[11px]">
                <div className="flex items-center justify-between text-neutral-400">
                  <span>Source Size:</span>
                  <span className="font-mono text-neutral-200">
                    {(sizeEstimate.originalBytes / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
                <div className="flex items-center justify-between text-neutral-400">
                  <span>Estimated PDF:</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {(sizeEstimate.estimatedBytes / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
                <div className="flex items-center justify-between text-sky-400 font-semibold pt-1 border-t border-neutral-800">
                  <span>Reduction Ratio:</span>
                  <span>{sizeEstimate.reductionPercent}% Smaller</span>
                </div>
              </div>
            </div>

            {/* Document Metadata Fields */}
            <div className="space-y-2.5">
              <span className="text-neutral-400 uppercase tracking-wider text-[10px] font-bold">
                Document Metadata &amp; Tags
              </span>

              <div className="space-y-1">
                <label className="text-[11px] text-neutral-400">Document Title</label>
                <input
                  type="text"
                  value={meta.title}
                  onChange={(e) => onUpdateMetadata({ title: e.target.value })}
                  placeholder="e.g. Commercial Invoice 2026"
                  className="w-full bg-neutral-850 border border-neutral-700 rounded px-2.5 py-1 text-xs text-neutral-200 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-neutral-400">Author / Creator</label>
                <input
                  type="text"
                  value={meta.author}
                  onChange={(e) => onUpdateMetadata({ author: e.target.value })}
                  placeholder="e.g. Titan Document Systems"
                  className="w-full bg-neutral-850 border border-neutral-700 rounded px-2.5 py-1 text-xs text-neutral-200 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-neutral-400">Subject / Category</label>
                <input
                  type="text"
                  value={meta.subject}
                  onChange={(e) => onUpdateMetadata({ subject: e.target.value })}
                  placeholder="e.g. Accounts Payable"
                  className="w-full bg-neutral-850 border border-neutral-700 rounded px-2.5 py-1 text-xs text-neutral-200 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-neutral-400">Keywords (comma-separated)</label>
                <input
                  type="text"
                  value={meta.keywords}
                  onChange={(e) => onUpdateMetadata({ keywords: e.target.value })}
                  placeholder="invoice, payment, titan, 2026"
                  className="w-full bg-neutral-850 border border-neutral-700 rounded px-2.5 py-1 text-xs text-neutral-200 focus:outline-none"
                />
              </div>
            </div>

            {/* Export Button */}
            <div className="pt-2">
              <button
                onClick={onExportPdf}
                className="flex items-center justify-center space-x-1.5 w-full py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-sm transition-all text-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Validated PDF/A Package</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
