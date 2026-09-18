/**
 * OMNISCAN TITAN X - Built-In Background Library
 * High-grade presets specifically tailored for Passport, Visa, ID, Studio & Professional portraits.
 * Categorized into:
 * - Passport Official (Plain White, Off-White, Light Grey, Light Blue, Cream)
 * - Studio Portraits (Grey Textured, Blue Studio, Slate Dark, Warm Studio)
 * - Corporate (Modern Office Blur, Gradient Blue, Bookshelf Blur, Clean Interior)
 * - Creative/Casual (Outdoor Bokeh, Urban Blur, Nature Soft, Warm Light)
 * - Patterns & Fine Textures
 */

import React, { useState } from "react";
import { BackgroundGradient } from "../../engine/background/types";
import { BUILTIN_PATTERNS, BuiltinPattern } from "../../engine/background/patterns";
import { LIBRARY_BACKDROPS, LibraryBackdrop } from "../../engine/background/libraryBackdrops";
import {
  BookOpen,
  Sparkles,
  Palette,
  Check,
  Briefcase,
  Camera,
  Sun,
  Grid,
} from "lucide-react";

interface BuiltinBackgroundLibraryProps {
  currentMode: string;
  currentColor: string;
  currentGradient?: BackgroundGradient;
  currentImage?: string | null;
  onSelectBackdrop?: (backdrop: LibraryBackdrop) => void;
  onSelectColor: (hex: string, name: string) => void;
  onSelectGradient: (gradient: BackgroundGradient, name: string) => void;
  onSelectPattern: (pattern: BuiltinPattern) => void;
}

type CategoryType = "all" | "official" | "studio" | "corporate" | "creative" | "pattern";

export const BuiltinBackgroundLibrary: React.FC<BuiltinBackgroundLibraryProps> = ({
  currentMode,
  currentColor,
  currentGradient,
  currentImage,
  onSelectBackdrop,
  onSelectColor,
  onSelectGradient,
  onSelectPattern,
}) => {
  const [activeCategory, setActiveCategory] = useState<CategoryType>("all");

  const categories: { id: CategoryType; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: "all", label: "All", icon: Grid },
    { id: "official", label: "Official", icon: Palette },
    { id: "studio", label: "Studio", icon: Camera },
    { id: "corporate", label: "Corporate", icon: Briefcase },
    { id: "creative", label: "Creative", icon: Sun },
    { id: "pattern", label: "Patterns", icon: Sparkles },
  ];

  const filteredBackdrops =
    activeCategory === "all"
      ? LIBRARY_BACKDROPS
      : LIBRARY_BACKDROPS.filter((b) => b.category === activeCategory);

  const handleBackdropClick = (backdrop: LibraryBackdrop) => {
    if (onSelectBackdrop) {
      onSelectBackdrop(backdrop);
    } else {
      // Fallback
      onSelectColor(backdrop.thumbnailColor || "#FFFFFF", backdrop.name);
    }
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5 space-y-3 text-xs text-neutral-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <BookOpen className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-white uppercase tracking-wider text-[11px]">
            Background Library
          </span>
        </div>
        <span className="text-[9px] text-neutral-500 font-mono">17 Professional Backdrops</span>
      </div>

      {/* Category Pills */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`py-1.5 px-1 rounded flex items-center justify-center space-x-1 text-[10px] font-semibold transition-colors ${
                isActive
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-neutral-400 hover:text-white hover:bg-neutral-900"
              }`}
            >
              <Icon className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Primary Categorized Backdrops (Passport Official, Studio, Corporate, Creative) */}
      {activeCategory !== "pattern" && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-neutral-400 font-semibold uppercase">
            <span>
              {activeCategory === "all"
                ? "Studio Backdrops"
                : activeCategory === "official"
                ? "Passport & Visa Official"
                : activeCategory === "studio"
                ? "Studio Portraits"
                : activeCategory === "corporate"
                ? "Corporate & Executive"
                : "Creative & Casual Bokeh"}
            </span>
            <span className="text-neutral-500 font-mono text-[9px]">
              {filteredBackdrops.length} options
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {filteredBackdrops.map((backdrop) => {
              const isSelected =
                currentMode === "image" && currentImage === backdrop.dataUrl;

              return (
                <button
                  key={backdrop.id}
                  type="button"
                  onClick={() => handleBackdropClick(backdrop)}
                  title={`${backdrop.name}: ${backdrop.description}`}
                  className={`p-1.5 rounded-lg border text-left transition-all flex flex-col space-y-1.5 group ${
                    isSelected
                      ? "bg-emerald-950/40 border-emerald-500 shadow-md ring-1 ring-emerald-500"
                      : "bg-neutral-950 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900"
                  }`}
                >
                  <div className="relative w-full h-14 rounded border border-neutral-750 overflow-hidden flex items-center justify-center shadow-inner bg-neutral-900">
                    <img
                      src={backdrop.dataUrl}
                      alt={backdrop.name}
                      className="w-full h-full object-cover pointer-events-none"
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-emerald-950/40 flex items-center justify-center backdrop-blur-xs">
                        <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="w-full">
                    <div className="truncate text-[10px] font-bold text-neutral-200 group-hover:text-white">
                      {backdrop.name}
                    </div>
                    <div className="text-[9px] text-neutral-500 truncate">
                      {backdrop.tags.slice(0, 2).join(" • ")}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Built-in Patterns Section */}
      {(activeCategory === "all" || activeCategory === "pattern") && (
        <div className="space-y-1.5 pt-2 border-t border-neutral-850">
          <div className="flex items-center justify-between text-[10px] text-neutral-400 font-semibold uppercase">
            <span>Built-in Patterns & Textures</span>
            <Sparkles className="w-3 h-3 text-neutral-500" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {BUILTIN_PATTERNS.map((pat) => {
              const isSelected =
                currentMode === "image" && currentImage === pat.dataUrl;

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
                  <div className="relative w-full h-12 rounded border border-neutral-750 overflow-hidden flex items-center justify-center shadow-inner bg-neutral-900">
                    <img
                      src={pat.dataUrl}
                      alt={pat.name}
                      className="w-full h-full object-cover pointer-events-none"
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-emerald-950/40 flex items-center justify-center backdrop-blur-xs">
                        <div className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
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
