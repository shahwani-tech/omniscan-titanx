/**
 * OMNISCAN TITAN X - Background Image Crop Modal
 * Dedicated crop system for background layer images.
 * Free crop, aspect ratio constraints (1:1, 4:3, 16:9, 35:45), corner/edge handles,
 * and clear coordinate separation from foreground & canvas.
 */

import React, { useState, useRef, useEffect } from "react";
import { BackgroundCrop } from "../../engine/background/types";
import { applyBackgroundCrop } from "../../engine/background/backgroundTransforms";
import { Crop, Check, X, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";

interface BackgroundCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  initialCrop?: BackgroundCrop | null;
  onApplyCrop: (croppedDataUrl: string, cropDef: BackgroundCrop) => void;
}

export const BackgroundCropModal: React.FC<BackgroundCropModalProps> = ({
  isOpen,
  onClose,
  imageSrc,
  initialCrop,
  onApplyCrop,
}) => {
  const [ratioMode, setRatioMode] = useState<"free" | "1:1" | "4:3" | "16:9" | "35:45">("free");
  // Normalized 0..1 crop box
  const [cropBox, setCropBox] = useState<{ x: number; y: number; w: number; h: number }>({
    x: 0.1,
    y: 0.1,
    w: 0.8,
    h: 0.8,
  });

  const [isDraggingBox, setIsDraggingBox] = useState(false);
  const [activeHandle, setActiveHandle] = useState<string | null>(null);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; box: typeof cropBox }>({
    mouseX: 0,
    mouseY: 0,
    box: cropBox,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (initialCrop) {
      setCropBox({
        x: initialCrop.x,
        y: initialCrop.y,
        w: initialCrop.width,
        h: initialCrop.height,
      });
    } else {
      setCropBox({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 });
    }
  }, [initialCrop, isOpen]);

  if (!isOpen) return null;

  const handleRatioSelect = (mode: typeof ratioMode) => {
    setRatioMode(mode);
    let targetRatio: number | null = null;
    if (mode === "1:1") targetRatio = 1;
    else if (mode === "4:3") targetRatio = 4 / 3;
    else if (mode === "16:9") targetRatio = 16 / 9;
    else if (mode === "35:45") targetRatio = 35 / 45;

    if (targetRatio !== null && imgRef.current) {
      const imgAspect = (imgRef.current.naturalWidth || 1) / (imgRef.current.naturalHeight || 1);
      // Adjust box w/h to match ratio in image pixel space
      const newW = 0.8;
      const newH = Math.min(0.9, (newW * imgAspect) / targetRatio);
      setCropBox({
        x: Math.max(0, (1 - newW) / 2),
        y: Math.max(0, (1 - newH) / 2),
        w: newW,
        h: newH,
      });
    }
  };

  const handlePointerDownBox = (e: React.PointerEvent) => {
    e.stopPropagation();
    setIsDraggingBox(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      box: { ...cropBox },
    };
  };

  const handlePointerDownHandle = (e: React.PointerEvent, handle: string) => {
    e.stopPropagation();
    setActiveHandle(handle);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      box: { ...cropBox },
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const dx = (e.clientX - dragStartRef.current.mouseX) / rect.width;
    const dy = (e.clientY - dragStartRef.current.mouseY) / rect.height;

    const initial = dragStartRef.current.box;

    if (isDraggingBox) {
      const nextX = Math.max(0, Math.min(1 - initial.w, initial.x + dx));
      const nextY = Math.max(0, Math.min(1 - initial.h, initial.y + dy));
      setCropBox({ ...initial, x: nextX, y: nextY });
    } else if (activeHandle) {
      let { x, y, w, h } = initial;

      if (activeHandle.includes("r")) {
        w = Math.max(0.05, Math.min(1 - x, initial.w + dx));
      }
      if (activeHandle.includes("b")) {
        h = Math.max(0.05, Math.min(1 - y, initial.h + dy));
      }
      if (activeHandle.includes("l")) {
        const potentialX = Math.max(0, Math.min(initial.x + initial.w - 0.05, initial.x + dx));
        w = initial.w - (potentialX - initial.x);
        x = potentialX;
      }
      if (activeHandle.includes("t")) {
        const potentialY = Math.max(0, Math.min(initial.y + initial.h - 0.05, initial.y + dy));
        h = initial.h - (potentialY - initial.y);
        y = potentialY;
      }

      setCropBox({ x, y, w, h });
    }
  };

  const handlePointerUp = () => {
    setIsDraggingBox(false);
    setActiveHandle(null);
  };

  const handleApply = async () => {
    const cropDef: BackgroundCrop = {
      x: cropBox.x,
      y: cropBox.y,
      width: cropBox.w,
      height: cropBox.h,
      aspectRatio:
        ratioMode === "1:1"
          ? 1
          : ratioMode === "4:3"
          ? 4 / 3
          : ratioMode === "16:9"
          ? 16 / 9
          : ratioMode === "35:45"
          ? 35 / 45
          : null,
    };

    try {
      const croppedDataUrl = await applyBackgroundCrop(imageSrc, cropDef);
      onApplyCrop(croppedDataUrl, cropDef);
      onClose();
    } catch (err) {
      console.error("Crop application failed:", err);
      alert("Could not crop background image.");
    }
  };

  return (
    <div className="fixed inset-0 z-70 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
      <div className="bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl flex flex-col w-full max-w-4xl h-[85vh] overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-800 bg-neutral-850">
          <div className="flex items-center space-x-2.5">
            <Crop className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-white text-sm uppercase tracking-wider">
              Background Layer Image Crop
            </h3>
          </div>

          {/* Aspect Ratio Switcher */}
          <div className="flex items-center space-x-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800 text-xs">
            {(["free", "1:1", "4:3", "16:9", "35:45"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => handleRatioSelect(mode)}
                className={`px-2 py-1 rounded font-medium transition-colors ${
                  ratioMode === mode
                    ? "bg-emerald-600 text-white shadow"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                {mode === "35:45" ? "Passport (35:45)" : mode}
              </button>
            ))}
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Interactive Crop Stage */}
        <div
          className="flex-1 bg-neutral-950 relative flex items-center justify-center p-6 overflow-hidden"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          <div ref={containerRef} className="relative max-w-full max-h-full inline-block">
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Source for background crop"
              className="max-h-[62vh] max-w-[70vw] object-contain block pointer-events-none select-none"
            />

            {/* Dark Mask Shading Outside Crop Box */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.65)",
                clipPath: `polygon(
                  0% 0%, 100% 0%, 100% 100%, 0% 100%,
                  0% 0%,
                  ${cropBox.x * 100}% ${cropBox.y * 100}%,
                  ${cropBox.x * 100}% ${(cropBox.y + cropBox.h) * 100}%,
                  ${(cropBox.x + cropBox.w) * 100}% ${(cropBox.y + cropBox.h) * 100}%,
                  ${(cropBox.x + cropBox.w) * 100}% ${cropBox.y * 100}%,
                  ${cropBox.x * 100}% ${cropBox.y * 100}%
                )`,
              }}
            />

            {/* Draggable & Resizable Crop Frame */}
            <div
              onPointerDown={handlePointerDownBox}
              className="absolute border-2 border-emerald-400 cursor-move"
              style={{
                left: `${cropBox.x * 100}%`,
                top: `${cropBox.y * 100}%`,
                width: `${cropBox.w * 100}%`,
                height: `${cropBox.h * 100}%`,
              }}
            >
              {/* Thirds Grid Guidelines */}
              <div className="w-full h-full grid grid-cols-3 grid-rows-3 pointer-events-none">
                <div className="border-r border-b border-white/20" />
                <div className="border-r border-b border-white/20" />
                <div className="border-b border-white/20" />
                <div className="border-r border-b border-white/20" />
                <div className="border-r border-b border-white/20" />
                <div className="border-b border-white/20" />
                <div className="border-r border-white/20" />
                <div className="border-r border-white/20" />
                <div />
              </div>

              {/* Corner Handles */}
              <div
                onPointerDown={(e) => handlePointerDownHandle(e, "tl")}
                className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-emerald-400 border-2 border-white rounded-full cursor-nwse-resize"
              />
              <div
                onPointerDown={(e) => handlePointerDownHandle(e, "tr")}
                className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-emerald-400 border-2 border-white rounded-full cursor-nesw-resize"
              />
              <div
                onPointerDown={(e) => handlePointerDownHandle(e, "bl")}
                className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-emerald-400 border-2 border-white rounded-full cursor-nesw-resize"
              />
              <div
                onPointerDown={(e) => handlePointerDownHandle(e, "br")}
                className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-emerald-400 border-2 border-white rounded-full cursor-nwse-resize"
              />

              {/* Edge Handles */}
              <div
                onPointerDown={(e) => handlePointerDownHandle(e, "t")}
                className="absolute -top-1 left-1/2 -translate-x-1/2 w-5 h-2 bg-emerald-400 border border-white rounded-sm cursor-ns-resize"
              />
              <div
                onPointerDown={(e) => handlePointerDownHandle(e, "b")}
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-2 bg-emerald-400 border border-white rounded-sm cursor-ns-resize"
              />
              <div
                onPointerDown={(e) => handlePointerDownHandle(e, "l")}
                className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-5 bg-emerald-400 border border-white rounded-sm cursor-ew-resize"
              />
              <div
                onPointerDown={(e) => handlePointerDownHandle(e, "r")}
                className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-5 bg-emerald-400 border border-white rounded-sm cursor-ew-resize"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-neutral-800 bg-neutral-850">
          <button
            onClick={() => setCropBox({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 })}
            className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 flex items-center space-x-1 text-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Crop Box</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-lg"
            >
              <Check className="w-4 h-4" />
              <span>Apply Background Crop</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
