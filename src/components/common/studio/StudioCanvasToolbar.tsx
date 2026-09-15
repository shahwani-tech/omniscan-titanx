import React from "react";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCw,
  RotateCcw,
  Eye,
  EyeOff,
  Grid,
  Layers,
  Sparkles,
} from "lucide-react";

export interface ViewModeOption {
  id: string;
  label: string;
  shortLabel?: string;
  icon?: React.ReactNode;
}

export interface StudioCanvasToolbarProps {
  zoom: number;
  minZoom?: number;
  maxZoom?: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom?: () => void;
  onFitZoom?: () => void;
  rotation?: number;
  onRotateCW?: () => void;
  onRotateCCW?: () => void;
  showGuides?: boolean;
  onToggleGuides?: () => void;
  guidesLabel?: string;
  dimensionsInfo?: string;
  viewMode?: string;
  viewModes?: ViewModeOption[];
  onViewModeChange?: (mode: string) => void;
  flipPreviewActive?: boolean;
  onToggleFlipPreview?: () => void;
  flipPreviewLabel?: string;
  extraControls?: React.ReactNode;
  className?: string;
}

export const StudioCanvasToolbar: React.FC<StudioCanvasToolbarProps> = ({
  zoom,
  minZoom = 0.2,
  maxZoom = 5.0,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitZoom,
  rotation,
  onRotateCW,
  onRotateCCW,
  showGuides,
  onToggleGuides,
  guidesLabel = "Guides",
  dimensionsInfo,
  viewMode,
  viewModes,
  onViewModeChange,
  flipPreviewActive,
  onToggleFlipPreview,
  flipPreviewLabel = "3D Flip",
  extraControls,
  className = "",
}) => {
  const zoomPercent = Math.round(zoom * 100);

  return (
    <div
      className={`flex items-center space-x-1.5 bg-neutral-900/90 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-neutral-800 shadow-xl text-xs select-none ${className}`}
    >
      {/* Dimensions & Resolution Info */}
      {dimensionsInfo && (
        <>
          <span className="text-neutral-400 font-mono text-[11px] px-1">
            {dimensionsInfo}
          </span>
          <div className="h-3.5 w-px bg-neutral-800" />
        </>
      )}

      {/* View Mode Switcher tabs if provided */}
      {viewModes && viewModes.length > 0 && onViewModeChange && (
        <>
          <div className="flex items-center bg-neutral-950 p-0.5 rounded-lg border border-neutral-800">
            {viewModes.map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => onViewModeChange(mode.id)}
                className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  viewMode === mode.id
                    ? "bg-sky-600 text-white shadow-sm"
                    : "text-neutral-400 hover:text-white"
                }`}
                title={mode.label}
              >
                {mode.icon}
                <span>{mode.shortLabel || mode.label}</span>
              </button>
            ))}
          </div>
          <div className="h-3.5 w-px bg-neutral-800" />
        </>
      )}

      {/* Zoom Controls */}
      <div className="flex items-center space-x-1">
        <button
          type="button"
          onClick={onZoomOut}
          disabled={zoom <= minZoom}
          className="p-1 rounded hover:bg-neutral-800 text-neutral-300 hover:text-white disabled:opacity-40 transition-colors"
          title="Zoom Out (-)"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={onResetZoom}
          className="text-[11px] font-mono text-sky-400 hover:text-sky-300 px-1 py-0.5 rounded hover:bg-neutral-800 transition-colors min-w-[42px] text-center"
          title="Reset Zoom to 100%"
        >
          {zoomPercent}%
        </button>

        <button
          type="button"
          onClick={onZoomIn}
          disabled={zoom >= maxZoom}
          className="p-1 rounded hover:bg-neutral-800 text-neutral-300 hover:text-white disabled:opacity-40 transition-colors"
          title="Zoom In (+)"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        {onFitZoom && (
          <button
            type="button"
            onClick={onFitZoom}
            className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-sky-300 transition-colors"
            title="Fit to Screen (Ctrl+0)"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Rotation */}
      {(onRotateCW || onRotateCCW) && (
        <>
          <div className="h-3.5 w-px bg-neutral-800" />
          <div className="flex items-center space-x-0.5">
            {onRotateCCW && (
              <button
                type="button"
                onClick={onRotateCCW}
                className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
                title="Rotate 90° CCW (Shift+R)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
            {onRotateCW && (
              <button
                type="button"
                onClick={onRotateCW}
                className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
                title="Rotate 90° CW (R)"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </>
      )}

      {/* Guides Toggle */}
      {onToggleGuides && (
        <>
          <div className="h-3.5 w-px bg-neutral-800" />
          <button
            type="button"
            onClick={onToggleGuides}
            className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
              showGuides
                ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                : "text-neutral-400 hover:text-white hover:bg-neutral-800 border border-transparent"
            }`}
            title={`Toggle ${guidesLabel}`}
          >
            {showGuides ? <Eye className="w-3.5 h-3.5 text-sky-400" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>{guidesLabel}</span>
          </button>
        </>
      )}

      {/* 3D Duplex Flip Preview */}
      {onToggleFlipPreview && (
        <>
          <div className="h-3.5 w-px bg-neutral-800" />
          <button
            type="button"
            onClick={onToggleFlipPreview}
            className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
              flipPreviewActive
                ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40"
                : "text-neutral-400 hover:text-white hover:bg-neutral-800 border border-transparent"
            }`}
            title="Inspect 3D Duplex Flip Verification"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>{flipPreviewLabel}</span>
          </button>
        </>
      )}

      {/* Extra custom controls */}
      {extraControls && (
        <>
          <div className="h-3.5 w-px bg-neutral-800" />
          {extraControls}
        </>
      )}
    </div>
  );
};
