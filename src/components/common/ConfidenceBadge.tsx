import React, { useState, useRef, useEffect } from "react";
import { getAutoFeatureSettings } from "../../services/settings/autoFeatureSettings";

export interface ConfidenceBadgeProps {
  /**
   * Confidence score as a decimal (0.0 to 1.0) or percentage (0 to 100)
   */
  score: number;
  /**
   * Optional custom label to replace the tier label
   */
  label?: string;
  /**
   * Feature context name (e.g. "Edge Detection", "Deskew", "Classification", "Blank Analysis")
   */
  featureName?: string;
  /**
   * Optional compact mode
   */
  compact?: boolean;
  /**
   * Optional class name override
   */
  className?: string;
  /**
   * Whether clicking opens the tooltip explaining the score
   */
  interactive?: boolean;
  /**
   * Optional click handler
   */
  onClick?: () => void;
}

export type ConfidenceTier = "high" | "medium" | "low";

export function getConfidenceTier(scoreNormalized: number): {
  tier: ConfidenceTier;
  label: string;
  shortLabel: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  dotColor: string;
  description: string;
  recommendation: string;
} {
  const pct = Math.round(scoreNormalized * 100);

  if (pct >= 85) {
    return {
      tier: "high",
      label: "High confidence",
      shortLabel: "Detected",
      textColor: "text-emerald-400",
      bgColor: "bg-emerald-400/20",
      borderColor: "border-emerald-500/40",
      dotColor: "bg-emerald-400",
      description: "High statistical certainty. The computer vision model confirmed high edge sharpness and clear boundary contrast.",
      recommendation: "Ready to proceed. No manual adjustments required.",
    };
  }

  if (pct >= 60) {
    return {
      tier: "medium",
      label: "Review suggested",
      shortLabel: "Review",
      textColor: "text-amber-400",
      bgColor: "bg-amber-400/20",
      borderColor: "border-amber-500/40",
      dotColor: "bg-amber-400",
      description: "Moderate confidence. Document borders were detected, but lighting variation or subtle background contrast was present.",
      recommendation: "Quick review suggested. Adjust corner pins if border edges look slightly offset.",
    };
  }

  return {
    tier: "low",
    label: "Manual adjustment needed",
    shortLabel: "Manual",
    textColor: "text-red-400",
    bgColor: "bg-red-400/20",
    borderColor: "border-red-500/40",
    dotColor: "bg-red-400",
    description: "Low edge contrast or ambiguous borders detected (e.g. white paper on white surface or extreme shadowing).",
    recommendation: "Manual adjustment needed. Drag corner handles to align with actual document boundaries.",
  };
}

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({
  score,
  label,
  featureName,
  compact = false,
  className = "",
  interactive = true,
  onClick,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const badgeRef = useRef<HTMLDivElement>(null);

  // Normalize score between 0.0 and 1.0
  const normalizedScore = score > 1.0 ? score / 100 : Math.max(0, Math.min(1, score));
  const percentage = Math.round(normalizedScore * 100);
  const tierInfo = getConfidenceTier(normalizedScore);

  // Check user settings
  const settings = getAutoFeatureSettings();
  if (!settings.showConfidenceBadges) {
    return null;
  }

  useEffect(() => {
    if (!showTooltip) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (badgeRef.current && !badgeRef.current.contains(e.target as Node)) {
        setShowTooltip(false);
      }
    };
    window.addEventListener("mousedown", handleOutsideClick);
    return () => window.removeEventListener("mousedown", handleOutsideClick);
  }, [showTooltip]);

  const displayLabel = label || (compact ? tierInfo.shortLabel : tierInfo.label);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) {
      onClick();
    }
    if (interactive) {
      setShowTooltip((prev) => !prev);
    }
  };

  return (
    <div ref={badgeRef} className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        title={`Confidence: ${percentage}% (${tierInfo.label}). Click for analysis details.`}
        className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full border text-[10px] font-mono font-semibold transition-all select-none ${tierInfo.bgColor} ${tierInfo.borderColor} ${tierInfo.textColor} ${
          interactive ? "hover:brightness-125 cursor-pointer shadow-sm" : ""
        }`}
      >
        {/* Visual recognition dot (●) */}
        <span className={`w-1.5 h-1.5 rounded-full ${tierInfo.dotColor} animate-pulse`} />
        <span>{percentage}%</span>
        <span className="opacity-90 font-sans font-medium">{displayLabel}</span>
      </button>

      {/* Interactive Explanation Tooltip Popover */}
      {interactive && showTooltip && (
        <div
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 rounded-lg bg-neutral-900 border border-neutral-700 shadow-2xl text-xs text-neutral-200 backdrop-blur-md"
          role="tooltip"
        >
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-neutral-800">
            <div className="flex items-center space-x-1.5">
              <span className={`w-2 h-2 rounded-full ${tierInfo.dotColor}`} />
              <span className="font-semibold text-white">
                {featureName || "Auto-Detection"} ({percentage}%)
              </span>
            </div>
            <span className={`text-[10px] uppercase tracking-wider font-bold ${tierInfo.textColor}`}>
              {tierInfo.label}
            </span>
          </div>

          <p className="text-[11px] text-neutral-300 leading-relaxed mb-2">
            {tierInfo.description}
          </p>

          <div className="p-1.5 rounded bg-neutral-800/80 border border-neutral-750 text-[10px] text-neutral-300">
            <span className="font-semibold text-sky-400">Action: </span>
            {tierInfo.recommendation}
          </div>

          {/* Pointer caret */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-neutral-700" />
        </div>
      )}
    </div>
  );
};
