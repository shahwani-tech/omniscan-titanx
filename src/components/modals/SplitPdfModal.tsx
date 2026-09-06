/**
 * OMNISCAN TITAN X - PDF Split & Page Extraction Studio Modal
 */

import React, { useState } from "react";
import { Scissors, Download, FileText, CheckCircle2, AlertCircle, X } from "lucide-react";
import JSZip from "jszip";
import { OmniDocument } from "../../types";
import { splitDocumentToPDFs } from "../../engine/pdf";

interface SplitPdfModalProps {
  isOpen: boolean;
  document: OmniDocument;
  onClose: () => void;
}

export const SplitPdfModal: React.FC<SplitPdfModalProps> = ({
  isOpen,
  document,
  onClose,
}) => {
  const [splitMode, setSplitMode] = useState<"all-single" | "custom-ranges">("all-single");
  const [customRangeText, setCustomRangeText] = useState("1-2, 3-4");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");

  if (!isOpen) return null;

  const totalPages = document.pages.length;

  const handleExecuteSplit = async () => {
    setIsProcessing(true);
    setProgressMsg("Splitting document pages...");

    try {
      let splits: { fileName: string; pdfBytes: Uint8Array }[] = [];

      if (splitMode === "all-single") {
        splits = await splitDocumentToPDFs(document, "all-single");
      } else {
        // Parse custom ranges (e.g. "1-3, 4, 5-8")
        const ranges: { start: number; end: number; name: string }[] = [];
        const parts = customRangeText.split(",").map((p) => p.trim()).filter(Boolean);

        for (const part of parts) {
          if (part.includes("-")) {
            const [sStr, eStr] = part.split("-").map((x) => parseInt(x.trim(), 10));
            if (!isNaN(sStr) && !isNaN(eStr)) {
              ranges.push({
                start: Math.min(sStr, eStr),
                end: Math.max(sStr, eStr),
                name: `Pages_${sStr}-${eStr}`,
              });
            }
          } else {
            const pNum = parseInt(part, 10);
            if (!isNaN(pNum)) {
              ranges.push({
                start: pNum,
                end: pNum,
                name: `Page_${pNum}`,
              });
            }
          }
        }

        if (ranges.length === 0) {
          throw new Error("Please specify at least one valid page range (e.g. 1-3, 4-6)");
        }

        splits = await splitDocumentToPDFs(document, "range", ranges);
      }

      if (splits.length === 1) {
        // Single file download
        const blob = new Blob([splits[0].pdfBytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = window.document.createElement("a");
        a.href = url;
        a.download = splits[0].fileName;
        a.click();
        URL.revokeObjectURL(url);
      } else if (splits.length > 1) {
        // Package into ZIP
        setProgressMsg("Compressing split PDFs into ZIP package...");
        const zip = new JSZip();
        for (const s of splits) {
          zip.file(s.fileName, s.pdfBytes);
        }
        const zipBlob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(zipBlob);
        const a = window.document.createElement("a");
        a.href = url;
        a.download = `${document.name.replace(/\.[^/.]+$/, "")}_SPLIT_PACKAGE.zip`;
        a.click();
        URL.revokeObjectURL(url);
      }

      onClose();
    } catch (err: any) {
      alert("Split operation failed: " + (err?.message || String(err)));
    } finally {
      setIsProcessing(false);
      setProgressMsg("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-none">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden text-neutral-200 text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-neutral-850 border-b border-neutral-800">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/30">
              <Scissors className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-white">Split PDF Document</h2>
              <p className="text-[11px] text-neutral-400">
                Extract single pages or custom page ranges into individual PDF files
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-neutral-750 text-neutral-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 space-y-4">
          {/* Document summary */}
          <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <FileText className="w-4 h-4 text-sky-400" />
              <div>
                <div className="font-medium text-white">{document.name}</div>
                <div className="text-[11px] text-neutral-400">{totalPages} total pages</div>
              </div>
            </div>
          </div>

          {/* Mode Selection */}
          <div className="space-y-2">
            <label className="block text-[11px] font-medium uppercase tracking-wider text-neutral-400">
              Split Mode
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSplitMode("all-single")}
                className={`p-3 rounded-lg border text-left transition-all ${
                  splitMode === "all-single"
                    ? "border-sky-500 bg-sky-950/30 text-white ring-1 ring-sky-500/40"
                    : "border-neutral-800 bg-neutral-850 text-neutral-300 hover:bg-neutral-800"
                }`}
              >
                <div className="font-semibold text-xs mb-1">Extract All Single Pages</div>
                <div className="text-[11px] text-neutral-400 leading-tight">
                  Generates {totalPages} individual 1-page PDF files
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSplitMode("custom-ranges")}
                className={`p-3 rounded-lg border text-left transition-all ${
                  splitMode === "custom-ranges"
                    ? "border-sky-500 bg-sky-950/30 text-white ring-1 ring-sky-500/40"
                    : "border-neutral-800 bg-neutral-850 text-neutral-300 hover:bg-neutral-800"
                }`}
              >
                <div className="font-semibold text-xs mb-1">Custom Page Ranges</div>
                <div className="text-[11px] text-neutral-400 leading-tight">
                  Specify page groups (e.g. 1-3, 4-6, 7)
                </div>
              </button>
            </div>
          </div>

          {/* Custom Ranges Input */}
          {splitMode === "custom-ranges" && (
            <div className="space-y-1.5 p-3 rounded-lg bg-neutral-950 border border-neutral-800">
              <label className="block text-[11px] font-medium text-neutral-300">
                Page Ranges (comma-separated):
              </label>
              <input
                type="text"
                value={customRangeText}
                onChange={(e) => setCustomRangeText(e.target.value)}
                placeholder="e.g. 1-2, 3-5, 6"
                className="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-750 text-white text-xs font-mono focus:outline-none focus:border-sky-500"
              />
              <p className="text-[10px] text-neutral-500">
                Example: "1-3, 4-5, 6" extracts three separate PDFs containing pages 1 to 3, 4 to 5, and page 6.
              </p>
            </div>
          )}

          {progressMsg && (
            <div className="flex items-center space-x-2 p-2.5 rounded-lg bg-sky-950/40 border border-sky-800/60 text-sky-300 text-xs">
              <span className="w-3 h-3 border-2 border-sky-400 border-t-transparent rounded-full animate-spin shrink-0" />
              <span>{progressMsg}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-750 text-neutral-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleExecuteSplit}
              className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-semibold transition-all shadow-md active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isProcessing ? "Processing..." : "Split & Download"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
