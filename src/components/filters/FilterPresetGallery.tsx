/**
 * OMNISCAN TITAN X - CamScanner Filter Preset Gallery
 * Live Thumbnail Previews, Category Filtering & Custom Favorites Management
 */

import React, { useState, useEffect } from "react";
import {
  CamScannerPresetId,
  CamScannerPresetMeta,
  CustomFilterPreset,
  ImageFilterPipeline,
} from "../../types";
import {
  BUILTIN_CAMSCANNER_PRESETS,
  loadCustomFilterPresets,
  saveCustomFilterPreset,
  deleteCustomFilterPreset,
  generatePresetThumbnails,
} from "../../engine/filters";
import { Sparkles, Star, Plus, Trash2, Check, Sliders, Palette, Zap } from "lucide-react";

interface FilterPresetGalleryProps {
  activePreset?: CamScannerPresetId;
  currentFilters: ImageFilterPipeline;
  sourceThumbnailUrl: string;
  onSelectPreset: (presetId: CamScannerPresetId, presetFilters: Partial<ImageFilterPipeline>) => void;
  onSaveAsFavorite?: (name: string) => void;
}

export const FilterPresetGallery: React.FC<FilterPresetGalleryProps> = ({
  activePreset = "original",
  currentFilters,
  sourceThumbnailUrl,
  onSelectPreset,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [customPresets, setCustomPresets] = useState<CustomFilterPreset[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");

  // Load custom presets
  useEffect(() => {
    setCustomPresets(loadCustomFilterPresets());
  }, []);

  // Generate live mini-previews for thumbnails
  useEffect(() => {
    let isMounted = true;
    if (sourceThumbnailUrl) {
      generatePresetThumbnails(sourceThumbnailUrl).then((thumbs) => {
        if (isMounted) {
          setThumbnails(thumbs);
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [sourceThumbnailUrl]);

  const categories = ["All", "Standard", "Color", "B&W", "Enhance", "Specialized", "Favorites"];

  const filteredBuiltins = BUILTIN_CAMSCANNER_PRESETS.filter((p) => {
    if (selectedCategory === "All") return true;
    if (selectedCategory === "Favorites") return false;
    return p.category === selectedCategory;
  });

  const handleSaveFavorite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim()) return;
    const created = saveCustomFilterPreset(newPresetName.trim(), currentFilters);
    setCustomPresets(loadCustomFilterPresets());
    setNewPresetName("");
    setShowSaveModal(false);
    onSelectPreset("custom", created.filters);
  };

  const handleDeleteFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteCustomFilterPreset(id);
    setCustomPresets(loadCustomFilterPresets());
  };

  return (
    <div className="flex flex-col space-y-3">
      {/* Category Pills & Save Favorite Button */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-none">
        <div className="flex items-center space-x-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors whitespace-nowrap ${
                selectedCategory === cat
                  ? "bg-sky-600 text-white shadow-sm"
                  : "bg-neutral-900 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 border border-neutral-800"
              }`}
            >
              {cat === "Favorites" && <Star className="w-3 h-3 inline mr-1 text-amber-400" />}
              {cat}
              {cat === "Favorites" && customPresets.length > 0 && ` (${customPresets.length})`}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowSaveModal(true)}
          className="flex items-center space-x-1 px-2.5 py-1 text-xs rounded-md bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-amber-400 hover:text-amber-300 font-medium transition-colors shrink-0"
          title="Save Current Parameters as Custom Preset"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Save Preset</span>
        </button>
      </div>

      {/* Preset Grid Cards */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5 max-h-[260px] overflow-y-auto pr-1">
        {/* Built-in Presets */}
        {selectedCategory !== "Favorites" &&
          filteredBuiltins.map((preset) => {
            const isSelected = activePreset === preset.id;
            const thumbSrc = thumbnails[preset.id] || sourceThumbnailUrl;

            return (
              <button
                key={preset.id}
                onClick={() => onSelectPreset(preset.id, preset.filters)}
                className={`group relative flex flex-col items-center rounded-lg p-1.5 border transition-all text-left overflow-hidden ${
                  isSelected
                    ? "bg-sky-950/50 border-sky-500 ring-2 ring-sky-500/40 shadow-lg"
                    : "bg-neutral-900/90 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-850"
                }`}
              >
                {/* Badge if special */}
                {preset.badge && (
                  <span
                    className={`absolute top-1.5 right-1.5 z-10 px-1 py-0.2 rounded text-[8px] font-bold tracking-tight uppercase ${
                      preset.badge === "Signature"
                        ? "bg-gradient-to-r from-amber-500 to-rose-500 text-white"
                        : preset.badge === "Smart"
                        ? "bg-sky-500 text-white"
                        : "bg-neutral-800 text-neutral-300"
                    }`}
                  >
                    {preset.badge}
                  </span>
                )}

                {/* Thumbnail Preview */}
                <div className="relative w-full aspect-[4/3] rounded bg-neutral-950 overflow-hidden mb-1.5 border border-neutral-800/80">
                  <img
                    src={thumbSrc}
                    alt={preset.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                  {isSelected && (
                    <div className="absolute inset-0 bg-sky-600/20 flex items-center justify-center">
                      <div className="w-5 h-5 rounded-full bg-sky-500 text-white flex items-center justify-center shadow">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Label & Category */}
                <span className="text-[11px] font-semibold text-neutral-200 truncate w-full text-center">
                  {preset.name}
                </span>
                <span className="text-[9px] text-neutral-500 truncate w-full text-center">
                  {preset.category}
                </span>
              </button>
            );
          })}

        {/* Custom Favorites */}
        {(selectedCategory === "All" || selectedCategory === "Favorites") &&
          customPresets.map((custom) => {
            const isSelected = activePreset === "custom" && custom.id === custom.id;
            return (
              <div
                key={custom.id}
                onClick={() => onSelectPreset("custom", custom.filters)}
                className={`group relative flex flex-col items-center rounded-lg p-1.5 border transition-all text-left cursor-pointer overflow-hidden ${
                  isSelected
                    ? "bg-amber-950/40 border-amber-500 ring-2 ring-amber-500/40 shadow-lg"
                    : "bg-neutral-900/90 border-neutral-800 hover:border-neutral-700"
                }`}
              >
                <button
                  onClick={(e) => handleDeleteFavorite(custom.id, e)}
                  className="absolute top-1 right-1 z-20 p-1 rounded bg-neutral-950/80 text-neutral-400 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete Custom Preset"
                >
                  <Trash2 className="w-3 h-3" />
                </button>

                <div className="relative w-full aspect-[4/3] rounded bg-neutral-950 overflow-hidden mb-1.5 border border-neutral-800/80 flex items-center justify-center">
                  <Star className="w-6 h-6 text-amber-400 fill-amber-400/30" />
                </div>

                <span className="text-[11px] font-semibold text-amber-300 truncate w-full text-center">
                  {custom.name}
                </span>
                <span className="text-[9px] text-neutral-500 truncate w-full text-center">Custom Favorite</span>
              </div>
            );
          })}
      </div>

      {/* Save Preset Dialog Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveFavorite}
            className="w-full max-w-sm rounded-xl bg-neutral-900 border border-neutral-800 p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center space-x-2 text-amber-400">
              <Star className="w-5 h-5 fill-amber-400" />
              <h3 className="text-sm font-bold text-white">Save as Custom Filter Preset</h3>
            </div>
            <p className="text-xs text-neutral-400">
              Save your current brightness, contrast, sharp, and color parameters as a reusable favorite preset.
            </p>

            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. High-Contrast Invoice / Passport Clean"
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-neutral-950 border border-neutral-800 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
            />

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors shadow"
              >
                Save Preset
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
