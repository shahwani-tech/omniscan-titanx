import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Crop,
  RotateCw,
  RotateCcw,
  Check,
  X,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Move,
  Maximize2,
} from "lucide-react";

export interface A6CropBox {
  x: number; // 0 to 1 normalized
  y: number; // 0 to 1 normalized
  width: number; // 0 to 1 normalized
  height: number; // 0 to 1 normalized
}

interface A6HalfCardCropModalProps {
  isOpen: boolean;
  imageSrc: string;
  cardSide: "front" | "back";
  targetWidthMm: number;
  targetHeightMm: number;
  onApplyCrop: (croppedDataUrl: string) => void;
  onClose: () => void;
}

export const A6HalfCardCropModal: React.FC<A6HalfCardCropModalProps> = ({
  isOpen,
  imageSrc,
  cardSide,
  targetWidthMm,
  targetHeightMm,
  onApplyCrop,
  onClose,
}) => {
  const [cropBox, setCropBox] = useState<A6CropBox>({
    x: 0.05,
    y: 0.05,
    width: 0.9,
    height: 0.9,
  });

  const [rotation, setRotation] = useState<number>(0);
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [lockRatio, setLockRatio] = useState<boolean>(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Dragging crop handles
  const [activeHandle, setActiveHandle] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [cropStart, setCropStart] = useState<A6CropBox>(cropBox);

  // Target aspect ratio (width / height)
  const targetAspect = targetWidthMm / targetHeightMm;

  // Initialize crop box to target ratio
  useEffect(() => {
    if (!isOpen) return;
    setRotation(0);
    setZoom(1.0);
    setPan({ x: 0, y: 0 });

    // Center an initial box respecting target ratio
    if (targetAspect <= 1) {
      // Portrait card
      const h = 0.85;
      const w = Math.min(0.85, h * targetAspect);
      setCropBox({
        x: (1 - w) / 2,
        y: (1 - h) / 2,
        width: w,
        height: h,
      });
    } else {
      // Landscape card
      const w = 0.85;
      const h = Math.min(0.85, w / targetAspect);
      setCropBox({
        x: (1 - w) / 2,
        y: (1 - h) / 2,
        width: w,
        height: h,
      });
    }
  }, [isOpen, targetAspect]);

  const handlePointerDown = (handle: string, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setActiveHandle(handle);
    setDragStart({ x: e.clientX, y: e.clientY });
    setCropStart({ ...cropBox });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activeHandle || !containerRef.current) return;
    e.preventDefault();

    const rect = containerRef.current.getBoundingClientRect();
    const dx = (e.clientX - dragStart.x) / rect.width;
    const dy = (e.clientY - dragStart.y) / rect.height;

    let { x, y, width, height } = cropStart;

    if (activeHandle === "move") {
      x = Math.max(0, Math.min(1 - width, x + dx));
      y = Math.max(0, Math.min(1 - height, y + dy));
      setCropBox({ x, y, width, height });
      return;
    }

    // Handle corner resizing
    if (activeHandle === "se") {
      let newW = Math.max(0.1, Math.min(1 - x, width + dx));
      let newH = Math.max(0.1, Math.min(1 - y, height + dy));
      if (lockRatio) {
        newH = newW / targetAspect;
        if (y + newH > 1) {
          newH = 1 - y;
          newW = newH * targetAspect;
        }
      }
      setCropBox({ x, y, width: newW, height: newH });
    } else if (activeHandle === "sw") {
      let newW = Math.max(0.1, width - dx);
      let newX = x + (width - newW);
      if (newX < 0) {
        newW += newX;
        newX = 0;
      }
      let newH = Math.max(0.1, Math.min(1 - y, height + dy));
      if (lockRatio) {
        newH = newW / targetAspect;
        if (y + newH > 1) {
          newH = 1 - y;
          newW = newH * targetAspect;
          newX = cropStart.x + cropStart.width - newW;
        }
      }
      setCropBox({ x: newX, y, width: newW, height: newH });
    } else if (activeHandle === "ne") {
      let newW = Math.max(0.1, Math.min(1 - x, width + dx));
      let newH = Math.max(0.1, height - dy);
      let newY = y + (height - newH);
      if (newY < 0) {
        newH += newY;
        newY = 0;
      }
      if (lockRatio) {
        newH = newW / targetAspect;
        newY = cropStart.y + cropStart.height - newH;
        if (newY < 0) {
          newY = 0;
          newH = cropStart.y + cropStart.height;
          newW = newH * targetAspect;
        }
      }
      setCropBox({ x, y: newY, width: newW, height: newH });
    } else if (activeHandle === "nw") {
      let newW = Math.max(0.1, width - dx);
      let newX = x + (width - newW);
      if (newX < 0) {
        newW += newX;
        newX = 0;
      }
      let newH = Math.max(0.1, height - dy);
      let newY = y + (height - newH);
      if (newY < 0) {
        newH += newY;
        newY = 0;
      }
      if (lockRatio) {
        newH = newW / targetAspect;
        newY = cropStart.y + cropStart.height - newH;
        if (newY < 0) {
          newY = 0;
          newH = cropStart.y + cropStart.height;
          newW = newH * targetAspect;
          newX = cropStart.x + cropStart.width - newW;
        }
      }
      setCropBox({ x: newX, y: newY, width: newW, height: newH });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (activeHandle) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Safe catch
      }
      setActiveHandle(null);
    }
  };

  const handleApply = async () => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // Create offscreen canvas for cropped image at high resolution
      const outCanvas = document.createElement("canvas");
      const cropPxW = img.naturalWidth * cropBox.width;
      const cropPxH = img.naturalHeight * cropBox.height;

      outCanvas.width = Math.max(100, Math.round(cropPxW));
      outCanvas.height = Math.max(100, Math.round(cropPxH));
      const ctx = outCanvas.getContext("2d");
      if (!ctx) return;

      const srcX = img.naturalWidth * cropBox.x;
      const srcY = img.naturalHeight * cropBox.y;

      ctx.drawImage(
        img,
        srcX,
        srcY,
        cropPxW,
        cropPxH,
        0,
        0,
        outCanvas.width,
        outCanvas.height
      );

      const croppedUrl = outCanvas.toDataURL("image/png");
      onApplyCrop(croppedUrl);
      onClose();
    };
    img.src = imageSrc;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-neutral-900 border border-neutral-750 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-800 bg-neutral-950/70">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <Crop className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <span>Crop {cardSide.toUpperCase()} Card</span>
                <span className="text-[11px] font-mono font-normal text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800/60">
                  Target: {targetWidthMm} × {targetHeightMm} mm
                </span>
              </h3>
              <p className="text-[11px] text-neutral-400">
                Drag corners to crop, or use ratio lock to match the A6 half-card frame.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-2 border-b border-neutral-800 bg-neutral-900/90 text-xs">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setLockRatio(!lockRatio)}
              className={`px-2.5 py-1 rounded text-[11px] font-medium border flex items-center space-x-1.5 transition-colors ${
                lockRatio
                  ? "bg-indigo-600/30 text-indigo-300 border-indigo-500/50"
                  : "bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-white"
              }`}
            >
              <Maximize2 className="w-3 h-3" />
              <span>Lock Aspect ({targetWidthMm}:{targetHeightMm})</span>
            </button>
            <button
              onClick={() => {
                setCropBox({ x: 0.05, y: 0.05, width: 0.9, height: 0.9 });
              }}
              className="px-2.5 py-1 rounded text-[11px] bg-neutral-800 hover:bg-neutral-750 text-neutral-300 border border-neutral-700 flex items-center space-x-1 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Full Image</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setRotation((prev) => (prev - 90 + 360) % 360)}
              className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
              title="Rotate Left 90°"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setRotation((prev) => (prev + 90) % 360)}
              className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
              title="Rotate Right 90°"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Workspace Canvas Area */}
        <div
          className="flex-1 bg-neutral-950 flex items-center justify-center p-6 relative overflow-hidden"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div
            ref={containerRef}
            className="relative inline-block border border-neutral-800 rounded-lg shadow-2xl max-w-full max-h-[60vh] overflow-hidden"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: "transform 0.2s ease-out",
            }}
          >
            <img
              ref={imageRef}
              src={imageSrc}
              alt="Crop target"
              className="max-h-[58vh] max-w-[70vw] object-contain block pointer-events-none select-none"
            />

            {/* Dark Mask outside Crop Box */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "rgba(0, 0, 0, 0.6)",
                clipPath: `polygon(
                  0% 0%, 0% 100%, 100% 100%, 100% 0%, 0% 0%,
                  ${cropBox.x * 100}% ${cropBox.y * 100}%,
                  ${(cropBox.x + cropBox.width) * 100}% ${cropBox.y * 100}%,
                  ${(cropBox.x + cropBox.width) * 100}% ${(cropBox.y + cropBox.height) * 100}%,
                  ${cropBox.x * 100}% ${(cropBox.y + cropBox.height) * 100}%,
                  ${cropBox.x * 100}% ${cropBox.y * 100}%
                )`,
              }}
            />

            {/* Active Crop Box */}
            <div
              className="absolute border-2 border-indigo-400 shadow-[0_0_0_1px_rgba(0,0,0,0.5)] cursor-move"
              style={{
                left: `${cropBox.x * 100}%`,
                top: `${cropBox.y * 100}%`,
                width: `${cropBox.width * 100}%`,
                height: `${cropBox.height * 100}%`,
              }}
              onPointerDown={(e) => handlePointerDown("move", e)}
            >
              {/* Center crosshair / grid lines */}
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
                <div className="border-r border-b border-white/60" />
                <div className="border-r border-b border-white/60" />
                <div className="border-b border-white/60" />
                <div className="border-r border-b border-white/60" />
                <div className="border-r border-b border-white/60" />
                <div className="border-b border-white/60" />
                <div className="border-r border-white/60" />
                <div className="border-r border-white/60" />
                <div />
              </div>

              {/* Corner Handles */}
              <div
                className="absolute -top-1.5 -left-1.5 w-4 h-4 bg-white border-2 border-indigo-500 rounded-sm cursor-nwse-resize shadow-md"
                onPointerDown={(e) => handlePointerDown("nw", e)}
              />
              <div
                className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-white border-2 border-indigo-500 rounded-sm cursor-nesw-resize shadow-md"
                onPointerDown={(e) => handlePointerDown("ne", e)}
              />
              <div
                className="absolute -bottom-1.5 -left-1.5 w-4 h-4 bg-white border-2 border-indigo-500 rounded-sm cursor-nesw-resize shadow-md"
                onPointerDown={(e) => handlePointerDown("sw", e)}
              />
              <div
                className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-white border-2 border-indigo-500 rounded-sm cursor-nwse-resize shadow-md"
                onPointerDown={(e) => handlePointerDown("se", e)}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-neutral-800 bg-neutral-950">
          <span className="text-xs text-neutral-400 font-mono">
            {Math.round(cropBox.width * 100)}% × {Math.round(cropBox.height * 100)}% of source
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md flex items-center space-x-1.5 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Apply Crop</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
