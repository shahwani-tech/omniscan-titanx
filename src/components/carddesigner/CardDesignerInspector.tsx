/**
 * CardDesignerInspector.tsx
 * 
 * Right inspector sidebar for professional vector styling and numeric transform control:
 * - Precision millimeter geometry with keyboard step shortcuts (Arrow, Shift+Arrow, Alt+Arrow)
 * - Text styling & Dynamic ID field injection (Name, ID, Designation, Blood Group, etc.)
 * - Image filters (Brightness, Contrast, Saturation, Sharpness, Deskew) & Crop trigger
 * - Shape fills, strokes, and corner radius
 * - Barcode and QR code configuration
 * - Card & A6 page geometry settings
 */

import React, { useState } from "react";
import {
  CardDesignerProject,
  CardObject,
  CardSide,
  ShapeType,
  BarcodeType,
  CARD_PRESETS,
  CardPresetType,
} from "../../engine/carddesigner/types";
import {
  getObjectCardRelativeCoords,
  zoneCoordsFromCardRelative,
  alignObjectToCardBoundary,
  distributeObjectsEvenly,
} from "../../engine/carddesigner/cardGeometry";
import {
  Sliders,
  Type,
  Maximize2,
  RotateCw,
  Eye,
  Lock,
  Unlock,
  FlipHorizontal,
  FlipVertical,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Bold,
  Italic,
  Underline,
  Crop,
  Sparkles,
  Palette,
  Shield,
  Layers,
  Settings,
  RefreshCw,
  FileSpreadsheet,
} from "lucide-react";
import { generateBarcodeDataUrl, generateQrCodeDataUrl } from "../../engine/carddesigner/barcodeGenerator";

interface CardDesignerInspectorProps {
  project: CardDesignerProject;
  setProject: React.Dispatch<React.SetStateAction<CardDesignerProject>>;
  activeSide: CardSide;
  setActiveSide: (side: CardSide) => void;
  selectedIds: string[];
  onCommitHistory: () => void;
  onOpenCropModal: (obj: CardObject) => void;
  onOpenBackgroundStudio?: (obj: CardObject) => void;
  onOpenCardBackgroundStudio?: (side: CardSide) => void;
}

const COMMON_FONTS = [
  "Plus Jakarta Sans",
  "Inter",
  "JetBrains Mono",
  "Arial",
  "Times New Roman",
  "Courier New",
  "Georgia",
  "Impact",
  "Cinzel",
];

const PRESET_DYNAMIC_FIELDS = [
  { key: "employeeName", label: "Full Name", sample: "ALEXANDER M. HAYES" },
  { key: "fatherName", label: "Father Name", sample: "ROBERT H. HAYES" },
  { key: "employeeId", label: "Employee ID", sample: "EMP-84920-T" },
  { key: "designation", label: "Designation", sample: "Senior Systems Engineer" },
  { key: "department", label: "Department", sample: "Aero Engineering" },
  { key: "bloodGroup", label: "Blood Group", sample: "O+ POSITIVE" },
  { key: "dob", label: "Date of Birth", sample: "14 AUG 1992" },
  { key: "validThru", label: "Expiry Date", sample: "DEC 2028" },
  { key: "companyName", label: "Company", sample: "TITAN DEFENSE LTD" },
  { key: "emergencyContact", label: "Emergency Phone", sample: "+1 (800) 555-0199" },
  { key: "cardNumber", label: "Card Number", sample: "CRD-990214-X" },
  { key: "address", label: "Official Address", sample: "Tech Park, Building 4" },
];

export const CardDesignerInspector: React.FC<CardDesignerInspectorProps> = ({
  project,
  setProject,
  activeSide,
  setActiveSide,
  selectedIds,
  onCommitHistory,
  onOpenCropModal,
  onOpenBackgroundStudio,
  onOpenCardBackgroundStudio,
}) => {
  const [activeTab, setActiveTab] = useState<"properties" | "sheet">("properties");

  const allObjects = [...project.front.objects, ...project.back.objects];
  const selectedObjects = allObjects.filter((o) => selectedIds.includes(o.id));
  const primaryObject = selectedObjects.length > 0 ? selectedObjects[0] : null;

  const updatePrimaryObject = (updates: Partial<CardObject>) => {
    if (!primaryObject) return;
    setProject((prev) => {
      const updateList = (list: CardObject[]) =>
        list.map((o) => (o.id === primaryObject.id ? { ...o, ...updates } : o));
      return {
        ...prev,
        front: { ...prev.front, objects: updateList(prev.front.objects) },
        back: { ...prev.back, objects: updateList(prev.back.objects) },
      };
    });
    onCommitHistory();
  };

  const updateMultipleObjects = (updatesMap: Map<string, Partial<CardObject>>) => {
    setProject((prev) => {
      const updateList = (list: CardObject[]) =>
        list.map((o) => {
          const up = updatesMap.get(o.id);
          return up ? { ...o, ...up } : o;
        });
      return {
        ...prev,
        front: { ...prev.front, objects: updateList(prev.front.objects) },
        back: { ...prev.back, objects: updateList(prev.back.objects) },
      };
    });
    onCommitHistory();
  };

  const handleStepNumeric = (
    e: React.KeyboardEvent<HTMLInputElement>,
    field: "x" | "y" | "width" | "height" | "rotation" | "opacity",
    currentVal: number,
    min: number = -100,
    max: number = 500
  ) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      let step = 1;
      if (e.shiftKey) step = 10;
      else if (e.altKey) step = 0.1;

      const delta = e.key === "ArrowUp" ? step : -step;
      const newVal = Math.max(min, Math.min(max, Math.round((currentVal + delta) * 10) / 10));
      updatePrimaryObject({ [field]: newVal });
    }
  };

  return (
    <div className="w-72 bg-neutral-900 border-l border-neutral-800 flex flex-col shrink-0 text-neutral-200 select-none text-xs">
      {/* Inspector Header Tabs */}
      <div className="h-10 border-b border-neutral-800 px-3 flex items-center justify-between shrink-0 bg-neutral-900/90">
        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={() => setActiveTab("properties")}
            className={`px-3 py-1 rounded-md font-semibold transition-colors flex items-center space-x-1.5 ${
              activeTab === "properties"
                ? "bg-neutral-800 text-sky-400"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Inspector</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("sheet")}
            className={`px-3 py-1 rounded-md font-semibold transition-colors flex items-center space-x-1.5 ${
              activeTab === "sheet"
                ? "bg-neutral-800 text-sky-400"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Card Setup</span>
          </button>
        </div>

        {primaryObject && (
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">
            {primaryObject.type}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {activeTab === "properties" ? (
          selectedObjects.length > 1 ? (
            /* =========================================================
               MULTI-SELECTION INSPECTOR & ALIGNMENT
               ========================================================= */
            <div className="space-y-4">
              <div className="bg-sky-950/40 p-2.5 rounded-lg border border-sky-800/50">
                <span className="font-bold text-sky-300 text-xs block">
                  {selectedObjects.length} Objects Selected
                </span>
                <span className="text-[10px] text-neutral-400">
                  Align and distribute across current selection
                </span>
              </div>

              {/* Multi-Object Alignment */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                  Align Selection
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const minX = Math.min(...selectedObjects.map((o) => o.x));
                      const map = new Map<string, Partial<CardObject>>();
                      selectedObjects.forEach((o) => map.set(o.id, { x: minX }));
                      updateMultipleObjects(map);
                    }}
                    className="p-1.5 bg-neutral-950 hover:bg-sky-700 text-neutral-200 border border-neutral-700 rounded text-center text-[10px] font-medium"
                    title="Align Left Edges"
                  >
                    Align Left
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const avgCenterX =
                        selectedObjects.reduce((acc, o) => acc + o.x + o.width / 2, 0) /
                        selectedObjects.length;
                      const map = new Map<string, Partial<CardObject>>();
                      selectedObjects.forEach((o) =>
                        map.set(o.id, { x: Math.round((avgCenterX - o.width / 2) * 10) / 10 })
                      );
                      updateMultipleObjects(map);
                    }}
                    className="p-1.5 bg-neutral-950 hover:bg-sky-700 text-neutral-200 border border-neutral-700 rounded text-center text-[10px] font-medium"
                    title="Align Center Horizontally"
                  >
                    Center H
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const maxRight = Math.max(...selectedObjects.map((o) => o.x + o.width));
                      const map = new Map<string, Partial<CardObject>>();
                      selectedObjects.forEach((o) =>
                        map.set(o.id, { x: Math.round((maxRight - o.width) * 10) / 10 })
                      );
                      updateMultipleObjects(map);
                    }}
                    className="p-1.5 bg-neutral-950 hover:bg-sky-700 text-neutral-200 border border-neutral-700 rounded text-center text-[10px] font-medium"
                    title="Align Right Edges"
                  >
                    Align Right
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const minY = Math.min(...selectedObjects.map((o) => o.y));
                      const map = new Map<string, Partial<CardObject>>();
                      selectedObjects.forEach((o) => map.set(o.id, { y: minY }));
                      updateMultipleObjects(map);
                    }}
                    className="p-1.5 bg-neutral-950 hover:bg-sky-700 text-neutral-200 border border-neutral-700 rounded text-center text-[10px] font-medium"
                    title="Align Top Edges"
                  >
                    Align Top
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const avgCenterY =
                        selectedObjects.reduce((acc, o) => acc + o.y + o.height / 2, 0) /
                        selectedObjects.length;
                      const map = new Map<string, Partial<CardObject>>();
                      selectedObjects.forEach((o) =>
                        map.set(o.id, { y: Math.round((avgCenterY - o.height / 2) * 10) / 10 })
                      );
                      updateMultipleObjects(map);
                    }}
                    className="p-1.5 bg-neutral-950 hover:bg-sky-700 text-neutral-200 border border-neutral-700 rounded text-center text-[10px] font-medium"
                    title="Align Middle Vertically"
                  >
                    Middle V
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const maxBottom = Math.max(...selectedObjects.map((o) => o.y + o.height));
                      const map = new Map<string, Partial<CardObject>>();
                      selectedObjects.forEach((o) =>
                        map.set(o.id, { y: Math.round((maxBottom - o.height) * 10) / 10 })
                      );
                      updateMultipleObjects(map);
                    }}
                    className="p-1.5 bg-neutral-950 hover:bg-sky-700 text-neutral-200 border border-neutral-700 rounded text-center text-[10px] font-medium"
                    title="Align Bottom Edges"
                  >
                    Align Bottom
                  </button>
                </div>
              </div>

              {/* Distribute Space Evenly */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                  Distribute Evenly
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const results = distributeObjectsEvenly(selectedObjects, "horizontal");
                      const map = new Map<string, Partial<CardObject>>();
                      results.forEach((r) => {
                        if (r.x !== undefined) map.set(r.id, { x: r.x });
                      });
                      updateMultipleObjects(map);
                    }}
                    disabled={selectedObjects.length < 3}
                    className="p-2 bg-neutral-950 hover:bg-sky-700 disabled:opacity-40 text-neutral-200 border border-neutral-700 rounded text-center text-[10px] font-medium"
                  >
                    Distribute H (3+)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const results = distributeObjectsEvenly(selectedObjects, "vertical");
                      const map = new Map<string, Partial<CardObject>>();
                      results.forEach((r) => {
                        if (r.y !== undefined) map.set(r.id, { y: r.y });
                      });
                      updateMultipleObjects(map);
                    }}
                    disabled={selectedObjects.length < 3}
                    className="p-2 bg-neutral-950 hover:bg-sky-700 disabled:opacity-40 text-neutral-200 border border-neutral-700 rounded text-center text-[10px] font-medium"
                  >
                    Distribute V (3+)
                  </button>
                </div>
              </div>
            </div>
          ) : primaryObject ? (
            <>
              {/* OBJECT HEADER & QUICK ACTIONS */}
              <div className="flex items-center justify-between bg-neutral-950/60 p-2 rounded-lg border border-neutral-800">
                <span className="font-bold text-white truncate mr-2">
                  {primaryObject.name}
                </span>
                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() =>
                      updatePrimaryObject({ locked: !primaryObject.locked })
                    }
                    className="p-1 text-neutral-400 hover:text-white rounded"
                    title={primaryObject.locked ? "Unlock Object" : "Lock Object"}
                  >
                    {primaryObject.locked ? (
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                    ) : (
                      <Unlock className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updatePrimaryObject({ visible: !primaryObject.visible })
                    }
                    className="p-1 text-neutral-400 hover:text-white rounded"
                    title="Toggle Visibility"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* TRANSFORM & GEOMETRY (MILLIMETERS) */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Transform (mm)</span>
                  <span className="text-[10px] text-neutral-500 font-mono">Shift/Alt=Step</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-neutral-400 block mb-0.5">X (mm)</label>
                    <input
                      type="number"
                      value={primaryObject.x}
                      step={0.5}
                      onKeyDown={(e) => handleStepNumeric(e, "x", primaryObject.x)}
                      onChange={(e) => updatePrimaryObject({ x: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-white font-mono text-xs focus:border-sky-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-400 block mb-0.5">Y (mm)</label>
                    <input
                      type="number"
                      value={primaryObject.y}
                      step={0.5}
                      onKeyDown={(e) => handleStepNumeric(e, "y", primaryObject.y)}
                      onChange={(e) => updatePrimaryObject({ y: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-white font-mono text-xs focus:border-sky-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-400 block mb-0.5">Width (mm)</label>
                    <input
                      type="number"
                      value={primaryObject.width}
                      step={0.5}
                      min={1}
                      onKeyDown={(e) => handleStepNumeric(e, "width", primaryObject.width, 1)}
                      onChange={(e) => updatePrimaryObject({ width: Math.max(1, parseFloat(e.target.value) || 1) })}
                      className="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-white font-mono text-xs focus:border-sky-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-400 block mb-0.5">Height (mm)</label>
                    <input
                      type="number"
                      value={primaryObject.height}
                      step={0.5}
                      min={1}
                      onKeyDown={(e) => handleStepNumeric(e, "height", primaryObject.height, 1)}
                      onChange={(e) => updatePrimaryObject({ height: Math.max(1, parseFloat(e.target.value) || 1) })}
                      className="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-white font-mono text-xs focus:border-sky-500 outline-none"
                    />
                  </div>
                </div>

                {/* Rotation & Flips */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="text-[10px] text-neutral-400 block mb-0.5">Rotation (°)</label>
                    <div className="flex items-center space-x-1">
                      <input
                        type="number"
                        value={primaryObject.rotation || 0}
                        step={5}
                        min={0}
                        max={360}
                        onKeyDown={(e) => handleStepNumeric(e, "rotation", primaryObject.rotation || 0, 0, 360)}
                        onChange={(e) => updatePrimaryObject({ rotation: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-white font-mono text-xs focus:border-sky-500 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updatePrimaryObject({
                            rotation: ((primaryObject.rotation || 0) + 90) % 360,
                          })
                        }
                        className="p-1 bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-300"
                        title="Rotate 90°"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-neutral-400 block mb-0.5">Mirror / Flip</label>
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => updatePrimaryObject({ flipX: !primaryObject.flipX })}
                        className={`flex-1 py-1 rounded border flex items-center justify-center ${
                          primaryObject.flipX
                            ? "bg-sky-600 border-sky-500 text-white"
                            : "bg-neutral-950 border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                        }`}
                        title="Mirror Horizontally"
                      >
                        <FlipHorizontal className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => updatePrimaryObject({ flipY: !primaryObject.flipY })}
                        className={`flex-1 py-1 rounded border flex items-center justify-center ${
                          primaryObject.flipY
                            ? "bg-sky-600 border-sky-500 text-white"
                            : "bg-neutral-950 border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                        }`}
                        title="Mirror Vertically"
                      >
                        <FlipVertical className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Opacity Slider */}
                <div className="pt-2">
                  <div className="flex justify-between text-[10px] text-neutral-400 mb-1">
                    <span>Opacity</span>
                    <span className="font-mono text-white">
                      {Math.round((primaryObject.opacity ?? 1) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={primaryObject.opacity ?? 1}
                    onChange={(e) =>
                      updatePrimaryObject({ opacity: parseFloat(e.target.value) })
                    }
                    className="w-full accent-sky-500 cursor-pointer"
                  />
                </div>

                {/* Blend Mode */}
                <div className="pt-1">
                  <label className="text-[10px] text-neutral-400 block mb-0.5">Blend Mode</label>
                  <select
                    value={primaryObject.blendMode || "normal"}
                    onChange={(e) => updatePrimaryObject({ blendMode: e.target.value as any })}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-white text-xs outline-none"
                  >
                    <option value="normal">Normal</option>
                    <option value="multiply">Multiply (Darken / Overlay)</option>
                    <option value="screen">Screen (Lighten)</option>
                    <option value="overlay">Overlay (Contrast)</option>
                    <option value="darken">Darken</option>
                    <option value="lighten">Lighten</option>
                    <option value="color-dodge">Color Dodge</option>
                    <option value="color-burn">Color Burn</option>
                    <option value="difference">Difference</option>
                  </select>
                </div>

                {/* Relative to Card Cut-Line */}
                <div className="bg-sky-950/40 p-2.5 rounded border border-sky-800/40 space-y-2 mt-2">
                  <div className="text-[10px] font-bold text-sky-400 flex items-center justify-between">
                    <span>Cut-Line Offset ({project.cardPreset ? project.cardPreset.toUpperCase() : "CR-80"})</span>
                    <span className="text-[9px] font-mono text-sky-300/70">From Card Edge</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] text-neutral-400 block mb-0.5">Rel X (mm)</label>
                      <input
                        type="number"
                        step={0.5}
                        value={getObjectCardRelativeCoords(primaryObject, project).relX}
                        onChange={(e) => {
                          const relX = parseFloat(e.target.value) || 0;
                          const relY = getObjectCardRelativeCoords(primaryObject, project).relY;
                          const newCoords = zoneCoordsFromCardRelative(relX, relY, project);
                          updatePrimaryObject({ x: newCoords.x });
                        }}
                        className="w-full bg-neutral-950 border border-sky-700/60 rounded px-1.5 py-1 text-sky-200 font-mono text-xs outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-neutral-400 block mb-0.5">Rel Y (mm)</label>
                      <input
                        type="number"
                        step={0.5}
                        value={getObjectCardRelativeCoords(primaryObject, project).relY}
                        onChange={(e) => {
                          const relY = parseFloat(e.target.value) || 0;
                          const relX = getObjectCardRelativeCoords(primaryObject, project).relX;
                          const newCoords = zoneCoordsFromCardRelative(relX, relY, project);
                          updatePrimaryObject({ y: newCoords.y });
                        }}
                        className="w-full bg-neutral-950 border border-sky-700/60 rounded px-1.5 py-1 text-sky-200 font-mono text-xs outline-none"
                      />
                    </div>
                  </div>

                  {/* Quick Card Alignment Buttons */}
                  <div className="pt-1">
                    <span className="text-[9px] text-neutral-400 block mb-1">Align to Card:</span>
                    <div className="grid grid-cols-4 gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const updates = alignObjectToCardBoundary(primaryObject, "center-both", project);
                          updatePrimaryObject(updates);
                        }}
                        className="py-1 px-1 text-[10px] bg-neutral-800 hover:bg-sky-700 text-neutral-200 rounded text-center truncate font-medium"
                        title="Center object inside true card cut-line"
                      >
                        Center
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const updates = alignObjectToCardBoundary(primaryObject, "center-h", project);
                          updatePrimaryObject(updates);
                        }}
                        className="py-1 px-1 text-[10px] bg-neutral-800 hover:bg-sky-700 text-neutral-200 rounded text-center truncate font-medium"
                        title="Center horizontally inside true card"
                      >
                        Center H
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const updates = alignObjectToCardBoundary(primaryObject, "center-v", project);
                          updatePrimaryObject(updates);
                        }}
                        className="py-1 px-1 text-[10px] bg-neutral-800 hover:bg-sky-700 text-neutral-200 rounded text-center truncate font-medium"
                        title="Center vertically inside true card"
                      >
                        Center V
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const updates = alignObjectToCardBoundary(primaryObject, "left", project);
                          updatePrimaryObject(updates);
                        }}
                        className="py-1 px-1 text-[10px] bg-neutral-800 hover:bg-sky-700 text-neutral-200 rounded text-center truncate font-medium"
                        title="Align to Card Left Cut-line"
                      >
                        Left
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const updates = alignObjectToCardBoundary(primaryObject, "right", project);
                          updatePrimaryObject(updates);
                        }}
                        className="py-1 px-1 text-[10px] bg-neutral-800 hover:bg-sky-700 text-neutral-200 rounded text-center truncate font-medium"
                        title="Align to Card Right Cut-line"
                      >
                        Right
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const updates = alignObjectToCardBoundary(primaryObject, "top", project);
                          updatePrimaryObject(updates);
                        }}
                        className="py-1 px-1 text-[10px] bg-neutral-800 hover:bg-sky-700 text-neutral-200 rounded text-center truncate font-medium"
                        title="Align to Card Top Cut-line"
                      >
                        Top
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const updates = alignObjectToCardBoundary(primaryObject, "bottom", project);
                          updatePrimaryObject(updates);
                        }}
                        className="py-1 px-1 text-[10px] bg-neutral-800 hover:bg-sky-700 text-neutral-200 rounded text-center truncate font-medium"
                        title="Align to Card Bottom Cut-line"
                      >
                        Bottom
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="h-px bg-neutral-800" />

              {/* =========================================================
                  TEXT-SPECIFIC PROPERTIES
                 ========================================================= */}
              {primaryObject.type === "text" && (
                <div className="space-y-3">
                  <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                    Text Styling
                  </div>

                  {/* Textarea Content */}
                  <div>
                    <label className="text-[10px] text-neutral-400 block mb-1">Content</label>
                    <textarea
                      rows={2}
                      value={primaryObject.text || ""}
                      onChange={(e) => updatePrimaryObject({ text: e.target.value })}
                      className="w-full bg-neutral-950 border border-neutral-700 rounded p-2 text-white text-xs outline-none focus:border-sky-500"
                    />
                  </div>

                  {/* Font Family & Size */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-neutral-400 block mb-1">Font Family</label>
                      <select
                        value={primaryObject.fontFamily || "Plus Jakarta Sans"}
                        onChange={(e) => updatePrimaryObject({ fontFamily: e.target.value })}
                        className="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-white text-xs outline-none"
                      >
                        {COMMON_FONTS.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-neutral-400 block mb-1">Font Size</label>
                      <input
                        type="number"
                        min={4}
                        max={72}
                        value={primaryObject.fontSize || 10}
                        onChange={(e) =>
                          updatePrimaryObject({ fontSize: parseFloat(e.target.value) || 10 })
                        }
                        className="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-white font-mono text-xs outline-none"
                      />
                    </div>
                  </div>

                  {/* Format & Alignment */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() =>
                          updatePrimaryObject({
                            fontWeight: primaryObject.fontWeight === "bold" ? "normal" : "bold",
                          })
                        }
                        className={`p-1.5 rounded border ${
                          primaryObject.fontWeight === "bold"
                            ? "bg-sky-600 border-sky-500 text-white"
                            : "bg-neutral-950 border-neutral-700 text-neutral-400 hover:text-white"
                        }`}
                        title="Bold"
                      >
                        <Bold className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updatePrimaryObject({
                            fontStyle: primaryObject.fontStyle === "italic" ? "normal" : "italic",
                          })
                        }
                        className={`p-1.5 rounded border ${
                          primaryObject.fontStyle === "italic"
                            ? "bg-sky-600 border-sky-500 text-white"
                            : "bg-neutral-950 border-neutral-700 text-neutral-400 hover:text-white"
                        }`}
                        title="Italic"
                      >
                        <Italic className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updatePrimaryObject({
                            textDecoration:
                              primaryObject.textDecoration === "underline" ? "none" : "underline",
                          })
                        }
                        className={`p-1.5 rounded border ${
                          primaryObject.textDecoration === "underline"
                            ? "bg-sky-600 border-sky-500 text-white"
                            : "bg-neutral-950 border-neutral-700 text-neutral-400 hover:text-white"
                        }`}
                        title="Underline"
                      >
                        <Underline className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center space-x-1">
                      {(["left", "center", "right"] as const).map((align) => (
                        <button
                          key={align}
                          type="button"
                          onClick={() => updatePrimaryObject({ textAlign: align })}
                          className={`p-1.5 rounded border ${
                            primaryObject.textAlign === align
                              ? "bg-sky-600 border-sky-500 text-white"
                              : "bg-neutral-950 border-neutral-700 text-neutral-400 hover:text-white"
                          }`}
                        >
                          {align === "left" && <AlignLeft className="w-3.5 h-3.5" />}
                          {align === "center" && <AlignCenter className="w-3.5 h-3.5" />}
                          {align === "right" && <AlignRight className="w-3.5 h-3.5" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Text Color & Background Fill */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="text-[10px] text-neutral-400 block mb-1">Text Color</label>
                      <div className="flex items-center space-x-1 bg-neutral-950 border border-neutral-700 rounded p-1">
                        <input
                          type="color"
                          value={primaryObject.textColor || "#000000"}
                          onChange={(e) => updatePrimaryObject({ textColor: e.target.value })}
                          className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                        />
                        <span className="font-mono text-[11px] text-white uppercase">
                          {primaryObject.textColor || "#000000"}
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-neutral-400 block mb-1">Box Fill</label>
                      <div className="flex items-center space-x-1 bg-neutral-950 border border-neutral-700 rounded p-1">
                        <input
                          type="color"
                          value={primaryObject.textBackgroundColor || "#ffffff"}
                          onChange={(e) =>
                            updatePrimaryObject({ textBackgroundColor: e.target.value })
                          }
                          className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            updatePrimaryObject({ textBackgroundColor: "transparent" })
                          }
                          className="text-[10px] text-neutral-400 hover:text-white ml-auto"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* QUICK DYNAMIC IDENTITY FIELD BUTTONS */}
                  <div className="pt-2">
                    <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
                      <FileSpreadsheet className="w-3 h-3 text-emerald-400" />
                      <span>Set as Standard ID Field</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 max-h-36 overflow-y-auto pr-1">
                      {PRESET_DYNAMIC_FIELDS.map((field) => (
                        <button
                          key={field.key}
                          type="button"
                          onClick={() =>
                            updatePrimaryObject({
                              text: field.sample,
                              dynamicFieldKey: field.key,
                              name: field.label,
                            })
                          }
                          className="text-left px-2 py-1 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded text-[10px] text-neutral-300 hover:text-sky-400 truncate"
                          title={`Insert ${field.label}: "${field.sample}"`}
                        >
                          {field.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* =========================================================
                  SHAPE-SPECIFIC PROPERTIES
                 ========================================================= */}
              {primaryObject.type === "shape" && (
                <div className="space-y-3">
                  <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                    Shape Styling
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-neutral-400 block mb-1">Fill Color</label>
                      <div className="flex items-center space-x-1 bg-neutral-950 border border-neutral-700 rounded p-1">
                        <input
                          type="color"
                          value={primaryObject.fillColor || "#0ea5e9"}
                          onChange={(e) => updatePrimaryObject({ fillColor: e.target.value })}
                          className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                        />
                        <button
                          type="button"
                          onClick={() => updatePrimaryObject({ fillColor: "transparent" })}
                          className="text-[10px] text-neutral-400 hover:text-white ml-auto"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-neutral-400 block mb-1">Border Color</label>
                      <div className="flex items-center space-x-1 bg-neutral-950 border border-neutral-700 rounded p-1">
                        <input
                          type="color"
                          value={primaryObject.strokeColor || "#000000"}
                          onChange={(e) => updatePrimaryObject({ strokeColor: e.target.value })}
                          className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                        />
                        <button
                          type="button"
                          onClick={() => updatePrimaryObject({ strokeColor: "transparent" })}
                          className="text-[10px] text-neutral-400 hover:text-white ml-auto"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-neutral-400 block mb-1">Stroke Width (mm)</label>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        step={0.2}
                        value={primaryObject.strokeWidth || 0}
                        onChange={(e) =>
                          updatePrimaryObject({ strokeWidth: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-white font-mono text-xs outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-neutral-400 block mb-1">Corner Radius (mm)</label>
                      <input
                        type="number"
                        min={0}
                        max={50}
                        step={0.5}
                        value={primaryObject.cornerRadius || 0}
                        onChange={(e) =>
                          updatePrimaryObject({ cornerRadius: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-white font-mono text-xs outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* =========================================================
                  IMAGE & SIGNATURE PROPERTIES
                 ========================================================= */}
              {(primaryObject.type === "image" || primaryObject.type === "signature") && (
                <div className="space-y-3">
                  <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Image Controls</span>
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => onOpenCropModal(primaryObject)}
                        className="px-2 py-0.5 bg-sky-600 hover:bg-sky-500 text-white rounded text-[10px] font-semibold flex items-center space-x-1"
                      >
                        <Crop className="w-3 h-3" />
                        <span>Crop</span>
                      </button>
                      {onOpenBackgroundStudio && (
                        <button
                          type="button"
                          onClick={() => onOpenBackgroundStudio(primaryObject)}
                          className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-semibold flex items-center space-x-1"
                          title="Centralized Background Studio & AI Matting"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>BG</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Fit Mode */}
                  <div>
                    <label className="text-[10px] text-neutral-400 block mb-1">Fit Mode</label>
                    <select
                      value={primaryObject.fitMode || "contain"}
                      onChange={(e) =>
                        updatePrimaryObject({ fitMode: e.target.value as "contain" | "cover" | "fill" })
                      }
                      className="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-white text-xs outline-none"
                    >
                      <option value="contain">Contain (Preserve Full Aspect)</option>
                      <option value="cover">Cover (Fill Frame Entirely)</option>
                      <option value="fill">Stretch / Fill Box</option>
                    </select>
                  </div>

                  {/* Mask Shape (Circle, Rounded, Rectangle) */}
                  <div className="space-y-1.5 pt-1">
                    <label className="text-[10px] text-neutral-400 block mb-0.5">Photo Mask Shape</label>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { id: "none", label: "Rect" },
                        { id: "rounded-rect", label: "Rounded" },
                        { id: "circle", label: "Circle / Oval" },
                      ].map((mask) => (
                        <button
                          key={mask.id}
                          type="button"
                          onClick={() => updatePrimaryObject({ maskShape: mask.id as any })}
                          className={`py-1 text-[10px] rounded border font-medium ${
                            (primaryObject.maskShape || "none") === mask.id
                              ? "bg-sky-600 border-sky-500 text-white"
                              : "bg-neutral-950 border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                          }`}
                        >
                          {mask.label}
                        </button>
                      ))}
                    </div>
                    {primaryObject.maskShape === "rounded-rect" && (
                      <div className="pt-1">
                        <div className="flex justify-between text-[10px] text-neutral-400 mb-0.5">
                          <span>Mask Radius (mm)</span>
                          <span className="font-mono text-white">
                            {primaryObject.maskCornerRadius || 3}mm
                          </span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={25}
                          step={0.5}
                          value={primaryObject.maskCornerRadius || 3}
                          onChange={(e) =>
                            updatePrimaryObject({ maskCornerRadius: parseFloat(e.target.value) || 3 })
                          }
                          className="w-full accent-sky-500 cursor-pointer"
                        />
                      </div>
                    )}
                  </div>

                  {/* Quick Filters */}
                  <div className="space-y-2 pt-1">
                    <div>
                      <div className="flex justify-between text-[10px] text-neutral-400 mb-0.5">
                        <span>Brightness</span>
                        <span className="font-mono text-white">
                          {primaryObject.imageFilters?.brightness || 0}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={-50}
                        max={50}
                        value={primaryObject.imageFilters?.brightness || 0}
                        onChange={(e) =>
                          updatePrimaryObject({
                            imageFilters: {
                              brightness: parseInt(e.target.value),
                              contrast: primaryObject.imageFilters?.contrast || 0,
                              saturation: primaryObject.imageFilters?.saturation || 0,
                              sharpness: primaryObject.imageFilters?.sharpness || 0,
                              deskewAngle: primaryObject.imageFilters?.deskewAngle || 0,
                              grayscale: primaryObject.imageFilters?.grayscale || false,
                            },
                          })
                        }
                        className="w-full accent-sky-500"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[10px] text-neutral-400 mb-0.5">
                        <span>Contrast</span>
                        <span className="font-mono text-white">
                          {primaryObject.imageFilters?.contrast || 0}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={-50}
                        max={50}
                        value={primaryObject.imageFilters?.contrast || 0}
                        onChange={(e) =>
                          updatePrimaryObject({
                            imageFilters: {
                              brightness: primaryObject.imageFilters?.brightness || 0,
                              contrast: parseInt(e.target.value),
                              saturation: primaryObject.imageFilters?.saturation || 0,
                              sharpness: primaryObject.imageFilters?.sharpness || 0,
                              deskewAngle: primaryObject.imageFilters?.deskewAngle || 0,
                              grayscale: primaryObject.imageFilters?.grayscale || false,
                            },
                          })
                        }
                        className="w-full accent-sky-500"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <label className="text-[10px] text-neutral-300 flex items-center space-x-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={primaryObject.imageFilters?.grayscale || false}
                          onChange={(e) =>
                            updatePrimaryObject({
                              imageFilters: {
                                brightness: primaryObject.imageFilters?.brightness || 0,
                                contrast: primaryObject.imageFilters?.contrast || 0,
                                saturation: primaryObject.imageFilters?.saturation || 0,
                                sharpness: primaryObject.imageFilters?.sharpness || 0,
                                deskewAngle: primaryObject.imageFilters?.deskewAngle || 0,
                                grayscale: e.target.checked,
                              },
                            })
                          }
                          className="rounded accent-sky-500"
                        />
                        <span>Grayscale (B&W)</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => updatePrimaryObject({ imageFilters: undefined })}
                        className="text-[10px] text-neutral-400 hover:text-white"
                      >
                        Reset Filters
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* =========================================================
                  BARCODE & QR CODE PROPERTIES
                 ========================================================= */}
              {primaryObject.type === "barcode" && (
                <div className="space-y-3">
                  <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                    Barcode Setup
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-400 block mb-1">Encoded Value</label>
                    <input
                      type="text"
                      value={primaryObject.barcodeValue || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        const dataUrl = generateBarcodeDataUrl(val, primaryObject.barcodeType);
                        updatePrimaryObject({ barcodeValue: val, src: dataUrl });
                      }}
                      className="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-white font-mono text-xs outline-none"
                    />
                  </div>
                </div>
              )}

              {primaryObject.type === "qrcode" && (
                <div className="space-y-3">
                  <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                    QR Code Setup
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-400 block mb-1">Encoded URL / Text</label>
                    <textarea
                      rows={2}
                      value={primaryObject.qrValue || ""}
                      onChange={async (e) => {
                        const val = e.target.value;
                        const dataUrl = await generateQrCodeDataUrl(val);
                        updatePrimaryObject({ qrValue: val, src: dataUrl });
                      }}
                      className="w-full bg-neutral-950 border border-neutral-700 rounded p-2 text-white text-xs outline-none"
                    />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-neutral-500 space-y-2">
              <Layers className="w-8 h-8 mx-auto text-neutral-600" />
              <p className="font-semibold text-neutral-400">No Object Selected</p>
              <p className="text-[11px] px-4">
                Click any object on the Front or Back card canvas to edit its transform, styling, and layers.
              </p>
            </div>
          )
        ) : (
          /* =========================================================
              CARD & A6 SHEET SETUP TAB
             ========================================================= */
          <div className="space-y-4">
            <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
              Exact Card & A6 Sheet Setup
            </div>

            {/* Standard Card Presets */}
            <div className="space-y-1 bg-neutral-950/60 p-2.5 rounded-lg border border-neutral-800">
              <label className="text-[10px] font-bold text-sky-400 block mb-1">
                Standard Card Presets
              </label>
              <select
                value={project.cardPreset || "id1_cr80"}
                onChange={(e) => {
                  const presetId = e.target.value as CardPresetType;
                  const found = CARD_PRESETS.find((p) => p.id === presetId);
                  if (found) {
                    setProject((prev) => ({
                      ...prev,
                      cardPreset: presetId,
                      trueCardWidthMm: found.widthMm,
                      trueCardHeightMm: found.heightMm,
                      cardCornerRadiusMm: presetId === "id1_cr80" ? 3.18 : 1.0,
                    }));
                    onCommitHistory();
                  }
                }}
                className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-white text-xs outline-none"
              >
                {CARD_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.widthMm} × {p.heightMm} mm)
                  </option>
                ))}
              </select>
              <p className="text-[9px] text-neutral-400 pt-0.5">
                Standard CR-80 physical die-cut size is exactly 85.6 × 54.0 mm (R 3.18mm) used for all physical ID cards, badges, and driver licenses.
              </p>
            </div>

            {/* Exact True Card Cut-Line Dimensions */}
            <div className="space-y-2 bg-sky-950/20 p-2.5 rounded-lg border border-sky-900/40">
              <div className="text-[10px] font-bold text-sky-300 uppercase tracking-wider flex items-center justify-between">
                <span>True Card Dimensions (mm)</span>
                <span className="text-[9px] font-mono text-sky-400">Cut Boundary</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-neutral-400 block mb-1">Card Width (mm)</label>
                  <input
                    type="number"
                    step={0.1}
                    min={20}
                    max={200}
                    value={project.trueCardWidthMm || 85.6}
                    onChange={(e) =>
                      setProject((prev) => ({
                        ...prev,
                        trueCardWidthMm: parseFloat(e.target.value) || 85.6,
                        cardPreset: "custom",
                      }))
                    }
                    className="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-white font-mono text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-neutral-400 block mb-1">Card Height (mm)</label>
                  <input
                    type="number"
                    step={0.1}
                    min={20}
                    max={200}
                    value={project.trueCardHeightMm || 54.0}
                    onChange={(e) =>
                      setProject((prev) => ({
                        ...prev,
                        trueCardHeightMm: parseFloat(e.target.value) || 54.0,
                        cardPreset: "custom",
                      }))
                    }
                    className="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-white font-mono text-xs outline-none"
                  />
                </div>
              </div>

              {/* Card Corner Radius & Orientation */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="text-[10px] text-neutral-400 block mb-1">Corner Radius (mm)</label>
                  <input
                    type="number"
                    step={0.1}
                    min={0}
                    max={20}
                    value={project.cardCornerRadiusMm ?? 3.18}
                    onChange={(e) =>
                      setProject((prev) => ({
                        ...prev,
                        cardCornerRadiusMm: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-white font-mono text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-neutral-400 block mb-1">Card Orientation</label>
                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() =>
                        setProject((prev) => ({
                          ...prev,
                          trueCardOrientation: "landscape",
                        }))
                      }
                      className={`flex-1 py-1 text-[10px] rounded border font-medium ${
                        project.trueCardOrientation !== "portrait"
                          ? "bg-sky-600 border-sky-500 text-white"
                          : "bg-neutral-950 border-neutral-700 text-neutral-400"
                      }`}
                    >
                      Landscape
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setProject((prev) => ({
                          ...prev,
                          trueCardOrientation: "portrait",
                        }))
                      }
                      className={`flex-1 py-1 text-[10px] rounded border font-medium ${
                        project.trueCardOrientation === "portrait"
                          ? "bg-sky-600 border-sky-500 text-white"
                          : "bg-neutral-950 border-neutral-700 text-neutral-400"
                      }`}
                    >
                      Portrait
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Reset to CR-80 */}
              <button
                type="button"
                onClick={() => {
                  setProject((prev) => ({
                    ...prev,
                    cardPreset: "id1_cr80",
                    trueCardWidthMm: 85.6,
                    trueCardHeightMm: 54.0,
                    cardCornerRadiusMm: 3.18,
                    trueCardOrientation: "landscape",
                  }));
                  onCommitHistory();
                }}
                className="w-full mt-1 py-1 bg-neutral-900 hover:bg-neutral-800 text-sky-400 border border-neutral-700 rounded text-center text-[10px] font-medium"
              >
                Reset to Standard CR-80 (85.6 × 54.0 mm)
              </button>
            </div>

            {/* Visual Guides & Boundaries */}
            <div className="space-y-2 pt-1">
              <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                Guides & Boundary Overlays
              </div>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={project.showCardBoundary !== false}
                  onChange={(e) =>
                    setProject((prev) => ({ ...prev, showCardBoundary: e.target.checked }))
                  }
                  className="rounded accent-sky-500"
                />
                <span className="text-xs text-neutral-300">Show True Card Cut-Line Frame</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={project.showBleedShading !== false}
                  onChange={(e) =>
                    setProject((prev) => ({ ...prev, showBleedShading: e.target.checked }))
                  }
                  className="rounded accent-sky-500"
                />
                <span className="text-xs text-neutral-300">Show Bleed Area Shading (Outside Cut-Line)</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={project.snapToCardBoundary !== false}
                  onChange={(e) =>
                    setProject((prev) => ({ ...prev, snapToCardBoundary: e.target.checked }))
                  }
                  className="rounded accent-sky-500"
                />
                <span className="text-xs text-neutral-300">Magnetic Snap to True Card Boundaries</span>
              </label>
            </div>

            {/* A6 Orientation */}
            <div className="pt-2">
              <label className="text-[10px] text-neutral-400 block mb-1">A6 Physical Sheet Orientation</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setProject((prev) => ({
                      ...prev,
                      orientation: "portrait",
                      pageWidthMm: 105,
                      pageHeightMm: 148,
                      cardWidthMm: 105,
                      cardHeightMm: 74,
                      frontPosMm: { x: 0, y: 0 },
                      backPosMm: { x: 0, y: 74 },
                    }))
                  }
                  className={`py-1.5 rounded font-semibold border ${
                    project.orientation === "portrait"
                      ? "bg-sky-600 border-sky-500 text-white"
                      : "bg-neutral-950 border-neutral-700 text-neutral-400 hover:text-white"
                  }`}
                >
                  Portrait (105×148)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setProject((prev) => ({
                      ...prev,
                      orientation: "landscape",
                      pageWidthMm: 148,
                      pageHeightMm: 105,
                      cardWidthMm: 105,
                      cardHeightMm: 74,
                      frontPosMm: { x: 5, y: (105 - 74) / 2 },
                      backPosMm: { x: 5 + 105 + 6, y: (105 - 74) / 2 },
                    }))
                  }
                  className={`py-1.5 rounded font-semibold border ${
                    project.orientation === "landscape"
                      ? "bg-sky-600 border-sky-500 text-white"
                      : "bg-neutral-950 border-neutral-700 text-neutral-400 hover:text-white"
                  }`}
                >
                  Landscape (148×105)
                </button>
              </div>
            </div>

            {/* Sheet Half-Zone Dimensions */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-neutral-400 block mb-1">Zone Width (mm)</label>
                <input
                  type="number"
                  value={project.cardWidthMm}
                  onChange={(e) =>
                    setProject((prev) => ({
                      ...prev,
                      cardWidthMm: parseFloat(e.target.value) || 74,
                    }))
                  }
                  className="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-white font-mono text-xs outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-neutral-400 block mb-1">Zone Height (mm)</label>
                <input
                  type="number"
                  value={project.cardHeightMm}
                  onChange={(e) =>
                    setProject((prev) => ({
                      ...prev,
                      cardHeightMm: parseFloat(e.target.value) || 105,
                    }))
                  }
                  className="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-white font-mono text-xs outline-none"
                />
              </div>
            </div>

            {/* Background Colors for Front & Back */}
            <div className="space-y-2 pt-1">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] text-neutral-400 block">Front Card Background</label>
                  {onOpenCardBackgroundStudio && (
                    <button
                      type="button"
                      onClick={() => onOpenCardBackgroundStudio("front")}
                      className="text-[10px] text-emerald-400 hover:text-emerald-300 font-medium flex items-center space-x-0.5"
                      title="Open Centralized Background Studio for Front Card"
                    >
                      <Sparkles className="w-2.5 h-2.5" />
                      <span>Studio BG</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center space-x-1 bg-neutral-950 border border-neutral-700 rounded p-1">
                  <input
                    type="color"
                    value={project.front.background.color1 || "#ffffff"}
                    onChange={(e) =>
                      setProject((prev) => ({
                        ...prev,
                        front: {
                          ...prev.front,
                          background: { ...prev.front.background, color1: e.target.value },
                        },
                      }))
                    }
                    className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                  />
                  <span className="font-mono text-xs text-white uppercase">
                    {project.front.background.color1 || "#ffffff"}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] text-neutral-400 block">Back Card Background</label>
                  {onOpenCardBackgroundStudio && (
                    <button
                      type="button"
                      onClick={() => onOpenCardBackgroundStudio("back")}
                      className="text-[10px] text-emerald-400 hover:text-emerald-300 font-medium flex items-center space-x-0.5"
                      title="Open Centralized Background Studio for Back Card"
                    >
                      <Sparkles className="w-2.5 h-2.5" />
                      <span>Studio BG</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center space-x-1 bg-neutral-950 border border-neutral-700 rounded p-1">
                  <input
                    type="color"
                    value={project.back.background.color1 || "#ffffff"}
                    onChange={(e) =>
                      setProject((prev) => ({
                        ...prev,
                        back: {
                          ...prev.back,
                          background: { ...prev.back.background, color1: e.target.value },
                        },
                      }))
                    }
                    className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                  />
                  <span className="font-mono text-xs text-white uppercase">
                    {project.back.background.color1 || "#ffffff"}
                  </span>
                </div>
              </div>
            </div>

            {/* Print Guides Toggles */}
            <div className="space-y-2 pt-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={project.cuttingGuides}
                  onChange={(e) =>
                    setProject((prev) => ({ ...prev, cuttingGuides: e.target.checked }))
                  }
                  className="rounded accent-sky-500"
                />
                <span className="text-xs text-neutral-300">Print Corner Cutting Crop Marks</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={project.showSafeArea}
                  onChange={(e) =>
                    setProject((prev) => ({ ...prev, showSafeArea: e.target.checked }))
                  }
                  className="rounded accent-sky-500"
                />
                <span className="text-xs text-neutral-300">Show 3mm Safe Margins</span>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
