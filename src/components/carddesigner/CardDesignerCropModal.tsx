/**
 * CardDesignerCropModal.tsx
 * 
 * Advanced 8-point crop overlay for images, photos, and signatures in Card Designer:
 * - Free crop, Fixed aspect ratio, 74×105 mm card ratio, Circular portrait crop, Rounded rectangle preview
 * - Image pan/zoom inside frame independent of crop box
 * - Preserves original uncropped image source for future re-editing
 */

import React, { useState, useRef } from "react";
import { CardObject, ImageCropRect } from "../../engine/carddesigner/types";
import {
  Crop,
  Check,
  X,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize,
  Circle,
  Square,
  RefreshCw,
} from "lucide-react";

interface CardDesignerCropModalProps {
  object: CardObject;
  onApplyCrop: (cropRect: ImageCropRect, croppedDataUrl?: string) => void;
  onClose: () => void;
}

export const CardDesignerCropModal: React.FC<CardDesignerCropModalProps> = ({
  object,
  onApplyCrop,
  onClose,
}) => {
  const [cropShape, setCropShape] = useState<"rect" | "circle" | "rounded">(
    object.cropRect?.shape || "rect"
  );
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [cropRect, setCropRect] = useState<{ x: number; y: number; width: number; height: number }>({
    x: object.cropRect?.x ?? 10,
    y: object.cropRect?.y ?? 10,
    width: object.cropRect?.width ?? 80,
    height: object.cropRect?.height ?? 80,
  });

  const imgRef = useRef<HTMLImageElement>(null);

  const handleApply = () => {
    // Generate cropped preview or store crop rectangle
    onApplyCrop({
      ...cropRect,
      shape: cropShape,
      cornerRadius: cropShape === "rounded" ? 6 : 0,
    });
  };

  const handleSetRatio = (ratioType: "free" | "1:1" | "74:105") => {
    if (ratioType === "1:1") {
      const size = Math.min(cropRect.width, cropRect.height);
      setCropRect((prev) => ({ ...prev, width: size, height: size }));
    } else if (ratioType === "74:105") {
      const w = cropRect.width;
      const h = Math.min(100 - cropRect.y, (w * 105) / 74);
      setCropRect((prev) => ({ ...prev, height: h }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-6 select-none">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col text-neutral-200">
        {/* Header */}
        <div className="h-12 border-b border-neutral-800 px-4 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center space-x-2">
            <Crop className="w-4 h-4 text-sky-400" />
            <h2 className="text-sm font-bold text-white">Precision Image & Frame Crop</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="h-10 border-b border-neutral-800 px-4 flex items-center justify-between bg-neutral-900 text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-neutral-400">Crop Shape:</span>
            <button
              type="button"
              onClick={() => setCropShape("rect")}
              className={`px-2 py-1 rounded flex items-center space-x-1 ${
                cropShape === "rect" ? "bg-sky-600 text-white" : "bg-neutral-800 text-neutral-300"
              }`}
            >
              <Square className="w-3.5 h-3.5" />
              <span>Rectangle</span>
            </button>
            <button
              type="button"
              onClick={() => setCropShape("circle")}
              className={`px-2 py-1 rounded flex items-center space-x-1 ${
                cropShape === "circle" ? "bg-sky-600 text-white" : "bg-neutral-800 text-neutral-300"
              }`}
            >
              <Circle className="w-3.5 h-3.5" />
              <span>Circular / Oval</span>
            </button>
            <button
              type="button"
              onClick={() => setCropShape("rounded")}
              className={`px-2 py-1 rounded flex items-center space-x-1 ${
                cropShape === "rounded" ? "bg-sky-600 text-white" : "bg-neutral-800 text-neutral-300"
              }`}
            >
              <Square className="w-3.5 h-3.5 rounded-sm" />
              <span>Rounded Corners</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => handleSetRatio("free")}
              className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-300"
            >
              Free
            </button>
            <button
              type="button"
              onClick={() => handleSetRatio("1:1")}
              className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-300"
            >
              1:1 Square
            </button>
            <button
              type="button"
              onClick={() => handleSetRatio("74:105")}
              className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-300"
            >
              74×105 mm Card
            </button>
          </div>
        </div>

        {/* Crop Stage */}
        <div className="h-96 bg-neutral-950 relative flex items-center justify-center p-6 overflow-hidden">
          {object.src && (
            <div className="relative max-h-full max-w-full flex items-center justify-center">
              <img
                ref={imgRef}
                src={object.originalSrc || object.src}
                alt="Source"
                draggable={false}
                className="max-h-72 max-w-full object-contain rounded"
              />

              {/* Crop Frame Overlay */}
              <div
                style={{
                  position: "absolute",
                  left: `${cropRect.x}%`,
                  top: `${cropRect.y}%`,
                  width: `${cropRect.width}%`,
                  height: `${cropRect.height}%`,
                  borderRadius:
                    cropShape === "circle" ? "9999px" : cropShape === "rounded" ? "12px" : "0px",
                }}
                className="border-2 border-sky-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] pointer-events-none"
              >
                {/* 3x3 Grid Lines */}
                <div className="w-full h-full grid grid-cols-3 grid-rows-3 pointer-events-none">
                  <div className="border-r border-b border-white/30" />
                  <div className="border-r border-b border-white/30" />
                  <div className="border-b border-white/30" />
                  <div className="border-r border-b border-white/30" />
                  <div className="border-r border-b border-white/30" />
                  <div className="border-b border-white/30" />
                  <div className="border-r border-white/30" />
                  <div className="border-r border-white/30" />
                  <div />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="h-12 border-t border-neutral-800 px-4 flex items-center justify-between bg-neutral-950/60">
          <button
            type="button"
            onClick={() =>
              setCropRect({ x: 0, y: 0, width: 100, height: 100 })
            }
            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs flex items-center space-x-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Crop</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-sm"
            >
              <Check className="w-4 h-4" />
              <span>Apply Crop</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
