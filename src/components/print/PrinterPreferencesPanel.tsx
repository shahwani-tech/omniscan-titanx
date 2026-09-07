/**
 * OMNISCAN TITAN X - Printer Preferences Panel
 * Features the native "Printer Preferences" button to trigger the driver preferences UI
 * and manages per-job temporary DEVMODE overrides without altering Windows baseline settings.
 */

import React, { useState } from "react";
import {
  SlidersHorizontal,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Layers,
  FileCheck,
  Check,
  Info,
} from "lucide-react";
import { usePrint } from "../../context/PrintContext";

export const PrinterPreferencesPanel: React.FC = () => {
  const {
    selectedPrinter,
    capabilities,
    temporaryPreferences,
    updateTemporaryPreferences,
    openNativePreferences,
  } = usePrint();

  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isOpeningNative, setIsOpeningNative] = useState<boolean>(false);

  const handleOpenPreferences = async () => {
    if (!selectedPrinter) return;
    setIsOpeningNative(true);
    try {
      const res = await openNativePreferences();
      setFeedbackMessage(res.message || "Driver preferences opened in temporary per-job session.");
      setTimeout(() => setFeedbackMessage(null), 5000);
    } catch (err: any) {
      setFeedbackMessage(err.message || "Failed to open native driver preferences.");
    } finally {
      setIsOpeningNative(false);
    }
  };

  if (!selectedPrinter) return null;

  return (
    <div className="space-y-3 pt-2 border-t border-neutral-800">
      {/* Printer Preferences Primary Action Button (Requirement 5) */}
      <div className="space-y-1.5">
        <button
          type="button"
          onClick={handleOpenPreferences}
          disabled={isOpeningNative}
          className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 bg-neutral-800 hover:bg-neutral-700/80 active:bg-neutral-800 text-amber-300 hover:text-amber-200 border border-amber-500/40 hover:border-amber-400 rounded-lg text-xs font-semibold shadow-sm transition-all group"
          title={`Launch native driver preferences dialog for "${selectedPrinter.displayName}"`}
        >
          <SlidersHorizontal className="w-4 h-4 text-amber-400 group-hover:rotate-45 transition-transform" />
          <span>Printer Preferences</span>
          <ExternalLink className="w-3.5 h-3.5 text-neutral-400 ml-auto" />
        </button>

        {/* Temporary Preferences Explanatory Badge (Requirement 6) */}
        <div className="flex items-start gap-1.5 px-2.5 py-2 bg-neutral-950/70 border border-neutral-800/80 rounded-md text-[11px] text-neutral-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
          <span>
            <strong className="text-neutral-200 font-medium">Temporary Settings:</strong> Driver preference modifications apply strictly to this active print job and will{" "}
            <span className="text-emerald-300">not permanently alter</span> your Windows defaults.
          </span>
        </div>

        {feedbackMessage && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded text-xs text-amber-300 animate-in fade-in">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{feedbackMessage}</span>
          </div>
        )}
      </div>

      {/* Quick Per-Job Driver Overrides */}
      <div className="space-y-2.5 bg-neutral-950/40 p-2.5 rounded-lg border border-neutral-800/60">
        <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-400" />
          Per-Job Driver Properties
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* Media Type */}
          <div className="space-y-1">
            <label className="text-[11px] text-neutral-400">Media Type</label>
            <select
              value={temporaryPreferences.mediaType}
              onChange={(e) => updateTemporaryPreferences({ mediaType: e.target.value as any })}
              className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
            >
              <option value="plain">Plain Paper</option>
              <option value="photo-glossy">Photo Paper Plus Glossy</option>
              <option value="photo-matte">Matte Photo Paper</option>
              <option value="cardstock">Heavy Cardstock (Index)</option>
              <option value="envelope">Envelope</option>
            </select>
          </div>

          {/* Paper Tray / Source */}
          <div className="space-y-1">
            <label className="text-[11px] text-neutral-400">Paper Source / Tray</label>
            <select
              value={temporaryPreferences.paperSource}
              onChange={(e) => updateTemporaryPreferences({ paperSource: e.target.value })}
              className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
            >
              {(capabilities?.paperSources || ["Auto Select", "Tray 1", "Manual Feed"]).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Borderless Printing Toggle (dynamically available if supported) */}
        {capabilities?.supportsBorderless && (
          <label className="flex items-center justify-between px-2 py-1.5 bg-neutral-900/80 hover:bg-neutral-900 rounded border border-neutral-800 cursor-pointer transition-colors">
            <div className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <div className="text-xs">
                <div className="font-medium text-neutral-200">Borderless Printing</div>
                <div className="text-[10px] text-neutral-400">Edge-to-edge bleed without margins</div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={temporaryPreferences.borderless}
              onChange={(e) => updateTemporaryPreferences({ borderless: e.target.checked })}
              className="w-4 h-4 rounded border-neutral-700 bg-neutral-800 text-amber-500 focus:ring-0 cursor-pointer"
            />
          </label>
        )}

        {/* Ink-Saving Mode */}
        <label className="flex items-center justify-between px-2 py-1.5 bg-neutral-900/80 hover:bg-neutral-900 rounded border border-neutral-800 cursor-pointer transition-colors">
          <div className="flex items-center gap-2">
            <FileCheck className="w-3.5 h-3.5 text-sky-400" />
            <div className="text-xs">
              <div className="font-medium text-neutral-200">Eco-Draft / Ink Saving</div>
              <div className="text-[10px] text-neutral-400">Reduce toner/ink density for proofs</div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={temporaryPreferences.inkSaving}
            onChange={(e) => updateTemporaryPreferences({ inkSaving: e.target.checked })}
            className="w-4 h-4 rounded border-neutral-700 bg-neutral-800 text-amber-500 focus:ring-0 cursor-pointer"
          />
        </label>
      </div>
    </div>
  );
};
