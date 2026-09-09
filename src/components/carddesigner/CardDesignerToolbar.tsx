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
  FileText,
  Shield,
  HelpCircle,
  Group,
  Ungroup,
  ArrowUp,
  ArrowDown,
  Keyboard,
  FolderKanban,
} from "lucide-react";
import { ActiveToolType, ShapeType, CardDesignerProject, CardSide, CardObjectType, CardObject } from "../../engine/carddesigner/types";
import { BUILTIN_TEMPLATES } from "../../engine/carddesigner/templates";
import { getAllPresets, CardPresetItem } from "../../engine/carddesigner/presetStorage";

export interface CardDesignerToolbarProps {
  activeTool: ActiveToolType;
  setActiveTool: (tool: ActiveToolType) => void;
  onAddText?: () => void;
  onAddShape?: (shape: ShapeType) => void;
  onTriggerImageUpload?: () => void;
  onTriggerSignatureUpload?: () => void;
  onAddBarcode?: () => void;
  onAddQrCode?: () => void;
  onTriggerCrop?: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  zoom: number;
  setZoom?: React.Dispatch<React.SetStateAction<number>>;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitPage?: () => void;
  onActualSize?: () => void;
  showGrid?: boolean;
  onToggleGrid?: () => void;
  snapToGrid?: boolean;
  onToggleSnap?: () => void;
  showRulers?: boolean;
  onToggleRulers?: () => void;
  showSafeArea?: boolean;
  onToggleSafeArea?: () => void;
  selectedCount?: number;
  onGroupSelected?: () => void;
  onUngroupSelected?: () => void;
  onBringForward?: () => void;
  onSendBackward?: () => void;
  onMirrorHorizontal?: () => void;
  onMirrorVertical?: () => void;
  onAlign?: (alignment: "left" | "center" | "right" | "top" | "middle" | "bottom" | "center-card") => void;
  onSelectTemplate?: (templateId: string) => void;
  onSelectPresetItem?: (preset: CardPresetItem) => void;
  onOpenImportModal: () => void;
  onOpenPdfImport?: () => void;
  onSaveProject?: () => void;
  onLoadProject?: () => void;
  onOpenPrintDialog?: () => void;
  onOpenExportModal?: () => void;
  onOpenShortcutsModal?: () => void;
  onOpenPresetManager?: () => void;
  project?: CardDesignerProject;
  setProject?: React.Dispatch<React.SetStateAction<CardDesignerProject>>;
  activeSide?: CardSide;
  setActiveSide?: (side: CardSide) => void;
  selectedIds?: string[];
  setSelectedIds?: (ids: string[]) => void;
  onCommitHistory?: () => void;
  onAddObject?: (type: CardObjectType, defaults?: Partial<CardObject>) => void;
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
  setZoom,
  onZoomIn,
  onZoomOut,
  onFitPage,
  onActualSize,
  showGrid = true,
  onToggleGrid,
  snapToGrid = true,
  onToggleSnap,
  showRulers = true,
  onToggleRulers,
  showSafeArea = true,
  onToggleSafeArea,
  selectedCount = 0,
  onGroupSelected,
  onUngroupSelected,
  onBringForward,
  onSendBackward,
  onMirrorHorizontal,
  onMirrorVertical,
  onAlign,
  onSelectTemplate,
  onSelectPresetItem,
  onOpenImportModal,
  onOpenPdfImport,
  onSaveProject,
  onLoadProject,
  onOpenPrintDialog,
  onOpenExportModal,
  onOpenShortcutsModal,
  onOpenPresetManager,
  project,
  setProject,
  activeSide,
  setActiveSide,
  selectedIds = [],
  setSelectedIds,
  onCommitHistory,
  onAddObject,
}) => {
  const [shapeMenuOpen, setShapeMenuOpen] = useState(false);
  const [alignMenuOpen, setAlignMenuOpen] = useState(false);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);

  const handleShapeClick = (shape: ShapeType) => {
    setShapeMenuOpen(false);
    if (typeof onAddShape === "function") {
      onAddShape(shape);
      return;
    }
    // Safe fallback if parent did not provide onAddShape
    const shapeObj: CardObject = {
      id: `shape-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: `${shape.charAt(0).toUpperCase() + shape.slice(1)} Shape`,
      type: "shape",
      targetSide: activeSide || "front",
      x: 15,
      y: 20,
      width: shape === "line" ? 40 : 25,
      height: shape === "line" ? 1 : 25,
      rotation: 0,
      opacity: 1,
      zIndex: (project ? (activeSide === "front" ? project.front.objects : project.back.objects).length + 1 : 1),
      visible: true,
      locked: false,
      aspectRatioLocked: false,
      flipX: false,
      flipY: false,
      shapeType: shape,
      fillColor: shape === "line" ? "transparent" : "#3b82f6",
      strokeColor: "#1d4ed8",
      strokeWidth: shape === "line" ? 0.8 : 0.5,
      cornerRadius: shape === "rounded-rect" ? 3 : 0,
    };
    if (onAddObject) {
      onAddObject("shape", shapeObj);
    } else if (setProject && activeSide) {
      setProject((prev) => ({
        ...prev,
        [activeSide]: {
          ...prev[activeSide],
          objects: [...prev[activeSide].objects, shapeObj],
        },
      }));
      if (setSelectedIds) setSelectedIds([shapeObj.id]);
      if (onCommitHistory) onCommitHistory();
    }
  };

  const handleTextClick = () => {
    if (typeof onAddText === "function") {
      onAddText();
      return;
    }
    const textObj: CardObject = {
      id: `text-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: "Text Box",
      type: "text",
      targetSide: activeSide || "front",
      x: 10,
      y: 15,
      width: 50,
      height: 10,
      rotation: 0,
      opacity: 1,
      zIndex: (project ? (activeSide === "front" ? project.front.objects : project.back.objects).length + 1 : 1),
      visible: true,
      locked: false,
      aspectRatioLocked: false,
      flipX: false,
      flipY: false,
      text: "Sample Heading",
      fontSize: 12,
      fontFamily: "Inter, sans-serif",
      fontWeight: "600",
      textAlign: "left",
      textColor: "#1e293b",
    };
    if (onAddObject) {
      onAddObject("text", textObj);
    } else if (setProject && activeSide) {
      setProject((prev) => ({
        ...prev,
        [activeSide]: {
          ...prev[activeSide],
          objects: [...prev[activeSide].objects, textObj],
        },
      }));
      if (setSelectedIds) setSelectedIds([textObj.id]);
      if (onCommitHistory) onCommitHistory();
    }
  };

  const handleBarcodeClick = () => {
    if (typeof onAddBarcode === "function") {
      onAddBarcode();
      return;
    }
    const barcodeObj: CardObject = {
      id: `barcode-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: "Code 128 Barcode",
      type: "barcode",
      targetSide: activeSide || "front",
      x: 12,
      y: 75,
      width: 50,
      height: 14,
      rotation: 0,
      opacity: 1,
      zIndex: (project ? (activeSide === "front" ? project.front.objects : project.back.objects).length + 1 : 1),
      visible: true,
      locked: false,
      aspectRatioLocked: true,
      flipX: false,
      flipY: false,
      barcodeType: "code128",
      barcodeValue: "ID-" + Math.floor(100000 + Math.random() * 900000),
      displayBarcodeText: true,
    };
    if (onAddObject) {
      onAddObject("barcode", barcodeObj);
    } else if (setProject && activeSide) {
      setProject((prev) => ({
        ...prev,
        [activeSide]: {
          ...prev[activeSide],
          objects: [...prev[activeSide].objects, barcodeObj],
        },
      }));
      if (setSelectedIds) setSelectedIds([barcodeObj.id]);
      if (onCommitHistory) onCommitHistory();
    }
  };

  const handleQrCodeClick = () => {
    if (typeof onAddQrCode === "function") {
      onAddQrCode();
      return;
    }
    const qrObj: CardObject = {
      id: `qrcode-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: "Authentication QR Code",
      type: "qrcode",
      targetSide: activeSide || "front",
      x: 12,
      y: 60,
      width: 20,
      height: 20,
      rotation: 0,
      opacity: 1,
      zIndex: (project ? (activeSide === "front" ? project.front.objects : project.back.objects).length + 1 : 1),
      visible: true,
      locked: false,
      aspectRatioLocked: true,
      flipX: false,
      flipY: false,
      qrValue: "https://omniscan.id/verify/" + Date.now(),
      qrForegroundColor: "#0f172a",
      qrBackgroundColor: "#ffffff",
    };
    if (onAddObject) {
      onAddObject("qrcode", qrObj);
    } else if (setProject && activeSide) {
      setProject((prev) => ({
        ...prev,
        [activeSide]: {
          ...prev[activeSide],
          objects: [...prev[activeSide].objects, qrObj],
        },
      }));
      if (setSelectedIds) setSelectedIds([qrObj.id]);
      if (onCommitHistory) onCommitHistory();
    }
  };

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
          title="Pick & Select Tool (V)"
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
          onClick={handleTextClick}
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
                onClick={() => handleShapeClick("rect")}
                className="w-full px-3 py-2 text-left hover:bg-neutral-800 flex items-center space-x-2"
              >
                <Square className="w-4 h-4 text-indigo-400" />
                <span>Rectangle</span>
              </button>
              <button
                type="button"
                onClick={() => handleShapeClick("rounded-rect")}
                className="w-full px-3 py-2 text-left hover:bg-neutral-800 flex items-center space-x-2"
              >
                <Square className="w-4 h-4 text-indigo-400 rounded-sm" />
                <span>Rounded Rect</span>
              </button>
              <button
                type="button"
                onClick={() => handleShapeClick("circle")}
                className="w-full px-3 py-2 text-left hover:bg-neutral-800 flex items-center space-x-2"
              >
                <Circle className="w-4 h-4 text-indigo-400" />
                <span>Circle / Oval</span>
              </button>
              <button
                type="button"
                onClick={() => handleShapeClick("line")}
                className="w-full px-3 py-2 text-left hover:bg-neutral-800 flex items-center space-x-2"
              >
                <Minus className="w-4 h-4 text-indigo-400" />
                <span>Divider Line</span>
              </button>
              <button
                type="button"
                onClick={() => handleShapeClick("star")}
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
          onClick={handleBarcodeClick}
          className="px-2.5 py-1.5 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors flex items-center space-x-1.5"
          title="Add 1D Barcode (Code128)"
        >
          <BarcodeIcon className="w-4 h-4 text-rose-400" />
          <span className="font-medium">Barcode</span>
        </button>
        <button
          type="button"
          onClick={handleQrCodeClick}
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
              className="absolute left-0 top-full mt-1 w-72 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl p-1.5 z-50 text-neutral-200 max-h-96 overflow-y-auto"
              onMouseLeave={() => setTemplateMenuOpen(false)}
            >
              <div className="px-2 py-1 text-[11px] font-bold text-neutral-400 uppercase tracking-wider flex items-center justify-between">
                <span>Preset Dual-Card Layouts</span>
                {onOpenPresetManager && (
                  <button
                    type="button"
                    onClick={() => {
                      setTemplateMenuOpen(false);
                      onOpenPresetManager();
                    }}
                    className="text-[10px] text-sky-400 hover:text-sky-300 font-semibold lowercase tracking-normal"
                  >
                    Manage
                  </button>
                )}
              </div>
              {getAllPresets().map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    if (onSelectPresetItem) {
                      onSelectPresetItem(preset);
                    } else if (onSelectTemplate) {
                      onSelectTemplate(preset.slotId || preset.id);
                    }
                    setTemplateMenuOpen(false);
                  }}
                  className="w-full text-left p-2 hover:bg-neutral-800 rounded-lg transition-colors group block"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white group-hover:text-sky-400">
                      {preset.name}
                    </span>
                    {preset.isReplacedSlot && (
                      <span className="text-[9px] bg-sky-500/20 text-sky-300 border border-sky-500/40 px-1.5 py-0.5 rounded font-mono font-bold">
                        Replaced
                      </span>
                    )}
                    {preset.isCustom && !preset.isReplacedSlot && (
                      <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded font-mono font-bold">
                        Custom
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-neutral-400 line-clamp-2 mt-0.5">
                    {preset.description}
                  </div>
                </button>
              ))}

              {onOpenPresetManager && (
                <div className="pt-1.5 mt-1 border-t border-neutral-800">
                  <button
                    type="button"
                    onClick={() => {
                      setTemplateMenuOpen(false);
                      onOpenPresetManager();
                    }}
                    className="w-full text-center py-1.5 px-2 bg-neutral-800/90 hover:bg-neutral-800 text-sky-300 hover:text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors"
                  >
                    <FolderKanban className="w-3.5 h-3.5" />
                    <span>Manage / Replace Presets...</span>
                  </button>
                </div>
              )}
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

        {/* PDF Page Import Button */}
        {onOpenPdfImport && (
          <button
            type="button"
            onClick={onOpenPdfImport}
            className="px-2.5 py-1.5 rounded-lg bg-red-950/70 hover:bg-red-900/80 text-red-300 border border-red-700/40 transition-colors flex items-center space-x-1.5"
            title="Import Page from PDF Document"
          >
            <FileText className="w-3.5 h-3.5 text-red-400" />
            <span className="font-semibold">PDF Page</span>
          </button>
        )}
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
            title="Fit A6 Page (Shift+0)"
          >
            Fit
          </button>
          <button
            type="button"
            onClick={onActualSize}
            className="px-1.5 py-0.5 ml-1 text-[10px] font-semibold text-neutral-300 hover:text-white bg-neutral-800 rounded"
            title="Reset Zoom to 100% (0)"
          >
            100%
          </button>
        </div>

        <div className="h-5 w-px bg-neutral-800 mx-1" />

        {/* Preset & Template Manager */}
        {onOpenPresetManager && (
          <button
            type="button"
            onClick={onOpenPresetManager}
            className="p-2 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
            title="Manage Presets & Replace Default Slots"
          >
            <FolderKanban className="w-4 h-4 text-amber-400" />
          </button>
        )}

        {/* Keyboard Shortcuts Reference */}
        {onOpenShortcutsModal && (
          <button
            type="button"
            onClick={onOpenShortcutsModal}
            className="p-2 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
            title="Keyboard Shortcuts Reference (?)"
          >
            <Keyboard className="w-4 h-4 text-sky-400" />
          </button>
        )}

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
