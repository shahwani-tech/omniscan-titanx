/**
 * OMNISCAN TITAN X - Passport & ID Photo Biometric Crop Tool
 * Visual Face Alignment Oval, Crown/Chin Markers, Aspect Lock & Precision Framing
 */

import React, { useState, useRef } from "react";
import { PassportStandardSpec } from "../../types";
import { X, Check, ZoomIn, ZoomOut, RotateCw, User } from "lucide-react";
import { OmniAdjustmentSlider } from "../common/OmniAdjustmentSlider";

interface PassportCropModalProps {
  isOpen: boolean;
  sourceImageUrl: string;
  passportSpec: PassportStandardSpec;
  onClose: () => void;
  onApplyCrop: (croppedDataUrl: string) => void;
}

export const PassportCropModal: React.FC<PassportCropModalProps> = ({
  isOpen,
  sourceImageUrl,
  passportSpec,
  onClose,
  onApplyCrop,
}) => {
  const [zoom, setZoom] = useState(1.0);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);

  const imgRef = useRef<HTMLImageElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  const targetAspect = passportSpec.widthInches / passportSpec.heightInches;

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartPos({ x: e.clientX - panX, y: e.clientY - panY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanX(e.clientX - startPos.x);
    setPanY(e.clientY - startPos.y);
  };

  const handleApply = async () => {
    // Exact target dimensions at high DPI (300 DPI)
    const targetW = Math.round(passportSpec.widthInches * 300);
    const targetH = Math.round(passportSpec.heightInches * 300);

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = sourceImageUrl;
    await new Promise((res) => {
      img.onload = res;
    });

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, targetW, targetH);

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const frameRect = frameRef.current?.getBoundingClientRect();
    const frameW = frameRect?.width || 288 * targetAspect;
    const frameH = frameRect?.height || 288;

    const dispImgW = imgRef.current?.offsetWidth || (img.naturalWidth / img.naturalHeight) * 320;
    const dispImgH = imgRef.current?.offsetHeight || 320;

    const scaleFactorX = targetW / frameW;
    const scaleFactorY = targetH / frameH;

    ctx.translate(targetW / 2 + panX * scaleFactorX, targetH / 2 + panY * scaleFactorY);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom * scaleFactorX, zoom * scaleFactorY);
    ctx.drawImage(img, -dispImgW / 2, -dispImgH / 2, dispImgW, dispImgH);
    ctx.restore();

    const cropped = canvas.toDataURL("image/jpeg", 0.95);
    onApplyCrop(cropped);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-2xl bg-neutral-900 rounded-2xl border border-neutral-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <User className="w-5 h-5 text-sky-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Biometric Face Alignment Guide</h3>
              <p className="text-xs text-neutral-400">
                {passportSpec.name} ({passportSpec.widthMm} × {passportSpec.heightMm} mm)
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport Stage */}
        <div
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={() => setIsDragging(false)}
          onMouseLeave={() => setIsDragging(false)}
          onWheel={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const delta = e.deltaY < 0 ? 0.05 : -0.05;
            setZoom((prev) => Math.min(3.0, Math.max(0.5, Number((prev + delta).toFixed(2)))));
          }}
          className="relative h-96 bg-neutral-950 overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing"
        >
          {/* Transforming Image */}
          <div
            style={{
              transform: `translate(${panX}px, ${panY}px) scale(${zoom}) rotate(${rotation}deg)`,
              transition: isDragging ? "none" : "transform 0.05s ease-out",
            }}
            className="pointer-events-none"
          >
            <img ref={imgRef} src={sourceImageUrl} alt="Crop Source" className="max-h-80 w-auto object-contain" />
          </div>

          {/* Biometric Framing & Face Overlay */}
          <div
            ref={frameRef}
            style={{
              aspectRatio: `${passportSpec.widthInches} / ${passportSpec.heightInches}`,
            }}
            className="absolute h-72 border-2 border-sky-400 rounded-lg pointer-events-none shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] flex flex-col items-center justify-center"
          >
            {/* Oval Head Area Guide */}
            <div className="w-36 h-48 border border-dashed border-amber-400/80 rounded-[50%] flex flex-col items-center justify-between py-2">
              <span className="text-[9px] font-mono text-amber-300 font-bold bg-black/60 px-1 rounded">
                Crown Line (70-80%)
              </span>
              <div className="w-full h-px bg-sky-400/40" />
              <span className="text-[9px] font-mono text-amber-300 font-bold bg-black/60 px-1 rounded">
                Chin Line
              </span>
            </div>

            <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-sky-950 text-[10px] font-mono text-sky-400 font-bold border border-sky-800">
              {passportSpec.widthMm}×{passportSpec.heightMm}mm
            </div>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="p-4 bg-neutral-850 border-t border-neutral-800 flex items-center justify-between text-xs gap-4">
          <div className="flex-1 max-w-xs">
            <OmniAdjustmentSlider
              id="passport-crop-zoom"
              label="Crop Zoom"
              icon={<ZoomIn className="w-3.5 h-3.5 text-sky-400" />}
              value={zoom}
              min={0.5}
              max={3.0}
              step={0.05}
              precision={2}
              defaultValue={1.0}
              unit="×"
              bipolar={false}
              onChange={(val) => setZoom(val)}
            />
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors font-medium cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5 text-sky-400" />
              <span>Rotate 90°</span>
            </button>

            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold shadow-lg transition-colors cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Apply Biometric Crop</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
