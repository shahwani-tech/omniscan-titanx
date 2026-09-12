import React, { useState, useEffect, useRef, useId } from "react";
import { RotateCcw, HelpCircle } from "lucide-react";

export type SliderAccentColor = "sky" | "amber" | "purple" | "emerald" | "teal" | "indigo";

export interface OmniAdjustmentSliderProps {
  id?: string;
  label: string;
  icon: React.ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  defaultValue?: number;
  unit?: string;
  precision?: number;
  tooltip?: string;
  accentColor?: SliderAccentColor;
  bipolar?: boolean; // If true, fill originates from center zero (e.g. -100 to 100)
  onChange: (value: number, isCommit: boolean) => void;
  onReset?: () => void;
  disabled?: boolean;
}

const ACCENT_STYLES: Record<
  SliderAccentColor,
  {
    fill: string;
    thumb: string;
    border: string;
    badgeHover: string;
    text: string;
  }
> = {
  sky: {
    fill: "from-sky-500 to-blue-500",
    thumb: "border-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.5)]",
    border: "border-sky-500/40",
    badgeHover: "hover:border-sky-500/60 hover:text-sky-300",
    text: "text-sky-400",
  },
  amber: {
    fill: "from-amber-500 to-yellow-500",
    thumb: "border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]",
    border: "border-amber-500/40",
    badgeHover: "hover:border-amber-500/60 hover:text-amber-300",
    text: "text-amber-400",
  },
  purple: {
    fill: "from-purple-500 to-fuchsia-500",
    thumb: "border-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.5)]",
    border: "border-purple-500/40",
    badgeHover: "hover:border-purple-500/60 hover:text-purple-300",
    text: "text-purple-400",
  },
  emerald: {
    fill: "from-emerald-500 to-teal-500",
    thumb: "border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]",
    border: "border-emerald-500/40",
    badgeHover: "hover:border-emerald-500/60 hover:text-emerald-300",
    text: "text-emerald-400",
  },
  teal: {
    fill: "from-teal-500 to-cyan-500",
    thumb: "border-teal-400 shadow-[0_0_8px_rgba(20,184,166,0.5)]",
    border: "border-teal-500/40",
    badgeHover: "hover:border-teal-500/60 hover:text-teal-300",
    text: "text-teal-400",
  },
  indigo: {
    fill: "from-indigo-500 to-violet-500",
    thumb: "border-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.5)]",
    border: "border-indigo-500/40",
    badgeHover: "hover:border-indigo-500/60 hover:text-indigo-300",
    text: "text-indigo-400",
  },
};

function formatValue(val: number, precision: number): string {
  if (isNaN(val) || !isFinite(val)) return "0";
  return precision > 0 ? val.toFixed(precision) : String(Math.round(val));
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

export const OmniAdjustmentSlider: React.FC<OmniAdjustmentSliderProps> = ({
  id,
  label,
  icon,
  value,
  min,
  max,
  step = 1,
  defaultValue = 0,
  unit = "",
  precision = 0,
  tooltip,
  accentColor = "sky",
  bipolar = min < 0 && max > 0,
  onChange,
  onReset,
  disabled = false,
}) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  const isDraggingRef = useRef(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isEditingBadge, setIsEditingBadge] = useState(false);
  const [badgeText, setBadgeText] = useState(() => formatValue(value, precision));
  const badgeInputRef = useRef<HTMLInputElement>(null);

  const style = ACCENT_STYLES[accentColor] || ACCENT_STYLES.sky;
  const isModified = Math.abs(value - defaultValue) > (precision > 0 ? 0.001 : 0.01);

  // Sync badge text with external value changes when not actively typing
  useEffect(() => {
    if (!isEditingBadge) {
      setBadgeText(formatValue(value, precision));
    }
  }, [value, precision, isEditingBadge]);

  // Focus and select input text when entering direct edit mode
  useEffect(() => {
    if (isEditingBadge && badgeInputRef.current) {
      badgeInputRef.current.focus();
      badgeInputRef.current.select();
    }
  }, [isEditingBadge]);

  // Calculate percentage for progress fill and thumb position
  const safeRange = max - min || 1;
  const clampedVal = clamp(value, min, max);
  const percent = Math.min(100, Math.max(0, ((clampedVal - min) / safeRange) * 100));

  // Center percentage for bipolar sliders
  const zeroPercent = bipolar ? Math.min(100, Math.max(0, ((0 - min) / safeRange) * 100)) : 0;

  // Track progress fill style
  let fillLeft = "0%";
  let fillWidth = "0%";

  if (bipolar) {
    if (clampedVal >= 0) {
      fillLeft = `${zeroPercent}%`;
      fillWidth = `${Math.max(0, percent - zeroPercent)}%`;
    } else {
      fillLeft = `${percent}%`;
      fillWidth = `${Math.max(0, zeroPercent - percent)}%`;
    }
  } else {
    fillLeft = "0%";
    fillWidth = `${percent}%`;
  }

  // Pointer drag event handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLInputElement>) => {
    e.stopPropagation();
    isDraggingRef.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      const parsed = parseFloat(e.currentTarget.value);
      onChange(isNaN(parsed) ? defaultValue : clamp(parsed, min, max), true);
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const parsed = parseFloat(e.target.value);
    if (!isNaN(parsed)) {
      const rounded = precision > 0 ? Number(parsed.toFixed(precision)) : Math.round(parsed);
      onChange(clamp(rounded, min, max), false);
    }
  };

  // Keyboard navigation on focused slider:
  // Regular arrow: 1 step; Shift+arrow: 5x or 10x step
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    const isShift = e.shiftKey;
    const stepMultiplier = isShift ? (precision > 0 ? 5 : 10) : 1;
    const effectiveStep = step * stepMultiplier;

    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      const nextVal = clamp(Number((value - effectiveStep).toFixed(precision)), min, max);
      onChange(nextVal, true);
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      const nextVal = clamp(Number((value + effectiveStep).toFixed(precision)), min, max);
      onChange(nextVal, true);
    } else if (e.key === "Home") {
      e.preventDefault();
      onChange(min, true);
    } else if (e.key === "End") {
      e.preventDefault();
      onChange(max, true);
    }
  };

  // Handle single control reset
  const handleResetClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onReset) {
      onReset();
    } else {
      onChange(defaultValue, true);
    }
  };

  // Direct badge typing commit
  const commitBadgeInput = () => {
    setIsEditingBadge(false);
    const parsed = parseFloat(badgeText);
    if (isNaN(parsed) || !isFinite(parsed)) {
      setBadgeText(formatValue(value, precision));
      return;
    }
    const finalVal = clamp(
      precision > 0 ? Number(parsed.toFixed(precision)) : Math.round(parsed),
      min,
      max
    );
    setBadgeText(formatValue(finalVal, precision));
    onChange(finalVal, true);
  };

  const handleBadgeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitBadgeInput();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsEditingBadge(false);
      setBadgeText(formatValue(value, precision));
    }
  };

  return (
    <div
      className={`group relative flex flex-col space-y-1.5 p-2 rounded-lg transition-all duration-150 border ${
        isHovered
          ? "bg-neutral-850/80 border-neutral-750/70 shadow-sm"
          : "bg-neutral-900/40 border-transparent"
      } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Header: Icon, Label, Reset Button, and Value Badge */}
      <div className="flex items-center justify-between text-xs select-none">
        <div className="flex items-center space-x-1.5 min-w-0 pr-2">
          <span className={`shrink-0 ${style.text}`}>{icon}</span>
          <label
            htmlFor={inputId}
            className="font-medium text-neutral-300 truncate cursor-pointer hover:text-white transition-colors"
            title={tooltip || label}
          >
            {label}
          </label>
          {tooltip && (
            <span
              className="text-neutral-500 hover:text-neutral-300 cursor-help transition-colors"
              title={tooltip}
            >
              <HelpCircle className="w-2.5 h-2.5 opacity-60 hover:opacity-100" />
            </span>
          )}
        </div>

        <div className="flex items-center space-x-1.5 shrink-0">
          {/* Subtle Reset Icon: Only highlighted if modified */}
          {isModified && (
            <button
              type="button"
              onClick={handleResetClick}
              className="flex items-center space-x-1 text-[10px] font-mono text-neutral-400 hover:text-sky-300 px-1.5 py-0.5 rounded hover:bg-neutral-800 transition-colors"
              title={`Reset ${label} to ${formatValue(defaultValue, precision)}${unit}`}
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span className="hidden sm:inline">reset</span>
            </button>
          )}

          {/* Editable Numeric Value Badge */}
          {isEditingBadge ? (
            <input
              ref={badgeInputRef}
              type="text"
              value={badgeText}
              onChange={(e) => setBadgeText(e.target.value)}
              onBlur={commitBadgeInput}
              onKeyDown={handleBadgeKeyDown}
              className="w-14 px-1.5 py-0.5 rounded bg-neutral-950 border border-sky-500 text-white font-mono text-[11px] font-semibold text-right outline-none shadow-[0_0_8px_rgba(56,189,248,0.3)]"
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingBadge(true)}
              className={`px-2 py-0.5 rounded bg-neutral-800/90 text-neutral-200 font-mono text-[11px] font-semibold border border-neutral-700/60 transition-all cursor-text flex items-center justify-end min-w-[46px] ${style.badgeHover}`}
              title="Click to enter exact number. Press Enter to confirm, Esc to revert."
            >
              <span>{bipolar && value > 0 ? `+${badgeText}` : badgeText}</span>
              {unit && <span className="ml-0.5 text-neutral-400 text-[10px]">{unit}</span>}
            </button>
          )}
        </div>
      </div>

      {/* Custom Slider Track with Filled Progress Indicator & Thumb */}
      <div className="relative h-6 flex items-center">
        {/* Visual Background Track */}
        <div className="w-full h-1.5 bg-neutral-800 rounded-full relative overflow-hidden border border-neutral-750/60 shadow-inner">
          {/* Bipolar center notch marker */}
          {bipolar && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-neutral-600/80 -translate-x-1/2 z-10"
              style={{ left: `${zeroPercent}%` }}
              title="Zero Neutral Position"
            />
          )}

          {/* Filled Progress Bar */}
          <div
            className={`absolute top-0 bottom-0 bg-gradient-to-r ${style.fill} transition-all duration-75 rounded-full`}
            style={{
              left: fillLeft,
              width: fillWidth,
            }}
          />
        </div>

        {/* Visual Custom Thumb indicator tracking position */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-neutral-100 border-2 ${style.thumb} pointer-events-none transition-transform duration-75 group-hover:scale-110`}
          style={{ left: `${percent}%` }}
        />

        {/* Invisible native range input for zero-latency pointer, keyboard, and touch interactions */}
        <input
          id={inputId}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleSliderChange}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onKeyDown={handleKeyDown}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20 touch-none"
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
        />
      </div>
    </div>
  );
};
