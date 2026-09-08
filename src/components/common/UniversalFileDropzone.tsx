import React, { useState, useRef } from "react";
import {
  UploadCloud,
  FileText,
  Image as ImageIcon,
  FileCode,
  FileCheck,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import {
  ACCEPT_ALL_SUPPORTED,
  ACCEPT_PDF_AND_IMAGES,
  ACCEPT_IMAGES_ONLY,
  ACCEPT_PDF_ONLY,
  analyzeFile,
} from "../../services/upload/FileTypeRegistry";

export interface UniversalFileDropzoneProps {
  onFilesSelected: (files: File[]) => void | Promise<void>;
  mode?: "all" | "pdf-and-images" | "images-only" | "pdf-only";
  multiple?: boolean;
  className?: string;
  compact?: boolean;
  title?: string;
  subtitle?: string;
  disabled?: boolean;
}

export const UniversalFileDropzone: React.FC<UniversalFileDropzoneProps> = ({
  onFilesSelected,
  mode = "all",
  multiple = true,
  className = "",
  compact = false,
  title,
  subtitle,
  disabled = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "pdf" | "image" | "doc">(
    mode === "images-only" ? "image" : mode === "pdf-only" ? "pdf" : "all"
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getAcceptString = () => {
    switch (activeTab) {
      case "pdf":
        return ACCEPT_PDF_ONLY;
      case "image":
        return ACCEPT_IMAGES_ONLY;
      case "doc":
        return ".docx,.doc,.txt,.rtf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/rtf";
      case "all":
      default:
        return mode === "pdf-and-images" ? ACCEPT_PDF_AND_IMAGES : ACCEPT_ALL_SUPPORTED;
    }
  };

  const handleProcess = async (fileList: FileList | File[]) => {
    if (disabled || isProcessing) return;
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setIsProcessing(true);
    try {
      await onFilesSelected(files);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleProcess(e.dataTransfer.files);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !disabled && !isProcessing && fileInputRef.current?.click()}
      className={`relative group cursor-pointer border-2 border-dashed rounded-2xl transition-all duration-200 select-none ${
        isDragging
          ? "border-sky-500 bg-sky-950/30 shadow-xl shadow-sky-500/10 scale-[1.01]"
          : "border-neutral-750 hover:border-neutral-600 bg-neutral-900/60 hover:bg-neutral-900/90"
      } ${disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : ""} ${
        compact ? "p-4" : "p-8"
      } ${className}`}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple={multiple}
        accept={getAcceptString()}
        className="hidden"
        onChange={(e) => {
          if (e.target.files) {
            handleProcess(e.target.files);
          }
        }}
      />

      <div className="flex flex-col items-center justify-center text-center space-y-3">
        {/* Animated Icon */}
        <div
          className={`rounded-2xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110 ${
            compact ? "w-10 h-10" : "w-14 h-14"
          } ${
            isDragging
              ? "bg-sky-500/20 text-sky-400 border border-sky-500/50 animate-pulse"
              : "bg-neutral-800/80 text-neutral-300 border border-neutral-700/60"
          }`}
        >
          {isProcessing ? (
            <RefreshCw className={`${compact ? "w-5 h-5" : "w-7 h-7"} animate-spin text-sky-400`} />
          ) : (
            <UploadCloud className={`${compact ? "w-5 h-5" : "w-7 h-7"}`} />
          )}
        </div>

        {/* Title and descriptions */}
        <div>
          <h3 className={`font-bold text-white tracking-wide ${compact ? "text-xs" : "text-sm"}`}>
            {title || (isDragging ? "Drop files to import instantly" : "Click to Browse or Drag & Drop")}
          </h3>
          <p className={`text-neutral-400 mt-0.5 ${compact ? "text-[11px]" : "text-xs"}`}>
            {subtitle || (
              mode === "images-only"
                ? "JPG, PNG, WEBP, BMP, TIFF, GIF, SVG"
                : mode === "pdf-only"
                ? "PDF documents (Multi-page supported)"
                : "PDF documents, Images (JPG, PNG, WEBP, BMP, TIFF, SVG) and Text docs (DOCX, TXT, RTF)"
            )}
          </p>
        </div>

        {/* Format Badges */}
        {!compact && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-950/60 text-red-300 border border-red-800/60">
              PDF
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-950/60 text-sky-300 border border-sky-800/60">
              PNG / JPG / WEBP
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
              BMP / TIFF / SVG
            </span>
            {mode === "all" && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-950/60 text-indigo-300 border border-indigo-800/60">
                DOCX / TXT / RTF
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
