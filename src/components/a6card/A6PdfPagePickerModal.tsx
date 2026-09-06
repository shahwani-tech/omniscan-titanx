import React, { useState, useEffect, useRef } from "react";
import { X, Check, FileText, ChevronLeft, ChevronRight, RefreshCw, ZoomIn } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import { renderPDFPageThumbnail } from "../../engine/pdf";

interface A6PdfPagePickerModalProps {
  isOpen: boolean;
  side: "front" | "back";
  fileName: string;
  pdfDoc: pdfjsLib.PDFDocumentProxy | null;
  currentPage: number;
  onSelectPage: (pageNum: number) => void;
  onClose: () => void;
}

export const A6PdfPagePickerModal: React.FC<A6PdfPagePickerModalProps> = ({
  isOpen,
  side,
  fileName,
  pdfDoc,
  currentPage,
  onSelectPage,
  onClose,
}) => {
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({});
  const [loadingPages, setLoadingPages] = useState<Record<number, boolean>>({});
  const [selectedPage, setSelectedPage] = useState<number>(currentPage);
  const isCancelledRef = useRef<boolean>(false);

  const numPages = pdfDoc ? pdfDoc.numPages : 0;

  useEffect(() => {
    setSelectedPage(currentPage);
  }, [currentPage, isOpen]);

  // Lazy thumbnail loader: Loads pages progressively
  useEffect(() => {
    if (!isOpen || !pdfDoc) return;
    isCancelledRef.current = false;

    const loadThumbs = async () => {
      // Prioritize current page first
      const priorityOrder: number[] = [selectedPage];
      for (let i = 1; i <= numPages; i++) {
        if (i !== selectedPage) priorityOrder.push(i);
      }

      for (const p of priorityOrder) {
        if (isCancelledRef.current) break;
        if (thumbnails[p]) continue;

        setLoadingPages((prev) => ({ ...prev, [p]: true }));
        try {
          const thumb = await renderPDFPageThumbnail(pdfDoc, p, 220);
          if (!isCancelledRef.current) {
            setThumbnails((prev) => ({ ...prev, [p]: thumb.thumbnailUrl }));
          }
        } catch (err) {
          console.warn(`Failed to render thumbnail for PDF page ${p}:`, err);
        } finally {
          if (!isCancelledRef.current) {
            setLoadingPages((prev) => ({ ...prev, [p]: false }));
          }
        }
      }
    };

    loadThumbs();

    return () => {
      isCancelledRef.current = true;
    };
  }, [isOpen, pdfDoc, numPages, selectedPage]);

  if (!isOpen || !pdfDoc) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn select-none">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[88vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-red-950/80 border border-red-800/80 text-red-400 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-white tracking-wide">
                  Select PDF Page for {side.toUpperCase()} Card
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800">
                  {numPages} {numPages === 1 ? "Page" : "Pages"}
                </span>
              </div>
              <p className="text-xs text-neutral-400 truncate max-w-lg">
                File: <span className="text-neutral-300 font-mono">{fileName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            title="Close page picker"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body - Thumbnails Grid */}
        <div className="flex-1 overflow-y-auto p-6 bg-neutral-900">
          <p className="text-xs text-neutral-400 mb-4">
            Click a page below to assign it to the {side.toUpperCase()} card working area. High-resolution rendering is preserved.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => {
              const isSelected = selectedPage === pageNum;
              const thumbUrl = thumbnails[pageNum];
              const isLoading = loadingPages[pageNum];

              return (
                <div
                  key={pageNum}
                  onClick={() => setSelectedPage(pageNum)}
                  onDoubleClick={() => {
                    setSelectedPage(pageNum);
                    onSelectPage(pageNum);
                    onClose();
                  }}
                  className={`group relative flex flex-col items-center p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? "bg-indigo-950/50 border-indigo-500 ring-2 ring-indigo-500/30 shadow-lg shadow-indigo-500/10"
                      : "bg-neutral-950 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-850"
                  }`}
                >
                  {/* Badge */}
                  <div className="w-full flex items-center justify-between text-[11px] font-mono text-neutral-400 mb-2">
                    <span className="font-semibold text-neutral-300">Page {pageNum}</span>
                    {isSelected && (
                      <span className="flex items-center text-indigo-400 text-[10px] font-bold">
                        <Check className="w-3 h-3 mr-0.5" /> Selected
                      </span>
                    )}
                  </div>

                  {/* Thumbnail Box */}
                  <div className="w-full aspect-[74/105] bg-white rounded flex items-center justify-center overflow-hidden border border-neutral-700 shadow-inner relative">
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt={`Page ${pageNum}`}
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : isLoading ? (
                      <div className="flex flex-col items-center justify-center text-neutral-400 space-y-1">
                        <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                        <span className="text-[10px]">Rendering...</span>
                      </div>
                    ) : (
                      <FileText className="w-6 h-6 text-neutral-300" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-neutral-800 bg-neutral-950">
          <div className="text-xs text-neutral-400">
            Selected: <strong className="text-white font-mono">Page {selectedPage}</strong> of {numPages}
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onSelectPage(selectedPage);
                onClose();
              }}
              className="px-5 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 flex items-center space-x-1.5 transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>Apply Page {selectedPage}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
