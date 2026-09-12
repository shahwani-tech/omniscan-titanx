import React, { useMemo } from "react";
import { Activity, Eye, AlertCircle } from "lucide-react";

export interface OmniAdjustmentHistogramProps {
  brightness: number; // -100 to 100
  contrast: number; // -100 to 100
  gamma: number; // 0.2 to 3.0
  exposure?: number; // -100 to 100
  isComparingOriginal?: boolean;
  onToggleCompareOriginal?: (active: boolean) => void;
  className?: string;
}

export const OmniAdjustmentHistogram: React.FC<OmniAdjustmentHistogramProps> = ({
  brightness = 0,
  contrast = 0,
  gamma = 1.0,
  exposure = 0,
  isComparingOriginal = false,
  onToggleCompareOriginal,
  className = "",
}) => {
  // Generate a dynamic tonal distribution curve based on the current adjustment values
  const { pathData, shadowClipped, highlightClipped, tonalCurve } = useMemo(() => {
    const bins = 32;
    const points: number[] = [];

    // Tonal transfer function: applies brightness, contrast, gamma & exposure to a normalized [0, 1] input
    const transfer = (x: number): number => {
      // 1. Exposure & Brightness shift
      let val = x + (brightness / 200) + ((exposure || 0) / 200);

      // 2. Contrast around midtone 0.5
      const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
      val = 0.5 + (val - 0.5) * factor;

      // 3. Gamma curve power law
      val = Math.max(0, Math.min(1, val));
      val = Math.pow(val, 1 / Math.max(0.1, gamma));

      return Math.max(0, Math.min(1, val));
    };

    // Synthesize sample document luminance density (normal document with paper background and text peaks)
    for (let i = 0; i < bins; i++) {
      const normalizedIn = i / (bins - 1);
      const out = transfer(normalizedIn);

      // Base document distribution: high paper peak near 0.85, text peak near 0.15
      const textPeak = Math.exp(-Math.pow((normalizedIn - 0.2) / 0.12, 2)) * 0.45;
      const paperPeak = Math.exp(-Math.pow((normalizedIn - 0.85) / 0.1, 2)) * 0.9;
      const midDensity = 0.2 + textPeak + paperPeak;

      // Weight shifted by transfer function
      const density = midDensity * (0.8 + 0.4 * Math.sin(out * Math.PI));
      points.push(density);
    }

    // Check clipping
    const shadowClipped = transfer(0.05) <= 0.001 || brightness < -35 || contrast > 60;
    const highlightClipped = transfer(0.95) >= 0.999 || brightness > 35 || contrast > 60;

    // Build SVG path
    const width = 240;
    const height = 48;
    const stepX = width / (bins - 1);

    const maxDensity = Math.max(...points, 1);
    const coordinates = points.map((p, idx) => {
      const x = idx * stepX;
      const normalizedY = p / maxDensity;
      const y = height - normalizedY * (height - 8) - 4;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const pathData = `M 0,${height} L ${coordinates.join(" L ")} L ${width},${height} Z`;

    // Calculate curve points for mini transfer line
    const curvePoints: string[] = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const out = transfer(t);
      const x = t * width;
      const y = height - out * (height - 6) - 3;
      curvePoints.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    const tonalCurve = `M ${curvePoints.join(" L ")}`;

    return { pathData, shadowClipped, highlightClipped, tonalCurve };
  }, [brightness, contrast, gamma, exposure]);

  return (
    <div
      className={`relative p-2.5 rounded-xl bg-neutral-950/80 border border-neutral-800 shadow-inner flex flex-col space-y-1.5 select-none ${className}`}
    >
      {/* Header with Title, Status & Compare Toggle */}
      <div className="flex items-center justify-between text-[11px]">
        <div className="flex items-center space-x-1.5 text-neutral-300 font-semibold">
          <Activity className="w-3.5 h-3.5 text-sky-400" />
          <span>Tonal Curve &amp; Histogram</span>
        </div>

        <div className="flex items-center space-x-2">
          {/* Clipping Warnings */}
          {(shadowClipped || highlightClipped) && (
            <div
              className="flex items-center space-x-1 text-[10px] text-amber-400 font-medium bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-800/50"
              title="Tone clipping detected: Extreme values may reduce image shadow or highlight detail."
            >
              <AlertCircle className="w-2.5 h-2.5" />
              <span>{shadowClipped && highlightClipped ? "Clip S+H" : shadowClipped ? "Clip Shadows" : "Clip Highlights"}</span>
            </div>
          )}

          {/* Compare Original Button */}
          {onToggleCompareOriginal && (
            <button
              type="button"
              onMouseDown={() => onToggleCompareOriginal(true)}
              onMouseUp={() => onToggleCompareOriginal(false)}
              onMouseLeave={() => onToggleCompareOriginal(false)}
              onTouchStart={() => onToggleCompareOriginal(true)}
              onTouchEnd={() => onToggleCompareOriginal(false)}
              className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-medium border transition-all ${
                isComparingOriginal
                  ? "bg-sky-500 text-white border-sky-400 font-bold shadow-sm"
                  : "bg-neutral-850 hover:bg-neutral-800 text-neutral-300 border-neutral-750"
              }`}
              title="Hold down to preview original unadjusted image"
            >
              <Eye className="w-3 h-3 text-sky-400" />
              <span>{isComparingOriginal ? "Viewing Original" : "Hold: Original"}</span>
            </button>
          )}
        </div>
      </div>

      {/* SVG Canvas Histogram */}
      <div className="relative w-full h-12 bg-neutral-900/90 rounded-lg overflow-hidden border border-neutral-800/80">
        <svg
          viewBox="0 0 240 48"
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          <defs>
            <linearGradient id="histGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="curveGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="50%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
          </defs>

          {/* Subdued Grid Lines */}
          <line x1="60" y1="0" x2="60" y2="48" stroke="#333" strokeDasharray="2,2" strokeWidth="0.5" />
          <line x1="120" y1="0" x2="120" y2="48" stroke="#444" strokeDasharray="2,2" strokeWidth="0.75" />
          <line x1="180" y1="0" x2="180" y2="48" stroke="#333" strokeDasharray="2,2" strokeWidth="0.5" />
          <line x1="0" y1="24" x2="240" y2="24" stroke="#333" strokeDasharray="2,2" strokeWidth="0.5" />

          {/* Histogram Fill */}
          <path d={pathData} fill="url(#histGradient)" />

          {/* Dynamic Transfer Response Curve */}
          <path
            d={tonalCurve}
            fill="none"
            stroke="url(#curveGradient)"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>

        {/* Shadow & Highlight Threshold Markers */}
        <div className="absolute inset-x-0 bottom-0.5 px-2 flex justify-between text-[8px] font-mono text-neutral-500 pointer-events-none">
          <span>0 (Black)</span>
          <span>128 (Mid)</span>
          <span>255 (White)</span>
        </div>
      </div>
    </div>
  );
};
