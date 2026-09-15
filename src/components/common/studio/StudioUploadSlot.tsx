import React, { useRef } from "react";
import {
  Upload,
  Crop,
  Sparkles,
  RotateCw,
  Trash2,
  FileText,
  Check,
  RefreshCw,
  FolderOpen,
} from "lucide-react";

export interface StudioUploadSlotProps {
  label: string;
  side?: "front" | "back" | "photo";
  image?: string | null;
  rotation?: number;
  pdfInfo?: {
    fileName: string;
    numPages: number;
    activePage: number;
  } | null;
  aspectRatio?: string; // e.g. "85.6/53.98", "35/45", "1/1"
  onUploadFile: (file: File) => void;
  onBrowseClick?: () => void;
  onRotate?: (degrees: number) => void;
  onCropClick?: () => void;
  onBgRemoverClick?: () => void;
  onClear?: () => void;
  onPdfSelectPageClick?: () => void;
  onFromDocumentClick?: () => void;
  accept?: string;
  disabled?: boolean;
  badge?: string;
  badgeVariant?: "emerald" | "indigo" | "sky" | "amber" | "violet";
  subtitle?: string;
  className?: string;
  previewMaxHeight?: string;
}

const BADGE_STYLES: Record<string, string> = {
  emerald: "bg-emerald-950/80 text-emerald-300 border-emerald-700/60",
  indigo: "bg-indigo-950/80 text-indigo-300 border-indigo-700/60",
  sky: "bg-sky-950/80 text-sky-300 border-sky-700/60",
  amber: "bg-amber-950/80 text-amber-300 border-amber-700/60",
  violet: "bg-violet-950/80 text-violet-300 border-violet-700/60",
};

export const StudioUploadSlot: React.FC<StudioUploadSlotProps> = ({
  label,
  side = "front",
  image,
  rotation = 0,
  pdfInfo,
  aspectRatio = "85.6/53.98",
  onUploadFile,
  onBrowseClick,
  onRotate,
  onCropClick,
  onBgRemoverClick,
  onClear,
  onPdfSelectPageClick,
  onFromDocumentClick,
  accept = "image/*,application/pdf",
  disabled = false,
  badge,
  badgeVariant = "sky",
  subtitle,
  className = "",
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      onUploadFile(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onUploadFile(files[0]);
      e.target.value = "";
    }
  };

  const handleTriggerBrowse = () => {
    if (disabled) return;
    if (onBrowseClick) {
      onBrowseClick();
    } else {
      fileInputRef.current?.click();
    }
  };

  return (
    <div
      className={`bg-neutral-950/90 rounded-xl p-3 border border-neutral-800 flex flex-col space-y-2 transition-all ${className}`}
    >
      {/* Hidden native input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileInputChange}
        className="hidden"
        disabled={disabled}
      />

      {/* Slot Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span
            className={`w-2 h-2 rounded-full ${
              side === "front"
                ? "bg-emerald-400"
                : side === "back"
                ? "bg-indigo-400"
                : "bg-sky-400"
            }`}
          />
          <span className="font-bold text-neutral-200 text-xs tracking-wide">
            {label}
          </span>
          {badge && (
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                BADGE_STYLES[badgeVariant] || BADGE_STYLES.sky
              }`}
            >
              {badge}
            </span>
          )}
          {pdfInfo && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-red-950 text-red-300 border border-red-800">
              PDF
            </span>
          )}
        </div>

        <div className="flex items-center space-x-1">
          {image && onRotate && (
            <button
              type="button"
              onClick={() => onRotate(90)}
              className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              title="Rotate 90° Clockwise"
              disabled={disabled}
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          )}
          {image && onClear && (
            <button
              type="button"
              onClick={onClear}
              className="p-1 rounded text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition-colors"
              title="Remove Slot Image"
              disabled={disabled}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {subtitle && <p className="text-[10px] text-neutral-400">{subtitle}</p>}

      {/* Thumbnail or Drop Zone */}
      {image ? (
        <div className="space-y-2">
          <div
            onClick={handleTriggerBrowse}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            style={{ aspectRatio }}
            className="w-full bg-neutral-900 rounded-lg border border-neutral-700/60 flex items-center justify-center cursor-pointer overflow-hidden relative group shadow-inner"
            title="Click or drop an image/PDF to replace"
          >
            <img
              src={image}
              alt={label}
              className="w-full h-full object-contain"
              style={{ transform: `rotate(${rotation}deg)` }}
            />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-xs text-white font-medium space-x-1">
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Replace</span>
            </div>
          </div>

          {pdfInfo && (
            <div className="flex items-center justify-between text-[10px] bg-neutral-900 px-2 py-1 rounded border border-neutral-800">
              <span className="text-neutral-300 truncate max-w-[140px]" title={pdfInfo.fileName}>
                {pdfInfo.fileName}
              </span>
              <span className="text-neutral-400 font-mono">
                Pg {pdfInfo.activePage}/{pdfInfo.numPages}
              </span>
            </div>
          )}

          {/* Action Button Strip */}
          <div className="flex items-center space-x-1 pt-0.5">
            <button
              type="button"
              onClick={handleTriggerBrowse}
              className="flex-1 py-1 px-1.5 bg-neutral-800 hover:bg-neutral-750 text-neutral-200 text-[11px] rounded font-medium border border-neutral-700 transition-colors text-center"
            >
              Replace
            </button>

            {onCropClick && (
              <button
                type="button"
                onClick={onCropClick}
                className="flex-1 py-1 px-1.5 bg-sky-950/80 hover:bg-sky-900 border border-sky-800 text-[11px] rounded text-sky-300 font-medium flex items-center justify-center space-x-1 transition-colors"
                title="Crop & Align"
              >
                <Crop className="w-3 h-3" />
                <span>Crop</span>
              </button>
            )}

            {onBgRemoverClick && (
              <button
                type="button"
                onClick={onBgRemoverClick}
                className="flex-1 py-1 px-1.5 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800 text-[11px] rounded text-emerald-300 font-medium flex items-center justify-center space-x-1 transition-colors"
                title="Background Studio & Removal"
              >
                <Sparkles className="w-3 h-3 text-emerald-400" />
                <span>BG</span>
              </button>
            )}

            {pdfInfo && pdfInfo.numPages > 1 && onPdfSelectPageClick && (
              <button
                type="button"
                onClick={onPdfSelectPageClick}
                className="py-1 px-2 bg-indigo-950 hover:bg-indigo-900 border border-indigo-800 text-[11px] rounded text-indigo-300 font-medium transition-colors"
                title="Select another PDF page"
              >
                Page...
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={handleTriggerBrowse}
          className="border-2 border-dashed border-neutral-750 hover:border-sky-500/80 bg-neutral-900/40 rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all group"
        >
          <div className="w-9 h-9 rounded-full bg-neutral-800 group-hover:bg-sky-950/80 text-neutral-400 group-hover:text-sky-400 flex items-center justify-center mb-2 transition-colors">
            <Upload className="w-4 h-4" />
          </div>
          <p className="text-xs font-medium text-neutral-300 group-hover:text-white">
            Drag &amp; drop or click to upload
          </p>
          <p className="text-[10px] text-neutral-500 mt-0.5">
            Supports PNG, JPG, WEBP, PDF
          </p>

          <div className="flex items-center space-x-2 mt-3" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={handleTriggerBrowse}
              className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-[11px] font-semibold transition-colors"
            >
              Browse
            </button>
            {onFromDocumentClick && (
              <button
                type="button"
                onClick={onFromDocumentClick}
                className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-[10px] border border-neutral-700 transition-colors"
                title="Import active document page"
              >
                From Doc
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
