/**
 * OMNISCAN TITAN X - Background Image Controls
 * Import (JPG, PNG, WEBP, BMP, TIFF, SVG), Numeric Transforms,
 * Fit Modes (Contain, Cover, Fill, Center), Opacity, and Crop Launch
 */

import React, { useRef } from "react";
import { BackgroundTransform, ImageFitMode } from "../../engine/background/types";
import { isAllowedBackgroundImage } from "../../engine/background/backgroundTransforms";
import {
  UploadCloud,
  Crop,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  Maximize2,
  Minimize2,
  Trash2,
  Sliders,
  Image as ImageIcon,
} from "lucide-react";

interface BackgroundImageControlsProps {
  backgroundImage: string | null;
  imageName?: string;
  transform: BackgroundTransform;
  onImageLoaded: (dataUrl: string, name: string) => void;
  onTransformChange: (updated: BackgroundTransform) => void;
  onResetTransform: () => void;
  onRemoveImage: () => void;
  onOpenCrop: () => void;
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isAllowedBackgroundImage(file)) {
      alert("Unsupported image format. Please select JPG, PNG, WEBP, BMP, TIFF, or SVG.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        onImageLoaded(dataUrl, file.name);
      }
    };
    reader.readAsDataURL(file);
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

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5 space-y-3.5 text-xs text-neutral-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <ImageIcon className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-white uppercase tracking-wider text-[11px]">
            Custom Background Image Layer
          </span>
        </div>
        {backgroundImage && (
          <div className="flex items-center space-x-1">
            <button
              onClick={onResetTransform}
              className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800"
              title="Reset transforms"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onRemoveImage}
              className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-950/40"
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
          className="border-2 border-dashed border-neutral-700 hover:border-emerald-500 rounded-lg p-5 flex flex-col items-center justify-center cursor-pointer transition-colors bg-neutral-950 text-center group"
        >
          <UploadCloud className="w-8 h-8 text-neutral-500 group-hover:text-emerald-400 transition-colors mb-2" />
          <span className="font-semibold text-neutral-200 group-hover:text-white">
            Add Background Image
          </span>
          <span className="text-[10px] text-neutral-400 mt-0.5">
            JPG, PNG, WEBP, BMP, TIFF, or SVG
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
        <div className="space-y-3">
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
                  Active Layer 2 (Backdrop)
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-1.5">
              <button
                onClick={onOpenCrop}
                className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-white font-medium flex items-center space-x-1"
                title="Crop background image"
              >
                <Crop className="w-3 h-3 text-emerald-400" />
                <span>Crop</span>
              </button>
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

          {/* Fit Mode Selector */}
          <div>
            <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1.5">
              Fit Mode
            </span>
            <div className="grid grid-cols-5 gap-1">
              {(["cover", "contain", "fill", "center", "original"] as ImageFitMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleFitMode(mode)}
                  className={`py-1 rounded text-[10px] font-bold capitalize transition-colors border ${
                    transform.fitMode === mode
                      ? "bg-emerald-600 border-emerald-500 text-white shadow"
                      : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Scale & Zoom Slider + Direct Numeric Input */}
          <div className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-neutral-400 uppercase">
                Zoom / Scale
              </span>
              <div className="flex items-center space-x-1">
                <input
                  type="number"
                  min="10"
                  max="500"
                  step="1"
                  value={Math.round((transform.scale || 1) * 100)}
                  onChange={(e) =>
                    onTransformChange({ ...transform, scale: Math.max(0.1, Number(e.target.value) / 100) })
                  }
                  className="w-14 bg-neutral-900 border border-neutral-750 rounded px-1.5 py-0.5 text-right font-mono text-emerald-400 text-[11px] outline-none"
                />
                <span className="text-[10px] text-neutral-500 font-mono">%</span>
              </div>
            </div>
            <input
              type="range"
              min="0.2"
              max="3"
              step="0.02"
              value={transform.scale || 1}
              onChange={(e) =>
                onTransformChange({ ...transform, scale: Number(e.target.value) })
              }
              className="w-full accent-emerald-500 cursor-pointer"
            />

            {/* Position X & Y with Numeric Controls */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-neutral-850">
              <div>
                <div className="flex items-center justify-between text-[10px] text-neutral-400 mb-1">
                  <span>Pan X</span>
                  <div className="flex items-center space-x-0.5">
                    <input
                      type="number"
                      min="-1000"
                      max="1000"
                      step="1"
                      value={Math.round(transform.x)}
                      onChange={(e) =>
                        onTransformChange({ ...transform, x: Number(e.target.value) })
                      }
                      className="w-12 bg-neutral-900 border border-neutral-750 rounded px-1 py-0.2 text-right font-mono text-neutral-300 text-[10px] outline-none"
                    />
                    <span className="text-[9px] text-neutral-500">px</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="-300"
                  max="300"
                  value={transform.x}
                  onChange={(e) =>
                    onTransformChange({ ...transform, x: Number(e.target.value) })
                  }
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>
              <div>
                <div className="flex items-center justify-between text-[10px] text-neutral-400 mb-1">
                  <span>Pan Y</span>
                  <div className="flex items-center space-x-0.5">
                    <input
                      type="number"
                      min="-1000"
                      max="1000"
                      step="1"
                      value={Math.round(transform.y)}
                      onChange={(e) =>
                        onTransformChange({ ...transform, y: Number(e.target.value) })
                      }
                      className="w-12 bg-neutral-900 border border-neutral-750 rounded px-1 py-0.2 text-right font-mono text-neutral-300 text-[10px] outline-none"
                    />
                    <span className="text-[9px] text-neutral-500">px</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="-300"
                  max="300"
                  value={transform.y}
                  onChange={(e) =>
                    onTransformChange({ ...transform, y: Number(e.target.value) })
                  }
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Quick Alignment / Center Buttons */}
            <div className="flex items-center space-x-1.5 pt-0.5">
              <button
                onClick={() => onTransformChange({ ...transform, x: 0, y: 0 })}
                className="flex-1 py-0.5 rounded bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-neutral-400 hover:text-white text-[10px] transition-colors"
                title="Center Background Image"
              >
                Center (0, 0)
              </button>
              <button
                onClick={() => onTransformChange({ ...transform, rotation: 0 })}
                className="flex-1 py-0.5 rounded bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-neutral-400 hover:text-white text-[10px] transition-colors"
                title="Zero Rotation"
              >
                0° Angle
              </button>
            </div>

            {/* Rotation with Numeric Input */}
            <div className="pt-1 border-t border-neutral-850">
              <div className="flex items-center justify-between text-[10px] text-neutral-400 mb-1">
                <span>Rotation</span>
                <div className="flex items-center space-x-0.5">
                  <input
                    type="number"
                    min="-360"
                    max="360"
                    step="1"
                    value={Math.round(transform.rotation)}
                    onChange={(e) =>
                      onTransformChange({ ...transform, rotation: Number(e.target.value) })
                    }
                    className="w-12 bg-neutral-900 border border-neutral-750 rounded px-1 py-0.2 text-right font-mono text-emerald-400 text-[10px] outline-none"
                  />
                  <span className="text-[9px] text-neutral-500">°</span>
                </div>
              </div>
              <input
                type="range"
                min="-180"
                max="180"
                value={transform.rotation}
                onChange={(e) =>
                  onTransformChange({ ...transform, rotation: Number(e.target.value) })
                }
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            {/* Opacity with Numeric Input */}
            <div className="pt-1 border-t border-neutral-850">
              <div className="flex items-center justify-between text-[10px] text-neutral-400 mb-1">
                <span>Layer Opacity</span>
                <div className="flex items-center space-x-0.5">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={Math.round((transform.opacity ?? 1) * 100)}
                    onChange={(e) =>
                      onTransformChange({
                        ...transform,
                        opacity: Math.max(0, Math.min(100, Number(e.target.value))) / 100,
                      })
                    }
                    className="w-12 bg-neutral-900 border border-neutral-750 rounded px-1 py-0.2 text-right font-mono text-emerald-400 text-[10px] outline-none"
                  />
                  <span className="text-[9px] text-neutral-500">%</span>
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
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            {/* Flips (Mirror H & Mirror V) */}
            <div className="flex items-center space-x-2 pt-1 border-t border-neutral-850">
              <button
                onClick={toggleFlipH}
                className={`flex-1 py-1 px-2 rounded border flex items-center justify-center space-x-1.5 transition-colors ${
                  transform.scaleX === -1
                    ? "bg-emerald-950/60 border-emerald-500 text-emerald-300 font-bold"
                    : "bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-white"
                }`}
              >
                <FlipHorizontal className="w-3.5 h-3.5" />
                <span>Mirror Horiz</span>
              </button>

              <button
                onClick={toggleFlipV}
                className={`flex-1 py-1 px-2 rounded border flex items-center justify-center space-x-1.5 transition-colors ${
                  transform.scaleY === -1
                    ? "bg-emerald-950/60 border-emerald-500 text-emerald-300 font-bold"
                    : "bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-white"
                }`}
              >
                <FlipVertical className="w-3.5 h-3.5" />
                <span>Mirror Vert</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
