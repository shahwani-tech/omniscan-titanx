/**
 * Professional ID & Service Card Designer - Toolbar Component
 * CorelDRAW-inspired vector studio toolbar with comprehensive actions.
 */

import React, { useState } from "react";
import {
  MousePointer,
  Hand,
  Type,
  Image as ImageIcon,
  PenTool,
  Square,
  Circle,
  Minus,
  Star,
  QrCode,
  Barcode as BarcodeIcon,
  Crop,
  Undo2,
  Redo2,
  FolderOpen,
  Save,
  Printer,
  Download,
  Grid,
  Magnet,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Layers,
  Sparkles,
  FlipHorizontal,
  FlipVertical,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  FileCode,
  Shield,
  HelpCircle,
  Group,
  Ungroup,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { ActiveToolType, ShapeType } from "../../engine/carddesigner/types";
import { BUILTIN_TEMPLATES } from "../../engine/carddesigner/templates";

interface CardDesignerToolbarProps {
  activeTool: ActiveToolType;
  setActiveTool: (tool: ActiveToolType) => void;
  onAddText: () => void;
  onAddShape: (shape: ShapeType) => void;
  onTriggerImageUpload: () => void;
  onTriggerSignatureUpload: () => void;
  onAddBarcode: () => void;
  onAddQrCode: () => void;
  onTriggerCrop: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitPage: () => void;
  onActualSize: () => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  snapToGrid: boolean;
  onToggleSnap: () => void;
  showRulers: boolean;
  onToggleRulers: () => void;
  showSafeArea: boolean;
  onToggleSafeArea: () => void;
  selectedCount: number;
  onGroupSelected: () => void;
  onUngroupSelected: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onMirrorHorizontal: () => void;
  onMirrorVertical: () => void;
  onAlign: (alignment: "left" | "center" | "right" | "top" | "middle" | "bottom" | "center-card") => void;
  onSelectTemplate: (templateId: string) => void;
  onOpenImportModal: () => void;
  onSaveProject: () => void;
  onLoadProject: () => void;
  onOpenPrintDialog: () => void;
  onOpenExportModal: () => void;
}

export const CardDesignerToolbar: React.FC<CardDesignerToolbarProps> = ({
  activeTool,
  setActiveTool,
  onAddText,
  onAddShape,
  onTriggerImageUpload,
  onTriggerSignatureUpload,
  onAddBarcode,
  onAddQrCode,
  onTriggerCrop,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  zoom,
  onZoomIn,
  onZoomOut,
  onFitPage,
  onActualSize,
  showGrid,
  onToggleGrid,
  snapToGrid,
  onToggleSnap,
  showRulers,
  onToggleRulers,
  showSafeArea,
  onToggleSafeArea,
  selectedCount,
  onGroupSelected,
  onUngroupSelected,
  onBringForward,
  onSendBackward,
  onMirrorHorizontal,
  onMirrorVertical,
  onAlign,
  onSelectTemplate,
  onOpenImportModal,
  onSaveProject,
  onLoadProject,
  onOpenPrintDialog,
  onOpenExportModal,
}) => {
  const [shapeMenuOpen, setShapeMenuOpen] = useState(false);
  const [alignMenuOpen, setAlignMenuOpen] = useState(false);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);

  return (
    <div className="h-12 bg-neutral-900 border-b border-neutral-800 px-3 flex items-center justify-between shrink-0 select-none text-xs">
      {/* Primary Tool Buttons */}
      <div className="flex items-center space-x-1">
        {/* Pointer / Pick Tool */}
        <button
          type="button"
          onClick={() => setActiveTool("select")}
          className={`p-2 rounded-lg transition-colors flex items-center space-x-1 ${
            activeTool === "select"
              ? "bg-sky-600 text-white shadow-sm"
              : "text-neutral-300 hover:text-white hover:bg-neutral-800"
          }`}
          title="Pick / Select Tool (V)"
        >
          <MousePointer className="w-4 h-4" />
        </button>

        {/* Hand / Pan Tool */}
        <button
          type="button"
          onClick={() => setActiveTool("pan")}
          className={`p-2 rounded-lg transition-colors ${
            activeTool === "pan"
              ? "bg-sky-600 text-white shadow-sm"
              : "text-neutral-300 hover:text-white hover:bg-neutral-800"
          }`}
          title="Pan Hand Tool (H / Space+Drag)"
        >
          <Hand className="w-4 h-4" />
        </button>

        <div className="h-5 w-px bg-neutral-800 mx-1" />

        {/* Text Tool */}
        <button
          type="button"
          onClick={onAddText}
          className="px-2.5 py-1.5 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors flex items-center space-x-1.5"
          title="Add Text Object (T)"
        >
          <Type className="w-4 h-4 text-emerald-400" />
          <span className="font-medium">Text</span>
        </button>

        {/* Image Tool */}
        <button
          type="button"
          onClick={onTriggerImageUpload}
          className="px-2.5 py-1.5 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors flex items-center space-x-1.5"
          title="Add Photo / Logo Image (I)"
        >
          <ImageIcon className="w-4 h-4 text-sky-400" />
          <span className="font-medium">Image</span>
        </button>

        {/* Signature Tool */}
        <button
          type="button"
          onClick={onTriggerSignatureUpload}
          className="px-2.5 py-1.5 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors flex items-center space-x-1.5"
          title="Add Transparent Signature PNG (S)"
        >
          <PenTool className="w-4 h-4 text-amber-400" />
          <span className="font-medium">Signature</span>
        </button>

        {/* Shape Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShapeMenuOpen(!shapeMenuOpen)}
            className="px-2.5 py-1.5 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors flex items-center space-x-1.5"
            title="Add Vector Shape"
          >
            <Square className="w-4 h-4 text-indigo-400" />
            <span className="font-medium">Shape</span>
          </button>
          {shapeMenuOpen && (
            <div
              className="absolute left-0 top-full mt-1 w-44 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl py-1 z-50 text-neutral-200"
              onMouseLeave={() => setShapeMenuOpen(false)}
            >
              <button
                type="button"
                onClick={() => {
                  onAddShape("rect");
                  setShapeMenuOpen(false);
                }}
                className="w-full px-3 py-2 text-left hover:bg-neutral-800 flex items-center space-x-2"
              >
                <Square className="w-4 h-4 text-indigo-400" />
                <span>Rectangle</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onAddShape("rounded-rect");
                  setShapeMenuOpen(false);
                }}
                className="w-full px-3 py-2 text-left hover:bg-neutral-800 flex items-center space-x-2"
              >
                <Square className="w-4 h-4 text-indigo-400 rounded-sm" />
                <span>Rounded Rect</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onAddShape("circle");
                  setShapeMenuOpen(false);
                }}
                className="w-full px-3 py-2 text-left hover:bg-neutral-800 flex items-center space-x-2"
              >
                <Circle className="w-4 h-4 text-indigo-400" />
                <span>Circle / Oval</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onAddShape("line");
                  setShapeMenuOpen(false);
                }}
                className="w-full px-3 py-2 text-left hover:bg-neutral-800 flex items-center space-x-2"
              >
                <Minus className="w-4 h-4 text-indigo-400" />
                <span>Divider Line</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onAddShape("star");
                  setShapeMenuOpen(false);
                }}
                className="w-full px-3 py-2 text-left hover:bg-neutral-800 flex items-center space-x-2"
              >
                <Star className="w-4 h-4 text-amber-400" />
                <span>Security Star</span>
              </button>
            </div>
          )}
        </div>

        {/* Barcode & QR Code */}
        <button
          type="button"
          onClick={onAddBarcode}
          className="px-2.5 py-1.5 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors flex items-center space-x-1.5"
          title="Add 1D Barcode (Code128)"
        >
          <BarcodeIcon className="w-4 h-4 text-rose-400" />
          <span className="font-medium">Barcode</span>
        </button>
        <button
          type="button"
          onClick={onAddQrCode}
          className="px-2.5 py-1.5 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors flex items-center space-x-1.5"
          title="Add 2D QR Code"
        >
          <QrCode className="w-4 h-4 text-purple-400" />
          <span className="font-medium">QR Code</span>
        </button>

        {/* Crop tool */}
        <button
          type="button"
          onClick={onTriggerCrop}
          className="p-2 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
          title="Crop Selected Image / Card (C)"
        >
          <Crop className="w-4 h-4 text-teal-400" />
        </button>

        <div className="h-5 w-px bg-neutral-800 mx-1" />

        {/* Object Actions: Group / Ungroup / Mirror / Order */}
        {selectedCount > 0 && (
          <div className="flex items-center space-x-1 bg-neutral-950/80 px-2 py-1 rounded-lg border border-neutral-800">
            {selectedCount > 1 && (
              <button
                type="button"
                onClick={onGroupSelected}
                className="p-1 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded"
                title="Group Objects (Ctrl+G)"
              >
                <Group className="w-3.5 h-3.5 text-sky-400" />
              </button>
            )}
            <button
              type="button"
              onClick={onUngroupSelected}
              className="p-1 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded"
              title="Ungroup (Ctrl+Shift+G)"
            >
              <Ungroup className="w-3.5 h-3.5 text-neutral-400" />
            </button>
            <button
              type="button"
              onClick={onBringForward}
              className="p-1 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded"
              title="Bring Forward (Ctrl+])"
            >
              <ArrowUp className="w-3.5 h-3.5 text-neutral-300" />
            </button>
            <button
              type="button"
              onClick={onSendBackward}
              className="p-1 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded"
              title="Send Backward (Ctrl+[)"
            >
              <ArrowDown className="w-3.5 h-3.5 text-neutral-300" />
            </button>
            <button
              type="button"
              onClick={onMirrorHorizontal}
              className="p-1 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded"
              title="Mirror Horizontally"
            >
              <FlipHorizontal className="w-3.5 h-3.5 text-neutral-300" />
            </button>
            <button
              type="button"
              onClick={onMirrorVertical}
              className="p-1 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded"
              title="Mirror Vertically"
            >
              <FlipVertical className="w-3.5 h-3.5 text-neutral-300" />
            </button>
          </div>
        )}

        {/* Alignment Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setAlignMenuOpen(!alignMenuOpen)}
            className="p-2 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
            title="Alignment & Distribution"
          >
            <AlignCenter className="w-4 h-4 text-neutral-300" />
          </button>
          {alignMenuOpen && (
            <div
              className="absolute left-0 top-full mt-1 w-48 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl p-2 z-50 text-neutral-200 grid grid-cols-3 gap-1"
              onMouseLeave={() => setAlignMenuOpen(false)}
            >
              <button
                type="button"
                onClick={() => {
                  onAlign("left");
                  setAlignMenuOpen(false);
                }}
                className="p-1.5 hover:bg-neutral-800 rounded text-center"
                title="Align Left"
              >
                <AlignLeft className="w-4 h-4 mx-auto" />
              </button>
              <button
                type="button"
                onClick={() => {
                  onAlign("center");
                  setAlignMenuOpen(false);
                }}
                className="p-1.5 hover:bg-neutral-800 rounded text-center"
                title="Align Center H"
              >
                <AlignCenter className="w-4 h-4 mx-auto" />
              </button>
              <button
                type="button"
                onClick={() => {
                  onAlign("right");
                  setAlignMenuOpen(false);
                }}
                className="p-1.5 hover:bg-neutral-800 rounded text-center"
                title="Align Right"
              >
                <AlignRight className="w-4 h-4 mx-auto" />
              </button>
              <button
                type="button"
                onClick={() => {
                  onAlign("top");
                  setAlignMenuOpen(false);
                }}
                className="p-1.5 hover:bg-neutral-800 rounded text-center text-[10px] font-bold"
                title="Align Top"
              >
                TOP
              </button>
              <button
                type="button"
                onClick={() => {
                  onAlign("middle");
                  setAlignMenuOpen(false);
                }}
                className="p-1.5 hover:bg-neutral-800 rounded text-center text-[10px] font-bold"
                title="Align Middle V"
              >
                MID
              </button>
              <button
                type="button"
                onClick={() => {
                  onAlign("bottom");
                  setAlignMenuOpen(false);
                }}
                className="p-1.5 hover:bg-neutral-800 rounded text-center text-[10px] font-bold"
                title="Align Bottom"
              >
                BOT
              </button>
              <button
                type="button"
                onClick={() => {
                  onAlign("center-card");
                  setAlignMenuOpen(false);
                }}
                className="col-span-3 mt-1 py-1 px-2 bg-neutral-800 hover:bg-neutral-700 rounded text-center text-[11px] font-semibold text-sky-400"
              >
                Center on Card Area
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Center Group: Undo, Redo, Templates, CorelDRAW/Vector Import */}
      <div className="flex items-center space-x-1.5">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className={`p-2 rounded-lg transition-colors ${
            canUndo ? "text-neutral-300 hover:text-white hover:bg-neutral-800 cursor-pointer" : "text-neutral-600 cursor-not-allowed"
          }`}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className={`p-2 rounded-lg transition-colors ${
            canRedo ? "text-neutral-300 hover:text-white hover:bg-neutral-800 cursor-pointer" : "text-neutral-600 cursor-not-allowed"
          }`}
          title="Redo (Ctrl+Shift+Z / Ctrl+Y)"
        >
          <Redo2 className="w-4 h-4" />
        </button>

        <div className="h-5 w-px bg-neutral-800 mx-1" />

        {/* Templates Picker */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setTemplateMenuOpen(!templateMenuOpen)}
            className="px-2.5 py-1.5 rounded-lg bg-neutral-800/80 hover:bg-neutral-800 text-neutral-200 transition-colors flex items-center space-x-1.5"
            title="Choose Professional Card Template"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-semibold">Templates</span>
          </button>
          {templateMenuOpen && (
            <div
              className="absolute left-0 top-full mt-1 w-64 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl p-1.5 z-50 text-neutral-200"
              onMouseLeave={() => setTemplateMenuOpen(false)}
            >
              <div className="px-2 py-1 text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                Preset Dual-Card Layouts
              </div>
              {BUILTIN_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => {
                    onSelectTemplate(tmpl.id);
                    setTemplateMenuOpen(false);
                  }}
                  className="w-full text-left p-2 hover:bg-neutral-800 rounded-lg transition-colors group"
                >
                  <div className="text-xs font-semibold text-white group-hover:text-sky-400">
                    {tmpl.name}
                  </div>
                  <div className="text-[10px] text-neutral-400 line-clamp-2 mt-0.5">
                    {tmpl.description}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Vector / CorelDRAW Import Button */}
        <button
          type="button"
          onClick={onOpenImportModal}
          className="px-2.5 py-1.5 rounded-lg bg-indigo-950/70 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-700/40 transition-colors flex items-center space-x-1.5"
          title="Import Vector / CorelDRAW SVG or PDF"
        >
          <FileCode className="w-3.5 h-3.5 text-indigo-400" />
          <span className="font-semibold">Vector / Corel Import</span>
        </button>
      </div>

      {/* Right Group: Guides, Zoom, Save/Load, Print, Export */}
      <div className="flex items-center space-x-1.5">
        {/* Grid & Snapping toggles */}
        <button
          type="button"
          onClick={onToggleGrid}
          className={`p-2 rounded-lg transition-colors ${
            showGrid ? "bg-sky-600 text-white" : "text-neutral-400 hover:text-white hover:bg-neutral-800"
          }`}
          title="Toggle Grid"
        >
          <Grid className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onToggleSnap}
          className={`p-2 rounded-lg transition-colors ${
            snapToGrid ? "bg-sky-600 text-white" : "text-neutral-400 hover:text-white hover:bg-neutral-800"
          }`}
          title="Toggle Magnet Snapping"
        >
          <Magnet className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onToggleSafeArea}
          className={`p-2 rounded-lg transition-colors ${
            showSafeArea ? "bg-amber-600 text-white" : "text-neutral-400 hover:text-white hover:bg-neutral-800"
          }`}
          title="Toggle 3mm Safe Area Guides"
        >
          <Shield className="w-4 h-4" />
        </button>

        <div className="h-5 w-px bg-neutral-800 mx-1" />

        {/* Zoom Controls */}
        <div className="flex items-center bg-neutral-950 px-1.5 py-0.5 rounded-lg border border-neutral-800">
          <button
            type="button"
            onClick={onZoomOut}
            className="p-1 text-neutral-400 hover:text-white"
            title="Zoom Out (-)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-mono text-neutral-300 px-1.5 w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={onZoomIn}
            className="p-1 text-neutral-400 hover:text-white"
            title="Zoom In (+)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onFitPage}
            className="px-1.5 py-0.5 ml-1 text-[10px] font-semibold text-neutral-300 hover:text-white bg-neutral-800 rounded"
            title="Fit A6 Page (0)"
          >
            Fit
          </button>
        </div>

        <div className="h-5 w-px bg-neutral-800 mx-1" />

        {/* Save / Load Project */}
        <button
          type="button"
          onClick={onLoadProject}
          className="p-2 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
          title="Load Saved .cardproj File"
        >
          <FolderOpen className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onSaveProject}
          className="p-2 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
          title="Save Design (.cardproj Project File)"
        >
          <Save className="w-4 h-4 text-emerald-400" />
        </button>

        {/* Print Button (Centralized native dialog) */}
        <button
          type="button"
          onClick={onOpenPrintDialog}
          className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold flex items-center space-x-1.5 shadow-sm transition-all"
          title="Print A6 Sheet via Centralized Native Print Dialog (Ctrl+P)"
        >
          <Printer className="w-4 h-4" />
          <span>Print A6</span>
        </button>

        {/* Export Button */}
        <button
          type="button"
          onClick={onOpenExportModal}
          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center space-x-1.5 shadow-sm transition-all"
          title="Export ISO PDF / PNG / JPEG (Ctrl+E)"
        >
          <Download className="w-4 h-4" />
          <span>Export</span>
        </button>
      </div>
    </div>
  );
};
