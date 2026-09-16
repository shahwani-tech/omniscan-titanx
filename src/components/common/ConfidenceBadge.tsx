import React, { useState, useRef, useEffect } from "react";
import { getAutoFeatureSettings } from "../../services/settings/autoFeatureSettings";

export interface ConfidenceBadgeProps {
  /**
   * Confidence score as a percentage (0-100) or decimal (0.0 to 1.0)
   */
  score: number;
  /**
   * Optional custom label or description
   */
  label?: string;
  /**
   * Badge size: 'sm' (default) or 'md'
   */
  size?: "sm" | "md";
  /**
   * Feature context name (e.g. "Corner Detection", "Deskew", "Classification", "Blank Analysis")
   */
  featureName?: string;
  /**
   * Optional compact mode (abbreviated labels: Detected / Review / Manual)
   */
  compact?: boolean;
  /**
   * Optional class name override
   */
  className?: string;
  /**
   * Whether clicking or hovering opens the explanatory tooltip
   */
  interactive?: boolean;
  /**
   * Optional click handler
   */
  onClick?: () => void;
}

export type ConfidenceTier = "high" | "medium" | "low";

export interface TierInfo {
  tier: ConfidenceTier;
  label: string;
  suffix: string;
  shortSuffix: string;
  classes: string;
  dotColor: string;
  description: string;
  actionRecommendation: string;
}

export function getConfidenceTier(score: number): TierInfo {
  // Normalize score to percentage (0-100)
  const pct = score <= 1.0 && score > 0 ? Math.round(score * 100) : Math.round(score);

  if (pct >= 85) {
    return {
      tier: "high",
      label: "High Confidence",
      suffix: "Detected",
      shortSuffix: "Detected",
      classes: "bg-emerald-400/20 text-emerald-400 border-emerald-400/30",
      dotColor: "bg-emerald-400",
      description: "High statistical certainty (≥85%). Boundaries and features were clearly detected with minimal ambiguity.",
      actionRecommendation: "No manual adjustments required.",
    };
  }

  if (pct >= 60) {
    return {
      tier: "medium",
      label: "Medium Confidence",
      suffix: "Review suggested",
      shortSuffix: "Review",
      classes: "bg-amber-400/20 text-amber-400 border-amber-400/30",
      dotColor: "bg-amber-400",
      description: "Moderate certainty (60–84%). Variations in paper color, lighting, or borders were detected.",
      actionRecommendation: "Review suggested. Inspect corner points or alignment if needed.",
    };
  }

  return {
    tier: "low",
    label: "Low Confidence",
    suffix: "Manual adjustment needed",
    shortSuffix: "Manual",
    classes: "bg-red-400/20 text-red-400 border-red-400/30",
    dotColor: "bg-red-400",
    description: "Low certainty (<60%). Low contrast, skewed edges, or uneven shadowing was encountered.",
    actionRecommendation: "Manual adjustment needed. Adjust handles to align with the actual content.",
  };
}

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({
  score,
  label,
  size = "sm",
  featureName,
  compact = false,
  className = "",
  interactive = true,
  onClick,
}) => {
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Read live settings
  const settings = getAutoFeatureSettings();
  if (!settings.showConfidenceBadges) {
    return null;
  }

  const normalizedPct = score <= 1.0 && score > 0 ? Math.round(score * 100) : Math.max(0, Math.min(100, Math.round(score)));
  const tier = getConfidenceTier(normalizedPct);

  // Close tooltip on outside click
  useEffect(() => {
    if (!isTooltipOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsTooltipOpen(false);
      }
    };
    window.addEventListener("mousedown", handleOutside);
    return () => window.removeEventListener("mousedown", handleOutside);
  }, [isTooltipOpen]);

  const displaySuffix = label !== undefined ? label : compact ? tier.shortSuffix : tier.suffix;
  const sizeClasses = size === "md" ? "text-xs px-2.5 py-1 space-x-2" : "text-[10px] px-2 py-0.5 space-x-1.5";

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center select-none ${className}`}
      onMouseEnter={() => {
        if (interactive) setIsTooltipOpen(true);
      }}
      onMouseLeave={() => {
        if (interactive) setIsTooltipOpen(false);
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
          if (interactive) setIsTooltipOpen((prev) => !prev);
        }}
        aria-label={`${featureName || "Confidence"}: ${normalizedPct}% (${displaySuffix})`}
        className={`inline-flex items-center rounded-full border font-mono font-medium transition-all shadow-sm ${sizeClasses} ${tier.classes} ${
          interactive ? "cursor-pointer hover:brightness-110 active:scale-95" : ""
        }`}
      >
        {/* Colored dot on left (●) */}
        <span className={`w-1.5 h-1.5 rounded-full ${tier.dotColor} flex-shrink-0`} aria-hidden="true" />
        <span className="font-bold">{normalizedPct}%</span>
        {displaySuffix && <span className="font-sans font-normal opacity-90 truncate max-w-[140px]">{displaySuffix}</span>}
      </button>

      {/* On hover / click: tooltip explaining what the score means */}
      {interactive && isTooltipOpen && (
        <div
          role="tooltip"
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 p-2.5 rounded-xl bg-neutral-900 border border-neutral-750 shadow-2xl text-xs text-neutral-200 pointer-events-none animate-fadeIn"
        >
          <div className="flex items-center justify-between pb-1 mb-1.5 border-b border-neutral-800">
            <div className="flex items-center space-x-1.5">
              <span className={`w-2 h-2 rounded-full ${tier.dotColor}`} />
              <span className="font-semibold text-white">
                {featureName || "Auto-Detection"} ({normalizedPct}%)
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider">{tier.tier}</span>
          </div>

          <p className="text-[11px] text-neutral-300 leading-tight mb-2">{tier.description}</p>

          <div className="px-2 py-1 rounded bg-neutral-800/80 border border-neutral-700/60 text-[10px] text-neutral-300">
            <span className="font-semibold text-sky-400">Action: </span>
            {tier.actionRecommendation}
          </div>

          {/* Caret arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-neutral-750" />
        </div>
      )}
    </div>
  );
};
