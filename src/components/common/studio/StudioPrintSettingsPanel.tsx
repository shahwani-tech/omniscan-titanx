import React from "react";
import {
  Printer,
  FileDown,
  Download,
  Plus,
  Scissors,
  ShieldCheck,
  Maximize,
  Sliders,
  Sparkles,
} from "lucide-react";
import { UniversalNumericInput } from "../UniversalNumericInput";

export interface PaperSizeOption {
  id: string;
  name: string;
  widthInches?: number;
  heightInches?: number;
  widthMm?: number;
  heightMm?: number;
}

export interface PresetCopyOption {
  copies: number;
  label: string;
  subLabel?: string;
  rows?: number;
  cols?: number;
}

export interface StudioPrintSettingsPanelProps {
  title?: string;
  paperSizeId: string;
  availablePaperSizes?: PaperSizeOption[];
  onPaperSizeChange: (paperId: string) => void;
  orientation: "portrait" | "landscape";
  onOrientationChange: (orientation: "portrait" | "landscape") => void;
  dpi?: number;
  onDpiChange?: (dpi: number) => void;
  copies?: number;
  onCopiesChange?: (copies: number) => void;
  presetCopies?: PresetCopyOption[];
  onSelectPresetCopies?: (preset: PresetCopyOption) => void;

  // Cut Guides & Border
  cutGuidesType?: string;
  availableCutGuides?: Array<{ id: string; label: string }>;
  onCutGuidesChange?: (type: string) => void;
  borderThickness?: number;
  onBorderThicknessChange?: (thickness: number) => void;
  borderColor?: string;
  onBorderColorChange?: (color: string) => void;
  borderStyle?: "solid" | "dashed" | "dotted";
  onBorderStyleChange?: (style: "solid" | "dashed" | "dotted") => void;

  // Margins
  marginMode?: "auto" | "manual";
  onMarginModeChange?: (mode: "auto" | "manual") => void;
  margins?: { top: number; bottom: number; left: number; right: number };
  marginUnit?: "in" | "mm";
  onMarginChange?: (side: "top" | "bottom" | "left" | "right", val: number) => void;

  // Practice Watermark
  watermarkEnabled?: boolean;
  onWatermarkEnabledChange?: (enabled: boolean) => void;
  watermarkText?: string;
  onWatermarkTextChange?: (text: string) => void;

  // Custom Extra Sections
  customSections?: React.ReactNode;

  // Action Buttons
  onPrint?: () => void;
  printLabel?: string;
  isPrinting?: boolean;
  onExportPdf?: () => void;
  exportPdfLabel?: string;
  isExporting?: boolean;
  onDownloadImage?: (format: "image/jpeg" | "image/png") => void;
  onInsertIntoDocument?: () => void;
  insertIntoDocumentLabel?: string;
  className?: string;
}

const DEFAULT_PAPER_SIZES: PaperSizeOption[] = [
  { id: "4x6", name: '4×6" Photo Paper (102×152mm)', widthInches: 4, heightInches: 6 },
  { id: "a4", name: "A4 (210×297mm)", widthMm: 210, heightMm: 297 },
  { id: "letter", name: 'Letter (8.5×11")', widthInches: 8.5, heightInches: 11 },
  { id: "a6", name: "A6 Postcard (105×148mm)", widthMm: 105, heightMm: 148 },
];

export const StudioPrintSettingsPanel: React.FC<StudioPrintSettingsPanelProps> = ({
  title = "Print & Paper Specifications",
  paperSizeId,
  availablePaperSizes = DEFAULT_PAPER_SIZES,
  onPaperSizeChange,
  orientation,
  onOrientationChange,
  dpi = 300,
  onDpiChange,
  copies,
  onCopiesChange,
  presetCopies,
  onSelectPresetCopies,
  cutGuidesType,
  availableCutGuides,
  onCutGuidesChange,
  borderThickness,
  onBorderThicknessChange,
  borderColor,
  onBorderColorChange,
  borderStyle,
  onBorderStyleChange,
  marginMode,
  onMarginModeChange,
  margins,
  marginUnit = "in",
  onMarginChange,
  watermarkEnabled,
  onWatermarkEnabledChange,
  watermarkText,
  onWatermarkTextChange,
  customSections,
  onPrint,
  printLabel = "Print Sheet",
  isPrinting = false,
  onExportPdf,
  exportPdfLabel = "Export PDF (300 DPI)",
  isExporting = false,
  onDownloadImage,
  onInsertIntoDocument,
  insertIntoDocumentLabel = "Insert into Project Document",
  className = "",
}) => {
  return (
    <div className={`space-y-4 text-xs ${className}`}>
      {/* Title */}
      <span className="font-bold text-neutral-200 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
        <Printer className="w-3.5 h-3.5 text-sky-400" />
        <span>{title}</span>
      </span>

      {/* Preset Copies Grid if provided */}
      {presetCopies && presetCopies.length > 0 && onSelectPresetCopies && (
        <div className="space-y-1.5">
          <label className="text-[10px] font-medium text-neutral-400">Copies Preset</label>
          <div className="grid grid-cols-4 gap-1.5">
            {presetCopies.map((p, idx) => {
              const isSelected = copies === p.copies;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectPresetCopies(p)}
                  className={`p-1.5 rounded-lg border text-center transition-all ${
                    isSelected
                      ? "bg-sky-600 text-white border-sky-400 font-bold shadow-sm"
                      : "bg-neutral-950 border-neutral-800 hover:border-neutral-700 text-neutral-300"
                  }`}
                >
                  <div className="text-[11px]">{p.label}</div>
                  {p.subLabel && <div className="text-[9px] opacity-70">{p.subLabel}</div>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Paper Size & Orientation */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-medium text-neutral-400 block mb-1">
            Paper Size
          </label>
          <select
            value={paperSizeId}
            onChange={(e) => onPaperSizeChange(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-750 rounded-lg px-2 py-1.5 text-xs text-white"
          >
            {availablePaperSizes.map((paper) => (
              <option key={paper.id} value={paper.id}>
                {paper.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] font-medium text-neutral-400 block mb-1">
            Orientation
          </label>
          <select
            value={orientation}
            onChange={(e) =>
              onOrientationChange(e.target.value as "portrait" | "landscape")
            }
            className="w-full bg-neutral-950 border border-neutral-750 rounded-lg px-2 py-1.5 text-xs text-white"
          >
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
        </div>
      </div>

      {/* DPI & Output Quality */}
      {onDpiChange && (
        <div className="flex items-center justify-between bg-neutral-950/80 p-2 rounded-lg border border-neutral-800">
          <span className="text-neutral-300">Resolution Quality</span>
          <select
            value={dpi}
            onChange={(e) => onDpiChange(Number(e.target.value))}
            className="bg-neutral-900 border border-neutral-700 rounded px-2 py-0.5 text-xs text-white"
          >
            <option value={300}>300 DPI (Standard)</option>
            <option value={600}>600 DPI (Ultra-Sharp)</option>
            <option value={150}>150 DPI (Draft)</option>
          </select>
        </div>
      )}

      {/* Cutting Guides & Borders */}
      {(onCutGuidesChange || onBorderThicknessChange) && (
        <div className="bg-neutral-950/80 p-2.5 rounded-lg border border-neutral-800 space-y-2.5">
          {onBorderThicknessChange && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-neutral-300 flex items-center space-x-1.5">
                  <Scissors className="w-3 h-3 text-sky-400" />
                  <span>Card Stroke Border</span>
                </span>
                {borderColor && onBorderColorChange && (
                  <input
                    type="color"
                    value={borderColor}
                    onChange={(e) => onBorderColorChange(e.target.value)}
                    className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent"
                    title="Border color"
                  />
                )}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <select
                  value={borderThickness ?? 0}
                  onChange={(e) => onBorderThicknessChange(Number(e.target.value))}
                  className="bg-neutral-900 border border-neutral-750 rounded px-2 py-1 text-xs text-white"
                >
                  <option value={0}>0 px (None)</option>
                  <option value={1}>1 px (Fine)</option>
                  <option value={2}>2 px (Standard)</option>
                  <option value={3}>3 px (Heavy)</option>
                  <option value={5}>5 px</option>
                </select>

                {onBorderStyleChange && (
                  <select
                    value={borderStyle || "solid"}
                    onChange={(e) =>
                      onBorderStyleChange(e.target.value as "solid" | "dashed" | "dotted")
                    }
                    className="bg-neutral-900 border border-neutral-750 rounded px-2 py-1 text-xs text-white"
                  >
                    <option value="solid">Solid Line</option>
                    <option value="dashed">Dashed Line</option>
                    <option value="dotted">Dotted Line</option>
                  </select>
                )}
              </div>
            </div>
          )}

          {onCutGuidesChange && (
            <div>
              <label className="text-[10px] font-medium text-neutral-400 block mb-1">
                Cutting Guides
              </label>
              <select
                value={cutGuidesType || "corner-marks"}
                onChange={(e) => onCutGuidesChange(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-750 rounded px-2 py-1 text-xs text-white"
              >
                {availableCutGuides ? (
                  availableCutGuides.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="corner-marks">Corner Tick Marks (L-Marks)</option>
                    <option value="crop-marks">Standard Crosshair Crop Marks</option>
                    <option value="grid-lines">Dotted Scissor Lines</option>
                    <option value="none">No Cutting Guides</option>
                  </>
                )}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Sheet Outer Margins */}
      {margins && onMarginChange && (
        <div className="bg-neutral-950/80 p-2.5 rounded-lg border border-neutral-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-neutral-300 font-medium">Outer Sheet Margins</span>
            {onMarginModeChange && (
              <div className="flex bg-neutral-900 rounded p-0.5 border border-neutral-800">
                <button
                  type="button"
                  onClick={() => onMarginModeChange("auto")}
                  className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                    marginMode !== "manual"
                      ? "bg-sky-600 text-white"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  Auto
                </button>
                <button
                  type="button"
                  onClick={() => onMarginModeChange("manual")}
                  className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                    marginMode === "manual"
                      ? "bg-sky-600 text-white"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  Manual
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1.5 pt-1">
            <div>
              <span className="text-[10px] text-neutral-400 block mb-0.5">
                Top ({marginUnit})
              </span>
              <UniversalNumericInput
                id="margin-top"
                value={margins.top}
                min={0}
                max={50}
                step={0.05}
                precision={2}
                disabled={marginMode === "auto"}
                onChange={(val) => onMarginChange("top", val)}
                className="w-full"
              />
            </div>
            <div>
              <span className="text-[10px] text-neutral-400 block mb-0.5">
                Bottom ({marginUnit})
              </span>
              <UniversalNumericInput
                id="margin-bottom"
                value={margins.bottom}
                min={0}
                max={50}
                step={0.05}
                precision={2}
                disabled={marginMode === "auto"}
                onChange={(val) => onMarginChange("bottom", val)}
                className="w-full"
              />
            </div>
            <div>
              <span className="text-[10px] text-neutral-400 block mb-0.5">
                Left ({marginUnit})
              </span>
              <UniversalNumericInput
                id="margin-left"
                value={margins.left}
                min={0}
                max={50}
                step={0.05}
                precision={2}
                disabled={marginMode === "auto"}
                onChange={(val) => onMarginChange("left", val)}
                className="w-full"
              />
            </div>
            <div>
              <span className="text-[10px] text-neutral-400 block mb-0.5">
                Right ({marginUnit})
              </span>
              <UniversalNumericInput
                id="margin-right"
                value={margins.right}
                min={0}
                max={50}
                step={0.05}
                precision={2}
                disabled={marginMode === "auto"}
                onChange={(val) => onMarginChange("right", val)}
                className="w-full"
              />
            </div>
          </div>
        </div>
      )}

      {/* Practice Document Watermark */}
      {onWatermarkEnabledChange && (
        <div className="bg-neutral-950/80 p-2.5 rounded-lg border border-neutral-800 space-y-1.5">
          <label className="flex items-center space-x-2 text-neutral-300 cursor-pointer">
            <input
              type="checkbox"
              checked={watermarkEnabled}
              onChange={(e) => onWatermarkEnabledChange(e.target.checked)}
              className="rounded text-sky-600 bg-neutral-900 border-neutral-700"
            />
            <span className="flex items-center space-x-1 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Practice Watermark</span>
            </span>
          </label>
          {watermarkEnabled && onWatermarkTextChange && (
            <input
              type="text"
              value={watermarkText || "SAMPLE / PRACTICE SPECIMEN"}
              onChange={(e) => onWatermarkTextChange(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-750 rounded px-2 py-1 text-xs text-neutral-200"
              placeholder="Watermark text"
            />
          )}
        </div>
      )}

      {/* Custom Extra Sections */}
      {customSections}

      {/* Primary Export & Print Action Buttons */}
      <div className="space-y-2 pt-2">
        {onExportPdf && (
          <button
            type="button"
            onClick={onExportPdf}
            disabled={isExporting}
            className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg flex items-center justify-center space-x-2 transition-colors shadow-lg disabled:opacity-50"
          >
            <FileDown className="w-4 h-4" />
            <span>{exportPdfLabel}</span>
          </button>
        )}

        <div className="grid grid-cols-2 gap-2">
          {onDownloadImage && (
            <button
              type="button"
              onClick={() => onDownloadImage("image/jpeg")}
              className="py-2 bg-neutral-800 hover:bg-neutral-750 text-neutral-200 rounded-lg flex items-center justify-center space-x-1.5 transition-colors border border-neutral-700"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              <span>Download JPG</span>
            </button>
          )}

          {onPrint && (
            <button
              type="button"
              onClick={onPrint}
              disabled={isPrinting}
              className="py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold rounded-lg flex items-center justify-center space-x-1.5 transition-colors shadow disabled:opacity-50"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{printLabel}</span>
            </button>
          )}
        </div>

        {onInsertIntoDocument && (
          <button
            type="button"
            onClick={onInsertIntoDocument}
            className="w-full py-2 bg-neutral-800 hover:bg-neutral-750 text-sky-300 font-semibold rounded-lg flex items-center justify-center space-x-2 transition-colors border border-sky-700/50 mt-1"
          >
            <Plus className="w-4 h-4 text-sky-400" />
            <span>{insertIntoDocumentLabel}</span>
          </button>
        )}
      </div>
    </div>
  );
};
