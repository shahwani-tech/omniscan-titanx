import React, { useState, useEffect, useRef } from "react";

export interface PdfFilterNumericInputProps {
  id: string;
  value: number;
  min: number;
  max: number;
  step: number;
  precision?: number;
  unit?: string;
  onChange: (val: number, isCommit: boolean) => void;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
}

function formatDisplayValue(val: number, precision: number): string {
  if (isNaN(val) || !isFinite(val)) return "0";
  return precision > 0 ? val.toFixed(precision) : String(Math.round(val));
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

export const PdfFilterNumericInput: React.FC<PdfFilterNumericInputProps> = ({
  id,
  value,
  min,
  max,
  step,
  precision = 0,
  unit,
  onChange,
  ariaLabel,
  className = "w-13",
  disabled = false,
}) => {
  const [text, setText] = useState<string>(() => formatDisplayValue(value, precision));
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastCommittedValueRef = useRef<number>(value);

  // Synchronize with external value changes (sliders, presets, resets) when not actively typing
  useEffect(() => {
    lastCommittedValueRef.current = value;
    if (!isFocused) {
      setText(formatDisplayValue(value, precision));
    } else {
      const parsed = parseFloat(text);
      if (isNaN(parsed) || parsed !== value) {
        setText(formatDisplayValue(value, precision));
      }
    }
  }, [value, precision, isFocused]);

  // Handle typing inside numeric input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value;
    setText(newText);

    // Allow intermediate typing states like "-", ".", "-." without committing NaN or resetting
    const trimmed = newText.trim();
    if (
      trimmed === "" ||
      trimmed === "-" ||
      trimmed === "+" ||
      trimmed === "." ||
      trimmed === "-." ||
      trimmed === "+."
    ) {
      return;
    }

    const parsed = parseFloat(newText);
    if (!isNaN(parsed) && isFinite(parsed)) {
      // If within min/max bounds, trigger immediate live preview feedback
      if (parsed >= min && parsed <= max) {
        const rounded = precision > 0 ? Number(parsed.toFixed(precision)) : Math.round(parsed);
        onChange(rounded, false);
      }
    }
  };

  // Commit value on blur or Enter
  const commitValue = (valToCommit?: number) => {
    let finalVal: number;
    if (typeof valToCommit === "number") {
      finalVal = clamp(valToCommit, min, max);
    } else {
      const parsed = parseFloat(text);
      if (isNaN(parsed) || !isFinite(parsed)) {
        finalVal = lastCommittedValueRef.current;
      } else {
        finalVal = clamp(parsed, min, max);
      }
    }

    if (precision > 0) {
      finalVal = Number(finalVal.toFixed(precision));
    } else {
      finalVal = Math.round(finalVal);
    }

    lastCommittedValueRef.current = finalVal;
    setText(formatDisplayValue(finalVal, precision));
    onChange(finalVal, true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    commitValue();
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  // Keyboard navigation & controls
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Stop event bubbling to canvas / parent containers to prevent triggering pan, zoom, crop, or modal shortcuts
    e.stopPropagation();

    if (e.key === "Enter") {
      e.preventDefault();
      commitValue();
      inputRef.current?.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      // Restore previous valid value
      setText(formatDisplayValue(lastCommittedValueRef.current, precision));
      onChange(lastCommittedValueRef.current, true);
      inputRef.current?.blur();
    } else if (e.key === "Home") {
      e.preventDefault();
      setText(formatDisplayValue(min, precision));
      commitValue(min);
    } else if (e.key === "End") {
      e.preventDefault();
      setText(formatDisplayValue(max, precision));
      commitValue(max);
    } else if (e.key === "PageUp") {
      e.preventDefault();
      const current = isNaN(parseFloat(text)) ? value : parseFloat(text);
      const delta = step * 10;
      const nextVal = clamp(
        precision > 0 ? Number((current + delta).toFixed(precision)) : Math.round(current + delta),
        min,
        max
      );
      setText(formatDisplayValue(nextVal, precision));
      commitValue(nextVal);
    } else if (e.key === "PageDown") {
      e.preventDefault();
      const current = isNaN(parseFloat(text)) ? value : parseFloat(text);
      const delta = step * 10;
      const nextVal = clamp(
        precision > 0 ? Number((current - delta).toFixed(precision)) : Math.round(current - delta),
        min,
        max
      );
      setText(formatDisplayValue(nextVal, precision));
      commitValue(nextVal);
    } else if (e.key === "ArrowUp" || e.key === "ArrowRight") {
      e.preventDefault();
      const current = isNaN(parseFloat(text)) ? value : parseFloat(text);
      const delta = e.altKey ? step * 0.1 : e.shiftKey ? step * 5 : step;
      const nextVal = clamp(
        precision > 0 ? Number((current + delta).toFixed(precision)) : Math.round(current + delta),
        min,
        max
      );
      setText(formatDisplayValue(nextVal, precision));
      commitValue(nextVal);
    } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
      e.preventDefault();
      const current = isNaN(parseFloat(text)) ? value : parseFloat(text);
      const delta = e.altKey ? step * 0.1 : e.shiftKey ? step * 5 : step;
      const nextVal = clamp(
        precision > 0 ? Number((current - delta).toFixed(precision)) : Math.round(current - delta),
        min,
        max
      );
      setText(formatDisplayValue(nextVal, precision));
      commitValue(nextVal);
    }
  };

  const wheelTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (wheelTimerRef.current) {
        window.clearTimeout(wheelTimerRef.current);
      }
    };
  }, []);

  // Context-aware mouse wheel handler: adjusts numeric value by step, prevents page scrolling
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;

    const direction = e.deltaY < 0 || (e.deltaY === 0 && e.deltaX > 0) ? 1 : -1;
    const current = isNaN(parseFloat(text)) ? value : parseFloat(text);
    const delta = e.shiftKey ? step * 5 : step;
    const nextVal = clamp(
      precision > 0 ? Number((current + direction * delta).toFixed(precision)) : Math.round(current + direction * delta),
      min,
      max
    );

    setText(formatDisplayValue(nextVal, precision));
    lastCommittedValueRef.current = nextVal;

    // Fast live update for immediate visual feedback
    onChange(nextVal, false);

    // Debounced settle for full commit
    if (wheelTimerRef.current) {
      window.clearTimeout(wheelTimerRef.current);
    }
    wheelTimerRef.current = window.setTimeout(() => {
      wheelTimerRef.current = null;
      onChange(nextVal, true);
    }, 160);
  };

  return (
    <div
      className="flex items-center space-x-1 shrink-0 select-none"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onWheel={handleWheel}
      data-prevent-zoom="true"
    >
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        value={text}
        disabled={disabled}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onWheel={handleWheel}
        className={`${className} h-6 px-1.5 py-0.5 text-right font-mono text-[11px] tabular-nums bg-neutral-950 border border-neutral-700/80 hover:border-neutral-600 focus:border-sky-500 rounded text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-sky-500/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
      />
      {unit && (
        <span className="text-[11px] text-neutral-400 font-mono select-none pl-0.5">
          {unit}
        </span>
      )}
    </div>
  );
};
