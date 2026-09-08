/**
 * OMNISCAN TITAN X - Foreground Subject Controls
 * Independent adjustments for the isolated person / subject cutout (Scale, Move, Rotate, Flip, Opacity)
 */

import React from "react";
import { ForegroundTransform } from "../../engine/background/types";
import {
  User,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  Sliders,
} from "lucide-react";

interface ForegroundSubjectControlsProps {
  transform: ForegroundTransform;
  onChange: (updated: ForegroundTransform) => void;
  onReset: () => void;
  hasTransparentSubject: boolean;
}

export const ForegroundSubjectControls: React.FC<ForegroundSubjectControlsProps> = ({
  transform,
  onChange,
  onReset,
  hasTransparentSubject,
}) => {
  const toggleFlipH = () => {
    onChange({
      ...transform,
      scaleX: (transform.scaleX || 1) * -1,
    });
  };

  const toggleFlipV = () => {
    onChange({
      ...transform,
      scaleY: (transform.scaleY || 1) * -1,
    });
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5 space-y-3 text-xs text-neutral-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <User className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-white uppercase tracking-wider text-[11px]">
            Foreground Subject Layer (Layer 3)
          </span>
        </div>
        <button
          onClick={onReset}
          className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800"
          title="Reset subject transform"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {!hasTransparentSubject && (
        <div className="bg-amber-950/30 border border-amber-500/30 rounded-lg p-2 text-[11px] text-amber-300">
          Tip: Run Background Removal to isolate the subject for independent positioning and layering.
        </div>
      )}

      {/* Scale & Zoom */}
      <div className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-neutral-400 uppercase">
            Subject Scale / Zoom
          </span>
          <div className="flex items-center space-x-1">
            <input
              type="number"
              min="20"
              max="300"
              step="1"
              value={Math.round((transform.scale || 1) * 100)}
              onChange={(e) =>
                onChange({ ...transform, scale: Math.max(0.1, Number(e.target.value) / 100) })
              }
              className="w-14 bg-neutral-900 border border-neutral-750 rounded px-1.5 py-0.5 text-right font-mono text-emerald-400 text-[11px] outline-none"
            />
            <span className="text-[10px] text-neutral-500 font-mono">%</span>
          </div>
        </div>
        <input
          type="range"
          min="0.5"
          max="2"
          step="0.01"
          value={transform.scale || 1}
          onChange={(e) => onChange({ ...transform, scale: Number(e.target.value) })}
          className="w-full accent-emerald-500 cursor-pointer"
        />

        {/* Pan X & Y */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-neutral-850">
          <div>
            <div className="flex items-center justify-between text-[10px] text-neutral-400 mb-1">
              <span>Nudge X</span>
              <div className="flex items-center space-x-0.5">
                <input
                  type="number"
                  min="-300"
                  max="300"
                  step="1"
                  value={Math.round(transform.x)}
                  onChange={(e) => onChange({ ...transform, x: Number(e.target.value) })}
                  className="w-12 bg-neutral-900 border border-neutral-750 rounded px-1 py-0.2 text-right font-mono text-neutral-300 text-[10px] outline-none"
                />
                <span className="text-[9px] text-neutral-500">px</span>
              </div>
            </div>
            <input
              type="range"
              min="-150"
              max="150"
              value={transform.x}
              onChange={(e) => onChange({ ...transform, x: Number(e.target.value) })}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>
          <div>
            <div className="flex items-center justify-between text-[10px] text-neutral-400 mb-1">
              <span>Nudge Y</span>
              <div className="flex items-center space-x-0.5">
                <input
                  type="number"
                  min="-300"
                  max="300"
                  step="1"
                  value={Math.round(transform.y)}
                  onChange={(e) => onChange({ ...transform, y: Number(e.target.value) })}
                  className="w-12 bg-neutral-900 border border-neutral-750 rounded px-1 py-0.2 text-right font-mono text-neutral-300 text-[10px] outline-none"
                />
                <span className="text-[9px] text-neutral-500">px</span>
              </div>
            </div>
            <input
              type="range"
              min="-150"
              max="150"
              value={transform.y}
              onChange={(e) => onChange({ ...transform, y: Number(e.target.value) })}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Quick Center / Zero */}
        <div className="flex items-center space-x-1.5 pt-0.5">
          <button
            onClick={() => onChange({ ...transform, x: 0, y: 0 })}
            className="flex-1 py-0.5 rounded bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-neutral-400 hover:text-white text-[10px] transition-colors"
            title="Center Subject"
          >
            Center (0, 0)
          </button>
          <button
            onClick={() => onChange({ ...transform, rotation: 0 })}
            className="flex-1 py-0.5 rounded bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-neutral-400 hover:text-white text-[10px] transition-colors"
            title="Zero Angle"
          >
            0° Angle
          </button>
        </div>

        {/* Rotation */}
        <div className="pt-1 border-t border-neutral-850">
          <div className="flex items-center justify-between text-[10px] text-neutral-400 mb-1">
            <span>Subject Rotation</span>
            <div className="flex items-center space-x-0.5">
              <input
                type="number"
                min="-180"
                max="180"
                step="1"
                value={Math.round(transform.rotation)}
                onChange={(e) => onChange({ ...transform, rotation: Number(e.target.value) })}
                className="w-12 bg-neutral-900 border border-neutral-750 rounded px-1 py-0.2 text-right font-mono text-emerald-400 text-[10px] outline-none"
              />
              <span className="text-[9px] text-neutral-500">°</span>
            </div>
          </div>
          <input
            type="range"
            min="-45"
            max="45"
            value={transform.rotation}
            onChange={(e) => onChange({ ...transform, rotation: Number(e.target.value) })}
            className="w-full accent-emerald-500 cursor-pointer"
          />
        </div>

        {/* Opacity */}
        <div className="pt-1 border-t border-neutral-850">
          <div className="flex items-center justify-between text-[10px] text-neutral-400 mb-1">
            <span>Subject Opacity</span>
            <div className="flex items-center space-x-0.5">
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={Math.round((transform.opacity ?? 1) * 100)}
                onChange={(e) =>
                  onChange({
                    ...transform,
                    opacity: Math.max(0, Math.min(100, Number(e.target.value))) / 100,
                  })
                }
                className="w-12 bg-neutral-900 border border-neutral-750 rounded px-1 py-0.2 text-right font-mono text-emerald-400 text-[10px] outline-none"
              />
              <span className="text-[9px] text-neutral-500">%</span>
            </div>
          </div>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.01"
            value={transform.opacity ?? 1}
            onChange={(e) => onChange({ ...transform, opacity: Number(e.target.value) })}
            className="w-full accent-emerald-500 cursor-pointer"
          />
        </div>

        {/* Flips (Mirror H & Mirror V) */}
        <div className="flex items-center space-x-2 pt-1 border-t border-neutral-850">
          <button
            onClick={toggleFlipH}
            className={`flex-1 py-1 px-2 rounded border flex items-center justify-center space-x-1.5 transition-colors ${
              transform.scaleX === -1
                ? "bg-emerald-950/60 border-emerald-500 text-emerald-300 font-bold"
                : "bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-white"
            }`}
          >
            <FlipHorizontal className="w-3.5 h-3.5" />
            <span>Mirror Person</span>
          </button>

          <button
            onClick={toggleFlipV}
            className={`flex-1 py-1 px-2 rounded border flex items-center justify-center space-x-1.5 transition-colors ${
              transform.scaleY === -1
                ? "bg-emerald-950/60 border-emerald-500 text-emerald-300 font-bold"
                : "bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-white"
            }`}
          >
            <FlipVertical className="w-3.5 h-3.5" />
            <span>Flip Person</span>
          </button>
        </div>
      </div>
    </div>
  );
};
