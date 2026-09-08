/**
 * OMNISCAN TITAN X - Document Compare & Visual Difference Studio
 * Synchronized Side-by-Side & Difference Map Overlay
 */

import React, { useState, useRef } from "react";
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
  Upload,
  FileText,
} from "lucide-react";
import { OmniPage } from "../../types";
import { ACCEPT_ALL_SUPPORTED, analyzeFile } from "../../services/upload/FileTypeRegistry";
import { parseDocumentFile, decodeImageFile } from "../../services/upload/DocumentImportService";
import { importPDFFile, renderPdfPageOnDemand } from "../../engine/pdf";

interface DocumentCompareModalProps {
  isOpen: boolean;
  pages: OmniPage[];
  onClose: () => void;
}

interface CompareTargetPage {
  id: string;
  label: string;
  dataUrl: string;
  width: number;
  height: number;
}

export const DocumentCompareModal: React.FC<DocumentCompareModalProps> = ({
  isOpen,
  pages,
  onClose,
}) => {
  const [leftIndex, setLeftIndex] = useState(0);
  const [rightIndex, setRightIndex] = useState(Math.min(1, pages.length - 1));
  const [revisionPages, setRevisionPages] = useState<CompareTargetPage[]>([]);
  const [revisionDocName, setRevisionDocName] = useState<string | null>(null);
  const [isUploadingRevision, setIsUploadingRevision] = useState(false);
  const [useUploadedRevision, setUseUploadedRevision] = useState(false);

  const [compareMode, setCompareMode] = useState<"side-by-side" | "diff-overlay" | "split">(
    "side-by-side"
  );
  const [zoom, setZoom] = useState(1.0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || pages.length === 0) return null;

  const leftPage = pages[leftIndex] || pages[0];
  const activeRightPage: CompareTargetPage = useUploadedRevision && revisionPages.length > 0
    ? revisionPages[rightIndex] || revisionPages[0]
    : {
        id: pages[rightIndex]?.id || pages[0]?.id,
        label: `Page #${rightIndex + 1}`,
        dataUrl: pages[rightIndex]?.processedDataUrl || pages[0]?.processedDataUrl,
        width: pages[rightIndex]?.width || 1000,
        height: pages[rightIndex]?.height || 1400,
      };

  const handleUploadRevisionFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingRevision(true);
    try {
      const analysis = analyzeFile(file);
      if (analysis.category === "pdf") {
        const imported = await importPDFFile(file);
        // Pre-render any pending pages on demand for instant comparison
        const loadedPages: CompareTargetPage[] = [];
        for (const p of imported.pages) {
          let dataUrl = p.processedDataUrl;
          if (p.isPendingRender && p.pdfDocId) {
            try {
              const fullRes = await renderPdfPageOnDemand(p.pdfDocId, p.pageNumber, 200);
              dataUrl = fullRes.dataUrl;
            } catch {
              dataUrl = p.thumbnailDataUrl || p.processedDataUrl;
            }
          }
          loadedPages.push({
            id: p.id,
            label: `${file.name} - Page ${p.pageNumber}`,
            dataUrl,
            width: p.width,
            height: p.height,
          });
        }
        setRevisionPages(loadedPages);
        setRevisionDocName(file.name);
        setUseUploadedRevision(true);
        setRightIndex(0);
      } else if (analysis.category === "document") {
        const docPages = await parseDocumentFile(file);
        setRevisionPages(
          docPages.map((dp, i) => ({
            id: `rev-${i}`,
            label: `${file.name} - Page ${i + 1}`,
            dataUrl: dp.dataUrl,
            width: dp.width,
            height: dp.height,
          }))
        );
        setRevisionDocName(file.name);
        setUseUploadedRevision(true);
        setRightIndex(0);
      } else if (analysis.category === "image") {
        const decoded = await decodeImageFile(file);
        setRevisionPages([
          {
            id: "rev-img-0",
            label: file.name,
            dataUrl: decoded.dataUrl,
            width: decoded.width,
            height: decoded.height,
          },
        ]);
        setRevisionDocName(file.name);
        setUseUploadedRevision(true);
        setRightIndex(0);
      }
    } catch (err) {
      console.error("Failed to load revision file for comparison:", err);
      alert("Failed to load file for comparison.");
    } finally {
      setIsUploadingRevision(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

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
        <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-neutral-850/60 border-b border-neutral-800 text-xs gap-2">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-sky-400">Baseline (Page A):</span>
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
            <span className="font-semibold text-emerald-400">Revision (Page B):</span>
            {useUploadedRevision && revisionPages.length > 0 ? (
              <select
                value={rightIndex}
                onChange={(e) => setRightIndex(parseInt(e.target.value))}
                className="bg-neutral-800 border border-emerald-500/50 rounded px-2 py-1 text-xs text-emerald-300 focus:outline-none"
              >
                {revisionPages.map((p, i) => (
                  <option key={p.id} value={i}>
                    {p.label}
                  </option>
                ))}
              </select>
            ) : (
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
            )}

            {/* Toggle or Upload Revision Document */}
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_ALL_SUPPORTED}
              onChange={handleUploadRevisionFile}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingRevision}
              className="flex items-center space-x-1 px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-750 text-neutral-200 border border-neutral-700"
            >
              <Upload className="w-3 h-3 text-emerald-400" />
              <span>{isUploadingRevision ? "Loading..." : "Upload File"}</span>
            </button>

            {revisionPages.length > 0 && (
              <button
                onClick={() => setUseUploadedRevision(!useUploadedRevision)}
                className={`px-2 py-1 rounded text-[11px] font-medium border ${
                  useUploadedRevision
                    ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                    : "bg-neutral-800 text-neutral-400 border-neutral-700"
                }`}
              >
                {useUploadedRevision ? "Using Uploaded" : "Compare Current Doc"}
              </button>
            )}
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
                  src={leftPage.processedDataUrl || leftPage.thumbnailDataUrl}
                  alt="Left Compare"
                  style={{ transform: `scale(${zoom})` }}
                  className="max-h-[60vh] object-contain rounded shadow"
                />
              </div>

              {/* Right Page */}
              <div className="flex flex-col items-center bg-neutral-900 border border-emerald-500/40 rounded-lg p-2 shadow-lg">
                <div className="w-full text-center pb-1 text-[11px] font-mono font-bold text-emerald-400 border-b border-neutral-800 mb-2 truncate">
                  {activeRightPage.label} (REVISION)
                </div>
                <img
                  src={activeRightPage.dataUrl}
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
                  src={leftPage.processedDataUrl || leftPage.thumbnailDataUrl}
                  alt="Diff Base"
                  style={{ transform: `scale(${zoom})` }}
                  className="max-h-[65vh] object-contain"
                />
                <img
                  src={activeRightPage.dataUrl}
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
            {revisionDocName && (
              <span className="text-emerald-400 font-mono">
                • Revision: {revisionDocName} ({revisionPages.length} {revisionPages.length === 1 ? "page" : "pages"})
              </span>
            )}
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
