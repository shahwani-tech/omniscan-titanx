import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  FileText,
  Check,
  CheckSquare,
  Square,
  UploadCloud,
  AlertCircle,
  RefreshCw,
  Lock,
  Layers,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ArrowRight,
  ZoomIn,
  Copy,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import { renderPDFPageThumbnail, renderPDFPageToDataUrl, ensurePdfWorker } from "../../engine/pdf";
import {
  ACCEPT_ALL_SUPPORTED,
  ACCEPT_PDF_AND_IMAGES,
  ACCEPT_PDF_ONLY,
  ACCEPT_IMAGES_ONLY,
} from "../../services/upload/FileTypeRegistry";

export interface PdfImportPageResult {
  pageNum: number;
  dataUrl: string;
  width: number;
  height: number;
  fileName: string;
  side?: "front" | "back";
}

export interface PdfImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialFile?: File | null;
  title?: string;
  description?: string;
  selectionMode?: "single" | "multiple" | "both";
  showSideSelector?: boolean;
  initialSide?: "front" | "back";
  showPlacementModeSelector?: boolean;
  initialPlacementMode?: "object" | "background";
  primaryButtonLabel?: string;
  showDualSideButtons?: boolean;
  onImportSingle?: (
    result: PdfImportPageResult,
    targetSide?: "front" | "back",
    placementMode?: "object" | "background"
  ) => void;
  onImportMultiple?: (
    results: PdfImportPageResult[],
    targetSide?: "front" | "back",
    placementMode?: "object" | "background"
  ) => void;
}

export const ACCEPTED_PDF_FILE_TYPES = ACCEPT_PDF_ONLY;
export const ACCEPTED_DOCUMENT_AND_IMAGE_TYPES = ACCEPT_ALL_SUPPORTED;

export const PdfImportDialog: React.FC<PdfImportDialogProps> = ({
  isOpen,
  onClose,
  initialFile = null,
  title = "Import from PDF Document",
  description = "Select pages from PDF to import with high-resolution 300 DPI rendering.",
  selectionMode = "single",
  showSideSelector = false,
  initialSide = "front",
  showPlacementModeSelector = false,
  initialPlacementMode = "object",
  primaryButtonLabel,
  showDualSideButtons = false,
  onImportSingle,
  onImportMultiple,
}) => {
  const [activeFile, setActiveFile] = useState<File | null>(initialFile);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [password, setPassword] = useState("");

  const [thumbnails, setThumbnails] = useState<Record<number, string>>({});
  const [loadingThumbs, setLoadingThumbs] = useState<Record<number, boolean>>({});

  const [selectedPageNums, setSelectedPageNums] = useState<number[]>([1]);
  const [activePageNum, setActivePageNum] = useState<number>(1);
  const [targetSide, setTargetSide] = useState<"front" | "back">(initialSide);
  const [placementMode, setPlacementMode] = useState<"object" | "background">(initialPlacementMode);

  const [isProcessingImport, setIsProcessingImport] = useState(false);
  const [renderProgress, setRenderProgress] = useState<{ current: number; total: number } | null>(null);

  const isCancelledRef = useRef(false);
  const currentObjectUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync initialFile
  useEffect(() => {
    if (initialFile) {
      setActiveFile(initialFile);
    }
  }, [initialFile]);

  // Sync initialSide
  useEffect(() => {
    setTargetSide(initialSide);
  }, [initialSide]);

  // Cleanup object URLs on unmount or reset
  const cleanupObjectUrl = useCallback(() => {
    if (currentObjectUrlRef.current) {
      try {
        URL.revokeObjectURL(currentObjectUrlRef.current);
      } catch {}
      currentObjectUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanupObjectUrl();
    };
  }, [cleanupObjectUrl]);

  // Load PDF when file changes
  const loadPdf = useCallback(
    async (file: File, pwd?: string) => {
      cleanupObjectUrl();
      setIsLoadingPdf(true);
      setErrorMessage(null);
      setPasswordRequired(false);
      setThumbnails({});
      setLoadingThumbs({});
      setSelectedPageNums([1]);
      setActivePageNum(1);

      // 1. Validation check
      const isPdfName = file.name.toLowerCase().endsWith(".pdf");
      const isPdfMime = file.type === "application/pdf";
      if (!isPdfName && !isPdfMime) {
        setIsLoadingPdf(false);
        setErrorMessage("The selected file is not a valid PDF document. Please upload a .pdf file.");
        return;
      }

      try {
        let objectUrl: string | undefined;
        try {
          objectUrl = URL.createObjectURL(file);
          currentObjectUrlRef.current = objectUrl;
        } catch {}

        ensurePdfWorker();
        const loadingTask = objectUrl
          ? pdfjsLib.getDocument({
              url: objectUrl,
              password: pwd,
              useSystemFonts: true,
            })
          : pdfjsLib.getDocument({
              data: new Uint8Array(await file.arrayBuffer()),
              password: pwd,
              useSystemFonts: true,
            });

        const doc = await loadingTask.promise;

        if (doc.numPages <= 0) {
          throw new Error("This PDF document contains 0 pages.");
        }

        setPdfDoc(doc);
      } catch (err: any) {
        console.error("PDF loading error:", err);
        if (err.name === "PasswordException") {
          setPasswordRequired(true);
          setErrorMessage(
            pwd ? "Incorrect password. Please enter the valid document password." : "This PDF document is password-protected."
          );
        } else {
          setErrorMessage(err.message || "Failed to parse PDF document. The file may be damaged or invalid.");
        }
        setPdfDoc(null);
      } finally {
        setIsLoadingPdf(false);
      }
    },
    [cleanupObjectUrl]
  );

  useEffect(() => {
    if (isOpen && activeFile) {
      loadPdf(activeFile);
    }
  }, [isOpen, activeFile, loadPdf]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      isCancelledRef.current = true;
      cleanupObjectUrl();
      setPdfDoc(null);
      setThumbnails({});
      setErrorMessage(null);
      setIsProcessingImport(false);
    } else {
      isCancelledRef.current = false;
    }
  }, [isOpen, cleanupObjectUrl]);

  // Progressive thumbnail loader
  useEffect(() => {
    if (!isOpen || !pdfDoc) return;
    isCancelledRef.current = false;

    const numPages = pdfDoc.numPages;

    const loadBatch = async () => {
      // Prioritize active page, then remaining
      const pagesToLoad: number[] = [activePageNum];
      for (let i = 1; i <= numPages; i++) {
        if (i !== activePageNum) pagesToLoad.push(i);
      }

      for (const p of pagesToLoad) {
        if (isCancelledRef.current) break;
        if (thumbnails[p]) continue;

        setLoadingThumbs((prev) => ({ ...prev, [p]: true }));
        try {
          const thumb = await renderPDFPageThumbnail(pdfDoc, p, 220);
          if (!isCancelledRef.current) {
            setThumbnails((prev) => ({ ...prev, [p]: thumb.thumbnailUrl }));
          }
        } catch (e) {
          console.warn(`Failed thumbnail for page ${p}:`, e);
        } finally {
          if (!isCancelledRef.current) {
            setLoadingThumbs((prev) => ({ ...prev, [p]: false }));
          }
        }
      }
    };

    loadBatch();

    return () => {
      isCancelledRef.current = true;
    };
  }, [isOpen, pdfDoc, activePageNum]);

  if (!isOpen) return null;

  const totalPages = pdfDoc ? pdfDoc.numPages : 0;

  // Toggle selection
  const handleToggleSelectPage = (pageNum: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActivePageNum(pageNum);

    if (selectionMode === "single") {
      setSelectedPageNums([pageNum]);
      return;
    }

    setSelectedPageNums((prev) => {
      if (prev.includes(pageNum)) {
        if (prev.length === 1) return prev; // Keep at least one selected
        return prev.filter((p) => p !== pageNum);
      } else {
        return [...prev, pageNum].sort((a, b) => a - b);
      }
    });
  };

  const handleSelectAll = () => {
    if (!pdfDoc) return;
    const all = Array.from({ length: pdfDoc.numPages }, (_, i) => i + 1);
    setSelectedPageNums(all);
  };

  const handleClearSelection = () => {
    setSelectedPageNums([activePageNum]);
  };

  // Perform import
  const handleExecuteImport = async (
    targetSideOverride?: "front" | "back",
    singlePageOverride?: number
  ) => {
    if (!pdfDoc || !activeFile) return;

    const chosenSide = targetSideOverride || targetSide;
    const pagesToRender = singlePageOverride
      ? [singlePageOverride]
      : selectedPageNums.length > 0
      ? selectedPageNums
      : [activePageNum];

    isCancelledRef.current = false;
    setIsProcessingImport(true);
    setRenderProgress({ current: 0, total: pagesToRender.length });

    try {
      const results: PdfImportPageResult[] = [];

      for (let i = 0; i < pagesToRender.length; i++) {
        if (isCancelledRef.current) {
          setIsProcessingImport(false);
          setRenderProgress(null);
          return;
        }

        const pageNum = pagesToRender[i];
        setRenderProgress({ current: i + 1, total: pagesToRender.length });

        // Render at 300 DPI for pristine print resolution
        const rendered = await renderPDFPageToDataUrl(pdfDoc, pageNum, 300);

        if (isCancelledRef.current) return;

        results.push({
          pageNum,
          dataUrl: rendered.dataUrl,
          width: rendered.width,
          height: rendered.height,
          fileName: activeFile.name,
          side: chosenSide,
        });
      }

      if (results.length === 1 && onImportSingle) {
        onImportSingle(results[0], chosenSide, placementMode);
      } else if (onImportMultiple) {
        onImportMultiple(results, chosenSide, placementMode);
      } else if (onImportSingle && results.length > 0) {
        // Fallback if multiple callback not provided
        onImportSingle(results[0], chosenSide, placementMode);
      }

      onClose();
    } catch (err: any) {
      if (!isCancelledRef.current) {
        console.error("High-res PDF import rendering error:", err);
        setErrorMessage(`Failed to render PDF page: ${err.message}`);
      }
    } finally {
      setIsProcessingImport(false);
      setRenderProgress(null);
    }
  };

  const handleCancelOngoing = () => {
    isCancelledRef.current = true;
    setIsProcessingImport(false);
    setRenderProgress(null);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fadeIn select-none">
      <div className="bg-neutral-900 border border-neutral-750 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-red-950/90 border border-red-800/80 text-red-400 flex items-center justify-center shadow-lg shadow-red-950/40">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-white tracking-wide">{title}</h3>
                {pdfDoc && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800">
                    {totalPages} {totalPages === 1 ? "Page" : "Pages"}
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400 truncate max-w-lg">{description}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {activeFile && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1 text-xs font-semibold text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors border border-neutral-700/60 flex items-center space-x-1.5"
                title="Choose a different PDF file"
              >
                <UploadCloud className="w-3.5 h-3.5 text-sky-400" />
                <span>Change PDF</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Hidden File Picker to pick or change PDF */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_DOCUMENT_AND_IMAGE_TYPES}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              setActiveFile(file);
              loadPdf(file);
            }
            e.target.value = "";
          }}
        />

        {/* Subheader Toolbar: Side Selector, Placement Mode, Selection Controls */}
        {pdfDoc && (
          <div className="px-6 py-2.5 bg-neutral-925 border-b border-neutral-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center space-x-3">
              {/* Target Side Toggle (Front / Back) */}
              {showSideSelector && (
                <div className="flex items-center space-x-1.5 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
                  <span className="text-[10px] uppercase font-bold text-neutral-400 px-1.5">Target Side:</span>
                  <button
                    type="button"
                    onClick={() => setTargetSide("front")}
                    className={`px-2.5 py-1 rounded font-semibold transition-colors ${
                      targetSide === "front"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-neutral-400 hover:text-white"
                    }`}
                  >
                    Front Card
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetSide("back")}
                    className={`px-2.5 py-1 rounded font-semibold transition-colors ${
                      targetSide === "back"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-neutral-400 hover:text-white"
                    }`}
                  >
                    Back Card
                  </button>
                </div>
              )}

              {/* Placement Mode: Object vs Background (Card Designer) */}
              {showPlacementModeSelector && (
                <div className="flex items-center space-x-1.5 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
                  <span className="text-[10px] uppercase font-bold text-neutral-400 px-1.5">Placement:</span>
                  <button
                    type="button"
                    onClick={() => setPlacementMode("object")}
                    className={`px-2 py-1 rounded font-semibold transition-colors ${
                      placementMode === "object"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-neutral-400 hover:text-white"
                    }`}
                    title="Adds as movable, resizable, croppable object on the card"
                  >
                    Editable Object
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlacementMode("background")}
                    className={`px-2 py-1 rounded font-semibold transition-colors ${
                      placementMode === "background"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-neutral-400 hover:text-white"
                    }`}
                    title="Replaces the entire background of this card side"
                  >
                    Replace Background
                  </button>
                </div>
              )}
            </div>

            {/* Multi-Page Navigation Controls */}
            <div className="flex items-center space-x-2">
              <div className="flex items-center bg-neutral-950 rounded-lg p-0.5 border border-neutral-800">
                <button
                  type="button"
                  disabled={activePageNum <= 1}
                  onClick={() => {
                    const prev = Math.max(1, activePageNum - 1);
                    handleToggleSelectPage(prev);
                  }}
                  className="p-1 rounded text-neutral-400 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-400 transition-colors"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-mono px-2 text-neutral-300">
                  Page <strong className="text-white">{activePageNum}</strong> / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={activePageNum >= totalPages}
                  onClick={() => {
                    const next = Math.min(totalPages, activePageNum + 1);
                    handleToggleSelectPage(next);
                  }}
                  className="p-1 rounded text-neutral-400 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-400 transition-colors"
                  title="Next Page"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Selection Controls for Multi-Page */}
              {(selectionMode === "multiple" || selectionMode === "both") && (
                <div className="flex items-center space-x-1.5 pl-2 border-l border-neutral-800">
                  <span className="text-neutral-400 text-[11px] hidden sm:inline">
                    Selected:{" "}
                    <strong className="text-white font-mono">{selectedPageNums.length}</strong> /{" "}
                    <span className="font-mono">{totalPages}</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded text-[11px] font-medium transition-colors"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white rounded text-[11px] font-medium transition-colors"
                  >
                    Reset
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar flex flex-col items-center justify-center min-h-[340px]">
          {/* 1. File Upload Dropzone (if no active file or file failed) */}
          {!activeFile && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  setActiveFile(file);
                  loadPdf(file);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className="w-full max-w-xl p-10 border-2 border-dashed border-neutral-700 hover:border-sky-500 bg-neutral-950/60 hover:bg-neutral-950 rounded-2xl cursor-pointer flex flex-col items-center justify-center text-center transition-all group"
            >
              <div className="w-16 h-16 rounded-2xl bg-neutral-800 group-hover:bg-sky-950/60 border border-neutral-700 group-hover:border-sky-700/60 flex items-center justify-center text-neutral-400 group-hover:text-sky-400 transition-colors mb-4 shadow-lg">
                <UploadCloud className="w-8 h-8" />
              </div>
              <h4 className="text-sm font-bold text-white mb-1">Select or Drop a PDF File</h4>
              <p className="text-xs text-neutral-400 max-w-sm mb-4">
                Choose any PDF document to extract pages, ID cards, certificates, or vector graphics at 300 DPI print quality.
              </p>
              <button
                type="button"
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl shadow-lg transition-colors"
              >
                Browse PDF File
              </button>
            </div>
          )}

          {/* 2. Loading State */}
          {isLoadingPdf && (
            <div className="flex flex-col items-center justify-center space-y-3 py-16">
              <RefreshCw className="w-8 h-8 text-sky-400 animate-spin" />
              <div className="text-center">
                <p className="text-sm font-bold text-white">Opening PDF Document...</p>
                <p className="text-xs text-neutral-400">Rendering high-fidelity vector pages</p>
              </div>
            </div>
          )}

          {/* 3. Password Decryption State */}
          {passwordRequired && (
            <div className="max-w-md w-full p-6 bg-neutral-950 border border-neutral-800 rounded-2xl flex flex-col items-center text-center space-y-4 shadow-xl">
              <div className="w-12 h-12 rounded-xl bg-amber-950/80 border border-amber-800/80 text-amber-400 flex items-center justify-center">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Password Required</h4>
                <p className="text-xs text-neutral-400 mt-1">
                  This document is encrypted. Please enter the password to open and import pages.
                </p>
              </div>

              {errorMessage && (
                <div className="w-full text-xs text-rose-400 bg-rose-950/40 border border-rose-800/60 p-2.5 rounded-lg flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (activeFile) loadPdf(activeFile, password);
                }}
                className="w-full flex flex-col space-y-3"
              >
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter PDF password"
                  autoFocus
                  className="w-full px-3.5 py-2 rounded-xl bg-neutral-900 border border-neutral-700 text-white text-xs placeholder:text-neutral-500 focus:outline-none focus:border-sky-500"
                />
                <button
                  type="submit"
                  className="w-full py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl transition-colors shadow-md"
                >
                  Unlock Document
                </button>
              </form>
            </div>
          )}

          {/* 4. Error Message (Non-Password) */}
          {!passwordRequired && errorMessage && !isLoadingPdf && (
            <div className="max-w-md w-full p-6 bg-rose-950/30 border border-rose-800/60 rounded-2xl flex flex-col items-center text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-rose-400" />
              <h4 className="text-sm font-bold text-white">Could Not Read PDF</h4>
              <p className="text-xs text-rose-300">{errorMessage}</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                Choose Another File
              </button>
            </div>
          )}

          {/* 5. PDF Page Selection Grid */}
          {!isLoadingPdf && !passwordRequired && pdfDoc && (
            <div className="w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {Array.from({ length: totalPages }, (_, idx) => {
                const pageNum = idx + 1;
                const thumb = thumbnails[pageNum];
                const isLoadingThumb = loadingThumbs[pageNum];
                const isSelected = selectedPageNums.includes(pageNum);
                const isActive = activePageNum === pageNum;

                return (
                  <div
                    key={pageNum}
                    onClick={(e) => handleToggleSelectPage(pageNum, e)}
                    className={`group relative rounded-xl border p-2.5 flex flex-col space-y-2 cursor-pointer transition-all ${
                      isSelected
                        ? "bg-indigo-950/40 border-indigo-500 shadow-lg shadow-indigo-950/50"
                        : isActive
                        ? "bg-neutral-950 border-sky-500/80"
                        : "bg-neutral-950 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/60"
                    }`}
                  >
                    {/* Header: Page label + selection check */}
                    <div className="flex items-center justify-between text-xs px-1">
                      <span className="font-mono font-semibold text-neutral-300">
                        Page {pageNum}
                      </span>

                      {selectionMode === "multiple" ? (
                        <div
                          className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                            isSelected
                              ? "bg-indigo-600 text-white"
                              : "border border-neutral-700 text-transparent hover:border-neutral-500"
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        isSelected && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                            Selected
                          </span>
                        )
                      )}
                    </div>

                    {/* Thumbnail Viewport */}
                    <div className="aspect-[1/1.414] bg-neutral-900 rounded-lg overflow-hidden flex items-center justify-center border border-neutral-800/80 relative">
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={`Page ${pageNum}`}
                          className="w-full h-full object-contain select-none"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center space-y-1 text-neutral-500">
                          <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
                          <span className="text-[10px] font-mono">Loading...</span>
                        </div>
                      )}

                      {/* Active Ring on Hover */}
                      <div className="absolute inset-0 bg-sky-500/0 group-hover:bg-sky-500/5 transition-colors pointer-events-none" />
                    </div>

                    {/* Dual-Side Direct Quick Action Buttons (for ID Card Studio) */}
                    {showDualSideButtons && (
                      <div className="grid grid-cols-2 gap-1 pt-1">
                        <button
                          type="button"
                          disabled={!thumb || isProcessingImport}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExecuteImport("front", pageNum);
                          }}
                          className="py-1 px-1.5 bg-emerald-700/80 hover:bg-emerald-600 disabled:opacity-40 rounded text-white text-[10px] font-bold flex items-center justify-center space-x-1 transition-colors"
                          title="Import this page directly as Front Card"
                        >
                          <span>Use Front</span>
                        </button>
                        <button
                          type="button"
                          disabled={!thumb || isProcessingImport}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExecuteImport("back", pageNum);
                          }}
                          className="py-1 px-1.5 bg-indigo-700/80 hover:bg-indigo-600 disabled:opacity-40 rounded text-white text-[10px] font-bold flex items-center justify-center space-x-1 transition-colors"
                          title="Import this page directly as Back Card"
                        >
                          <span>Use Back</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-neutral-800 bg-neutral-950 flex items-center justify-between">
          <div className="text-xs text-neutral-400">
            {activeFile && (
              <span className="truncate max-w-sm inline-block">
                File: <strong className="text-neutral-200 font-mono">{activeFile.name}</strong>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {isProcessingImport ? (
              <button
                type="button"
                onClick={handleCancelOngoing}
                className="px-4 py-2 bg-red-900/80 hover:bg-red-800 text-red-200 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5 shadow-lg shadow-red-950/40"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel Rendering</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
            )}

            {pdfDoc && !isProcessingImport && totalPages > 1 && (selectionMode === "multiple" || selectionMode === "both") && (
              <button
                type="button"
                onClick={() => handleExecuteImport(undefined, activePageNum)}
                className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white rounded-xl text-xs font-semibold transition-colors flex items-center space-x-1.5 border border-neutral-700"
                title={`Import only current page (${activePageNum})`}
              >
                <span>Import Current (p.{activePageNum})</span>
              </button>
            )}

            {pdfDoc && (
              <button
                type="button"
                disabled={isProcessingImport || selectedPageNums.length === 0}
                onClick={() => handleExecuteImport()}
                className="px-5 py-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-sky-600/20 disabled:opacity-40 flex items-center space-x-2"
              >
                {isProcessingImport ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>
                      Rendering 300 DPI (
                      {renderProgress
                        ? `${renderProgress.current}/${renderProgress.total}`
                        : "Preparing"}
                      )...
                    </span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>
                      {primaryButtonLabel ||
                        (selectionMode === "multiple" || selectionMode === "both"
                          ? `Import ${selectedPageNums.length} Selected ${
                              selectedPageNums.length === 1 ? "Page" : "Pages"
                            }`
                          : `Import Page ${activePageNum}`)}
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
