/**
 * OMNISCAN TITAN X - Smart Background Suggestions
 * Analyzes subject skin tone and luminance to provide top 5 passport-compliant
 * and complementary color suggestions with one-click application.
 */

import React, { useEffect, useState } from "react";
import { SmartSuggestion, analyzeSubjectSkinToneAndSuggest } from "../../engine/background/colorUtils";
import { Sparkles, Check, Wand2 } from "lucide-react";

interface SmartBackgroundSuggestionsProps {
  subjectImage: string | null;
  currentColor: string;
  onApplySuggestion: (hex: string, label: string) => void;
}

export const SmartBackgroundSuggestions: React.FC<SmartBackgroundSuggestionsProps> = ({
  subjectImage,
  currentColor,
  onApplySuggestion,
}) => {
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!subjectImage) return;
    let isMounted = true;
    setLoading(true);

    analyzeSubjectSkinToneAndSuggest(subjectImage)
      .then((res) => {
        if (isMounted) {
          setSuggestions(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [subjectImage]);

  if (suggestions.length === 0) return null;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5 space-y-2.5 text-xs text-neutral-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1.5">
          <Wand2 className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-white uppercase tracking-wider text-[11px]">
            Smart Suggestions
          </span>
        </div>
        <span className="text-[9px] text-emerald-400 font-mono">Skin Tone Harmony</span>
      </div>

      <p className="text-[10px] text-neutral-400">
        Auto-analyzed from subject portrait. Select any swatch for instant compliance or complementary harmony:
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-4 space-x-2 text-neutral-400">
          <div className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-[10px]">Analyzing facial tones...</span>
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-1.5 pt-1">
          {suggestions.map((sug, idx) => {
            const isSelected = currentColor.toUpperCase() === sug.hex.toUpperCase();
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onApplySuggestion(sug.hex, sug.label)}
                title={`${sug.label}: ${sug.desc}`}
                className={`p-1 rounded-lg border text-center transition-all flex flex-col items-center space-y-1 group ${
                  isSelected
                    ? "bg-emerald-950/40 border-emerald-500 shadow-sm ring-1 ring-emerald-500"
                    : "bg-neutral-950 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-850"
                }`}
              >
                <div
                  className="w-full h-7 rounded border border-neutral-700 overflow-hidden flex items-center justify-center shadow-inner"
                  style={{ backgroundColor: sug.hex }}
                >
                  {isSelected && (
                    <div className="w-3.5 h-3.5 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                      <Check className="w-2 h-2 stroke-[3]" />
                    </div>
                  )}
                </div>
                <div className="text-[9px] font-semibold text-neutral-200 truncate w-full group-hover:text-white">
                  {sug.label}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
