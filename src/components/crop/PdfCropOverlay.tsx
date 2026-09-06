/**
 * OMNISCAN TITAN X - PDF Page Interactive Crop Overlay
 * 8-Point High-Precision Vector Transformation Matrix with Live HUD & Dimensions
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  NormalizedCropBox,
  CropUnit,
  convertPixelsToUnit,
  formatDimension,
} from "../../engine/cropEngine";
import { OmniPage } from "../../types";

interface PdfCropOverlayProps {
  page: OmniPage;
  cropBox: NormalizedCropBox;
  unit: CropUnit;
  aspectRatioLocked: boolean;
  targetAspectRatio: number | null;
  onCropBoxChange: (newBox: NormalizedCropBox) => void;
}

type DragHandleType =
  | "move"
  | "top-left"
  | "top-right"
  | "bottom-right"
  | "bottom-left"
  | "top"
  | "bottom"
  | "left"
  | "right";

export const PdfCropOverlay: React.FC<PdfCropOverlayProps> = ({
  page,
  cropBox,
  unit,
  aspectRatioLocked,
  targetAspectRatio,
  onCropBoxChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeHandle, setActiveHandle] = useState<DragHandleType | null>(null);
  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    initialBox: NormalizedCropBox;
  }>({
    clientX: 0,
    clientY: 0,
    initialBox: cropBox,
  });

  const pageWidth = page.width || 800;
  const pageHeight = page.height || 1000;
  const dpi = page.dpi || 300;

  // Real-world physical dimensions
  const realWidthPx = cropBox.width * pageWidth;
  const realHeightPx = cropBox.height * pageHeight;
  const realXPx = cropBox.x * pageWidth;
  const realYPx = cropBox.y * pageHeight;

  const widthDisplay = formatDimension(realWidthPx, unit, dpi);
  const heightDisplay = formatDimension(realHeightPx, unit, dpi);
  const xDisplay = formatDimension(realXPx, unit, dpi);
  const yDisplay = formatDimension(realYPx, unit, dpi);

  const handlePointerDown = (handle: DragHandleType, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    dragStartRef.current = {
      clientX,
      clientY,
      initialBox: { ...cropBox },
    };
    setActiveHandle(handle);
  };

  useEffect(() => {
    if (!activeHandle) return;

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const clientX = "touches" in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = "touches" in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;

      const deltaXNorm = (clientX - dragStartRef.current.clientX) / rect.width;
      const deltaYNorm = (clientY - dragStartRef.current.clientY) / rect.height;
      const init = dragStartRef.current.initialBox;

      let newX = init.x;
      let newY = init.y;
      let newW = init.width;
      let newH = init.height;

      const minDimensionNorm = 0.05; // Minimum 5% crop box size

      if (activeHandle === "move") {
        newX = Math.max(0, Math.min(1 - init.width, init.x + deltaXNorm));
        newY = Math.max(0, Math.min(1 - init.height, init.y + deltaYNorm));
        onCropBoxChange({ x: newX, y: newY, width: init.width, height: init.height });
        return;
      }

      // Edge and Corner Resizing
      if (activeHandle.includes("left")) {
        const potentialX = init.x + deltaXNorm;
        const clampedX = Math.max(0, Math.min(init.x + init.width - minDimensionNorm, potentialX));
        newW = init.width + (init.x - clampedX);
        newX = clampedX;
      } else if (activeHandle.includes("right")) {
        newW = Math.max(minDimensionNorm, Math.min(1 - init.x, init.width + deltaXNorm));
      }

      if (activeHandle.includes("top")) {
        const potentialY = init.y + deltaYNorm;
        const clampedY = Math.max(0, Math.min(init.y + init.height - minDimensionNorm, potentialY));
        newH = init.height + (init.y - clampedY);
        newY = clampedY;
      } else if (activeHandle.includes("bottom")) {
        newH = Math.max(minDimensionNorm, Math.min(1 - init.y, init.height + deltaYNorm));
      }

      // Maintain Aspect Ratio if locked
      if (aspectRatioLocked && targetAspectRatio) {
        const pageAspect = pageWidth / pageHeight;
        // targetAspectRatio = pixelWidth / pixelHeight
        // normalizedRatio = normWidth / normHeight = targetAspectRatio / pageAspect
        const normRatio = targetAspectRatio / pageAspect;

        if (activeHandle === "left" || activeHandle === "right") {
          newH = Math.min(1 - newY, newW / normRatio);
        } else if (activeHandle === "top" || activeHandle === "bottom") {
          newW = Math.min(1 - newX, newH * normRatio);
        } else {
          // Corner resizing
          const currentCornerRatio = (newW / newH) * pageAspect;
          if (currentCornerRatio > targetAspectRatio) {
            newW = newH * normRatio;
          } else {
            newH = newW / normRatio;
          }

          // Adjust origin anchors for top/left corners
          if (activeHandle === "top-left") {
            newX = init.x + init.width - newW;
            newY = init.y + init.height - newH;
          } else if (activeHandle === "top-right") {
            newY = init.y + init.height - newH;
          } else if (activeHandle === "bottom-left") {
            newX = init.x + init.width - newW;
          }
        }
      }

      // Safety bounds clamp
      newX = Math.max(0, Math.min(1 - minDimensionNorm, newX));
      newY = Math.max(0, Math.min(1 - minDimensionNorm, newY));
      newW = Math.max(minDimensionNorm, Math.min(1 - newX, newW));
      newH = Math.max(minDimensionNorm, Math.min(1 - newY, newH));

      onCropBoxChange({ x: newX, y: newY, width: newW, height: newH });
    };

    const handlePointerUp = () => {
      setActiveHandle(null);
    };

    window.addEventListener("mousemove", handlePointerMove, { passive: false });
    window.addEventListener("mouseup", handlePointerUp);
    window.addEventListener("touchmove", handlePointerMove, { passive: false });
    window.addEventListener("touchend", handlePointerUp);

    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
      window.removeEventListener("touchmove", handlePointerMove);
      window.removeEventListener("touchend", handlePointerUp);
    };
  }, [activeHandle, aspectRatioLocked, targetAspectRatio, pageWidth, pageHeight, onCropBoxChange]);

  const leftPercent = Math.max(0, Math.min(100, (cropBox?.x ?? 0.05) * 100));
  const topPercent = Math.max(0, Math.min(100, (cropBox?.y ?? 0.05) * 100));
  const widthPercent = Math.max(1, Math.min(100 - leftPercent, (cropBox?.width ?? 0.9) * 100));
  const heightPercent = Math.max(1, Math.min(100 - topPercent, (cropBox?.height ?? 0.9) * 100));

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-30 pointer-events-none select-none overflow-hidden"
    >
      {/* 4 Darkened Scrim Masks Outside the Crop Boundary (Translucent, visible PDF underneath) */}
      {/* Top Mask */}
      <div
        style={{ top: 0, left: 0, right: 0, height: `${topPercent}%` }}
        className="absolute bg-black/50 pointer-events-none"
      />
      {/* Bottom Mask */}
      <div
        style={{
          top: `${topPercent + heightPercent}%`,
          left: 0,
          right: 0,
          bottom: 0,
        }}
        className="absolute bg-black/50 pointer-events-none"
      />
      {/* Left Mask */}
      <div
        style={{
          top: `${topPercent}%`,
          height: `${heightPercent}%`,
          left: 0,
          width: `${leftPercent}%`,
        }}
        className="absolute bg-black/50 pointer-events-none"
      />
      {/* Right Mask */}
      <div
        style={{
          top: `${topPercent}%`,
          height: `${heightPercent}%`,
          left: `${leftPercent + widthPercent}%`,
          right: 0,
        }}
        className="absolute bg-black/50 pointer-events-none"
      />

      {/* Main Crop Box with High-Contrast Border */}
      <div
        style={{
          left: `${leftPercent}%`,
          top: `${topPercent}%`,
          width: `${widthPercent}%`,
          height: `${heightPercent}%`,
        }}
        onMouseDown={(e) => handlePointerDown("move", e)}
        onTouchStart={(e) => handlePointerDown("move", e)}
        className="absolute border-2 border-sky-400 shadow-[0_0_0_1px_rgba(0,0,0,0.8),0_0_20px_rgba(56,189,248,0.4)] pointer-events-auto cursor-move group"
      >
        {/* Rule-of-Thirds Grid Guides */}
        <div className="absolute inset-0 pointer-events-none opacity-40 group-hover:opacity-75 transition-opacity">
          {/* Vertical Grid Lines */}
          <div className="absolute top-0 bottom-0 left-1/3 w-px border-l border-dashed border-sky-200" />
          <div className="absolute top-0 bottom-0 left-2/3 w-px border-l border-dashed border-sky-200" />
          {/* Horizontal Grid Lines */}
          <div className="absolute left-0 right-0 top-1/3 h-px border-t border-dashed border-sky-200" />
          <div className="absolute left-0 right-0 top-2/3 h-px border-t border-dashed border-sky-200" />
        </div>

        {/* Dimension & Coordinate HUD Badges */}
        <div className="absolute -top-7 left-0 px-2 py-0.5 rounded bg-sky-950/90 border border-sky-500/80 text-sky-200 font-mono text-[11px] font-bold shadow-xl flex items-center space-x-2 pointer-events-none whitespace-nowrap">
          <span>
            {widthDisplay} × {heightDisplay}
          </span>
          <span className="text-neutral-400 font-normal">
            (X: {xDisplay}, Y: {yDisplay})
          </span>
        </div>

        {/* 4 Corner Handles */}
        {/* Top-Left */}
        <div
          onMouseDown={(e) => handlePointerDown("top-left", e)}
          onTouchStart={(e) => handlePointerDown("top-left", e)}
          className="absolute -top-2 -left-2 w-4 h-4 bg-sky-400 border-2 border-white rounded-sm shadow-md cursor-nwse-resize hover:scale-125 transition-transform"
        />
        {/* Top-Right */}
        <div
          onMouseDown={(e) => handlePointerDown("top-right", e)}
          onTouchStart={(e) => handlePointerDown("top-right", e)}
          className="absolute -top-2 -right-2 w-4 h-4 bg-sky-400 border-2 border-white rounded-sm shadow-md cursor-nesw-resize hover:scale-125 transition-transform"
        />
        {/* Bottom-Right */}
        <div
          onMouseDown={(e) => handlePointerDown("bottom-right", e)}
          onTouchStart={(e) => handlePointerDown("bottom-right", e)}
          className="absolute -bottom-2 -right-2 w-4 h-4 bg-sky-400 border-2 border-white rounded-sm shadow-md cursor-nwse-resize hover:scale-125 transition-transform"
        />
        {/* Bottom-Left */}
        <div
          onMouseDown={(e) => handlePointerDown("bottom-left", e)}
          onTouchStart={(e) => handlePointerDown("bottom-left", e)}
          className="absolute -bottom-2 -left-2 w-4 h-4 bg-sky-400 border-2 border-white rounded-sm shadow-md cursor-nesw-resize hover:scale-125 transition-transform"
        />

        {/* 4 Edge Midpoint Handles */}
        {/* Top */}
        <div
          onMouseDown={(e) => handlePointerDown("top", e)}
          onTouchStart={(e) => handlePointerDown("top", e)}
          className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-7 h-3 bg-sky-400 border border-white rounded-sm shadow cursor-ns-resize hover:scale-110 transition-transform"
        />
        {/* Bottom */}
        <div
          onMouseDown={(e) => handlePointerDown("bottom", e)}
          onTouchStart={(e) => handlePointerDown("bottom", e)}
          className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-7 h-3 bg-sky-400 border border-white rounded-sm shadow cursor-ns-resize hover:scale-110 transition-transform"
        />
        {/* Left */}
        <div
          onMouseDown={(e) => handlePointerDown("left", e)}
          onTouchStart={(e) => handlePointerDown("left", e)}
          className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-7 bg-sky-400 border border-white rounded-sm shadow cursor-ew-resize hover:scale-110 transition-transform"
        />
        {/* Right */}
        <div
          onMouseDown={(e) => handlePointerDown("right", e)}
          onTouchStart={(e) => handlePointerDown("right", e)}
          className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-7 bg-sky-400 border border-white rounded-sm shadow cursor-ew-resize hover:scale-110 transition-transform"
        />
      </div>
    </div>
  );
};
