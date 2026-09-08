/**
 * OMNISCAN TITAN X - Universal File Preview Modal & Inspector
 * Multi-format visual inspector for PDFs, Images, Word documents, Spreadsheets,
 * and Presentations with zoom, pan, thumbnail sidebar, and tool routing.
 */

import React, { useState, useEffect, useRef } from "react";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Download,
  Printer,
  X,
  FileText,
  Image as ImageIcon,
  Table,
  Presentation,
  Share2,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import * as XLSX from "xlsx";
import { WorkspaceFile, SupportedInputFormat } from "../../services/converter/ConversionTypes";
import { ensurePdfWorker } from "../../engine/pdf";
import { ConversionEngine } from "../../services/converter/ConversionEngine";

ensurePdfWorker();

interface UniversalFilePreviewProps {
  isOpen: boolean;
  file: WorkspaceFile | null;
  onClose: () => void;
  onSaveFile?: (file: WorkspaceFile) => void;
  onOpenInPdfTool?: (file: File) => void;
  onOpenInImageEditor?: (dataUrl: string) => void;
  onOpenInPassportStudio?: (file: File) => void;
  onOpenInIdCardStudio?: (file: File) => void;
  onOpenInCardDesigner?: () => void;
  onOpenPrintDialog?: (file: File) => void;
}

export const UniversalFilePreview: React.FC<UniversalFilePreviewProps> = ({
  isOpen,
  file,
  onClose,
  onSaveFile,
  onOpenInPdfTool,
  onOpenInImageEditor,
  onOpenInPassportStudio,
  onOpenInIdCardStudio,
  onOpenInCardDesigner,
  onOpenPrintDialog,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [zoom, setZoom] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [activeSheet, setActiveSheet] = useState<string>("");
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [sheetTableData, setSheetTableData] = useState<any[][]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  useEffect(() => {
    if (!isOpen || !file) return;

    setCurrentPage(1);
    setZoom(1.0);
    setRotation(0);
    loadContent(file);

    return () => {
      pdfDocRef.current = null;
    };
  }, [isOpen, file]);

  const loadContent = async (targetFile: WorkspaceFile) => {
    setIsLoading(true);
    try {
      if (targetFile.format === "pdf") {
        const buffer = await targetFile.rawFile.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
        const pdf = await loadingTask.promise;
        pdfDocRef.current = pdf;
        setTotalPages(pdf.numPages);
        await renderPdfPage(pdf, 1, 1.0, 0);
      } else if (["xlsx", "xls", "csv", "ods"].includes(targetFile.format)) {
        const buffer = await targetFile.rawFile.arrayBuffer();
        const wb = XLSX.read(buffer, { type: "array" });
        setSheetNames(wb.SheetNames);
        const firstSheet = wb.SheetNames[0] || "Sheet1";
        setActiveSheet(firstSheet);
        const data: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[firstSheet], { header: 1, defval: "" });
        setSheetTableData(data.slice(0, 100)); // limit initial preview to 100 rows for performance
        setTotalPages(wb.SheetNames.length);
      } else if (["docx", "txt", "rtf"].includes(targetFile.format)) {
        const canvases = await ConversionEngine.renderDocumentToCanvases(targetFile);
        setTotalPages(canvases.length);
        if (canvases[0] && canvasRef.current) {
          const targetCanvas = canvasRef.current;
          targetCanvas.width = canvases[0].width;
          targetCanvas.height = canvases[0].height;
          const ctx = targetCanvas.getContext("2d");
          ctx?.drawImage(canvases[0], 0, 0);
        }
      } else if (["jpg", "jpeg", "png", "webp", "bmp", "gif", "svg"].includes(targetFile.format)) {
        setTotalPages(1);
        const img = new Image();
        img.src = targetFile.previewUrl || URL.createObjectURL(targetFile.rawFile);
        img.onload = () => {
          if (canvasRef.current) {
            const canvas = canvasRef.current;
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            ctx?.drawImage(img, 0, 0);
          }
        };
      }
    } catch (err) {
      console.error("Failed to load file preview:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const renderPdfPage = async (
    pdf: pdfjsLib.PDFDocumentProxy,
    pageNum: number,
    scaleFactor: number,
    rotAngle: number
  ) => {
    if (!canvasRef.current) return;
    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: scaleFactor * 1.5, rotation: (page.rotate + rotAngle) % 360 });
      const canvas = canvasRef.current;
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      }
    } catch (err) {
      console.error("PDF render page failed:", err);
    }
  };

  const handlePageChange = async (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
    if (file?.format === "pdf" && pdfDocRef.current) {
      await renderPdfPage(pdfDocRef.current, newPage, zoom, rotation);
    }
  };

  const handleZoom = async (delta: number) => {
    const nextZoom = Math.max(0.4, Math.min(3.0, zoom + delta));
    setZoom(nextZoom);
    if (file?.format === "pdf" && pdfDocRef.current) {
      await renderPdfPage(pdfDocRef.current, currentPage, nextZoom, rotation);
    }
  };

  const handleRotate = async () => {
    const nextRot = (rotation + 90) % 360;
    setRotation(nextRot);
    if (file?.format === "pdf" && pdfDocRef.current) {
      await renderPdfPage(pdfDocRef.current, currentPage, zoom, nextRot);
    }
  };

  const handleSheetSelect = async (sheetName: string) => {
    if (!file) return;
    setActiveSheet(sheetName);
    const buffer = await file.rawFile.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    const data: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: "" });
    setSheetTableData(data.slice(0, 100));
  };

  if (!isOpen || !file) return null;

  const isSpreadsheet = ["xlsx", "xls", "csv", "ods"].includes(file.format);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden">
        {/* Top Header & Toolbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-800 bg-neutral-950/80">
          <div className="flex items-center space-x-3 truncate">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center shrink-0">
              {file.format === "pdf" ? (
                <FileText className="w-4 h-4 text-rose-400" />
              ) : isSpreadsheet ? (
                <Table className="w-4 h-4 text-emerald-400" />
              ) : (
                <ImageIcon className="w-4 h-4 text-sky-400" />
              )}
            </div>
            <div className="truncate">
              <h3 className="text-sm font-semibold text-white truncate">{file.name}</h3>
              <p className="text-[11px] text-neutral-400">
                Format: <span className="uppercase text-sky-400 font-mono">{file.format}</span> •{" "}
                {(file.size / 1024).toFixed(1)} KB • {totalPages} {totalPages === 1 ? "page" : "pages"}
              </p>
            </div>
          </div>

          {/* Quick Actions & Navigation Controls */}
          <div className="flex items-center space-x-2">
            {/* Page Navigation */}
            {totalPages > 1 && !isSpreadsheet && (
              <div className="flex items-center space-x-1 bg-neutral-800/80 border border-neutral-700/60 rounded-lg px-2 py-1 text-xs text-neutral-300">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="p-0.5 rounded hover:text-white disabled:opacity-40"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-[11px] px-1">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className="p-0.5 rounded hover:text-white disabled:opacity-40"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Zoom Controls */}
            {!isSpreadsheet && (
              <div className="flex items-center space-x-1 bg-neutral-800/80 border border-neutral-700/60 rounded-lg px-1.5 py-1">
                <button
                  onClick={() => handleZoom(-0.2)}
                  className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-mono text-neutral-300 px-1">{Math.round(zoom * 100)}%</span>
                <button
                  onClick={() => handleZoom(0.2)}
                  className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleRotate}
                  className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors ml-1"
                  title="Rotate 90°"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Workspace Body Area */}
        <div className="flex-1 bg-neutral-950 overflow-auto flex items-center justify-center p-6 relative">
          {isLoading ? (
            <div className="flex flex-col items-center space-y-3">
              <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-neutral-400">Rendering preview...</p>
            </div>
          ) : isSpreadsheet ? (
            /* Spreadsheet Data Table Viewer */
            <div className="w-full h-full flex flex-col bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
              {/* Sheet selector tabs */}
              <div className="flex items-center space-x-1 p-2 bg-neutral-950 border-b border-neutral-800 overflow-x-auto">
                {sheetNames.map((sName) => (
                  <button
                    key={sName}
                    onClick={() => handleSheetSelect(sName)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      activeSheet === sName
                        ? "bg-sky-600 text-white"
                        : "bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700"
                    }`}
                  >
                    {sName}
                  </button>
                ))}
              </div>

              {/* Data Table */}
              <div className="flex-1 overflow-auto">
                <table className="w-full text-left text-xs text-neutral-300 border-collapse">
                  <tbody>
                    {sheetTableData.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className={`border-b border-neutral-800/60 ${
                          rIdx === 0
                            ? "bg-neutral-950 font-semibold text-white sticky top-0"
                            : rIdx % 2 === 0
                            ? "bg-neutral-900/80"
                            : "bg-neutral-900/40"
                        }`}
                      >
                        <td className="p-2 border-r border-neutral-800 text-neutral-500 font-mono text-[10px] w-10 text-center">
                          {rIdx + 1}
                        </td>
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="p-2 border-r border-neutral-800/40 max-w-xs truncate">
                            {String(cell !== undefined ? cell : "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Canvas Viewer for PDF / Image / Rendered Document */
            <div
              className="shadow-2xl rounded border border-neutral-800 bg-white transition-transform"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "center center",
              }}
            >
              <canvas ref={canvasRef} className="max-w-none block" />
            </div>
          )}
        </div>

        {/* Bottom Tool Routing Bar */}
        <div className="px-5 py-3 border-t border-neutral-800 bg-neutral-950 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
              Send to Tool:
            </span>

            {/* Send to PDF Tool */}
            {onOpenInPdfTool && (
              <button
                onClick={() => onOpenInPdfTool(file.rawFile)}
                className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium flex items-center space-x-1.5 transition-colors border border-neutral-700/60"
              >
                <FileText className="w-3.5 h-3.5 text-rose-400" />
                <span>PDF Studio</span>
              </button>
            )}

            {/* Send to Image Editor */}
            {onOpenInImageEditor && canvasRef.current && (
              <button
                onClick={() => onOpenInImageEditor(canvasRef.current!.toDataURL("image/png"))}
                className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium flex items-center space-x-1.5 transition-colors border border-neutral-700/60"
              >
                <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
                <span>Image Editor</span>
              </button>
            )}

            {/* Send to Passport Photo Studio */}
            {onOpenInPassportStudio && (
              <button
                onClick={() => onOpenInPassportStudio(file.rawFile)}
                className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium flex items-center space-x-1.5 transition-colors border border-neutral-700/60"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Passport Studio</span>
              </button>
            )}

            {/* Send to ID Card Studio */}
            {onOpenInIdCardStudio && (
              <button
                onClick={() => onOpenInIdCardStudio(file.rawFile)}
                className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium flex items-center space-x-1.5 transition-colors border border-neutral-700/60"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-400" />
                <span>ID Card / A6</span>
              </button>
            )}

            {/* Send to Card Designer */}
            {onOpenInCardDesigner && (
              <button
                onClick={onOpenInCardDesigner}
                className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium flex items-center space-x-1.5 transition-colors border border-neutral-700/60"
              >
                <Presentation className="w-3.5 h-3.5 text-purple-400" />
                <span>Card Designer</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {/* Print via Centralized Print Dialog */}
            {onOpenPrintDialog && (
              <button
                onClick={() => onOpenPrintDialog(file.rawFile)}
                className="px-3.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium flex items-center space-x-1.5 transition-colors border border-neutral-700"
              >
                <Printer className="w-3.5 h-3.5 text-neutral-300" />
                <span>Print Document</span>
              </button>
            )}

            {/* Save File */}
            {onSaveFile && (
              <button
                onClick={() => onSaveFile(file)}
                className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-md transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save / Export</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
