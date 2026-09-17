/**
 * OMNISCAN TITAN X - Background Gradient Generator & Controller
 * Non-destructive linear/radial gradients with angular controls, stops, and studio presets.
 */

import React from "react";
import { BackgroundGradient } from "../../engine/background/types";
import { ArrowLeftRight, Compass, Sparkles } from "lucide-react";

interface BackgroundGradientPickerProps {
  gradient: BackgroundGradient;
  onChange: (gradient: BackgroundGradient) => void;
  onReset?: () => void;
}

export const PRESET_GRADIENTS: { name: string; gradient: BackgroundGradient }[] = [
  {
    name: "Studio Slate",
    gradient: { color1: "#0F172A", color2: "#334155", type: "linear", angle: 180 },
  },
  {
    name: "Studio Blue",
    gradient: { color1: "#0369A1", color2: "#38BDF8", type: "linear", angle: 180 },
  },
  {
    name: "Soft Studio Gray",
    gradient: { color1: "#F1F5F9", color2: "#CBD5E1", type: "linear", angle: 180 },
  },
  {
    name: "Deep Navy",
    gradient: { color1: "#091E3A", color2: "#1E40AF", type: "radial", angle: 90 },
  },
  {
    name: "Sunset Coral",
    gradient: { color1: "#C2410C", color2: "#E11D48", type: "linear", angle: 135 },
  },
  {
    name: "Royal Violet",
    gradient: { color1: "#3730A3", color2: "#7C3AED", type: "linear", angle: 135 },
  },
  {
    name: "Emerald Mint",
    gradient: { color1: "#064E3B", color2: "#10B981", type: "linear", angle: 180 },
  },
  {
    name: "Warm Golden",
    gradient: { color1: "#78350F", color2: "#F59E0B", type: "linear", angle: 135 },
  },
  {
    name: "Midnight Charcoal",
    gradient: { color1: "#09090B", color2: "#27272A", type: "radial", angle: 90 },
  },
];

export const BackgroundGradientPicker: React.FC<BackgroundGradientPickerProps> = ({
  gradient,
  onChange,
}) => {
  const currentGradient: BackgroundGradient = gradient || {
    color1: "#0F172A",
    color2: "#334155",
    type: "linear",
    angle: 180,
  };

  const handleColorChange = (key: "color1" | "color2", value: string) => {
    onChange({
      ...currentGradient,
      [key]: value,
    });
  };

  const handleTypeChange = (type: "linear" | "radial") => {
    onChange({
      ...currentGradient,
      type,
    });
  };

  const handleAngleChange = (angle: number) => {
    onChange({
      ...currentGradient,
      angle: Math.round(((angle % 360) + 360) % 360),
    });
  };

  const swapColors = () => {
    onChange({
      ...currentGradient,
      color1: currentGradient.color2,
      color2: currentGradient.color1,
    });
  };

  const cssGradientPreview =
    currentGradient.type === "linear"
      ? `linear-gradient(${currentGradient.angle}deg, ${currentGradient.color1}, ${currentGradient.color2})`
      : `radial-gradient(circle at center, ${currentGradient.color1}, ${currentGradient.color2})`;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5 space-y-3.5 text-xs text-neutral-300">
      {/* Header & Type Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-white uppercase tracking-wider text-[11px]">
            Gradient Backdrop
          </span>
        </div>

        <div className="flex items-center bg-neutral-950 p-0.5 rounded-lg border border-neutral-800">
          <button
            type="button"
            onClick={() => handleTypeChange("linear")}
            className={`px-2.5 py-1 rounded text-[10px] font-bold transition-colors ${
              currentGradient.type === "linear"
                ? "bg-emerald-600 text-white shadow"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Linear
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange("radial")}
            className={`px-2.5 py-1 rounded text-[10px] font-bold transition-colors ${
              currentGradient.type === "radial"
                ? "bg-emerald-600 text-white shadow"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Radial
          </button>
        </div>
      </div>

      {/* Live Swatch Preview */}
      <div
        className="w-full h-12 rounded-lg border border-neutral-700 shadow-inner flex items-center justify-center relative overflow-hidden"
        style={{ background: cssGradientPreview }}
      >
        <span className="text-[10px] font-mono font-bold text-white/90 bg-black/40 px-2 py-0.5 rounded backdrop-blur-xs">
          {currentGradient.type.toUpperCase()} • {currentGradient.color1} → {currentGradient.color2}
        </span>
      </div>

      {/* Color Stops & Swap */}
      <div className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800 space-y-2">
        <div className="flex items-center justify-between text-[10px] text-neutral-400 uppercase font-semibold">
          <span>Color Stops</span>
          <button
            type="button"
            onClick={swapColors}
            className="flex items-center space-x-1 text-emerald-400 hover:text-emerald-300 font-normal transition-colors"
            title="Swap Colors"
          >
            <ArrowLeftRight className="w-3 h-3" />
            <span>Swap</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* Stop 1 */}
          <div className="flex items-center space-x-2 bg-neutral-900 p-1.5 rounded-lg border border-neutral-800">
            <label className="relative cursor-pointer flex-shrink-0">
              <div
                className="w-7 h-7 rounded border border-neutral-600 shadow-inner"
                style={{ backgroundColor: currentGradient.color1 }}
              />
              <input
                type="color"
                value={currentGradient.color1}
                onChange={(e) => handleColorChange("color1", e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                aria-label="Stop 1 Color"
              />
            </label>
            <div className="flex-1 min-w-0">
              <span className="text-[9px] text-neutral-400 block">Start Color</span>
              <input
                type="text"
                value={currentGradient.color1.toUpperCase()}
                onChange={(e) => handleColorChange("color1", e.target.value)}
                className="w-full bg-transparent font-mono text-[10px] text-white outline-none"
              />
            </div>
          </div>

          {/* Stop 2 */}
          <div className="flex items-center space-x-2 bg-neutral-900 p-1.5 rounded-lg border border-neutral-800">
            <label className="relative cursor-pointer flex-shrink-0">
              <div
                className="w-7 h-7 rounded border border-neutral-600 shadow-inner"
                style={{ backgroundColor: currentGradient.color2 }}
              />
              <input
                type="color"
                value={currentGradient.color2}
                onChange={(e) => handleColorChange("color2", e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                aria-label="Stop 2 Color"
              />
            </label>
            <div className="flex-1 min-w-0">
              <span className="text-[9px] text-neutral-400 block">End Color</span>
              <input
                type="text"
                value={currentGradient.color2.toUpperCase()}
                onChange={(e) => handleColorChange("color2", e.target.value)}
                className="w-full bg-transparent font-mono text-[10px] text-white outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Direction / Angle Controller (for Linear) */}
      {currentGradient.type === "linear" && (
        <div className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800 space-y-2">
          <div className="flex items-center justify-between text-[10px]">
            <div className="flex items-center space-x-1.5 text-neutral-400 font-semibold uppercase">
              <Compass className="w-3.5 h-3.5 text-emerald-400" />
              <span>Angle / Direction</span>
            </div>
            <div className="flex items-center space-x-1">
              <input
                type="number"
                min="0"
                max="360"
                value={currentGradient.angle}
                onChange={(e) => handleAngleChange(Number(e.target.value))}
                className="w-12 bg-neutral-900 border border-neutral-750 rounded px-1.5 py-0.5 text-right font-mono text-emerald-400 text-[11px] outline-none"
              />
              <span className="text-[10px] text-neutral-500 font-mono">°</span>
            </div>
          </div>

          <input
            type="range"
            min="0"
            max="360"
            value={currentGradient.angle}
            onChange={(e) => handleAngleChange(Number(e.target.value))}
            className="w-full accent-emerald-500 cursor-pointer"
          />

          {/* Quick Angle Presets */}
          <div className="grid grid-cols-6 gap-1 pt-1">
            {[0, 45, 90, 135, 180, 270].map((deg) => (
              <button
                key={deg}
                type="button"
                onClick={() => handleAngleChange(deg)}
                className={`py-1 rounded text-[9px] font-mono transition-colors border ${
                  currentGradient.angle === deg
                    ? "bg-emerald-600 border-emerald-500 text-white font-bold"
                    : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white"
                }`}
              >
                {deg}°
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Preset Gradients Grid */}
      <div className="space-y-1.5">
        <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">
          Studio Presets
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          {PRESET_GRADIENTS.map((p) => {
            const isSelected =
              currentGradient.color1.toLowerCase() === p.gradient.color1.toLowerCase() &&
              currentGradient.color2.toLowerCase() === p.gradient.color2.toLowerCase() &&
              currentGradient.type === p.gradient.type;
            const bgStyle =
              p.gradient.type === "linear"
                ? `linear-gradient(${p.gradient.angle}deg, ${p.gradient.color1}, ${p.gradient.color2})`
                : `radial-gradient(circle, ${p.gradient.color1}, ${p.gradient.color2})`;

            return (
              <button
                key={p.name}
                type="button"
                onClick={() => onChange(p.gradient)}
                className={`p-1.5 rounded-lg border text-left transition-all flex flex-col items-center group ${
                  isSelected
                    ? "border-emerald-500 ring-1 ring-emerald-500 bg-neutral-950"
                    : "border-neutral-800 bg-neutral-950 hover:border-neutral-700"
                }`}
              >
                <div
                  className="w-full h-7 rounded border border-neutral-700/60 shadow-xs mb-1 group-hover:scale-[1.02] transition-transform"
                  style={{ background: bgStyle }}
                />
                <span className="text-[9px] text-neutral-300 font-medium truncate w-full text-center">
                  {p.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
