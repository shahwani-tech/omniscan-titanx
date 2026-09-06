/**
 * OMNISCAN TITAN X - PDF Page Crop Studio Control Bar
 * Comprehensive Presets, Aspect Locks, Physical Dimensions, Margins & Live Preview
 */

import React, { useState, useEffect, useRef } from "react";
import {
  CropUnit,
  StandardCropPreset,
  NormalizedCropBox,
  CROP_PRESETS,
  CropMargins,
  getPresetAspectRatio,
  fitAspectRatioInPage,
  convertPixelsToUnit,
  convertUnitToPixels,
  cropBoxFromMargins,
  marginsFromCropBox,
  detectAutoCropBounds,
} from "../../engine/cropEngine";
import { OmniPage, OmniDocument } from "../../types";
import {
  Crop,
  Check,
  X,
  RotateCcw,
  Sparkles,
  Lock,
  Unlock,
  SlidersHorizontal,
  Layers,
  Eye,
  EyeOff,
  Link,
  Unlink,
  Maximize2,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Scaling,
} from "lucide-react";

interface PdfCropControlBarProps {
  activePage: OmniPage;
  document: OmniDocument;
  cropBox: NormalizedCropBox;
  unit: CropUnit;
  preset: StandardCropPreset;
  aspectRatioLocked: boolean;
  targetAspectRatio: number | null;
  cropScope: "current" | "selected" | "all";
  onCropBoxChange: (box: NormalizedCropBox) => void;
  onUnitChange: (unit: CropUnit) => void;
  onPresetChange: (preset: StandardCropPreset) => void;
  onAspectRatioLockChange: (locked: boolean, ratio: number | null) => void;
  onCropScopeChange: (scope: "current" | "selected" | "all") => void;
  onApplyCrop: () => void;
  onCancelCrop: () => void;
  onResetCrop: () => void;
}

// -------------------------------------------------------------
// Global / Module-level Persistence for Crop Toolbar Position & Scale
// -------------------------------------------------------------
const STORAGE_KEY_CROPBAR_POS = "pdf_crop_toolbar_pos_v2";
const STORAGE_KEY_CROPBAR_SCALE = "pdf_crop_toolbar_scale_v2";

let sessionCropBarPos: { x: number; y: number } | null = null;
let sessionCropBarScale: number = 1.0;

try {
  const savedPos = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY_CROPBAR_POS) : null;
  if (savedPos) {
    sessionCropBarPos = JSON.parse(savedPos);
  }
  const savedScale = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY_CROPBAR_SCALE) : null;
  if (savedScale) {
    const parsed = parseFloat(savedScale);
    if (!isNaN(parsed) && parsed >= 0.5 && parsed <= 2.0) {
      sessionCropBarScale = parsed;
    }
  }
} catch {
  // Ignore in iframe restricted environments
}

export const PdfCropControlBar: React.FC<PdfCropControlBarProps> = ({
  activePage,
  document,
  cropBox,
  unit,
  preset,
  aspectRatioLocked,
  targetAspectRatio,
  cropScope,
  onCropBoxChange,
  onUnitChange,
  onPresetChange,
  onAspectRatioLockChange,
  onCropScopeChange,
  onApplyCrop,
  onCancelCrop,
  onResetCrop,
}) => {
  const [isCropPanelCollapsed, setIsCropPanelCollapsed] = useState(false);
  const [showMargins, setShowMargins] = useState(false);
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);

  // -------------------------------------------------------------
  // Full 2D Floating Toolbar Positioning & Resizing State with Persistence
  // -------------------------------------------------------------
  const barRef = useRef<HTMLDivElement>(null);
  const [barPos, setBarPosState] = useState<{ x: number; y: number } | null>(() => sessionCropBarPos);
  const [barScale, setBarScaleState] = useState<number>(() => sessionCropBarScale);
  const [isDraggingBar, setIsDraggingBar] = useState(false);
  const [isResizingBar, setIsResizingBar] = useState(false);

  const setBarPos = (pos: { x: number; y: number } | null) => {
    sessionCropBarPos = pos;
    setBarPosState(pos);
    try {
      if (pos) {
        localStorage.setItem(STORAGE_KEY_CROPBAR_POS, JSON.stringify(pos));
      } else {
        localStorage.removeItem(STORAGE_KEY_CROPBAR_POS);
      }
    } catch {
      // Ignore if localStorage unavailable
    }
  };

  const setBarScale = (scale: number) => {
    sessionCropBarScale = scale;
    setBarScaleState(scale);
    try {
      localStorage.setItem(STORAGE_KEY_CROPBAR_SCALE, scale.toString());
    } catch {
      // Ignore if localStorage unavailable
    }
  };

  // Ensure persisted bar position stays within parent container viewport on resize/mount
  useEffect(() => {
    if (!barPos || !barRef.current) return;
    const parentElem = barRef.current.parentElement || document.body;
    const parentRect = parentElem.getBoundingClientRect();
    const barRect = barRef.current.getBoundingClientRect();
    const padding = 8;
    const maxX = Math.max(padding, parentRect.width - barRect.width - padding);
    const maxY = Math.max(padding, parentRect.height - barRect.height - padding);

    const clampedX = Math.max(padding, Math.min(maxX, barPos.x));
    const clampedY = Math.max(padding, Math.min(maxY, barPos.y));

    if (clampedX !== barPos.x || clampedY !== barPos.y) {
      setBarPos({ x: clampedX, y: clampedY });
    }
  }, []);

  const dragStartOffsetRef = useRef<{ offsetX: number; offsetY: number }>({
    offsetX: 0,
    offsetY: 0,
  });
  const resizeStartRef = useRef<{
    startX: number;
    startY: number;
    startScale: number;
  }>({
    startX: 0,
    startY: 0,
    startScale: 1.0,
  });

  const handleBarDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    if (barRef.current) {
      const parentElem = barRef.current.parentElement || document.body;
      const parentRect = parentElem.getBoundingClientRect();
      const barRect = barRef.current.getBoundingClientRect();

      const currentX = barRect.left - parentRect.left;
      const currentY = barRect.top - parentRect.top;

      dragStartOffsetRef.current = {
        offsetX: clientX - barRect.left,
        offsetY: clientY - barRect.top,
      };

      setBarPos({ x: currentX, y: currentY });
      setIsDraggingBar(true);
    }
  };

  const handleBarResizeStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    resizeStartRef.current = {
      startX: clientX,
      startY: clientY,
      startScale: barScale,
    };
    setIsResizingBar(true);
  };

  // Drag 2D Window Movement Listener with Boundary Clamping
  useEffect(() => {
    if (!isDraggingBar) return;

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = "touches" in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;

      if (!barRef.current) return;
      const parentElem = barRef.current.parentElement || document.body;
      const parentRect = parentElem.getBoundingClientRect();
      const barRect = barRef.current.getBoundingClientRect();

      const rawX = clientX - parentRect.left - dragStartOffsetRef.current.offsetX;
      const rawY = clientY - parentRect.top - dragStartOffsetRef.current.offsetY;

      const padding = 8;
      const maxX = Math.max(padding, parentRect.width - barRect.width - padding);
      const maxY = Math.max(padding, parentRect.height - barRect.height - padding);

      const clampedX = Math.max(padding, Math.min(maxX, rawX));
      const clampedY = Math.max(padding, Math.min(maxY, rawY));

      setBarPos({ x: clampedX, y: clampedY });
    };

    const handlePointerUp = () => {
      setIsDraggingBar(false);
    };

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);
    window.addEventListener("touchmove", handlePointerMove, { passive: false });
    window.addEventListener("touchend", handlePointerUp);

    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
      window.removeEventListener("touchmove", handlePointerMove);
      window.removeEventListener("touchend", handlePointerUp);
    };
  }, [isDraggingBar]);

  // Drag-to-Resize Scaling Window Listener
  useEffect(() => {
    if (!isResizingBar) return;

    const handleResizeMove = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = "touches" in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;

      const deltaX = clientX - resizeStartRef.current.startX;
      const deltaY = clientY - resizeStartRef.current.startY;
      const delta = (deltaX + deltaY) / 2;

      const newScale = Math.max(0.75, Math.min(1.4, resizeStartRef.current.startScale + delta / 260));
      setBarScale(Number(newScale.toFixed(2)));
    };

    const handleResizeUp = () => {
      setIsResizingBar(false);
    };

    window.addEventListener("mousemove", handleResizeMove);
    window.addEventListener("mouseup", handleResizeUp);
    window.addEventListener("touchmove", handleResizeMove, { passive: false });
    window.addEventListener("touchend", handleResizeUp);

    return () => {
      window.removeEventListener("mousemove", handleResizeMove);
      window.removeEventListener("mouseup", handleResizeUp);
      window.removeEventListener("touchmove", handleResizeMove);
      window.removeEventListener("touchend", handleResizeUp);
    };
  }, [isResizingBar]);

  const pageWidth = activePage.width || 800;
  const pageHeight = activePage.height || 1000;
  const dpi = activePage.dpi || 300;

  // Real physical dimensions
  const realWidth = convertPixelsToUnit(cropBox.width * pageWidth, unit, dpi);
  const realHeight = convertPixelsToUnit(cropBox.height * pageHeight, unit, dpi);

  // Margins
  const margins = marginsFromCropBox(cropBox, pageWidth, pageHeight, unit, dpi);
  const [equalMargins, setEqualMargins] = useState<boolean>(margins.equal);

  // Aspect ratio presets
  const ratioPresets = [
    { label: "Free", ratio: null },
    { label: "Original", ratio: pageWidth / pageHeight },
    { label: "1 : 1", ratio: 1.0 },
    { label: "4 : 6", ratio: 4 / 6 },
    { label: "3 : 4", ratio: 3 / 4 },
    { label: "16 : 9", ratio: 16 / 9 },
  ];

  const handlePresetSelect = (p: StandardCropPreset) => {
    onPresetChange(p);
    if (p === "free") {
      onAspectRatioLockChange(false, null);
    } else {
      const ratio = getPresetAspectRatio(p, pageWidth, pageHeight);
      if (ratio) {
        onAspectRatioLockChange(true, ratio);
        const fitted = fitAspectRatioInPage(ratio, pageWidth, pageHeight);
        onCropBoxChange(fitted);
      }
    }
  };

  const handleWidthInputChange = (val: number) => {
    if (isNaN(val) || val <= 0) return;
    const px = convertUnitToPixels(val, unit, dpi);
    const normW = Math.max(0.05, Math.min(1 - cropBox.x, px / pageWidth));

    let normH = cropBox.height;
    if (aspectRatioLocked && targetAspectRatio) {
      const pageAspect = pageWidth / pageHeight;
      normH = Math.min(1 - cropBox.y, (normW * pageAspect) / targetAspectRatio);
    }

    onCropBoxChange({
      ...cropBox,
      width: normW,
      height: normH,
    });
  };

  const handleHeightInputChange = (val: number) => {
    if (isNaN(val) || val <= 0) return;
    const px = convertUnitToPixels(val, unit, dpi);
    const normH = Math.max(0.05, Math.min(1 - cropBox.y, px / pageHeight));

    let normW = cropBox.width;
    if (aspectRatioLocked && targetAspectRatio) {
      const pageAspect = pageWidth / pageHeight;
      normW = Math.min(1 - cropBox.x, (normH * targetAspectRatio) / pageAspect);
    }

    onCropBoxChange({
      ...cropBox,
      width: normW,
      height: normH,
    });
  };

  const handleMarginChange = (side: "top" | "right" | "bottom" | "left", val: number) => {
    if (isNaN(val) || val < 0) return;

    let newMargins: CropMargins;
    if (equalMargins) {
      newMargins = {
        top: val,
        right: val,
        bottom: val,
        left: val,
        equal: true,
        unit,
      };
    } else {
      newMargins = {
        ...margins,
        [side]: val,
        equal: false,
        unit,
      };
    }

    const newBox = cropBoxFromMargins(newMargins, pageWidth, pageHeight, dpi);
    onCropBoxChange(newBox);
  };

  const handleAutoDetect = async () => {
    setIsAutoDetecting(true);
    try {
      const detected = await detectAutoCropBounds(
        activePage.processedDataUrl || activePage.originalDataUrl
      );
      onCropBoxChange(detected);
    } catch (e) {
      console.error("Auto detect crop bounds failed:", e);
    } finally {
      setIsAutoDetecting(false);
    }
  };

  // Shared Floating Container Style
  const floatingStyle: React.CSSProperties = barPos
    ? {
        left: `${barPos.x}px`,
        top: `${barPos.y}px`,
        transform: `scale(${barScale})`,
        transformOrigin: "top left",
      }
    : {
        top: "12px",
        left: "50%",
        transform: `translateX(-50%) scale(${barScale})`,
        transformOrigin: "top center",
      };

  if (isCropPanelCollapsed) {
    return (
      <div
        ref={barRef}
        style={floatingStyle}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        className={`pdf-crop-bar absolute z-40 bg-neutral-900/98 backdrop-blur-xl rounded-xl border border-neutral-800 shadow-2xl px-3 py-1.5 flex items-center justify-between gap-2.5 text-xs select-none max-w-[95vw] transition-shadow duration-150 ${
          isDraggingBar
            ? "ring-2 ring-sky-500/50 shadow-2xl scale-[1.01] cursor-grabbing"
            : isResizingBar
            ? "ring-2 ring-amber-500/50 shadow-2xl cursor-se-resize"
            : "hover:border-neutral-700"
        }`}
      >
        {/* Left: Drag Handle & Mode Title */}
        <div className="flex items-center space-x-1.5">
          {/* Dedicated Drag Handle */}
          <div
            onMouseDown={handleBarDragStart}
            onTouchStart={handleBarDragStart}
            onDoubleClick={() => {
              setBarPos(null);
              setBarScale(1.0);
            }}
            className="flex items-center justify-center p-1 text-neutral-400 hover:text-white cursor-grab active:cursor-grabbing hover:bg-neutral-800/80 rounded transition-colors group select-none"
            title="Drag Crop Bar anywhere (Double-click to snap back to top-center)"
          >
            <GripVertical className="w-4 h-4 text-neutral-400 group-hover:text-sky-400 transition-colors" />
          </div>

          {barPos && (
            <button
              onClick={() => {
                setBarPos(null);
                setBarScale(1.0);
              }}
              className="p-1 rounded text-neutral-400 hover:text-sky-300 hover:bg-neutral-800 transition-colors"
              title="Snap Crop Bar back to top center"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}

          <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 font-bold border border-sky-500/40">
            <Crop className="w-3.5 h-3.5" />
            <span className="tracking-wide uppercase text-[11px]">Crop</span>
          </div>

          <span className="text-[11px] font-mono text-neutral-300 bg-neutral-800 px-2 py-0.5 rounded border border-neutral-700">
            {realWidth} × {realHeight} {unit}
          </span>

          {preset !== "free" && (
            <span className="text-[10px] uppercase font-bold text-sky-400 bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-800/50">
              {preset}
            </span>
          )}
        </div>

        {/* Right: Actions, Expand & Resize Grip */}
        <div className="flex items-center space-x-2">
          {/* Target Scope Dropdown */}
          <div className="flex items-center space-x-1 bg-neutral-800 px-2 py-0.5 rounded border border-neutral-700">
            <Layers className="w-3 h-3 text-neutral-400" />
            <select
              value={cropScope}
              onChange={(e) => onCropScopeChange(e.target.value as any)}
              className="bg-transparent text-neutral-200 text-[11px] focus:outline-none cursor-pointer"
            >
              <option value="current">Page {activePage.pageNumber}</option>
              {(document?.selectedPageIds?.length ?? 0) > 1 && (
                <option value="selected">
                  Selected ({document?.selectedPageIds?.length ?? 0})
                </option>
              )}
              <option value="all">All ({document?.pages?.length ?? 1})</option>
            </select>
          </div>

          <button
            onClick={onResetCrop}
            className="flex items-center space-x-1 px-2.5 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 transition-colors"
            title="Reset crop box to full page"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>

          <button
            onClick={onCancelCrop}
            className="flex items-center space-x-1 px-2.5 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 transition-colors"
            title="Exit crop mode without saving"
          >
            <X className="w-3.5 h-3.5" />
            <span>Cancel</span>
          </button>

          <button
            onClick={onApplyCrop}
            className="flex items-center space-x-1.5 px-3.5 py-0.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-bold shadow-md shadow-sky-900/40 transition-transform active:scale-95"
            title="Permanently crop PDF page"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Apply Crop</span>
          </button>

          <div className="h-4 w-px bg-neutral-700 mx-0.5" />

          <button
            onClick={() => setIsCropPanelCollapsed(false)}
            className="flex items-center space-x-1 px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-sky-300 hover:text-white border border-neutral-700 transition-colors font-medium"
            title="Expand Crop Options Panel (▲)"
          >
            <ChevronDown className="w-3.5 h-3.5 text-sky-400" />
            <span>Expand</span>
          </button>

          {/* Interactive Drag-to-Resize Grip */}
          <div
            onMouseDown={handleBarResizeStart}
            onTouchStart={handleBarResizeStart}
            onDoubleClick={() => setBarScale(1.0)}
            className={`flex items-center justify-center p-1 text-neutral-400 hover:text-amber-400 hover:bg-neutral-800/80 rounded transition-colors cursor-se-resize select-none ${
              isResizingBar ? "text-amber-400 bg-neutral-800" : ""
            }`}
            title={`Drag to resize Crop Bar (${Math.round(barScale * 100)}% - Double click to reset)`}
          >
            <Scaling className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={barRef}
      style={floatingStyle}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      className={`pdf-crop-bar absolute z-40 bg-neutral-900/98 backdrop-blur-xl rounded-xl border border-neutral-800 shadow-2xl p-2.5 flex flex-col space-y-2 text-xs select-none max-w-[96vw] transition-shadow duration-150 ${
        isDraggingBar
          ? "ring-2 ring-sky-500/50 shadow-2xl scale-[1.01] cursor-grabbing"
          : isResizingBar
          ? "ring-2 ring-amber-500/50 shadow-2xl cursor-se-resize"
          : "hover:border-neutral-700"
      }`}
    >
      {/* Top Bar: Tool Identifier, Presets, Ratios & Primary Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Left: Drag Handle, Mode Title & Preset Pills */}
        <div className="flex items-center space-x-1.5">
          {/* Dedicated Drag Handle */}
          <div
            onMouseDown={handleBarDragStart}
            onTouchStart={handleBarDragStart}
            onDoubleClick={() => {
              setBarPos(null);
              setBarScale(1.0);
            }}
            className="flex items-center justify-center p-1 text-neutral-400 hover:text-white cursor-grab active:cursor-grabbing hover:bg-neutral-800/80 rounded transition-colors group select-none"
            title="Drag Crop Bar anywhere in 2D (Double-click to snap back to top-center)"
          >
            <GripVertical className="w-4 h-4 text-neutral-400 group-hover:text-sky-400 transition-colors" />
          </div>

          {barPos && (
            <button
              onClick={() => {
                setBarPos(null);
                setBarScale(1.0);
              }}
              className="p-1 rounded text-neutral-400 hover:text-sky-300 hover:bg-neutral-800 transition-colors"
              title="Snap Crop Bar back to top center"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}

          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-sky-500/20 text-sky-400 font-bold border border-sky-500/40">
            <Crop className="w-3.5 h-3.5" />
            <span className="tracking-wide uppercase text-[11px]">PDF Page Crop</span>
          </div>

          {/* Preset Buttons */}
          <div className="flex items-center space-x-1 overflow-x-auto max-w-[380px] custom-scrollbar py-0.5">
            {CROP_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => handlePresetSelect(p.id)}
                className={`px-2 py-1 rounded text-[11px] font-medium whitespace-nowrap transition-colors border ${
                  preset === p.id
                    ? "bg-sky-600 text-white border-sky-400 shadow-sm"
                    : "bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-750 hover:text-white"
                }`}
                title={p.description}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Middle: Aspect Ratio Lock & Manual Presets */}
        <div className="flex items-center space-x-1.5 bg-neutral-850 px-2 py-1 rounded-lg border border-neutral-750">
          <button
            onClick={() => {
              if (aspectRatioLocked) {
                onAspectRatioLockChange(false, null);
              } else {
                const currentRatio = (cropBox.width * pageWidth) / (cropBox.height * pageHeight);
                onAspectRatioLockChange(true, currentRatio);
              }
            }}
            className={`flex items-center space-x-1 px-1.5 py-0.5 rounded text-[11px] font-semibold transition-colors ${
              aspectRatioLocked
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                : "text-neutral-400 hover:text-white"
            }`}
            title="Lock Current Aspect Ratio"
          >
            {aspectRatioLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
            <span>Lock Ratio</span>
          </button>

          <div className="h-3.5 w-px bg-neutral-700 mx-0.5" />

          {/* Ratio Quick Buttons */}
          {ratioPresets.map((r) => {
            const isSelected =
              aspectRatioLocked &&
              targetAspectRatio !== null &&
              r.ratio !== null &&
              Math.abs(targetAspectRatio - r.ratio) < 0.01;

            return (
              <button
                key={r.label}
                onClick={() => {
                  if (r.ratio === null) {
                    onAspectRatioLockChange(false, null);
                  } else {
                    onAspectRatioLockChange(true, r.ratio);
                    const fitted = fitAspectRatioInPage(r.ratio, pageWidth, pageHeight);
                    onCropBoxChange(fitted);
                  }
                }}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                  isSelected
                    ? "bg-sky-600 text-white font-bold"
                    : "text-neutral-400 hover:text-white hover:bg-neutral-800"
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>

        {/* Right: Actions (Apply, Reset, Cancel, Collapse, Resize) */}
        <div className="flex items-center space-x-2">
          {/* Target Scope Dropdown */}
          <div className="flex items-center space-x-1 bg-neutral-800 px-2 py-1 rounded border border-neutral-700">
            <Layers className="w-3 h-3 text-neutral-400" />
            <select
              value={cropScope}
              onChange={(e) => onCropScopeChange(e.target.value as any)}
              className="bg-transparent text-neutral-200 text-[11px] focus:outline-none cursor-pointer"
            >
              <option value="current">Current Page ({activePage.pageNumber})</option>
              {(document?.selectedPageIds?.length ?? 0) > 1 && (
                <option value="selected">
                  Selected Pages ({document?.selectedPageIds?.length ?? 0})
                </option>
              )}
              <option value="all">All Pages ({document?.pages?.length ?? 1})</option>
            </select>
          </div>

          <button
            onClick={onResetCrop}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 transition-colors"
            title="Reset crop box to full page"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>

          <button
            onClick={onCancelCrop}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 transition-colors"
            title="Exit crop mode without saving"
          >
            <X className="w-3.5 h-3.5" />
            <span>Cancel</span>
          </button>

          <button
            onClick={onApplyCrop}
            className="flex items-center space-x-1.5 px-3.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white font-bold shadow-md shadow-sky-900/40 transition-transform active:scale-95"
            title="Permanently crop PDF page"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Apply Crop</span>
          </button>

          <div className="h-4 w-px bg-neutral-700 mx-0.5" />

          <button
            onClick={() => setIsCropPanelCollapsed(true)}
            className="flex items-center space-x-1 px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 transition-colors font-medium"
            title="Collapse Crop Options Panel (▼)"
          >
            <ChevronUp className="w-3.5 h-3.5 text-neutral-400" />
            <span>Collapse</span>
          </button>

          {/* Interactive Drag-to-Resize Grip */}
          <div
            onMouseDown={handleBarResizeStart}
            onTouchStart={handleBarResizeStart}
            onDoubleClick={() => setBarScale(1.0)}
            className={`flex items-center justify-center p-1 text-neutral-400 hover:text-amber-400 hover:bg-neutral-800/80 rounded transition-colors cursor-se-resize select-none ${
              isResizingBar ? "text-amber-400 bg-neutral-800" : ""
            }`}
            title={`Drag to resize Crop Bar (${Math.round(barScale * 100)}% - Double click to reset)`}
          >
            <Scaling className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* Bottom Bar: Exact Dimensions, Margins Toggle, Auto-Detect & Live Preview */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-neutral-800/80">
        {/* Left: Numeric Width & Height & Unit Selector */}
        <div className="flex items-center space-x-3">
          {/* Width Input */}
          <div className="flex items-center space-x-1 bg-neutral-800 px-2 py-1 rounded border border-neutral-700">
            <span className="text-[10px] text-neutral-400 uppercase font-mono">W:</span>
            <input
              type="number"
              step={unit === "inch" || unit === "cm" ? "0.1" : "1"}
              min="1"
              value={realWidth}
              onChange={(e) => handleWidthInputChange(parseFloat(e.target.value))}
              className="w-14 bg-neutral-900 text-neutral-100 font-mono text-[11px] px-1 py-0.5 rounded border border-neutral-700 focus:outline-none focus:border-sky-500 text-right"
            />
          </div>

          {/* Height Input */}
          <div className="flex items-center space-x-1 bg-neutral-800 px-2 py-1 rounded border border-neutral-700">
            <span className="text-[10px] text-neutral-400 uppercase font-mono">H:</span>
            <input
              type="number"
              step={unit === "inch" || unit === "cm" ? "0.1" : "1"}
              min="1"
              value={realHeight}
              onChange={(e) => handleHeightInputChange(parseFloat(e.target.value))}
              className="w-14 bg-neutral-900 text-neutral-100 font-mono text-[11px] px-1 py-0.5 rounded border border-neutral-700 focus:outline-none focus:border-sky-500 text-right"
            />
          </div>

          {/* Unit Selector */}
          <div className="flex items-center space-x-1 bg-neutral-800 px-2 py-1 rounded border border-neutral-700">
            <span className="text-[10px] text-neutral-400">Unit:</span>
            <select
              value={unit}
              onChange={(e) => onUnitChange(e.target.value as CropUnit)}
              className="bg-transparent text-neutral-200 text-[11px] font-mono focus:outline-none cursor-pointer"
            >
              <option value="mm">mm</option>
              <option value="cm">cm</option>
              <option value="inch">inch</option>
              <option value="px">px</option>
              <option value="pt">pt</option>
            </select>
          </div>

          {/* Margin Drawer Toggle */}
          <button
            onClick={() => setShowMargins(!showMargins)}
            className={`flex items-center space-x-1 px-2 py-1 rounded border transition-colors ${
              showMargins
                ? "bg-neutral-750 text-white border-neutral-600"
                : "bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-750"
            }`}
          >
            <SlidersHorizontal className="w-3 h-3 text-sky-400" />
            <span>Margins</span>
          </button>
        </div>

        {/* Right: Auto Detect & Live Preview Drawer Toggle */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleAutoDetect}
            disabled={isAutoDetecting}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-gradient-to-r from-amber-900/40 to-yellow-900/40 hover:from-amber-800/60 hover:to-yellow-800/60 text-amber-200 border border-amber-600/50 font-medium transition-all"
            title="Auto-detect content bounds and set crop box"
          >
            <Sparkles className={`w-3 h-3 text-amber-400 ${isAutoDetecting ? "animate-spin" : ""}`} />
            <span>{isAutoDetecting ? "Detecting..." : "Auto Detect Page"}</span>
          </button>

          <button
            onClick={() => setShowLivePreview(!showLivePreview)}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded border transition-colors ${
              showLivePreview
                ? "bg-emerald-900/40 text-emerald-300 border-emerald-500/50"
                : "bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-750"
            }`}
            title="Toggle live cropped preview card"
          >
            {showLivePreview ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            <span>Live Preview</span>
          </button>
        </div>
      </div>

      {/* Collapsible Sub-Panel: Margin Controls */}
      {showMargins && (
        <div className="bg-neutral-850 p-2 rounded-lg border border-neutral-750 flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-100">
          <div className="flex items-center space-x-3">
            <span className="text-[11px] font-bold text-neutral-300">Crop Margins:</span>

            {/* Top Margin */}
            <div className="flex items-center space-x-1 bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-700">
              <span className="text-[10px] text-neutral-400">Top:</span>
              <input
                type="number"
                step="0.5"
                min="0"
                value={margins.top}
                onChange={(e) => handleMarginChange("top", parseFloat(e.target.value))}
                className="w-12 bg-transparent text-neutral-100 font-mono text-[11px] focus:outline-none text-right"
              />
              <span className="text-[10px] text-neutral-400 font-mono">{unit}</span>
            </div>

            {/* Bottom Margin */}
            <div className="flex items-center space-x-1 bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-700">
              <span className="text-[10px] text-neutral-400">Bottom:</span>
              <input
                type="number"
                step="0.5"
                min="0"
                value={margins.bottom}
                onChange={(e) => handleMarginChange("bottom", parseFloat(e.target.value))}
                className="w-12 bg-transparent text-neutral-100 font-mono text-[11px] focus:outline-none text-right"
              />
              <span className="text-[10px] text-neutral-400 font-mono">{unit}</span>
            </div>

            {/* Left Margin */}
            <div className="flex items-center space-x-1 bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-700">
              <span className="text-[10px] text-neutral-400">Left:</span>
              <input
                type="number"
                step="0.5"
                min="0"
                value={margins.left}
                onChange={(e) => handleMarginChange("left", parseFloat(e.target.value))}
                className="w-12 bg-transparent text-neutral-100 font-mono text-[11px] focus:outline-none text-right"
              />
              <span className="text-[10px] text-neutral-400 font-mono">{unit}</span>
            </div>

            {/* Right Margin */}
            <div className="flex items-center space-x-1 bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-700">
              <span className="text-[10px] text-neutral-400">Right:</span>
              <input
                type="number"
                step="0.5"
                min="0"
                value={margins.right}
                onChange={(e) => handleMarginChange("right", parseFloat(e.target.value))}
                className="w-12 bg-transparent text-neutral-100 font-mono text-[11px] focus:outline-none text-right"
              />
              <span className="text-[10px] text-neutral-400 font-mono">{unit}</span>
            </div>

            {/* Equal Margins Link Toggle */}
            <button
              onClick={() => setEqualMargins(!equalMargins)}
              className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] border transition-colors ${
                equalMargins
                  ? "bg-sky-500/20 text-sky-400 border-sky-500/40 font-bold"
                  : "bg-neutral-800 text-neutral-400 border-neutral-700"
              }`}
              title="Link all 4 margins equally"
            >
              {equalMargins ? <Link className="w-3 h-3" /> : <Unlink className="w-3 h-3" />}
              <span>{equalMargins ? "Equal Margins Linked" : "Independent"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Floating Live Crop Preview Card */}
      {showLivePreview && (
        <div className="absolute top-full right-4 mt-2 w-64 bg-neutral-900/95 backdrop-blur-xl border border-sky-500/40 rounded-xl p-3 shadow-2xl z-50 flex flex-col space-y-2 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-1 border-b border-neutral-800">
            <span className="font-bold text-sky-300 text-[11px] flex items-center gap-1">
              <Eye className="w-3 h-3" />
              <span>Live Cropped Page Preview</span>
            </span>
            <button
              onClick={() => setShowLivePreview(false)}
              className="text-neutral-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Cropped Region Simulation Preview Container */}
          <div className="relative w-full h-44 bg-neutral-950 rounded-lg overflow-hidden border border-neutral-800 flex items-center justify-center p-2">
            <div
              style={{
                width: "100%",
                height: "100%",
                backgroundImage: `url(${activePage.processedDataUrl || activePage.originalDataUrl})`,
                backgroundPosition: `${(cropBox.x / (1 - cropBox.width || 1)) * 100}% ${(cropBox.y / (1 - cropBox.height || 1)) * 100}%`,
                backgroundSize: `${(1 / cropBox.width) * 100}% ${(1 / cropBox.height) * 100}%`,
                backgroundRepeat: "no-repeat",
              }}
              className="rounded shadow"
            />
          </div>

          <div className="text-[10px] text-neutral-400 flex items-center justify-between font-mono">
            <span>
              {realWidth} × {realHeight} {unit}
            </span>
            <span className="text-sky-400 font-bold">
              {Math.round(cropBox.width * pageWidth)} × {Math.round(cropBox.height * pageHeight)} px
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
