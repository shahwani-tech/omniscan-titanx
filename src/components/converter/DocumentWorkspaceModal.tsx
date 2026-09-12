/**
 * OMNISCAN TITAN X - Enterprise Document Workspace & File Converter
 * Complete All-in-One File Processing, Conversion, PDF Merging,
 * Splitting, Office Transformations & Tool Routing Suite.
 */

import React, { useState, useRef, useCallback } from "react";
import {
  FileText,
  UploadCloud,
  Layers,
  Scissors,
  FileType,
  FileSpreadsheet,
  Presentation,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  ArrowUp,
  ArrowDown,
  RotateCw,
  Eye,
  Download,
  Printer,
  X,
  Play,
  Settings2,
  Archive,
  RefreshCw,
  ExternalLink,
  Sparkles,
  ChevronRight,
  Plus,
} from "lucide-react";
import {
  WorkspaceFile,
  ConversionTool,
  SupportedOutputFormat,
  ConversionJobConfig,
  ConversionResult,
  ConvertedOutputItem,
} from "../../services/converter/ConversionTypes";
import { FormatDetector } from "../../services/converter/FormatDetector";
import { ConversionManager } from "../../services/converter/ConversionManager";
import { SaveOutputDialog } from "./SaveOutputDialog";
import { UniversalFilePreview } from "./UniversalFilePreview";
import * as pdfjsLib from "pdfjs-dist";
import { ensurePdfWorker } from "../../engine/pdf";

ensurePdfWorker();

interface DocumentWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenInPdfStudio?: (file: File) => void;
  onOpenInImageEditor?: (dataUrl: string) => void;
  onOpenInPassportStudio?: (file: File) => void;
  onOpenInIdCardStudio?: (file: File) => void;
  onPrintDocument?: (file: File) => void;
}

const TOOL_DEFINITIONS: {
  id: ConversionTool;
  label: string;
  category: "pdf-ops" | "to-pdf" | "from-pdf" | "images";
  description: string;
  defaultOutput: SupportedOutputFormat;
  icon: any;
  color: string;
}[] = [
  {
    id: "merge-pdf",
    label: "Merge PDF",
    category: "pdf-ops",
    description: "Combine multiple PDFs, images & docs into one seamless PDF",
    defaultOutput: "pdf",
    icon: Layers,
    color: "text-rose-400 bg-rose-500/10 border-rose-500/30",
  },
  {
    id: "split-pdf",
    label: "Split PDF",
    category: "pdf-ops",
    description: "Split every page separately or extract custom page ranges",
    defaultOutput: "pdf",
    icon: Scissors,
    color: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  },
  {
    id: "pdf-to-word",
    label: "PDF to Word",
    category: "from-pdf",
    description: "Extract structured text & tables into editable DOCX",
    defaultOutput: "docx",
    icon: FileType,
    color: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  },
  {
    id: "word-to-pdf",
    label: "Word to PDF",
    category: "to-pdf",
    description: "Convert DOCX, TXT & RTF documents into vector PDF",
    defaultOutput: "pdf",
    icon: FileText,
    color: "text-sky-400 bg-sky-500/10 border-sky-500/30",
  },
  {
    id: "pdf-to-excel",
    label: "PDF to Excel",
    category: "from-pdf",
    description: "Detect tabular grids and export to XLSX or CSV",
    defaultOutput: "xlsx",
    icon: FileSpreadsheet,
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  },
  {
    id: "excel-to-pdf",
    label: "Excel to PDF",
    category: "to-pdf",
    description: "Render spreadsheets with auto-fit tables to PDF",
    defaultOutput: "pdf",
    icon: FileSpreadsheet,
    color: "text-teal-400 bg-teal-500/10 border-teal-500/30",
  },
  {
    id: "pdf-to-pptx",
    label: "PDF to PPT",
    category: "from-pdf",
    description: "Convert pages into PowerPoint presentation slides",
    defaultOutput: "pptx",
    icon: Presentation,
    color: "text-orange-400 bg-orange-500/10 border-orange-500/30",
  },
  {
    id: "pptx-to-pdf",
    label: "PPT to PDF",
    category: "to-pdf",
    description: "Render slide presentations into high-resolution PDF",
    defaultOutput: "pdf",
    icon: Presentation,
    color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/30",
  },
  {
    id: "pdf-to-image",
    label: "PDF to JPG/PNG",
    category: "from-pdf",
    description: "Extract PDF pages to crisp images at 150-600 DPI",
    defaultOutput: "png",
    icon: ImageIcon,
    color: "text-purple-400 bg-purple-500/10 border-purple-500/30",
  },
  {
    id: "image-to-pdf",
    label: "Image to PDF",
    category: "to-pdf",
    description: "Convert single or multi-images to clean paginated PDF",
    defaultOutput: "pdf",
    icon: ImageIcon,
    color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
  },
];

export const DocumentWorkspaceModal: React.FC<DocumentWorkspaceModalProps> = ({
  isOpen,
  onClose,
  onOpenInPdfStudio,
  onOpenInImageEditor,
  onOpenInPassportStudio,
  onOpenInIdCardStudio,
  onPrintDocument,
}) => {
  const [activeTool, setActiveTool] = useState<ConversionTool>("merge-pdf");
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressStatus, setProgressStatus] = useState("");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [conversionResult, setConversionResult] = useState<ConversionResult | null>(null);

  // Preview & Save Modal States
  const [previewFile, setPreviewFile] = useState<WorkspaceFile | null>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [selectedOutputItem, setSelectedOutputItem] = useState<ConvertedOutputItem | null>(null);

  // Job Configuration State
  const [config, setConfig] = useState<ConversionJobConfig>({
    tool: "merge-pdf",
    outputFormat: "pdf",
    outputFileNamePattern: "{name}_converted.{ext}",
    conversionMode: "hybrid",
    pageSize: "A4",
    orientation: "auto",
    marginMm: 10,
    gapMm: 5,
    fitMode: "fit-to-page",
    backgroundColor: "#FFFFFF",
    imageDpi: 300,
    imageQuality: 0.92,
    splitMode: "every-page",
    customRangesText: "1-2, 3-4",
    packageAsZip: true,
    ocrLanguage: "eng",
    detectTables: true,
    preserveImages: true,
    includeHeadersFooters: true,
    fitColumnsToPage: true,
    gridlinesVisible: true,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const currentToolDef = TOOL_DEFINITIONS.find((t) => t.id === activeTool) || TOOL_DEFINITIONS[0];

  const handleToolSelect = (toolId: ConversionTool) => {
    setActiveTool(toolId);
    const def = TOOL_DEFINITIONS.find((t) => t.id === toolId);
    if (def) {
      setConfig((prev) => ({
        ...prev,
        tool: toolId,
        outputFormat: def.defaultOutput,
      }));
    }
    setConversionResult(null);
  };

  const handleFilesSelected = async (fileList: FileList | File[]) => {
    const newFiles: WorkspaceFile[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const raw = fileList[i];
      const detection = await FormatDetector.detectFormat(raw);

      let pageCount = 1;
      let previewUrl: string | undefined;

      if (detection.format === "pdf") {
        try {
          const buf = await raw.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
          pageCount = pdf.numPages;
          // Generate quick thumbnail for first page
          const firstPage = await pdf.getPage(1);
          const vp = firstPage.getViewport({ scale: 0.25 });
          const canvas = document.createElement("canvas");
          canvas.width = vp.width;
          canvas.height = vp.height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            await firstPage.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
            previewUrl = canvas.toDataURL("image/jpeg", 0.7);
          }
        } catch {}
      } else if (["jpg", "jpeg", "png", "webp", "bmp", "gif", "svg"].includes(detection.format)) {
        previewUrl = URL.createObjectURL(raw);
      }

      newFiles.push({
        id: "wf-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5),
        name: raw.name,
        size: raw.size,
        type: raw.type,
        format: detection.format,
        rawFile: raw,
        pageCount,
        pages: Array.from({ length: pageCount }, (_, idx) => ({
          pageNumber: idx + 1,
          selected: true,
          rotation: 0,
        })),
        status: "ready",
        previewUrl,
      });
    }

    setFiles((prev) => [...prev, ...newFiles]);
  };

  const handleMoveFile = (idx: number, delta: -1 | 1) => {
    const nextIdx = idx + delta;
    if (nextIdx < 0 || nextIdx >= files.length) return;
    const copy = [...files];
    const item = copy.splice(idx, 1)[0];
    copy.splice(nextIdx, 0, item);
    setFiles(copy);
  };

  const handleRemoveFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleExecuteJob = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setProgressPercent(5);
    setProgressStatus("Initializing conversion task...");
    setConversionResult(null);

    const jobId = "job-" + Date.now();
    setActiveJobId(jobId);

    const res = await ConversionManager.executeJob(jobId, files, config, (pct, status) => {
      setProgressPercent(pct);
      setProgressStatus(status);
    });

    setIsProcessing(false);
    setActiveJobId(null);
    setConversionResult(res);
  };

  const handleCancelJob = () => {
    if (activeJobId) {
      ConversionManager.cancelJob(activeJobId);
      setIsProcessing(false);
      setProgressStatus("Cancelled by user");
    }
  };

  const handleOpenSaveModal = (item: ConvertedOutputItem) => {
    setSelectedOutputItem(item);
    setSaveModalOpen(true);
  };

  const handleConfirmSave = (finalName: string) => {
    if (!selectedOutputItem) return;
    const blob =
      selectedOutputItem.data instanceof Blob
        ? selectedOutputItem.data
        : new Blob([selectedOutputItem.data], { type: selectedOutputItem.mimeType });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = finalName;
    a.click();
    URL.revokeObjectURL(url);
    setSaveModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-5">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl w-full max-w-7xl h-[92vh] flex flex-col overflow-hidden text-neutral-200">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/90 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500/20 to-indigo-500/20 border border-sky-500/30 flex items-center justify-center">
              <currentToolDef.icon className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white tracking-wide">Document Workspace</h2>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-400">
                  All-in-One Engine
                </span>
              </div>
              <p className="text-xs text-neutral-400">{currentToolDef.description}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {files.length > 0 && (
              <button
                onClick={() => setFiles([])}
                className="px-3 py-1.5 rounded-lg border border-neutral-800 hover:border-neutral-700 bg-neutral-950 text-xs text-neutral-400 hover:text-white transition-colors"
              >
                Clear All Files
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tool Navigation Tabs */}
        <div className="px-6 py-2.5 border-b border-neutral-800 bg-neutral-950/60 overflow-x-auto flex items-center space-x-1.5 shrink-0">
          {TOOL_DEFINITIONS.map((tool) => {
            const Icon = tool.icon;
            const isActive = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                onClick={() => handleToolSelect(tool.id)}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-sky-600 text-white shadow-md shadow-sky-600/20 border border-sky-500/50"
                    : "bg-neutral-900/80 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-800"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-white" : ""}`} />
                <span>{tool.label}</span>
              </button>
            );
          })}
        </div>

        {/* Main Workspace Layout Grid */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* Left / Center: Upload Zone, File Cards & Results (8 cols) */}
          <div className="lg:col-span-8 border-b lg:border-b-0 lg:border-r border-neutral-800 flex flex-col overflow-hidden bg-neutral-950/40">
            {/* Drag & Drop Upload Banner */}
            <div className="p-4 border-b border-neutral-800 bg-neutral-950/60">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files) handleFilesSelected(e.dataTransfer.files);
                }}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-neutral-800 hover:border-sky-500/60 bg-neutral-900/40 hover:bg-neutral-900/80 rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer transition-all group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) handleFilesSelected(e.target.files);
                  }}
                />
                <div className="w-10 h-10 rounded-full bg-neutral-800 group-hover:bg-sky-500/20 flex items-center justify-center mb-2 transition-colors">
                  <UploadCloud className="w-5 h-5 text-neutral-400 group-hover:text-sky-400 transition-colors" />
                </div>
                <div className="text-xs font-semibold text-neutral-200 group-hover:text-white">
                  Drop files here or click to browse
                </div>
                <div className="text-[11px] text-neutral-500 mt-0.5">
                  Supports PDF, DOCX, XLSX, PPTX, Images (JPG, PNG, WEBP, TIFF), RTF & TXT
                </div>
              </div>
            </div>

            {/* Content Display: Results or File Queue */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* If conversion results exist, show completed output card */}
              {conversionResult && conversionResult.outputFiles.length > 0 && (
                <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <div>
                        <h4 className="text-xs font-bold text-white">Conversion Successful</h4>
                        <p className="text-[11px] text-emerald-400/80">
                          {conversionResult.outputFiles.length} file(s) generated in{" "}
                          {(conversionResult.totalTimeMs / 1000).toFixed(1)}s
                        </p>
                      </div>
                    </div>
                    {conversionResult.zipPackageUrl && (
                      <a
                        href={conversionResult.zipPackageUrl}
                        download={conversionResult.zipPackageName || "Converted_Files.zip"}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors shadow"
                      >
                        <Archive className="w-3.5 h-3.5" />
                        <span>Download ZIP Package</span>
                      </a>
                    )}
                  </div>

                  {/* Output Items List */}
                  <div className="space-y-2 pt-1">
                    {conversionResult.outputFiles.map((outItem) => (
                      <div
                        key={outItem.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition-colors"
                      >
                        <div className="flex items-center space-x-3 truncate">
                          <div className="w-7 h-7 rounded bg-neutral-800 flex items-center justify-center font-mono text-[10px] font-bold uppercase text-sky-400">
                            {outItem.format}
                          </div>
                          <div className="truncate">
                            <div className="text-xs font-medium text-white truncate">{outItem.fileName}</div>
                            {outItem.notes && <div className="text-[10px] text-neutral-500">{outItem.notes}</div>}
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0">
                          {/* Send to PDF Studio */}
                          {onOpenInPdfStudio && outItem.format === "pdf" && (
                            <button
                              onClick={() => {
                                const fileObj = new File(
                                  [outItem.data instanceof Blob ? outItem.data : new Blob([outItem.data])],
                                  outItem.fileName,
                                  { type: outItem.mimeType }
                                );
                                onOpenInPdfStudio(fileObj);
                                onClose();
                              }}
                              className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs transition-colors"
                            >
                              PDF Studio
                            </button>
                          )}

                          {/* Print */}
                          {onPrintDocument && outItem.format === "pdf" && (
                            <button
                              onClick={() => {
                                const fileObj = new File(
                                  [outItem.data instanceof Blob ? outItem.data : new Blob([outItem.data])],
                                  outItem.fileName,
                                  { type: outItem.mimeType }
                                );
                                onPrintDocument(fileObj);
                              }}
                              className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                              title="Print Converted Document"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Save / Rename Button */}
                          <button
                            onClick={() => handleOpenSaveModal(outItem)}
                            className="flex items-center space-x-1 px-3 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Save</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Uploaded File Queue */}
              {files.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-center p-6 border border-dashed border-neutral-800/80 rounded-xl">
                  <p className="text-xs text-neutral-400">No files uploaded yet.</p>
                  <p className="text-[11px] text-neutral-500 mt-1">
                    Upload documents or images above to start merging, splitting, or converting.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-400 uppercase tracking-wider px-1">
                    <span>Input Documents ({files.length})</span>
                    <span>Reorder / Actions</span>
                  </div>

                  {files.map((file, idx) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-neutral-900/80 border border-neutral-800 hover:border-neutral-700 transition-colors group"
                    >
                      <div className="flex items-center space-x-3 truncate">
                        {/* Thumbnail / Icon */}
                        {file.previewUrl ? (
                          <img
                            src={file.previewUrl}
                            alt="preview"
                            className="w-9 h-9 object-cover rounded border border-neutral-700/60 shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded bg-neutral-800 flex items-center justify-center text-xs font-mono font-bold uppercase text-sky-400 shrink-0">
                            {file.format}
                          </div>
                        )}

                        <div className="truncate">
                          <div className="text-xs font-semibold text-white truncate">{file.name}</div>
                          <div className="text-[11px] text-neutral-500 flex items-center space-x-2">
                            <span>{(file.size / 1024).toFixed(1)} KB</span>
                            <span>•</span>
                            <span>
                              {file.pageCount} {file.pageCount === 1 ? "page" : "pages"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* File Controls */}
                      <div className="flex items-center space-x-1.5 shrink-0">
                        {/* Preview */}
                        <button
                          onClick={() => setPreviewFile(file)}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                          title="Preview Document"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* Reorder Up / Down */}
                        <button
                          onClick={() => handleMoveFile(idx, -1)}
                          disabled={idx === 0}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-30 transition-colors"
                          title="Move Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMoveFile(idx, 1)}
                          disabled={idx === files.length - 1}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-30 transition-colors"
                          title="Move Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>

                        {/* Remove */}
                        <button
                          onClick={() => handleRemoveFile(idx)}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                          title="Remove File"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Conversion Settings & Execute Panel (4 cols) */}
          <div className="lg:col-span-4 flex flex-col justify-between bg-neutral-900/60 p-5 overflow-y-auto space-y-6">
            <div className="space-y-5">
              <div className="flex items-center space-x-2 border-b border-neutral-800 pb-3">
                <Settings2 className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Conversion Settings
                </h3>
              </div>

              {/* Settings Specific to Tool */}
              {activeTool === "split-pdf" && (
                <div className="space-y-3">
                  <label className="text-xs font-medium text-neutral-300">Split Method</label>
                  <div className="space-y-2">
                    {[
                      { id: "every-page", label: "Split every page into separate PDF" },
                      { id: "custom-ranges", label: "Custom page ranges (e.g. 1-3, 4-6)" },
                      { id: "odd-pages", label: "Extract odd pages only" },
                      { id: "even-pages", label: "Extract even pages only" },
                    ].map((opt) => (
                      <label
                        key={opt.id}
                        className="flex items-center space-x-2 text-xs text-neutral-300 cursor-pointer p-2 rounded-lg bg-neutral-950 border border-neutral-800"
                      >
                        <input
                          type="radio"
                          name="splitMode"
                          checked={config.splitMode === opt.id}
                          onChange={() => setConfig((p) => ({ ...p, splitMode: opt.id as any }))}
                          className="text-sky-500 focus:ring-0"
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>

                  {config.splitMode === "custom-ranges" && (
                    <div className="space-y-1 pt-1">
                      <label className="text-[11px] text-neutral-400">Page Ranges</label>
                      <input
                        type="text"
                        value={config.customRangesText}
                        onChange={(e) => setConfig((p) => ({ ...p, customRangesText: e.target.value }))}
                        placeholder="1-2, 3-5"
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-sky-500"
                      />
                    </div>
                  )}

                  <label className="flex items-center space-x-2 text-xs text-neutral-300 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={config.packageAsZip}
                      onChange={(e) => setConfig((p) => ({ ...p, packageAsZip: e.target.checked }))}
                      className="rounded text-sky-500 focus:ring-0 bg-neutral-950 border-neutral-800"
                    />
                    <span>Package all split PDFs into a single ZIP archive</span>
                  </label>
                </div>
              )}

              {activeTool === "pdf-to-image" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-neutral-300">Image Format</label>
                    <div className="grid grid-cols-3 gap-2 mt-1.5">
                      {(["png", "jpg", "webp"] as SupportedOutputFormat[]).map((fmt) => (
                        <button
                          key={fmt}
                          type="button"
                          onClick={() => setConfig((p) => ({ ...p, outputFormat: fmt }))}
                          className={`py-1.5 rounded-lg border text-xs font-mono font-medium transition-colors ${
                            config.outputFormat === fmt
                              ? "bg-sky-500/20 border-sky-500/50 text-sky-300"
                              : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white"
                          }`}
                        >
                          {fmt.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-neutral-300">Rendering Resolution (DPI)</label>
                    <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                      {[72, 150, 300, 600].map((dpi) => (
                        <button
                          key={dpi}
                          type="button"
                          onClick={() => setConfig((p) => ({ ...p, imageDpi: dpi as any }))}
                          className={`py-1.5 rounded-lg border text-xs font-mono transition-colors ${
                            config.imageDpi === dpi
                              ? "bg-sky-500/20 border-sky-500/50 text-sky-300"
                              : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white"
                          }`}
                        >
                          {dpi} DPI
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {["image-to-pdf", "word-to-pdf", "excel-to-pdf", "merge-pdf"].includes(activeTool) && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-neutral-300">PDF Page Size</label>
                    <select
                      value={config.pageSize}
                      onChange={(e) => setConfig((p) => ({ ...p, pageSize: e.target.value as any }))}
                      className="w-full mt-1.5 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-sky-500"
                    >
                      <option value="A4">A4 (Standard 210 × 297 mm)</option>
                      <option value="A5">A5 (148 × 210 mm)</option>
                      <option value="A6">A6 (105 × 148 mm)</option>
                      <option value="Letter">US Letter (8.5 × 11 in)</option>
                      <option value="Legal">US Legal (8.5 × 14 in)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-neutral-300">Page Orientation</label>
                    <div className="grid grid-cols-3 gap-2 mt-1.5">
                      {(["auto", "portrait", "landscape"] as const).map((orient) => (
                        <button
                          key={orient}
                          type="button"
                          onClick={() => setConfig((p) => ({ ...p, orientation: orient }))}
                          className={`py-1.5 rounded-lg border text-xs capitalize transition-colors ${
                            config.orientation === orient
                              ? "bg-sky-500/20 border-sky-500/50 text-sky-300"
                              : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white"
                          }`}
                        >
                          {orient}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-neutral-300">Margins: {config.marginMm}mm</label>
                    <input
                      type="range"
                      min="0"
                      max="30"
                      step="5"
                      value={config.marginMm}
                      onChange={(e) => setConfig((p) => ({ ...p, marginMm: parseInt(e.target.value, 10) }))}
                      className="w-full accent-sky-500 mt-1"
                    />
                  </div>
                </div>
              )}

              {activeTool === "pdf-to-word" && (
                <div className="space-y-3">
                  <label className="text-xs font-medium text-neutral-300">OCR & Extraction</label>
                  <label className="flex items-center space-x-2 text-xs text-neutral-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.detectTables}
                      onChange={(e) => setConfig((p) => ({ ...p, detectTables: e.target.checked }))}
                      className="rounded text-sky-500 focus:ring-0 bg-neutral-950 border-neutral-800"
                    />
                    <span>Detect and convert tables</span>
                  </label>
                  <label className="flex items-center space-x-2 text-xs text-neutral-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={true}
                      readOnly
                      className="rounded text-sky-500 focus:ring-0 bg-neutral-950 border-neutral-800"
                    />
                    <span>Automatic OCR fallback for scanned pages</span>
                  </label>
                </div>
              )}
            </div>

            {/* Bottom Execution Bar */}
            <div className="pt-4 border-t border-neutral-800 space-y-3">
              {isProcessing && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-400 truncate max-w-[200px]">{progressStatus}</span>
                    <span className="font-mono text-sky-400 font-semibold">{progressPercent}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sky-500 rounded-full transition-all duration-200"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center space-x-2">
                {isProcessing ? (
                  <button
                    onClick={handleCancelJob}
                    className="w-full py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 text-xs font-semibold transition-colors"
                  >
                    Cancel Conversion
                  </button>
                ) : (
                  <button
                    onClick={handleExecuteJob}
                    disabled={files.length === 0}
                    className="w-full flex items-center justify-center space-x-2 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-xs font-bold shadow-lg shadow-sky-600/25 transition-all"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>Run {currentToolDef.label}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Universal File Preview Modal */}
      {previewFile && (
        <UniversalFilePreview
          isOpen={!!previewFile}
          file={previewFile}
          onClose={() => setPreviewFile(null)}
          onOpenInPdfTool={onOpenInPdfStudio}
          onOpenInImageEditor={onOpenInImageEditor}
          onOpenInPassportStudio={onOpenInPassportStudio}
          onOpenInIdCardStudio={onOpenInIdCardStudio}
          onPrintDocument={onPrintDocument}
        />
      )}

      {/* Save / Rename Output Dialog */}
      {selectedOutputItem && (
        <SaveOutputDialog
          isOpen={saveModalOpen}
          defaultName={selectedOutputItem.fileName}
          defaultExtension={selectedOutputItem.format}
          itemCount={1}
          onConfirm={handleConfirmSave}
          onClose={() => setSaveModalOpen(false)}
        />
      )}
    </div>
  );
};
