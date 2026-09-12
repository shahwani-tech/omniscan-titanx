/**
 * OMNISCAN TITAN X - PDF Page Crop Studio Control Bar
 * High-End, Compact, Floating, Non-Blocking Document-Editor Toolbar
 * Comprehensive Presets, Aspect Ratio Locks, Precision Dimensions (W/H/X/Y), Margins & Live Preview
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
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
import { useShortcuts } from "../../commands/ShortcutContext";
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
  Move,
  MoreHorizontal,
  Crosshair,
} from "lucide-react";

export interface PdfCropControlBarProps {
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
    if (!isNaN(parsed) && parsed >= 0.7 && parsed <= 1.5) {
      sessionCropBarScale = parsed;
    }
  }
} catch {
  // Ignore in restricted environments
}

type ActivePopoverType = "preset" | "ratio" | "coords" | "margins" | "overflow" | null;

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
  // Collapsed / Expanded state (persists across tool use, defaults to expanded)
  const [isCropPanelCollapsed, setIsCropPanelCollapsed] = useState(false);

  // Active popover menu (only one open at a time for clean non-blocking UX)
  const [activePopover, setActivePopover] = useState<ActivePopoverType>(null);

  // Live cropped preview drawer toggle
  const [showLivePreview, setShowLivePreview] = useState(false);

  // Auto-detect CV state
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);

  // Centralized Shortcut Management for Crop Mode
  const { pushScope, popScope, registerAction } = useShortcuts();

  useEffect(() => {
    pushScope("crop");
    return () => {
      popScope("crop");
    };
  }, [pushScope, popScope]);

  useEffect(() => {
    const nudge = (dx: number, dy: number) => {
      onCropBoxChange({
        ...cropBox,
        x: Math.max(0, Math.min(1 - cropBox.width, cropBox.x + dx)),
        y: Math.max(0, Math.min(1 - cropBox.height, cropBox.y + dy)),
      });
    };

    const unregApply = registerAction("crop.apply", onApplyCrop);
    const unregCancel = registerAction("crop.cancel", () => {
      if (activePopover) {
        setActivePopover(null);
      } else {
        onCancelCrop();
      }
    });
    const unregReset = registerAction("crop.reset", onResetCrop);
    const unregUp = registerAction("crop.nudgeUp", () => nudge(0, -0.01));
    const unregDown = registerAction("crop.nudgeDown", () => nudge(0, 0.01));
    const unregLeft = registerAction("crop.nudgeLeft", () => nudge(-0.01, 0));
    const unregRight = registerAction("crop.nudgeRight", () => nudge(0.01, 0));
    const unregLUp = registerAction("crop.largeNudgeUp", () => nudge(0, -0.05));
    const unregLDown = registerAction("crop.largeNudgeDown", () => nudge(0, 0.05));
    const unregLLeft = registerAction("crop.largeNudgeLeft", () => nudge(-0.05, 0));
    const unregLRight = registerAction("crop.largeNudgeRight", () => nudge(0.05, 0));
    const unregFUp = registerAction("crop.fineNudgeUp", () => nudge(0, -0.002));
    const unregFDown = registerAction("crop.fineNudgeDown", () => nudge(0, 0.002));
    const unregFLeft = registerAction("crop.fineNudgeLeft", () => nudge(-0.002, 0));
    const unregFRight = registerAction("crop.fineNudgeRight", () => nudge(0.002, 0));
    const unregLock = registerAction("crop.aspectLock", () =>
      onAspectRatioLockChange(!aspectRatioLocked, targetAspectRatio)
    );

    return () => {
      unregApply();
      unregCancel();
      unregReset();
      unregUp();
      unregDown();
      unregLeft();
      unregRight();
      unregLUp();
      unregLDown();
      unregLLeft();
      unregLRight();
      unregFUp();
      unregFDown();
      unregFLeft();
      unregFRight();
      unregLock();
    };
  }, [
    cropBox,
    onCropBoxChange,
    onApplyCrop,
    onCancelCrop,
    onResetCrop,
    aspectRatioLocked,
    targetAspectRatio,
    onAspectRatioLockChange,
    registerAction,
    activePopover,
  ]);

  // -------------------------------------------------------------
  // Free 2D Floating Toolbar Positioning & Resizing with Persistence
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

  // Close popovers when clicking anywhere outside the toolbar
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setActivePopover(null);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Boundary clamping: ensure persisted bar stays comfortably inside workspace
  useEffect(() => {
    if (!barPos || !barRef.current) return;
    const parentElem = barRef.current.parentElement || document.body;
    const parentRect = parentElem.getBoundingClientRect();
    const barRect = barRef.current.getBoundingClientRect();
    const padding = 12;
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
    setActivePopover(null);

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
    setActivePopover(null);

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

      const padding = 12;
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

      const newScale = Math.max(0.75, Math.min(1.35, resizeStartRef.current.startScale + delta / 260));
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
  const realX = convertPixelsToUnit(cropBox.x * pageWidth, unit, dpi);
  const realY = convertPixelsToUnit(cropBox.y * pageHeight, unit, dpi);

  // Margins
  const margins = marginsFromCropBox(cropBox, pageWidth, pageHeight, unit, dpi);
  const [equalMargins, setEqualMargins] = useState<boolean>(margins.equal);

  // Aspect ratio presets
  const ratioPresets = useMemo(
    () => [
      { label: "Free", ratio: null, desc: "Unconstrained ratio" },
      { label: "Original", ratio: pageWidth / pageHeight, desc: "Native page aspect" },
      { label: "1 : 1", ratio: 1.0, desc: "Square format" },
      { label: "4 : 6", ratio: 4 / 6, desc: "Standard photo portrait" },
      { label: "3 : 4", ratio: 3 / 4, desc: "Classic portrait" },
      { label: "16 : 9", ratio: 16 / 9, desc: "Widescreen" },
    ],
    [pageWidth, pageHeight]
  );

  const activePresetDef = useMemo(
    () => CROP_PRESETS.find((p) => p.id === preset) || CROP_PRESETS[0],
    [preset]
  );

  const handlePresetSelect = (p: StandardCropPreset) => {
    onPresetChange(p);
    setActivePopover(null);
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

  const handleXInputChange = (val: number) => {
    if (isNaN(val) || val < 0) return;
    const px = convertUnitToPixels(val, unit, dpi);
    const normX = Math.max(0, Math.min(1 - cropBox.width, px / pageWidth));
    onCropBoxChange({ ...cropBox, x: normX });
  };

  const handleYInputChange = (val: number) => {
    if (isNaN(val) || val < 0) return;
    const px = convertUnitToPixels(val, unit, dpi);
    const normY = Math.max(0, Math.min(1 - cropBox.height, px / pageHeight));
    onCropBoxChange({ ...cropBox, y: normY });
  };

  const handleCenterCropBox = () => {
    const newX = Math.max(0, (1 - cropBox.width) / 2);
    const newY = Math.max(0, (1 - cropBox.height) / 2);
    onCropBoxChange({
      ...cropBox,
      x: newX,
      y: newY,
    });
  };

  const handleMaximizeCropBox = () => {
    onPresetChange("free");
    onAspectRatioLockChange(false, null);
    onCropBoxChange({
      x: 0,
      y: 0,
      width: 1,
      height: 1,
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
        top: "14px",
        left: "50%",
        transform: `translateX(-50%) scale(${barScale})`,
        transformOrigin: "top center",
      };

  // =============================================================
  // COLLAPSED STATE: Ultra-Compact Minimal Floating Capsule
  // =============================================================
  if (isCropPanelCollapsed) {
    return (
      <div
        ref={barRef}
        style={floatingStyle}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        className={`pdf-crop-bar absolute z-40 bg-neutral-900/98 backdrop-blur-2xl rounded-full border border-neutral-750/90 shadow-[0_12px_36px_rgba(0,0,0,0.6)] px-2.5 py-1 flex items-center gap-2 text-xs select-none max-w-[95vw] transition-all duration-150 ${
          isDraggingBar
            ? "ring-2 ring-sky-500/70 shadow-2xl cursor-grabbing scale-[1.01]"
            : isResizingBar
            ? "ring-2 ring-amber-500/70 shadow-2xl cursor-se-resize"
            : "hover:border-neutral-650"
        }`}
      >
        {/* Subtle Drag Grip */}
        <div
          onMouseDown={handleBarDragStart}
          onTouchStart={handleBarDragStart}
          onDoubleClick={() => {
            setBarPos(null);
            setBarScale(1.0);
          }}
          className="flex items-center justify-center p-1 text-neutral-400 hover:text-white cursor-grab active:cursor-grabbing hover:bg-neutral-800/80 rounded-full transition-colors group select-none"
          title="Drag Crop Bar (Double-click to snap to top center)"
        >
          <GripVertical className="w-3.5 h-3.5 text-neutral-400 group-hover:text-sky-400" />
        </div>

        {/* Snap back icon if displaced */}
        {barPos && (
          <button
            onClick={() => {
              setBarPos(null);
              setBarScale(1.0);
            }}
            className="p-1 rounded-full text-neutral-400 hover:text-sky-300 hover:bg-neutral-800 transition-colors"
            title="Snap back to top center"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        )}

        {/* Crop Status Pill */}
        <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 font-bold border border-sky-500/30">
          <Crop className="w-3.5 h-3.5" />
          <span className="text-[11px] uppercase tracking-wider font-semibold">Crop</span>
        </div>

        {/* Live Dimension Badge */}
        <span className="text-[11px] font-mono text-neutral-200 bg-neutral-800/90 px-2 py-0.5 rounded-full border border-neutral-700/80">
          {realWidth} × {realHeight} {unit}
        </span>

        {/* Preset Name if not free */}
        {preset !== "free" && (
          <span className="hidden sm:inline-block text-[10px] uppercase font-bold text-sky-300 bg-sky-950/80 px-2 py-0.5 rounded-full border border-sky-750/60">
            {activePresetDef.name}
          </span>
        )}

        {/* Scope Dropdown */}
        <div className="flex items-center space-x-1 bg-neutral-800/90 px-2 py-0.5 rounded-full border border-neutral-700/80 text-[11px]">
          <Layers className="w-3 h-3 text-neutral-400" />
          <select
            value={cropScope}
            onChange={(e) => onCropScopeChange(e.target.value as any)}
            className="bg-transparent text-neutral-200 text-[11px] focus:outline-none cursor-pointer pr-1"
          >
            <option value="current">Page {activePage.pageNumber}</option>
            {(document?.selectedPageIds?.length ?? 0) > 1 && (
              <option value="selected">Selected ({document?.selectedPageIds?.length ?? 0})</option>
            )}
            <option value="all">All ({document?.pages?.length ?? 1})</option>
          </select>
        </div>

        {/* Reset */}
        <button
          onClick={onResetCrop}
          className="p-1 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          title="Reset Crop to Full Page (R)"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        {/* Cancel */}
        <button
          onClick={onCancelCrop}
          className="p-1 rounded-full text-neutral-400 hover:text-rose-300 hover:bg-neutral-800 transition-colors"
          title="Cancel & Exit Crop (Esc)"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        {/* Primary Apply Button */}
        <button
          onClick={onApplyCrop}
          className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold text-[11px] shadow-md shadow-sky-950/60 transition-all active:scale-95"
          title="Apply Crop (Enter)"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Apply</span>
        </button>

        <div className="h-3.5 w-px bg-neutral-750 mx-0.5" />

        {/* Expand Button */}
        <button
          onClick={() => setIsCropPanelCollapsed(false)}
          className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-neutral-800 hover:bg-neutral-750 text-sky-300 hover:text-white border border-neutral-700/80 transition-colors font-medium text-[11px]"
          title="Expand complete crop controls"
        >
          <ChevronDown className="w-3.5 h-3.5 text-sky-400" />
          <span>Expand</span>
        </button>

        {/* Scale Grip */}
        <div
          onMouseDown={handleBarResizeStart}
          onTouchStart={handleBarResizeStart}
          onDoubleClick={() => setBarScale(1.0)}
          className={`flex items-center justify-center p-1 text-neutral-400 hover:text-amber-400 hover:bg-neutral-800 rounded-full transition-colors cursor-se-resize select-none ${
            isResizingBar ? "text-amber-400 bg-neutral-800" : ""
          }`}
          title={`Scale: ${Math.round(barScale * 100)}% (Drag to resize, double-click to reset)`}
        >
          <Scaling className="w-3.5 h-3.5" />
        </div>
      </div>
    );
  }

  // =============================================================
  // EXPANDED STATE: Ultra-Compact Single-Row Desktop Floating Toolbar
  // =============================================================
  return (
    <div
      ref={barRef}
      style={floatingStyle}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      className={`pdf-crop-bar absolute z-40 bg-neutral-900/98 backdrop-blur-2xl rounded-2xl border border-neutral-750/90 shadow-[0_16px_48px_rgba(0,0,0,0.65)] px-3 py-1.5 flex flex-col space-y-1.5 text-xs select-none max-w-[98vw] transition-all duration-150 ${
        isDraggingBar
          ? "ring-2 ring-sky-500/70 shadow-2xl scale-[1.01] cursor-grabbing"
          : isResizingBar
          ? "ring-2 ring-amber-500/70 shadow-2xl cursor-se-resize"
          : "hover:border-neutral-650"
      }`}
    >
      {/* Sleek Primary Single-Row Control Strip */}
      <div className="flex items-center space-x-2">
        {/* Drag Handle & Snap Reset */}
        <div className="flex items-center space-x-1 flex-shrink-0">
          <div
            onMouseDown={handleBarDragStart}
            onTouchStart={handleBarDragStart}
            onDoubleClick={() => {
              setBarPos(null);
              setBarScale(1.0);
            }}
            className="flex items-center justify-center p-1.5 text-neutral-400 hover:text-white cursor-grab active:cursor-grabbing hover:bg-neutral-800/80 rounded-lg transition-colors group select-none"
            title="Drag Crop Bar anywhere in workspace (Double-click to snap back to top-center)"
          >
            <GripVertical className="w-4 h-4 text-neutral-400 group-hover:text-sky-400 transition-colors" />
          </div>

          {barPos && (
            <button
              onClick={() => {
                setBarPos(null);
                setBarScale(1.0);
              }}
              className="p-1 rounded-lg text-neutral-400 hover:text-sky-300 hover:bg-neutral-800 transition-colors"
              title="Snap Crop Bar back to top center"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}

          <div className="flex items-center space-x-1.5 px-2 py-1 rounded-lg bg-sky-500/15 text-sky-400 font-bold border border-sky-500/30 flex-shrink-0">
            <Crop className="w-3.5 h-3.5" />
            <span className="tracking-wide uppercase text-[11px] font-semibold">Crop</span>
          </div>
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-neutral-750/80 flex-shrink-0" />

        {/* GROUP 1: Presets Popover Dropdown */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setActivePopover(activePopover === "preset" ? null : "preset")}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors ${
              activePopover === "preset"
                ? "bg-sky-600 text-white border-sky-400 shadow-sm"
                : preset !== "free"
                ? "bg-sky-950/60 text-sky-300 border-sky-700/60 hover:bg-sky-900/60"
                : "bg-neutral-800 text-neutral-200 border-neutral-700 hover:bg-neutral-750"
            }`}
            title="Choose standard document crop preset"
          >
            <span className="font-semibold">{activePresetDef.name}</span>
            <ChevronDown className="w-3 h-3 text-neutral-400" />
          </button>

          {activePopover === "preset" && (
            <div className="absolute top-full left-0 mt-1.5 w-60 bg-neutral-900/98 backdrop-blur-2xl border border-neutral-750 shadow-2xl rounded-xl p-1.5 z-50 flex flex-col space-y-0.5 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-800">
                Crop Presets & Formats
              </div>
              <div className="max-h-64 overflow-y-auto custom-scrollbar py-1 space-y-0.5">
                {CROP_PRESETS.map((p) => {
                  const isSelected = preset === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => handlePresetSelect(p.id)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between text-[11px] transition-colors ${
                        isSelected
                          ? "bg-sky-600 text-white font-bold"
                          : "text-neutral-200 hover:bg-neutral-800 hover:text-white"
                      }`}
                    >
                      <div className="flex flex-col text-left">
                        <span className="font-medium">{p.name}</span>
                        <span className={`text-[9px] ${isSelected ? "text-sky-100" : "text-neutral-400"}`}>
                          {p.description}
                        </span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* GROUP 2: Aspect Ratio Lock & Presets Popover */}
        <div className="relative flex items-center space-x-1 flex-shrink-0">
          <button
            onClick={() => {
              if (aspectRatioLocked) {
                onAspectRatioLockChange(false, null);
              } else {
                const currentRatio = (cropBox.width * pageWidth) / (cropBox.height * pageHeight);
                onAspectRatioLockChange(true, currentRatio);
              }
            }}
            className={`flex items-center space-x-1 px-2 py-1 rounded-lg border text-[11px] font-medium transition-colors ${
              aspectRatioLocked
                ? "bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold"
                : "bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-750"
            }`}
            title="Lock Current Aspect Ratio (L)"
          >
            {aspectRatioLocked ? <Lock className="w-3 h-3 text-amber-400" /> : <Unlock className="w-3 h-3 text-neutral-400" />}
            <span className="hidden sm:inline">{aspectRatioLocked ? "Locked" : "Ratio"}</span>
          </button>

          {/* Quick Ratio Popover Button */}
          <button
            onClick={() => setActivePopover(activePopover === "ratio" ? null : "ratio")}
            className={`p-1 rounded-lg border text-[11px] transition-colors ${
              activePopover === "ratio"
                ? "bg-sky-600 text-white border-sky-400"
                : "bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-750"
            }`}
            title="Select predefined aspect ratio"
          >
            <ChevronDown className="w-3 h-3 text-neutral-400" />
          </button>

          {activePopover === "ratio" && (
            <div className="absolute top-full left-0 mt-1.5 w-48 bg-neutral-900/98 backdrop-blur-2xl border border-neutral-750 shadow-2xl rounded-xl p-1.5 z-50 flex flex-col space-y-0.5 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-800">
                Aspect Ratios
              </div>
              <div className="py-1 space-y-0.5">
                {ratioPresets.map((r) => {
                  const isSelected =
                    aspectRatioLocked &&
                    targetAspectRatio !== null &&
                    r.ratio !== null &&
                    Math.abs(targetAspectRatio - r.ratio) < 0.01;
                  const isFreeSelected = !aspectRatioLocked && r.ratio === null;

                  return (
                    <button
                      key={r.label}
                      onClick={() => {
                        setActivePopover(null);
                        if (r.ratio === null) {
                          onAspectRatioLockChange(false, null);
                        } else {
                          onAspectRatioLockChange(true, r.ratio);
                          const fitted = fitAspectRatioInPage(r.ratio, pageWidth, pageHeight);
                          onCropBoxChange(fitted);
                        }
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between text-[11px] transition-colors ${
                        isSelected || isFreeSelected
                          ? "bg-sky-600 text-white font-bold"
                          : "text-neutral-200 hover:bg-neutral-800 hover:text-white"
                      }`}
                    >
                      <div className="flex flex-col text-left">
                        <span className="font-mono">{r.label}</span>
                        <span className={`text-[9px] ${isSelected || isFreeSelected ? "text-sky-100" : "text-neutral-400"}`}>
                          {r.desc}
                        </span>
                      </div>
                      {(isSelected || isFreeSelected) && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-neutral-750/80 flex-shrink-0" />

        {/* GROUP 3: Exact Dimensions & Coordinates (W, H, Units, Position Popover) */}
        <div className="flex items-center space-x-1.5 flex-shrink-0">
          {/* Width */}
          <div className="flex items-center space-x-1 bg-neutral-800/90 px-1.5 py-0.5 rounded-lg border border-neutral-700/90">
            <span className="text-[10px] font-mono text-neutral-400">W:</span>
            <input
              type="number"
              step={unit === "inch" || unit === "cm" ? "0.1" : "1"}
              min="1"
              value={realWidth}
              onChange={(e) => handleWidthInputChange(parseFloat(e.target.value))}
              className="w-13 bg-neutral-900 text-neutral-100 font-mono text-[11px] px-1 py-0.5 rounded border border-neutral-750 focus:outline-none focus:border-sky-500 text-right"
              title="Crop box width in active unit"
            />
          </div>

          {/* Height */}
          <div className="flex items-center space-x-1 bg-neutral-800/90 px-1.5 py-0.5 rounded-lg border border-neutral-700/90">
            <span className="text-[10px] font-mono text-neutral-400">H:</span>
            <input
              type="number"
              step={unit === "inch" || unit === "cm" ? "0.1" : "1"}
              min="1"
              value={realHeight}
              onChange={(e) => handleHeightInputChange(parseFloat(e.target.value))}
              className="w-13 bg-neutral-900 text-neutral-100 font-mono text-[11px] px-1 py-0.5 rounded border border-neutral-750 focus:outline-none focus:border-sky-500 text-right"
              title="Crop box height in active unit"
            />
          </div>

          {/* Unit Selector */}
          <select
            value={unit}
            onChange={(e) => onUnitChange(e.target.value as CropUnit)}
            className="bg-neutral-800/90 text-neutral-200 text-[11px] font-mono px-1.5 py-1 rounded-lg border border-neutral-700/90 focus:outline-none cursor-pointer"
            title="Measurement unit"
          >
            <option value="mm">mm</option>
            <option value="cm">cm</option>
            <option value="inch">in</option>
            <option value="px">px</option>
            <option value="pt">pt</option>
          </select>

          {/* Coordinates & Alignment Popover Button */}
          <div className="relative">
            <button
              onClick={() => setActivePopover(activePopover === "coords" ? null : "coords")}
              className={`p-1 rounded-lg border transition-colors ${
                activePopover === "coords"
                  ? "bg-sky-600 text-white border-sky-400"
                  : "bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-750"
              }`}
              title="Position coordinates (X/Y) & Alignment"
            >
              <Move className="w-3.5 h-3.5" />
            </button>

            {activePopover === "coords" && (
              <div className="absolute top-full left-0 mt-1.5 w-56 bg-neutral-900/98 backdrop-blur-2xl border border-neutral-750 shadow-2xl rounded-xl p-2.5 z-50 flex flex-col space-y-2 animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                    Crop Coordinates & Alignment
                  </span>
                  <span className="text-[10px] font-mono text-sky-400">{unit}</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center space-x-1.5 bg-neutral-800/90 px-2 py-1 rounded-lg border border-neutral-700">
                    <span className="text-[10px] font-mono text-neutral-400">X:</span>
                    <input
                      type="number"
                      step={unit === "inch" || unit === "cm" ? "0.1" : "1"}
                      min="0"
                      value={realX}
                      onChange={(e) => handleXInputChange(parseFloat(e.target.value))}
                      className="w-full bg-neutral-900 text-neutral-100 font-mono text-[11px] px-1 py-0.5 rounded border border-neutral-750 focus:outline-none focus:border-sky-500 text-right"
                    />
                  </div>

                  <div className="flex items-center space-x-1.5 bg-neutral-800/90 px-2 py-1 rounded-lg border border-neutral-700">
                    <span className="text-[10px] font-mono text-neutral-400">Y:</span>
                    <input
                      type="number"
                      step={unit === "inch" || unit === "cm" ? "0.1" : "1"}
                      min="0"
                      value={realY}
                      onChange={(e) => handleYInputChange(parseFloat(e.target.value))}
                      className="w-full bg-neutral-900 text-neutral-100 font-mono text-[11px] px-1 py-0.5 rounded border border-neutral-750 focus:outline-none focus:border-sky-500 text-right"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <button
                    onClick={handleCenterCropBox}
                    className="flex items-center justify-center space-x-1 px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-750 text-neutral-200 text-[10px] border border-neutral-700 transition-colors"
                    title="Center cropbox horizontally & vertically"
                  >
                    <Crosshair className="w-3 h-3 text-sky-400" />
                    <span>Center</span>
                  </button>

                  <button
                    onClick={handleMaximizeCropBox}
                    className="flex items-center justify-center space-x-1 px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-750 text-neutral-200 text-[10px] border border-neutral-700 transition-colors"
                    title="Maximize cropbox to entire page"
                  >
                    <Maximize2 className="w-3 h-3 text-emerald-400" />
                    <span>Maximize</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-neutral-750/80 flex-shrink-0" />

        {/* GROUP 4: Auto Detect & Margins & Live Preview (Compact Tool Icons) */}
        <div className="flex items-center space-x-1 flex-shrink-0">
          {/* Auto-Detect Sparkles */}
          <button
            onClick={handleAutoDetect}
            disabled={isAutoDetecting}
            className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-gradient-to-r from-amber-950/40 to-yellow-950/40 hover:from-amber-900/60 hover:to-yellow-900/60 text-amber-300 border border-amber-600/40 font-medium text-[11px] transition-all disabled:opacity-50"
            title="Auto-detect content bounds using optical CV analysis"
          >
            <Sparkles className={`w-3.5 h-3.5 text-amber-400 ${isAutoDetecting ? "animate-spin" : ""}`} />
            <span className="hidden md:inline">{isAutoDetecting ? "Detecting..." : "Auto"}</span>
          </button>

          {/* Margins Popover Button */}
          <div className="relative">
            <button
              onClick={() => setActivePopover(activePopover === "margins" ? null : "margins")}
              className={`flex items-center space-x-1 px-2 py-1 rounded-lg border text-[11px] transition-colors ${
                activePopover === "margins"
                  ? "bg-neutral-700 text-white border-neutral-500"
                  : "bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-750"
              }`}
              title="Configure crop margins from page edges"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden lg:inline">Margins</span>
            </button>

            {activePopover === "margins" && (
              <div className="absolute top-full right-0 mt-1.5 w-72 bg-neutral-900/98 backdrop-blur-2xl border border-neutral-750 shadow-2xl rounded-xl p-3 z-50 flex flex-col space-y-2.5 animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-1">
                  <span className="text-[11px] font-bold text-neutral-200">Page Crop Margins</span>
                  <button
                    onClick={() => setEqualMargins(!equalMargins)}
                    className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] border transition-colors ${
                      equalMargins
                        ? "bg-sky-500/20 text-sky-400 border-sky-500/40 font-bold"
                        : "bg-neutral-800 text-neutral-400 border-neutral-700"
                    }`}
                    title="Toggle linked equal margins across all 4 sides"
                  >
                    {equalMargins ? <Link className="w-3 h-3" /> : <Unlink className="w-3 h-3" />}
                    <span>{equalMargins ? "Equal" : "Independent"}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  {/* Top Margin */}
                  <div className="flex items-center space-x-1 bg-neutral-800/90 px-2 py-1 rounded-lg border border-neutral-700">
                    <span className="text-neutral-400 w-10">Top:</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={margins.top}
                      onChange={(e) => handleMarginChange("top", parseFloat(e.target.value))}
                      className="w-full bg-neutral-900 text-neutral-100 font-mono text-[11px] px-1 py-0.5 rounded border border-neutral-750 focus:outline-none focus:border-sky-500 text-right"
                    />
                    <span className="text-neutral-400 font-mono">{unit}</span>
                  </div>

                  {/* Bottom Margin */}
                  <div className="flex items-center space-x-1 bg-neutral-800/90 px-2 py-1 rounded-lg border border-neutral-700">
                    <span className="text-neutral-400 w-10">Btm:</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={margins.bottom}
                      onChange={(e) => handleMarginChange("bottom", parseFloat(e.target.value))}
                      className="w-full bg-neutral-900 text-neutral-100 font-mono text-[11px] px-1 py-0.5 rounded border border-neutral-750 focus:outline-none focus:border-sky-500 text-right"
                    />
                    <span className="text-neutral-400 font-mono">{unit}</span>
                  </div>

                  {/* Left Margin */}
                  <div className="flex items-center space-x-1 bg-neutral-800/90 px-2 py-1 rounded-lg border border-neutral-700">
                    <span className="text-neutral-400 w-10">Left:</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={margins.left}
                      onChange={(e) => handleMarginChange("left", parseFloat(e.target.value))}
                      className="w-full bg-neutral-900 text-neutral-100 font-mono text-[11px] px-1 py-0.5 rounded border border-neutral-750 focus:outline-none focus:border-sky-500 text-right"
                    />
                    <span className="text-neutral-400 font-mono">{unit}</span>
                  </div>

                  {/* Right Margin */}
                  <div className="flex items-center space-x-1 bg-neutral-800/90 px-2 py-1 rounded-lg border border-neutral-700">
                    <span className="text-neutral-400 w-10">Right:</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={margins.right}
                      onChange={(e) => handleMarginChange("right", parseFloat(e.target.value))}
                      className="w-full bg-neutral-900 text-neutral-100 font-mono text-[11px] px-1 py-0.5 rounded border border-neutral-750 focus:outline-none focus:border-sky-500 text-right"
                    />
                    <span className="text-neutral-400 font-mono">{unit}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Live Preview Toggle Button */}
          <button
            onClick={() => setShowLivePreview(!showLivePreview)}
            className={`p-1 rounded-lg border transition-colors ${
              showLivePreview
                ? "bg-emerald-950/60 text-emerald-300 border-emerald-500/50"
                : "bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-750"
            }`}
            title="Toggle live cropped preview card"
          >
            {showLivePreview ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-neutral-400" />}
          </button>
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-neutral-750/80 flex-shrink-0" />

        {/* GROUP 5: Target Scope */}
        <div className="flex items-center space-x-1 bg-neutral-800/90 px-2 py-1 rounded-lg border border-neutral-700/90 flex-shrink-0">
          <Layers className="w-3 h-3 text-neutral-400" />
          <select
            value={cropScope}
            onChange={(e) => onCropScopeChange(e.target.value as any)}
            className="bg-transparent text-neutral-200 text-[11px] focus:outline-none cursor-pointer"
            title="Target pages to crop"
          >
            <option value="current">Page {activePage.pageNumber}</option>
            {(document?.selectedPageIds?.length ?? 0) > 1 && (
              <option value="selected">Selected ({document?.selectedPageIds?.length ?? 0})</option>
            )}
            <option value="all">All ({document?.pages?.length ?? 1})</option>
          </select>
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-neutral-750/80 flex-shrink-0" />

        {/* GROUP 6: Actions (Hierarchy: Reset, Cancel, Apply) */}
        <div className="flex items-center space-x-1.5 flex-shrink-0">
          <button
            onClick={onResetCrop}
            className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-750 text-neutral-300 hover:text-white border border-neutral-700/90 transition-colors text-[11px]"
            title="Reset crop box to full page (R)"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="hidden sm:inline">Reset</span>
          </button>

          <button
            onClick={onCancelCrop}
            className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-750 text-neutral-300 hover:text-rose-300 border border-neutral-700/90 transition-colors text-[11px]"
            title="Exit crop mode without saving (Esc)"
          >
            <X className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Cancel</span>
          </button>

          {/* Primary Action */}
          <button
            onClick={onApplyCrop}
            className="flex items-center space-x-1.5 px-3.5 py-1 rounded-lg bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold shadow-md shadow-sky-950/60 transition-all active:scale-95 text-[11px]"
            title="Permanently crop PDF page (Enter)"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Apply Crop</span>
          </button>

          {/* Collapse Button */}
          <button
            onClick={() => setIsCropPanelCollapsed(true)}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            title="Collapse Crop Bar to compact capsule"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>

          {/* Scale Grip */}
          <div
            onMouseDown={handleBarResizeStart}
            onTouchStart={handleBarResizeStart}
            onDoubleClick={() => setBarScale(1.0)}
            className={`flex items-center justify-center p-1 text-neutral-400 hover:text-amber-400 hover:bg-neutral-800 rounded-lg transition-colors cursor-se-resize select-none ${
              isResizingBar ? "text-amber-400 bg-neutral-800" : ""
            }`}
            title={`Scale toolbar: ${Math.round(barScale * 100)}% (Drag to scale, double click to reset)`}
          >
            <Scaling className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* Floating Live Crop Preview Card (Docked directly under bar) */}
      {showLivePreview && (
        <div className="absolute top-full right-2 mt-2 w-64 bg-neutral-900/98 backdrop-blur-2xl border border-sky-500/40 rounded-xl p-2.5 shadow-2xl z-50 flex flex-col space-y-2 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-1 border-b border-neutral-800">
            <span className="font-bold text-sky-300 text-[11px] flex items-center gap-1.5">
              <Eye className="w-3 h-3" />
              <span>Live Cropped Preview</span>
            </span>
            <button
              onClick={() => setShowLivePreview(false)}
              className="p-0.5 rounded text-neutral-400 hover:text-white hover:bg-neutral-800"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Cropped Region Simulation Preview Container */}
          <div className="relative w-full h-40 bg-neutral-950 rounded-lg overflow-hidden border border-neutral-800 flex items-center justify-center p-1.5">
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

          <div className="text-[10px] text-neutral-300 flex items-center justify-between font-mono bg-neutral-850 px-2 py-1 rounded border border-neutral-750">
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
