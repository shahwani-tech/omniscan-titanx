/**
 * OMNISCAN TITAN X - Background Image Controls
 * Import (JPG, PNG, WEBP, BMP, TIFF, SVG), Max 4096px auto-scale,
 * Fit Modes (Fill, Fit, Stretch, Tile, Center),
 * Non-destructive Adjustments (Brightness, Contrast, Blur, Opacity, Saturation, Temp),
 * and Transform Controls (Scale, Pan, Rotate, Flips)
 */

import React, { useRef } from "react";
import { toast } from "../../services/toast/toastService";
import { BackgroundTransform, ImageFitMode } from "../../engine/background/types";
import { isAllowedBackgroundImage } from "../../engine/background/backgroundTransforms";
import {
  UploadCloud,
  Crop,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  Trash2,
  Sliders,
  Image as ImageIcon,
  Sun,
  Contrast,
  Sparkles,
  Droplets,
  Thermometer,
  Eye,
} from "lucide-react";

interface BackgroundImageControlsProps {
  backgroundImage: string | null;
  imageName?: string;
  transform: BackgroundTransform;
  onImageLoaded: (dataUrl: string, name: string) => void;
  onTransformChange: (updated: BackgroundTransform) => void;
  onResetTransform: () => void;
  onRemoveImage: () => void;
  onOpenCrop?: () => void;
}

// Downscale images over 4096px before loading into memory
async function downscaleImageIfLarge(dataUrl: string, maxDimension = 4096): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (img.naturalWidth <= maxDimension && img.naturalHeight <= maxDimension) {
        resolve(dataUrl);
        return;
      }
      const scale = Math.min(maxDimension / img.naturalWidth, maxDimension / img.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.95));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export const BackgroundImageControls: React.FC<BackgroundImageControlsProps> = ({
  backgroundImage,
  imageName,
  transform,
  onImageLoaded,
  onTransformChange,
  onResetTransform,
  onRemoveImage,
  onOpenCrop,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processAndLoadFile = async (file: File) => {
    if (!isAllowedBackgroundImage(file)) {
      toast.warning("Unsupported format. Please select JPG, PNG, WEBP, BMP, TIFF, or SVG.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const rawDataUrl = event.target?.result as string;
      if (rawDataUrl) {
        const optimizedUrl = await downscaleImageIfLarge(rawDataUrl, 4096);
        onImageLoaded(optimizedUrl, file.name);
        toast.success("Background loaded. Drag on canvas to reposition, scroll to zoom.");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processAndLoadFile(file);
    e.target.value = "";
  };

  const handleFitMode = (mode: ImageFitMode) => {
    onTransformChange({
      ...transform,
      fitMode: mode,
      x: 0,
      y: 0,
      scale: 1,
    });
  };

  const toggleFlipH = () => {
    onTransformChange({
      ...transform,
      scaleX: (transform.scaleX || 1) * -1,
    });
  };

  const toggleFlipV = () => {
    onTransformChange({
      ...transform,
      scaleY: (transform.scaleY || 1) * -1,
    });
  };

  const handleResetAllAdjustments = () => {
    onTransformChange({
      ...transform,
      brightness: 0,
      contrast: 0,
      blur: 0,
      opacity: 1,
      saturation: 0,
      temperature: 0,
    });
    toast.info("Reset all background adjustments.");
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5 space-y-4 text-xs text-neutral-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <ImageIcon className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-white uppercase tracking-wider text-[11px]">
            Background Image Layer
          </span>
        </div>
        {backgroundImage && (
          <div className="flex items-center space-x-1">
            <button
              onClick={onResetTransform}
              className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              title="Reset position and zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onRemoveImage}
              className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors"
              title="Remove background image"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Upload Zone / Active Image Info */}
      {!backgroundImage ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const file = e.dataTransfer.files?.[0];
            if (file) processAndLoadFile(file);
          }}
          className="border-2 border-dashed border-neutral-700 hover:border-emerald-500 rounded-lg p-5 flex flex-col items-center justify-center cursor-pointer transition-colors bg-neutral-950 text-center group"
        >
          <UploadCloud className="w-8 h-8 text-neutral-500 group-hover:text-emerald-400 transition-colors mb-2" />
          <span className="font-semibold text-neutral-200 group-hover:text-white">
            Upload Background Image
          </span>
          <span className="text-[10px] text-neutral-400 mt-0.5">
            JPG, PNG, WEBP, BMP, TIFF, SVG (Auto-scaled to 4096px)
          </span>
          <span className="text-[9px] text-emerald-400/80 mt-1">
            Slides underneath the fixed subject photo
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      ) : (
        <div className="space-y-3.5">
          {/* Active Image Thumbnail & Actions */}
          <div className="flex items-center justify-between bg-neutral-950 p-2 rounded-lg border border-neutral-800">
            <div className="flex items-center space-x-2.5 overflow-hidden">
              <img
                src={backgroundImage}
                alt="Background thumbnail"
                className="w-10 h-10 object-cover rounded border border-neutral-700 flex-shrink-0"
              />
              <div className="overflow-hidden">
                <div className="text-[11px] font-semibold text-white truncate">
                  {imageName || "Custom Backdrop"}
                </div>
                <div className="text-[10px] text-emerald-400 font-mono">
                  Layer 1 (Bottom • Draggable)
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-1.5">
              {onOpenCrop && (
                <button
                  onClick={onOpenCrop}
                  className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-white font-medium flex items-center space-x-1"
                  title="Crop background image"
                >
                  <Crop className="w-3 h-3 text-emerald-400" />
                  <span>Crop</span>
                </button>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white"
                title="Replace background image"
              >
                Replace
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>

          {/* Fit Options (5 Buttons: Fill, Fit, Stretch, Tile, Center) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                Fit Option
              </span>
              <span className="text-[9px] text-neutral-500 font-mono">Quick Placement</span>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {[
                { id: "cover" as ImageFitMode, label: "Fill", desc: "Cover entire canvas" },
                { id: "contain" as ImageFitMode, label: "Fit", desc: "Show entire image" },
                { id: "stretch" as ImageFitMode, label: "Stretch", desc: "Force exact bounds" },
                { id: "tile" as ImageFitMode, label: "Tile", desc: "Repeat pattern" },
                { id: "center" as ImageFitMode, label: "Center", desc: "Center at 100%" },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleFitMode(item.id)}
                  title={item.desc}
                  className={`py-1.5 rounded text-[10px] font-bold capitalize transition-all border ${
                    (transform.fitMode === item.id || (item.id === "cover" && transform.fitMode === "fill"))
                      ? "bg-emerald-600 border-emerald-500 text-white shadow"
                      : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-850"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Section: Non-Destructive Background Adjustments */}
          <div className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800 space-y-2.5">
            <div className="flex items-center justify-between pb-1 border-b border-neutral-850">
              <div className="flex items-center space-x-1.5">
                <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] font-semibold text-white uppercase tracking-wider">
                  Background Adjustments
                </span>
              </div>
              <button
                type="button"
                onClick={handleResetAllAdjustments}
                className="text-[9px] text-neutral-400 hover:text-rose-400 transition-colors"
                title="Reset all adjustment sliders"
              >
                Reset All
              </button>
            </div>

            {/* Brightness (-100 to +100) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <div className="flex items-center space-x-1 text-neutral-400">
                  <Sun className="w-3 h-3 text-amber-400" />
                  <span>Brightness</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="font-mono text-emerald-400 text-[10px]">
                    {transform.brightness || 0}
                  </span>
                  {Boolean(transform.brightness) && (
                    <button
                      onClick={() => onTransformChange({ ...transform, brightness: 0 })}
                      className="text-[9px] text-neutral-500 hover:text-white ml-1"
                      title="Reset brightness"
                    >
                      ↺
                    </button>
                  )}
                </div>
              </div>
              <input
                type="range"
                min="-100"
                max="100"
                step="1"
                value={transform.brightness || 0}
                onChange={(e) =>
                  onTransformChange({ ...transform, brightness: Number(e.target.value) })
                }
                className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
              />
            </div>

            {/* Contrast (-100 to +100) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <div className="flex items-center space-x-1 text-neutral-400">
                  <Contrast className="w-3 h-3 text-indigo-400" />
                  <span>Contrast</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="font-mono text-emerald-400 text-[10px]">
                    {transform.contrast || 0}
                  </span>
                  {Boolean(transform.contrast) && (
                    <button
                      onClick={() => onTransformChange({ ...transform, contrast: 0 })}
                      className="text-[9px] text-neutral-500 hover:text-white ml-1"
                      title="Reset contrast"
                    >
                      ↺
                    </button>
                  )}
                </div>
              </div>
              <input
                type="range"
                min="-100"
                max="100"
                step="1"
                value={transform.contrast || 0}
                onChange={(e) =>
                  onTransformChange({ ...transform, contrast: Number(e.target.value) })
                }
                className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
              />
            </div>

            {/* Bokeh Blur (0 to 20px) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <div className="flex items-center space-x-1 text-neutral-400">
                  <Sparkles className="w-3 h-3 text-cyan-400" />
                  <span>Blur (Bokeh Depth)</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="font-mono text-emerald-400 text-[10px]">
                    {Math.round(transform.blur || 0)}px
                  </span>
                  {Boolean(transform.blur) && (
                    <button
                      onClick={() => onTransformChange({ ...transform, blur: 0 })}
                      className="text-[9px] text-neutral-500 hover:text-white ml-1"
                      title="Reset blur"
                    >
                      ↺
                    </button>
                  )}
                </div>
              </div>
              <input
                type="range"
                min="0"
                max="20"
                step="1"
                value={transform.blur || 0}
                onChange={(e) =>
                  onTransformChange({ ...transform, blur: Number(e.target.value) })
                }
                className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
              />
            </div>

            {/* Opacity (0% to 100%) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <div className="flex items-center space-x-1 text-neutral-400">
                  <Eye className="w-3 h-3 text-neutral-400" />
                  <span>Opacity</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="font-mono text-emerald-400 text-[10px]">
                    {Math.round((transform.opacity ?? 1) * 100)}%
                  </span>
                  {(transform.opacity ?? 1) < 1 && (
                    <button
                      onClick={() => onTransformChange({ ...transform, opacity: 1 })}
                      className="text-[9px] text-neutral-500 hover:text-white ml-1"
                      title="Reset opacity"
                    >
                      ↺
                    </button>
                  )}
                </div>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={transform.opacity ?? 1}
                onChange={(e) =>
                  onTransformChange({ ...transform, opacity: Number(e.target.value) })
                }
                className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
              />
            </div>

            {/* Saturation (-100 to +100) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <div className="flex items-center space-x-1 text-neutral-400">
                  <Droplets className="w-3 h-3 text-rose-400" />
                  <span>Saturation</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="font-mono text-emerald-400 text-[10px]">
                    {transform.saturation || 0}
                  </span>
                  {Boolean(transform.saturation) && (
                    <button
                      onClick={() => onTransformChange({ ...transform, saturation: 0 })}
                      className="text-[9px] text-neutral-500 hover:text-white ml-1"
                      title="Reset saturation"
                    >
                      ↺
                    </button>
                  )}
                </div>
              </div>
              <input
                type="range"
                min="-100"
                max="100"
                step="1"
                value={transform.saturation || 0}
                onChange={(e) =>
                  onTransformChange({ ...transform, saturation: Number(e.target.value) })
                }
                className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
              />
            </div>

            {/* Temperature (-100 Cool to +100 Warm) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <div className="flex items-center space-x-1 text-neutral-400">
                  <Thermometer className="w-3 h-3 text-amber-500" />
                  <span>Temperature</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className={`font-mono text-[10px] ${
                    (transform.temperature || 0) > 0
                      ? "text-amber-400"
                      : (transform.temperature || 0) < 0
                      ? "text-cyan-400"
                      : "text-neutral-400"
                  }`}>
                    {(transform.temperature || 0) > 0 ? `+${transform.temperature} (Warm)` : (transform.temperature || 0) < 0 ? `${transform.temperature} (Cool)` : "0 (Neutral)"}
                  </span>
                  {Boolean(transform.temperature) && (
                    <button
                      onClick={() => onTransformChange({ ...transform, temperature: 0 })}
                      className="text-[9px] text-neutral-500 hover:text-white ml-1"
                      title="Reset temperature"
                    >
                      ↺
                    </button>
                  )}
                </div>
              </div>
              <input
                type="range"
                min="-100"
                max="100"
                step="1"
                value={transform.temperature || 0}
                onChange={(e) =>
                  onTransformChange({ ...transform, temperature: Number(e.target.value) })
                }
                className="w-full accent-amber-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
              />
              <div className="flex justify-between text-[8px] text-neutral-500 font-mono">
                <span className="text-cyan-400/80">Cool (-100)</span>
                <span>Neutral (0)</span>
                <span className="text-amber-400/80">Warm (+100)</span>
              </div>
            </div>
          </div>

          {/* Scale & Zoom Slider + Direct Input */}
          <div className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-neutral-400 uppercase">
                Zoom / Scale (50% - 500%)
              </span>
              <div className="flex items-center space-x-1">
                <input
                  type="number"
                  min="50"
                  max="500"
                  step="1"
                  value={Math.round((transform.scale || 1) * 100)}
                  onChange={(e) =>
                    onTransformChange({
                      ...transform,
                      scale: Math.max(0.5, Math.min(5, Number(e.target.value) / 100)),
                    })
                  }
                  className="w-14 bg-neutral-900 border border-neutral-750 rounded px-1.5 py-0.5 text-right font-mono text-emerald-400 text-[11px] outline-none"
                />
                <span className="text-[10px] text-neutral-500 font-mono">%</span>
              </div>
            </div>
            <input
              type="range"
              min="0.5"
              max="5"
              step="0.02"
              value={transform.scale || 1}
              onChange={(e) =>
                onTransformChange({ ...transform, scale: Number(e.target.value) })
              }
              className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
            />

            {/* Position Pan X & Y */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-neutral-850">
              <div>
                <div className="flex items-center justify-between text-[10px] text-neutral-400 mb-1">
                  <span>Pan X</span>
                  <span className="text-[9px] text-neutral-300 font-mono">{Math.round(transform.x)}px</span>
                </div>
                <input
                  type="range"
                  min="-400"
                  max="400"
                  value={transform.x}
                  onChange={(e) =>
                    onTransformChange({ ...transform, x: Number(e.target.value) })
                  }
                  className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
                />
              </div>
              <div>
                <div className="flex items-center justify-between text-[10px] text-neutral-400 mb-1">
                  <span>Pan Y</span>
                  <span className="text-[9px] text-neutral-300 font-mono">{Math.round(transform.y)}px</span>
                </div>
                <input
                  type="range"
                  min="-400"
                  max="400"
                  value={transform.y}
                  onChange={(e) =>
                    onTransformChange({ ...transform, y: Number(e.target.value) })
                  }
                  className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
                />
              </div>
            </div>

            {/* Center & Flips */}
            <div className="flex items-center space-x-1.5 pt-1 border-t border-neutral-850">
              <button
                type="button"
                onClick={() => onTransformChange({ ...transform, x: 0, y: 0, rotation: 0 })}
                className="flex-1 py-1 rounded bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-neutral-300 hover:text-white text-[10px] transition-colors"
                title="Center Background Image"
              >
                Center (0, 0)
              </button>
              <button
                type="button"
                onClick={toggleFlipH}
                className={`py-1 px-2 rounded border flex items-center space-x-1 transition-colors text-[10px] ${
                  transform.scaleX === -1
                    ? "bg-emerald-950/60 border-emerald-500 text-emerald-300 font-bold"
                    : "bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-white"
                }`}
                title="Mirror Horizontally"
              >
                <FlipHorizontal className="w-3 h-3" />
                <span>Flip H</span>
              </button>
              <button
                type="button"
                onClick={toggleFlipV}
                className={`py-1 px-2 rounded border flex items-center space-x-1 transition-colors text-[10px] ${
                  transform.scaleY === -1
                    ? "bg-emerald-950/60 border-emerald-500 text-emerald-300 font-bold"
                    : "bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-white"
                }`}
                title="Mirror Vertically"
              >
                <FlipVertical className="w-3 h-3" />
                <span>Flip V</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
