/**
 * OMNISCAN TITAN X - Built-In Background Library
 * High-grade presets specifically tailored for Passport, Visa, and ID photos:
 * Solid Standard, Gradient Studio, and Pattern Backdrops
 */

import React, { useState } from "react";
import { STANDARD_BACKGROUND_PRESETS, BackgroundPreset, BackgroundGradient } from "../../engine/background/types";
import { BUILTIN_PATTERNS, BuiltinPattern } from "../../engine/background/patterns";
import { BookOpen, Sparkles, Palette, Layers, Check } from "lucide-react";

interface BuiltinBackgroundLibraryProps {
  currentMode: string;
  currentColor: string;
  currentGradient?: BackgroundGradient;
  currentImage?: string | null;
  onSelectColor: (hex: string, name: string) => void;
  onSelectGradient: (gradient: BackgroundGradient, name: string) => void;
  onSelectPattern: (pattern: BuiltinPattern) => void;
}

export const BuiltinBackgroundLibrary: React.FC<BuiltinBackgroundLibraryProps> = ({
  currentMode,
  currentColor,
  currentGradient,
  currentImage,
  onSelectColor,
  onSelectGradient,
  onSelectPattern,
}) => {
  const [activeCategory, setActiveCategory] = useState<"all" | "solid" | "gradient" | "pattern">("all");

  const solidPresets = STANDARD_BACKGROUND_PRESETS.filter((p) => p.mode === "color");
  const gradientPresets = STANDARD_BACKGROUND_PRESETS.filter((p) => p.mode === "gradient");

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5 space-y-3 text-xs text-neutral-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <BookOpen className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-white uppercase tracking-wider text-[11px]">
            Background Library
          </span>
        </div>
        <span className="text-[9px] text-neutral-500 font-mono">Passport & ID</span>
      </div>

      {/* Category Pills */}
      <div className="flex items-center space-x-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
        {[
          { id: "all", label: "All" },
          { id: "solid", label: "Solid Standard" },
          { id: "gradient", label: "Studio Gradients" },
          { id: "pattern", label: "Patterns" },
        ].map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveCategory(cat.id as any)}
            className={`flex-1 py-1 rounded text-[10px] font-semibold transition-colors ${
              activeCategory === cat.id
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Solid Standard Presets */}
      {(activeCategory === "all" || activeCategory === "solid") && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-neutral-400 font-semibold uppercase">
            <span>Solid Standard (ICAO / Visa)</span>
            <Palette className="w-3 h-3 text-neutral-500" />
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {solidPresets.map((preset) => {
              const isSelected = currentMode === "color" && currentColor.toUpperCase() === (preset.color || "").toUpperCase();
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onSelectColor(preset.color || "#FFFFFF", preset.name)}
                  title={`${preset.name}: ${preset.description}`}
                  className={`p-1.5 rounded-lg border text-left transition-all flex flex-col space-y-1.5 group ${
                    isSelected
                      ? "bg-emerald-950/40 border-emerald-500 shadow-md ring-1 ring-emerald-500"
                      : "bg-neutral-950 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900"
                  }`}
                >
                  <div className="relative w-full h-8 rounded border border-neutral-700 overflow-hidden flex items-center justify-center shadow-inner"
                    style={{ backgroundColor: preset.color }}
                  >
                    {isSelected && (
                      <div className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    )}
                  </div>
                  <div className="w-full truncate text-[10px] font-medium text-neutral-300 group-hover:text-white">
                    {preset.name}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Studio Gradient Presets */}
      {(activeCategory === "all" || activeCategory === "gradient") && (
        <div className="space-y-1.5 pt-1 border-t border-neutral-850">
          <div className="flex items-center justify-between text-[10px] text-neutral-400 font-semibold uppercase">
            <span>Studio Gradients</span>
            <Sparkles className="w-3 h-3 text-neutral-500" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {gradientPresets.map((preset) => {
              const grad = preset.gradient;
              if (!grad) return null;
              const bgCss =
                grad.type === "linear"
                  ? `linear-gradient(${grad.angle}deg, ${grad.color1}, ${grad.color2})`
                  : `radial-gradient(circle, ${grad.color1} 0%, ${grad.color2} 100%)`;
              const isSelected =
                currentMode === "gradient" &&
                currentGradient?.color1.toUpperCase() === grad.color1.toUpperCase() &&
                currentGradient?.color2.toUpperCase() === grad.color2.toUpperCase();

              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onSelectGradient(grad, preset.name)}
                  title={`${preset.name}: ${preset.description}`}
                  className={`p-1.5 rounded-lg border text-left transition-all flex flex-col space-y-1.5 group ${
                    isSelected
                      ? "bg-emerald-950/40 border-emerald-500 shadow-md ring-1 ring-emerald-500"
                      : "bg-neutral-950 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900"
                  }`}
                >
                  <div
                    className="relative w-full h-10 rounded border border-neutral-700 overflow-hidden flex items-center justify-center shadow-inner"
                    style={{ background: bgCss }}
                  >
                    {isSelected && (
                      <div className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    )}
                  </div>
                  <div className="w-full truncate text-[10px] font-medium text-neutral-300 group-hover:text-white">
                    {preset.name}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Pattern Backdrops */}
      {(activeCategory === "all" || activeCategory === "pattern") && (
        <div className="space-y-1.5 pt-1 border-t border-neutral-850">
          <div className="flex items-center justify-between text-[10px] text-neutral-400 font-semibold uppercase">
            <span>Pattern & Muslin Backdrops</span>
            <Layers className="w-3 h-3 text-neutral-500" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {BUILTIN_PATTERNS.map((pat) => {
              const isSelected = currentMode === "image" && currentImage === pat.dataUrl;
              return (
                <button
                  key={pat.id}
                  type="button"
                  onClick={() => onSelectPattern(pat)}
                  title={`${pat.name}: ${pat.description}`}
                  className={`p-1.5 rounded-lg border text-left transition-all flex flex-col space-y-1.5 group ${
                    isSelected
                      ? "bg-emerald-950/40 border-emerald-500 shadow-md ring-1 ring-emerald-500"
                      : "bg-neutral-950 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900"
                  }`}
                >
                  <div
                    className="relative w-full h-10 rounded border border-neutral-700 overflow-hidden flex items-center justify-center shadow-inner"
                    style={{
                      backgroundImage: `url("${pat.dataUrl}")`,
                      backgroundSize: pat.fitMode === "cover" ? "cover" : "contain",
                    }}
                  >
                    {isSelected && (
                      <div className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    )}
                  </div>
                  <div className="w-full truncate text-[10px] font-medium text-neutral-300 group-hover:text-white">
                    {pat.name}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
