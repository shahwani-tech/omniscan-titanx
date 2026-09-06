/**
 * OMNISCAN TITAN X - Document Compare & Visual Difference Studio
 * Synchronized Side-by-Side & Difference Map Overlay
 */

import React, { useState } from "react";
import {
  SplitSquareVertical,
  X,
  Columns,
  Eye,
  CheckCircle2,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  RefreshCw,
} from "lucide-react";
import { OmniPage } from "../../types";

interface DocumentCompareModalProps {
  isOpen: boolean;
  pages: OmniPage[];
  onClose: () => void;
}

export const DocumentCompareModal: React.FC<DocumentCompareModalProps> = ({
  isOpen,
  pages,
  onClose,
}) => {
  const [leftIndex, setLeftIndex] = useState(0);
  const [rightIndex, setRightIndex] = useState(Math.min(1, pages.length - 1));
  const [compareMode, setCompareMode] = useState<"side-by-side" | "diff-overlay" | "split">(
    "side-by-side"
  );
  const [zoom, setZoom] = useState(1.0);
  const [splitPos, setSplitPos] = useState(0.5);

  if (!isOpen || pages.length === 0) return null;

  const leftPage = pages[leftIndex] || pages[0];
  const rightPage = pages[rightIndex] || pages[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 select-none">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-neutral-200 text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-neutral-850 border-b border-neutral-800">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded bg-emerald-600 flex items-center justify-center">
              <SplitSquareVertical className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-white">Document Comparison &amp; Diff Studio</h2>
              <p className="text-[11px] text-neutral-400">
                Visual pixel diffing, structural alignment &amp; revision delta detection
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Mode selector */}
            <div className="flex items-center bg-neutral-800 rounded p-0.5 border border-neutral-700">
              <button
                onClick={() => setCompareMode("side-by-side")}
                className={`px-2 py-1 rounded text-[11px] font-medium ${
                  compareMode === "side-by-side" ? "bg-emerald-600 text-white" : "text-neutral-400 hover:text-white"
                }`}
              >
                Side-by-Side
              </button>
              <button
                onClick={() => setCompareMode("diff-overlay")}
                className={`px-2 py-1 rounded text-[11px] font-medium ${
                  compareMode === "diff-overlay" ? "bg-emerald-600 text-white" : "text-neutral-400 hover:text-white"
                }`}
              >
                Difference Diff
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-neutral-750 text-neutral-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Top Control Bar: Select Left vs Right Document */}
        <div className="flex items-center justify-between px-4 py-2 bg-neutral-850/60 border-b border-neutral-800 text-xs">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-sky-400">Primary (Page A):</span>
            <select
              value={leftIndex}
              onChange={(e) => setLeftIndex(parseInt(e.target.value))}
              className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200 focus:outline-none"
            >
              {pages.map((p, i) => (
                <option key={p.id} value={i}>
                  Page #{i + 1} ({p.width}×{p.height})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="font-semibold text-emerald-400">Comparison (Page B):</span>
            <select
              value={rightIndex}
              onChange={(e) => setRightIndex(parseInt(e.target.value))}
              className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200 focus:outline-none"
            >
              {pages.map((p, i) => (
                <option key={p.id} value={i}>
                  Page #{i + 1} ({p.width}×{p.height})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-1.5 bg-neutral-800 px-2 py-0.5 rounded border border-neutral-700">
            <button
              onClick={() => setZoom(Math.max(0.2, zoom - 0.1))}
              className="p-0.5 text-neutral-400 hover:text-white"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-neutral-300 w-10 text-center font-bold">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(Math.min(3.0, zoom + 0.1))}
              className="p-0.5 text-neutral-400 hover:text-white"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Comparison Canvas Area */}
        <div className="flex-1 bg-neutral-950 p-4 overflow-auto flex items-center justify-center">
          {compareMode === "side-by-side" ? (
            <div className="grid grid-cols-2 gap-4 max-w-4xl w-full">
              {/* Left Page */}
              <div className="flex flex-col items-center bg-neutral-900 border border-sky-500/40 rounded-lg p-2 shadow-lg">
                <div className="w-full text-center pb-1 text-[11px] font-mono font-bold text-sky-400 border-b border-neutral-800 mb-2">
                  PAGE #{leftIndex + 1} (BASELINE)
                </div>
                <img
                  src={leftPage.processedDataUrl}
                  alt="Left Compare"
                  style={{ transform: `scale(${zoom})` }}
                  className="max-h-[60vh] object-contain rounded shadow"
                />
              </div>

              {/* Right Page */}
              <div className="flex flex-col items-center bg-neutral-900 border border-emerald-500/40 rounded-lg p-2 shadow-lg">
                <div className="w-full text-center pb-1 text-[11px] font-mono font-bold text-emerald-400 border-b border-neutral-800 mb-2">
                  PAGE #{rightIndex + 1} (REVISION)
                </div>
                <img
                  src={rightPage.processedDataUrl}
                  alt="Right Compare"
                  style={{ transform: `scale(${zoom})` }}
                  className="max-h-[60vh] object-contain rounded shadow"
                />
              </div>
            </div>
          ) : (
            /* Difference Overlay Mode */
            <div className="relative shadow-2xl rounded-lg bg-neutral-900 border border-neutral-800 p-2">
              <div className="relative max-h-[65vh]">
                <img
                  src={leftPage.processedDataUrl}
                  alt="Diff Base"
                  style={{ transform: `scale(${zoom})` }}
                  className="max-h-[65vh] object-contain"
                />
                <img
                  src={rightPage.processedDataUrl}
                  alt="Diff Alt"
                  style={{
                    transform: `scale(${zoom})`,
                    mixBlendMode: "difference",
                    filter: "contrast(200%) invert(100%)",
                  }}
                  className="absolute inset-0 max-h-[65vh] object-contain opacity-75 pointer-events-none"
                />
              </div>
              <div className="text-center pt-2 font-mono text-[10px] text-emerald-400 font-bold">
                ★ PIXEL DIFFERENCE DELTA LAYER ACTIVE ★
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-neutral-850 border-t border-neutral-800 flex items-center justify-between">
          <div className="text-neutral-400 text-[11px] flex items-center space-x-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Synchronized Zoom &amp; Pan Geometry</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-neutral-800 hover:bg-neutral-750 text-neutral-300 font-medium"
          >
            Close Comparison Studio
          </button>
        </div>
      </div>
    </div>
  );
};
