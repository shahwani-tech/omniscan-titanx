/**
 * OMNISCAN TITAN X - Professional Background Color Selector
 * HEX, RGB, HSL Inputs, Swatches, Recent Colors, and Immediate Interactive Feedback
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToHex,
  isValidHex,
  normalizeHex,
  PRESET_BACKGROUND_COLORS,
  getRecentColors,
  addRecentColor,
} from "../../engine/background/colorUtils";
import { RotateCcw, Pipette, Palette, Hash } from "lucide-react";

interface BackgroundColorPickerProps {
  color: string;
  onChange: (hex: string) => void;
  onReset?: () => void;
  defaultColor?: string;
}

export const BackgroundColorPicker: React.FC<BackgroundColorPickerProps> = ({
  color,
  onChange,
  onReset,
  defaultColor = "#FFFFFF",
}) => {
  const [hexInput, setHexInput] = useState<string>(color.toUpperCase());
  const [colorMode, setColorMode] = useState<"hex" | "rgb" | "hsl">("hex");
  const [recentColors, setRecentColors] = useState<string[]>([]);

  useEffect(() => {
    setHexInput(color.toUpperCase());
    setRecentColors(getRecentColors());
  }, [color]);

  const rgb = useMemo(() => hexToRgb(color), [color]);
  const hsl = useMemo(() => rgbToHsl(rgb.r, rgb.g, rgb.b), [rgb]);

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setHexInput(val);
    if (isValidHex(val)) {
      const normalized = normalizeHex(val);
      onChange(normalized);
      setRecentColors(addRecentColor(normalized));
    }
  };

  const handleRgbChange = (channel: "r" | "g" | "b", val: number) => {
    const clamped = Math.max(0, Math.min(255, val));
    const nextRgb = { ...rgb, [channel]: clamped };
    const nextHex = rgbToHex(nextRgb.r, nextRgb.g, nextRgb.b);
    setHexInput(nextHex);
    onChange(nextHex);
    setRecentColors(addRecentColor(nextHex));
  };

  const handleHslChange = (channel: "h" | "s" | "l", val: number) => {
    const maxVal = channel === "h" ? 360 : 100;
    const clamped = Math.max(0, Math.min(maxVal, val));
    const nextHsl = { ...hsl, [channel]: clamped };
    const nextHex = hslToHex(nextHsl.h, nextHsl.s, nextHsl.l);
    setHexInput(nextHex);
    onChange(nextHex);
    setRecentColors(addRecentColor(nextHex));
  };

  const selectColor = (hex: string) => {
    const normalized = normalizeHex(hex);
    setHexInput(normalized);
    onChange(normalized);
    setRecentColors(addRecentColor(normalized));
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5 space-y-3.5 text-xs text-neutral-300">
      {/* Header & Quick Color Trigger */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Palette className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-white uppercase tracking-wider text-[11px]">
            Background Color
          </span>
        </div>
        <div className="flex items-center space-x-1.5">
          {onReset && (
            <button
              onClick={onReset}
              className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              title="Reset color to default"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Preview Swatch + Native Color Picker + Direct HEX */}
      <div className="flex items-center space-x-3 bg-neutral-950 p-2 rounded-lg border border-neutral-800">
        <label className="relative cursor-pointer group flex-shrink-0">
          <div
            className="w-10 h-10 rounded-lg border border-neutral-600 shadow-inner flex items-center justify-center overflow-hidden transition-transform group-hover:scale-105"
            style={{ backgroundColor: color }}
          >
            <Pipette className="w-4 h-4 text-black/50 drop-shadow opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <input
            type="color"
            value={isValidHex(color) ? normalizeHex(color) : "#FFFFFF"}
            onChange={(e) => selectColor(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            aria-label="Color Picker"
          />
        </label>

        <div className="flex-1 space-y-1">
          <div className="flex items-center space-x-1.5">
            <span className="text-[10px] text-neutral-400 font-semibold uppercase">HEX:</span>
            <div className="flex items-center bg-neutral-900 border border-neutral-750 rounded px-2 py-0.5 flex-1">
              <Hash className="w-3 h-3 text-neutral-500 mr-0.5" />
              <input
                type="text"
                value={hexInput.replace(/^#/, "")}
                onChange={(e) => handleHexChange({ ...e, target: { ...e.target, value: "#" + e.target.value } })}
                placeholder="FFFFFF"
                maxLength={6}
                className="w-full bg-transparent font-mono text-xs text-emerald-400 outline-none uppercase"
              />
            </div>
          </div>
          <div className="text-[10px] text-neutral-400">
            RGB: {rgb.r}, {rgb.g}, {rgb.b}
          </div>
        </div>
      </div>

      {/* Preset Swatches Grid */}
      <div>
        <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1.5">
          Standard Studio Palettes
        </span>
        <div className="grid grid-cols-5 gap-1.5">
          {PRESET_BACKGROUND_COLORS.map((preset) => (
            <button
              key={preset.hex}
              onClick={() => selectColor(preset.hex)}
              className={`p-1.5 rounded-lg border flex flex-col items-center justify-center transition-all ${
                color.toUpperCase() === preset.hex.toUpperCase()
                  ? "border-emerald-400 bg-emerald-950/40 ring-1 ring-emerald-500/40"
                  : "border-neutral-800 bg-neutral-950 hover:border-neutral-700"
              }`}
              title={`${preset.label} (${preset.hex}) - ${preset.desc}`}
            >
              <div
                className="w-5 h-5 rounded-full border border-neutral-600/60 shadow-sm mb-1"
                style={{ backgroundColor: preset.hex }}
              />
              <span className="text-[9px] text-neutral-300 font-medium truncate w-full text-center">
                {preset.label.split(" ")[0]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Color Mode Switcher (RGB vs HSL fine tuning) */}
      <div className="space-y-2 border-t border-neutral-850 pt-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-neutral-400 uppercase">Numeric Channels</span>
          <div className="flex bg-neutral-950 rounded p-0.5 border border-neutral-800 text-[10px]">
            <button
              onClick={() => setColorMode("rgb")}
              className={`px-2 py-0.5 rounded font-medium ${
                colorMode === "rgb" ? "bg-neutral-800 text-white" : "text-neutral-400"
              }`}
            >
              RGB
            </button>
            <button
              onClick={() => setColorMode("hsl")}
              className={`px-2 py-0.5 rounded font-medium ${
                colorMode === "hsl" ? "bg-neutral-800 text-white" : "text-neutral-400"
              }`}
            >
              HSL
            </button>
          </div>
        </div>

        {colorMode === "rgb" ? (
          <div className="grid grid-cols-3 gap-2">
            <div>
              <div className="flex justify-between text-[10px] text-neutral-400 mb-0.5">
                <span>R (Red)</span>
                <span className="font-mono text-emerald-400">{rgb.r}</span>
              </div>
              <input
                type="range"
                min="0"
                max="255"
                value={rgb.r}
                onChange={(e) => handleRgbChange("r", Number(e.target.value))}
                className="w-full accent-rose-500 cursor-pointer"
              />
            </div>
            <div>
              <div className="flex justify-between text-[10px] text-neutral-400 mb-0.5">
                <span>G (Green)</span>
                <span className="font-mono text-emerald-400">{rgb.g}</span>
              </div>
              <input
                type="range"
                min="0"
                max="255"
                value={rgb.g}
                onChange={(e) => handleRgbChange("g", Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>
            <div>
              <div className="flex justify-between text-[10px] text-neutral-400 mb-0.5">
                <span>B (Blue)</span>
                <span className="font-mono text-emerald-400">{rgb.b}</span>
              </div>
              <input
                type="range"
                min="0"
                max="255"
                value={rgb.b}
                onChange={(e) => handleRgbChange("b", Number(e.target.value))}
                className="w-full accent-sky-500 cursor-pointer"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <div>
              <div className="flex justify-between text-[10px] text-neutral-400 mb-0.5">
                <span>H (Hue)</span>
                <span className="font-mono text-emerald-400">{hsl.h}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="360"
                value={hsl.h}
                onChange={(e) => handleHslChange("h", Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>
            <div>
              <div className="flex justify-between text-[10px] text-neutral-400 mb-0.5">
                <span>S (Sat)</span>
                <span className="font-mono text-emerald-400">{hsl.s}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={hsl.s}
                onChange={(e) => handleHslChange("s", Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>
            <div>
              <div className="flex justify-between text-[10px] text-neutral-400 mb-0.5">
                <span>L (Light)</span>
                <span className="font-mono text-emerald-400">{hsl.l}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={hsl.l}
                onChange={(e) => handleHslChange("l", Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      {/* Recent Colors History */}
      {recentColors.length > 0 && (
        <div className="border-t border-neutral-850 pt-2">
          <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1.5">
            Recently Used
          </span>
          <div className="flex flex-wrap gap-1.5">
            {recentColors.map((rc, idx) => (
              <button
                key={`${rc}-${idx}`}
                onClick={() => selectColor(rc)}
                className={`w-6 h-6 rounded-md border transition-transform hover:scale-110 ${
                  color.toUpperCase() === rc.toUpperCase() ? "border-emerald-400 ring-1 ring-emerald-400" : "border-neutral-700"
                }`}
                style={{ backgroundColor: rc }}
                title={rc}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
