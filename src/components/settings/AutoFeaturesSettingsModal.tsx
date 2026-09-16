import React from "react";
import {
  Sliders,
  RotateCw,
  Crop,
  Wand2,
  FileText,
  Trash2,
  Sparkles,
  Layers,
  Eye,
  RotateCcw,
  X,
  Info,
  Check,
} from "lucide-react";
import { useAutoFeatureSettings } from "../../hooks/useAutoFeatureSettings";
import { toast } from "../../services/toast/toastService";

export interface AutoFeaturesSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AutoFeaturesSettingsModal: React.FC<AutoFeaturesSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { settings, update, reset } = useAutoFeatureSettings();

  if (!isOpen) return null;

  const handleReset = () => {
    reset();
    toast.info("Auto feature settings have been reset to factory defaults.");
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auto-features-title"
    >
      <div className="bg-neutral-900 border border-neutral-750 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scaleUp">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/60">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 id="auto-features-title" className="text-base font-bold text-white tracking-wide">
                Auto-Detection &amp; Intelligence Settings
              </h2>
              <p className="text-xs text-neutral-400">
                Configure autonomous computer vision routines, angles, and sensitivity.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            title="Close Settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Settings Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs divide-y divide-neutral-800/80">
          {/* SECTION 1: AUTO DETECTION PIPELINE */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-sky-400 font-semibold tracking-wider uppercase text-[11px]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Computer Vision Auto-Detection</span>
            </div>

            {/* 1. Auto Edge Detection */}
            <div className="p-3.5 rounded-xl bg-neutral-800/40 border border-neutral-750/70 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-start space-x-3">
                  <Crop className="w-4 h-4 text-sky-400 mt-0.5" />
                  <div>
                    <span className="font-semibold text-neutral-200">Auto Document Edge Detection</span>
                    <p className="text-neutral-400 text-[11px]">
                      Identifies document boundaries, corners, and perspective distortion using 7-pass Canny/Douglas-Peucker contour fitting.
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={settings.autoEdgeDetection}
                    onChange={(e) => update({ autoEdgeDetection: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600"></div>
                </label>
              </div>

              {settings.autoEdgeDetection && (
                <div className="pt-2 border-t border-neutral-700/60 flex items-center justify-between text-[11px]">
                  <span className="text-neutral-400 font-medium">Sensitivity:</span>
                  <div className="inline-flex rounded-lg bg-neutral-900 p-0.5 border border-neutral-750">
                    {(["conservative", "standard", "aggressive"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => update({ edgeSensitivity: mode })}
                        className={`px-2.5 py-1 rounded capitalize transition-all ${
                          settings.edgeSensitivity === mode
                            ? "bg-sky-600 text-white font-medium shadow-sm"
                            : "text-neutral-400 hover:text-white"
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 2. Auto Deskew / Straighten */}
            <div className="p-3.5 rounded-xl bg-neutral-800/40 border border-neutral-750/70 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-start space-x-3">
                  <RotateCw className="w-4 h-4 text-amber-400 mt-0.5" />
                  <div>
                    <span className="font-semibold text-neutral-200">Auto Deskew / Straighten</span>
                    <p className="text-neutral-400 text-[11px]">
                      Calculates text baseline tilt using ensemble Radon variance, Hough lines, and run-length projection.
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={settings.autoDeskew}
                    onChange={(e) => update({ autoDeskew: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600"></div>
                </label>
              </div>

              {settings.autoDeskew && (
                <div className="pt-2 border-t border-neutral-700/60 flex items-center justify-between text-[11px]">
                  <span className="text-neutral-400 font-medium">Max Rotation Limit:</span>
                  <div className="inline-flex rounded-lg bg-neutral-900 p-0.5 border border-neutral-750">
                    {([5, 10, 45] as const).map((ang) => (
                      <button
                        key={ang}
                        type="button"
                        onClick={() => update({ deskewMaxAngle: ang })}
                        className={`px-3 py-1 rounded transition-all ${
                          settings.deskewMaxAngle === ang
                            ? "bg-amber-600 text-white font-medium shadow-sm"
                            : "text-neutral-400 hover:text-white"
                        }`}
                      >
                        ±{ang}°
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 3. Auto Color Enhance */}
            <div className="p-3.5 rounded-xl bg-neutral-800/40 border border-neutral-750/70 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-start space-x-3">
                  <Wand2 className="w-4 h-4 text-emerald-400 mt-0.5" />
                  <div>
                    <span className="font-semibold text-neutral-200">Auto Color Enhance</span>
                    <p className="text-neutral-400 text-[11px]">
                      Optimizes dynamic range, background whitening, and shadow reduction according to document characteristics.
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={settings.autoColorEnhance}
                    onChange={(e) => update({ autoColorEnhance: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600"></div>
                </label>
              </div>

              {settings.autoColorEnhance && (
                <div className="pt-2 border-t border-neutral-700/60 flex items-center justify-between text-[11px]">
                  <span className="text-neutral-400 font-medium">Enhance Mode:</span>
                  <div className="inline-flex rounded-lg bg-neutral-900 p-0.5 border border-neutral-750">
                    {(["content-aware", "always-enhance", "off"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => update({ colorEnhanceMode: mode })}
                        className={`px-2.5 py-1 rounded capitalize transition-all ${
                          settings.colorEnhanceMode === mode
                            ? "bg-emerald-600 text-white font-medium shadow-sm"
                            : "text-neutral-400 hover:text-white"
                        }`}
                      >
                        {mode.replace("-", " ")}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 4. Auto Blank Page Removal */}
            <div className="p-3.5 rounded-xl bg-neutral-800/40 border border-neutral-750/70 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-start space-x-3">
                  <Trash2 className="w-4 h-4 text-rose-400 mt-0.5" />
                  <div>
                    <span className="font-semibold text-neutral-200">Auto Blank Page Removal</span>
                    <p className="text-neutral-400 text-[11px]">
                      Detects blank pages with multi-metric Shannon entropy, border exclusion, and scanner bleed-through filtering.
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={settings.autoBlankPageRemoval}
                    onChange={(e) => update({ autoBlankPageRemoval: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600"></div>
                </label>
              </div>

              {settings.autoBlankPageRemoval && (
                <div className="pt-2 border-t border-neutral-700/60 grid grid-cols-2 gap-3 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400 font-medium">Sensitivity:</span>
                    <select
                      value={settings.blankSensitivity}
                      onChange={(e) => update({ blankSensitivity: e.target.value as any })}
                      className="bg-neutral-900 text-neutral-200 px-2 py-1 rounded border border-neutral-750 text-[11px] focus:outline-none"
                    >
                      <option value="conservative">Conservative</option>
                      <option value="standard">Standard</option>
                      <option value="aggressive">Aggressive</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400 font-medium">Action:</span>
                    <select
                      value={settings.blankAction}
                      onChange={(e) => update({ blankAction: e.target.value as any })}
                      className="bg-neutral-900 text-neutral-200 px-2 py-1 rounded border border-neutral-750 text-[11px] focus:outline-none"
                    >
                      <option value="flag-for-review">Flag for review</option>
                      <option value="auto-remove">Auto-remove</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* 5. Auto Rotate (EXIF + Orientation) */}
            <div className="p-3.5 rounded-xl bg-neutral-800/40 border border-neutral-750/70 flex items-center justify-between">
              <div className="flex items-start space-x-3">
                <RotateCcw className="w-4 h-4 text-purple-400 mt-0.5" />
                <div>
                  <span className="font-semibold text-neutral-200">Auto Rotate (EXIF + Orientation)</span>
                  <p className="text-neutral-400 text-[11px]">
                    Reads phone camera EXIF tags (1-8) and stroke directional energy to orient photos upright before processing.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={settings.autoRotateExif}
                  onChange={(e) => update({ autoRotateExif: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600"></div>
              </label>
            </div>

            {/* 6. Auto Document Classification */}
            <div className="p-3.5 rounded-xl bg-neutral-800/40 border border-neutral-750/70 flex items-center justify-between">
              <div className="flex items-start space-x-3">
                <FileText className="w-4 h-4 text-sky-400 mt-0.5" />
                <div>
                  <span className="font-semibold text-neutral-200">Auto Document Classification</span>
                  <p className="text-neutral-400 text-[11px]">
                    Detects receipts, ID cards, passports, invoices, contracts, and photographs to suggest tuned enhancement presets.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={settings.autoClassification}
                  onChange={(e) => update({ autoClassification: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600"></div>
              </label>
            </div>

            {/* 7. Auto White Balance Correction */}
            <div className="p-3.5 rounded-xl bg-neutral-800/40 border border-neutral-750/70 flex items-center justify-between">
              <div className="flex items-start space-x-3">
                <Sparkles className="w-4 h-4 text-amber-300 mt-0.5" />
                <div>
                  <span className="font-semibold text-neutral-200">Auto White Balance Correction</span>
                  <p className="text-neutral-400 text-[11px]">
                    Corrects yellow incandescent or blue ambient color temperature casts across paper backgrounds.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={settings.autoWhiteBalance}
                  onChange={(e) => update({ autoWhiteBalance: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600"></div>
              </label>
            </div>
          </div>

          {/* SECTION 2: BEHAVIOR & INTERACTION OPTIONS */}
          <div className="pt-6 space-y-4">
            <div className="flex items-center space-x-2 text-indigo-400 font-semibold tracking-wider uppercase text-[11px]">
              <Eye className="w-3.5 h-3.5" />
              <span>Behavior &amp; User Experience</span>
            </div>

            {/* Run on upload */}
            <div className="p-3.5 rounded-xl bg-neutral-800/40 border border-neutral-750/70 flex items-center justify-between">
              <div className="flex items-start space-x-3">
                <Layers className="w-4 h-4 text-indigo-400 mt-0.5" />
                <div>
                  <span className="font-semibold text-neutral-200">Run Auto Features on Upload</span>
                  <p className="text-neutral-400 text-[11px]">
                    When active, imported documents immediately run edge detection and classification. Turn off to only run manually.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={settings.runOnUpload}
                  onChange={(e) => update({ runOnUpload: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600"></div>
              </label>
            </div>

            {/* Show confidence badges */}
            <div className="p-3.5 rounded-xl bg-neutral-800/40 border border-neutral-750/70 flex items-center justify-between">
              <div className="flex items-start space-x-3">
                <Eye className="w-4 h-4 text-emerald-400 mt-0.5" />
                <div>
                  <span className="font-semibold text-neutral-200">Show Confidence Badges</span>
                  <p className="text-neutral-400 text-[11px]">
                    Displays color-coded indicators (Green ≥85%, Amber 60–84%, Red &lt;60%) on detected quads, angles, and filters.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={settings.showConfidenceBadges}
                  onChange={(e) => update({ showConfidenceBadges: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600"></div>
              </label>
            </div>

            {/* Show auto-detection suggestions */}
            <div className="p-3.5 rounded-xl bg-neutral-800/40 border border-neutral-750/70 flex items-center justify-between">
              <div className="flex items-start space-x-3">
                <Info className="w-4 h-4 text-sky-400 mt-0.5" />
                <div>
                  <span className="font-semibold text-neutral-200">Show Auto-Detection Suggestions</span>
                  <p className="text-neutral-400 text-[11px]">
                    Displays interactive toast suggestions to apply perspective de-warping or filter presets when a document is analyzed.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={settings.showSuggestions}
                  onChange={(e) => update({ showSuggestions: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-neutral-800 bg-neutral-950/80">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-neutral-750 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors text-xs font-medium"
            title="Reset all settings to default values"
          >
            <RotateCcw className="w-3.5 h-3.5 text-neutral-400" />
            <span>Reset to Defaults</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center space-x-1.5 px-5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition-colors shadow-md"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
  );
};
